/**
 * `AssetLibraryStore` in isolation (design "Asset library overview" §5.3, §5.4, §5.5, §6.1).
 *
 * Node, not jsdom, for the reason `renovationProjectStore.test.ts` gives for its own sibling:
 * a store is plain reactive state, and needing a DOM to test one would mean the
 * persistent/ephemeral split had leaked into a component.
 *
 * Three subjects, here together because they are one store: the catalogue listing's hydration
 * ticket and its index-scan gate, the search field the empty state is decided over, and the
 * per-asset mark generations the viewport queue holds behind `setVisibleMarks`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useAssetLibraryStore } from '../../../src/presentation/stores/AssetLibraryStore';
import { useAssetSelectionStore } from '../../../src/presentation/stores/AssetSelectionStore';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import type {
	CatalogueEntryDto,
	UnreadableEntry,
} from '../../../src/application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf } from '../../../src/core/money/Money';
import { assetDesign } from '../../helpers/assetDesign';
import { defer } from '../../helpers/async';

type CatalogueAnswer = Awaited<ReturnType<AssetLibraryQueryServices['listCatalogue']>>;

const READ_FAILED = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'boom' } as const;

function anEntry(overrides: Partial<CatalogueEntryDto> = {}): CatalogueEntryDto {
	return {
		assetId: createAssetId(),
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
		...overrides,
	};
}

const A_NO_ID_NOTE: UnreadableEntry = {
	assetId: null,
	path: 'Library/broken.md',
	reason: 'no-id',
	code: null,
};

const MEASURED: AssetOutline = {
	kind: 'measured',
	points: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	],
	extent: { width: 1, depth: 1 },
};
const NO_SHAPE: AssetOutline = { kind: 'none' };

/**
 * `getDesign`, `listReferencing` and `listOverridingProjects` REJECT rather than answer, which
 * is the convention `renovationProjectStore.test.ts` states for the doors its own subject never
 * calls. They are still reachable from here — `hydrate` hands every applied listing to
 * `AssetSelectionStore.applyListing` — but only with an asset SELECTED, which no case in this
 * file but the last one does. A rejection is therefore the honest stand-in and the last case
 * supplies its own answering bundle.
 */
function queriesAnswering(
	listing: { entries?: readonly CatalogueEntryDto[]; unreadable?: readonly UnreadableEntry[] },
	overrides: Partial<AssetLibraryQueryServices> = {},
): AssetLibraryQueryServices {
	return {
		listCatalogue: () =>
			Promise.resolve(ok({ entries: listing.entries ?? [], unreadable: listing.unreadable ?? [] })),
		listOutlines: (assetIds) =>
			Promise.resolve(new Map(assetIds.map((assetId) => [assetId, NO_SHAPE]))),
		getDesign: () => Promise.reject(new Error('not exercised')),
		listReferencing: () => Promise.reject(new Error('not exercised')),
		listOverridingProjects: () => Promise.reject(new Error('not exercised')),
		...overrides,
	};
}

/** One outline per requested id, which is `listOutlines`'s own contract. */
function answering(outline: AssetOutline): Partial<AssetLibraryQueryServices> {
	return {
		listOutlines: (assetIds) => Promise.resolve(new Map(assetIds.map((assetId) => [assetId, outline]))),
	};
}

