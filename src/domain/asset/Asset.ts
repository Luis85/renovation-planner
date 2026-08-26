import { Decimal } from 'decimal.js';
import type { ValidationError } from '../../core/errors/AppError';
import { isNegative, type Money } from '../../core/money/Money';
import { err, ok, type Result } from '../../core/result/Result';
import { UNIT_KIND, type MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { ProjectId } from '../project/ProjectId';
import { isAssetCategory, type AssetCategory } from './AssetCategory';
import type { AssetId } from './AssetId';
import { assetError } from './Asset.errors';

export interface CreateAssetProps {
	readonly id: AssetId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly category: AssetCategory;
	readonly supplier?: string | null;
	readonly sku?: string | null;
	readonly unit: MeasurementUnit;
	readonly unitCost: Money;
	/** Fraction in [0, 1] (`0.10` = 10% waste); defaults to 0. */
	readonly wasteFactorDefault?: Decimal;
	readonly notes?: string | null;
}

interface AssetFields {
	readonly id: AssetId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly category: AssetCategory;
	readonly supplier: string | null;
	readonly sku: string | null;
	readonly unit: MeasurementUnit;
	readonly unitCost: Money;
	readonly wasteFactorDefault: Decimal;
	readonly notes: string | null;
}

/**
 * Fraction in [0, 1], closed at both ends — 100% waste (buy twice what you measure) is a
 * real answer for an awkward cut pattern; above `1` is far likelier a percentage entered
 * where a fraction was expected. Shared with the Requirement's own `wasteFactor` field,
 * which lives under the same range and the same reasoning; the error codes are the
 * CALLER's (`asset.*` / `requirement.*`), because one rule with one code shape would
 * otherwise misattribute half its refusals.
 */
export function checkWasteFraction(
	value: Decimal,
	field: string,
	errorOf: (code: string, message: string) => ValidationError,
): Result<Decimal, ValidationError> {
	if (value.isNegative()) {
		return err(errorOf(`negative-${field}`, `A ${field} cannot be negative; got ${value.toString()}.`));
	}
	if (value.greaterThan(1)) {
		return err(
			errorOf(
				`${field}-above-one`,
				`A ${field} is a fraction in [0, 1]; got ${value.toString()}. `
					+ 'A percentage entered where a fraction was expected?',
			),
		);
	}
	return ok(value);
}

/**
 * A reusable catalog item (PRD §8 "Asset", Epic 6) — the INPUT of the quantity/cost
 * pipeline, never itself derived data: nothing about an Asset's own fields is calculated
 * from geometry. Immutable, like every entity here; edits go through `withChanges`, which
 * re-runs the whole smart constructor so a partial patch cannot smuggle an invalid field
 * past the checks it was named after.
 *
 * An Asset owns no geometry and references no Zone — it is catalog data referenced BY ID
 * (design slice 10's Out of scope: placement as a spatial object is later Epic-6 feature
 * work). `supplier` is free text this slice; the Supplier entity is Epic 11.
 */
export class Asset {
	readonly id: AssetId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly category: AssetCategory;
	readonly supplier: string | null;
	readonly sku: string | null;
	readonly unit: MeasurementUnit;
	readonly unitCost: Money;
	readonly wasteFactorDefault: Decimal;
	readonly notes: string | null;

	private constructor(fields: AssetFields) {
		this.id = fields.id;
		this.projectId = fields.projectId;
		this.name = fields.name;
		this.category = fields.category;
		this.supplier = fields.supplier;
		this.sku = fields.sku;
		this.unit = fields.unit;
		this.unitCost = fields.unitCost;
		this.wasteFactorDefault = fields.wasteFactorDefault;
		this.notes = fields.notes;
	}

	static create(props: CreateAssetProps): Result<Asset, ValidationError> {
		const name = props.name.trim();
		if (!name) {
			return err(assetError('empty-name', 'An asset needs a non-empty name.'));
		}
		if (!isAssetCategory(props.category)) {
			return err(assetError('unknown-category', `"${String(props.category)}" is not an asset category.`));
		}
		// Money itself is signed (ADR-010); a unit price is a FIELD that cannot go below
		// zero, so the guard lives here where the field enters — the same split
		// costPipeline.ts makes for its own money inputs.
		if (isNegative(props.unitCost)) {
			return err(
				assetError(
					'negative-unit-cost',
					`A unit cost cannot be negative; got ${props.unitCost.amount} ${props.unitCost.currency}.`,
				),
			);
		}
		const wasteCheck = checkWasteFraction(
			props.wasteFactorDefault ?? new Decimal(0),
			'waste-factor-default',
			assetError,
		);
		if (!wasteCheck.ok) return wasteCheck;

		return ok(
			new Asset({
				id: props.id,
				projectId: props.projectId,
				name,
				category: props.category,
				supplier: props.supplier ?? null,
				sku: props.sku ?? null,
				unit: props.unit,
				unitCost: props.unitCost,
				wasteFactorDefault: props.wasteFactorDefault ?? new Decimal(0),
				notes: props.notes ?? null,
			}),
		);
	}

	/**
	 * Rebuilds through `create`, so every edit re-validates. `id` and `projectId` are
	 * identity and ownership — neither is editable.
	 */
	withChanges(
		changes: Partial<Omit<CreateAssetProps, 'id' | 'projectId'>>,
	): Result<Asset, ValidationError> {
		return Asset.create({
			id: this.id,
			projectId: this.projectId,
			name: changes.name ?? this.name,
			category: changes.category ?? this.category,
			supplier: 'supplier' in changes ? (changes.supplier ?? null) : this.supplier,
			sku: 'sku' in changes ? (changes.sku ?? null) : this.sku,
			unit: changes.unit ?? this.unit,
			unitCost: changes.unitCost ?? this.unitCost,
			wasteFactorDefault: changes.wasteFactorDefault ?? this.wasteFactorDefault,
			notes: 'notes' in changes ? (changes.notes ?? null) : this.notes,
		});
	}

	/**
	 * Whether this Asset can be assigned to a Zone's AREA — the dimension check design
	 * slice 10 fixes at the command, stated once beside the vocabulary it reads. A
	 * hard-coded `'m2'` comparison would silently start rejecting valid assignments the
	 * day `ft2` arrives.
	 */
	isAreaKind(): boolean {
		return UNIT_KIND[this.unit] === 'area';
	}
}
