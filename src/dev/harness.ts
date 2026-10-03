/**
 * Aperçu iPhone : chargé uniquement quand l'app est affichée dans un cadre de la même origine
 * (page de test). Jamais actif dans l'app installée sur l'écran d'accueil.
 *
 * Messages reçus de la page parente :
 * - pea-theme { theme: 'light' | 'dark' | null }  thème forcé ou automatique
 * - pea-frame { top, bottom }                      zones sûres simulées (encoche, barre d'accueil)
 * - pea-demo-load                                  remplace tout par des données d'exemple FICTIVES
 * - pea-reset                                      efface tout (retour au premier lancement)
 */
import { liveQuery } from 'dexie';
import { db } from '../models/db';
import { tradingDaysBetween, type Account, type Etf, type Movement, type PriceBar } from '../core';

type Message =
  | { type: 'pea-theme'; theme: 'light' | 'dark' | null }
  | { type: 'pea-frame'; top: number; bottom: number }
  | { type: 'pea-demo-load' }
  | { type: 'pea-reset' };

const targetOrigin = () => (location.origin === 'null' ? '*' : location.origin);

function post(message: Record<string, unknown>) {
  window.parent.postMessage(message, targetOrigin());
}

/** Informe la page parente du contenu de la base, à chaque changement. */
function watchState() {
  liveQuery(async () => ({ accounts: await db.accounts.count(), movements: await db.movements.count() })).subscribe({
    next: (counts) => post({ type: 'pea-state', ...counts }),
    error: () => post({ type: 'pea-state', error: true }),
  });
}

/** Générateur pseudo-aléatoire déterministe (les mêmes données fictives à chaque chargement). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Données d'exemple : deux ans d'achats mensuels d'environ 500 € et des cours SIMULÉS. */
export function buildDemoData() {
  const accounts: Account[] = [
    { id: 'demo-pea-1', name: 'PEA 1', owner: '', order: 0, archived: false, broker: 'Trade Republic' },
    { id: 'demo-pea-2', name: 'PEA 2', owner: '', order: 1, archived: false, broker: 'Trade Republic' },
  ];
  const etf: Etf = {
    id: 'demo-dcam',
    name: 'Amundi PEA Monde (MSCI World) UCITS ETF Acc',
    shortName: 'MSCI World',
    ticker: 'DCAM',
    exchange: 'PA',
    symbol: 'DCAM.PA',
    isin: 'FR001400U5Q4',
    currency: 'EUR',
    category: 'monde',
    issuer: 'Amundi',
    archived: false,
  };

  // Cours simulés : marche aléatoire avec une correction au printemps 2025,
  // recalée pour partir de 5,00 € et finir à 6,308 € (clôture réelle du 2 octobre 2026).
  const days = tradingDaysBetween('2024-10-01', '2026-10-02');
  const rand = seeded(2026);
  const raw: number[] = [];
  let level = 0;
  for (const day of days) {
    let move = 0.0003 + (rand() - 0.5) * 0.02;
    if (day >= '2025-03-27' && day <= '2025-04-08') move -= 0.011;
    if (day >= '2025-04-09' && day <= '2025-05-20') move += 0.0028;
    level += move;
    raw.push(level);
  }
  const n = raw.length;
  const start = Math.log(5) - raw[0];
  const slope = (Math.log(6.308) - start - raw[n - 1]) / (n - 1);
  const closes = raw.map((r, i) => Math.round(Math.exp(r + start + slope * i) * 1000) / 1000);
  closes[n - 1] = 6.308;
  const prices: PriceBar[] = days.map((date, i) => ({
    symbol: etf.symbol,
    date,
    close: String(closes[i]),
    source: 'démo',
    fetchedAt: 0,
  }));
  const closeOn = new Map(days.map((d, i) => [d, closes[i]]));

  // Mouvements : un achat d'environ 500 € le premier jour de séance du mois (versements déduits automatiquement).
  const movements: Movement[] = [];
  let createdAt = 1;
  const firstSessionOfMonth = new Map<string, string>();
  for (const d of days) if (!firstSessionOfMonth.has(d.slice(0, 7))) firstSessionOfMonth.set(d.slice(0, 7), d);
  for (const account of accounts) {
    const from = account.id === 'demo-pea-1' ? '2024-10' : '2025-01';
    for (const [month, day] of firstSessionOfMonth) {
      if (month < from) continue;
      const price = closeOn.get(day)!;
      movements.push({
        id: `demo-${account.id}-${day}-a`,
        accountId: account.id,
        etfId: etf.id,
        kind: 'buy',
        date: day,
        quantity: String(Math.floor(500 / price)),
        unitPrice: String(price),
        fees: '0',
        createdAt: createdAt++,
      });
    }
  }
  return { accounts, etfs: [etf], movements, prices };
}

async function clearAll() {
  await db.transaction('rw', [db.accounts, db.etfs, db.movements, db.prices, db.kv], async () => {
    await Promise.all([db.accounts.clear(), db.etfs.clear(), db.movements.clear(), db.prices.clear(), db.kv.clear()]);
  });
}

async function loadDemo() {
  const demo = buildDemoData();
  await db.transaction('rw', [db.accounts, db.etfs, db.movements, db.prices, db.kv], async () => {
    await Promise.all([db.accounts.clear(), db.etfs.clear(), db.movements.clear(), db.prices.clear(), db.kv.clear()]);
    await db.accounts.bulkPut(demo.accounts);
    await db.etfs.bulkPut(demo.etfs);
    await db.movements.bulkPut(demo.movements);
    await db.prices.bulkPut(demo.prices);
    await db.kv.bulkPut([
      { key: 'demoMode', value: true },
      { key: 'goal', value: { target: '500000', scope: 'family' } },
      { key: 'lastExportAt', value: Date.now() },
      { key: 'scope', value: 'family' },
    ]);
  });
}

export function startHarness() {
  window.addEventListener('message', async (event) => {
    if (event.source !== window.parent) return;
    if (location.origin !== 'null' && event.origin !== location.origin) return;
    const message = event.data as Message;
    switch (message?.type) {
      case 'pea-theme':
        if (message.theme) document.documentElement.dataset.theme = message.theme;
        else delete document.documentElement.dataset.theme;
        break;
      case 'pea-frame':
        document.documentElement.style.setProperty('--safe-top', `${Number(message.top) || 0}px`);
        document.documentElement.style.setProperty('--safe-bottom', `${Number(message.bottom) || 0}px`);
        break;
      case 'pea-demo-load':
        await loadDemo();
        window.scrollTo(0, 0);
        break;
      case 'pea-reset':
        await clearAll();
        window.scrollTo(0, 0);
        break;
    }
  });
  watchState();
}
