/**
 * Détail de la performance : d'où vient la valeur, performance par période, année par année.
 */
import { useMemo } from 'react';
import { formatDateLong, formatEUR, formatPct, toNumber } from '../core';
import { NavBar, Row, Section, Signed } from '../components/ui';
import { useAppData } from '../viewmodels/AppData';
import { buildPerformance, buildPortfolio } from '../viewmodels/portfolio';
import { NatureLine } from './HomeView';
import { useNav } from './nav';

export function PerformanceView() {
  const data = useAppData();
  const nav = useNav();
  const scope = data.accounts.some((a) => a.id === nav.scope) ? nav.scope : 'family';
  const model = useMemo(() => buildPortfolio(data.ctx, scope), [data.ctx, scope]);
  const perf = useMemo(() => buildPerformance(model), [model]);
  const v = model.valuation;

  const amount = (value: Parameters<typeof formatEUR>[0], signed = false) => (
    <span className="num">{formatEUR(value, { decimals: 2, signed })}</span>
  );

  return (
    <div className="screen">
      <NavBar title="Performance" subtitle={model.scopeName} back={{ label: 'Patrimoine', onClick: nav.pop }} />
      <NatureLine model={model} demo={Boolean(data.settings.demoMode)} />

      <Section title="D'où vient la valeur" footer="Gain total = valeur − versé net = plus-values latentes + réalisées + dividendes − frais. L'app vérifie cette égalité au centime.">
        <Row title="Versé net" subtitle="Versements saisis ou déduits des achats, − retraits" value={amount(v.netDeposits)} />
        <Row title="Investi dans les ETF" subtitle="Coût d'achat des parts détenues, frais inclus" value={amount(v.invested)} />
        <Row title="Liquidités" subtitle="Argent du PEA non investi" value={amount(v.cash)} />
        <Row title="Valeur des ETF" subtitle="Parts × dernier cours" value={amount(v.securitiesValue)} />
        <Row title={<strong>Valeur totale</strong>} value={<strong>{amount(v.total)}</strong>} />
      </Section>

      <Section>
        <Row title="Plus-values latentes" subtitle="Sur les parts encore détenues" value={<Signed value={toNumber(v.unrealized)}>{amount(v.unrealized, true)}</Signed>} />
        <Row title="Plus-values réalisées" subtitle="Sur les ventes" value={<Signed value={toNumber(v.realized)}>{amount(v.realized, true)}</Signed>} />
        <Row title="Dividendes" value={amount(v.dividends)} />
        <Row title="Frais divers" subtitle="Droits de garde, hors courtage" value={amount(v.otherFees.times(-1), true)} />
        <Row
          title={<strong>Gain total</strong>}
          value={v.gain ? <Signed value={toNumber(v.gain)}><strong>{amount(v.gain, true)}</strong></Signed> : '—'}
          valueSub={v.gainPct !== null ? `${formatPct(v.gainPct)} du versé` : undefined}
        />
      </Section>

      <Section
        title="Performance par période"
        footer="Le pourcentage neutralise tes versements : un versement n'est jamais compté comme un gain. C'est le chiffre à comparer à la performance de l'ETF lui-même."
      >
        {perf.periods.map(({ key, label, result }) => (
          <Row
            key={key}
            title={label}
            value={result ? <Signed value={result.twr}>{formatPct(result.twr)}</Signed> : <span className="secondary">—</span>}
            valueSub={result ? formatEUR(result.gain, { signed: true }) : 'historique insuffisant'}
          />
        ))}
      </Section>

      <Section
        title="Rendement annualisé personnel"
        footer="Taux annuel réellement obtenu en tenant compte de la date de chaque versement. C'est le chiffre à comparer aux hypothèses de la projection (4, 6 ou 8 % par an)."
      >
        <Row
          title="Par an"
          value={
            perf.irr !== null ? (
              <Signed value={perf.irr}>
                <strong>{formatPct(perf.irr)}</strong>
              </Signed>
            ) : (
              <span className="secondary">—</span>
            )
          }
          valueSub={perf.irr === null && perf.irrAvailableOn ? `disponible le ${formatDateLong(perf.irrAvailableOn)}` : undefined}
        />
      </Section>

      <Section title="Année par année">
        {perf.years.length === 0 ? (
          <div className="empty">Pas encore d'historique.</div>
        ) : (
          perf.years.map((y) => (
            <Row
              key={y.year}
              title={<strong>{y.year}{y.partial ? ' (en cours)' : ''}</strong>}
              subtitle={`Valeur fin : ${formatEUR(y.endValue)} · versé : ${formatEUR(y.flows)}`}
              value={<Signed value={toNumber(y.gain)}>{formatEUR(y.gain, { signed: true })}</Signed>}
              valueSub={<Signed value={y.twr}>{formatPct(y.twr)}</Signed>}
            />
          ))
        )}
      </Section>
    </div>
  );
}
