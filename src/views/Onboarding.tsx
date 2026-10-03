/**
 * Premier lancement : créer les deux comptes et le premier ETF.
 */
import { useState } from 'react';
import { Field, Section, Toggle } from '../components/ui';
import { db } from '../models/db';
import { newId } from '../repositories/portfolio';
import { setSetting } from '../repositories/settings';
import type { Account, Etf } from '../core';

/** ETF identifié d'après le cours indiqué (6,31 € le 2 octobre 2026) — à vérifier dans Trade Republic. */
const SUGGESTED_ETF: Omit<Etf, 'id'> = {
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

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function Onboarding() {
  const [name1, setName1] = useState('PEA 1');
  const [name2, setName2] = useState('PEA 2');
  const [withEtf, setWithEtf] = useState(true);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const accounts: Account[] = [
      { id: newId(), name: name1.trim() || 'PEA 1', owner: '', order: 0, archived: false, broker: 'Trade Republic' },
      { id: newId(), name: name2.trim() || 'PEA 2', owner: '', order: 1, archived: false, broker: 'Trade Republic' },
    ];
    await db.transaction('rw', [db.accounts, db.etfs, db.kv], async () => {
      await db.accounts.bulkPut(accounts);
      if (withEtf) await db.etfs.put({ id: newId(), ...SUGGESTED_ETF });
    });
    await setSetting('goal', { target: '500000', scope: 'family' });
  };

  return (
    <div className="screen" style={{ paddingTop: 'calc(var(--safe-top) + 32px)' }}>
      <img src="./icons/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 16 }} />
      <h1 className="large-title" style={{ marginTop: 16 }}>
        PEA Famille
      </h1>
      <p className="secondary" style={{ lineHeight: 1.45, margin: 0 }}>
        Suivre nos deux PEA, voir où on en est, et où on pourrait être dans 25 ans. Les données restent sur cet iPhone.
      </p>

      {!isStandalone() && (
        <div className="banner info">
          <span>
            <strong>Installer l'app</strong>
            Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ». L'app s'ouvrira en plein écran, comme une app classique.
          </span>
        </div>
      )}

      <Section title="Vos deux comptes">
        <Field label="Compte 1" htmlFor="ob-1">
          <input id="ob-1" value={name1} onChange={(e) => setName1(e.target.value)} />
        </Field>
        <Field label="Compte 2" htmlFor="ob-2">
          <input id="ob-2" value={name2} onChange={(e) => setName2(e.target.value)} />
        </Field>
      </Section>

      <Section
        title="Votre ETF"
        footer="Identifié d'après le cours que tu m'as indiqué (6,31 € à la clôture du 2 octobre 2026). Vérifie l'ISIN dans Trade Republic ; tu pourras le modifier ou ajouter d'autres ETF dans les réglages."
      >
        <div className="field">
          <div className="row-main">
            <div>
              <strong>{SUGGESTED_ETF.name}</strong>
            </div>
            <div className="row-sub">
              {SUGGESTED_ETF.ticker} · Euronext Paris · ISIN {SUGGESTED_ETF.isin}
            </div>
          </div>
          <Toggle label="Ajouter cet ETF" checked={withEtf} onChange={setWithEtf} />
        </div>
      </Section>

      <div style={{ marginTop: 28 }}>
        <button className="btn-primary" onClick={start} disabled={busy}>
          Commencer
        </button>
      </div>
      <p className="section-footer" style={{ textAlign: 'center' }}>
        Objectif proposé : 500 000 € pour la famille, modifiable à tout moment.
      </p>
    </div>
  );
}
