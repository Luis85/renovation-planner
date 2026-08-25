import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { DerivedValue } from '../../core/derived/DerivedValue';
import {
	UNIT_KIND,
	type MeasurementUnit,
	type Quantity,
} from '../../core/units/MeasurementUnit';
import { negativeQuantity } from './quantityEngine';
import {
	add,
	isNegative,
	percentageOf,
	round,
	scale,
	subtract,
	zero,
	type Money,
} from '../../core/money/Money';

/**
 * The Cost Pipeline (SDD §51): Purchase Quantity → Unit Price → Discount → Shipping →
 * Surcharge → Tax → Estimated Cost, as a pure composition over `Money`. The order is
 * FIXED by §51 and ADR-012, not configurable: discount is computed before shipping is
 * added (shipping is not discounted); surcharge sits where shipping does — additive,
 * taxable, not discountable; tax is computed over the post-shipping, post-surcharge
 * total. `contingency` and `deposit` are deliberately NOT read here (ADR-012 places
 * them outside the chain).
 *
 * `computeEstimatedCost` is the single entry point; the stages above are private so a
 * caller cannot skip or reorder them. No intermediate value is rounded to the currency's
 * minor unit between stages (ADR-010) — `round` runs exactly once, where the estimate is
 * finalized. What "precision" means underneath that is `core/money`'s to state, and it is
 * a bounded number of significant digits rather than "full".
 *
 * Every input is refused BEFORE any arithmetic runs (`inputError`): a mismatched pricing
 * basis, a negative quantity, a negative or above-100% discount, a negative tax rate, and
 * a negative unit price, shipping charge or surcharge. All of them are user input, so all
 * of them are a typed `CalculationError` and never a thrown exception (SDD §65).
 *
 * Those money guards are where non-negativity lives now, and they are NOT redundant with
 * `core/money`: a `Money` is a signed quantity — a budget variance goes below zero and
 * that is its answer — so the type enforces nothing and each FIELD that cannot go below
 * zero is refused where it enters. Together they are why no stage here can produce a
 * negative estimate, which is a guarantee of this pipeline over its own inputs rather
 * than of the value type.
 */
export interface DiscountRule {
	readonly percent: Decimal;
}

export interface CostPipelineInput {
	/** The effective Purchase Quantity (`effectiveValue`, so an override flows forward). */
	readonly quantity: Quantity;
	/** Priced PER ONE of `quantity.unit` unless `pricedPer` says otherwise. */
	readonly unitPrice: Money;
	/**
	 * What `unitPrice` is priced per, when the caller KNOWS it — slice 10 supplies it
	 * from the Asset's persisted unit. Declaring it buys a check: a different UNIT KIND
	 * than the quantity's (a length price on an area quantity) is a CalculationError.
	 * Omitted, no basis check runs — an area price per piece and per m² both "work".
	 */
	readonly pricedPer?: MeasurementUnit;
	readonly discount?: DiscountRule;
	readonly shipping?: Money;
	/** ADR-012 — additive with shipping, before tax, not discountable. */
	readonly surcharge?: Money;
	/** Percent of the post-shipping, post-surcharge total. */
	readonly taxRate?: Decimal;
}

const NO_PERCENT = new Decimal('0');
const FULL_DISCOUNT = new Decimal('100');

function optionalMoney(value: Money | undefined, currency: string): Money {
	return value ?? zero(currency);
}

function negativePercent(percent: Decimal): CalculationError | null {
	if (!percent.isNegative()) return null;
	return {
		category: 'Calculation',
		code: 'cost.negative-percent',
		message:
			'A discount or tax rate cannot be negative; a negative rate would move money in '
			+ `the wrong direction. Got ${percent.toString()}.`,
	};
}

