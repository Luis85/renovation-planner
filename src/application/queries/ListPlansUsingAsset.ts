import { isErr, ok, type Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanGeometryDocument, PlanGeometrySidecar } from '../ports/PlanGeometrySidecar';
import type { PlanRepository } from '../ports/PlanRepository';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Query } from './Query';

/**
 * One plan that places the asset, and how many placements of it that plan holds.
 *
 * **`projectName` rides beside `projectId` because a view can draw only one of the two, and it
 * is the one this row was previously missing.** A plan name is not unique across a vault: the
 * catalogue is vault-level since design slice 19, so one definition is placeable from plans in
 * different projects, and two plans both named `Kitchen` rendered as two rows of identical
 * visible text — separable only by the `:key` and the `data-plan-id`, neither of which a user
 * sees, at the one surface whose whole job is to state a blast radius.
 *
 * **What that closes is the PLAN-name collision and NOT the whole hazard, and the sentence has
 * to say so.** Two plans named `Kitchen` in two projects BOTH named `Flat renovation` still draw
 * identically. That is not hypothetical here: `tests/harness/assetLibrary.ts` already ships two
 * projects under that one name, and `withPathsWhereAmbiguous` in
 * `ListRequirementsReferencing.ts` says why — *"`Project.create` trims a name and rejects only
 * an empty one, so a collision is a thing a vault legitimately holds and nothing refuses."*
 *
 * **So the sibling `AssetInspectorUsedIn.vue` answers TWO hazards SEPARATELY, and this row
 * answers only the first of them.** It keys the `v-for` on `projectId` because a name is not a
 * unique identity, and for the USER-VISIBLE collision it escalates to a project PATH — supplied
 * by that neighbouring query, at two levels (the folder, or the note's own path where a folder
 * does not separate them either), and **only where two names actually collide**. Nothing here
 * carries a path, and a second escalation is a slice of its own: it would need the project
 * LOCATION lookup this query does not hold, and the conditional rule that decides when to draw
 * it. Read this field as narrowing the defect rather than removing it.
 *
 * **Both fields, and neither is the other's replacement.** `projectId` is the identity — unique
 * by construction, and what a future navigation door would carry — while `projectName` is the
 * only half of it a user can read. Stated plainly rather than implied, because `projectId` is
 * still named by no template: `grep -rn "projectId" $(grep -rl AssetPlanUsage src/)` prints this
 * file alone, which is what it printed before this field existed and remains true after it.
 */
export interface PlanAssetUsage {
	readonly planId: PlanId;
	readonly planName: string;
	readonly projectId: ProjectId;
	/** The owning project's name — see the interface header for why the id alone was not enough. */
	readonly projectName: string;
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
 * **It walks the PROJECT and PLAN repositories, so a vault that REFUSES is propagated rather
 * than degrading into an empty scope.** The first version enumerated `index.getIdsByType`
 * itself and answered `{ plans: [], unreadable: 0 }` over ports that threw;
 * `tests/plugin/guardCategory.test.ts` found it by detonating them and getting a success back
 * (*"`execute` answered a SUCCESS while the vault below it threw"*). That refusing-ports arm is
 * what this shape closes, and it is the WHOLE of what it closes.
 *
 * **It is NOT "deliberately not `index.getIdsByType`", which is what this paragraph claimed
 * until a reviewer read the two ports.** Both of them enumerate through exactly that lookup —
 * `ObsidianProjectRepository.listAll` iterates `getIdsByType('renovation-project')` and
 * `ObsidianPlanRepository.listByProject` intersects `getIdsByType('renovation-plan')` with
 * `getIdsByProject` — which is what `grep -n getIdsByType
 * src/infrastructure/obsidian/repositories/Obsidian{Project,Plan}Repository.ts` prints in the
 * edit that wrote this sentence. So an EMPTY index over a healthy vault still answers an empty
 * scope from here, `ok` and confident, and that state is legitimately reached: the initial scan
 * runs from `onLayoutReady`, after the views are registered.
 *
 * **Which is why the pre-scan gate is at the CALLER and named here rather than left to be
 * rediscovered.** No query can tell the two apart — *the index holds nothing* and *the vault
 * holds nothing* are one answer at this depth, and the fact that separates them is whether the
 * scan has RUN, which lives in `plugin/` where it is run. `AssetUsageScope.vue` asks
 * `indexScanCompleted()` before it dispatches this query and draws *the scope is unknown*
 * instead; any second caller — a palette action, the designer→plan door — owes the same ask,
 * because what it would otherwise draw is a confident "no plan places this" over a full vault.
 *
 * **Tolerant where the ports are tolerant; refusing where they refuse.** `ProjectRepository.
 * listAll` and `PlanRepository.listByProject` each answer `{ loaded, refused }`, so a single
 * unparseable note is counted into `unreadable` and every other note still answers — the shape
 * `ListProjects` and `ListPlansByProject` already rename across this boundary. A WHOLE listing
 * that refuses is propagated, which is `ListRequirementsReferencing`'s own rule for the read
 * this section sits beside: one unreadable project note is a gap in the scope, and an unreadable
 * project LIST is not a scope at all.
 *
 * **Which sidecar refusals become `unreadable`: every one, conflated.** `collect` counts a
 * refusing `geometry.read` whatever it refused with — `plan-geometry.missing` for a sidecar file
 * that is gone, `plan-geometry.path-unresolved` for a plan the index holds no mapping for, and a
 * parse or I/O failure alike — into the one number, and the locale string says *note(s) could not
 * be read* rather than naming a cause. Said out loud because the ASSET sidecar does the opposite
 * and a reader who knows that one would expect this: an absent `.rpgeo` reads there as an empty
 * document, while `PlanGeometryStore` refuses — a plan's sidecar is created with the plan
 * (`ObsidianPlanRepository.save`), so an absent one is damage rather than a plan nobody has
 * drawn on yet, and counting it is the honest answer rather than an over-count.
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
			unreadable += await this.collect(
				assetId,
				project.entity.name,
				found.value.loaded.map((loaded) => loaded.entity),
				plans,
			);
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
		projectName: string,
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
				plans.push({ planId: plan.id, planName: plan.name, projectId: plan.projectId, projectName, placements });
			}
		}
		return unreadable;
	}
}
