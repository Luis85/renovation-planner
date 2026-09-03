/**
 * `AssetSelectionStore` in isolation (design "Asset library overview" §5.5).
 *
 * One subject: the TWO generations this store holds, one per read KIND, and what each of the
 * five `AssetLibraryChange` channels is allowed to restart. §5.5's rule is that the unit of
 * INVALIDATION is the read and the unit of RESTART is the gesture, which is exactly what a
 * single counter cannot express — so most of this file is about which read did NOT re-run.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useAssetSelectionStore } from '../../../src/presentation/stores/AssetSelectionStore';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import type { AssetLibraryChange } from '../../../src/application/events/assetLibraryChangeSource';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import type { ReferencingGroup } from '../../../src/application/queries/ListRequirementsReferencing';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf } from '../../../src/core/money/Money';
import { assetDesign } from '../../helpers/assetDesign';
import { defer } from '../../helpers/async';

type DesignAnswer = Awaited<ReturnType<AssetLibraryQueryServices['getDesign']>>;
type ReferencingAnswer = Awaited<ReturnType<AssetLibraryQueryServices['listReferencing']>>;

const ASSET = createAssetId();
const OTHER = createAssetId();

const READ_FAILED = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'boom' } as const;
const NOT_FOUND = { category: 'Reference', code: 'asset.not-found', message: 'gone' } as const;

const KITCHEN: ReferencingGroup = {
	projectId: 'project-1' as ProjectId,
	projectName: 'Kitchen refit',
	requirementIds: [],
};

/** Nothing invalidated — the arms a case is not about, spelled once. */
const QUIET: AssetLibraryChange = { catalogue: false, marks: [], design: [], usage: [], replaced: [] };

function entryFor(assetId: string): CatalogueEntryDto {
	return {
		assetId: assetId as CatalogueEntryDto['assetId'],
		name: 'Oak plank floor',
		category: 'material',
		unit: 'm2',
		unitCostAmount: '34.95',
		currency: currencyOf('EUR'),
		wasteFactorDefault: '0.08',
		supplier: null,
		sku: null,
		height: null,
		notes: null,
		background: null,
	};
}

/**
 * `listCatalogue` and `listOutlines` REJECT: the listing and the marks are
 * `AssetLibraryStore`'s, and a door that answered here would let a build reading one from
 * this store pass silently — the same convention `renovationProjectStore.test.ts` states.
 */
function queries(overrides: Partial<AssetLibraryQueryServices> = {}): AssetLibraryQueryServices {
	return {
		listCatalogue: () => Promise.reject(new Error('not exercised')),
		listOutlines: () => Promise.reject(new Error('not exercised')),
		getDesign: (assetId) => Promise.resolve(ok(assetDesign({ assetId }))),
		listReferencing: () => Promise.resolve(ok([KITCHEN])),
		listOverridingProjects: () => Promise.resolve(ok([])),
		...overrides,
	};
}

