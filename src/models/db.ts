/**
 * Base de données locale (IndexedDB, sur l'iPhone).
 * Chaque évolution du schéma ajoute une version avec sa migration : ne jamais modifier
 * une version existante, pour ne pas perdre de données lors d'une mise à jour.
 */
import Dexie, { type Table } from 'dexie';
import type { Account, Etf, Movement, PriceBar } from '../core';

export interface KeyValue {
  key: string;
  value: unknown;
}

export class PeaDatabase extends Dexie {
  accounts!: Table<Account, string>;
  etfs!: Table<Etf, string>;
  movements!: Table<Movement, string>;
  prices!: Table<PriceBar, [string, string]>;
  kv!: Table<KeyValue, string>;

  constructor(name = 'pea-famille') {
    super(name);
    this.version(1).stores({
      accounts: 'id, order',
      etfs: 'id, symbol',
      movements: 'id, accountId, etfId, date',
      prices: '[symbol+date], symbol, date',
      kv: 'key',
    });
  }
}

export const db = new PeaDatabase();
