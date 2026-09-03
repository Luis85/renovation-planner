import { Decimal } from 'decimal.js';
import { err, isErr, isOk, ok, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../ports/repositoryErrors';
import { effectiveValue } from '../../core/derived/DerivedValue';
import type { Currency, Money } from '../../core/money/Money';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import type { CalculatedFrom, Requirement } from '../../domain/requirement/Requirement';
import type { AssetRepository } from '../ports/AssetRepository';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import { winnersBy, type AssetPriceOverrideRepository } from '../ports/AssetPriceOverrideRepository';
import type { AssetPriceOverride } from '../../domain/asset-price/AssetPriceOverride';
import type { Logger } from '../ports/Logger';
import type { Loaded } from '../ports/versioning';
import type { Zone } from '../../domain/zone/Zone';
import type { ZoneRepository } from '../ports/ZoneRepository';
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

/**
 * The collaborators one row's derivation actually reaches — deliberately narrower than
 * `GetRequirementsForZoneDeps`: neither `requirements` (the caller already has the
 * Requirement in hand) nor `projects` (the caller resolves `projectCurrency` itself, once
 * per project rather than once per row) is read below this door. A caller passing its own
 * wider deps bundle satisfies this structurally; nothing here asks it to narrow first.
 */
export interface RequirementRowDeps {
	readonly assets: AssetRepository;
	readonly zones: ZoneRepository;
	readonly overrides: AssetPriceOverrideRepository;
	/**
	 * For the duplicate diagnostic `winnersBy` demands — the same one
	 * `ListProjectAssetPrices` takes a `Logger` for, and for the same reason.
	 */
	readonly logger: Logger;
}

async function loadOriginZone(
	deps: RequirementRowDeps,
	r: Requirement,
): Promise<Result<Loaded<Zone> | null, RepositoryError>> {
	if (r.origin.kind !== 'zone') return ok(null);
	const found = await deps.zones.getById(r.origin.zoneId);
	if (isErr(found)) return err(found.error);
	return ok(found.value);
}

/**
 * This project's whole price resolution, read once. An EMPTY MAP is a CACHED answer (the
 * project prices nothing of its own), never a miss — nothing stores `undefined`, which is
 * what `Map.get` alone answers for a project never looked up. The same
 * `undefined`-means-a-miss rule the caller's currency memo carries, applied to a value that
 * has its own empty state.
 */
async function projectOverrides(
	deps: RequirementRowDeps,
	projectId: ProjectId,
	memo: Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>>,
): Promise<Result<ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>, RepositoryError>> {
	const cached = memo.get(projectId);
	if (cached !== undefined) return ok(cached);

	const listed = await deps.overrides.listByProject(projectId);
	if (isErr(listed)) return err(listed.error);
	// `winnersBy`, never `new Map(list.map(...))`: that keeps whichever note came last in
	// `listByProject` order, which is a third answer beside the one `winningDuplicate`
	// states and the one `getForPair` used to give this query.
	//
	// The reporter carries the diagnostic this query used to get for free from inside
	// `getForPair`. It reports slightly MORE than that did: once per duplicated pair in
	// the project rather than once per duplicated pair a row in this zone happens to
	// reference — the same widening `ListProjectAssetPrices` already has, and the same
	// event and context.
	const winners = winnersBy(listed.value, (o) => o.entity.assetId, (assetId, notes) => {
		deps.logger.warn('asset-price.duplicate-pair', {
			projectId,
			assetId,
			count: notes.length,
		});
	});
	memo.set(projectId, winners);
	return ok(winners);
}

/**
 * The effective cost — this project's own price where it has one, the catalogue
 * default otherwise — is what `assetMatchesCalculatedFrom` must be compared against
 * under an override, since that is what `calculatedFrom.unitCost` records. `null` for
 * a `null` asset, which is what lets `buildRequirementRow` ask this unconditionally:
 * `isStaleReading` already reads "stale" for a `null` asset without inspecting it further,
 * and pulling the branch out here is what keeps that function's own complexity under budget.
 */
async function effectiveAsset(
	deps: RequirementRowDeps,
	r: Requirement,
	assetEntity: { readonly unit: MeasurementUnit; readonly unitCost: Money } | null,
	overrideMemo: Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>>,
): Promise<
	Result<{ unit: MeasurementUnit; unitCost: Money; override: Money | null } | null, RepositoryError>
> {
	if (assetEntity === null) return ok(null);
	const resolved = await projectOverrides(deps, r.projectId, overrideMemo);
	if (isErr(resolved)) return err(resolved.error);
	const override = resolved.value.get(r.assetId)?.entity.unitCost ?? null;
	return ok({
		unit: assetEntity.unit,
		unitCost: override ?? assetEntity.unitCost,
		override,
	});
}

/**
 * The per-row derivation, shared between `GetRequirementsForZone` (one project's currency
 * memoized per `execute`, since an Inspector zone can hold rows from more than one project)
 * and `GetProjectSummary` (one project's currency, resolved once, for every row). Both
 * callers pass the caller-resolved `projectCurrency` and `overrideMemo` rather than this
 * function resolving either itself — the currency's OWNER differs between the two callers
 * (a Requirement's own `projectId` here, a single known project there), so pulling that
 * resolution inside would hand one of the two callers a memo shaped for the other.
 */
export async function buildRequirementRow(
	deps: RequirementRowDeps,
	requirement: Requirement,
	projectCurrency: Currency | null,
	overrideMemo: Map<ProjectId, ReadonlyMap<AssetId, Loaded<AssetPriceOverride>>>,
): Promise<Result<RequirementInspectorDTO, RepositoryError>> {
	const asset = await deps.assets.getById(requirement.assetId);
	if (isErr(asset)) return err(asset.error);
	const assetEntity = asset.value?.entity ?? null;

	const zone = await loadOriginZone(deps, requirement);
	if (isErr(zone)) return err(zone.error);

	const effective = await effectiveAsset(deps, requirement, assetEntity, overrideMemo);
	if (isErr(effective)) return err(effective.error);

	const stale = isStaleReading(
		requirement,
		zone.value?.entity ?? null,
		effective.value,
		projectCurrency,
	);

	return ok({
		requirementId: requirement.id,
		assetId: requirement.assetId,
		assetName: assetEntity?.name ?? null,
		missingTarget: assetEntity === null ? 'asset' : null,
		unit: requirement.unit,
		wasteFactor: requirement.wasteFactor,
		quantity: {
			calculated: requirement.quantity.calculated.value,
			override: requirement.quantity.override?.value ?? null,
			effective: effectiveValue(requirement.quantity).value,
		},
		cost: {
			calculated: requirement.estimatedCost.calculated,
			override: requirement.estimatedCost.override ?? null,
			effective: effectiveValue(requirement.estimatedCost),
		},
		unitCost: buildUnitCostGroup(requirement, assetEntity, effective.value),
		recalculationStatus: stale ? 'stale' : 'current',
	});
}
