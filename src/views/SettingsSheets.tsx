/**
 * Feuilles de réglage : objectif, compte, fiche ETF.
 */
import { useState } from 'react';
import { formatEUR, parseDecimal, type EtfCategory } from '../core';
import { Field, Messages, Section, Sheet } from '../components/ui';
import { newId, removeEtf, saveAccount, saveEtf } from '../repositories/portfolio';
import { setSetting } from '../repositories/settings';
import { useAppData } from '../viewmodels/AppData';
import { useNav } from './nav';

export function GoalSheet() {
  const data = useAppData();
  const nav = useNav();
  const goal = data.settings.goal;
  const [target, setTarget] = useState(goal ? goal.target.replace('.', ',') : '500000');
  const [scope, setScope] = useState(goal?.scope ?? 'family');
  const parsed = parseDecimal(target);
  const valid = parsed !== null && parsed.gt(0);

  return (
    <Sheet
      title="Objectif"
      onCancel={nav.closeSheet}
      confirmDisabled={!valid}
      onConfirm={async () => {
        await setSetting('goal', { target: parsed!.toString(), scope });
        nav.closeSheet();
        nav.toast('Objectif enregistré');
      }}
    >
      <Section footer={valid ? `Objectif : ${formatEUR(parsed!)}` : 'Indique un montant, ex. 500 000.'}>
        <Field label="Montant visé" htmlFor="goal-target">
          <input id="goal-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Pour" htmlFor="goal-scope">
          <select id="goal-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="family">Famille (les deux PEA)</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>
      {goal && (
        <Section>
          <button
            className="row destructive"
            style={{ justifyContent: 'center' }}
            onClick={async () => {
              await setSetting('goal', null);
              nav.closeSheet();
            }}
          >
            Supprimer l'objectif
          </button>
        </Section>
      )}
    </Sheet>
  );
}

export function AccountSheet({ accountId }: { accountId: string }) {
  const data = useAppData();
  const nav = useNav();
  const account = data.accounts.find((a) => a.id === accountId);
  const [name, setName] = useState(account?.name ?? '');
  const [owner, setOwner] = useState(account?.owner ?? '');
  const [openedOn, setOpenedOn] = useState(account?.openedOn ?? '');
  const [broker, setBroker] = useState(account?.broker ?? '');
  if (!account) return null;
  return (
    <Sheet
      title="Compte"
      onCancel={nav.closeSheet}
      confirmDisabled={!name.trim()}
      onConfirm={async () => {
        await saveAccount({ ...account, name: name.trim(), owner: owner.trim(), openedOn: openedOn || undefined, broker: broker.trim() || undefined });
        nav.closeSheet();
      }}
    >
      <Section>
        <Field label="Nom affiché" htmlFor="acc-name">
          <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Titulaire" htmlFor="acc-owner">
          <input id="acc-owner" placeholder="Facultatif" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Ouverture" htmlFor="acc-opened">
          <input id="acc-opened" type="date" value={openedOn} onChange={(e) => setOpenedOn(e.target.value)} />
        </Field>
        <Field label="Courtier" htmlFor="acc-broker">
          <input id="acc-broker" placeholder="Trade Republic" value={broker} onChange={(e) => setBroker(e.target.value)} />
        </Field>
      </Section>
    </Sheet>
  );
}

const CATEGORIES: { value: EtfCategory; label: string }[] = [
  { value: 'monde', label: 'Actions monde' },
  { value: 'usa', label: 'Actions États-Unis' },
  { value: 'nasdaq', label: 'Nasdaq' },
  { value: 'europe', label: 'Actions Europe' },
  { value: 'emergents', label: 'Pays émergents' },
  { value: 'autre', label: 'Autre' },
];