function pricingBasisError(input: CostPipelineInput): CalculationError | null {
	if (!input.pricedPer || UNIT_KIND[input.pricedPer] === UNIT_KIND[input.quantity.unit]) {
		return null;
	}
	return {
		category: 'Calculation',
		code: 'cost.pricing-basis-mismatch',
		message: `The unit price is ${UNIT_KIND[input.pricedPer]}-based but the quantity `
			+ `is ${UNIT_KIND[input.quantity.unit]}-based (${input.pricedPer} vs ${input.quantity.unit}).`,
	};
}

/**
 * A percent is bounded at BOTH ends here, and only for the discount at the top: the
 * discount is the one component that SUBTRACTS, so it is the only one a percentage can
 * drive below zero, and 150% off produced a negative cost reported as a success. A tax
 * rate above 100% is merely surprising — it still adds — so bounding it would refuse data
 * that is odd rather than wrong. Exactly 100% is a free line, not an error.
 */
function discountError(discount: DiscountRule | undefined): CalculationError | null {
	if (!discount) return null;
	const negative = negativePercent(discount.percent);
	if (negative) return negative;
	if (!discount.percent.greaterThan(FULL_DISCOUNT)) return null;
	return {
		category: 'Calculation',
		code: 'cost.discount-above-full',
		message:
			`A discount cannot exceed 100%; got ${discount.percent.toString()}%, which would `
			+ 'turn a cost into a credit.',
	};
}

/**
 * The money inputs that cannot be negative, named one at a time because the message has
 * to say WHICH field was refused — one rule, one code, and the field in the text (the
 * shape `negativeQuantity` already uses).
 *
 * `Money` itself is signed: a difference legitimately goes below zero, so `core/money`
 * enforces nothing and every field that must not is guarded where it enters. These three
 * are that guard for the pipeline. Absent is not negative — an omitted shipping charge is
 * `zero`, not a refusal.
 */
function negativeAmount(label: string, value: Money | undefined): CalculationError | null {
	if (!value || !isNegative(value)) return null;
	return {
		category: 'Calculation',
		code: 'cost.negative-amount',
		message:
			`A ${label} cannot be negative; got ${value.amount} ${value.currency}. `
			+ 'A credit is not a cost component.',
	};
}

/**
 * Everything refused BEFORE any arithmetic runs, so no stage can be handed a value that
 * would drive the total negative. Together these are what make the estimate this pipeline
 * produces non-negative — a guarantee of the PIPELINE, over its own inputs, rather than of
 * the `Money` type, which is signed. User input is refused here, as a value; nothing on
 * this path throws.
 */
function inputError(input: CostPipelineInput): CalculationError | null {
	return (
		pricingBasisError(input)
		?? negativeQuantity(input.quantity)
		?? discountError(input.discount)
		?? (input.taxRate ? negativePercent(input.taxRate) : null)
		?? negativeAmount('unit price', input.unitPrice)
		?? negativeAmount('shipping charge', input.shipping)
		?? negativeAmount('surcharge', input.surcharge)
	);
}

export function computeEstimatedCost(
	input: CostPipelineInput,
): Result<DerivedValue<Money>, CalculationError> {
	const invalid = inputError(input);
	if (invalid) return err(invalid);
	const currency = input.unitPrice.currency;
	const subtotal = scale(input.unitPrice, input.quantity.value);
	const afterDiscount = subtract(
		subtotal,
		percentageOf(subtotal, input.discount?.percent ?? NO_PERCENT),
	);
	if (!afterDiscount.ok) return afterDiscount;
	const afterShipping = add(afterDiscount.value, optionalMoney(input.shipping, currency));
	if (!afterShipping.ok) return afterShipping;
	const afterSurcharge = add(afterShipping.value, optionalMoney(input.surcharge, currency));
	if (!afterSurcharge.ok) return afterSurcharge;
	const taxed = add(
		afterSurcharge.value,
		percentageOf(afterSurcharge.value, input.taxRate ?? NO_PERCENT),
	);
	if (!taxed.ok) return taxed;
	return ok({ calculated: round(taxed.value) });
}
