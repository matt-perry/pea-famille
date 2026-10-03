/**
 * Réglages simples (clé → valeur) stockés dans la base locale.
 */
import { db } from '../models/db';
import { DEFAULT_PROJECTION, type Goal, type ProjectionSettings } from '../core';
import type { RobotStatusSnapshot } from '../services/prices';

export interface Settings {
  scope: string;
  goal: Goal | null;
  projection: ProjectionSettings | null;
  dataKey: string | null;
  dataBaseUrl: string | null;
  robotStatus: RobotStatusSnapshot | null;
  trackedSymbols: string[] | null;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  lastExportAt: number | null;
  /** Données d'exemple fictives chargées (aperçu) */
  demoMode: boolean | null;
}

export const DEFAULT_SETTINGS: Settings = {
  scope: 'family',
  goal: null,
  projection: null,
  dataKey: null,
  dataBaseUrl: null,
  robotStatus: null,
  trackedSymbols: null,
  lastSyncAt: null,
  lastSyncError: null,
  lastExportAt: null,
  demoMode: null,
};

export async function loadSettings(): Promise<Settings> {
  const rows = await db.kv.toArray();
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in settings) (settings as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.kv.put({ key, value });
}

export function projectionWithDefaults(p: ProjectionSettings | null, accountIds: string[]): ProjectionSettings {
  const monthly: Record<string, string> = {};
  for (const id of accountIds) monthly[id] = p?.monthly?.[id] ?? '500';
  return { ...DEFAULT_PROJECTION, ...(p ?? {}), monthly };
}
