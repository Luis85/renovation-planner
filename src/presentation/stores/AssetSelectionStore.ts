import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { AssetLibraryChange } from '../../application/events/assetLibraryChangeSource';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { ReferencingGroup } from '../../application/queries/ListRequirementsReferencing';
import type { AssetId } from '../../domain/asset/AssetId';
import type { ProjectId } from '../../domain/project/ProjectId';
import { createTicketedSection, type SectionStatus } from '../library/ticketedSection';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

const NO_GROUPS: readonly ReferencingGroup[] = [];
const NO_OVERRIDES: readonly ProjectId[] = [];

/**
 * How far a REGION got, from the two sections it is composed of — the less advanced of the two,
 * so a region is only as finished as its least finished half.
 *
 * Written as a rank rather than a chain of pair tests because the pair tests are where the
 * §5.5 harm hides: *groups ready, marks re-reading* has to answer `ready`, and every spelling
 * that reaches for "is either one loading" answers `loading` and flaps `Delete` off. Here it
 * cannot arise at all, because `TicketedSection.run` leaves a section that already holds an
 * answer at `'ready'` while it re-reads.
 */
const SECTION_RANK: Record<SectionStatus, number> = { failed: 0, loading: 1, idle: 2, ready: 3 };

function lessAdvanced(one: SectionStatus, other: SectionStatus): SectionStatus {
	return SECTION_RANK[one] <= SECTION_RANK[other] ? one : other;
}

/**
 * The inspector's subject: which asset is selected, and the reads §3.5 draws it from.
 *
 * **THREE generations, one per read KIND** (design spec §5.5), each held by its own
 * `TicketedSection`. §5.5's rule is *the unit of invalidation is the read, and the unit of
 * restart is the gesture*, and the reads are three because three different things invalidate
 * them:
 *
 * | Section | Restarted by |
 * | --- | --- |
 * | `design` (`GetAssetDesign`) | a selection, `design`, `replaced` |
 * | `referencing` (`ListRequirementsReferencing`) | a selection, `replaced` |
 * | `overriding` (`ListAssetPriceOverrides`) | a selection, `usage`, `replaced` |
 *
 * **`usage` restarts the override read ALONE, and this is the half a join loses.** The two
 * spellings §5.5 records as broken are both counter-sharing, and joining the two *Used in*
 * doors under one ticket is the second of them wearing a different trigger: an
 * `AssetPriceOverrideChanged` raised in any project for the selected asset would re-run
 * `ListRequirementsReferencing` — which reaches EVERY requirement note in the vault
 * (§3.5: `listByAsset` enumerates `getIdsByType('renovation-requirement')` and reads each note
 * before applying the asset predicate, and calling that bounded by the asset's own referents is
 * recorded there as the sharpest mistake on this branch) — and flip the region to `loading`,
 * which §3.5 turns into `Delete` unavailable. That is §5.5's own named `Delete`-flap, arriving
 * on a price trigger. A price change cannot alter which requirements reference an asset.
 *
 * The two halves are composed into ONE region rather than joined into one read: `usedInStatus`
 * is the less advanced of the two, and both `usedIn` and `overriding` blank while that region
 * has failed. That is what §11 item 6 actually asks for — a refused override read must not let
 * an UNMARKED row be drawn, because an unmarked row is the claim *a price correction reaches
 * every room it was used in* being false by omission — and it needs a composed status, never a
 * shared ticket.
 *
 * A result whose ticket is no longer current is DROPPED, successes and failures alike: a late
 * failure paints §3.5's refusal over a selection that read perfectly well.
 *
 * `queries` is a parameter of every door rather than a member, exactly as
 * `RenovationProjectStore.hydrate` takes its own: the composition root hands a bundle to the
 * VIEW, and a store holding one would outlive the root a settings save retires.
 */
