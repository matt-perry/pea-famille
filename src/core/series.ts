/**
 * Historique de valeur, recalculé à partir des mouvements et des cours stockés.
 * Un point par séance Euronext ; un point de départ à 0 la veille du premier mouvement.
 */
import { addDays, type ISODate } from './dates';
import { tradingDaysBetween } from './calendar';
import { ZERO, type Dec } from './decimal';
import type { Etf, Movement } from './domain';
import { applyMovement, emptyLedger, mergeLedgers, netDeposits, sortMovements, type LedgerState } from './ledger';
import type { PriceIndex } from './prices';
import { valueLedger } from './valuation';

export interface SeriesPoint {
  date: ISODate;
  /** Valeur totale, ou null si un cours manque à cette date */
  value: Dec | null;
  /** Versé net cumulé */
  netDeposits: Dec;
  /** Versements nets arrivés depuis le point précédent */
  flow: Dec;
}

export function buildSeries(
  movements: Movement[],
  etfsById: Map<string, Etf>,
  prices: PriceIndex,
  endDate: ISODate,
): SeriesPoint[] {
  const sorted = sortMovements(movements).filter((m) => m.date <= endDate);
  if (sorted.length === 0) return [];

  const ledgers = new Map<string, LedgerState>();
  const ledgerOf = (accountId: string) => {
    let l = ledgers.get(accountId);
    if (!l) {
      l = emptyLedger();
      ledgers.set(accountId, l);
    }
    return l;
  };

  const first = sorted[0].date;
  const points: SeriesPoint[] = [{ date: addDays(first, -1), value: ZERO, netDeposits: ZERO, flow: ZERO }];
  let index = 0;
  let previousDeposits = ZERO;

  for (const day of tradingDaysBetween(first, endDate)) {
    while (index < sorted.length && sorted[index].date <= day) {
      const m = sorted[index];
      applyMovement(ledgerOf(m.accountId), m);
      index++;
    }
    const merged = mergeLedgers(ledgers.values());
    const valuation = valueLedger(merged, etfsById, prices, day);
    const deposits = netDeposits(merged);
    points.push({
      date: day,
      value: valuation.complete ? valuation.total : null,
      netDeposits: deposits,
      // versements saisis ou déduits des achats depuis la séance précédente
      flow: deposits.minus(previousDeposits),
    });
    previousDeposits = deposits;
  }
  return points;
}
