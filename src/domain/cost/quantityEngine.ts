import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError } from '../../core/errors/AppError';
import type { DerivedValue } from '../../core/derived/DerivedValue';
import { UNIT_KIND, type MeasurementUnit, type Quantity } from '../../core/units/MeasurementUnit';

/**
 * The Quantity Engine (SDD §50): Geometry → Measured Quantity → Requirement Rule →
 * Required Quantity → Waste → Purchase Quantity. Four pure stages plus one composition —
 * each stage is exported and independently testable; `runQuantityEngine` is the only
 * thing that orders them.
 *
 * This is a domain SERVICE with no entity of its own (§7.2): it does not know what a
 * Zone, an Asset or a Requirement is. `RequirementRule`/`PackagingRule` are plain data
 * shapes slice 10 builds from a real Requirement's configuration; no material catalog
 * exists yet to supply lot sizes, so `applyPackaging`'s rule is optional and absent
 * passes the quantity through unchanged.
 *
 * Raw measurements arrive in world millimeters (ADR-009) and are converted once, at the
 * first stage (`toMeasuredQuantity`). Every value is decimal.js exact (ADR-010); nothing
 * here rounds — packaging rounds UP to whole lots because it is a purchasable multiple,
 * not a precision decision.
 *
 * No exported stage here returns a negative `Quantity`: each refuses one on the way in,
 * and `toMeasuredQuantity` refuses one on the way out, so the invariant does not depend
 * on which door a caller enters at (`negativeQuantity`).
 */

/** "1 unit of the asset covers `coverageRate` of the measured quantity's unit." */
export interface RequirementRule {
	readonly coverageRate: Decimal;
}

/** Purchasable multiples: whole lots, optionally a minimum order. */
export interface PackagingRule {
	readonly lotSize: Decimal;
	readonly minimumOrder?: Decimal;
}

const MM_PER_M = new Decimal('1000');

/** mm/mm²/mm³ → m/m²/m³ for the units that measure geometry; the rest pass through. */
function toDisplayValue(rawValue: Decimal, unit: MeasurementUnit): Decimal {
	switch (unit) {
		case 'm':
			return rawValue.div(MM_PER_M);
		case 'm2':
			return rawValue.div(MM_PER_M.pow(2));
		case 'm3':
			return rawValue.div(MM_PER_M.pow(3));
		case 'fixed':
			return new Decimal('1');
		default:
			return rawValue;
	}
}

/**
 * The one rule about a negative quantity, applied at every door rather than at the one a
 * caller happens to use: every exported stage here refuses one, and the Cost Pipeline
 * refuses the quantity it is handed with this same function — one rule with two error
 * codes would be two rules, and a caller could not tell which one it had broken.
 *
 * `lessThan(0)` rather than `isNegative()`: decimal.js reports negative ZERO as negative
 * (`new Decimal(0).mul(-1)`), and a zero quantity is a legitimate one.
 */
export function negativeQuantity(quantity: Quantity): CalculationError | null {
	if (!quantity.value.lessThan(0)) return null;
	return {
		category: 'Calculation',
		code: 'quantity.negative',
		message:
			`A ${UNIT_KIND[quantity.unit]} quantity cannot be negative; `
			+ `got ${quantity.value.toString()} ${quantity.unit}.`,
	};
}

export function toMeasuredQuantity(
	rawValue: Decimal,
	unit: MeasurementUnit,
): Result<Quantity, CalculationError> {
	const measured: Quantity = { value: toDisplayValue(rawValue, unit), unit };
	const negative = negativeQuantity(measured);
	return negative ? err(negative) : ok(measured);
}

export function applyRequirementRule(
	measured: Quantity,
	rule: RequirementRule,
): Result<Quantity, CalculationError> {
	const negative = negativeQuantity(measured);
	if (negative) return err(negative);
	if (rule.coverageRate.isZero()) {
		return err({
			category: 'Calculation',
			code: 'quantity.zero-coverage-rate',
			message: 'A coverage rate of zero divides by zero.',
		});
	}
	if (rule.coverageRate.isNegative()) {
		return err({
			category: 'Calculation',
			code: 'quantity.negative-coverage-rate',
			message:
				'A negative coverage rate would flow a negative purchase through every later stage.',
		});
	}
	return ok({ value: measured.value.div(rule.coverageRate), unit: measured.unit });
}

export function applyWaste(
	required: Quantity,
	wastePercent: Decimal,
): Result<Quantity, CalculationError> {
	const negative = negativeQuantity(required);
	if (negative) return err(negative);
	if (wastePercent.isNegative()) {
		return err({
			category: 'Calculation',
			code: 'quantity.negative-waste',
			message: `A waste percentage cannot be negative; got ${wastePercent.toString()}.`,
		});
	}
	return ok({ value: required.value.mul(wastePercent.div(100).plus(1)), unit: required.unit });
}

function packagingRuleError(packaging: PackagingRule): CalculationError | null {
	const bad =
		packaging.lotSize.lessThanOrEqualTo(0) ||
		(packaging.minimumOrder ? packaging.minimumOrder.lessThanOrEqualTo(0) : false);
	if (!bad) return null;
	return {
		category: 'Calculation',
		code: 'quantity.invalid-packaging',
		message:
			'A lot size and a minimum order must both be positive; got '
			+ `lotSize ${packaging.lotSize.toString()}`
			+ (packaging.minimumOrder ? `, minimumOrder ${packaging.minimumOrder.toString()}.` : '.'),
	};
}

/**
 * Rounds up to the next whole multiple of `lotSize`, then up again to `minimumOrder` if
 * still below it — so a zero requirement buys the minimum order, which is what a real
 * supplier charges. No rule → the wasted quantity passes through unchanged (there is no
 * silent default lot size).
 *
 * The rule is validated rather than trusted: `lotSize <= 0` would divide by zero (a
 * thrown DecimalError escaping the Result model) or round DOWN to a plausible-looking
 * purchase, and a non-positive `minimumOrder` is silently ignored at best.
 */
export function applyPackaging(
	quantity: Quantity,
	packaging?: PackagingRule,
): Result<Quantity, CalculationError> {
	const negative = negativeQuantity(quantity);
	if (negative) return err(negative);
	if (!packaging) return ok(quantity);
	const invalid = packagingRuleError(packaging);
	if (invalid) return err(invalid);
	const lots = quantity.value.div(packaging.lotSize).ceil();
	let purchase = lots.mul(packaging.lotSize);
	if (packaging.minimumOrder && purchase.lessThan(packaging.minimumOrder)) {
		purchase = packaging.minimumOrder;
	}
	return ok({ value: purchase, unit: quantity.unit });
}

export function runQuantityEngine(
	rawValue: Decimal,
	unit: MeasurementUnit,
	rule: RequirementRule,
	wastePercent: Decimal,
	packaging?: PackagingRule,
): Result<DerivedValue<Quantity>, CalculationError> {
	const measured = toMeasuredQuantity(rawValue, unit);
	if (!measured.ok) return measured;
	const required = applyRequirementRule(measured.value, rule);
	if (!required.ok) return required;
	const wasted = applyWaste(required.value, wastePercent);
	if (!wasted.ok) return wasted;
	const purchase = applyPackaging(wasted.value, packaging);
	if (!purchase.ok) return purchase;
	return ok({ calculated: purchase.value });
}
