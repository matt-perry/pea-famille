/**
 * Fonctions du robot des cours, séparées du script pour être testées.
 */
import { isTradingDay, parisNow, previousTradingDay, type ISODate, isISODate, type PriceFile } from '../src/core';

export interface TrackedSymbol {
  symbol: string;
  /** Date à partir de laquelle récupérer l'historique */
  since: ISODate;
}

export interface SymbolStatus {
  lastDate: ISODate | null;
  count: number;
  error?: string;
}

export interface RobotStatus {
  /** Dernière fois que des cours ont été ajoutés */
  updatedAt: string | null;
  symbols: Record<string, SymbolStatus>;
}

const SYMBOL_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

export function parseSymbols(json: unknown): TrackedSymbol[] {
  if (!Array.isArray(json)) throw new Error('config/symbols.json doit contenir une liste.');
  return json.map((item, i) => {
    const symbol = String(item?.symbol ?? '').trim();
    const since = String(item?.since ?? '').trim();
    if (!SYMBOL_PATTERN.test(symbol)) throw new Error(`Symbole n°${i + 1} invalide : « ${symbol} ».`);
    if (!isISODate(since)) throw new Error(`Date « since » invalide pour ${symbol} (format AAAA-MM-JJ).`);
    return { symbol, since };
  });
}

export { priceFileName as fileNameFor } from '../src/core';

/** Le robot travaille les jours de séance, entre 19 h 40 et 23 h 00 (heure de Paris). */
export function isRobotWindow(now: Date): boolean {
  const { date, minutes } = parisNow(now);
  return isTradingDay(date) && minutes >= 19 * 60 + 40 && minutes <= 23 * 60;
}

/** Séance visée : aujourd'hui si c'est un jour de séance après 17 h 35, sinon la précédente. */
export function targetSession(now: Date): ISODate {
  const { date, minutes } = parisNow(now);
  if (isTradingDay(date) && minutes >= 17 * 60 + 35) return date;
  return previousTradingDay(date);
}

export type Bar = PriceFile['bars'][number];

/** Interprète la réponse JSON d'EODHD (liste de séances). */
export function parseEodResponse(json: unknown): Bar[] {
  if (!Array.isArray(json)) throw new Error('Réponse EODHD inattendue.');
  const bars: Bar[] = [];
  for (const row of json) {
    const date = row?.date;
    const close = Number(row?.close);
    const adj = row?.adjusted_close === undefined || row?.adjusted_close === null ? null : Number(row.adjusted_close);
    if (!isISODate(date) || !Number.isFinite(close) || close <= 0) continue;
    bars.push([date, close, adj !== null && Number.isFinite(adj) ? adj : null]);
  }
  return bars.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Fusionne deux historiques ; en cas de doublon, la donnée la plus récente l'emporte. */
export function mergeBars(existing: Bar[], incoming: Bar[]): Bar[] {
  const byDate = new Map<string, Bar>();
  for (const b of existing) byDate.set(b[0], b);
  for (const b of incoming) byDate.set(b[0], b);
  return [...byDate.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export async function fetchEod(
  symbol: string,
  from: ISODate,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Bar[]> {
  const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?fmt=json&from=${from}&api_token=${encodeURIComponent(apiKey)}`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    // ne jamais afficher l'URL : elle contient la clé
    throw new Error(`EODHD a répondu ${response.status} pour ${symbol}.`);
  }
  return parseEodResponse(await response.json());
}
