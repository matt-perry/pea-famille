/**
 * Données de l'app, lues en direct dans la base locale : tout écran se met à jour
 * dès qu'un mouvement, un cours ou un réglage change.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { loadSettings, type Settings } from '../repositories/settings';
import type { Account, Etf, Movement, PriceBar } from '../core';
import { makeContext, type Context } from './portfolio';

export interface AppData {
  accounts: Account[];
  etfs: Etf[];
  movements: Movement[];
  prices: PriceBar[];
  settings: Settings;
  ctx: Context;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider(props: { children: ReactNode; fallback: ReactNode }) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []);
  const etfs = useLiveQuery(() => db.etfs.toArray(), []);
  const movements = useLiveQuery(() => db.movements.toArray(), []);
  const prices = useLiveQuery(() => db.prices.toArray(), []);
  const settings = useLiveQuery(() => loadSettings(), []);

  const value = useMemo(() => {
    if (!accounts || !etfs || !movements || !prices || !settings) return null;
    return { accounts, etfs, movements, prices, settings, ctx: makeContext({ accounts, etfs, movements, prices }) };
  }, [accounts, etfs, movements, prices, settings]);

  if (!value) return <>{props.fallback}</>;
  return <AppDataContext.Provider value={value}>{props.children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData hors de AppDataProvider');
  return value;
}
