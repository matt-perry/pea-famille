/**
 * Fonctions du robot des cours, séparées du script pour être testées.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

/**
 * Yahoo renvoie des nombres flottants approchés (ex. 6.308000087738037).
 * Les cours Euronext ont au plus 4 décimales : on arrondit à 4 décimales, ce qui retire
 * le bruit de calcul sans jamais modifier un cours réel.
 */
function cleanPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1e4) / 1e4;
}

/** Interprète la réponse JSON du graphique Yahoo Finance (v8/finance/chart). */
export function parseYahooResponse(json: unknown): Bar[] {
  const chart = (json as { chart?: { result?: unknown[]; error?: { description?: string } | null } })?.chart;
  if (chart?.error) throw new Error(`Yahoo Finance : ${chart.error.description ?? 'erreur inconnue'}.`);
  const result = chart?.result?.[0] as
    | {
        meta?: { gmtoffset?: number; currency?: string };
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[]; adjclose?: { adjclose?: (number | null)[] }[] };
      }
    | undefined;
  if (!result) throw new Error('Réponse Yahoo Finance inattendue.');
  if (result.meta?.currency && result.meta.currency !== 'EUR') {
    throw new Error(`Yahoo Finance donne ce symbole en ${result.meta.currency}, pas en euros.`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const adjs = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  // date de la séance à l'heure de la place (Paris), pas en UTC
  const offset = Number(result.meta?.gmtoffset ?? 0);
  const byDate = new Map<string, Bar>();
  timestamps.forEach((ts, i) => {
    const close = cleanPrice(closes[i]);
    if (close === null || !Number.isFinite(ts)) return;
    const date = new Date((ts + offset) * 1000).toISOString().slice(0, 10);
    if (!isISODate(date)) return;
    byDate.set(date, [date, close, cleanPrice(adjs[i])]);
  });
  return [...byDate.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Cours quotidiens chez Yahoo Finance : aucun compte ni clé nécessaire. */
export async function fetchYahoo(symbol: string, from: ISODate, fetchImpl: typeof fetch = fetch): Promise<Bar[]> {
  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      // Yahoo refuse les requêtes sans navigateur identifié
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    },
  });
  if (!response.ok) {
    const hint = response.status === 429 ? ' (trop de demandes, nouvel essai au prochain passage)' : '';
    throw new Error(`Yahoo Finance a répondu ${response.status} pour ${symbol}${hint}.`);
  }
  return parseYahooResponse(await response.json());
}

/** Lance un script Python et renvoie sa sortie standard (ou le dernier message d'erreur). */
export type RunPython = (args: string[]) => Promise<string>;

export const runPython: RunPython = (args) =>
  new Promise((resolve, reject) => {
    execFile('python3', args, { timeout: 90_000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const lastLine = String(stderr).trim().split('\n').at(-1);
        reject(new Error(lastLine || error.message));
      } else {
        resolve(String(stdout));
      }
    });
  });

const YAHOO_SCRIPT = fileURLToPath(new URL('./yahoo.py', import.meta.url));

/** Interprète la sortie de robot/yahoo.py, en revérifiant chaque séance. */
export function parseYfinanceOutput(text: string): Bar[] {
  let json: { currency?: string | null; bars?: unknown[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Sortie yfinance illisible.');
  }
  if (json.currency && json.currency !== 'EUR') {
    throw new Error(`yfinance donne ce symbole en ${json.currency}, pas en euros.`);
  }
  if (!Array.isArray(json.bars)) throw new Error('Sortie yfinance inattendue.');
  const byDate = new Map<string, Bar>();
  for (const row of json.bars) {
    if (!Array.isArray(row)) continue;
    const [date, close, adj] = row;
    const c = cleanPrice(close);
    if (!isISODate(date) || c === null) continue;
    byDate.set(date, [date, c, cleanPrice(adj)]);
  }
  return [...byDate.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Yahoo Finance via yfinance (Python), installé par le robot du soir. */
export async function fetchYfinance(symbol: string, from: ISODate, until: ISODate, run: RunPython = runPython): Promise<Bar[]> {
  let output: string;
  try {
    output = await run([YAHOO_SCRIPT, symbol, from, until]);
  } catch (error) {
    throw new Error(`yfinance : ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseYfinanceOutput(output);
}

export interface FetchResult {
  bars: Bar[];
  source: 'Yahoo Finance' | 'EODHD';
}

/**
 * Sources des cours, essayées dans l'ordre jusqu'à la première qui répond :
 * 1. Yahoo Finance via yfinance (passe les refus de Yahoo envers les serveurs GitHub) ;
 * 2. Yahoo Finance en appel direct ;
 * 3. EODHD, seulement si une clé est fournie.
 * Seules les séances terminées (jusqu'à `until`) sont conservées.
 */
export async function fetchBars(
  symbol: string,
  from: ISODate,
  until: ISODate,
  options: { eodhdKey?: string; fetchImpl?: typeof fetch; runPython?: RunPython } = {},
): Promise<FetchResult> {
  const keep = (bars: Bar[]) => bars.filter((b) => b[0] >= from && b[0] <= until);
  const sources: { source: FetchResult['source']; load: () => Promise<Bar[]> }[] = [
    { source: 'Yahoo Finance', load: () => fetchYfinance(symbol, from, until, options.runPython) },
    { source: 'Yahoo Finance', load: () => fetchYahoo(symbol, from, options.fetchImpl) },
  ];
  if (options.eodhdKey) {
    const key = options.eodhdKey;
    sources.push({ source: 'EODHD', load: () => fetchEod(symbol, from, key, options.fetchImpl) });
  }
  const errors: string[] = [];
  for (const { source, load } of sources) {
    try {
      return { bars: keep(await load()), source };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(' · '));
}
