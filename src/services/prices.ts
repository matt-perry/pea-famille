/**
 * Récupère les cours publiés par le robot GitHub, les déchiffre et les range dans la base locale.
 * Les fichiers sont lus sur raw.githubusercontent.com (dépôt public), jamais chez le fournisseur
 * des cours : l'iPhone ne contacte que GitHub.
 */
import { decryptJSON, priceFileName, type EncryptedPayload, type Etf, type PriceBar, type PriceFile } from '../core';
import { upsertPrices } from '../repositories/portfolio';
import { setSetting } from '../repositories/settings';

export interface RobotStatusSnapshot {
  updatedAt: string | null;
  symbols: Record<string, { lastDate: string | null; count: number; error?: string }>;
}

export interface SyncResult {
  ok: boolean;
  added: number;
  errors: string[];
}

/**
 * Adresse des fichiers du dépôt, déduite de l'adresse GitHub Pages :
 * https://<compte>.github.io/<dépôt>/ → https://raw.githubusercontent.com/<compte>/<dépôt>/main/
 */
export function deriveDataBaseUrl(location: { hostname: string; pathname: string }): string | null {
  const match = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (!match) return null;
  const owner = match[1];
  const first = location.pathname.split('/').filter(Boolean)[0];
  const repo = first && !first.includes('.') ? first : `${owner}.github.io`;
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/`;
}

export function resolveDataBaseUrl(override: string | null): string | null {
  if (override && /^https:\/\//.test(override)) return override.endsWith('/') ? override : `${override}/`;
  return deriveDataBaseUrl(window.location);
}

/** Lien direct pour modifier la liste des symboles sur GitHub. */
export function symbolsEditUrl(base: string | null): string | null {
  const m = base?.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/$/);
  return m ? `https://github.com/${m[1]}/${m[2]}/edit/${m[3]}/config/symbols.json` : null;
}

export function repoUrl(base: string | null): string | null {
  const m = base?.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

async function getJSON<T>(url: string): Promise<T | null> {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub a répondu ${response.status}.`);
  return (await response.json()) as T;
}

export async function syncPrices(etfs: Etf[], dataKey: string | null, baseOverride: string | null): Promise<SyncResult> {
  const base = resolveDataBaseUrl(baseOverride);
  const errors: string[] = [];
  if (!base) return { ok: false, added: 0, errors: ["Adresse des données inconnue : renseigne-la dans Réglages › Données de marché."] };
  if (!dataKey) return { ok: false, added: 0, errors: ['Clé de lecture des cours absente : Réglages › Données de marché.'] };

  let added = 0;
  try {
    const [status, tracked] = await Promise.all([
      getJSON<RobotStatusSnapshot>(`${base}data/status.json`),
      getJSON<{ symbol: string }[]>(`${base}config/symbols.json`),
    ]);
    await setSetting('robotStatus', status);
    await setSetting('trackedSymbols', tracked ? tracked.map((t) => t.symbol) : null);

    const symbols = [...new Set(etfs.filter((e) => !e.archived && e.symbol).map((e) => e.symbol))];
    for (const symbol of symbols) {
      const payload = await getJSON<EncryptedPayload>(`${base}data/prices/${priceFileName(symbol)}`);
      if (!payload) {
        errors.push(`${symbol} : aucun cours publié par le robot pour l'instant.`);
        continue;
      }
      let file: PriceFile;
      try {
        file = await decryptJSON<PriceFile>(payload, dataKey);
      } catch {
        errors.push(`${symbol} : impossible de déchiffrer — la clé de l'app diffère du secret DATA_KEY de GitHub.`);
        continue;
      }
      const fetchedAt = Date.now();
      const bars: PriceBar[] = file.bars.map(([date, close, adj]) => ({
        symbol,
        date,
        close: String(close),
        adjClose: adj === null ? undefined : String(adj),
        source: file.source || 'robot',
        fetchedAt,
      }));
      await upsertPrices(bars);
      added += bars.length;
    }
  } catch (error) {
    errors.push(error instanceof Error && error.message ? `Connexion impossible : ${error.message}` : 'Connexion impossible.');
  }

  await setSetting('lastSyncAt', Date.now());
  await setSetting('lastSyncError', errors.length ? errors.join('\n') : null);
  return { ok: errors.length === 0, added, errors };
}
