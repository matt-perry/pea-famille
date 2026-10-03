import { describe, expect, it } from 'vitest';
import {
  fetchBars,
  fetchEod,
  fileNameFor,
  isRobotWindow,
  mergeBars,
  parseEodResponse,
  parseSymbols,
  parseYahooResponse,
  parseYfinanceOutput,
  targetSession,
  type RunPython,
} from '../robot/lib';

/** yfinance indisponible (ex. bloqué ou non installé) : le robot doit passer à la source suivante. */
const noPython: RunPython = async () => {
  throw new Error("ModuleNotFoundError: No module named 'yfinance'");
};

/** Réponse Yahoo réaliste : séances datées à l'ouverture (9 h Paris = 7 h UTC en été). */
function yahooChart(rows: [string, number | null][], currency = 'EUR') {
  return {
    chart: {
      result: [
        {
          meta: { currency, symbol: 'DCAM.PA', gmtoffset: 7200, exchangeTimezoneName: 'Europe/Paris' },
          timestamp: rows.map(([d]) => Date.parse(`${d}T07:00:00Z`) / 1000),
          indicators: {
            quote: [{ close: rows.map(([, c]) => c) }],
            adjclose: [{ adjclose: rows.map(([, c]) => c) }],
          },
        },
      ],
      error: null,
    },
  };
}


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

  it('interprète la réponse Yahoo Finance : dates de Paris, bruit des flottants retiré, trous ignorés', () => {
    const bars = parseYahooResponse(
      yahooChart([
        ['2026-09-30', 6.251000118255615],
        ['2026-10-01', null],
        ['2026-10-02', 6.308000087738037],
      ]),
    );
    expect(bars).toEqual([
      ['2026-09-30', 6.251, 6.251],
      ['2026-10-02', 6.308, 6.308],
    ]);
  });

  it('refuse une réponse Yahoo en erreur ou dans une autre devise', () => {
    expect(() => parseYahooResponse({ chart: { result: null, error: { description: 'No data found, symbol may be delisted' } } })).toThrow(/delisted/);
    expect(() => parseYahooResponse(yahooChart([['2026-10-02', 70.1]], 'USD'))).toThrow(/USD/);
    expect(() => parseYahooResponse({})).toThrow();
  });

  it('lit la sortie de yfinance et revérifie chaque séance', () => {
    const out = JSON.stringify({
      currency: 'EUR',
      bars: [
        ['2026-10-02', 6.308000087738037, 6.308000087738037],
        ['2026-10-01', 6.251, null],
        ['bad', 6.2, 6.2],
        ['2026-09-30', 0, 0],
        ['2026-09-29', 'NaN', null],
      ],
    });
    expect(parseYfinanceOutput(out)).toEqual([
      ['2026-10-01', 6.251, null],
      ['2026-10-02', 6.308, 6.308],
    ]);
    expect(() => parseYfinanceOutput('Traceback…')).toThrow(/illisible/);
    expect(() => parseYfinanceOutput(JSON.stringify({ currency: 'USD', bars: [] }))).toThrow(/USD/);
  });

  it('essaie yfinance en premier et ne garde que les séances terminées', async () => {
    const calls: string[][] = [];
    const python: RunPython = async (args) => {
      calls.push(args);
      return JSON.stringify({
        currency: 'EUR',
        bars: [
          ['2026-10-01', 6.251, 6.251],
          ['2026-10-02', 6.308, 6.308],
          ['2026-10-05', 6.4, 6.4], // séance en cours : à ignorer
        ],
      });
    };
    const neverFetch = (async () => {
      throw new Error('ne doit pas être appelé');
    }) as typeof fetch;
    const result = await fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { runPython: python, fetchImpl: neverFetch });
    expect(result.source).toBe('Yahoo Finance');
    expect(result.bars.map((b) => b[0])).toEqual(['2026-10-01', '2026-10-02']);
    expect(calls[0].slice(1)).toEqual(['DCAM.PA', '2026-10-01', '2026-10-02']);
    expect(calls[0][0]).toMatch(/robot[\\/]yahoo\.py$/);
  });

  it('passe à Yahoo en direct si yfinance échoue', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return Response.json(
        yahooChart([
          ['2026-10-01', 6.251],
          ['2026-10-02', 6.308],
        ]),
      );
    }) as typeof fetch;
    const result = await fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { runPython: noPython, fetchImpl: fakeFetch });
    expect(result.source).toBe('Yahoo Finance');
    expect(result.bars).toHaveLength(2);
    expect(calls[0]).toContain('query1.finance.yahoo.com/v8/finance/chart/DCAM.PA');
  });

  it("passe à EODHD si Yahoo échoue et qu'une clé existe, sans jamais l'afficher", async () => {
    const fakeFetch = (async (url: string | URL) => {
      if (String(url).includes('yahoo')) return new Response('Too Many Requests', { status: 429 });
      return Response.json([{ date: '2026-10-02', close: 6.308, adjusted_close: 6.308 }]);
    }) as typeof fetch;
    const result = await fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { eodhdKey: 'SECRET123', fetchImpl: fakeFetch, runPython: noPython });
    expect(result).toEqual({ source: 'EODHD', bars: [['2026-10-02', 6.308, 6.308]] });

    const allDown = (async () => new Response('down', { status: 503 })) as typeof fetch;
    await expect(fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { fetchImpl: allDown, runPython: noPython })).rejects.toThrow(
      /^yfinance : ModuleNotFoundError.* · Yahoo Finance a répondu 503/,
    );
    const both = fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { eodhdKey: 'SECRET123', fetchImpl: allDown, runPython: noPython });
    await expect(both).rejects.toThrow(/ · EODHD a répondu 503/);
    await expect(
      fetchBars('DCAM.PA', '2026-10-01', '2026-10-02', { eodhdKey: 'SECRET123', fetchImpl: allDown, runPython: noPython }),
    ).rejects.not.toThrow(/SECRET123/);
  });

  it('nomme les fichiers sans caractère dangereux', () => {
    expect(fileNameFor('DCAM.PA')).toBe('DCAM.PA.json');
    expect(fileNameFor('../x')).toBe('.._x.json');
  });
});
