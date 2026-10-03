/**
 * Écran Patrimoine : « j'ouvre l'app et je sais combien vaut mon portefeuille ».
 */
import { useMemo, useState } from 'react';
import {
  addMonths,
  addYears,
  formatDateShort,
  formatDayMonth,
  formatEUR,
  formatPct,
  formatPrice,
  formatQty,
  parseISO,
  toNumber,
  type ISODate,
} from '../core';
import { LineChart, type ChartPoint } from '../components/LineChart';
import { Badge, Chips, NavBar, Ring, Row, Section, Segmented, Signed } from '../components/ui';
import { IconGear, IconPlus } from '../components/icons';
import { useAppData } from '../viewmodels/AppData';
import { buildPortfolio, buildQuotes, type PortfolioModel } from '../viewmodels/portfolio';
import { useNav } from './nav';

type Range = '1M' | '3M' | '6M' | '1A' | '5A' | 'ALL';
const RANGES: { value: Range; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1A', label: '1A' },
  { value: '5A', label: '5A' },
  { value: 'ALL', label: 'Tout' },
];

function rangeStart(range: Range, end: ISODate): ISODate | null {
  switch (range) {
    case '1M':
      return addMonths(end, -1);
    case '3M':
      return addMonths(end, -3);
    case '6M':
      return addMonths(end, -6);
    case '1A':
      return addYears(end, -1);
    case '5A':
      return addYears(end, -5);
    default:
      return null;
  }
}

const t = (d: ISODate) => parseISO(d).getTime();
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function NatureLine({ model, demo }: { model: PortfolioModel; demo?: boolean }) {
  const v = model.valuation;
  if (model.nature === 'unavailable') {
    return (
      <div className="hero-meta">
        <Badge tone="orange">Valeur incomplète</Badge>
        <span>Cours indisponible pour {v.missing.length} ETF : non compté, jamais estimé.</span>
      </div>
    );
  }
  if (model.nature === 'lastKnown') {
    return (
      <div className="hero-meta">
        <Badge tone="orange">Dernier cours connu</Badge>
        <span>Clôture du {formatDateShort(v.oldestPriceDate)}</span>
      </div>
    );
  }
  if (!v.newestPriceDate) return <div className="hero-meta">Liquidités uniquement</div>;
  return (
    <div className="hero-meta">
      <span>Clôture du {formatDateShort(v.newestPriceDate)}</span>
      {demo ? <Badge tone="orange">Cours fictifs</Badge> : <Badge>Réel</Badge>}
    </div>
  );
}

