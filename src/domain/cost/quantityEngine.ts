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

export function toMeasuredQuantity(rawValue: Decimal, unit: MeasurementUnit): Quantity {
	return { value: toDisplayValue(rawValue, unit), unit };
}

function negativeQuantity(unit: MeasurementUnit): CalculationError {
	return {
		category: 'Calculation',
		code: 'quantity.negative',
		message: `A ${UNIT_KIND[unit]} quantity cannot be negative.`,
	};
}

export function applyRequirementRule(
	measured: Quantity,
	rule: RequirementRule,
): Result<Quantity, CalculationError> {
	if (measured.value.isNegative()) return err(negativeQuantity(measured.unit));
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
	if (measured.value.isNegative()) return err(negativeQuantity(unit));
	const required = applyRequirementRule(measured, rule);
	if (!required.ok) return required;
	const wasted = applyWaste(required.value, wastePercent);
	if (!wasted.ok) return wasted;
	const purchase = applyPackaging(wasted.value, packaging);
	if (!purchase.ok) return purchase;
	return ok({ calculated: purchase.value });
}
