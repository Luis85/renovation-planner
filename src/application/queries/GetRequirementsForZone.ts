import { Decimal } from 'decimal.js';
import { err, isErr, isOk, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import { effectiveValue } from '../../core/derived/DerivedValue';
import type { Currency, Money } from '../../core/money/Money';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { CalculatedFrom, Requirement } from '../../domain/requirement/Requirement';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { AssetRepository } from '../ports/AssetRepository';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { Loaded } from '../ports/versioning';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneRepository } from '../ports/ZoneRepository';
import type { Query } from './Query';
import { toMeasuredQuantity } from '../../domain/cost/quantityEngine';
import { assetMatchesCalculatedFrom } from '../commands/requirement/deriveRequirementFigures';

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
 * could not have produced, and every requirement would read permanently stale. The asset
 * half of the comparison is `assetMatchesCalculatedFrom` itself, called rather than
 * re-spelled, so a pipeline that starts reading another Asset field has exactly one place
 * to add it and this backstop cannot silently fall behind. What this function adds beside
 * that call is the two conjuncts specific to a READ MODEL rather than to an Asset: the
 * zone's own area, and the project's currency.
 */
function inputsStillMatch(
	recordedFrom: CalculatedFrom,
	currentAreaMm2: Result<number, unknown>,
	asset: { unit: MeasurementUnit; unitCost: Money },
	projectCurrency: Currency,
): boolean {
	if (!isOk(currentAreaMm2)) return false;
	const measured = toMeasuredQuantity(new Decimal(currentAreaMm2.value), recordedFrom.assetUnit);
	if (!measured.ok) return false;
	return (
		measured.value.value.equals(recordedFrom.zoneArea.value) &&
		assetMatchesCalculatedFrom(recordedFrom, asset) &&
		// The project's currency at calculation time IS the recorded unit cost's — the
		// requirement note carries one `currency` key for both. So this needs no new field
		// and no migration: a project whose currency moved no longer matches what its own
		// figures were derived from.
		projectCurrency === recordedFrom.unitCost.currency
	);
}

/**
 * The one-way staleness reading: the persisted marker, a missing endpoint, or a
 * calculatedFrom mismatch — any one of the three reads "stale", and nothing here can
 * move a persisted "stale" back to "current" (only RecalculateRequirementCommand's own
 * successful save clears the marker). The project is an endpoint like the zone and the
 * asset: a project that is gone reads "stale" rather than "current", the same rule the
 * other two already carry.
 */
function isStaleReading(
	r: Requirement,
	zone: { area(): Result<number, unknown> } | null,
	asset: { unit: MeasurementUnit; unitCost: Money } | null,
	projectCurrency: Currency | null,
): boolean {
	if (r.recalculationStatus === 'stale') return true;
	if (asset === null || zone === null || projectCurrency === null) return true;
	return !inputsStillMatch(r.calculatedFrom, zone.area(), asset, projectCurrency);
}

export class GetRequirementsForZone
	implements
			Query<ZoneId, Result<RequirementInspectorDTO[], RepositoryError>>
{
	constructor(
		private readonly requirements: RequirementRepository,
		private readonly zones: ZoneRepository,
		private readonly assets: AssetRepository,
		private readonly projects: ProjectRepository,
	) {}

	async execute(zoneId: ZoneId): Promise<Result<RequirementInspectorDTO[], RepositoryError>> {
		const listed = await this.requirements.listByZone(zoneId);
		if (isErr(listed)) return listed;

		// Resolved from each Requirement's OWN `projectId`, never from the queried Zone's.
		// `RecalculateRequirementCommand` reads `requirement.projectId`, so a read model
		// naming a different project would vouch as `current` for a figure that command
		// refuses as `cost.currency-mismatch` — one fact with two derivations, which is
		// the defect this shape exists to make unrepresentable rather than to detect.
		//
		// The two ids agree for anything `AssignAsset` wrote (it takes the Requirement's
		// project FROM the Zone), and nothing enforces it afterwards: `project` and
		// `origin-zone` are independent frontmatter keys that `requirementMapper` reads
		// without a cross-check, and `Requirement.create` validates only the origin KIND.
		// A hand edit parts them, and the row then reads stale — because the recorded
		// unit cost no longer matches the currency of the project that now owns it.
		//
		// Memoized rather than read per row, because they DO agree in the ordinary case:
		// one Zone, one project, one read, which is what the previous shape got right.
		const currencies = new Map<ProjectId, Currency | null>();

		const rows: RequirementInspectorDTO[] = [];
		for (const loaded of listed.value) {
			const currency = await this.projectCurrency(loaded.entity.projectId, currencies);
			if (isErr(currency)) return err(currency.error);
			const row = await this.buildRow(loaded.entity, currency.value);
			if (isErr(row)) return row;
			rows.push(row.value);
		}
		return ok(rows);
	}

	private async projectCurrency(
		projectId: ProjectId,
		memo: Map<ProjectId, Currency | null>,
	): Promise<Result<Currency | null, RepositoryError>> {
		// `null` is a CACHED answer (the project is gone), never a miss — nothing stores
		// `undefined`, which is what `Map.get` alone answers for an id never looked up.
		const cached = memo.get(projectId);
		if (cached !== undefined) return ok(cached);

		const project = await this.projects.getById(projectId);
		if (isErr(project)) return err(project.error);
		const currency = project.value?.entity.currency ?? null;
		memo.set(projectId, currency);
		return ok(currency);
	}

	private async buildRow(
		r: Requirement,
		projectCurrency: Currency | null,
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
			projectCurrency,
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

