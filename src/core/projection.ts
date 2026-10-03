/**
 * Projection mathématique du patrimoine.
 * Chaque mois : le versement s'ajoute, puis le capital croît du taux mensuel équivalent
 * (1 + taux annuel)^(1/12) − 1. Les versements d'un PEA s'arrêtent à son plafond
 * (150 000 € versés) si l'option est active.
 *
 * Ce sont des hypothèses : le résultat n'est jamais une prévision.
 * Les projections utilisent des nombres classiques (arrondis au millier à l'affichage).
 */
import { addMonths, type ISODate, yearOf } from './dates';
import { PEA_DEPOSIT_CAP } from './domain';

export interface ProjectionAccount {
  id: string;
  name: string;
  monthly: number;
  /** Versé net déjà effectué sur ce PEA (pour le plafond) */
  alreadyDeposited: number;
}

export interface ProjectionParams {
  startValue: number;
  startDate: ISODate;
  years: number;
  accounts: ProjectionAccount[];
  annualRate: number;
  capOn: boolean;
  cap?: number;
  /** Taux d'inflation annuel, ou null pour ne pas calculer d'euros constants */
  inflationRate: number | null;
}

export interface ProjectionPoint {
  /** Années écoulées depuis le départ */
  offset: number;
  /** Année calendaire du point */
  year: number;
  value: number;
  /** Capital de départ + versements futurs cumulés */
  contributed: number;
  /** Valeur en euros d'aujourd'hui, si l'inflation est prise en compte */
  realValue: number | null;
}

export interface CapEvent {
  accountId: string;
  accountName: string;
  /** Mois du dernier versement (plafond atteint) */
  date: ISODate;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  startValue: number;
  futureContributions: number;
  finalValue: number;
  gains: number;
  realFinalValue: number | null;
  capEvents: CapEvent[];
}

export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function project(params: ProjectionParams): ProjectionResult {
  const cap = params.cap ?? PEA_DEPOSIT_CAP;
  const rm = monthlyRate(params.annualRate);
  const deposited = params.accounts.map((a) => a.alreadyDeposited);
  const capped = params.accounts.map(() => false);
  const capEvents: CapEvent[] = [];
  let value = params.startValue;
  let contributions = 0;
  const realFactor = (months: number) =>
    params.inflationRate === null ? null : Math.pow(1 + params.inflationRate, months / 12);

  const startYear = yearOf(params.startDate);
  const points: ProjectionPoint[] = [
    { offset: 0, year: startYear, value, contributed: params.startValue, realValue: params.inflationRate === null ? null : value },
  ];

  const months = Math.round(params.years * 12);
  for (let m = 1; m <= months; m++) {
    let added = 0;
    params.accounts.forEach((account, i) => {
      let amount = Math.max(0, account.monthly);
      if (params.capOn) {
        const room = Math.max(0, cap - deposited[i]);
        amount = Math.min(amount, room);
        if (!capped[i] && account.monthly > 0 && deposited[i] + amount >= cap) {
          capped[i] = true;
          capEvents.push({
            accountId: account.id,
            accountName: account.name,
            date: amount > 0 ? addMonths(params.startDate, m) : params.startDate,
          });
        }
      }
      deposited[i] += amount;
      added += amount;
    });
    value = (value + added) * (1 + rm);
    contributions += added;
    if (m % 12 === 0) {
      const factor = realFactor(m);
      points.push({
        offset: m / 12,
        year: startYear + m / 12,
        value,
        contributed: params.startValue + contributions,
        realValue: factor === null ? null : value / factor,
      });
    }
  }

  const factor = realFactor(months);
  return {
    points,
    startValue: params.startValue,
    futureContributions: contributions,
    finalValue: value,
    gains: value - params.startValue - contributions,
    realFinalValue: factor === null ? null : value / factor,
    capEvents,
  };
}
