import { describe, expect, it } from 'vitest';
import { fetchEod, fileNameFor, isRobotWindow, mergeBars, parseEodResponse, parseSymbols, targetSession } from '../robot/lib';

describe('robot des cours', () => {
  it('lit la liste des symboles et refuse les erreurs de saisie', () => {
    expect(parseSymbols([{ symbol: 'DCAM.PA', since: '2026-09-01' }])).toEqual([{ symbol: 'DCAM.PA', since: '2026-09-01' }]);
    expect(() => parseSymbols([{ symbol: 'DCAM PA', since: '2026-09-01' }])).toThrow();
    expect(() => parseSymbols([{ symbol: 'DCAM.PA', since: '01/09/2026' }])).toThrow();
  });

  it('ne travaille que les soirs de séance (heure de Paris)', () => {
    expect(isRobotWindow(new Date('2026-10-02T18:00:00Z'))).toBe(true); // ven. 20 h
    expect(isRobotWindow(new Date('2026-10-02T15:00:00Z'))).toBe(false); // ven. 17 h
    expect(isRobotWindow(new Date('2026-10-03T18:00:00Z'))).toBe(false); // samedi
  });

  it('vise la séance du jour après la clôture', () => {
    expect(targetSession(new Date('2026-10-02T18:00:00Z'))).toBe('2026-10-02');
    expect(targetSession(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-02');
    expect(targetSession(new Date('2026-10-05T08:00:00Z'))).toBe('2026-10-02');
  });

  it("interprète la réponse EODHD et ignore les lignes invalides", () => {
    const bars = parseEodResponse([
      { date: '2026-10-02', open: 6.25, high: 6.32, low: 6.24, close: 6.308, adjusted_close: 6.308, volume: 1 },
      { date: '2026-10-01', close: 6.251, adjusted_close: 6.251 },
      { date: 'bad', close: 1 },
      { date: '2026-09-30', close: 0 },
    ]);
    expect(bars).toEqual([
      ['2026-10-01', 6.251, 6.251],
      ['2026-10-02', 6.308, 6.308],
    ]);
  });

  it('fusionne les historiques sans doublon', () => {
    expect(
      mergeBars(
        [['2026-10-01', 6.2, 6.2]],
        [
          ['2026-10-01', 6.25, 6.25],
          ['2026-10-02', 6.3, 6.3],
        ],
      ),
    ).toEqual([
      ['2026-10-01', 6.25, 6.25],
      ['2026-10-02', 6.3, 6.3],
    ]);
  });

  it("n'expose jamais la clé dans les messages d'erreur", async () => {
    const fakeFetch = (async () => new Response('Ticker Not Found', { status: 404 })) as typeof fetch;
    await expect(fetchEod('XXX.PA', '2026-09-01', 'SECRET123', fakeFetch)).rejects.toThrow(/404/);
    await expect(fetchEod('XXX.PA', '2026-09-01', 'SECRET123', fakeFetch)).rejects.not.toThrow(/SECRET123/);
  });

  it('nomme les fichiers sans caractère dangereux', () => {
    expect(fileNameFor('DCAM.PA')).toBe('DCAM.PA.json');
    expect(fileNameFor('../x')).toBe('.._x.json');
  });
});
