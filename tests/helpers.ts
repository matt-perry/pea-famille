import type { Etf, Movement, PriceBar } from '../src/core';

let seq = 0;

export function mv(partial: Partial<Movement> & Pick<Movement, 'kind' | 'date'>): Movement {
  seq += 1;
  return { id: `m${seq}`, accountId: 'A', createdAt: seq, ...partial };
}

export function etf(id: string, symbol: string): Etf {
  return {
    id,
    name: id,
    shortName: id,
    ticker: symbol.split('.')[0],
    exchange: 'PA',
    symbol,
    isin: '',
    currency: 'EUR',
    category: 'monde',
    issuer: '',
    archived: false,
  };
}

export function bar(symbol: string, date: string, close: string): PriceBar {
  return { symbol, date, close, source: 'test', fetchedAt: 0 };
}