export function EtfSheet({ etfId }: { etfId?: string }) {
  const data = useAppData();
  const nav = useNav();
  const existing = etfId ? data.etfs.find((e) => e.id === etfId) : undefined;
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    shortName: existing?.shortName ?? '',
    ticker: existing?.ticker ?? '',
    exchange: existing?.exchange ?? 'PA',
    isin: existing?.isin ?? '',
    currency: existing?.currency ?? 'EUR',
    category: existing?.category ?? ('monde' as EtfCategory),
    issuer: existing?.issuer ?? '',
    sourceUrl: existing?.sourceUrl ?? '',
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const symbol = `${form.ticker.trim().toUpperCase()}.${form.exchange.trim().toUpperCase()}`;

  const errors: string[] = [];
  if (!form.shortName.trim()) errors.push('Nom court requis (ex. MSCI World).');
  if (!/^[A-Za-z0-9]{1,12}$/.test(form.ticker.trim())) errors.push('Ticker requis, lettres et chiffres (ex. DCAM).');
  if (!/^[A-Za-z]{1,6}$/.test(form.exchange.trim())) errors.push('Code de place requis (PA pour Euronext Paris).');
  if (form.isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(form.isin.trim().toUpperCase())) errors.push('ISIN invalide (12 caractères, ex. FR001400U5Q4).');
  const warnings = form.currency.trim().toUpperCase() !== 'EUR' ? ['Hors euro : cet ETF ne sera pas converti (V1 en euros).'] : [];

  return (
    <Sheet
      title={existing ? 'Modifier l’ETF' : 'Nouvel ETF'}
      onCancel={nav.closeSheet}
      confirmDisabled={errors.length > 0}
      onConfirm={async () => {
        await saveEtf({
          id: existing?.id ?? newId(),
          name: form.name.trim() || form.shortName.trim(),
          shortName: form.shortName.trim(),
          ticker: form.ticker.trim().toUpperCase(),
          exchange: form.exchange.trim().toUpperCase(),
          symbol,
          isin: form.isin.trim().toUpperCase(),
          currency: form.currency.trim().toUpperCase() || 'EUR',
          category: form.category,
          issuer: form.issuer.trim(),
          sourceUrl: form.sourceUrl.trim() || undefined,
          archived: existing?.archived ?? false,
        });
        nav.closeSheet();
        nav.toast(`ETF enregistré — pense à ajouter ${symbol} au robot si besoin`);
      }}
    >
      <Section footer={`Symbole interrogé par le robot : ${symbol}. Il doit figurer dans config/symbols.json sur GitHub.`}>
        <Field label="Nom court" htmlFor="etf-short">
          <input id="etf-short" placeholder="MSCI World" value={form.shortName} onChange={(e) => set({ shortName: e.target.value })} />
        </Field>
        <Field label="Nom complet" htmlFor="etf-name">
          <input id="etf-name" placeholder="Amundi PEA Monde…" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Ticker" htmlFor="etf-ticker">
          <input id="etf-ticker" placeholder="DCAM" autoCapitalize="characters" value={form.ticker} onChange={(e) => set({ ticker: e.target.value })} />
        </Field>
        <Field label="Place" htmlFor="etf-exchange">
          <input id="etf-exchange" placeholder="PA" autoCapitalize="characters" value={form.exchange} onChange={(e) => set({ exchange: e.target.value })} />
        </Field>
        <Field label="ISIN" htmlFor="etf-isin">
          <input id="etf-isin" placeholder="FR001400U5Q4" autoCapitalize="characters" value={form.isin} onChange={(e) => set({ isin: e.target.value })} />
        </Field>
        <Field label="Devise" htmlFor="etf-currency">
          <input id="etf-currency" placeholder="EUR" autoCapitalize="characters" value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
        </Field>
        <Field label="Type" htmlFor="etf-category">
          <select id="etf-category" value={form.category} onChange={(e) => set({ category: e.target.value as EtfCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Émetteur" htmlFor="etf-issuer">
          <input id="etf-issuer" placeholder="Amundi" value={form.issuer} onChange={(e) => set({ issuer: e.target.value })} />
        </Field>
        <Field label="Lien source" htmlFor="etf-url">
          <input id="etf-url" type="url" placeholder="https://…" value={form.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} />
        </Field>
      </Section>
      <Messages errors={errors} warnings={warnings} />
      {existing && (
        <Section footer="Un ETF déjà utilisé dans des mouvements est archivé (masqué) plutôt que supprimé, pour garder l'historique juste.">
          <button
            className="row destructive"
            style={{ justifyContent: 'center', fontWeight: confirmRemove ? 600 : 400 }}
            onClick={async () => {
              if (!confirmRemove) return setConfirmRemove(true);
              const result = await removeEtf(existing.id);
              nav.closeSheet();
              nav.toast(result === 'archived' ? 'ETF archivé' : 'ETF supprimé');
            }}
          >
            {confirmRemove ? 'Confirmer' : 'Supprimer ou archiver'}
          </button>
        </Section>
      )}
    </Sheet>
  );
}
