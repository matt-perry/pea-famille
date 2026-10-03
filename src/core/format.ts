/**
 * Mise en forme française : « 42 350 € », « +0,29 % », « ven. 2 oct. ».
 * Partagée par l'app et, plus tard, par la notification.
 */
import { toNumber, type Dec } from './decimal';
import { parseISO, type ISODate } from './dates';

type Num = Dec | number | null | undefined;

function asNumber(value: Num): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : toNumber(value);
}

const eurFormatters = new Map<string, Intl.NumberFormat>();
function eurFormatter(decimals: number, signed: boolean): Intl.NumberFormat {
  const key = `${decimals}-${signed}`;
  let f = eurFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    eurFormatters.set(key, f);
  }
  return f;
}

/** Montant en euros. decimals : 0 ou 2 ; signed : affiche + devant les gains. */
export function formatEUR(value: Num, options: { decimals?: number; signed?: boolean } = {}): string {
  const n = asNumber(value);
  if (n === null || !Number.isFinite(n)) return '—';
  const decimals = options.decimals ?? 0;
  const rounded = Number(n.toFixed(decimals));
  return eurFormatter(decimals, options.signed ?? false).format(Object.is(rounded, -0) ? 0 : rounded);
}

/** Montant projeté, arrondi au millier : « ≈ 822 000 € ». */
export function formatEURApprox(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `≈ ${eurFormatter(0, false).format(Math.round(value / 1000) * 1000)}`;
}

/** Ratio en pourcentage : 0.0029 → « +0,29 % ». */
export function formatPct(ratio: number | null | undefined, options: { decimals?: number; signed?: boolean } = {}): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: options.decimals ?? 2,
    maximumFractionDigits: options.decimals ?? 2,
    signDisplay: options.signed === false ? 'auto' : 'exceptZero',
  }).format(ratio);
}

/** Quantité de parts : jusqu'à 6 décimales, sans zéros inutiles. */
export function formatQty(value: Num): string {
  const n = asNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 }).format(n);
}

/** Prix unitaire : 2 à 4 décimales. */
export function formatPrice(value: Num): string {
  const n = asNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const numericDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** « ven. 2 oct. » */
export function formatDateShort(date: ISODate | null): string {
  return date ? shortDate.format(parseISO(date)) : '—';
}

/** « 2 octobre 2026 » */
export function formatDateLong(date: ISODate | null): string {
  return date ? longDate.format(parseISO(date)) : '—';
}

/** « 2 oct. » */
export function formatDayMonth(date: ISODate | null): string {
  return date ? dayMonth.format(parseISO(date)) : '—';
}

/** « octobre 2026 » */
export function formatMonthYear(date: ISODate): string {
  const s = monthYear.format(parseISO(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 02/10/2026 » */
export function formatDateNumeric(date: ISODate | null): string {
  return date ? numericDate.format(parseISO(date)) : '—';
}
