/**
 * Calendrier des séances d'Euronext Paris.
 * Fermé le week-end et les jours fériés boursiers : 1er janvier, Vendredi saint,
 * lundi de Pâques, 1er mai, 25 et 26 décembre.
 */
import { addDays, type ISODate, parisNow, weekday, yearOf } from './dates';

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const holidayCache = new Map<number, Set<ISODate>>();

export function euronextHolidays(year: number): Set<ISODate> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const set = new Set<ISODate>([
    `${year}-01-01`,
    addDays(easter, -2), // Vendredi saint
    addDays(easter, 1), // Lundi de Pâques
    `${year}-05-01`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
  holidayCache.set(year, set);
  return set;
}

export function isTradingDay(date: ISODate): boolean {
  const wd = weekday(date);
  if (wd === 0 || wd === 6) return false;
  return !euronextHolidays(yearOf(date)).has(date);
}

/** Dernière séance strictement avant la date donnée. */
export function previousTradingDay(date: ISODate): ISODate {
  let d = addDays(date, -1);
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

/** Dernière séance à la date donnée ou avant. */
export function tradingDayOnOrBefore(date: ISODate): ISODate {
  return isTradingDay(date) ? date : previousTradingDay(date);
}

/** Séances entre deux dates, bornes incluses. */
export function tradingDaysBetween(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isTradingDay(d)) days.push(d);
  }
  return days;
}

/** Heure limite (Paris) après laquelle la clôture du jour doit être publiée : 22 h 45. */
export const PUBLICATION_DEADLINE_MINUTES = 22 * 60 + 45;

/**
 * Séance dont le cours de clôture devrait déjà être disponible.
 * Avant 22 h 45 un jour de séance, c'est la séance précédente :
 * le cours de la veille est alors considéré comme à jour.
 */
export function expectedPublishedSession(now: Date = new Date()): ISODate {
  const { date, minutes } = parisNow(now);
  if (isTradingDay(date) && minutes >= PUBLICATION_DEADLINE_MINUTES) return date;
  return previousTradingDay(date);
}