const scanned = (): boolean => true;

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('AssetLibraryStore hydration', () => {
	it('starts idle, holding nothing', () => {
		const store = useAssetLibraryStore();

		expect(store.status).toBe('idle');
		expect(store.entries).toEqual([]);
		expect(store.unreadable).toEqual([]);
		expect(store.emptyStateKey).toBeNull();
	});

	it('holds loading until the index scan has run, whatever the read answers', async () => {
		let hasScanned = false;
		const store = useAssetLibraryStore();

		await store.hydrate(queriesAnswering({}), () => hasScanned);

		expect(store.status).toBe('loading'); // never 'ready' with an empty list
		expect(store.emptyStateKey).toBeNull(); // and never the no-assets invitation

		hasScanned = true;
		await store.hydrate(queriesAnswering({}), () => hasScanned);

		expect(store.status).toBe('ready');
		expect(store.emptyStateKey).toBe('noAssets');
	});

	/**
	 * The window ONE reading of the gate cannot see. The read was issued against an empty index
	 * and the scan finished before it resolved, so a gate asked only afterwards answers true and
	 * publishes that pre-scan `ok([])` as `'ready'` — the duplicate-inviting invitation over a
	 * full catalogue, which is the single defect this gate exists to prevent.
	 */
	it('refuses a listing read before a scan that finished while it was out', async () => {
		let hasScanned = false;
		const store = useAssetLibraryStore();

		await store.hydrate(
			queriesAnswering(
				{},
				{
					listCatalogue: () => {
						hasScanned = true;
						return Promise.resolve(ok({ entries: [], unreadable: [] }));
					},
				},
			),
			() => hasScanned,
		);

		expect(store.status).toBe('loading');
	});

	it('reads the catalogue and the notes it could not draw a row for', async () => {
		const entry = anEntry();
		const store = useAssetLibraryStore();

		await store.hydrate(queriesAnswering({ entries: [entry], unreadable: [A_NO_ID_NOTE] }), scanned);

		expect(store.status).toBe('ready');
		expect(store.entries).toEqual([entry]);
		expect(store.unreadable).toEqual([A_NO_ID_NOTE]);
		expect(store.error).toBeNull();
	});

	it('drops a slower earlier listing, and drops its failures too', async () => {
		const slow = defer<CatalogueAnswer>();
		const entry = anEntry();
		const store = useAssetLibraryStore();

		const first = store.hydrate(queriesAnswering({}, { listCatalogue: () => slow.promise }), scanned);
		await store.hydrate(queriesAnswering({ entries: [entry] }), scanned);
		slow.resolve(err(READ_FAILED));
		await first;

		expect(store.status).toBe('ready');
		expect(store.entries).toEqual([entry]);
		expect(store.error).toBeNull();
	});

	it('leaves no stale rows behind a failed listing', async () => {
		const store = useAssetLibraryStore();
		await store.hydrate(queriesAnswering({ entries: [anEntry()], unreadable: [A_NO_ID_NOTE] }), scanned);

		await store.hydrate(queriesAnswering({}, { listCatalogue: () => Promise.resolve(err(READ_FAILED)) }), scanned);

		expect(store.status).toBe('failed');
		expect(store.entries).toEqual([]);
		expect(store.unreadable).toEqual([]);
		expect(store.error).toEqual(READ_FAILED);
	});

	it('never invites a first asset over a catalogue of damaged notes', async () => {
		const store = useAssetLibraryStore();

		await store.hydrate(queriesAnswering({ entries: [], unreadable: [A_NO_ID_NOTE] }), scanned);

		expect(store.status).toBe('ready');
		expect(store.emptyStateKey).toBeNull();
	});

	it('rebuilds to its opening state, invalidating a hydration still in flight', async () => {
		const slow = defer<CatalogueAnswer>();
		const store = useAssetLibraryStore();
		await store.hydrate(queriesAnswering({ entries: [anEntry()] }), scanned);

		const inFlight = store.hydrate(
			queriesAnswering({}, { listCatalogue: () => slow.promise }),
			scanned,
		);
		store.reset();
		slow.resolve(ok({ entries: [anEntry()], unreadable: [] }));
		await inFlight;

		expect(store.status).toBe('idle');
		expect(store.entries).toEqual([]);
	});

	/**
	 * §5.5's listing backstop, reached through the door that applies a listing rather than
	 * through a call some later task must remember to make.
	 */
	it('tells the selection store about a listing its selected entry has left', async () => {
		const gone = anEntry();
		const getDesign = vi.fn<AssetLibraryQueryServices['getDesign']>((assetId) =>
			Promise.resolve(ok(assetDesign({ assetId }))),
		);
		const doors = queriesAnswering(
			{ entries: [anEntry()] },
			{
				getDesign,
				listReferencing: () => Promise.resolve(ok([])),
				listOverridingProjects: () => Promise.resolve(ok([])),
			},
		);
		const selection = useAssetSelectionStore();
		await selection.select(gone.assetId, doors);

		await useAssetLibraryStore().hydrate(doors, scanned);

		expect(getDesign).toHaveBeenCalledTimes(2);
	});
});

describe('AssetLibraryStore search', () => {
	const OAK = anEntry({ name: 'Oak plank floor', supplier: 'Timberly', sku: 'OAK-12' });
	const TILE = anEntry({ name: 'Wall tile', supplier: 'Ceramica', sku: 'WT-9', notes: 'oak-look glaze' });

	async function hydrated() {
		const store = useAssetLibraryStore();
		await store.hydrate(queriesAnswering({ entries: [OAK, TILE] }), scanned);
		return store;
	}

	it('draws the whole catalogue while the field is empty', async () => {
		const store = await hydrated();

		expect(store.searching).toBe(false);
		expect(store.visibleEntries).toEqual([OAK, TILE]);
		expect(store.emptyStateKey).toBeNull();
	});

	it('matches on name, supplier and SKU, and never on notes', async () => {
		const store = await hydrated();

		store.query = 'timberly';
		expect(store.visibleEntries).toEqual([OAK]);

		store.query = 'WT-9';
		expect(store.visibleEntries).toEqual([TILE]);

		// TILE's notes hold "oak-look glaze"; a notes match would put it in this result.
		store.query = 'oak';
		expect(store.visibleEntries).toEqual([OAK]);
	});

	/**
	 * §4's ***No matches*** row, over a catalogue that is NOT empty — which is the only vault it
	 * describes. Decided over the drawn list rather than over `entries`, because a getter fed the
	 * whole catalogue answers `null` here and the surface draws an empty result list with no
	 * message and no way back.
	 */
	it('answers no-matches for a search that matches nothing in a full catalogue', async () => {
		const store = await hydrated();

		store.query = 'granite';

		expect(store.visibleEntries).toEqual([]);
		expect(store.emptyStateKey).toBe('noMatches');
	});

	it('treats a field holding only whitespace as no search at all', async () => {
		const store = await hydrated();

		store.query = '   ';

		expect(store.searching).toBe(false);
		expect(store.visibleEntries).toEqual([OAK, TILE]);
	});
});

