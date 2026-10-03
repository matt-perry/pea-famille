/**
 * Grand livre d'un compte : rejoue les mouvements dans l'ordre et en déduit
 * quantités, PRU, liquidités, versements et plus-values réalisées.
 *
 * PRU (prix de revient unitaire) : méthode du prix moyen pondéré, frais d'achat inclus,
 * comme chez les courtiers. Une vente ne modifie pas le PRU.
 *
 * Versements déduits : un PEA ne peut pas avoir de liquidités négatives. Si un achat
 * (ou des frais) dépasse les liquidités connues, la différence est comptée comme un
 * versement du même jour. Saisir ses versements reste possible mais n'est pas obligatoire.
 */
import { D, ZERO, type Dec } from './decimal';
import type { ISODate, Movement } from './domain';

export interface PositionState {
  etfId: string;
  quantity: Dec;
  /** Coût d'acquisition des parts détenues, frais inclus (= quantité × PRU) */
  cost: Dec;
  /** Plus-values réalisées sur cet ETF */
  realized: Dec;
}

export interface LedgerWarning {
  movementId: string;
  message: string;
}

export interface CashFlowEvent {
  date: ISODate;
  /** + versement (saisi ou déduit), − retrait */
  amount: Dec;
}

export interface LedgerState {
  cash: Dec;
  /** Versements, y compris ceux déduits des achats */
  deposits: Dec;
  /** Part des versements déduite automatiquement des achats */
  implicitDeposits: Dec;
  /** Versements et retraits datés (pour le rendement annualisé) */
  flows: CashFlowEvent[];
  withdrawals: Dec;
  dividends: Dec;
  /** Frais hors courtage (droits de garde…) */
  otherFees: Dec;
  /** Frais de courtage payés (achats et ventes) */
  tradingFees: Dec;
  realized: Dec;
  positions: Map<string, PositionState>;
  warnings: LedgerWarning[];
}

export function emptyLedger(): LedgerState {
  return {
    cash: ZERO,
    deposits: ZERO,
    implicitDeposits: ZERO,
    flows: [],
    withdrawals: ZERO,
    dividends: ZERO,
    otherFees: ZERO,
    tradingFees: ZERO,
    realized: ZERO,
    positions: new Map(),
    warnings: [],
  };
}

export function netDeposits(state: LedgerState): Dec {
  return state.deposits.minus(state.withdrawals);
}

