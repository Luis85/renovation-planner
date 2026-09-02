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
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RequirementRepository } from '../ports/RequirementRepository';
import type { AssetPriceOverrideRepository } from '../ports/AssetPriceOverrideRepository';
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
	 * §89's "beside what it replaced", at the INPUT level — the level `cost` above records the
	 * OUTPUT of. `catalogue` is the shared library's price, `projectOverride` this project's
	 * own or `null`, `effective` the one the figures were actually derived from. `null` for a
	 * row whose `missingTarget` is `'asset'`, since there is no library price to show.
	 */
	unitCost: {
		/** The library's price NOW. */
		catalogue: Money;
		/** This project's own price NOW, or `null`. */
		projectOverride: Money | null;
		/**
		 * **The unit cost these figures were actually DERIVED FROM** — `r.calculatedFrom.unitCost`,
		 * NOT the current resolution.
		 *
		 * The two differ exactly when the row is stale: an override moved out of band, or a
		 * recalculation failed. Taking the freshly-resolved value here would label a price that
		 * was never used as the one in force, on a row simultaneously marked `stale` — the
		 * surface contradicting its own status field.
		 *
		 * It also keeps this group consistent with the one beside it: `cost.calculated` is
		 * historical, so the unit cost it was computed from must be too. `catalogue` and
		 * `projectOverride` are CURRENT, and the gap between them and this figure is precisely
		 * what a stale row exists to show.
		 */
		effective: Money;
	} | null;
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

/**
 * §89's INPUT-level group, pulled out of `buildRow` when adding it pushed that method's
 * complexity over budget. `null` for a row whose asset is gone — there is no library price
 * to show, and inventing one would render a comparison against a figure that does not exist.
 */
function buildUnitCostGroup(
	r: Requirement,
	assetEntity: { readonly unitCost: Money } | null,
	effective: { readonly override: Money | null } | null,
): RequirementInspectorDTO['unitCost'] {
	if (assetEntity === null || effective === null) return null;
	return {
		catalogue: assetEntity.unitCost,
		projectOverride: effective.override,
		effective: r.calculatedFrom.unitCost,
	};
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
		private readonly overrides: AssetPriceOverrideRepository,
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
		// Keyed on the PAIR, unlike the currency memo above: one zone's rows share a project
		// but not an asset, so a project-keyed memo would answer the first row's asset for
		// every row.
		const overrideMemo = new Map<string, Money | null>();

		const rows: RequirementInspectorDTO[] = [];
		for (const loaded of listed.value) {
			const currency = await this.projectCurrency(loaded.entity.projectId, currencies);
			if (isErr(currency)) return err(currency.error);
			const row = await this.buildRow(loaded.entity, currency.value, overrideMemo);
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

	private async projectOverride(
		projectId: ProjectId,
		assetId: AssetId,
		memo: Map<string, Money | null>,
	): Promise<Result<Money | null, RepositoryError>> {
		const key = `${projectId}:${assetId}`;
		// `null` is a CACHED answer (no override for this pair), never a miss — the same
		// `undefined`-means-a-miss rule `projectCurrency`'s memo already carries.
		const cached = memo.get(key);
		if (cached !== undefined) return ok(cached);
		const found = await this.overrides.getForPair(projectId, assetId);
		if (isErr(found)) return err(found.error);
		const unitCost = found.value?.entity.unitCost ?? null;
		memo.set(key, unitCost);
		return ok(unitCost);
	}

	/**
	 * The effective cost — this project's own price where it has one, the catalogue
	 * default otherwise — is what `assetMatchesCalculatedFrom` must be compared against
	 * under an override, since that is what `calculatedFrom.unitCost` records. `null` for
	 * a `null` asset, which is what lets `buildRow` ask this unconditionally: `isStaleReading`
	 * already reads "stale" for a `null` asset without inspecting it further, and pulling the
	 * branch out here is what keeps `buildRow`'s own complexity under budget.
	 */
	private async effectiveAsset(
		r: Requirement,
		assetEntity: { readonly unit: MeasurementUnit; readonly unitCost: Money } | null,
		overrideMemo: Map<string, Money | null>,
	): Promise<
		Result<{ unit: MeasurementUnit; unitCost: Money; override: Money | null } | null, RepositoryError>
	> {
		if (assetEntity === null) return ok(null);
		const override = await this.projectOverride(r.projectId, r.assetId, overrideMemo);
		if (isErr(override)) return err(override.error);
		return ok({
			unit: assetEntity.unit,
			unitCost: override.value ?? assetEntity.unitCost,
			override: override.value,
		});
	}

	private async buildRow(
		r: Requirement,
		projectCurrency: Currency | null,
		overrideMemo: Map<string, Money | null>,
	): Promise<Result<RequirementInspectorDTO, RepositoryError>> {
		const asset = await this.assets.getById(r.assetId);
		if (isErr(asset)) return err(asset.error);
		const assetEntity = asset.value?.entity ?? null;

		const zone = await this.loadOriginZone(r);
		if (isErr(zone)) return err(zone.error);

		const effective = await this.effectiveAsset(r, assetEntity, overrideMemo);
		if (isErr(effective)) return err(effective.error);

		const stale = isStaleReading(
			r,
			zone.value?.entity ?? null,
			effective.value,
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
			unitCost: buildUnitCostGroup(r, assetEntity, effective.value),
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

