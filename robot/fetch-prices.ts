/**
 * Robot du soir (exécuté par GitHub Actions).
 *
 * 1. Vérifie qu'on est un soir de séance (ou un lancement manuel).
 * 2. Pour chaque symbole de config/symbols.json, récupère chez EODHD les cours manquants.
 *    Tant que la clôture du jour n'est pas publiée, seul le premier symbole (« témoin »)
 *    est interrogé, pour économiser les 20 appels quotidiens de l'offre gratuite.
 * 3. Écrit data/prices/<symbole>.json chiffré avec DATA_KEY, et data/status.json (sans cours).
 *
 * Variables d'environnement : EODHD_API_KEY, DATA_KEY, FORCE=1 (lancement manuel).
 */
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { decryptJSON, encryptJSON, isValidDataKey, type EncryptedPayload, type PriceFile } from '../src/core';
import {
  fetchEod,
  fileNameFor,
  isRobotWindow,
  mergeBars,
  parseSymbols,
  targetSession,
  type Bar,
  type RobotStatus,
} from './lib';

const ROOT = new URL('../', import.meta.url);
const path = (p: string) => new URL(p, ROOT);

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const now = new Date();
  const force = process.env.FORCE === '1';
  if (!force && !isRobotWindow(now)) {
    console.log('Hors du créneau du soir : rien à faire.');
    return;
  }

  const apiKey = process.env.EODHD_API_KEY?.trim() ?? '';
  const dataKey = process.env.DATA_KEY?.trim() ?? '';
  if (!apiKey) throw new Error('Secret EODHD_API_KEY manquant (GitHub › Settings › Secrets and variables › Actions).');
  if (!isValidDataKey(dataKey)) throw new Error('Secret DATA_KEY manquant ou invalide : copie la clé affichée dans l’app (Réglages › Données de marché).');

  const symbols = parseSymbols(JSON.parse(await readFile(path('config/symbols.json'), 'utf8')));
  const target = targetSession(now);
  console.log(`Séance visée : ${target} — ${symbols.length} symbole(s).`);

  await mkdir(path('data/prices/'), { recursive: true });
  const statusPath = path('data/status.json');
  const previousStatus: RobotStatus = existsSync(statusPath)
    ? JSON.parse(await readFile(statusPath, 'utf8'))
    : { updatedAt: null, symbols: {} };
  const status: RobotStatus = { updatedAt: previousStatus.updatedAt, symbols: {} };

  let changed = false;
  let sentinelReady = true;

  for (const [index, tracked] of symbols.entries()) {
    const filePath = path(`data/prices/${fileNameFor(tracked.symbol)}`);
    let bars: Bar[] = [];
    if (existsSync(filePath)) {
      const payload = JSON.parse(await readFile(filePath, 'utf8')) as EncryptedPayload;
      bars = (await decryptJSON<PriceFile>(payload, dataKey)).bars;
    }
    const last = bars.at(-1)?.[0] ?? null;
    status.symbols[tracked.symbol] = { lastDate: last, count: bars.length };

    if (last && last >= target) {
      console.log(`${tracked.symbol} : déjà à jour (${last}).`);
      continue;
    }
    if (index > 0 && !sentinelReady && !force) {
      console.log(`${tracked.symbol} : en attente de la publication du témoin.`);
      continue;
    }

    const from = last ? nextDay(last) : tracked.since;
    try {
      const incoming = await fetchEod(tracked.symbol, from, apiKey);
      const merged = mergeBars(bars, incoming);
      const newLast = merged.at(-1)?.[0] ?? null;
      if (merged.length !== bars.length || newLast !== last) {
        const file: PriceFile = {
          symbol: tracked.symbol,
          currency: 'EUR',
          source: 'EODHD',
          updatedAt: now.toISOString(),
          bars: merged,
        };
        await writeFile(filePath, JSON.stringify(await encryptJSON(file, dataKey)) + '\n');
        changed = true;
        console.log(`${tracked.symbol} : ${merged.length - bars.length} séance(s) ajoutée(s), dernière ${newLast}.`);
      } else {
        console.log(`${tracked.symbol} : pas encore de nouvelle séance chez EODHD.`);
      }
      status.symbols[tracked.symbol] = { lastDate: newLast, count: merged.length };
      if (index === 0 && (!newLast || newLast < target)) sentinelReady = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${tracked.symbol} : ${message}`);
      status.symbols[tracked.symbol] = { lastDate: last, count: bars.length, error: message };
      if (index === 0) sentinelReady = false;
    }
  }

  if (changed) status.updatedAt = now.toISOString();
  const statusText = JSON.stringify(status, null, 2) + '\n';
  const previousText = JSON.stringify(previousStatus, null, 2) + '\n';
  if (statusText !== previousText) await writeFile(statusPath, statusText);

  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