/** Ordre de rejeu : date, puis ordre de saisie. */
export function sortMovements(movements: Movement[]): Movement[] {
  return [...movements].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

function position(state: LedgerState, etfId: string): PositionState {
  let p = state.positions.get(etfId);
  if (!p) {
    p = { etfId, quantity: ZERO, cost: ZERO, realized: ZERO };
    state.positions.set(etfId, p);
  }
  return p;
}

/** Compte comme versement la part d'une dépense que les liquidités ne couvrent pas. */
function fund(state: LedgerState, date: ISODate, amount: Dec): void {
  const available = state.cash.gt(0) ? state.cash : ZERO;
  const shortfall = amount.minus(available);
  if (shortfall.gt(0)) {
    state.deposits = state.deposits.plus(shortfall);
    state.implicitDeposits = state.implicitDeposits.plus(shortfall);
    state.cash = state.cash.plus(shortfall);
    state.flows.push({ date, amount: shortfall });
  }
}

/** Applique un mouvement au grand livre (modifie l'état). */
export function applyMovement(state: LedgerState, m: Movement): void {
  switch (m.kind) {
    case 'deposit': {
      const amount = D(m.amount);
      state.cash = state.cash.plus(amount);
      state.deposits = state.deposits.plus(amount);
      state.flows.push({ date: m.date, amount });
      return;
    }
    case 'withdrawal': {
      const amount = D(m.amount);
      state.cash = state.cash.minus(amount);
      state.withdrawals = state.withdrawals.plus(amount);
      state.flows.push({ date: m.date, amount: amount.times(-1) });
      return;
    }
    case 'dividend': {
      const amount = D(m.amount);
      state.cash = state.cash.plus(amount);
      state.dividends = state.dividends.plus(amount);
      if (m.etfId) position(state, m.etfId);
      return;
    }
    case 'fee': {
      const amount = D(m.amount);
      fund(state, m.date, amount);
      state.cash = state.cash.minus(amount);
      state.otherFees = state.otherFees.plus(amount);
      return;
    }
    case 'buy': {
      if (!m.etfId) return;
      const qty = D(m.quantity);
      const fees = D(m.fees);
      const total = qty.times(D(m.unitPrice)).plus(fees);
      fund(state, m.date, total);
      const p = position(state, m.etfId);
      p.quantity = p.quantity.plus(qty);
      p.cost = p.cost.plus(total);
      state.cash = state.cash.minus(total);
      state.tradingFees = state.tradingFees.plus(fees);
      return;
    }
    case 'sell': {
      if (!m.etfId) return;
      const qty = D(m.quantity);
      const p = position(state, m.etfId);
      if (qty.gt(p.quantity)) {
        state.warnings.push({
          movementId: m.id,
          message: `Vente ignorée : ${qty.toString()} parts vendues pour ${p.quantity.toString()} détenues à cette date.`,
        });
        return;
      }
      const fees = D(m.fees);
      const net = qty.times(D(m.unitPrice)).minus(fees);
      const costOut = p.quantity.eq(0) ? ZERO : p.cost.times(qty).div(p.quantity);
      const gain = net.minus(costOut);
      p.quantity = p.quantity.minus(qty);
      p.cost = p.quantity.eq(0) ? ZERO : p.cost.minus(costOut);
      p.realized = p.realized.plus(gain);
      state.realized = state.realized.plus(gain);
      state.cash = state.cash.plus(net);
      state.tradingFees = state.tradingFees.plus(fees);
      return;
    }
    case 'split': {
      if (!m.etfId) return;
      const ratio = D(m.ratio);
      if (ratio.lte(0)) return;
      const p = position(state, m.etfId);
      p.quantity = p.quantity.times(ratio);
      return;
    }
  }
}

/** Rejoue les mouvements (jusqu'à une date incluse, si fournie). */
export function computeLedger(movements: Movement[], upTo?: ISODate): LedgerState {
  const state = emptyLedger();
  for (const m of sortMovements(movements)) {
    if (upTo && m.date > upTo) break;
    applyMovement(state, m);
  }
  return state;
}

/**
 * Un grand livre par compte, puis leur somme pour la vue Famille.
 * Calculer compte par compte garantit qu'une vente utilise le PRU de son propre PEA.
 */
export function computeLedgers(movements: Movement[], upTo?: ISODate): Map<string, LedgerState> {
  const byAccount = new Map<string, Movement[]>();
  for (const m of movements) {
    const list = byAccount.get(m.accountId) ?? [];
    list.push(m);
    byAccount.set(m.accountId, list);
  }
  const result = new Map<string, LedgerState>();
  for (const [accountId, list] of byAccount) result.set(accountId, computeLedger(list, upTo));
  return result;
}

export function mergeLedgers(states: Iterable<LedgerState>): LedgerState {
  const total = emptyLedger();
  for (const s of states) {
    total.cash = total.cash.plus(s.cash);
    total.deposits = total.deposits.plus(s.deposits);
    total.implicitDeposits = total.implicitDeposits.plus(s.implicitDeposits);
    total.flows.push(...s.flows);
    total.withdrawals = total.withdrawals.plus(s.withdrawals);
    total.dividends = total.dividends.plus(s.dividends);
    total.otherFees = total.otherFees.plus(s.otherFees);
    total.tradingFees = total.tradingFees.plus(s.tradingFees);
    total.realized = total.realized.plus(s.realized);
    total.warnings.push(...s.warnings);
    for (const p of s.positions.values()) {
      const t = position(total, p.etfId);
      t.quantity = t.quantity.plus(p.quantity);
      t.cost = t.cost.plus(p.cost);
      t.realized = t.realized.plus(p.realized);
    }
  }
  return total;
}

/** PRU d'une position, ou null si aucune part détenue. */
export function unitCost(p: PositionState): Dec | null {
  return p.quantity.gt(0) ? p.cost.div(p.quantity) : null;
}
