/**
 * Mesures de performance.
 *
 * - Gain d'une période en € : valeur de fin − valeur de début − versements de la période.
 * - TWR (rendement pondéré par le temps) : chaîne des variations quotidiennes en retirant
 *   l'argent versé chaque jour ; un versement n'est jamais compté comme un gain.
 *   C'est le chiffre comparable à la performance de l'ETF lui-même.
 * - TRI (taux de rendement interne, « XIRR ») : le taux annuel qui, appliqué à chaque
 *   versement depuis sa date, donne la valeur actuelle. Comparable aux hypothèses
 *   de la projection.
 */
import { addMonths, addYears, addDays, diffDays, type ISODate, yearOf } from './dates';
import { ZERO, toNumber, type Dec } from './decimal';
import type { SeriesPoint } from './series';

/** Dernier point valorisé à la date donnée ou avant. */
export function valuedPointOnOrBefore(points: SeriesPoint[], date: ISODate): SeriesPoint | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.date <= date && p.value !== null) return p;
  }
  return null;
}

export function lastValuedPoint(points: SeriesPoint[]): SeriesPoint | null {
  for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null) return points[i];
  return null;
}

export interface PeriodResult {
  from: ISODate;
  to: ISODate;
  startValue: Dec;
  endValue: Dec;
  flows: Dec;
  /** Gain en € sur la période */
  gain: Dec;
  /** TWR, ou null si aucun intervalle mesurable */
  twr: number | null;
}

/**
 * Performance entre le point de base (dernier point valorisé ≤ from) et le point de fin.
 * Renvoie null si l'historique ne remonte pas jusqu'à « from ».
 */
export function periodPerformance(points: SeriesPoint[], from: ISODate, to: ISODate): PeriodResult | null {
  const base = valuedPointOnOrBefore(points, from);
  const end = valuedPointOnOrBefore(points, to);
  if (!base || !end || end.date <= base.date) return null;

  let flows = ZERO;
  let pendingFlow = ZERO;
  let previous = base;
  let product = 1;
  let links = 0;
  for (const p of points) {
    if (p.date <= base.date || p.date > end.date) continue;
    flows = flows.plus(p.flow);
    pendingFlow = pendingFlow.plus(p.flow);
    if (p.value === null) continue;
    if (previous.value !== null && previous.value.gt(0)) {
      product *= toNumber(p.value.minus(pendingFlow).div(previous.value));
      links++;
    }
    previous = p;
    pendingFlow = ZERO;
  }
  const startValue = base.value ?? ZERO;
  const endValue = end.value ?? ZERO;
  return {
    from: base.date,
    to: end.date,
    startValue,
    endValue,
    flows,
    gain: endValue.minus(startValue).minus(flows),
    twr: links > 0 ? product - 1 : null,
  };
}

export interface SessionChange {
  date: ISODate;
  previousDate: ISODate;
  gain: Dec;
  pct: number | null;
}

/** Variation de la dernière séance : (Vj − versements du jour) − Vj−1. */
export function lastSessionChange(points: SeriesPoint[]): SessionChange | null {
  const valued = points.filter((p) => p.value !== null);
  if (valued.length < 2) return null;
  const last = valued[valued.length - 1];
  const prev = valued[valued.length - 2];
  const lastIndex = points.indexOf(last);
  const prevIndex = points.indexOf(prev);
  let flow = ZERO;
  for (let i = prevIndex + 1; i <= lastIndex; i++) flow = flow.plus(points[i].flow);
  const gain = last.value!.minus(flow).minus(prev.value!);
  return {
    date: last.date,
    previousDate: prev.date,
    gain,
    pct: prev.value!.gt(0) ? toNumber(gain.div(prev.value!)) : null,
  };
}

export type PeriodKey = '1W' | '1M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'ALL';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  '1W': '1 semaine',
  '1M': '1 mois',
  YTD: 'Depuis le 1er janvier',
  '1Y': '1 an',
  '3Y': '3 ans',
  '5Y': '5 ans',
  ALL: 'Depuis le début',
};

/** Date de départ d'une période qui finit à « asOf ». */
export function periodStart(key: PeriodKey, asOf: ISODate, firstDate: ISODate): ISODate {
  switch (key) {
    case '1W':
      return addDays(asOf, -7);
    case '1M':
      return addMonths(asOf, -1);
    case 'YTD':
      return `${yearOf(asOf) - 1}-12-31`;
    case '1Y':
      return addYears(asOf, -1);
    case '3Y':
      return addYears(asOf, -3);
    case '5Y':
      return addYears(asOf, -5);
    case 'ALL':
      return firstDate;
  }
}

export interface CashFlow {
  date: ISODate;
  /** + versement, − retrait */
  amount: number;
}

/**
 * TRI annualisé. Résout : somme des versements capitalisés au taux r jusqu'à la date finale
 * = valeur finale. Newton, puis dichotomie si Newton ne converge pas.
 */
export function xirr(flows: CashFlow[], finalValue: number, finalDate: ISODate): number | null {
  const items = flows.filter((f) => f.amount !== 0 && f.date <= finalDate);
  if (items.length === 0 || finalValue <= 0) return null;
  const years = items.map((f) => diffDays(f.date, finalDate) / 365);
  const f = (r: number) => items.reduce((acc, it, i) => acc + it.amount * Math.pow(1 + r, years[i]), 0) - finalValue;
  const df = (r: number) => items.reduce((acc, it, i) => acc + it.amount * years[i] * Math.pow(1 + r, years[i] - 1), 0);

  let r = 0.05;
  for (let i = 0; i < 50; i++) {
    const value = f(r);
    const slope = df(r);
    if (!Number.isFinite(value) || !Number.isFinite(slope) || slope === 0) break;
    const next = r - value / slope;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  // Dichotomie sur [-99,99 % ; +1000 %]
  let lo = -0.9999;
  let hi = 10;
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-9 || hi - lo < 1e-12) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export interface YearRow {
  year: number;
  startValue: Dec;
  endValue: Dec;
  flows: Dec;
  gain: Dec;
  twr: number | null;
  /** true si l'année n'est pas terminée */
  partial: boolean;
}

/** Bilan année par année, de la plus récente à la plus ancienne. */
export function yearlyBreakdown(points: SeriesPoint[], asOf: ISODate): YearRow[] {
  const last = lastValuedPoint(points);
  if (!last || points.length < 2) return [];
  const firstYear = yearOf(points[0].date);
  const lastYear = yearOf(last.date);
  const rows: YearRow[] = [];
  for (let y = lastYear; y >= firstYear; y--) {
    const from = `${y - 1}-12-31`;
    const to = `${y}-12-31`;
    const result = periodPerformance(points, from < points[0].date ? points[0].date : from, to);
    if (!result) continue;
    rows.push({
      year: y,
      startValue: result.startValue,
      endValue: result.endValue,
      flows: result.flows,
      gain: result.gain,
      twr: result.twr,
      partial: y === yearOf(asOf) && asOf < to,
    });
  }
  return rows;
}
