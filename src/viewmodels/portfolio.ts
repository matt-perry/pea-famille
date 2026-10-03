/**
 * ViewModels purs : assemblent les résultats du moteur `core` pour les écrans.
 * Aucun calcul financier ici : seulement des appels au moteur et des choix d'affichage.
 */
import {
  buildSeries,
  computeLedger,
  computeLedgers,
  diffDays,
  expectedPublishedSession,
  lastSessionChange,
  lastValuedPoint,
  mergeLedgers,
  netDeposits,
  PERIOD_LABELS,
  periodPerformance,
  periodStart,
  PriceIndex,
  project,
  toNumber,
  todayParis,
  tradingDayOnOrBefore,
  valueLedger,
  xirr,
  yearlyBreakdown,
  type Account,
  type DataNature,
  type Dec,
  type Etf,
  type ISODate,
  type LedgerState,
  type Movement,
  type PeriodKey,
  type PeriodResult,
  type PositionValuation,
  type PriceBar,
  type ProjectionResult,
  type ProjectionSettings,
  type SeriesPoint,
  type SessionChange,
  type Valuation,
  type YearRow,
} from '../core';

export interface PortfolioInput {
  accounts: Account[];
  etfs: Etf[];
  movements: Movement[];
  prices: PriceBar[];
}

export interface Context {
  accounts: Account[];
  etfs: Etf[];
  etfsById: Map<string, Etf>;
  movements: Movement[];
  prices: PriceIndex;
}

export function makeContext(input: PortfolioInput): Context {
  return {
    accounts: input.accounts.filter((a) => !a.archived),
    etfs: input.etfs,
    etfsById: new Map(input.etfs.map((e) => [e.id, e])),
    movements: input.movements,
    prices: new PriceIndex(input.prices),
  };
}

export type HeldPosition = PositionValuation & { etf: Etf | undefined };

export interface AccountSummary {
  account: Account;
  ledger: LedgerState;
  valuation: Valuation;
}

export interface PortfolioModel {
  scope: string;
  scopeName: string;
  today: ISODate;
  movements: Movement[];
  ledger: LedgerState;
  valuation: Valuation;
  /** Date du dernier cours connu des ETF détenus */
  asOf: ISODate | null;
  series: SeriesPoint[];
  session: SessionChange | null;
  nature: DataNature;
  expectedSession: ISODate;
  positions: HeldPosition[];
  accounts: AccountSummary[];
  firstDate: ISODate | null;
}

export function scopeMovements(ctx: Context, scope: string): Movement[] {
  return scope === 'family' ? ctx.movements : ctx.movements.filter((m) => m.accountId === scope);
}

export function buildPortfolio(ctx: Context, scope: string, now: Date = new Date()): PortfolioModel {
  const today = todayParis(now);
  const movements = scopeMovements(ctx, scope);
  const ledger = mergeLedgers(computeLedgers(movements).values());
  const valuation = valueLedger(ledger, ctx.etfsById, ctx.prices, today);

  const heldSymbols = valuation.positions.filter((p) => p.quantity.gt(0) && p.symbol).map((p) => p.symbol);
  const asOf = ctx.prices.latestDate(heldSymbols);
  const firstDate = movements.length ? movements.reduce((min, m) => (m.date < min ? m.date : min), movements[0].date) : null;
  const endDate = asOf && firstDate && asOf >= firstDate ? asOf : tradingDayOnOrBefore(today);
  const series = firstDate ? buildSeries(movements, ctx.etfsById, ctx.prices, endDate) : [];

  const expectedSession = expectedPublishedSession(now);
  let nature: DataNature = 'real';
  if (heldSymbols.length > 0 || valuation.missing.length > 0) {
    if (!valuation.complete) nature = 'unavailable';
    else if (valuation.oldestPriceDate && valuation.oldestPriceDate < expectedSession) nature = 'lastKnown';
  }

  const positions: HeldPosition[] = valuation.positions
    .filter((p) => p.quantity.gt(0))
    .map((p) => ({ ...p, etf: ctx.etfsById.get(p.etfId) }))
    .sort((a, b) => toNumber(b.value ?? b.cost) - toNumber(a.value ?? a.cost));

  const accounts = ctx.accounts.map((account) => {
    const l = computeLedger(ctx.movements.filter((m) => m.accountId === account.id));
    return { account, ledger: l, valuation: valueLedger(l, ctx.etfsById, ctx.prices, today) };
  });

  return {
    scope,
    scopeName: scope === 'family' ? 'Famille' : ctx.accounts.find((a) => a.id === scope)?.name ?? 'Compte',
    today,
    movements,
    ledger,
    valuation,
    asOf,
    series,
    session: lastSessionChange(series),
    nature,
    expectedSession,
    positions,
    accounts,
    firstDate,
  };
}

/* ---------- Cours des ETF ---------- */

