/**
 * Onglet Projection : où pourrions-nous être dans 25 ans, selon trois hypothèses.
 * Tout ce qui est ici est une PROJECTION fondée sur des HYPOTHÈSES, jamais une prévision.
 */
import { useMemo, useState } from 'react';
import { formatDateLong, formatEUR, formatEURApprox, formatMonthYear, parseDecimal, PEA_DEPOSIT_CAP, type ProjectionSettings } from '../core';
import { LineChart } from '../components/LineChart';
import { Badge, Field, NavBar, Row, Section, Segmented, Toggle } from '../components/ui';
import { projectionWithDefaults, setSetting } from '../repositories/settings';
import { useAppData } from '../viewmodels/AppData';
import { buildPortfolio, buildProjection } from '../viewmodels/portfolio';

const OPACITY = [0.45, 1, 0.7];
const pctText = (rate: string) => String(Math.round(Number(rate) * 10000) / 100).replace('.', ',');

export function ProjectionView() {
  const data = useAppData();
  const accountIds = data.accounts.map((a) => a.id);
  const settings = projectionWithDefaults(data.settings.projection, accountIds);
  const [showTable, setShowTable] = useState(false);
  const family = useMemo(() => buildPortfolio(data.ctx, 'family'), [data.ctx]);
  const goal = data.settings.goal && (!data.settings.goal.scope || data.settings.goal.scope === 'family') ? Number(data.settings.goal.target) : null;
  const model = useMemo(() => buildProjection(data.ctx, family, settings, goal), [data.ctx, family, settings, goal]);

  const update = (patch: Partial<ProjectionSettings>) => void setSetting('projection', { ...settings, ...patch });
  const central = model.scenarios[1];
  const capEvents = central.result.capEvents;

  const series = [
    {
      id: 'apports',
      label: 'Capital + versements',
      points: central.result.points.map((p) => ({ x: p.year, y: p.contributed })),
      color: 'var(--chart-muted)',
      dashed: true,
      width: 1.5,
    },
    ...model.scenarios.map((s, i) => ({
      id: s.name,
      label: `${s.name} ${pctText(String(s.rate))} %`,
      points: s.result.points.map((p) => ({ x: p.year, y: p.value })),
      color: 'var(--accent)',
      opacity: OPACITY[i],
      width: i === 1 ? 2.6 : 1.6,
    })),
  ];
  const startYear = central.result.points[0].year;
  const endYear = central.result.points[central.result.points.length - 1].year;
  const step = settings.years > 30 ? 10 : 5;
  const xTicks = [];
  for (let y = startYear; y <= endYear; y += step) xTicks.push({ x: y, label: String(y) });

  return (
    <div className="screen">
      <NavBar title="Projection" />

      <div className="banner info" style={{ marginTop: 0 }}>
        <span>
          <strong>
            <Badge tone="blue">Hypothèse</Badge>
          </strong>
          Projection mathématique basée sur une hypothèse de rendement annuel. Les performances futures réelles peuvent être très différentes.
        </span>
      </div>

      <Section>
        <div className="card-padded">
          <LineChart
            ariaLabel={`Projection sur ${settings.years} ans, trois scénarios`}
            yFromZero
            yTicks={4}
            formatY={(v) => (v === 0 ? '0' : v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('fr-FR')} M€` : `${Math.round(v / 1000)} k€`)}
            series={series}
            xTicks={xTicks}
            hLines={goal ? [{ y: goal, label: `Objectif ${formatEUR(goal)}`, color: 'var(--secondary)' }] : []}
            vLines={
              capEvents.length > 0 && settings.capOn
                ? [{ x: Number(capEvents[0].date.slice(0, 4)) + (Number(capEvents[0].date.slice(5, 7)) - 1) / 12, label: 'Plafond PEA' }]
                : []
            }
            idle={{ title: `Dans ${settings.years} ans (${endYear})`, lines: [{ value: `${central.name} : ${formatEURApprox(central.result.finalValue)}` }] }}
            tooltip={(x) => {
              const i = central.result.points.findIndex((p) => p.year === x);
              if (i < 0) return null;
              return {
                title: `${x} · projection`,
                lines: [
                  ...model.scenarios.map((s) => ({ label: s.name, value: formatEURApprox(s.result.points[i].value) })),
                  { label: 'Apports', value: formatEUR(central.result.points[i].contributed) },
                ],
              };
            }}
          />
          <div className="legend">
            {model.scenarios.map((s, i) => (
              <span key={s.name} className="legend-item" style={{ color: 'var(--accent)', opacity: OPACITY[i] < 1 ? 0.75 : 1 }}>
                <span className="legend-swatch" />
                <span className="secondary">
                  {s.name} {pctText(String(s.rate))} %
                </span>
              </span>
            ))}
            <span className="legend-item" style={{ color: 'var(--chart-muted)' }}>
              <span className="legend-swatch dashed" />
              <span className="secondary">Capital de départ + versements</span>
            </span>
          </div>
        </div>
      </Section>

      <Section plain title={`Dans ${settings.years} ans`}>
        <div className="scenarios">
          {model.scenarios.map((s) => (
            <div className="card card-padded" key={s.name}>
              <div className="scenario-head">
                <span className="scenario-name">{s.name}</span>
                <Badge tone="blue">{pctText(String(s.rate))} % / an</Badge>
              </div>
              <div className="scenario-final">{formatEURApprox(s.result.finalValue)}</div>
              <div className="summary-grid">
                <span className="k">Capital initial</span>
                <span className="v">{formatEUR(s.result.startValue)}</span>
                <span className="k">Versements cumulés</span>
                <span className="v">{formatEUR(s.result.futureContributions)}</span>
                <span className="k">Gains estimés</span>
                <span className="v">{formatEURApprox(s.result.gains)}</span>
                {s.result.realFinalValue !== null && (
                  <>
                    <span className="k">En euros d'aujourd'hui</span>
                    <span className="v">{formatEURApprox(s.result.realFinalValue)}</span>
                  </>
                )}
                {goal && (
                  <>
                    <span className="k">Objectif atteint</span>
                    <span className="v">{s.goalYear ? `vers ${s.goalYear}` : 'non atteint'}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {settings.capOn && capEvents.length > 0 && (
          <p className="section-footer">
            Plafond de {formatEUR(PEA_DEPOSIT_CAP)} versés atteint :{' '}
            {capEvents.map((e) => `${e.accountName} en ${formatMonthYear(e.date).toLowerCase()}`).join(', ')}. Les versements s'arrêtent alors ; le capital continue de croître.
          </p>
        )}
        <p className="section-footer">Montants projetés arrondis au millier, bruts de fiscalité (prélèvements sociaux à la sortie).</p>
      </Section>

      <Section title="Paramètres" footer="Le rendement est supposé net des frais des ETF, constant chaque année. Les marchés ne suivent jamais une ligne droite.">
        <div className="field stacked">
          <span className="field-label">Capital de départ</span>
          <div>
            <Segmented
              label="Capital de départ"
              value={settings.startMode}
              onChange={(v) => update({ startMode: v })}
              options={[
                { value: 'actual', label: 'Valeur actuelle' },
                { value: 'custom', label: 'Montant saisi' },
              ]}
            />
          </div>
        </div>
        {settings.startMode === 'actual' ? (
          <Row
            title={<span className="secondary">Valeur réelle au {formatDateLong(family.valuation.newestPriceDate ?? family.today)}</span>}
            value={
              <span>
                {formatEUR(model.startValue)} <Badge>{data.settings.demoMode ? 'Démo' : model.startIsReal ? 'Réel' : 'Incomplet'}</Badge>
              </span>
            }
          />
        ) : (
          <NumberField label="Montant" value={settings.customStart} suffix="€" onCommit={(v) => update({ customStart: v })} />
        )}
        {data.accounts.map((a) => (
          <NumberField
            key={a.id}
            label={`Versement ${a.name}`}
            value={settings.monthly[a.id]}
            suffix="€/mois"
            onCommit={(v) => update({ monthly: { ...settings.monthly, [a.id]: v } })}
          />
        ))}
        <NumberField label="Durée" value={String(settings.years)} suffix="ans" onCommit={(v) => update({ years: Math.min(50, Math.max(1, Math.round(Number(v)))) })} />
        {settings.rates.map((r, i) => (
          <NumberField
            key={i}
            label={`${model.scenarios[i].name}`}
            value={pctText(r)}
            suffix="% / an"
            onCommit={(v) => {
              const rates = [...settings.rates] as ProjectionSettings['rates'];
              rates[i] = String(Number(v) / 100);
              update({ rates });
            }}
          />
        ))}
        <div className="field">
          <span className="field-label">Plafond PEA (150 000 € versés)</span>
          <Toggle label="Appliquer le plafond PEA" checked={settings.capOn} onChange={(v) => update({ capOn: v })} />
        </div>
        <div className="field">
          <span className="field-label">Tenir compte de l'inflation</span>
          <Toggle label="Tenir compte de l'inflation" checked={settings.inflationOn} onChange={(v) => update({ inflationOn: v })} />
        </div>
        {settings.inflationOn && (
          <NumberField label="Inflation" value={pctText(settings.inflationRate)} suffix="% / an" onCommit={(v) => update({ inflationRate: String(Number(v) / 100) })} />
        )}
      </Section>
      {model.startNote && <p className="section-footer warn">{model.startNote}</p>}

      <Section>
        <button className="row" onClick={() => setShowTable((s) => !s)}>
          <span className="row-main btn-plain">{showTable ? 'Masquer' : 'Voir'} les valeurs année par année</span>
        </button>
        {showTable && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Apports</th>
                  {model.scenarios.map((s) => (
                    <th key={s.name}>{pctText(String(s.rate))} %</th>
                  ))}
                  {settings.inflationOn && <th>6 % (€ constants)</th>}
                </tr>
              </thead>
              <tbody>
                {central.result.points.map((p, i) => (
                  <tr key={p.year}>
                    <td>{p.year}</td>
                    <td>{formatEUR(p.contributed)}</td>
                    {model.scenarios.map((s) => (
                      <td key={s.name}>{formatEURApprox(s.result.points[i].value).replace('≈ ', '')}</td>
                    ))}
                    {settings.inflationOn && <td>{formatEURApprox(p.realValue).replace('≈ ', '')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="section-footer">Valeurs projetées, non garanties. Toucher le graphique pour lire une année.</p>
    </div>
  );
}

/** Champ numérique qui n'enregistre qu'à la sortie du champ (saisie confortable au clavier). */
function NumberField(props: { label: string; value: string; suffix: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(props.value.replace('.', ','));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : props.value.replace('.', ',');
  return (
    <Field label={props.label}>
      <input
        inputMode="decimal"
        value={shown}
        aria-label={`${props.label} (${props.suffix})`}
        onFocus={() => {
          setText(props.value.replace('.', ','));
          setFocused(true);
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseDecimal(text);
          if (parsed && parsed.gte(0)) props.onCommit(parsed.toString());
        }}
      />
      <span className="secondary" style={{ flex: 'none' }}>
        {props.suffix}
      </span>
    </Field>
  );
}
