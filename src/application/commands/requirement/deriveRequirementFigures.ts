import type { PackagingRule } from '../../../domain/cost/quantityEngine';
import { Decimal } from 'decimal.js';
import type { CalculationError } from '../../../core/errors/AppError';
import { sameMoney, type Currency, type Money } from '../../../core/money/Money';
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
 * and on into §51's Cost Pipeline. Legacy area assignments and ADR-0022 contextual source rules share these stages:
 *
 *   zone.geometry → area(polygon)            mm², ADR-009
 *     → toMeasuredQuantity                   mm² → m²
 *     → applyRequirementRule(identity)       coverage rate 1
 *     → applyWaste(required, waste × 100)    THE unit conversion between this slice's
 *                                            fraction-in-[0,1] and the engine's whole
 *                                            percentage points — passing `0.10` straight
 *                                            through would compute ×1.001, silently
 *                                            understating every figure by ~two orders.
 *     → applyPackaging(wasted, rule)         optional lot size and minimum order
 *   effective quantity × unitCost → Estimated Cost (discount/shipping/tax stay no-ops)
 *
 * Both `AssignAssetCommand` (first creation) and `RecalculateRequirementCommand` (every
 * later pass) derive through THIS function — two derivations answering differently is the
 * defect shape this codebase keeps deleting.
 */
export interface DerivedFiguresInput {
	/** `zone.area()`'s output — square world millimeters (ADR-009). */
	readonly zoneAreaMm2: number;
	readonly rawMeasurement?: Decimal;
	readonly quantityOverride?: Quantity;
	readonly coverage?: Decimal;
	readonly packaging?: PackagingRule;
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
	const rawAreaMm2 = input.rawMeasurement ?? new Decimal(input.zoneAreaMm2);
	const measuredZoneArea = toMeasuredQuantity(rawAreaMm2, input.assetUnit);
	if (!measuredZoneArea.ok) return measuredZoneArea;

	const purchase = runQuantityEngine(
		rawAreaMm2,
		input.assetUnit,
		{ coverageRate: input.coverage ?? IDENTITY_COVERAGE },
		// Fraction → whole percentage points: see the header. The one conversion site.
		input.wasteFactor.mul(100),
		// Contextual source packaging uses the same fifth stage; legacy input omits it.
		input.packaging,
	);
	if (!purchase.ok) return purchase;

	const cost = computeEstimatedCost({
		quantity: input.quantityOverride ?? purchase.value.calculated,
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
 *
 * **`unitCost` compares by VALUE, through `sameMoney`, not by string.** `createMoney` stores
 * an amount verbatim, so `19.5` and `19.50` are two spellings of one price — pre-existing
 * since slice 10, and a false mismatch in both directions this predicate serves: the read
 * model reports "stale" for a requirement whose inputs did not move, and `onAssetUpdated`
 * recalculates it — churn and a wrong status badge over an unchanged figure. The per-project
 * price override this parameter now carries (an INPUT the caller resolves, not the asset's
 * own catalogue default) is a SECOND writer of the compared field, and two writers of one
 * compared field is when a by-rendering comparison stops being theoretical.
 */
export function assetMatchesCalculatedFrom(
	calculatedFrom: CalculatedFrom,
	asset: { readonly unitCost: Money; readonly unit: MeasurementUnit },
): boolean {
	return (
		sameMoney(asset.unitCost, calculatedFrom.unitCost) &&
		asset.unit === calculatedFrom.assetUnit
	);
}
