import { Decimal } from 'decimal.js';
import { err, isErr, isOk, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import { effectiveValue } from '../../core/derived/DerivedValue';
import type { Money } from '../../core/money/Money';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { CalculatedFrom, Requirement } from '../../domain/requirement/Requirement';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { AssetRepository } from '../ports/AssetRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { Loaded } from '../ports/versioning';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { Query } from './Query';
import { toMeasuredQuantity } from '../../domain/cost/quantityEngine';

/**
 * The row the Requirements panel renders. `assetName: string | null` and
 * `missingTarget: 'asset' | null` are what make a requirement whose ASSET is gone
 * renderable at all — typed `string`, the query could not build the row, and the stale
 * warning would be unreachable for exactly the requirements that most need it. Only the
 * Asset end is representable: every query building this DTO is scoped to a Zone, so a
 * requirement whose zone is gone never reaches a row (the union gains 'zone' with the
 * project-level surface that can produce it).
 */
export interface RequirementInspectorDTO {
	requirementId: RequirementId;
	assetId: string;
	assetName: string | null;
	missingTarget: 'asset' | null;
	unit: MeasurementUnit;
	wasteFactor: Decimal;
	quantity: {
		calculated: Decimal;
		override: Decimal | null;
		effective: Decimal;
	};
	cost: {
		calculated: Money;
		override: Money | null;
		effective: Money;
	};
	/**
	 * Reported "stale" when the persisted marker says so, when `calculatedFrom` does not
	 * match the loaded zone and asset, or when the target is missing — never "current"
	 * for a figure this query cannot re-derive. One-way: a persisted "stale" stays stale
	 * even if the inputs happen to match again.
	 */
	recalculationStatus: 'current' | 'stale';
}

/**
 * The read-model backstop, on PERSISTED values: the area is recomputed through the same
 * pipeline step (`toMeasuredQuantity`) and rounding that produced the stored figure — a
 * comparison at a finer precision than the pipeline uses would report drift the pipeline
 * could not have produced, and every requirement would read permanently stale. The unit
 * compares by SYMBOL against `calculatedFrom.assetUnit`: it fixes the figures' dimension,
 * which is exactly what an `m2 → m` hand edit changes while leaving the numbers alone.
 */
function inputsStillMatch(
	recordedFrom: CalculatedFrom,
	currentAreaMm2: Result<number, unknown>,
	asset: { unit: MeasurementUnit; unitCost: Money },
): boolean {
	if (!isOk(currentAreaMm2)) return false;
	const measured = toMeasuredQuantity(new Decimal(currentAreaMm2.value), recordedFrom.assetUnit);
	if (!measured.ok) return false;
	return (
		measured.value.value.equals(recordedFrom.zoneArea.value) &&
		asset.unit === recordedFrom.assetUnit &&
		asset.unitCost.amount === recordedFrom.unitCost.amount &&
		asset.unitCost.currency === recordedFrom.unitCost.currency
	);
}

/**
 * The one-way staleness reading: the persisted marker, a missing endpoint, or a
 * calculatedFrom mismatch — any one of the three reads "stale", and nothing here can
 * move a persisted "stale" back to "current" (only RecalculateRequirementCommand's own
 * successful save clears the marker).
 */
function isStaleReading(
	r: Requirement,
	zone: { area(): Result<number, unknown> } | null,
	asset: { unit: MeasurementUnit; unitCost: Money } | null,
): boolean {
	if (r.recalculationStatus === 'stale') return true;
	if (asset === null || zone === null) return true;
	return !inputsStillMatch(r.calculatedFrom, zone.area(), asset);
}

export class GetRequirementsForZone
	implements
			Query<ZoneId, Result<RequirementInspectorDTO[], RepositoryError>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly zones: ZoneRepository,
		private readonly assets: AssetRepository,
	) {}

	async execute(zoneId: ZoneId): Promise<Result<RequirementInspectorDTO[], RepositoryError>> {
		const listed = await this.requirements.listByZone(zoneId);
		if (isErr(listed)) return listed;

		const rows: RequirementInspectorDTO[] = [];
		for (const loaded of listed.value) {
			const row = await this.buildRow(loaded.entity);
			if (isErr(row)) return row;
			rows.push(row.value);
		}
		return ok(rows);
	}

	private async buildRow(
		r: Requirement,
	): Promise<Result<RequirementInspectorDTO, RepositoryError>> {
		const asset = await this.assets.getById(r.assetId);
		if (isErr(asset)) return err(asset.error);
		const assetEntity = asset.value?.entity ?? null;

		const zone = await this.loadOriginZone(r);
		if (isErr(zone)) return err(zone.error);

		const stale = isStaleReading(
			r,
			zone.value?.entity ?? null,
			assetEntity,
		);

		return ok({
			requirementId: r.id,
			assetId: r.assetId,
			assetName: assetEntity?.name ?? null,
			missingTarget: assetEntity === null ? 'asset' : null,
			unit: r.unit,
			wasteFactor: r.wasteFactor,
			quantity: {
				calculated: r.quantity.calculated.value,
				override: r.quantity.override?.value ?? null,
				effective: effectiveValue(r.quantity).value,
			},
			cost: {
				calculated: r.estimatedCost.calculated,
				override: r.estimatedCost.override ?? null,
				effective: effectiveValue(r.estimatedCost),
			},
			recalculationStatus: stale ? 'stale' : 'current',
		});
	}

	private async loadOriginZone(
		r: Requirement,
	): Promise<Result<Loaded<Zone> | null, RepositoryError>> {
		if (r.origin.kind !== 'zone') return ok(null);
		const found = await this.zones.getById(r.origin.zoneId);
		if (isErr(found)) return err(found.error);
		return ok(found.value);
	}
}

