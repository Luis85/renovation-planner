import { isErr, ok, type Result } from '../../../core/result/Result';
import type { Money } from '../../../core/money/Money';
import type { RepositoryError } from '../../ports/repositoryErrors';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';

/**
 * The `??` of the precedence, in ONE place:
 *
 *     effectiveUnitCost = priceOverride(project, asset)?.unitCost ?? asset.unitCost   ← an INPUT
 *     effectiveCost     = requirement.estimatedCost.override
 *                         ?? f(quantity, effectiveUnitCost)                           ← the OUTPUT
 *
 * The price override replaces an INPUT, so it changes what `estimatedCost.calculated` MEANS.
 * The requirement override replaces the OUTPUT, so it wins over whatever the derivation
 * produced. They cannot conflict, because neither can express the other's question.
 *
 * **A function rather than two call sites spelling the same lookup.** `AssignAsset` and
 * `RecalculateRequirement` are the two callers slice 10 deliberately routed through one
 * derivation; giving them two copies of the resolution would undo that one level up. *"Two
 * expressions of one question, three lines apart, drift immediately"* — and this repository
 * has paid for it four times, most recently in the increment this one continues, where the
 * read and the write resolved a project currency from two different fields.
 *
 * `deriveRequirementFigures` is deliberately NOT given the repository: it stays a pure
 * function of the figures it is handed. A derivation that reached for a repository would be a
 * second answer to "what does this requirement cost".
 *
 * **RECORDED COST, not a defect, and the shape is one this increment has already fixed twice
 * one layer over.** `getForPair` is not a keyed read: `ObsidianAssetPriceOverrideRepository`
 * answers it by calling `listByProject(projectId)` and FILTERING, so every call here hydrates
 * every price note the project holds. That is fine for `AssignAsset`, which is one gesture and
 * one pair. It is not free under the CASCADE: `runRecalculationCascade` drives
 * `recalculateOne` → `RecalculateRequirementCommand` → this function once per target, four at a
 * time (`CASCADE_CONCURRENCY`, not serially — the concurrency bounds the CONTENTION, never the
 * work), so one `AssetPriceOverrideChanged` over N requirements in a project holding M price
 * notes costs **N × M** hydrations. Every one of them re-reads the same M notes.
 *
 * The same N × M that Decision 5 batched at `onAssetUpdated` (one `listByAsset`, folded through
 * `winnersBy`) and that Ruling 10 fixed in `GetRequirementsForZone` (one `listByProject` per
 * project, memoised). This command is the THIRD reader of the same precedence and the only one
 * still paying per row — written down rather than fixed, because closing it is a change to a
 * command's READ PATH: either the cascade resolves the map once and passes it in, which widens
 * `RecalculateRequirementDeps` and every construction site of it, or the repository grows a
 * per-call memo, which is caching inside a port implementation and needs its own invalidation
 * argument. Neither belongs in the increment that found it.
 *
 * **No correctness consequence** — every read is of the same vault at the same moment, and the
 * cascade's failure isolation is per requirement either way. The cost is churn, the class Ruling
 * 9 records and accepts, and the reason to write it here rather than in a document is that this
 * is the function a later author edits when they come to fix it.
 */
export async function resolveEffectiveUnitCost(
	overrides: AssetPriceOverrideRepository,
	projectId: ProjectId,
	asset: { readonly id: AssetId; readonly unitCost: Money },
): Promise<Result<Money, RepositoryError>> {
	const found = await overrides.getForPair(projectId, asset.id);
	if (isErr(found)) return found;
	return ok(found.value?.entity.unitCost ?? asset.unitCost);
}

/**
 * The same rule against an already-fetched batch, for callers that resolve MANY pairs at once
 * and must not pay a read per row. `onAssetUpdated` builds its map from one `listByAsset`, and
 * is the only caller of THIS function; `GetRequirementsForZone` resolves the same precedence
 * against its own per-project map (one `listByProject`, folded through `winnersBy`) and keys
 * that map by asset rather than by project, so it cannot share this signature. Pure, so it is
 * the half a test can drive without a repository.
 */
export function effectiveUnitCostFrom(
	overridesByProject: ReadonlyMap<ProjectId, Money>,
	projectId: ProjectId,
	asset: { readonly unitCost: Money },
): Money {
	return overridesByProject.get(projectId) ?? asset.unitCost;
}
