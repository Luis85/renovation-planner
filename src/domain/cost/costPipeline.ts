import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { DerivedValue } from '../../core/derived/DerivedValue';
import {
	UNIT_KIND,
	type MeasurementUnit,
	type Quantity,
} from '../../core/units/MeasurementUnit';
import {
	add,
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
 * caller cannot skip or reorder them. Intermediate values keep full decimal.js
 * precision (ADR-010) — `round` runs exactly once, where the estimate is finalized.
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

export function computeEstimatedCost(
	input: CostPipelineInput,
): Result<DerivedValue<Money>, CalculationError> {
	if (
		input.pricedPer &&
		UNIT_KIND[input.pricedPer] !== UNIT_KIND[input.quantity.unit]
	) {
		return err({
			category: 'Calculation',
			code: 'cost.pricing-basis-mismatch',
			message: `The unit price is ${UNIT_KIND[input.pricedPer]}-based but the quantity `
				+ `is ${UNIT_KIND[input.quantity.unit]}-based (${input.pricedPer} vs ${input.quantity.unit}).`,
		});
	}
	const badDiscount = input.discount ? negativePercent(input.discount.percent) : null;
	if (badDiscount) return err(badDiscount);
	const badTax = input.taxRate ? negativePercent(input.taxRate) : null;
	if (badTax) return err(badTax);
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