export interface Quote {
  etf: Etf;
  /** Dernier cours de clôture connu (jamais estimé) */
  last: { date: ISODate; close: Dec } | null;
  previous: { date: ISODate; close: Dec } | null;
  /** Variation entre les deux dernières clôtures */
  changePct: number | null;
  /** true si le cours date d'avant la dernière séance attendue */
  stale: boolean;
  held: boolean;
}

/** Cours des ETF suivis : ceux détenus d'abord, puis les autres. */
export function buildQuotes(ctx: Context, model: PortfolioModel): Quote[] {
  const held = new Set(model.positions.map((p) => p.etfId));
  return ctx.etfs
    .filter((e) => !e.archived)
    .map((etf) => {
      const series = ctx.prices.series(etf.symbol);
      const last = series.at(-1) ?? null;
      const previous = series.length > 1 ? series[series.length - 2] : null;
      return {
        etf,
        last,
        previous,
        changePct: last && previous ? toNumber(last.close.div(previous.close).minus(1)) : null,
        stale: last ? last.date < model.expectedSession : false,
        held: held.has(etf.id),
      };
    })
    .sort((a, b) => Number(b.held) - Number(a.held) || a.etf.shortName.localeCompare(b.etf.shortName));
}

/* ---------- Performance détaillée ---------- */

export interface PerformanceModel {
  periods: { key: PeriodKey; label: string; result: PeriodResult | null }[];
  irr: number | null;
  irrAvailableOn: ISODate | null;
  years: YearRow[];
}

export function buildPerformance(model: PortfolioModel): PerformanceModel {
  const last = lastValuedPoint(model.series);
  const asOf = last?.date ?? model.today;
  const first = model.series[0]?.date ?? asOf;
  const keys: PeriodKey[] = ['1W', '1M', 'YTD', '1Y', '3Y', '5Y', 'ALL'];
  const periods = keys.map((key) => ({
    key,
    label: PERIOD_LABELS[key],
    result: last ? periodPerformance(model.series, periodStart(key, asOf, first), asOf) : null,
  }));

  const flows = model.ledger.flows.filter((f) => f.date <= asOf).map((f) => ({ date: f.date, amount: toNumber(f.amount) }));
  const firstFlow = flows.reduce<ISODate | null>((min, f) => (!min || f.date < min ? f.date : min), null);
  let irr: number | null = null;
  let irrAvailableOn: ISODate | null = null;
  if (firstFlow && last?.value) {
    if (diffDays(firstFlow, asOf) >= 365) irr = xirr(flows, toNumber(last.value), asOf);
    else {
      const d = new Date(`${firstFlow}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      irrAvailableOn = d.toISOString().slice(0, 10);
    }
  }

  return { periods, irr, irrAvailableOn, years: yearlyBreakdown(model.series, asOf) };
}

/* ---------- Projection ---------- */

export interface ScenarioResult {
  name: string;
  rate: number;
  result: ProjectionResult;
  goalYear: number | null;
}

export interface ProjectionModel {
  startValue: number;
  startIsReal: boolean;
  startNote: string | null;
  scenarios: ScenarioResult[];
  goal: number | null;
}

export const SCENARIO_NAMES = ['Prudent', 'Intermédiaire', 'Dynamique'];

export function buildProjection(
  ctx: Context,
  family: PortfolioModel,
  settings: ProjectionSettings,
  goalTarget: number | null,
): ProjectionModel {
  let startValue = 0;
  let startIsReal = false;
  let startNote: string | null = null;
  if (settings.startMode === 'actual') {
    if (family.valuation.complete) {
      startValue = toNumber(family.valuation.total);
      startIsReal = true;
    } else {
      startValue = toNumber(family.valuation.total);
      startNote = 'Valeur actuelle incomplète (cours manquant) : le capital de départ est sous-estimé.';
    }
  } else {
    startValue = Math.max(0, Number(settings.customStart) || 0);
  }

  const accounts = ctx.accounts.map((a) => {
    const summary = family.accounts.find((s) => s.account.id === a.id);
    return {
      id: a.id,
      name: a.name,
      monthly: Math.max(0, Number(settings.monthly[a.id]) || 0),
      alreadyDeposited: summary ? Math.max(0, toNumber(netDeposits(summary.ledger))) : 0,
    };
  });

  const scenarios = settings.rates.map((r, i) => {
    const rate = Number(r) || 0;
    const result = project({
      startValue,
      startDate: family.today,
      years: settings.years,
      accounts,
      annualRate: rate,
      capOn: settings.capOn,
      inflationRate: settings.inflationOn ? Number(settings.inflationRate) || 0 : null,
    });
    const reached = goalTarget ? result.points.find((p) => p.value >= goalTarget) : undefined;
    return { name: SCENARIO_NAMES[i], rate, result, goalYear: reached ? reached.year : null };
  });

  return { startValue, startIsReal, startNote, scenarios, goal: goalTarget };
}
