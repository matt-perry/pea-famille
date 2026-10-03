/**
 * Onglet Mouvements : historique complet, groupé par mois.
 */
import { useMemo, useState } from 'react';
import {
  computeLedgers,
  D,
  formatDateShort,
  formatEUR,
  formatMonthYear,
  formatPrice,
  formatQty,
  MOVEMENT_LABELS,
  sortMovements,
  type Movement,
} from '../core';
import { NavBar, Row, Section, Segmented, Signed } from '../components/ui';
import { IconPlus, IconWarning } from '../components/icons';
import { useAppData } from '../viewmodels/AppData';
import { useNav } from './nav';

function cashImpact(m: Movement): number | null {
  const q = D(m.quantity);
  const p = D(m.unitPrice);
  const f = D(m.fees);
  switch (m.kind) {
    case 'deposit':
    case 'dividend':
      return Number(m.amount);
    case 'withdrawal':
    case 'fee':
      return -Number(m.amount);
    case 'buy':
      return -Number(q.times(p).plus(f).toString());
    case 'sell':
      return Number(q.times(p).minus(f).toString());
    default:
      return null;
  }
}

export function MovementsView() {
  const data = useAppData();
  const nav = useNav();
  const scope = data.accounts.some((a) => a.id === nav.scope) ? nav.scope : 'family';
  const etfName = (id?: string) => (id ? data.ctx.etfsById.get(id)?.shortName ?? 'ETF' : '');
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? '';

  const [showAll, setShowAll] = useState(false);
  const isTrade = (m: Movement) => m.kind === 'buy' || m.kind === 'sell';

  const warnings = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of computeLedgers(data.movements).values()) for (const w of l.warnings) map.set(w.movementId, w.message);
    return map;
  }, [data.movements]);

  const inScope = useMemo(() => data.movements.filter((m) => scope === 'family' || m.accountId === scope), [data.movements, scope]);
  const hiddenCount = inScope.filter((m) => !isTrade(m)).length;

  const groups = useMemo(() => {
    const list = sortMovements(inScope.filter((m) => showAll || isTrade(m))).reverse();
    const byMonth = new Map<string, Movement[]>();
    for (const m of list) {
      const key = m.date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), m]);
    }
    return [...byMonth.entries()];
  }, [inScope, showAll]);

  return (
    <div className="screen">
      <NavBar
        title="Mouvements"
        actions={
          <button className="icon-button" aria-label="Ajouter un mouvement" onClick={() => nav.openSheet({ name: 'movement' })}>
            <IconPlus />
          </button>
        }
      />
      {data.accounts.length > 1 && (
        <Segmented
          label="Compte"
          value={scope}
          onChange={nav.setScope}
          options={[{ value: 'family', label: 'Tous' }, ...data.accounts.map((a) => ({ value: a.id, label: a.name }))]}
        />
      )}

      {groups.length === 0 && (
        <Section>
          <div className="empty">
            <strong>Aucun achat ni vente</strong>
            Touche « + » pour ajouter un achat. Les versements sont déduits automatiquement des achats.
          </div>
        </Section>
      )}

      {groups.map(([month, items]) => (
        <Section key={month} title={formatMonthYear(`${month}-01`)}>
          {items.map((m) => {
            const impact = cashImpact(m);
            const detail =
              m.kind === 'buy' || m.kind === 'sell'
                ? `${formatQty(D(m.quantity))} × ${formatPrice(D(m.unitPrice))}`
                : m.kind === 'split'
                  ? `1 part → ${m.ratio}`
                  : '';
            return (
              <Row
                key={m.id}
                title={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {warnings.has(m.id) && (
                      <span className="warn" title={warnings.get(m.id)}>
                        <IconWarning size={16} />
                      </span>
                    )}
                    <strong>{MOVEMENT_LABELS[m.kind]}</strong>
                    {m.etfId ? ` · ${etfName(m.etfId)}` : ''}
                  </span>
                }
                subtitle={[accountName(m.accountId), formatDateShort(m.date), detail].filter(Boolean).join(' · ')}
                value={impact === null ? `× ${m.ratio}` : <Signed value={m.kind === 'deposit' ? impact : null}>{formatEUR(impact, { decimals: 2, signed: true })}</Signed>}
                onClick={() => nav.openSheet({ name: 'movement', movementId: m.id })}
              />
            );
          })}
        </Section>
      ))}

      {hiddenCount > 0 && (
        <Section footer="Versements, retraits, dividendes, frais et divisions. Les versements que tu ne saisis pas sont déduits automatiquement des achats.">
          <button className="row" onClick={() => setShowAll((v) => !v)}>
            <span className="row-main btn-plain">
              {showAll ? 'Afficher seulement les achats et ventes' : `Afficher aussi les autres mouvements (${hiddenCount})`}
            </span>
          </button>
        </Section>
      )}
    </div>
  );
}
