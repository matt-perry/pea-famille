/**
 * Types du domaine. Les montants sont stockés en texte (« 520.50 ») pour rester exacts ;
 * le moteur les convertit en décimaux pour calculer.
 */
import type { ISODate } from './dates';

export type { ISODate };

export interface Account {
  id: string;
  /** Nom affiché, ex. « PEA 1 » */
  name: string;
  /** Titulaire, facultatif */
  owner: string;
  openedOn?: ISODate;
  broker?: string;
  order: number;
  archived: boolean;
}

export type EtfCategory = 'monde' | 'usa' | 'nasdaq' | 'europe' | 'emergents' | 'autre';

export interface Etf {
  id: string;
  /** Nom complet, ex. « Amundi PEA Monde (MSCI World) UCITS ETF Acc » */
  name: string;
  /** Nom court affiché, ex. « MSCI World » */
  shortName: string;
  ticker: string;
  /** Code de place, ex. « PA » pour Euronext Paris (suffixe Yahoo et EODHD) */
  exchange: string;
  /** Symbole interrogé par le robot, ex. « DCAM.PA » */
  symbol: string;
  isin: string;
  currency: string;
  category: EtfCategory;
  issuer: string;
  sourceUrl?: string;
  archived: boolean;
}

export type MovementKind = 'deposit' | 'withdrawal' | 'buy' | 'sell' | 'dividend' | 'fee' | 'split';

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  deposit: 'Versement',
  withdrawal: 'Retrait',
  buy: 'Achat',
  sell: 'Vente',
  dividend: 'Dividende',
  fee: 'Frais',
  split: 'Division',
};

/** Types qui concernent un ETF */
export const ETF_KINDS: MovementKind[] = ['buy', 'sell', 'dividend', 'split'];

export interface Movement {
  id: string;
  accountId: string;
  etfId?: string;
  kind: MovementKind;
  date: ISODate;
  /** Achat / vente : nombre de parts */
  quantity?: string;
  /** Achat / vente : prix d'une part */
  unitPrice?: string;
  /** Achat / vente : frais de courtage */
  fees?: string;
  /** Versement, retrait, dividende, frais : montant en euros */
  amount?: string;
  /** Division : nouvelles parts pour une ancienne (ex. « 10 ») */
  ratio?: string;
  note?: string;
  /** Ordre de saisie, pour départager deux mouvements du même jour */
  createdAt: number;
}

export interface PriceBar {
  /** Symbole interrogé par le robot, ex. « DCAM.PA » */
  symbol: string;
  date: ISODate;
  /** Clôture brute, telle que cotée ce jour-là */
  close: string;
  /** Clôture ajustée (divisions, dividendes), conservée pour information */
  adjClose?: string;
  source: string;
  fetchedAt: number;
}

export interface Goal {
  target: string;
  /** 'family' ou l'identifiant d'un compte */
  scope: string;
}

export interface ProjectionSettings {
  years: number;
  /** Versement mensuel par compte (identifiant → montant) */
  monthly: Record<string, string>;
  /** Taux annuels des trois scénarios, ex. ['0.04', '0.06', '0.08'] */
  rates: [string, string, string];
  inflationOn: boolean;
  inflationRate: string;
  capOn: boolean;
  startMode: 'actual' | 'custom';
  customStart: string;
}

export const DEFAULT_PROJECTION: Omit<ProjectionSettings, 'monthly'> = {
  years: 25,
  rates: ['0.04', '0.06', '0.08'],
  inflationOn: false,
  inflationRate: '0.02',
  capOn: true,
  startMode: 'actual',
  customStart: '0',
};

/** Nature d'un chiffre affiché */
export type DataNature = 'real' | 'lastKnown' | 'unavailable' | 'projection' | 'hypothesis' | 'estimate';

/** Plafond légal des versements sur un PEA */
export const PEA_DEPOSIT_CAP = 150_000;
