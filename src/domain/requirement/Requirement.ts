import type { Decimal } from 'decimal.js';
import type { ValidationError } from '../../core/errors/AppError';
import type { DerivedValue } from '../../core/derived/DerivedValue';
import type { Money } from '../../core/money/Money';
import { err, ok, type Result } from '../../core/result/Result';
import type { MeasurementUnit, Quantity } from '../../core/units/MeasurementUnit';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from '../asset/AssetId';
import { checkWasteFraction } from '../asset/Asset';
import { requirementError } from './Requirement.errors';
import type { RequirementId } from './RequirementId';
import type { RequirementOrigin } from './RequirementOrigin';

/**
 * What the figures were computed FROM — the two inputs that live outside the Requirement
 * (the Zone's area, the Asset's price) plus the Asset's unit, which fixes their DIMENSION
 * rather than merely their magnitude: area and unit cost can both be byte-identical across
 * an `m2 → m` change, so a two-field snapshot would compare equal over a quantity that is
 * no longer dimensionally meaningful. Written by `RecalculateRequirementCommand` in the
 * same save as the figures they produced — never when writes are not working.
 */
export interface CalculatedFrom {
	readonly zoneArea: Quantity;
	readonly unitCost: Money;
	readonly assetUnit: MeasurementUnit;
}

export interface CreateRequirementProps {
	readonly id: RequirementId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly origin: RequirementOrigin;
	/** Copied from `Asset.unit` at creation by `AssignAssetCommand`. */
	readonly unit: MeasurementUnit;
	/** Fraction in [0, 1]; defaulted from `Asset.wasteFactorDefault`, editable per-requirement. */
	readonly wasteFactor: Decimal;
	readonly quantity: DerivedValue<Quantity>;
	readonly estimatedCost: DerivedValue<Money>;
	readonly calculatedFrom: CalculatedFrom;
	readonly recalculationStatus?: RecalculationStatus;
	readonly requiredDate?: string | null;
}

export type RecalculationStatus = 'current' | 'stale';

interface RequirementFields {
	readonly id: RequirementId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly origin: RequirementOrigin;
	readonly unit: MeasurementUnit;
	readonly wasteFactor: Decimal;
	readonly quantity: DerivedValue<Quantity>;
	readonly estimatedCost: DerivedValue<Money>;
	readonly calculatedFrom: CalculatedFrom;
	readonly recalculationStatus: RecalculationStatus;
	readonly requiredDate: string | null;
}

const RECALCULATION_STATUSES: readonly RecalculationStatus[] = ['current', 'stale'];

function withoutOverride<T>(value: DerivedValue<T>): DerivedValue<T> {
	const { calculated } = value;
	return { calculated };
}

/**
 * The entity that turns "a Zone has this much area" and "this Asset costs this much per
 * unit" into a quantity and an estimated cost (PRD §32). Immutable; every mutation below
 * re-runs the smart constructor so a partial change cannot bypass validation.
 *
 * Two properties carry the whole stale-value design:
 *
 * - `recalculationStatus` is PERSISTED, not derived — it is exactly the flag that must
 *   survive a failed recalculation so no surface ever presents a stale value as current.
 * - `quantity` / `estimatedCost` are `DerivedValue<T>` (§52) overridden INDEPENDENTLY:
 *   an override is a user's answer sitting beside a derived figure, never a claim about
 *   the derivation, so neither override touches `calculated` or marks the entity stale.
 */
export class Requirement {
	readonly id: RequirementId;
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
	readonly origin: RequirementOrigin;
	readonly unit: MeasurementUnit;
	readonly wasteFactor: Decimal;
	readonly quantity: DerivedValue<Quantity>;
	readonly estimatedCost: DerivedValue<Money>;
	readonly calculatedFrom: CalculatedFrom;
	readonly recalculationStatus: RecalculationStatus;
	readonly requiredDate: string | null;

	private constructor(fields: RequirementFields) {
		this.id = fields.id;
		this.projectId = fields.projectId;
		this.assetId = fields.assetId;
		this.origin = fields.origin;
		this.unit = fields.unit;
		this.wasteFactor = fields.wasteFactor;
		this.quantity = fields.quantity;
		this.estimatedCost = fields.estimatedCost;
		this.calculatedFrom = fields.calculatedFrom;
		this.recalculationStatus = fields.recalculationStatus;
		this.requiredDate = fields.requiredDate;
	}