/** The three selection doors, counted — every case here is about which of them ran again. */
function counted(overrides: Partial<AssetLibraryQueryServices> = {}) {
	const base = queries(overrides);
	const getDesign = vi.fn<AssetLibraryQueryServices['getDesign']>(base.getDesign);
	const listReferencing = vi.fn<AssetLibraryQueryServices['listReferencing']>(base.listReferencing);
	const listOverridingProjects = vi.fn<AssetLibraryQueryServices['listOverridingProjects']>(
		base.listOverridingProjects,
	);
	return { ...base, getDesign, listReferencing, listOverridingProjects };
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('AssetSelectionStore selection', () => {
	it('starts with nothing selected and neither section read', () => {
		const store = useAssetSelectionStore();

		expect(store.selectedId).toBeNull();
		expect(store.design).toBeNull();
		expect(store.designStatus).toBe('idle');
		expect(store.usedIn).toEqual([]);
		expect(store.usedInStatus).toBe('idle');
	});

	it('starts both reads on a selection', async () => {
		const store = useAssetSelectionStore();

		await store.select(ASSET, queries());

		expect(store.selectedId).toBe(ASSET);
		expect(store.design?.assetId).toBe(ASSET);
		expect(store.designStatus).toBe('ready');
		expect(store.usedIn).toEqual([KITCHEN]);
		expect(store.overriding).toEqual([]);
		expect(store.usedInStatus).toBe('ready');
	});

	it('clears both sections when the selection is dropped', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.select(null, doors);

		expect(store.selectedId).toBeNull();
		expect(store.design).toBeNull();
		expect(store.designStatus).toBe('idle');
		expect(store.usedIn).toEqual([]);
		expect(store.usedInStatus).toBe('idle');
		expect(doors.getDesign).toHaveBeenCalledTimes(1);
	});

	it('carries each read its own failure, and holds no data behind it', async () => {
		const store = useAssetSelectionStore();

		await store.select(
			ASSET,
			queries({
				getDesign: () => Promise.resolve(err(NOT_FOUND)),
				listReferencing: () => Promise.resolve(err(READ_FAILED)),
			}),
		);

		expect(store.designStatus).toBe('failed');
		expect(store.designError).toEqual(NOT_FOUND);
		expect(store.design).toBeNull();
		expect(store.usedInStatus).toBe('failed');
		expect(store.usedInError).toEqual(READ_FAILED);
		expect(store.usedIn).toEqual([]);
	});

	/**
	 * The OVERRIDE half refusing fails the whole section, not just the marks: §11 item 6 makes an
	 * unmarked row the claim *a price correction reaches every room it was used in* being false
	 * by omission, so a group list drawn without its override marks would state that claim
	 * rather than merely omit a decoration.
	 */
	it('fails Used in when the override read refuses and the groups do not', async () => {
		const store = useAssetSelectionStore();

		await store.select(
			ASSET,
			queries({ listOverridingProjects: () => Promise.resolve(err(READ_FAILED)) }),
		);

		expect(store.usedInStatus).toBe('failed');
		expect(store.usedInError).toEqual(READ_FAILED);
		expect(store.usedIn).toEqual([]);
		expect(store.designStatus).toBe('ready');
	});

	it('drops a late answer for a selection the user has left — its failures too', async () => {
		const slow = defer<DesignAnswer>();
		const store = useAssetSelectionStore();

		const stale = store.select(ASSET, queries({ getDesign: () => slow.promise }));
		await store.select(OTHER, queries());
		slow.resolve(err(NOT_FOUND));
		await stale;

		expect(store.selectedId).toBe(OTHER);
		expect(store.designStatus).toBe('ready');
		expect(store.design?.assetId).toBe(OTHER);
		expect(store.designError).toBeNull();
	});
});

