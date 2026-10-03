import { describe, expect, it } from 'vitest';
import { easterSunday, expectedPublishedSession, isTradingDay, previousTradingDay, tradingDaysBetween } from '../src/core';

describe('calendrier Euronext', () => {
  it('calcule Pâques', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
  });

  it('ferme le week-end et les jours fériés boursiers', () => {
    expect(isTradingDay('2026-10-02')).toBe(true); // vendredi
    expect(isTradingDay('2026-10-03')).toBe(false); // samedi
    expect(isTradingDay('2027-03-26')).toBe(false); // Vendredi saint
    expect(isTradingDay('2027-03-29')).toBe(false); // lundi de Pâques
    expect(isTradingDay('2026-05-01')).toBe(false);
    expect(isTradingDay('2026-12-25')).toBe(false);
    expect(isTradingDay('2026-12-26')).toBe(false);
    expect(isTradingDay('2026-11-11')).toBe(true); // férié en France mais Euronext ouvert
  });

  it('trouve la séance précédente', () => {
    expect(previousTradingDay('2026-10-05')).toBe('2026-10-02');
    expect(previousTradingDay('2027-03-30')).toBe('2027-03-25');
  });

  it('liste les séances', () => {
    expect(tradingDaysBetween('2026-10-01', '2026-10-06')).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
  });

  it("sait quelle clôture devrait être publiée (heure de Paris)", () => {
    // Samedi 3 octobre 2026, 12 h à Paris → vendredi
    expect(expectedPublishedSession(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-02');
    // Lundi 5 octobre, 18 h à Paris → la clôture du jour n'est pas encore attendue
    expect(expectedPublishedSession(new Date('2026-10-05T16:00:00Z'))).toBe('2026-10-02');
    // Lundi 5 octobre, 23 h à Paris → clôture du jour attendue
    expect(expectedPublishedSession(new Date('2026-10-05T21:00:00Z'))).toBe('2026-10-05');
  });
});
