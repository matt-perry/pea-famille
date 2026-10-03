/**
 * Fiche d'un ETF : pourquoi ma position vaut ce qu'elle vaut.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  addMonths,
  addYears,
  D,
  formatDateShort,
  formatEUR,
  formatPct,
  formatPrice,
  formatQty,
  MOVEMENT_LABELS,
  parseISO,
  sortMovements,
  toNumber,
  type ISODate,
} from '../core';
import { LineChart } from '../components/LineChart';
import { Badge, Chips, NavBar, Row, Section, Signed } from '../components/ui';
import { useAppData } from '../viewmodels/AppData';
import { buildPortfolio } from '../viewmodels/portfolio';
import { symbolsEditUrl, resolveDataBaseUrl } from '../services/prices';
import { useNav } from './nav';

type Range = '1M' | '3M' | '1A' | 'ALL';
const t = (d: ISODate) => parseISO(d).getTime();

export function EtfView({ etfId }: { etfId: string }) {
  const data = useAppData();
  const nav = useNav();
  const [range, setRange] = useState<Range>('ALL');
  const scope = data.accounts.some((a) => a.id === nav.scope) ? nav.scope : 'family';
  const model = useMemo(() => buildPortfolio(data.ctx, scope), [data.ctx, scope]);
  const etf = data.ctx.etfsById.get(etfId);
  const position = model.valuation.positions.find((p) => p.etfId === etfId);
  const series = etf ? data.ctx.prices.series(etf.symbol) : [];
  const last = series.at(-1) ?? null;
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const dayPct = last && previous ? toNumber(last.close.div(previous.close).minus(1)) : null;

  const movements = useMemo(
    () => sortMovements(model.movements.filter((m) => m.etfId === etfId)).reverse(),
    [model.movements, etfId],
  );
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? '';

  const chart = useMemo(() => {
    if (series.length === 0) return null;
    const end = series[series.length - 1].date;
    const start = range === '1M' ? addMonths(end, -1) : range === '3M' ? addMonths(end, -3) : range === '1A' ? addYears(end, -1) : null;
    const visible = series.filter((p) => !start || p.date >= start);
    const buys = movements.filter((m) => m.kind === 'buy' && (!start || m.date >= start));
    return {
      points: visible.map((p) => ({ x: t(p.date), y: toNumber(p.close) })),
      markers: buys.map((m) => ({ x: t(m.date), y: toNumber(D(m.unitPrice)) })),
      byTime: new Map(visible.map((p) => [t(p.date), p])),
    };
  }, [series, movements, range]);

  if (!etf) {
    return (
      <div className="screen">
        <NavBar title="ETF" back={{ label: 'Patrimoine', onClick: nav.pop }} />
        <div className="empty">Cet ETF n'existe plus.</div>
      </div>
    );
  }

  const tracked = data.settings.trackedSymbols;
  const notTracked = tracked !== null && !tracked.includes(etf.symbol);
  const editUrl = symbolsEditUrl(resolveDataBaseUrl(data.settings.dataBaseUrl));
  const held = position && position.quantity.gt(0);

  return (
    <div className="screen">
      <NavBar
        title={etf.shortName}
        subtitle={`ETF · ${etf.ticker} · ${etf.exchange === 'PA' ? 'Euronext Paris' : etf.exchange} · ${etf.currency}${scope !== 'family' ? ` · ${model.scopeName}` : ''}`}
        back={{ label: 'Patrimoine', onClick: nav.pop }}
      />

      <div className="hero">
        <div className="hero-label">Valeur de la position</div>
        <div className="hero-value">{held ? formatEUR(position!.value) : formatEUR(0)}</div>
        <div className="hero-meta">
          {last ? (
            <>
              <span>Clôture du {formatDateShort(last.date)}</span>
              {data.settings.demoMode ? (
                <Badge tone="orange">Cours fictifs</Badge>
              ) : last.date >= model.expectedSession ? (
                <Badge>Réel</Badge>
              ) : (
                <Badge tone="orange">Dernier cours connu</Badge>
              )}
            </>
          ) : (
            <Badge tone="orange">Donnée indisponible</Badge>
          )}
        </div>
      </div>

      <Section>
        <div className="card-padded figures">
          <Figure label="Quantité" value={held ? formatQty(position!.quantity) : '0'} />
          <Figure label="PRU" value={position?.pru ? formatPrice(position.pru) : '—'} />
          <Figure label="Cours" value={last ? formatPrice(last.close) : '—'} />
          <Figure
            label="Plus-value"
            value={<Signed value={position?.unrealized ? toNumber(position.unrealized) : null}>{formatEUR(position?.unrealized ?? null, { signed: true })}</Signed>}
          />
          <Figure label="Performance" value={<Signed value={position?.unrealizedPct ?? null}>{formatPct(position?.unrealizedPct ?? null, { decimals: 1 })}</Signed>} />
          <Figure label="Séance" value={<Signed value={dayPct}>{formatPct(dayPct)}</Signed>} />
        </div>
      </Section>

      {held && position!.value && last && (
        <div className="explain" style={{ marginTop: 12 }}>
          {formatQty(position!.quantity)} parts × {formatPrice(last.close)} = <strong>{formatEUR(position!.value, { decimals: 2 })}</strong>
          <br />
          <span className="secondary">
            Coût d'achat : {formatQty(position!.quantity)} × {formatPrice(position!.pru)} = {formatEUR(position!.cost, { decimals: 2 })}
          </span>
        </div>
      )}

      {notTracked && (
        <a className="banner" href={editUrl ?? undefined} target="_blank" rel="noreferrer">
          <span>
            <strong>Le robot ne suit pas encore {etf.symbol}</strong>
            Ajoute {`{ "symbol": "${etf.symbol}", "since": "AAAA-MM-JJ" }`} dans config/symbols.json sur GitHub{editUrl ? ' (toucher pour ouvrir)' : ''}.
          </span>
        </a>
      )}

      <Section>
        <div className="card-padded">
          {chart ? (
            <>
              <LineChart
                ariaLabel={`Cours de ${etf.shortName}`}
                series={[{ id: 'price', label: 'Cours', points: chart.points, color: 'var(--accent)', area: true }]}
                hLines={position?.pru ? [{ y: toNumber(position.pru), label: `PRU ${formatPrice(position.pru)}` }] : []}
                markers={chart.markers}
                idle={{ title: 'Cours de clôture · points = achats', lines: [] }}
                tooltip={(x) => {
                  const p = chart.byTime.get(x);
                  return p ? { title: formatDateShort(p.date), lines: [{ value: formatPrice(p.close) }] } : null;
                }}
              />
              <Chips
                label="Période"
                value={range}
                onChange={setRange}
                options={[
                  { value: '1M', label: '1M' },
                  { value: '3M', label: '3M' },
                  { value: '1A', label: '1A' },
                  { value: 'ALL', label: 'Tout' },
                ]}
              />
            </>
          ) : (
            <div className="empty">Aucun cours enregistré pour {etf.symbol}.</div>
          )}
        </div>
      </Section>

      <Section title="Transactions">
        {movements.length === 0 ? (
          <div className="empty">Aucune transaction.</div>
        ) : (
          movements.map((m) => (
            <Row
              key={m.id}
              title={`${MOVEMENT_LABELS[m.kind]} · ${formatDateShort(m.date)}`}
              subtitle={`${accountName(m.accountId)}${m.fees && Number(m.fees) > 0 ? ` · frais ${formatEUR(D(m.fees), { decimals: 2 })}` : ''}`}
              value={
                m.kind === 'buy' || m.kind === 'sell'
                  ? `${formatQty(D(m.quantity))} × ${formatPrice(D(m.unitPrice))}`
                  : m.kind === 'split'
                    ? `× ${m.ratio}`
                    : formatEUR(D(m.amount), { decimals: 2 })
              }
              onClick={() => nav.openSheet({ name: 'movement', movementId: m.id })}
            />
          ))
        )}
      </Section>

      <Section title="Le fonds">
        <Row title="Nom" value={<span className="secondary" style={{ whiteSpace: 'normal' }}>{etf.name}</span>} />
        <Row title="ISIN" value={<span className="secondary">{etf.isin || '—'}</span>} />
        <Row title="Émetteur" value={<span className="secondary">{etf.issuer || '—'}</span>} />
        <Row title="Symbole des cours" value={<span className="secondary">{etf.symbol}</span>} />
        {position && position.realized.abs().gt(0) && (
          <Row title="Plus-values réalisées" value={<Signed value={toNumber(position.realized)}>{formatEUR(position.realized, { decimals: 2, signed: true })}</Signed>} />
        )}
        {etf.sourceUrl && <Row title="Page de l'émetteur" href={etf.sourceUrl} />}
        <Row title="Modifier la fiche" onClick={() => nav.openSheet({ name: 'etf', etfId: etf.id })} />
      </Section>
    </div>
  );
}

function Figure(props: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="figure-label">{props.label}</div>
      <div className="figure-value">{props.value}</div>
    </div>
  );
}
