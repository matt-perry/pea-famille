import { describe, expect, it } from 'vitest';
import {
  buildSeries,
  D,
  lastSessionChange,
  periodPerformance,
  PriceIndex,
  xirr,
  yearlyBreakdown,
  type SeriesPoint,
} from '../src/core';
import { bar, etf, mv } from './helpers';

const p = (date: string, value: number | null, flow = 0, nd = 0): SeriesPoint => ({
  date,
  value: value === null ? null : D(value),
  flow: D(flow),
  netDeposits: D(nd),
});

// Cas construit à la main : +10 %, puis 0 % avec un versement de 1 000 €, puis +10 %.
const points: SeriesPoint[] = [
  p('2026-08-31', 0),
  p('2026-09-01', 1000, 1000, 1000),
  p('2026-09-02', 1100, 0, 1000),
  p('2026-09-03', 2100, 1000, 2000),
  p('2026-09-04', 2310, 0, 2000),
];

describe('performance pondérée par le temps (TWR)', () => {
  it("neutralise les versements", () => {
    const r = periodPerformance(points, '2026-08-31', '2026-09-04')!;
    expect(r.twr).toBeCloseTo(0.21, 10); // 1,1 × 1,0 × 1,1 − 1
    expect(r.gain.toString()).toBe('310'); // 2310 − 0 − 2000
    expect(r.flows.toString()).toBe('2000');
  });

  it('mesure une sous-période', () => {
    const r = periodPerformance(points, '2026-09-02', '2026-09-04')!;
    expect(r.twr).toBeCloseTo(0.1, 10);
    expect(r.gain.toString()).toBe('210');
  });

  it("renvoie null si l'historique ne couvre pas la période", () => {
    expect(periodPerformance(points, '2026-01-01', '2026-09-04')).toBeNull();
  });

  it('enjambe un jour sans cours sans inventer de valeur', () => {
    const withGap = [...points.slice(0, 3), p('2026-09-03', null, 1000, 2000), points[4]];
    const r = periodPerformance(withGap, '2026-08-31', '2026-09-04')!;
    // 1,1 puis (2310 − 1000) / 1100
    expect(r.twr).toBeCloseTo(1.1 * (1310 / 1100) - 1, 10);
  });

  it('calcule la variation de la dernière séance', () => {
    const s = lastSessionChange(points)!;
    expect(s.date).toBe('2026-09-04');
    expect(s.gain.toString()).toBe('210');
    expect(s.pct).toBeCloseTo(0.1, 10);
  });

  it('ne compte pas un versement du jour comme un gain de séance', () => {
    const s = lastSessionChange(points.slice(0, 4))!;
    expect(s.gain.toString()).toBe('0');
  });

  it('fait le bilan par année', () => {
    const rows = yearlyBreakdown(points, '2026-09-04');
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2026);
    expect(rows[0].gain.toString()).toBe('310');
    expect(rows[0].partial).toBe(true);
  });
});

describe('TRI (XIRR)', () => {
  it('trouve 10 % pour 1 000 € devenus 1 100 € en un an', () => {
    expect(xirr([{ date: '2025-01-01', amount: 1000 }], 1100, '2026-01-01')).toBeCloseTo(0.1, 8);
  });

  it('trouve 10 % avec deux versements annuels', () => {
    const flows = [
      { date: '2024-01-01', amount: 1000 },
      { date: '2024-12-31', amount: 1000 },
    ];
    expect(xirr(flows, 1000 * 1.1 ** 2 + 1000 * 1.1, '2025-12-31')).toBeCloseTo(0.1, 6);
  });

  it('gère une perte', () => {
    expect(xirr([{ date: '2025-01-01', amount: 1000 }], 800, '2026-01-01')).toBeCloseTo(-0.2, 8);
  });
});

describe('historique de valeur', () => {
  it('reconstruit la valeur jour par jour à partir des mouvements et des cours', () => {
    const movements = [
      mv({ kind: 'deposit', date: '2026-09-01', amount: '1000' }),
      mv({ kind: 'buy', date: '2026-09-01', etfId: 'w', quantity: '100', unitPrice: '10' }),
    ];
    const prices = new PriceIndex([bar('DCAM.PA', '2026-09-01', '10'), bar('DCAM.PA', '2026-09-02', '11')]);
    const series = buildSeries(movements, new Map([['w', etf('w', 'DCAM.PA')]]), prices, '2026-09-02');
    expect(series.map((s) => [s.date, s.value?.toString(), s.flow.toString()])).toEqual([
      ['2026-08-31', '0', '0'],
      ['2026-09-01', '1000', '1000'],
      ['2026-09-02', '1100', '0'],
    ]);
  });

  it('laisse un trou plutôt que d’inventer une valeur', () => {
    const movements = [mv({ kind: 'buy', date: '2026-09-01', etfId: 'w', quantity: '1', unitPrice: '10' })];
    const series = buildSeries(movements, new Map([['w', etf('w', 'DCAM.PA')]]), new PriceIndex([]), '2026-09-02');
    expect(series[1].value).toBeNull();
  });
});
