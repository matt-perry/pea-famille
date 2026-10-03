import { describe, expect, it } from 'vitest';
import { monthlyRate, project, type ProjectionParams } from '../src/core';

// Exemple du dossier de conception : 42 350 € dont 17 965 € versés par PEA, 500 €/mois chacun.
const base: ProjectionParams = {
  startValue: 42350,
  startDate: '2026-10-03',
  years: 25,
  accounts: [
    { id: 'A', name: 'PEA 1', monthly: 500, alreadyDeposited: 17965 },
    { id: 'B', name: 'PEA 2', monthly: 500, alreadyDeposited: 17965 },
  ],
  annualRate: 0.06,
  capOn: true,
  inflationRate: null,
};

describe('projection à 25 ans', () => {
  it('utilise le taux mensuel équivalent', () => {
    expect(Math.pow(1 + monthlyRate(0.06), 12)).toBeCloseTo(1.06, 12);
  });

  it('retrouve les trois scénarios du dossier (plafond appliqué)', () => {
    expect(Math.round(project({ ...base, annualRate: 0.04 }).finalValue)).toBe(585225);
    expect(Math.round(project(base).finalValue)).toBe(821991);
    expect(Math.round(project({ ...base, annualRate: 0.08 }).finalValue)).toBe(1164335);
  });

  it('arrête les versements au plafond de 150 000 € par PEA', () => {
    const r = project(base);
    expect(r.futureContributions).toBe(264070);
    expect(r.capEvents.map((e) => e.date)).toEqual(['2048-11-03', '2048-11-03']);
    expect(Math.round(project({ ...base, capOn: false }).finalValue)).toBe(861342);
  });

  it('décompose capital, versements et gains', () => {
    const r = project(base);
    expect(r.startValue + r.futureContributions + r.gains).toBeCloseTo(r.finalValue, 6);
    expect(r.points).toHaveLength(26);
    expect(r.points[0].year).toBe(2026);
    expect(r.points[25].year).toBe(2051);
  });

  it('exprime la valeur en euros constants', () => {
    const r = project({ ...base, inflationRate: 0.02 });
    expect(Math.round(r.realFinalValue!)).toBe(501029);
  });

  it('correspond à la formule fermée sans plafond ni capital de départ', () => {
    const r = project({ ...base, startValue: 0, capOn: false, accounts: [{ id: 'A', name: 'A', monthly: 1000, alreadyDeposited: 0 }] });
    const rm = monthlyRate(0.06);
    const closed = 1000 * ((Math.pow(1 + rm, 300) - 1) / rm) * (1 + rm); // versement en début de mois
    expect(r.finalValue).toBeCloseTo(closed, 4);
    expect(Math.round(r.finalValue)).toBe(679581);
  });

  it('signale un PEA déjà au plafond', () => {
    const r = project({ ...base, accounts: [{ id: 'A', name: 'PEA 1', monthly: 500, alreadyDeposited: 150000 }] });
    expect(r.futureContributions).toBe(0);
    expect(r.capEvents[0].date).toBe('2026-10-03');
  });
});
