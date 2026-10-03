/**
 * Navigation : trois onglets, des pages empilées par-dessus, et des feuilles modales.
 */
import { createContext, useContext } from 'react';
import type { Movement } from '../core';

export type Tab = 'home' | 'movements' | 'projection';

export type Page =
  | { name: 'performance' }
  | { name: 'etf'; etfId: string }
  | { name: 'settings' }
  | { name: 'market' }
  | { name: 'methods' };

export type SheetState =
  | { name: 'movement'; movementId?: string; preset?: Partial<Movement> }
  | { name: 'goal' }
  | { name: 'etf'; etfId?: string }
  | { name: 'account'; accountId: string };

export interface Nav {
  tab: Tab;
  setTab: (tab: Tab) => void;
  push: (page: Page) => void;
  pop: () => void;
  openSheet: (sheet: SheetState) => void;
  closeSheet: () => void;
  toast: (message: string) => void;
  scope: string;
  setScope: (scope: string) => void;
  sync: () => Promise<void>;
  syncing: boolean;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav hors de NavContext');
  return nav;
}