export const useAssetSelectionStore = defineStore('asset-selection', () => {
	const selectedId = ref<AssetId | null>(null);
	/**
	 * The ids of the last listing `applyListing` was shown — the only state that can tell an entry
	 * LEAVING from one that has been absent all along. Not a `ref`: nothing renders it, and it is
	 * read exactly once per applied listing.
	 */
	let listed: ReadonlySet<AssetId> = new Set();
	const designSection = createTicketedSection<AssetDesignDto | null, AssetDesignError>(null);
	const referencingSection = createTicketedSection<readonly ReferencingGroup[], RepositoryError>(NO_GROUPS);
	const overridingSection = createTicketedSection<readonly ProjectId[], RepositoryError>(NO_OVERRIDES);

	function readDesign(queries: AssetLibraryQueryServices, assetId: AssetId): Promise<void> {
		return designSection.run(() => queries.getDesign(assetId));
	}

	function readReferencing(queries: AssetLibraryQueryServices, assetId: AssetId): Promise<void> {
		return referencingSection.run(() => queries.listReferencing(assetId));
	}

	function readOverriding(queries: AssetLibraryQueryServices, assetId: AssetId): Promise<void> {
		return overridingSection.run(() => queries.listOverridingProjects(assetId));
	}

	/**
	 * The gesture. Every section is CLEARED first and then restarted, which is the blank moment
	 * `TicketedSection.run` deliberately no longer takes for itself: a selection change replaces
	 * the subject, so holding one asset's figures under another asset's name for the tick the
	 * reads are out is the *silently wrong panel* every store here is written against.
	 *
	 * Deliberately NOT guarded on an unchanged id: re-selecting the row that is already selected
	 * restarts every read, which is what makes a click a usable retry for a failed one — this
	 * surface offers no other.
	 */
	async function select(assetId: AssetId | null, queries: AssetLibraryQueryServices): Promise<void> {
		selectedId.value = assetId;
		designSection.clear();
		referencingSection.clear();
		overridingSection.clear();
		if (assetId === null) return;
		await Promise.all([
			readDesign(queries, assetId),
			readReferencing(queries, assetId),
			readOverriding(queries, assetId),
		]);
	}

	async function refreshDesign(queries: AssetLibraryQueryServices): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		await readDesign(queries, assetId);
	}

	/** The whole region — both halves. What a REPLACED entry and a vanished listing row buy. */
	async function refreshUsedIn(queries: AssetLibraryQueryServices): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		await Promise.all([readReferencing(queries, assetId), readOverriding(queries, assetId)]);
	}

	/** The override marks ALONE — what a price change in some other project actually invalidates. */
	async function refreshOverriding(queries: AssetLibraryQueryServices): Promise<void> {
		const assetId = selectedId.value;
		if (assetId === null) return;
		await readOverriding(queries, assetId);
	}

	/**
	 * Three of `AssetLibraryChange`'s FIVE channels, each mapped to the section it names — and
	 * `replaced` is an arm of BOTH tests rather than a channel of its own, which is the
	 * distinction a reader who counts five fields and infers five semantics loses.
	 *
	 * `replaced` means both because a ticket has to follow the ENTRY rather than the id naming
	 * it. An asset deleted and recreated under the same id leaves the selection unchanged, so
	 * nothing else here would move and a pre-deletion answer still in flight would land as
	 * current — populating the replacement with the deleted asset's geometry or its obsolete
	 * referents.
	 *
	 * The `else` is that contract's other half: `usage` never restates what a replacement
	 * already implies, so an id in both channels takes the wider restart once rather than
	 * re-reading the override marks twice.
	 *
	 * The other two channels — `catalogue` and `marks` — are `AssetLibraryStore.applyChange`'s,
	 * and that function is also this one's ONLY caller: a whole change arrives at one door and is
	 * split there, never at a subscription that can route half of it. It routed half of it from
	 * the task that mounted the subscription until the branch's final review;
	 * `AssetLibraryStore.applyChange`'s header carries what that cost, and why the split moved
	 * rather than being remembered.
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
		if (change.replaced.includes(assetId)) {
			work.push(refreshUsedIn(queries));
		} else if (change.usage.includes(assetId)) {
			work.push(refreshOverriding(queries));
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
	 * **A TRANSITION, never a standing absence**, which is what §5.4 and §5.5 both word it as —
	 * *an entry LEAVING*, *a listing that removes*. Asking `listing.some(...)` alone re-reads on
	 * every catalogue refresh for as long as the selected id is missing, and eight event types
	 * feed that arm: a selection whose asset is genuinely gone would re-run the vault-wide
	 * referencing scan once per synced note and flip a failed design section back to `loading`
	 * each time. So the ids of the PREVIOUSLY applied listing are held, and the restart is
	 * `previously present AND now absent`.
	 *
	 * A restored view state naming an asset no listing has ever held therefore restarts nothing —
	 * correctly: `select` already read it, and the answer to *is this asset there* is the one that
	 * read gave.
	 *
	 * ABSENCE and never difference. A DTO that has merely changed is a field edit, and restarting
	 * the vault-wide referencing scan for a renamed asset is the over-restart three sections
	 * exist to prevent.
	 *
	 * There is deliberately no `selectedId === null` early exit before the bookkeeping: the three
	 * refresh doors carry that guard already, and a fourth copy could not change behaviour — a
	 * branch no mutation can redden is a branch that reads as checked and is not.
	 * `AssetLibraryStore.hydrate` is its only caller and calls it on EVERY applied listing, so
	 * this runs constantly with nothing selected and must record the listing regardless.
	 */
	async function applyListing(
		listing: readonly CatalogueEntryDto[],
		queries: AssetLibraryQueryServices,
	): Promise<void> {
		const previouslyListed = listed;
		listed = new Set(listing.map((entry) => entry.assetId));

		const assetId = selectedId.value;
		if (assetId === null) return;
		if (!previouslyListed.has(assetId) || listed.has(assetId)) return;
		await Promise.all([refreshDesign(queries), refreshUsedIn(queries)]);
	}

	/** Rebuilds this store to its opening state (ADR-005), dropping whatever is in flight. */
	function reset(): void {
		selectedId.value = null;
		listed = new Set();
		designSection.clear();
		referencingSection.clear();
		overridingSection.clear();
	}

	const usedInStatus = computed(() =>
		lessAdvanced(referencingSection.status.value, overridingSection.status.value),
	);

	return {
		selectedId,
		design: designSection.value,
		designStatus: designSection.status,
		designError: designSection.error,
		usedInStatus,
		/**
		 * Blank while the region has FAILED, which is §11 item 6 made structural rather than a
		 * rule Task 14 has to remember: a group list drawn without its override marks states
		 * *a price correction reaches every room it was used in* and is false by omission, so a
		 * refused override read must take the groups down with it even though the referencing
		 * section read perfectly well and still holds them.
		 */
		usedIn: computed(() => (usedInStatus.value === 'failed' ? NO_GROUPS : referencingSection.value.value)),
		/** Which of those projects hold a price override — §11 item 6's marks, gated identically. */
		overriding: computed(() =>
			usedInStatus.value === 'failed' ? NO_OVERRIDES : overridingSection.value.value,
		),
		usedInError: computed(() => referencingSection.error.value ?? overridingSection.error.value),
		select,
		refreshDesign,
		refreshUsedIn,
		refreshOverriding,
		applyChange,
		applyListing,
		reset,
	};
});
