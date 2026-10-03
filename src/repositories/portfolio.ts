/**
 * Lecture et écriture des comptes, ETF et mouvements.
 * Les vues n'écrivent jamais directement dans la base : elles passent par ici.
 */
import { db } from '../models/db';
import type { Account, Etf, Movement, PriceBar } from '../core';

export const newId = (): string => crypto.randomUUID();

export async function saveAccount(account: Account): Promise<void> {
  await db.accounts.put(account);
}

export async function saveEtf(etf: Etf): Promise<void> {
  await db.etfs.put(etf);
}

/** Supprime un ETF s'il n'a jamais servi ; sinon l'archive (l'historique reste juste). */
export async function removeEtf(etfId: string): Promise<'deleted' | 'archived'> {
  const used = await db.movements.where('etfId').equals(etfId).count();
  if (used > 0) {
    await db.etfs.update(etfId, { archived: true });
    return 'archived';
  }
  await db.etfs.delete(etfId);
  return 'deleted';
}

export async function saveMovement(movement: Movement): Promise<void> {
  await db.movements.put(movement);
}

export async function deleteMovement(id: string): Promise<void> {
  await db.movements.delete(id);
}

export async function upsertPrices(bars: PriceBar[]): Promise<void> {
  if (bars.length > 0) await db.prices.bulkPut(bars);
}

export interface Snapshot {
  accounts: Account[];
  etfs: Etf[];
  movements: Movement[];
  prices: PriceBar[];
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [accounts, etfs, movements, prices] = await Promise.all([
    db.accounts.orderBy('order').toArray(),
    db.etfs.toArray(),
    db.movements.toArray(),
    db.prices.toArray(),
  ]);
  return { accounts, etfs, movements, prices };
}
