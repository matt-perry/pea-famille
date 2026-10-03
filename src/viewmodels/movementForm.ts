/**
 * Validation et récapitulatif en direct du formulaire de mouvement.
 * Toute la logique vient du moteur : la vue ne fait qu'afficher.
 */
import {
  computeLedger,
  D,
  ETF_KINDS,
  parseDecimal,
  todayParis,
  unitCost,
  type Dec,
  type ISODate,
  type Movement,
  type MovementKind,
} from '../core';

export interface MovementDraft {
  kind: MovementKind;
  accountId: string;
  etfId: string;
  date: ISODate;
  quantity: string;
  unitPrice: string;
  fees: string;
  amount: string;
  ratio: string;
  note: string;
}

export interface FormCheck {
  errors: string[];
  warnings: string[];
  movement: Movement | null;
  summary: { label: string; value: Dec | string; kind: 'eur' | 'qty' | 'price' | 'text' }[];
}

const needsQuantity = (k: MovementKind) => k === 'buy' || k === 'sell';
const needsAmount = (k: MovementKind) => k === 'deposit' || k === 'withdrawal' || k === 'dividend' || k === 'fee';

export function checkMovement(
  draft: MovementDraft,
  allMovements: Movement[],
  editing: Movement | null,
  now: Date = new Date(),
): FormCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: FormCheck['summary'] = [];

  if (!draft.accountId) errors.push('Choisis un compte.');
  if (!draft.date) errors.push('Indique une date.');
  else if (draft.date > todayParis(now)) errors.push('La date est dans le futur.');
  if (ETF_KINDS.includes(draft.kind) && !draft.etfId) errors.push('Choisis un ETF.');

  const qty = parseDecimal(draft.quantity);
  const price = parseDecimal(draft.unitPrice);
  const fees = draft.fees.trim() === '' ? D(0) : parseDecimal(draft.fees);
  const amount = parseDecimal(draft.amount);
  const ratio = parseDecimal(draft.ratio);

  if (needsQuantity(draft.kind)) {
    if (!qty || qty.lte(0)) errors.push('Quantité : nombre positif attendu (ex. 5 ou 2,5).');
    if (!price || price.lte(0)) errors.push('Prix unitaire : nombre positif attendu (ex. 6,31).');
    if (!fees || fees.lt(0)) errors.push('Frais : nombre positif ou zéro.');
  }
  if (needsAmount(draft.kind) && (!amount || amount.lte(0))) errors.push('Montant : nombre positif attendu (ex. 500).');
  if (draft.kind === 'split' && (!ratio || ratio.lte(0))) errors.push('Ratio : nombre positif attendu (ex. 10 pour 1 part → 10).');

  if (errors.length > 0) return { errors, warnings, movement: null, summary };

  const movement: Movement = {
    id: editing?.id ?? '',
    accountId: draft.accountId,
    etfId: ETF_KINDS.includes(draft.kind) ? draft.etfId : undefined,
    kind: draft.kind,
    date: draft.date,
    quantity: needsQuantity(draft.kind) ? qty!.toString() : undefined,
    unitPrice: needsQuantity(draft.kind) ? price!.toString() : undefined,
    fees: needsQuantity(draft.kind) ? fees!.toString() : undefined,
    amount: needsAmount(draft.kind) ? amount!.toString() : undefined,
    ratio: draft.kind === 'split' ? ratio!.toString() : undefined,
    note: draft.note.trim() || undefined,
    createdAt: editing?.createdAt ?? now.getTime(),
  };

  // État du compte juste avant ce mouvement, puis juste après.
  const others = allMovements.filter((m) => m.accountId === draft.accountId && m.id !== editing?.id);
  const earlier = others.filter((m) => m.date < draft.date || (m.date === draft.date && m.createdAt < movement.createdAt));
  const before = computeLedger(earlier);
  const after = computeLedger([...earlier, movement]);
  const posBefore = movement.etfId ? before.positions.get(movement.etfId) : undefined;
  const posAfter = movement.etfId ? after.positions.get(movement.etfId) : undefined;

  if (draft.kind === 'buy' || draft.kind === 'sell') {
    const gross = qty!.times(price!);
    summary.push({ label: 'Montant', value: gross, kind: 'eur' });
    summary.push({
      label: draft.kind === 'buy' ? 'Total avec frais' : 'Net reçu',
      value: draft.kind === 'buy' ? gross.plus(fees!) : gross.minus(fees!),
      kind: 'eur',
    });
  }
  if (draft.kind === 'sell') {
    const held = posBefore?.quantity ?? D(0);
    if (qty!.gt(held)) {
      errors.push(`Tu ne détiens que ${held.toString().replace('.', ',')} part(s) à cette date.`);
      return { errors, warnings, movement: null, summary };
    }
    summary.push({ label: 'Plus-value réalisée', value: after.realized.minus(before.realized), kind: 'eur' });
  }
  if (posAfter && draft.kind !== 'dividend') {
    summary.push({ label: 'Parts détenues après', value: posAfter.quantity, kind: 'qty' });
    const pru = unitCost(posAfter);
    if (pru) summary.push({ label: 'PRU après', value: pru, kind: 'price' });
  }
  const deducted = after.implicitDeposits.minus(before.implicitDeposits);
  if (deducted.gt(0)) summary.push({ label: 'Versement déduit', value: deducted, kind: 'eur' });
  summary.push({ label: 'Liquidités après', value: after.cash, kind: 'eur' });

  if (after.cash.lt(0)) {
    warnings.push('Ce retrait dépasse les liquidités du PEA à cette date.');
  }
  // Vérifie aussi que les ventes ultérieures restent possibles.
  const full = computeLedger([...others, movement]);
  if (full.warnings.length > 0) warnings.push(full.warnings[0].message);

  return { errors, warnings, movement, summary };
}

export function draftFromMovement(m: Movement): MovementDraft {
  const fr = (v?: string) => (v ? v.replace('.', ',') : '');
  return {
    kind: m.kind,
    accountId: m.accountId,
    etfId: m.etfId ?? '',
    date: m.date,
    quantity: fr(m.quantity),
    unitPrice: fr(m.unitPrice),
    fees: fr(m.fees),
    amount: fr(m.amount),
    ratio: fr(m.ratio),
    note: m.note ?? '',
  };
}
