/**
 * Saisie ou modification d'un mouvement, avec récapitulatif calculé en direct.
 */
import { useMemo, useState } from 'react';
import { formatEUR, formatPrice, formatQty, MOVEMENT_LABELS, todayParis, type Dec, type MovementKind } from '../core';
import { Field, Messages, Section, Segmented, Sheet } from '../components/ui';
import { deleteMovement, newId, saveMovement } from '../repositories/portfolio';
import { useAppData } from '../viewmodels/AppData';
import { checkMovement, draftFromMovement, type MovementDraft } from '../viewmodels/movementForm';
import { useNav } from './nav';

const MAIN: MovementKind[] = ['buy', 'sell', 'deposit'];
const OTHER: MovementKind[] = ['withdrawal', 'dividend', 'fee', 'split'];

export function MovementSheet(props: { movementId?: string }) {
  const data = useAppData();
  const nav = useNav();
  const editing = props.movementId ? data.movements.find((m) => m.id === props.movementId) ?? null : null;
  const activeEtfs = data.etfs.filter((e) => !e.archived || e.id === editing?.etfId);
  const defaultAccount = data.accounts.some((a) => a.id === nav.scope) ? nav.scope : data.accounts[0]?.id ?? '';

  const [draft, setDraft] = useState<MovementDraft>(() =>
    editing
      ? draftFromMovement(editing)
      : {
          kind: 'buy',
          accountId: defaultAccount,
          etfId: activeEtfs[0]?.id ?? '',
          date: todayParis(),
          quantity: '',
          unitPrice: '',
          fees: '',
          amount: '',
          ratio: '',
          note: '',
        },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touched, setTouched] = useState(false);
  const check = useMemo(() => checkMovement(draft, data.movements, editing), [draft, data.movements, editing]);
  const set = (patch: Partial<MovementDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const isOther = OTHER.includes(draft.kind);
  const tradeKind = draft.kind === 'buy' || draft.kind === 'sell';
  const amountKind = ['deposit', 'withdrawal', 'dividend', 'fee'].includes(draft.kind);
  const etfKind = tradeKind || draft.kind === 'dividend' || draft.kind === 'split';

  const save = async () => {
    setTouched(true);
    if (!check.movement) return;
    await saveMovement({ ...check.movement, id: editing?.id ?? newId() });
    nav.closeSheet();
    nav.toast(editing ? 'Mouvement modifié' : `${MOVEMENT_LABELS[draft.kind]} enregistré`);
  };

  const remove = async () => {
    if (!editing) return;
    await deleteMovement(editing.id);
    nav.closeSheet();
    nav.toast('Mouvement supprimé');
  };

  const show = (value: Dec | string, kind: string) =>
    typeof value === 'string' ? value : kind === 'qty' ? formatQty(value) : kind === 'price' ? formatPrice(value) : formatEUR(value, { decimals: 2 });

  return (
    <Sheet
      title={editing ? 'Modifier' : 'Mouvement'}
      confirmLabel={editing ? 'OK' : 'Ajouter'}
      onCancel={nav.closeSheet}
      onConfirm={save}
      confirmDisabled={touched && !check.movement}
    >
      <div style={{ marginTop: 16 }}>
        <Segmented
          label="Type de mouvement"
          value={isOther ? ('other' as MovementKind) : draft.kind}
          onChange={(k) => set({ kind: k === ('other' as MovementKind) ? 'withdrawal' : k })}
          options={[...MAIN.map((k) => ({ value: k, label: MOVEMENT_LABELS[k] })), { value: 'other' as MovementKind, label: 'Autre' }]}
        />
      </div>

      <Section>
        {isOther && (
          <Field label="Type" htmlFor="mv-kind">
            <select id="mv-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value as MovementKind })}>
              {OTHER.map((k) => (
                <option key={k} value={k}>
                  {MOVEMENT_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Compte" htmlFor="mv-account">
          <select id="mv-account" value={draft.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {etfKind && (
          <Field label="ETF" htmlFor="mv-etf">
            <select id="mv-etf" value={draft.etfId} onChange={(e) => set({ etfId: e.target.value })}>
              {activeEtfs.length === 0 && <option value="">Aucun ETF : ajoute-le dans Réglages</option>}
              {activeEtfs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.shortName} ({e.ticker})
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Date" htmlFor="mv-date">
          <input id="mv-date" type="date" value={draft.date} max={todayParis()} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        {tradeKind && (
          <>
            <Field label="Quantité" htmlFor="mv-qty">
              <input id="mv-qty" inputMode="decimal" placeholder="5" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </Field>
            <Field label="Prix unitaire" htmlFor="mv-price">
              <input id="mv-price" inputMode="decimal" placeholder="6,31 €" value={draft.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} />
            </Field>
            <Field label="Frais" htmlFor="mv-fees">
              <input id="mv-fees" inputMode="decimal" placeholder="0 €" value={draft.fees} onChange={(e) => set({ fees: e.target.value })} />
            </Field>
          </>
        )}
        {amountKind && (
          <Field label="Montant" htmlFor="mv-amount">
            <input id="mv-amount" inputMode="decimal" placeholder="500 €" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
        )}
        {draft.kind === 'split' && (
          <Field label="Parts pour 1" htmlFor="mv-ratio">
            <input id="mv-ratio" inputMode="decimal" placeholder="10" value={draft.ratio} onChange={(e) => set({ ratio: e.target.value })} />
          </Field>
        )}
        <Field label="Note" htmlFor="mv-note">
          <input id="mv-note" placeholder="Facultatif" value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </Section>

      {check.summary.length > 0 && (
        <Section title="Récapitulatif">
          <div className="card-padded summary-grid">
            {check.summary.map((s) => (
              <div key={s.label} style={{ display: 'contents' }}>
                <span className="k">{s.label}</span>
                <span className="v">{show(s.value, s.kind)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Messages errors={touched ? check.errors : []} warnings={check.warnings} />

      {editing && (
        <Section>
          {confirmDelete ? (
            <button className="row destructive" style={{ justifyContent: 'center', fontWeight: 600 }} onClick={remove}>
              Confirmer la suppression
            </button>
          ) : (
            <button className="row destructive" style={{ justifyContent: 'center' }} onClick={() => setConfirmDelete(true)}>
              Supprimer ce mouvement
            </button>
          )}
        </Section>
      )}
    </Sheet>
  );
}
