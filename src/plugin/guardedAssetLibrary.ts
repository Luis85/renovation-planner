import { ok, type Result } from '../core/result/Result';
import type { Query } from '../application/queries/Query';
import type { Command } from '../application/commands/Command';
import type { Logger } from '../application/ports/Logger';
import type { RepositoryError } from '../application/ports/repositoryErrors';
import type { PersistenceError } from '../core/errors/AppError';
import type { EventBus } from '../core/events/EventBus';
import type { VaultExceptionMapper } from '../application/errors/exceptionMapper';
import { guardCommand, guardQuery } from '../application/errors/guardAgainstThrowing';
import {
	DuplicateAssetCommand,
	type DuplicateAssetErrors,
	type DuplicateAssetInput,
} from '../application/commands/asset/DuplicateAsset';
import { ListPlansUsingAsset, type AssetPlanUsage } from '../application/queries/ListPlansUsingAsset';
import type { ReferenceLocks } from '../application/reference/ReferenceLocks';
import type { PlanGeometrySidecar } from '../application/ports/PlanGeometrySidecar';
import type { PlanRepository } from '../application/ports/PlanRepository';
import type { ProjectRepository } from '../application/ports/ProjectRepository';
import type { Asset } from '../domain/asset/Asset';
import { ListCatalogueEntries, type CatalogueListing } from '../application/queries/ListCatalogueEntries';
import {
	ListAssetOutlines,
	type AssetOutline,
	type ListAssetOutlinesInput,
} from '../application/queries/ListAssetOutlines';
import { ListOverridingProjects } from '../application/queries/ListOverridingProjects';
import type { AssetRepository } from '../application/ports/AssetRepository';
import type { AssetGeometrySidecar } from '../application/ports/AssetGeometrySidecar';
import type { AssetPriceOverrideRepository } from '../application/ports/AssetPriceOverrideRepository';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import type { AssetId } from '../domain/asset/AssetId';
import type { ProjectId } from '../domain/project/ProjectId';

/**
 * The Asset library's own read side, guarded — its own module rather than a fourth bundle in
 * `guardedServices.ts` for the reason `guardedAssetPrice.ts` already records: that file sat at
 * 378 counted lines against a 400 cap when this arrived, and **a budget bought back by
 * reformatting is a budget that has already been spent**. The seam is the one that file draws
 * anyway — one guarded GROUP per bundle, composed and guarded in one place — so this module is
 * a whole group rather than whatever happened to fit.
 *
 * Nothing about the guarding moved. `VAULT_EXCEPTION_MAPPER` stays in `guardedServices.ts`
 * because it is the one instance every group shares, and it reaches this module the way it
 * reaches every other caller: as the `map` argument the composition root passes.
 *
 * **THREE members, not six.** The library's other three reads — `GetAssetDesign`,
 * `ListRequirementsReferencing` and `ListReassignmentTargets` — are already composed and
 * guarded for the designer and for the Plan editor's delete flow, and `assetLibraryDeps`
 * reuses those wrappers rather than building second ones. Two instruments answering one
 * question is what lets two surfaces disagree about one asset.
 */
export interface GuardedAssetLibraryServices {
	readonly assetLibrary: {
		readonly listCatalogue: Query<void, Result<CatalogueListing, RepositoryError>>;
		/**
		 * Answers a `Result` HERE and a bare map at the read model, which is the one place in
		 * this file where a guard changes a query's shape — and it is the boundary doing its
		 * job rather than an inconsistency.
		 *
		 * `ListAssetOutlines` settles per entry and therefore returns no `Result` at all: one
		 * damaged sidecar refuses for its own id and every other id in the batch answers
		 * normally. A FAULT below that query is a different fact — the batch was not read at
		 * all — and it has nowhere to go in a bare map: catching it and answering `new Map()`
		 * would drop every requested id and read back as *no shape yet*, the false absence
		 * §3.4's fifth mark state exists to refuse. So the boundary reports it in the one shape
		 * that can carry it, and `createAssetLibraryQueries` turns that refusal into one
		 * `refused` entry per requested id.
		 *
		 * **So a THROWING sidecar collapses the whole batch where a REFUSING one settles per
		 * entry, and the asymmetry is invisible from either side.** `ListAssetOutlines.execute`
		 * fans out through `Promise.all`, so one rejected read rejects the lot; a read that
		 * answers a coded refusal is caught by that query itself and becomes one `refused`
		 * entry beside four normal ones. Both are right — a refusal is a fact about ONE
		 * sidecar and a fault is "the batch was not read at all" — but nothing else in either
		 * file says so, and the two produce visibly different screens for what looks to a
		 * reader like one broken file. Pre-existing to this bundle; reachable because of it.
		 */
		readonly listOutlines: Query<
			ListAssetOutlinesInput,
			Result<ReadonlyMap<AssetId, AssetOutline>, RepositoryError>
		>;
		readonly listOverridingProjects: Query<AssetId, Result<readonly ProjectId[], RepositoryError>>;
	};
}