describe('AssetLibraryStore marks', () => {
	it('has no mark for an asset nothing has requested', () => {
		const store = useAssetLibraryStore();

		expect(store.markFor(createAssetId())).toBeNull();
	});

	it('reads a batch once and never re-reads a cached mark', async () => {
		const one = createAssetId();
		const two = createAssetId();
		const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>(queriesAnswering({}).listOutlines);
		const queries = queriesAnswering({}, { listOutlines });
		const store = useAssetLibraryStore();

		await store.setVisibleMarks([one, two], queries);
		await store.setVisibleMarks([one, two], queries);

		expect(listOutlines).toHaveBeenCalledTimes(1);
		expect(listOutlines.mock.calls[0]?.[0]).toEqual([one, two]);
		expect(store.markFor(one)).toEqual(NO_SHAPE);
	});

	it('asks for nothing further while a batch is still in flight', async () => {
		const assetId = createAssetId();
		const slow = defer<ReadonlyMap<AssetId, AssetOutline>>();
		const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>(() => slow.promise);
		const queries = queriesAnswering({}, { listOutlines });
		const store = useAssetLibraryStore();

		const first = store.setVisibleMarks([assetId], queries);
		const second = store.setVisibleMarks([assetId], queries);
		slow.resolve(new Map([[assetId, MEASURED]]));
		await Promise.all([first, second]);

		expect(listOutlines).toHaveBeenCalledTimes(1);
		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	it('drops a late mark answer for an asset whose mark was invalidated meanwhile', async () => {
		const assetId = createAssetId();
		const slow = defer<ReadonlyMap<AssetId, AssetOutline>>();
		const queries = queriesAnswering({}, { listOutlines: () => slow.promise });
		const store = useAssetLibraryStore();

		const stale = store.setVisibleMarks([assetId], queries);
		await store.invalidateMarks([assetId], queriesAnswering({}, answering(MEASURED)));
		slow.resolve(new Map([[assetId, NO_SHAPE]]));
		await stale;

		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	/** §5.4: *a row on screen re-requests IMMEDIATELY*, because no further viewport pass is coming. */
	it('re-reads an invalidated mark at once while its row is on screen', async () => {
		const assetId = createAssetId();
		const store = useAssetLibraryStore();
		await store.setVisibleMarks([assetId], queriesAnswering({}, answering(NO_SHAPE)));

		await store.invalidateMarks([assetId], queriesAnswering({}, answering(MEASURED)));

		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	/** And the other half: *a row that is not … re-requests when it next enters, and never before.* */
	it('leaves an invalidated mark unread while its row is off screen', async () => {
		const assetId = createAssetId();
		const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>(queriesAnswering({}).listOutlines);
		const store = useAssetLibraryStore();
		await store.setVisibleMarks([assetId], queriesAnswering({}, answering(NO_SHAPE)));
		await store.setVisibleMarks([], queriesAnswering({}));

		await store.invalidateMarks([assetId], queriesAnswering({}, { listOutlines }));

		expect(listOutlines).not.toHaveBeenCalled();
		expect(store.markFor(assetId)).toBeNull();

		await store.setVisibleMarks([assetId], queriesAnswering({}, answering(MEASURED)));

		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	it('forgets every mark on reset, in flight included', async () => {
		const assetId = createAssetId();
		const slow = defer<ReadonlyMap<AssetId, AssetOutline>>();
		const store = useAssetLibraryStore();

		const inFlight = store.setVisibleMarks([assetId], queriesAnswering({}, { listOutlines: () => slow.promise }));
		store.reset();
		slow.resolve(new Map([[assetId, MEASURED]]));
		await inFlight;

		expect(store.markFor(assetId)).toBeNull();
	});
});

describe('AssetLibraryStore change routing', () => {
	it('re-reads the listing and the marks it names', async () => {
		const assetId = createAssetId();
		const store = useAssetLibraryStore();
		await store.setVisibleMarks([assetId], queriesAnswering({}, answering(NO_SHAPE)));
		await store.hydrate(queriesAnswering({}), scanned);

		await store.applyChange(
			{ catalogue: true, marks: [assetId], design: [], usage: [], replaced: [] },
			queriesAnswering({ entries: [anEntry()] }, answering(MEASURED)),
			scanned,
		);

		expect(store.entries).toHaveLength(1);
		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	it('leaves the listing alone for a change that names no catalogue', async () => {
		const entry = anEntry();
		const store = useAssetLibraryStore();
		await store.hydrate(queriesAnswering({ entries: [entry] }), scanned);

		await store.applyChange(
			{ catalogue: false, marks: [], design: [entry.assetId], usage: [], replaced: [] },
			queriesAnswering({}, { listCatalogue: () => Promise.reject(new Error('must not be read')) }),
			scanned,
		);

		expect(store.entries).toEqual([entry]);
	});
});
