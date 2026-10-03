/**
 * Valorisation d'un grand livre à une date, avec les cours stockés.
 * Une position sans aucun cours connu n'est jamais valorisée à son PRU :
 * elle est signalée et le total est marqué « incomplet ».
 */
import { ZERO, toNumber, type Dec } from './decimal';
import type { Etf, ISODate } from './domain';
import { netDeposits, unitCost, type LedgerState } from './ledger';
import type { PriceIndex, PricePoint } from './prices';

export interface PositionValuation {
  etfId: string;
  symbol: string;
  quantity: Dec;
  cost: Dec;
  pru: Dec | null;
  price: PricePoint | null;
  value: Dec | null;
  unrealized: Dec | null;
  unrealizedPct: number | null;
  realized: Dec;
}

export interface Valuation {
  date: ISODate;
  positions: PositionValuation[];
  /** Valeur des parts dont le cours est connu */
  securitiesValue: Dec;
  cash: Dec;
  /** Valeur totale = parts valorisées + liquidités */
  total: Dec;
  /** false si au moins une position n'a aucun cours */
  complete: boolean;
  missing: string[];
  /** Plus ancienne date de cours utilisée (fraîcheur) */
  oldestPriceDate: ISODate | null;
  newestPriceDate: ISODate | null;
  netDeposits: Dec;
  /** Coût d'acquisition des parts détenues */
  invested: Dec;
  unrealized: Dec;
  realized: Dec;
  dividends: Dec;
  otherFees: Dec;
  /** Gain total = valeur − versé net (null si valeur incomplète) */
  gain: Dec | null;
  /** Gain total / versé net */
  gainPct: number | null;
}

export function valueLedger(
  ledger: LedgerState,
  etfsById: Map<string, Etf>,
  prices: PriceIndex,
  date: ISODate,
): Valuation {
  const positions: PositionValuation[] = [];
  let securitiesValue = ZERO;
  let invested = ZERO;
  let unrealized = ZERO;
  const missing: string[] = [];
  let oldest: ISODate | null = null;
  let newest: ISODate | null = null;

  for (const p of ledger.positions.values()) {
    const etf = etfsById.get(p.etfId);
    const symbol = etf?.symbol ?? '';
    const held = p.quantity.gt(0);
    const price = held && symbol ? prices.onOrBefore(symbol, date) : null;
    const value = price ? p.quantity.times(price.close) : null;
    const pru = unitCost(p);
    const unr = value ? value.minus(p.cost) : null;
    if (held) {
      invested = invested.plus(p.cost);
      if (value && unr) {
        securitiesValue = securitiesValue.plus(value);
        unrealized = unrealized.plus(unr);
        if (!oldest || price!.date < oldest) oldest = price!.date;
        if (!newest || price!.date > newest) newest = price!.date;
      } else {
        missing.push(p.etfId);
      }
    }
    positions.push({
      etfId: p.etfId,
      symbol,
      quantity: p.quantity,
      cost: p.cost,
      pru,
      price,
      value,
      unrealized: unr,
      unrealizedPct: unr && p.cost.gt(0) ? toNumber(unr.div(p.cost)) : null,
      realized: p.realized,
    });
  }

  const nd = netDeposits(ledger);
  const total = securitiesValue.plus(ledger.cash);
  const complete = missing.length === 0;
  const gain = complete ? total.minus(nd) : null;
  return {
    date,
    positions,
    securitiesValue,
    cash: ledger.cash,
    total,
    complete,
    missing,
    oldestPriceDate: oldest,
    newestPriceDate: newest,
    netDeposits: nd,
    invested,
    unrealized,
    realized: ledger.realized,
    dividends: ledger.dividends,
    otherFees: ledger.otherFees,
    gain,
    gainPct: gain && nd.gt(0) ? toNumber(gain.div(nd)) : null,
  };
}