/**
 * Composes the three queries and guards each under its own event name, so a fault names the
 * door it crossed.
 *
 * It takes PORTS and builds the queries itself — `guardAssetDesign`'s shape rather than
 * `guardCatalogueRequirements`'s — because nothing above this function needs the unguarded ones: no library
 * read is dispatched from inside the application layer, so a second, raw copy at the root
 * would be a copy with no caller. Every port here is one the root already holds; nothing new
 * is constructed beneath them, and `index` is the same instance every repository shares, so
 * `ListCatalogueEntries` counts the notes the index EXCLUDED against the very scan that
 * excluded them.
 *
 * Each guard call is a local `const` first, per `guardedServices.ts`'s own header: assigning
 * one straight into a field of a declared return type gives it a contextual type, and `E` then
 * infers from the TARGET rather than from the query.
 */
export function guardAssetLibrary(
	ports: {
		assets: AssetRepository;
		index: ProjectIndex;
		geometry: AssetGeometrySidecar;
		overrides: AssetPriceOverrideRepository;
	},
	logger: Logger,
	map: VaultExceptionMapper,
): GuardedAssetLibraryServices {
	const catalogue = new ListCatalogueEntries(ports.assets, ports.index);
	const outlines = new ListAssetOutlines(ports.geometry);
	const overriding = new ListOverridingProjects(ports.overrides);
	const listCatalogue = guardQuery(catalogue, 'query.listCatalogueEntries.failed', logger, map);
	// The `Result` shim is an ADAPTER and not a second query: it adds the arm the boundary
	// needs to report a fault in and nothing else, so `ListAssetOutlines` keeps the per-entry
	// contract §3.4 asks of it. `never` as the error parameter is the honest one — the query
	// itself refuses nothing — which leaves `PersistenceError` as the only failure this door
	// can answer, exactly what the mapper produces.
	const listOutlines = guardQuery<ListAssetOutlinesInput, ReadonlyMap<AssetId, AssetOutline>, never>(
		{ execute: async (input: ListAssetOutlinesInput) => ok(await outlines.execute(input)) },
		'query.listAssetOutlines.failed',
		logger,
		map,
	);
	const listOverridingProjects = guardQuery(overriding, 'query.listOverridingProjects.failed', logger, map);
	return { assetLibrary: { listCatalogue, listOutlines, listOverridingProjects } };
}

/**
 * AD13's usage scope, composed and guarded ONCE for every surface that asks it (ruling AD13-R1).
 *
 * **Extracted out of `guardAssetDuplication` below rather than spelled a second time in
 * `assetDesignerDeps.ts`.** The designer owes the same disclosure the library draws — it is the
 * surface that actually REWRITES a shared definition — and composing `guardAssetDuplication` from
 * there to reach this read would build a `DuplicateAssetCommand` nothing in the designer
 * dispatches: a dead door composed to reach a live one. Two constructions of one query is the
 * shape that lets two surfaces disagree about one asset, which is the whole of part 3 of that
 * ruling.
 *
 * The event name is unchanged (`query.listPlansUsingAsset.failed`), because a log line is read by
 * whoever is triaging a vault fault and the door it names did not move.
 *
 * `guardQuery`'s result is a local `const` first, per `guardedServices.ts`'s own header: returned
 * straight into this function's declared return type it would take a CONTEXTUAL type, and `E`
 * would then infer from that annotation rather than from the query.
 *
 * **Guarded plainly, with no `Result` adapter.** `ListPlansUsingAsset` answers a `Result` of its
 * own: it walks the project and plan repositories, so a listing that REFUSES is a real failure arm
 * — the property `guardCategory.test.ts` exists to enforce, and exactly what an index-driven first
 * version of that query did not have (it answered an empty scope over a vault that threw).
 *
 * **Read that narrowly: those repositories enumerate through `index.getIdsByType` themselves.** So
 * the arm this door covers is a port that FAILS, never an index that is merely EMPTY — a pre-scan
 * vault still answers an empty scope through here, and that arm is gated at each CALLER
 * (`AssetUsageScope.vue` and `DesignerUsageScope.vue` both ask `indexScanCompleted()` before
 * dispatching). `ListPlansUsingAsset`'s own header carries the measurement; this note exists so
 * the claim is not wider on this side of the seam than on that one.
 */
