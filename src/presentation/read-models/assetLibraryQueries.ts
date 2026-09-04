import { err, isErr, type Result } from '../../core/result/Result';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Query } from '../../application/queries/Query';
import type { CatalogueListing } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline, ListAssetOutlinesInput } from '../../application/queries/ListAssetOutlines';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type {
	ReferencedTarget,
	ReferencingGroup,
} from '../../application/queries/ListRequirementsReferencing';
import type { ReassignmentTargetDto } from '../../application/queries/reassignmentTypes';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';

/**
 * The ONLY application-layer surface the Asset library depends on — `planEditorQueries.ts`'s
 * shape for a fourth view, and a sibling of `assetDesignerQueries.ts` rather than a member of
 * it: that file is named for the surface that edits ONE asset and answers one door, while this
 * one browses every asset in the vault and answers six.
 *
 * FIVE of the six are reads with five different lifetimes (§5.5): the catalogue listing is
 * refreshed by events, the marks are read per viewport, and the three selection reads are
 * restarted by a selection. Folding any pair into one query would give two of them one ticket.
 *
 * `listReassignmentTargets` is the sixth and is NOT one of those — it belongs to no section, is
 * ticketed by nothing and is read once, inside a gesture, when a user has chosen to reassign.
 * It is here because §3.5's `Delete` goes through slice 10's resolution and that resolution
 * offers a reassignment, so the surface needs the door; and it is the SAME guarded query the
 * Plan editor's own delete flow already holds (`ListReassignmentTargets` has answered the asset
 * case since design slice 19 — every other area-kind asset in the vault), reused rather than
 * composed a second time.
 *
 * `listOutlines` answers a MAP and never a `Result`, which is the one asymmetry here and is
 * §3.4's rule rather than an oversight: an outline settles per asset, so one damaged sidecar
 * refuses for its own id and leaves every other row in the batch to answer normally. A `Result`
 * over the whole map would poison a shelf for one bad file.
 */
