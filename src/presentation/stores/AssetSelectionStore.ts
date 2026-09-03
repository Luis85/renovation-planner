import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { isErr, ok } from '../../core/result/Result';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { AssetLibraryChange } from '../../application/events/assetLibraryChangeSource';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import { createTicketedSection } from '../library/ticketedSection';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

/**
 * *Used in* is ONE read kind although it takes TWO query doors, and this pair is why: §11 item
 * 6's override marks are drawn ON the referencing groups, so a ticket each would let the
 * section draw a group list and an override set describing different moments — the two halves
 * of one sentence, each true of a different vault.
 */
interface UsageReading {
	readonly groups: readonly ReferencingGroup[];
	readonly overriding: readonly ProjectId[];
}

const NO_USAGE: UsageReading = { groups: [], overriding: [] };

/**
 * The inspector's subject: which asset is selected, and the two reads §3.5 draws it from.
 *
 * **TWO generations, one per read KIND** (design spec §5.5), each held by its own
 * `TicketedSection`. A selection CHANGE restarts both; a §5.4 refresh restarts only the read it
 * actually invalidates. The two spellings tried before this one each broke a different half,
 * and both are worth carrying because both look right:
 * - *per read start* makes a selection's second read invalidate its first, so the section
 *   holding the older ticket waits for a result nothing will ever deliver — **loading for
 *   ever**, on the ordinary path;
 * - *per selection cycle* over-restarts, dragging `ListRequirementsReferencing` — a scan of
 *   every requirement in the vault — along with every geometry, height or background edit a
 *   designer leaf makes, flapping *Used in* back into loading and disabling `Delete` while
 *   somebody works next door. A geometry change cannot alter usage.
 *
 * **The unit of invalidation is the read; the unit of restart is the gesture.**
 *
 * The cost of joining both usage doors under one ticket is stated rather than hidden: a price
 * override in another project re-runs the referencing scan for the SELECTED asset — one asset
 * rather than the vault-wide listing, which is the bounded half of what §5.5 objects to.
 *
 * `queries` is a parameter of every door rather than a member, exactly as
 * `RenovationProjectStore.hydrate` takes its own: the composition root hands a bundle to the
 * VIEW, and a store holding one would outlive the root a settings save retires.
 */
export const useAssetSelectionStore = defineStore('asset-selection', () => {
	const selectedId = ref<AssetId | null>(null);
	const designSection = createTicketedSection<AssetDesignDto | null, AssetDesignError>(null);
	const usageSection = createTicketedSection<UsageReading, RepositoryError>(NO_USAGE);

	function readDesign(queries: AssetLibraryQueryServices, assetId: AssetId): Promise<void> {
		return designSection.run(() => queries.getDesign(assetId));
	}

	/**
	 * Both halves of *Used in*, started together rather than in sequence: they are independent
	 * reads of the same asset, and awaiting one before the other would make the section as slow
	 * as their sum for no gain.
	 *
	 * Either refusing fails the WHOLE section, because a group list with no override marks is
	 * §11 item 6's claim being false by omission — *a price correction reaches every room it was
	 * used in* — rather than a section merely missing a decoration.
	 */
	function readUsedIn(queries: AssetLibraryQueryServices, assetId: AssetId): Promise<void> {
		return usageSection.run(async () => {
			const [groups, overriding] = await Promise.all([
				queries.listReferencing(assetId),
				queries.listOverridingProjects(assetId),
			]);
			if (isErr(groups)) return groups;
			if (isErr(overriding)) return overriding;
			return ok({ groups: groups.value, overriding: overriding.value });
		});
	}

	/**
	 * The gesture. Both reads restart, `null` meaning nothing selected.
	 *
	 * Deliberately NOT guarded on an unchanged id: re-selecting the row that is already selected
	 * restarts both reads, which is what makes a click a usable retry for a failed one — this
	 * surface offers no other.
	 */
	async function select(assetId: AssetId | null, queries: AssetLibraryQueryServices): Promise<void> {
		selectedId.value = assetId;
		if (assetId === null) {
			designSection.clear();
			usageSection.clear();
			return;
		}
		await Promise.all([readDesign(queries, assetId), readUsedIn(queries, assetId)]);
	}

	async function refreshDesign(queries: AssetLibraryQueryServices): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		await readDesign(queries, assetId);
	}

	async function refreshUsedIn(queries: AssetLibraryQueryServices): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		await readUsedIn(queries, assetId);
	}

	/**
	 * Three of `AssetLibraryChange`'s FIVE channels, each mapped to the section it names — and
	 * `replaced` is an arm of BOTH tests rather than a channel of its own, which is the
	 * distinction a reader who counts five fields and infers four semantics loses.
	 *
	 * `design` alone must never restart the vault-wide referencing scan; `usage` alone must never
	 * re-read the sidecar; and `replaced` means both, because a ticket has to follow the ENTRY
	 * rather than the id naming it. An asset deleted and recreated under the same id leaves the
	 * selection unchanged, so nothing else here would move and a pre-deletion answer still in
	 * flight would land as current — populating the replacement with the deleted asset's geometry
	 * or its obsolete referents. `usage` never restates what a replacement already implies, which
	 * is why these are two `||` arms rather than one wider channel.
	 *
	 * The other two channels — `catalogue` and `marks` — are `AssetLibraryStore.applyChange`'s.
	 */
	async function applyChange(
		change: AssetLibraryChange,
		queries: AssetLibraryQueryServices,
	): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;

		const work: Promise<void>[] = [];
		if (change.design.includes(assetId) || change.replaced.includes(assetId)) {
			work.push(refreshDesign(queries));
		}
		if (change.usage.includes(assetId) || change.replaced.includes(assetId)) {
			work.push(refreshUsedIn(queries));
		}
		await Promise.all(work);
	}

	/**
	 * §5.5's BACKSTOP, and the backstop rather than the mechanism: a listing diff can only see an
	 * absence it is actually shown, so a delete and a recreate under one id before either refresh
	 * lands returns the replacement in both listings and this notices nothing. `applyChange`'s
	 * `replaced` arm — `AssetDeleted` and the asset's own `ProjectIndexEntryChanged` — is the
	 * certain, prompt half. This covers what raises no event at all: an entry that simply leaves.
	 *
	 * ABSENCE and never difference. A DTO that has merely changed is a field edit, and restarting
	 * the vault-wide referencing scan for a renamed asset is exactly the over-restart the two
	 * sections exist to prevent.
	 */
	async function applyListing(
		listing: readonly CatalogueEntryDto[],
		queries: AssetLibraryQueryServices,
	): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		if (listing.some((entry) => entry.assetId === assetId)) return;
		await Promise.all([refreshDesign(queries), refreshUsedIn(queries)]);
	}

	/** Rebuilds this store to its opening state (ADR-005), dropping whatever is in flight. */
	function reset(): void {
		selectedId.value = null;
		designSection.clear();
		usageSection.clear();
	}

	return {
		selectedId,
		design: designSection.value,
		designStatus: designSection.status,
		designError: designSection.error,
		usedIn: computed(() => usageSection.value.value.groups),
		/** Which of those projects hold a price override — §11 item 6's unmarked-row claim. */
		overriding: computed(() => usageSection.value.value.overriding),
		usedInStatus: usageSection.status,
		usedInError: usageSection.error,
		select,
		refreshDesign,
		refreshUsedIn,
		applyChange,
		applyListing,
		reset,
	};
});
