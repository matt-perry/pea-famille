/**
 * Sauvegarde : export complet (JSON réimportable), export des mouvements (CSV), import.
 * Sur iPhone, le fichier passe par la feuille de partage : « Enregistrer dans Fichiers ».
 */
import { db } from '../models/db';
import { isISODate, MOVEMENT_LABELS, type Account, type Etf, type Movement, type PriceBar } from '../core';
import type { KeyValue } from '../models/db';
import { setSetting } from '../repositories/settings';

export const BACKUP_APP = 'pea-famille';
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  accounts: Account[];
  etfs: Etf[];
  movements: Movement[];
  prices: PriceBar[];
  settings: KeyValue[];
}

/** Réglages techniques qui n'ont pas à voyager dans une sauvegarde. */
const VOLATILE = new Set(['robotStatus', 'trackedSymbols', 'lastSyncAt', 'lastSyncError', 'lastExportAt', 'demoMode']);

export async function buildBackup(): Promise<BackupFile> {
  const [accounts, etfs, movements, prices, kv] = await Promise.all([
    db.accounts.toArray(),
    db.etfs.toArray(),
    db.movements.toArray(),
    db.prices.toArray(),
    db.kv.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    accounts,
    etfs,
    movements,
    prices,
    settings: kv.filter((row) => !VOLATILE.has(row.key)),
  };
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Propose le fichier via la feuille de partage (iPhone), sinon le télécharge. */
export async function shareFile(content: string, fileName: string, mime: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([content], fileName, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await buildBackup();
  const result = await shareFile(JSON.stringify(backup, null, 1), `pea-famille-sauvegarde-${stamp()}.json`, 'application/json');
  if (result !== 'cancelled') await setSetting('lastExportAt', Date.now());
  return result;
}

function csvCell(value: string | undefined): string {
  const v = value ?? '';
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV au format Excel français (séparateur « ; », virgule décimale). */
export function movementsToCSV(movements: Movement[], accounts: Account[], etfs: Etf[]): string {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const etfName = new Map(etfs.map((e) => [e.id, e.shortName || e.name]));
  const fr = (v?: string) => (v ? v.replace('.', ',') : '');
  const header = ['Date', 'Compte', 'Type', 'ETF', 'Quantité', 'Prix unitaire', 'Frais', 'Montant', 'Ratio', 'Note'];
  const rows = [...movements]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((m) =>
      [
        m.date,
        accountName.get(m.accountId) ?? '',
        MOVEMENT_LABELS[m.kind],
        m.etfId ? etfName.get(m.etfId) ?? '' : '',
        fr(m.quantity),
        fr(m.unitPrice),
        fr(m.fees),
        fr(m.amount),
        fr(m.ratio),
        m.note ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  return '﻿' + [header.join(';'), ...rows].join('\r\n') + '\r\n';
}

export async function exportCSV(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const [movements, accounts, etfs] = await Promise.all([db.movements.toArray(), db.accounts.toArray(), db.etfs.toArray()]);
  return shareFile(movementsToCSV(movements, accounts, etfs), `pea-famille-mouvements-${stamp()}.csv`, 'text/csv');
}

/** Vérifie qu'un fichier est bien une sauvegarde complète et cohérente. */
export function validateBackup(data: unknown): BackupFile {
  const b = data as BackupFile;
  if (!b || b.app !== BACKUP_APP) throw new Error("Ce fichier n'est pas une sauvegarde PEA Famille.");
  if (typeof b.schema !== 'number' || b.schema > BACKUP_SCHEMA) throw new Error('Sauvegarde créée par une version plus récente de l’app.');
  for (const key of ['accounts', 'etfs', 'movements', 'prices', 'settings'] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Sauvegarde incomplète (${key}).`);
  }
  const accountIds = new Set(b.accounts.map((a) => a.id));
  for (const m of b.movements) {
    if (!accountIds.has(m.accountId) || !isISODate(m.date) || !(m.kind in MOVEMENT_LABELS)) {
      throw new Error('Sauvegarde abîmée : un mouvement est invalide.');
    }
  }
  return b;
}

/** Remplace toutes les données par celles de la sauvegarde. */
export async function importBackup(file: File): Promise<{ movements: number }> {
  const backup = validateBackup(JSON.parse(await file.text()));
  await db.transaction('rw', [db.accounts, db.etfs, db.movements, db.prices, db.kv], async () => {
    await Promise.all([db.accounts.clear(), db.etfs.clear(), db.movements.clear(), db.prices.clear(), db.kv.clear()]);
    await db.accounts.bulkPut(backup.accounts);
    await db.etfs.bulkPut(backup.etfs);
    await db.movements.bulkPut(backup.movements);
    await db.prices.bulkPut(backup.prices);
    await db.kv.bulkPut(backup.settings);
  });
  return { movements: backup.movements.length };
}
