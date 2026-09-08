import { add, subtract, zero, of, round, type Money } from '../../core/money/Money';
import { err, ok, unwrap, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { CostRecord, FinancialFact } from '../renovation/PlanningDepth';
import { validDecimal } from '../requirement/RequirementSource';

export interface CostTotals { planned: Money; committed: Money; actual: Money; openCommitment: Money; remaining: Money }
function costError(): CalculationError { return { category: 'Calculation', code: 'cost.reconciliation-invalid', message: 'The financial facts cannot be reconciled in the project currency.' }; }
/** Every operand is already validated to `currency`, so `add`/`subtract` cannot report a mismatch here. */
function sum(values: readonly Money[], currency: string): Money {
	return round(values.reduce((result, value) => unwrap(add(result, value)), zero(currency)));
}
function total(values: readonly Money[], currency: string): Result<Money, CalculationError> {
	if (values.some(value => !validDecimal(value.amount) || value.currency !== currency)) return err(costError());
	return ok(sum(values, currency));
}
function validFacts(facts: readonly FinancialFact[]): boolean {
 const active = facts.filter(fact => !fact.cancelled);
 const commitments = active.filter(fact => fact.stage === 'committed');
 return new Set(facts.map(fact => fact.id)).size === facts.length
 && active.every(fact => !!fact.id && ['committed', 'actual'].includes(fact.stage) && !(fact.stage === 'committed' && fact.commitmentId))
 && active.every(fact => !fact.commitmentId || commitments.some(commitment => commitment.id === fact.commitmentId));
}
function openTotal(commitments: readonly FinancialFact[], actuals: readonly FinancialFact[], currency: string): Money {
 return sum(commitments.map(commitment => {
  const paid = sum(actuals.filter(fact => fact.commitmentId === commitment.id).map(fact => fact.amount), currency);
  const remaining = unwrap(subtract(commitment.amount, paid));
  return remaining.amount.startsWith('-') ? zero(currency) : remaining;
 }), currency);
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
 const plan = record.cancelled ? of('0', currency) : planned;
 const remaining = unwrap(subtract(unwrap(subtract(plan, actual.value)), openCommitment));
 return ok({ planned: plan, committed: committed.value, actual: actual.value, openCommitment, remaining });
}
