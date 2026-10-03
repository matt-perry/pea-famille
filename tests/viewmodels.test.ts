import { describe, expect, it } from 'vitest';
import type { Account } from '../src/core';
import { checkMovement } from '../src/viewmodels/movementForm';
import { buildPerformance, buildPortfolio, buildProjection, buildQuotes, makeContext } from '../src/viewmodels/portfolio';
import { projectionWithDefaults } from '../src/repositories/settings';
import { bar, etf, mv } from './helpers';

const NOW = new Date('2026-10-03T10:00:00Z'); // samedi 3 octobre 2026, 12 h à Paris
const accounts: Account[] = [
  { id: 'A', name: 'PEA 1', owner: '', order: 0, archived: false },
  { id: 'B', name: 'PEA 2', owner: '', order: 1, archived: false },
];
const movements = ['A', 'B'].flatMap((acc) => [
  mv({ accountId: acc, kind: 'deposit', date: '2026-09-01', amount: '1000' }),
  mv({ accountId: acc, kind: 'buy', date: '2026-09-02', etfId: 'w', quantity: '150', unitPrice: '6.02', fees: '0' }),
  mv({ accountId: acc, kind: 'deposit', date: '2026-10-01', amount: '500' }),
  mv({ accountId: acc, kind: 'buy', date: '2026-10-01', etfId: 'w', quantity: '79', unitPrice: '6.25', fees: '0' }),
]);
const prices = [bar('DCAM.PA', '2026-09-02', '6.02'), bar('DCAM.PA', '2026-10-01', '6.251'), bar('DCAM.PA', '2026-10-02', '6.308')];
const ctx = makeContext({ accounts, etfs: [etf('w', 'DCAM.PA')], movements, prices });

describe('écran Patrimoine', () => {
  it('assemble valeur, séance et gain de la famille', () => {
    const m = buildPortfolio(ctx, 'family', NOW);
    expect(m.valuation.total.toString()).toBe('3095.564'); // 458 × 6,308 + 206,50 (exact, arrondi à l'affichage)
    expect(m.valuation.gain!.toString()).toBe('95.564');
    expect(m.session!.date).toBe('2026-10-02');
    expect(m.session!.gain.toString()).toBe('26.106'); // 458 × (6,308 − 6,251)
    expect(m.nature).toBe('real');
    expect(m.accounts.map((a) => a.valuation.total.toString())).toEqual(['1547.782', '1547.782']);
  });

  it("donne le cours de l'ETF et sa variation de séance", () => {
    const [q] = buildQuotes(ctx, buildPortfolio(ctx, 'family', NOW));
    expect(q.last!.close.toString()).toBe('6.308');
    expect(q.last!.date).toBe('2026-10-02');
    expect(q.changePct).toBeCloseTo(6.308 / 6.251 - 1, 12);
    expect(q.stale).toBe(false);
    expect(q.held).toBe(true);
  });

  it('signale un cours ancien sans le remplacer', () => {
    const m = buildPortfolio(ctx, 'A', new Date('2026-10-06T21:30:00Z')); // mardi soir, cours du 2 oct.
    expect(m.nature).toBe('lastKnown');
    expect(m.valuation.total.toString()).toBe('1547.782');
  });

  it("n'affiche pas de rendement annualisé avant un an", () => {
    const perf = buildPerformance(buildPortfolio(ctx, 'family', NOW));
    expect(perf.irr).toBeNull();
    expect(perf.irrAvailableOn).toBe('2027-09-01');
    expect(perf.periods.find((p) => p.key === 'ALL')!.result!.gain.toString()).toBe('95.564');
  });

  it('projette avec les versements déjà faits pour le plafond', () => {
    const family = buildPortfolio(ctx, 'family', NOW);
    const model = buildProjection(ctx, family, projectionWithDefaults(null, ['A', 'B']), 500000);
    expect(model.startIsReal).toBe(true);
    expect(model.startValue).toBeCloseTo(3095.564, 3);
    // 2 × (150 000 − 1 500) versés au maximum sur 25 ans
    expect(model.scenarios[1].result.futureContributions).toBe(297000);
  });
});

describe('formulaire de mouvement', () => {
  it('refuse de vendre plus que les parts détenues', () => {
    const check = checkMovement(
      { kind: 'sell', accountId: 'A', etfId: 'w', date: '2026-10-02', quantity: '500', unitPrice: '6,31', fees: '', amount: '', ratio: '', note: '' },
      movements,
      null,
      NOW,
    );
    expect(check.movement).toBeNull();
    expect(check.errors[0]).toContain('229');
  });

  it('calcule le récapitulatif d’un achat', () => {
    const check = checkMovement(
      { kind: 'buy', accountId: 'A', etfId: 'w', date: '2026-10-02', quantity: '10', unitPrice: '6,31', fees: '1', amount: '', ratio: '', note: '' },
      movements,
      null,
      NOW,
    );
    const get = (label: string) => String(check.summary.find((s) => s.label === label)?.value);
    expect(get('Total avec frais')).toBe('64.1');
    expect(get('Parts détenues après')).toBe('239');
    expect(get('Liquidités après')).toBe('39.15');
    expect(check.movement!.unitPrice).toBe('6.31');
  });

  it('refuse une date future', () => {
    const check = checkMovement(
      { kind: 'deposit', accountId: 'A', etfId: '', date: '2026-10-10', quantity: '', unitPrice: '', fees: '', amount: '500', ratio: '', note: '' },
      movements,
      null,
      NOW,
    );
    expect(check.errors).toContain('La date est dans le futur.');
  });
});