describe('AssetSelectionStore invalidation', () => {
	it('bumps only the invalidated read on a geometry refresh, and both on a selection change', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		// A geometry-only edit must not re-run the vault-wide referencing scan.
		await store.applyChange({ ...QUIET, design: [ASSET] }, doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(2);
		expect(doors.listReferencing).toHaveBeenCalledTimes(1);
		expect(doors.listOverridingProjects).toHaveBeenCalledTimes(1);

		await store.select(OTHER, doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(3);
		expect(doors.listReferencing).toHaveBeenCalledTimes(2);
	});

	/**
	 * The case ONE generation cannot pass, and the one the call counts above cannot see.
	 *
	 * §5.5 names the defect exactly: with a single counter, the design refresh invalidates the
	 * *Used in* read still in flight from the selection, nothing re-delivers to that ticket, and
	 * the section holding it waits for a result that will never come — **loading for ever**, on
	 * the ordinary path of editing a footprint next door while the scan of every requirement in
	 * the vault is still running.
	 */
	it('does not strand a Used in read still in flight when the design is refreshed', async () => {
		const slow = defer<ReferencingAnswer>();
		const store = useAssetSelectionStore();

		const selection = store.select(ASSET, queries({ listReferencing: () => slow.promise }));
		await store.applyChange({ ...QUIET, design: [ASSET] }, queries());
		slow.resolve(ok([KITCHEN]));
		await selection;

		expect(store.usedInStatus).toBe('ready');
		expect(store.usedIn).toEqual([KITCHEN]);
	});

	it('re-reads Used in for a price override and leaves the design alone', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.applyChange({ ...QUIET, usage: [ASSET] }, doors);

		expect(doors.listReferencing).toHaveBeenCalledTimes(2);
		expect(doors.listOverridingProjects).toHaveBeenCalledTimes(2);
		expect(doors.getDesign).toHaveBeenCalledTimes(1);
	});

	it('restarts BOTH reads when the selected entry is replaced', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.applyChange({ ...QUIET, replaced: [ASSET] }, doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(2);
		expect(doors.listReferencing).toHaveBeenCalledTimes(2);
	});

	it('lets no pre-deletion answer populate a same-id replacement', async () => {
		const slow = defer<DesignAnswer>();
		const stale = defer<ReferencingAnswer>();
		const before = assetDesign({ assetId: ASSET, name: 'Before the delete' });
		const store = useAssetSelectionStore();

		const first = store.select(
			ASSET,
			queries({ getDesign: () => slow.promise, listReferencing: () => stale.promise }),
		);
		await store.applyChange(
			{ ...QUIET, replaced: [ASSET] },
			queries({
				getDesign: () => Promise.resolve(ok(assetDesign({ assetId: ASSET, name: 'The replacement' }))),
				listReferencing: () => Promise.resolve(ok([])),
			}),
		);
		slow.resolve(ok(before));
		stale.resolve(ok([KITCHEN]));
		await first;

		expect(store.design?.name).toBe('The replacement');
		expect(store.usedIn).toEqual([]);
	});

	it('ignores a change that names some other asset', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.applyChange({ ...QUIET, design: [OTHER], usage: [OTHER], replaced: [OTHER] }, doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(1);
		expect(doors.listReferencing).toHaveBeenCalledTimes(1);
	});

	it('ignores every change while nothing is selected', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();

		await store.applyChange({ ...QUIET, design: [ASSET], usage: [ASSET], replaced: [ASSET] }, doors);

		expect(doors.getDesign).not.toHaveBeenCalled();
		expect(doors.listReferencing).not.toHaveBeenCalled();
	});

	it('restarts both reads when the selected entry has left an applied listing', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.applyListing([entryFor(OTHER)], doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(2);
		expect(doors.listReferencing).toHaveBeenCalledTimes(2);
	});

	it('leaves both reads alone for a listing the selected entry is still in', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.applyListing([entryFor(ASSET)], doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(1);
		expect(doors.listReferencing).toHaveBeenCalledTimes(1);
	});

	it('has no opinion about a listing while nothing is selected', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();

		await store.applyListing([], doors);

		expect(doors.getDesign).not.toHaveBeenCalled();
	});

	it('re-reads only the design when refreshDesign is asked directly', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();
		await store.select(ASSET, doors);

		await store.refreshDesign(doors);
		await store.refreshUsedIn(doors);

		expect(doors.getDesign).toHaveBeenCalledTimes(2);
		expect(doors.listReferencing).toHaveBeenCalledTimes(2);
	});

	it('refreshes nothing while nothing is selected', async () => {
		const doors = counted();
		const store = useAssetSelectionStore();

		await store.refreshDesign(doors);
		await store.refreshUsedIn(doors);

		expect(doors.getDesign).not.toHaveBeenCalled();
		expect(doors.listReferencing).not.toHaveBeenCalled();
	});

	it('rebuilds to its opening state, invalidating a read still in flight', async () => {
		const slow = defer<DesignAnswer>();
		const store = useAssetSelectionStore();

		const inFlight = store.select(ASSET, queries({ getDesign: () => slow.promise }));
		store.reset();
		slow.resolve(ok(assetDesign({ assetId: ASSET })));
		await inFlight;

		expect(store.selectedId).toBeNull();
		expect(store.design).toBeNull();
		expect(store.designStatus).toBe('idle');
	});
});
