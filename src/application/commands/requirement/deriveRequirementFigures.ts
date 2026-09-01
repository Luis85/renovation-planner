import { Decimal } from 'decimal.js';
import type { CalculationError } from '../../../core/errors/AppError';
import type { Currency, Money } from '../../../core/money/Money';
import { ok, type Result } from '../../../core/result/Result';
import type { MeasurementUnit, Quantity } from '../../../core/units/MeasurementUnit';
import type { CalculatedFrom } from '../../../domain/requirement/Requirement';
import { computeEstimatedCost } from '../../../domain/cost/costPipeline';
import {
	runQuantityEngine,
	toMeasuredQuantity,
} from '../../../domain/cost/quantityEngine';

/**
 * The one place slice 10's pipeline is WIRED to real data (design slice 10, "The
 * derivation pipeline"): a Zone's polygon area through §50's five Quantity Engine stages
 * and on into §51's Cost Pipeline. The `area` requirement rule only, for an area-kind
 * Asset:
 *
 *   zone.geometry → area(polygon)            mm², ADR-009
 *     → toMeasuredQuantity                   mm² → m²
 *     → applyRequirementRule(identity)       coverage rate 1
 *     → applyWaste(required, waste × 100)    THE unit conversion between this slice's
 *                                            fraction-in-[0,1] and the engine's whole
 *                                            percentage points — passing `0.10` straight
 *                                            through would compute ×1.001, silently
 *                                            understating every figure by ~two orders.
 *     → applyPackaging(wasted, undefined)    present but empty, so "Purchase Quantity"
 *                                            means the same thing here as in slice 9
 *   effective quantity × unitCost → Estimated Cost (discount/shipping/tax stay no-ops)
 *
 * Both `AssignAssetCommand` (first creation) and `RecalculateRequirementCommand` (every
 * later pass) derive through THIS function — two derivations answering differently is the
 * defect shape this codebase keeps deleting.
 */
export interface DerivedFiguresInput {
	/** `zone.area()`'s output — square world millimeters (ADR-009). */
	readonly zoneAreaMm2: number;
	readonly assetUnit: MeasurementUnit;
	readonly unitCost: Money;
	/** Fraction in [0, 1] — the REQUIREMENT's field, not the Asset's default. */
	readonly wasteFactor: Decimal;
	/**
	 * The project's currency, resolved by the CALLER and passed in. It is not looked up
	 * here: a derivation that reached for a repository would be a second answer to what a
	 * Requirement costs, and both callers deliberately route through this one function.
	 */
	readonly expectedCurrency: Currency;
}

export interface DerivedFigures {
	/** The Purchase Quantity — what persists as `requirement.quantity.calculated`. */
	readonly quantity: Quantity;
	readonly estimatedCost: Money;
	/** Persisted beside the figures they produced, in the same save. */
	readonly calculatedFrom: CalculatedFrom;
}

const IDENTITY_COVERAGE = new Decimal(1);

export function deriveRequirementFigures(
	input: DerivedFiguresInput,
): Result<DerivedFigures, CalculationError> {
	const rawAreaMm2 = new Decimal(input.zoneAreaMm2);
	const measuredZoneArea = toMeasuredQuantity(rawAreaMm2, input.assetUnit);
	if (!measuredZoneArea.ok) return measuredZoneArea;

	const purchase = runQuantityEngine(
		rawAreaMm2,
		input.assetUnit,
		{ coverageRate: IDENTITY_COVERAGE },
		// Fraction → whole percentage points: see the header. The one conversion site.
		input.wasteFactor.mul(100),
		// No lot size exists yet (Epic 11's material catalog); explicit so the fifth
		// stage is visibly RUN rather than silently dropped.
		undefined,
	);
	if (!purchase.ok) return purchase;

	const cost = computeEstimatedCost({
		quantity: purchase.value.calculated,
		unitPrice: input.unitCost,
		pricedPer: input.assetUnit,
		expectedCurrency: input.expectedCurrency,
	});
	if (!cost.ok) return cost;

	return ok({
		quantity: purchase.value.calculated,
		estimatedCost: cost.value.calculated,
		calculatedFrom: {
			zoneArea: measuredZoneArea.value,
			unitCost: input.unitCost,
			assetUnit: input.assetUnit,
		},
	});
}

/**
 * Whether an updated Asset still matches what a Requirement's figures were computed FROM —
 * the cascade-skip test AND the read model's staleness backstop share it, because it is
 * the FIRST and only declaration of which Asset fields the pipeline reads. A pipeline that
 * starts reading another Asset field must add it here or the backstop stops working.
 *
 * The unit compares by SYMBOL, not kind: `assetUnit` fixes the dimension of the recorded
 * figures, and an `m2 → ft2` change is exactly as capable of invalidating them as an
 * `m2 → m` one.
 */
export function assetMatchesCalculatedFrom(
	calculatedFrom: CalculatedFrom,
	asset: { readonly unitCost: Money; readonly unit: MeasurementUnit },
): boolean {
	return (
		asset.unitCost.amount === calculatedFrom.unitCost.amount &&
		asset.unitCost.currency === calculatedFrom.unitCost.currency &&
		asset.unit === calculatedFrom.assetUnit
	);
}