export function HomeView() {
  const data = useAppData();
  const nav = useNav();
  const [range, setRange] = useState<Range>('1A');
  const scope = data.accounts.some((a) => a.id === nav.scope) ? nav.scope : 'family';
  const model = useMemo(() => buildPortfolio(data.ctx, scope), [data.ctx, scope]);
  const family = useMemo(() => (scope === 'family' ? model : buildPortfolio(data.ctx, 'family')), [data.ctx, scope, model]);

  const v = model.valuation;
  const hasMovements = model.movements.length > 0;
  const quotes = useMemo(() => buildQuotes(data.ctx, model), [data.ctx, model]);
  const demo = Boolean(data.settings.demoMode);

  const chart = useMemo(() => {
    const valued = model.series.filter((p) => p.value !== null);
    if (valued.length === 0) return null;
    const end = valued[valued.length - 1].date;
    const start = rangeStart(range, end);
    // Le premier point (veille du premier mouvement, valeur 0) sert aux calculs, pas au dessin.
    const drawable = model.series.slice(1);
    const visible = drawable.filter((p) => !start || p.date >= start);
    const value: ChartPoint[] = visible.filter((p) => p.value !== null).map((p) => ({ x: t(p.date), y: toNumber(p.value!) }));
    const deposits: ChartPoint[] = visible.map((p) => ({ x: t(p.date), y: toNumber(p.netDeposits) }));
    const byDate = new Map(visible.map((p) => [p.date, p]));
    return { value, deposits, byDate, shortHistory: start !== null && drawable.length > 0 && drawable[0].date > start };
  }, [model.series, range]);

  const goal = data.settings.goal;
  const goalTarget = goal ? Number(goal.target) : 0;
  const goalBase = goal?.scope && goal.scope !== 'family' ? family.accounts.find((a) => a.account.id === goal.scope)?.valuation : family.valuation;
  const goalProgress = goalTarget > 0 && goalBase ? toNumber(goalBase.total) / goalTarget : 0;

  const lastExport = data.settings.lastExportAt;
  const backupDue = hasMovements && (!lastExport || Date.now() - lastExport > 30 * 86_400_000);

  return (
    <div className="screen">
      <NavBar
        title="Patrimoine"
        actions={
          <>
            <button className="icon-button" aria-label="Ajouter un mouvement" onClick={() => nav.openSheet({ name: 'movement' })}>
              <IconPlus />
            </button>
            <button className="icon-button" aria-label="Réglages" onClick={() => nav.push({ name: 'settings' })}>
              <IconGear />
            </button>
          </>
        }
      />

      {data.accounts.length > 1 && (
        <Segmented
          label="Périmètre"
          value={scope}
          onChange={nav.setScope}
          options={[{ value: 'family', label: 'Famille' }, ...data.accounts.map((a) => ({ value: a.id, label: a.name }))]}
        />
      )}

      <button className="hero" style={{ width: '100%', textAlign: 'left', marginTop: 18 }} onClick={() => nav.push({ name: 'performance' })}>
        <div className="hero-label">{scope === 'family' ? 'Valeur totale' : `Valeur — ${model.scopeName}`}</div>
        <div className="hero-value" aria-label={`Valeur ${formatEUR(v.total)}`}>
          {formatEUR(v.total)}
        </div>
        <NatureLine model={model} demo={Boolean(data.settings.demoMode)} />
        <div className="perf-lines">
          <div className="perf-line">
            <span className="label">{model.session ? `Séance du ${formatDateShort(model.session.date)}` : 'Dernière séance'}</span>
            <span className="value">
              {model.session ? (
                <Signed value={toNumber(model.session.gain)}>
                  {formatEUR(model.session.gain, { signed: true })}&nbsp;&nbsp;{formatPct(model.session.pct)}
                </Signed>
              ) : (
                <span className="secondary">—</span>
              )}
            </span>
          </div>
          <div className="perf-line">
            <span className="label">Depuis le début</span>
            <span className="value">
              {v.gain ? (
                <Signed value={toNumber(v.gain)}>
                  {formatEUR(v.gain, { signed: true })}&nbsp;&nbsp;{formatPct(v.gainPct, { decimals: 1 })}
                </Signed>
              ) : (
                <span className="secondary">—</span>
              )}
            </span>
          </div>
        </div>
      </button>

      {data.settings.demoMode && (
        <div className="banner" style={{ marginTop: 14 }}>
          <span>
            <strong>Mode démo</strong>
            Mouvements et cours fictifs, pour tester l'app. Ce ne sont pas vos chiffres.
          </span>
        </div>
      )}

      {!data.settings.dataKey && !data.settings.demoMode && (
        <button className="banner info" onClick={() => nav.push({ name: 'market' })}>
          <span>
            <strong>Cours de bourse à configurer</strong>
            Génère la clé de lecture des cours et colle-la dans GitHub. Réglages › Données de marché.
          </span>
        </button>
      )}
      {data.settings.dataKey && data.settings.lastSyncError && (
        <button className="banner" onClick={() => nav.push({ name: 'market' })}>
          <span>
            <strong>Cours non mis à jour</strong>
            {data.settings.lastSyncError.split('\n')[0]}
          </span>
        </button>
      )}

      {quotes.length > 0 && (
        <Section title="Cours">
          {quotes.map((q) => (
            <button key={q.etf.id} className="row quote" onClick={() => nav.push({ name: 'etf', etfId: q.etf.id })}>
              <div className="row-main">
                <div className="row-title">
                  <strong>{q.etf.shortName}</strong> <span className="secondary">{q.etf.ticker}</span>
                </div>
                <div className={`row-sub ${q.stale ? 'warn' : ''}`}>
                  {q.last
                    ? `${q.stale ? 'Dernier cours connu' : 'Clôture'} du ${formatDateShort(q.last.date)}${demo ? ' · fictif' : ''}`
                    : 'Donnée indisponible'}
                </div>
              </div>
              <div className="quote-price">{q.last ? formatPrice(q.last.close) : '—'}</div>
              <span
                className={`change-pill ${q.changePct === null || q.changePct === 0 ? '' : q.changePct > 0 ? 'up' : 'down'}`}
                aria-label={`Variation de la séance ${formatPct(q.changePct)}`}
              >
                {formatPct(q.changePct)}
              </span>
            </button>
          ))}
        </Section>
      )}

      {!hasMovements ? (
        <Section>
          <div className="empty">
            <strong>Aucun mouvement pour l'instant</strong>
            Saisis tes achats depuis début septembre : la valeur, la performance et l'historique se calculent tout seuls. Pas besoin de saisir les versements.
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={() => nav.openSheet({ name: 'movement' })}>
                Ajouter un achat
              </button>
            </div>
          </div>
        </Section>
      ) : (
        <Section>
          <div className="card-padded">
            {chart ? (
              <>
                <LineChart
                  ariaLabel={`Évolution de la valeur, ${range}`}
                  series={[
                    { id: 'value', label: 'Valeur', points: chart.value, color: 'var(--accent)', width: 2.2, area: true },
                    { id: 'deposits', label: 'Versé', points: chart.deposits, color: 'var(--chart-muted)', width: 1.5, dashed: true },
                  ]}
                  idle={{
                    title: chart.shortHistory ? `Historique depuis le ${formatDayMonth(model.series[1]?.date ?? null)}` : 'Valeur et versé net — glisser pour lire',
                    lines: [],
                  }}
                  tooltip={(x) => {
                    const p = chart.byDate.get(isoOf(x));
                    if (!p) return null;
                    return {
                      title: formatDateShort(p.date),
                      lines: [
                        { label: 'Valeur', value: formatEUR(p.value) },
                        { label: 'Versé', value: formatEUR(p.netDeposits) },
                      ],
                    };
                  }}
                />
                <div className="legend">
                  <span className="legend-item" style={{ color: 'var(--accent)' }}>
                    <span className="legend-swatch" />
                    <span className="secondary">Valeur</span>
                  </span>
                  <span className="legend-item" style={{ color: 'var(--chart-muted)' }}>
                    <span className="legend-swatch dashed" />
                    <span className="secondary">Versé (l'écart = le gain)</span>
                  </span>
                </div>
                <Chips label="Période du graphique" options={RANGES} value={range} onChange={setRange} />
              </>
            ) : (
              <div className="empty">Le graphique apparaîtra dès que les cours seront disponibles.</div>
            )}
          </div>
        </Section>
      )}

      {scope === 'family' && data.accounts.length > 1 && (
        <Section title="Comptes">
          {model.accounts.map(({ account, valuation }) => (
            <Row
              key={account.id}
              title={account.name}
              value={<strong>{formatEUR(valuation.total)}</strong>}
              valueSub={
                valuation.gainPct !== null ? (
                  <Signed value={valuation.gainPct}>{formatPct(valuation.gainPct, { decimals: 1 })}</Signed>
                ) : undefined
              }
              onClick={() => nav.setScope(account.id)}
            />
          ))}
        </Section>
      )}

      {model.positions.length > 0 && (
        <Section title="Positions">
          {model.positions.map((p) => (
            <Row
              key={p.etfId}
              title={<strong>{p.etf?.shortName ?? 'ETF inconnu'}</strong>}
              subtitle={`${formatQty(p.quantity)} part${p.quantity.gt(1) ? 's' : ''} × ${formatPrice(p.price?.close ?? null)}`}
              value={formatEUR(p.value)}
              valueSub={<Signed value={p.unrealizedPct}>{formatPct(p.unrealizedPct, { decimals: 1 })}</Signed>}
              onClick={() => nav.push({ name: 'etf', etfId: p.etfId })}
            />
          ))}
        </Section>
      )}

      <Section>
        <button className="row" onClick={() => nav.openSheet({ name: 'goal' })}>
          {goalTarget > 0 ? (
            <div className="goal" style={{ flex: 1 }}>
              <Ring progress={goalProgress} label={`Objectif atteint à ${formatPct(goalProgress, { decimals: 1, signed: false })}`} />
              <div className="row-main">
                <div className="row-title">
                  <strong>Objectif {formatEUR(goalTarget)}</strong>
                </div>
                <div className="row-sub">{formatPct(goalProgress, { decimals: 1, signed: false })} atteint</div>
              </div>
            </div>
          ) : (
            <div className="row-main">Définir un objectif</div>
          )}
        </button>
      </Section>

      {backupDue && (
        <button className="banner" onClick={() => nav.push({ name: 'settings' })}>
          <span>
            <strong>Pense à sauvegarder</strong>
            {lastExport ? 'Ta dernière sauvegarde date de plus d’un mois.' : 'Aucune sauvegarde pour l’instant.'} Réglages › Sauvegarde.
          </span>
        </button>
      )}
    </div>
  );
}