export function guardAssetUsage(
	ports: {
		projects: ProjectRepository;
		plans: PlanRepository;
		planGeometry: PlanGeometrySidecar;
	},
	logger: Logger,
	map: VaultExceptionMapper,
): Query<AssetId, Result<AssetPlanUsage, RepositoryError | PersistenceError>> {
	const usage = new ListPlansUsingAsset(ports.projects, ports.plans, ports.planGeometry);
	const listPlansUsingAsset = guardQuery(usage, 'query.listPlansUsingAsset.failed', logger, map);
	return listPlansUsingAsset;
}

/**
 * AD13's two doors — `Duplicate as new asset` and the plan-usage scope drawn before an
 * impactful change — composed and guarded together.
 *
 * **A SECOND function rather than three more members of `guardAssetLibrary` above, and the
 * reason is a lease rather than a design.** That function is called from
 * `composition-root.ts`, which AD01 §2 holds integrator-owned, so widening its `ports`
 * argument would be an edit to a file this card may not touch. What it costs is one extra
 * call site, in `assetLibraryDeps.ts` — the module that assembles the LIBRARY's bundle and this
 * function's only caller. (That sentence read "the only consumer either door has" until AD13-R1
 * gave the scope a second one; the duplicate command's only consumer is still that module, and
 * the scope's other consumer reaches `guardAssetUsage` directly rather than coming through here,
 * which is the whole point of the extraction.) What it does NOT cost is the guarding itself: both doors go
 * through `guardCommand`/`guardQuery` under their own event names, so a throw below either
 * one is mapped at the boundary exactly as it is for the three reads above, and
 * `guardCategory.test.ts`'s detonation reaches them through the same wrappers.
 *
 * **Both are guarded plainly, with no `Result` adapter**, and the read half is no longer composed
 * here: `guardAssetUsage` above owns it, and this function CALLS that rather than constructing
 * `ListPlansUsingAsset` a second time. The scope query's whole account — why it answers a
 * `Result`, and why its empty-index arm is gated at each caller rather than at the door — lives
 * there.
 *
 * Nothing about this function's shape moved with it: it still takes every port either door needs
 * and still hands back one object, because `assetLibraryDeps.ts` splits the pair by KIND and the
 * two arrive together only because they arrived together.
 */
export function guardAssetDuplication(
	ports: {
		assets: AssetRepository;
		assetGeometry: AssetGeometrySidecar;
		events: EventBus;
		locks: ReferenceLocks;
		projects: ProjectRepository;
		plans: PlanRepository;
		planGeometry: PlanGeometrySidecar;
	},
	logger: Logger,
	map: VaultExceptionMapper,
): {
	duplicateAsset: Command<DuplicateAssetInput, Result<Asset, DuplicateAssetErrors | PersistenceError>>;
	listPlansUsingAsset: Query<AssetId, Result<AssetPlanUsage, RepositoryError | PersistenceError>>;
} {
	const duplicate = new DuplicateAssetCommand({
		assets: ports.assets,
		sidecar: ports.assetGeometry,
		events: ports.events,
		locks: ports.locks,
	});
	const duplicateAsset = guardCommand(duplicate, 'command.duplicateAsset.failed', logger, map);
	const listPlansUsingAsset = guardAssetUsage(ports, logger, map);
	return { duplicateAsset, listPlansUsingAsset };
}
