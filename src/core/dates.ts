/**
 * Dates « jour calendaire » au format AAAA-MM-JJ, sans heure ni fuseau.
 * Tous les calculs se font en UTC pour éviter les décalages d'un jour.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;

export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(parseISO(value)) === value;
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISO(new Date(parseISO(date).getTime() + days * DAY_MS));
}

/** Nombre de jours de a vers b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISO(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toISO(target);
}

export function addYears(date: ISODate, years: number): ISODate {
  return addMonths(date, years * 12);
}

/** 0 = dimanche … 6 = samedi */
export function weekday(date: ISODate): number {
  return parseISO(date).getUTCDay();
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Date et minutes écoulées depuis minuit, à l'heure de Paris. */
export function parisNow(now: Date = new Date()): { date: ISODate; minutes: number } {
  const parts = Object.fromEntries(parisFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function todayParis(now: Date = new Date()): ISODate {
  return parisNow(now).date;
}