	static create(props: CreateRequirementProps): Result<Requirement, ValidationError> {
		if (props.origin.kind !== 'zone') {
			return err(
				requirementError('unknown-origin-kind', `"${String(props.origin.kind)}" is not a requirement origin kind.`),
			);
		}
		const wasteCheck = checkWasteFraction(props.wasteFactor, 'waste-factor', requirementError);
		if (!wasteCheck.ok) return wasteCheck;
		const status = props.recalculationStatus ?? 'current';
		if (!RECALCULATION_STATUSES.includes(status)) {
			return err(requirementError('unknown-status', `"${String(status)}" is not a recalculation status.`));
		}
		const requiredDate = props.requiredDate ?? null;
		if (requiredDate !== null && Number.isNaN(Date.parse(requiredDate))) {
			return err(
				requirementError('invalid-required-date', `"${requiredDate}" is not an ISO date.`),
			);
		}
		return ok(
			new Requirement({
				id: props.id,
				projectId: props.projectId,
				assetId: props.assetId,
				origin: props.origin,
				unit: props.unit,
				wasteFactor: props.wasteFactor,
				quantity: props.quantity,
				estimatedCost: props.estimatedCost,
				calculatedFrom: props.calculatedFrom,
				recalculationStatus: status,
				requiredDate,
			}),
		);
	}

	private with(fields: Partial<RequirementFields>): Result<Requirement, ValidationError> {
		return Requirement.create({
			id: this.id,
			projectId: this.projectId,
			assetId: fields.assetId ?? this.assetId,
			origin: fields.origin ?? this.origin,
			unit: fields.unit ?? this.unit,
			wasteFactor: fields.wasteFactor ?? this.wasteFactor,
			quantity: fields.quantity ?? this.quantity,
			estimatedCost: fields.estimatedCost ?? this.estimatedCost,
			calculatedFrom: fields.calculatedFrom ?? this.calculatedFrom,
			recalculationStatus: fields.recalculationStatus ?? this.recalculationStatus,
			requiredDate: 'requiredDate' in fields ? (fields.requiredDate ?? null) : this.requiredDate,
		});
	}

	withWasteFactor(wasteFactor: Decimal): Result<Requirement, ValidationError> {
		return this.with({ wasteFactor });
	}

	/**
	 * Sets or clears ONE override independently of the other (`null` clears — and `null`
	 * is a VALUE here, not an absence: undoing a reset must restore the figure that was
	 * cleared). Neither touches `calculated`, `calculatedFrom` or the status.
	 */
	withQuantityOverride(override: Quantity | null): Result<Requirement, ValidationError> {
		return this.with({
			quantity: override ? { ...this.quantity, override } : withoutOverride(this.quantity),
		});
	}

	withCostOverride(override: Money | null): Result<Requirement, ValidationError> {
		return this.with({
			estimatedCost: override
				? { ...this.estimatedCost, override }
				: withoutOverride(this.estimatedCost),
		});
	}

	/**
	 * Replaces the CALCULATED cost only — how a quantity-override edit keeps
	 * `estimatedCost.calculated` correct against its new effective quantity without
	 * touching a user override or claiming a recalculation happened (the status and
	 * `calculatedFrom` stay exactly as they were).
	 */
	withCalculatedCost(calculated: Money): Result<Requirement, ValidationError> {
		return this.with({
			estimatedCost: { calculated, ...(this.estimatedCost.override ? { override: this.estimatedCost.override } : {}) },
		});
	}

	/**
	 * The recalculation result, persisted TOGETHER with the inputs it was produced from —
	 * always written when writes are working, never when they are not. Clears the stale
	 * marker: only a successful recalculation may do that.
	 */
	withRecalculation(quantity: Quantity, estimatedCost: Money, calculatedFrom: CalculatedFrom): Result<Requirement, ValidationError> {
		return this.with({
			quantity: { calculated: quantity },
			estimatedCost: { calculated: estimatedCost },
			calculatedFrom,
			recalculationStatus: 'current',
		});
	}

	/** The durable fact "these numbers are no longer trustworthy". One-directional by design. */
	markedStale(): Result<Requirement, ValidationError> {
		return this.with({ recalculationStatus: 'stale' });
	}

	/**
	 * Repoints the reference at another Zone or Asset and marks stale in the SAME step —
	 * replacing either value replaces exactly what every figure on this entity was derived
	 * from, which is an input change like a geometry edit or a price edit, and owes the
	 * same marker the other two pay before any recalculation runs.
	 */
	repointedTo(origin: RequirementOrigin, assetId: AssetId): Result<Requirement, ValidationError> {
		return this.with({ origin, assetId, recalculationStatus: 'stale' });
	}
}

