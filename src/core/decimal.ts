/**
 * Calcul décimal exact.
 * Les nombres JavaScript (virgule flottante) donnent 0,1 + 0,2 = 0,30000000000000004 :
 * inacceptable pour des montants. Tous les montants et quantités passent par Big.
 */
import Big from 'big.js';

Big.DP = 20; // décimales conservées dans les divisions
Big.RM = Big.roundHalfUp;

export type Dec = Big;
export const ZERO: Big = new Big(0);
export const ONE: Big = new Big(1);

/** Crée un décimal à partir d'un nombre, d'une chaîne ou d'un décimal. */
export function D(value: Big.BigSource | null | undefined): Big {
  if (value === null || value === undefined || value === '') return ZERO;
  return new Big(value);
}

export function sum(values: Big[]): Big {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

export function toNumber(value: Big): number {
  return Number(value.toString());
}

export function isPositive(value: Big): boolean {
  return value.gt(0);
}

/**
 * Lit une saisie utilisateur française ou anglaise : « 1 234,56 », « 1234.56 », « 6,31 ».
 * Renvoie null si la saisie n'est pas un nombre.
 */
export function parseDecimal(input: string | null | undefined): Big | null {
  if (input === null || input === undefined) return null;
  const cleaned = input
    .trim()
    .replace(/[\s  €]/g, '')
    .replace(',', '.');
  if (cleaned === '' || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  try {
    return new Big(cleaned);
  } catch {
    return null;
  }
}
