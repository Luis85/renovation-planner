import { isErr, ok, type Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanGeometryDocument, PlanGeometrySidecar } from '../ports/PlanGeometrySidecar';
import type { PlanRepository } from '../ports/PlanRepository';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Query } from './Query';

/** One plan that places the asset, and how many placements of it that plan holds. */
export interface PlanAssetUsage {
	readonly planId: PlanId;
	readonly planName: string;
	readonly projectId: ProjectId;
	/** Distinct `kind: 'asset'` elements naming this asset — never zero; a plan with none is absent. */
	readonly placements: number;
}

/**
 * What the library's usage scope draws, and the one number that keeps it honest.
 *
 * `unreadable` is *notes this walk could not ask* — a project note that refused, a plan note that
 * refused, or a geometry sidecar that did. It is NOT plans without placements, and the two must
 * not be folded together: C08's *"a failed read is not 'asset missing'"* met on a read whose whole
 * purpose is to tell a user what a change will touch. A scope that silently omitted what it could
 * not read would understate the blast radius of the very edit it was consulted about.
 *
 * ONE number over three kinds of note rather than three fields, because the consumer's question
 * is binary — *is this list complete* — and a breakdown would be three sentences on screen for a
 * state whose only action is the same in all three cases: read it as a floor, not a total.
 */
export interface AssetPlanUsage {
	readonly plans: readonly PlanAssetUsage[];
	readonly unreadable: number;
}

/**
 * Distinct placements of one asset in one plan's geometry.
 *
 * **BOTH structures, deduplicated by ELEMENT id.** A plan sidecar holds a current `structure`
 * and an optional proposed `intended` one, and `assetShapeLoader.ts` already unions the two
 * when it collects the asset ids a plan draws — so an asset present only in the proposal is
 * genuinely used by that plan, and one present in both is ONE placement rather than two. A
 * count taken off `structure` alone would tell a renovator that a change misses a plan whose
 * proposal it will redraw.
 */
function placementCount(document: PlanGeometryDocument, assetId: AssetId): number {
	const placed = new Set<string>();
	for (const structure of [document.structure, document.intended]) {
		for (const element of structure?.elements ?? []) {
			if (element.kind === 'asset' && element.assetId === assetId) placed.add(element.id);
		}
	}
	return placed.size;
}

/**
 * Which plans place one catalogue asset — AD13 item 3's *"show which editable plans use the
 * definition before impactful changes"*, and C11's impact scope.
 *
 * **This question had no answer before and could not be derived from the one that did.**
 * `ListRequirementsReferencing` walks `renovation-requirement` notes and groups by project,
 * which is what the Asset library's *Used in* section draws; a requirement is a QUANTITY link
 * and a placement is a `NamedSpatialElement` in a plan's geometry sidecar. An asset can be
 * placed on a plan with no requirement anywhere, and required with nothing placed, so neither
 * read is a narrowing of the other.
 *
 * **It walks the PROJECT and PLAN repositories, and deliberately not `index.getIdsByType`,
 * which is what the first version of it did.** That version was faster and wrong in the one
 * direction that matters here: the index is derived data that is legitimately EMPTY before the
 * initial scan and after a failure below it, so an unreachable vault answered
 * `{ plans: [], unreadable: 0 }` — *no plan places this asset*, stated confidently, over a vault
 * nobody could read. `tests/plugin/guardCategory.test.ts` found it by detonating the ports and
 * getting a success back (*"`execute` answered a SUCCESS while the vault below it threw"*). Reads
 * that must not report a false absence have to derive their answer from something that FAILS
 * when the vault fails, which is what the repositories do and an index lookup cannot.
 *
 * **Tolerant where the ports are tolerant; refusing where they refuse.** `ProjectRepository.
 * listAll` and `PlanRepository.listByProject` each answer `{ loaded, refused }`, so a single
 * unparseable note is counted into `unreadable` and every other note still answers — the shape
 * `ListProjects` and `ListPlansByProject` already rename across this boundary. A WHOLE listing
 * that refuses is propagated, which is `ListRequirementsReferencing`'s own rule for the read
 * this section sits beside: one unreadable project note is a gap in the scope, and an unreadable
 * project LIST is not a scope at all.
 *
 * **A plan id whose note is gone is dropped silently rather than counted** — `getById` answering
 * `ok(null)` is not a refusal, which is `ListPlansByProject`'s own rule for a stale index entry.
 * That case cannot arise through `listByProject`, which only yields notes it loaded; it is stated
 * because the reader's next question after the paragraph above is what happens to a listing that
 * names a note nobody can open.
 *
 * **Cost, so nobody is surprised by it:** one project listing, one plan listing per project, and
 * one sidecar read per plan, per call. That is why this is run when a user ASKS for the scope
 * rather than on every selection, and why it is a snapshot rather than a subscription.
 */
export class ListPlansUsingAsset implements Query<AssetId, Result<AssetPlanUsage, RepositoryError>> {
	constructor(
		private readonly projects: ProjectRepository,
		private readonly plans: PlanRepository,
		private readonly geometry: PlanGeometrySidecar,
	) {}

	async execute(assetId: AssetId): Promise<Result<AssetPlanUsage, RepositoryError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;

		const plans: PlanAssetUsage[] = [];
		let unreadable = listed.value.refused;

		for (const project of listed.value.loaded) {
			const found = await this.plans.listByProject(project.entity.id);
			if (isErr(found)) return found;
			unreadable += found.value.refused;
			unreadable += await this.collect(assetId, found.value.loaded.map((loaded) => loaded.entity), plans);
		}

		return ok({ plans, unreadable });
	}

	/**
	 * One project's plans, appended to `plans`, answering how many of their sidecars refused.
	 *
	 * Split from `execute` rather than nested, because the two halves answer different questions
	 * — which notes exist, and what their geometry holds — and the file's own complexity budget
	 * is the gate that says so.
	 */
	private async collect(
		assetId: AssetId,
		found: readonly { readonly id: PlanId; readonly name: string; readonly projectId: ProjectId }[],
		plans: PlanAssetUsage[],
	): Promise<number> {
		let unreadable = 0;
		for (const plan of found) {
			const snapshot = await this.geometry.read(plan.id);
			if (isErr(snapshot)) {
				unreadable += 1;
				continue;
			}
			const placements = placementCount(snapshot.value.document, assetId);
			if (placements > 0) {
				plans.push({ planId: plan.id, planName: plan.name, projectId: plan.projectId, placements });
			}
		}
		return unreadable;
	}
}
