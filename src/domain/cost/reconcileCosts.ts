import { add, subtract, zero, of, round, type Money } from '../../core/money/Money';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { CostRecord, FinancialFact } from '../renovation/PlanningDepth';
import { validDecimal } from '../requirement/RequirementSource';

export interface CostTotals { planned: Money; committed: Money; actual: Money; openCommitment: Money; remaining: Money }
function costError(): CalculationError { return { category: 'Calculation', code: 'cost.reconciliation-invalid', message: 'The financial facts cannot be reconciled in the project currency.' }; }
function total(values: readonly Money[], currency: string): Result<Money, CalculationError> {
	let result = zero(currency);
	for (const value of values) {
		if (!validDecimal(value.amount) || value.currency !== currency) return err(costError());
		const sum = add(result, value);
		if (!sum.ok) return sum;
		result = sum.value;
	}
	return ok(round(result));
}
function validFacts(facts: readonly FinancialFact[]): boolean {
 const active = facts.filter(fact => !fact.cancelled);
 const commitments = active.filter(fact => fact.stage === 'committed');
 return new Set(facts.map(fact => fact.id)).size === facts.length
 && active.every(fact => !!fact.id && ['committed', 'actual'].includes(fact.stage) && !(fact.stage === 'committed' && fact.commitmentId))
 && active.every(fact => !fact.commitmentId || commitments.some(commitment => commitment.id === fact.commitmentId));
}
function openTotal(commitments: readonly FinancialFact[], actuals: readonly FinancialFact[], currency: string): Result<Money, CalculationError> {
 const open: Money[] = [];
 for (const commitment of commitments) {
  const paid = total(actuals.filter(fact => fact.commitmentId === commitment.id).map(fact => fact.amount), currency);
  if (!paid.ok) return paid;
  const remaining = subtract(commitment.amount, paid.value);
  if (!remaining.ok) return remaining;
  open.push(remaining.value.amount.startsWith('-') ? zero(currency) : remaining.value);
 }
 return total(open, currency);
}
/** Stages are facts on ONE obligation. They are displayed separately, never added as spending. */
export function reconcileCosts(record: CostRecord, estimate: Money | null, currency: string): Result<CostTotals, CalculationError> {
 const planned = record.planned ?? estimate;
 if (!planned || !validDecimal(planned.amount) || planned.currency !== currency || !validFacts(record.facts)) return err(costError());
 const active = record.cancelled ? [] : record.facts.filter(fact => !fact.cancelled);
 const commitments = active.filter(fact => fact.stage === 'committed'), actuals = active.filter(fact => fact.stage === 'actual');
 const committed = total(commitments.map(fact => fact.amount), currency), actual = total(actuals.map(fact => fact.amount), currency);
 if (!committed.ok) return committed;
 if (!actual.ok) return actual;
 const openCommitment = openTotal(commitments, actuals, currency);
 if (!openCommitment.ok) return openCommitment;
 const plan = record.cancelled ? of('0', currency) : planned;
 const afterActual = subtract(plan, actual.value);
 if (!afterActual.ok) return afterActual;
 const remaining = subtract(afterActual.value, openCommitment.value);
 return remaining.ok ? ok({ planned: plan, committed: committed.value, actual: actual.value, openCommitment: openCommitment.value, remaining: remaining.value }) : remaining;
}