export interface AssetLibraryQueryServices {
	listCatalogue(): Promise<Result<CatalogueListing, RepositoryError>>;
	/** Exactly one entry per requested id — never a dropped one, which reads back as `none`. */
	listOutlines(assetIds: readonly AssetId[]): Promise<ReadonlyMap<AssetId, AssetOutline>>;
	getDesign(assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>>;
	listReferencing(assetId: AssetId): Promise<Result<readonly ReferencingGroup[], RepositoryError>>;
	/**
	 * Which projects hold a price override for this asset (§11 item 6). Marks the *Used in*
	 * rows a price edit will NOT reach — an unmarked row is this surface's central claim, that
	 * "a price correction reaches every room it was used in", being false by omission.
	 */
	listOverridingProjects(assetId: AssetId): Promise<Result<readonly ProjectId[], RepositoryError>>;
	/** §3.5's `Delete`, reassign branch — see this interface's own header for why it is here. */
	listReassignmentTargets(
		assetId: AssetId,
	): Promise<Result<readonly ReassignmentTargetDto[], RepositoryError>>;
}

/**
 * One `refused` outline per requested id, under one code.
 *
 * Written once because it has TWO callers that must not disagree: the unavailable bundle
 * below, and the guarded `listOutlines` when the boundary maps a fault. Both are the same
 * fact — *this batch could not be read* — and the alternative at either site is
 * `Promise.resolve(new Map())`, which drops every entry and reads back as `none`: the false
 * absence §3.4's fifth mark state exists to refuse, arriving through the one door that is
 * supposed to report it.
 *
 * `sidecarPath` is `undefined` because neither caller has one: no file was reached at all.
 */
function refusedOutlines(
	assetIds: readonly AssetId[],
	code: string,
): ReadonlyMap<AssetId, AssetOutline> {
	return new Map(assetIds.map((assetId) => [assetId, { kind: 'refused', code, sidecarPath: undefined }]));
}

/**
 * The read side for a session whose settings could not be recovered.
 *
 * TOTAL rather than nullable, exactly as `unavailableAssetDesignerQueries` and
 * `unavailableRenovationProjectQueries` are: `root.persistence` is `null` precisely when there
 * is no repository, no index and nothing to read, so every member refuses and the view draws
 * the same failure state it draws for any unreadable catalogue. A nullable dependency would
 * put a branch in every consumer, and not registering the view at all would leave a restored
 * library leaf pointing at a view type Obsidian does not know.
 *
 * The code is `settings.unrecovered`, REUSED rather than minted: `viewHydrationOrigin` reads
 * that exact string to decide this failure gets NO retry, because nothing was composed to
 * re-run. A code of this surface's own would silently give the bootstrap failure a retry
 * button that cannot work.
 */
function refuseUnrecovered(): Promise<Result<never, RepositoryError>> {
	return Promise.resolve(
		err<RepositoryError>({
			category: 'Persistence',
			code: 'settings.unrecovered',
			message: 'Settings could not be read, so the asset catalogue cannot be loaded.',
		}),
	);
}

export function unavailableAssetLibraryQueries(): AssetLibraryQueryServices {
	return {
		listCatalogue: refuseUnrecovered,
		listOutlines: (assetIds) => Promise.resolve(refusedOutlines(assetIds, 'settings.unrecovered')),
		getDesign: refuseUnrecovered,
		listReferencing: refuseUnrecovered,
		listOverridingProjects: refuseUnrecovered,
		listReassignmentTargets: refuseUnrecovered,
	};
}

/**
 * The six guarded queries, mapped at the boundary into the read model above.
 *
 * Typed structurally (`Query<…>`) and never as the concrete classes, for the reason
 * `guardedServices.ts` states once for every service it wraps: what the composition root hands
 * out is a wrapper object with the same `execute`, and a parameter typed as the class would
 * refuse it.
 *
 * TWO KINDS of mapping happen here and nowhere else, at three doors.
 *
 * `listReferencing` and `listReassignmentTargets` each take an `AssetId` where the query takes
 * a `ReferencedTarget`: both queries serve the zone flow too, so the discriminator is this
 * surface's to supply rather than the view's to remember. One rule, applied at two doors —
 * stated as a kind rather than counted, because the door count is what moved when §3.5's
 * reassign branch arrived and a sentence counting doors would have gone stale with it.
 *
 * And `listOutlines` turns the boundary's refusal into one `refused` entry per requested id,
 * which is the honest answer for a batch that could not be read: every mark says *unread*, and
 * none says *no shape yet*.
 */
export function createAssetLibraryQueries(queries: {
	readonly listCatalogue: Query<void, Result<CatalogueListing, RepositoryError>>;
	readonly listOutlines: Query<
		ListAssetOutlinesInput,
		Result<ReadonlyMap<AssetId, AssetOutline>, RepositoryError>
	>;
	readonly getDesign: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>;
	readonly listReferencing: Query<ReferencedTarget, Result<readonly ReferencingGroup[], RepositoryError>>;
	readonly listOverridingProjects: Query<AssetId, Result<readonly ProjectId[], RepositoryError>>;
	readonly listReassignmentTargets: Query<
		ReferencedTarget,
		Result<readonly ReassignmentTargetDto[], RepositoryError>
	>;
}): AssetLibraryQueryServices {
	return {
		listCatalogue: () => queries.listCatalogue.execute(),

		async listOutlines(assetIds) {
			const answered = await queries.listOutlines.execute({ assetIds });
			return isErr(answered) ? refusedOutlines(assetIds, answered.error.code) : answered.value;
		},

		getDesign: (assetId) => queries.getDesign.execute(assetId),

		listReferencing: (assetId) => queries.listReferencing.execute({ kind: 'asset', assetId }),

		listOverridingProjects: (assetId) => queries.listOverridingProjects.execute(assetId),

		listReassignmentTargets: (assetId) =>
			queries.listReassignmentTargets.execute({ kind: 'asset', assetId }),
	};
}
