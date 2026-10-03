import { describe, expect, it } from 'vitest';
import { computeLedger, computeLedgers, D, mergeLedgers, netDeposits, PriceIndex, unitCost, valueLedger } from '../src/core';
import { bar, etf, mv } from './helpers';

const W = 'world';

function scenario() {
  return [
    mv({ kind: 'deposit', date: '2026-09-01', amount: '6000' }),
    mv({ kind: 'buy', date: '2026-09-02', etfId: W, quantity: '5', unitPrice: '520', fees: '0' }),
    mv({ kind: 'buy', date: '2026-09-10', etfId: W, quantity: '5', unitPrice: '540', fees: '2' }),
    mv({ kind: 'sell', date: '2026-09-20', etfId: W, quantity: '4', unitPrice: '560', fees: '1' }),
    mv({ kind: 'dividend', date: '2026-09-25', etfId: W, amount: '10' }),
    mv({ kind: 'fee', date: '2026-09-30', amount: '5' }),
  ];
}

describe('PRU (prix moyen pondéré, frais inclus)', () => {
  it('pondère les achats et intègre les frais', () => {
    const l = computeLedger(scenario(), '2026-09-15');
    const p = l.positions.get(W)!;
    expect(p.quantity.toString()).toBe('10');
    expect(p.cost.toString()).toBe('5302');
    expect(unitCost(p)!.toString()).toBe('530.2');
  });

  it("une vente ne change pas le PRU et calcule la plus-value réalisée", () => {
    const l = computeLedger(scenario());
    const p = l.positions.get(W)!;
    expect(p.quantity.toString()).toBe('6');
    expect(unitCost(p)!.toString()).toBe('530.2');
    // 4 × 560 − 1 − 4 × 530,2 = 2239 − 2120,8
    expect(l.realized.toString()).toBe('118.2');
  });

  it('repart de zéro après une position soldée', () => {
    const l = computeLedger([
      mv({ kind: 'deposit', date: '2026-01-02', amount: '5000' }),
      mv({ kind: 'buy', date: '2026-01-05', etfId: W, quantity: '2', unitPrice: '100' }),
      mv({ kind: 'sell', date: '2026-02-05', etfId: W, quantity: '2', unitPrice: '120' }),
      mv({ kind: 'buy', date: '2026-03-05', etfId: W, quantity: '3', unitPrice: '90' }),
    ]);
    expect(unitCost(l.positions.get(W)!)!.toString()).toBe('90');
    expect(l.realized.toString()).toBe('40');
  });

  it('applique une division de parts sans changer le coût total', () => {
    const l = computeLedger([
      mv({ kind: 'buy', date: '2026-01-05', etfId: W, quantity: '3', unitPrice: '600' }),
      mv({ kind: 'split', date: '2026-02-01', etfId: W, ratio: '10' }),
    ]);
    const p = l.positions.get(W)!;
    expect(p.quantity.toString()).toBe('30');
    expect(unitCost(p)!.toString()).toBe('60');
    expect(p.cost.toString()).toBe('1800');
  });

  it('ignore et signale une vente supérieure aux parts détenues', () => {
    const l = computeLedger([
      mv({ kind: 'buy', date: '2026-01-05', etfId: W, quantity: '1', unitPrice: '10' }),
      mv({ kind: 'sell', date: '2026-01-06', etfId: W, quantity: '2', unitPrice: '10' }),
    ]);
    expect(l.warnings).toHaveLength(1);
    expect(l.positions.get(W)!.quantity.toString()).toBe('1');
  });
});

