/**
 * Index des cours de clôture stockés localement, par symbole.
 * Recherche du dernier cours connu à une date donnée (jamais de cours inventé).
 */
import { D, type Dec } from './decimal';
import type { ISODate, PriceBar } from './domain';

export interface PricePoint {
  date: ISODate;
  close: Dec;
}

export class PriceIndex {
  private readonly bySymbol = new Map<string, PricePoint[]>();

  constructor(bars: PriceBar[]) {
    for (const bar of bars) {
      const list = this.bySymbol.get(bar.symbol) ?? [];
      list.push({ date: bar.date, close: D(bar.close) });
      this.bySymbol.set(bar.symbol, list);
    }
    for (const list of this.bySymbol.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  series(symbol: string): PricePoint[] {
    return this.bySymbol.get(symbol) ?? [];
  }

  /** Dernier cours à la date donnée ou avant, sinon null. */
  onOrBefore(symbol: string, date: ISODate): PricePoint | null {
    const list = this.bySymbol.get(symbol);
    if (!list || list.length === 0) return null;
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].date <= date) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found >= 0 ? list[found] : null;
  }

  /** Cours précédant strictement une date. */
  before(symbol: string, date: ISODate): PricePoint | null {
    const list = this.bySymbol.get(symbol);
    if (!list) return null;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].date < date) return list[i];
    return null;
  }

  latest(symbol: string): PricePoint | null {
    const list = this.bySymbol.get(symbol);
    return list && list.length > 0 ? list[list.length - 1] : null;
  }

  /** Date du cours le plus récent parmi les symboles demandés. */
  latestDate(symbols: Iterable<string>): ISODate | null {
    let best: ISODate | null = null;
    for (const s of symbols) {
      const p = this.latest(s);
      if (p && (!best || p.date > best)) best = p.date;
    }
    return best;
  }
}