describe('liquidités, versements et gain total', () => {
  it('suit les liquidités au centime', () => {
    const l = computeLedger(scenario());
    // 6000 − 2600 − 2702 + 2239 + 10 − 5
    expect(l.cash.toString()).toBe('2942');
    expect(netDeposits(l).toString()).toBe('6000');
  });

  it('vérifie : gain total = latentes + réalisées + dividendes − frais', () => {
    const l = computeLedger(scenario());
    const prices = new PriceIndex([bar('CW8.PA', '2026-09-30', '550')]);
    const v = valueLedger(l, new Map([[W, etf(W, 'CW8.PA')]]), prices, '2026-09-30');
    expect(v.total.toString()).toBe('6242');
    expect(v.gain!.toString()).toBe('242');
    const identity = v.unrealized.plus(v.realized).plus(v.dividends).minus(v.otherFees);
    expect(identity.toString()).toBe(v.gain!.toString());
    expect(v.invested.toString()).toBe('3181.2');
  });

  it('ne valorise jamais une position sans cours', () => {
    const l = computeLedger(scenario());
    const v = valueLedger(l, new Map([[W, etf(W, 'CW8.PA')]]), new PriceIndex([]), '2026-09-30');
    expect(v.complete).toBe(false);
    expect(v.missing).toEqual([W]);
    expect(v.gain).toBeNull();
    expect(v.total.toString()).toBe('2942'); // liquidités seules, jamais le PRU
  });

  it('utilise le PRU propre à chaque PEA pour les ventes', () => {
    const ledgers = computeLedgers([
      mv({ accountId: 'A', kind: 'buy', date: '2026-01-05', etfId: W, quantity: '10', unitPrice: '100' }),
      mv({ accountId: 'B', kind: 'buy', date: '2026-01-05', etfId: W, quantity: '10', unitPrice: '200' }),
      mv({ accountId: 'A', kind: 'sell', date: '2026-02-05', etfId: W, quantity: '5', unitPrice: '150' }),
    ]);
    const family = mergeLedgers(ledgers.values());
    expect(ledgers.get('A')!.realized.toString()).toBe('250');
    expect(family.realized.toString()).toBe('250');
    expect(family.positions.get(W)!.quantity.toString()).toBe('15');
    expect(family.positions.get(W)!.cost.toString()).toBe(D(500).plus(2000).toString());
  });
});

describe('versements déduits des achats (saisie des seuls achats et ventes)', () => {
  it('compte un achat non couvert comme un versement du même jour', () => {
    const l = computeLedger([
      mv({ kind: 'buy', date: '2026-09-02', etfId: W, quantity: '79', unitPrice: '6.31', fees: '1' }),
      mv({ kind: 'buy', date: '2026-10-01', etfId: W, quantity: '80', unitPrice: '6.25', fees: '0' }),
    ]);
    // 79 × 6,31 + 1 = 499,49 ; 80 × 6,25 = 500
    expect(netDeposits(l).toString()).toBe('999.49');
    expect(l.implicitDeposits.toString()).toBe('999.49');
    expect(l.cash.toString()).toBe('0');
    expect(l.flows.map((f) => [f.date, f.amount.toString()])).toEqual([
      ['2026-09-02', '499.49'],
      ['2026-10-01', '500'],
    ]);
  });

  it('ne déduit que la part que les liquidités ne couvrent pas', () => {
    const l = computeLedger([
      mv({ kind: 'deposit', date: '2026-09-01', amount: '1000' }),
      mv({ kind: 'buy', date: '2026-09-02', etfId: W, quantity: '12', unitPrice: '100' }),
    ]);
    expect(l.implicitDeposits.toString()).toBe('200');
    expect(netDeposits(l).toString()).toBe('1200');
    expect(l.cash.toString()).toBe('0');
  });

  it("réutilise d'abord l'argent d'une vente", () => {
    const l = computeLedger([
      mv({ kind: 'buy', date: '2026-01-05', etfId: W, quantity: '10', unitPrice: '100' }),
      mv({ kind: 'sell', date: '2026-02-05', etfId: W, quantity: '5', unitPrice: '120' }),
      mv({ kind: 'buy', date: '2026-03-05', etfId: W, quantity: '5', unitPrice: '110' }),
    ]);
    expect(netDeposits(l).toString()).toBe('1000');
    expect(l.cash.toString()).toBe('50');
  });

  it('mesure la performance sans compter ces versements comme des gains', async () => {
    const { buildSeries, periodPerformance } = await import('../src/core');
    const movements = [
      mv({ kind: 'buy', date: '2026-09-01', etfId: W, quantity: '100', unitPrice: '10' }),
      mv({ kind: 'buy', date: '2026-09-03', etfId: W, quantity: '100', unitPrice: '11' }),
    ];
    const prices = new PriceIndex([bar('CW8.PA', '2026-09-01', '10'), bar('CW8.PA', '2026-09-02', '11'), bar('CW8.PA', '2026-09-03', '11')]);
    const series = buildSeries(movements, new Map([[W, etf(W, 'CW8.PA')]]), prices, '2026-09-03');
    const r = periodPerformance(series, series[0].date, '2026-09-03')!;
    expect(r.twr).toBeCloseTo(0.1, 10); // seule la hausse de 10 → 11 compte
    expect(r.gain.toString()).toBe('100');
  });
});
