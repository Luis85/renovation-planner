/**
 * `AssetLibraryStore` in isolation (design "Asset library overview" §5.3, §5.5).
 *
 * Node, not jsdom, for the reason `renovationProjectStore.test.ts` gives for its own sibling:
 * a store is plain reactive state, and needing a DOM to test one would mean the
 * persistent/ephemeral split had leaked into a component.
 *
 * Two subjects, and they are here together because they are one store: the catalogue listing's
 * hydration ticket plus its index-scan gate, and the per-asset mark generations the viewport
 * queue holds behind `requestMarks`/`invalidateMarks`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useAssetLibraryStore } from '../../../src/presentation/stores/AssetLibraryStore';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import type {
	CatalogueEntryDto,
	UnreadableEntry,
} from '../../../src/application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { currencyOf } from '../../../src/core/money/Money';
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
 * `getDesign`, `listReferencing` and `listOverridingProjects` REJECT rather than answer,
 * which is the convention `renovationProjectStore.test.ts` states for the doors its own
 * subject never calls: this store holds the listing and the marks, and the three selection
 * reads belong to `AssetSelectionStore`. A door that answers here would let a build that
 * called one from this store pass silently.
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

	it('answers no-matches rather than no-assets while a search is running', async () => {
		const store = useAssetLibraryStore();
		await store.hydrate(queriesAnswering({}), scanned);

		store.searching = true;

		expect(store.emptyStateKey).toBe('noMatches');
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
});

describe('AssetLibraryStore marks', () => {
	function outlineQueries(answers: ReadonlyMap<AssetId, AssetOutline>): Partial<AssetLibraryQueryServices> {
		return {
			listOutlines: (assetIds) =>
				Promise.resolve(new Map(assetIds.map((assetId) => [assetId, answers.get(assetId) ?? NO_SHAPE]))),
		};
	}

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

		await store.requestMarks([one, two], queries);
		await store.requestMarks([one, two], queries);

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

		const first = store.requestMarks([assetId], queries);
		const second = store.requestMarks([assetId], queries);
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

		const stale = store.requestMarks([assetId], queries);
		store.invalidateMarks([assetId]);
		await store.requestMarks([assetId], queriesAnswering({}, outlineQueries(new Map([[assetId, MEASURED]]))));
		slow.resolve(new Map([[assetId, NO_SHAPE]]));
		await stale;

		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	it('drops the cached mark on invalidation and re-reads it when the row asks again', async () => {
		const assetId = createAssetId();
		const store = useAssetLibraryStore();
		await store.requestMarks([assetId], queriesAnswering({}, outlineQueries(new Map([[assetId, NO_SHAPE]]))));

		store.invalidateMarks([assetId]);
		expect(store.markFor(assetId)).toBeNull();

		await store.requestMarks([assetId], queriesAnswering({}, outlineQueries(new Map([[assetId, MEASURED]]))));

		expect(store.markFor(assetId)).toEqual(MEASURED);
	});

	it('forgets every mark on reset, in flight included', async () => {
		const assetId = createAssetId();
		const slow = defer<ReadonlyMap<AssetId, AssetOutline>>();
		const store = useAssetLibraryStore();

		const inFlight = store.requestMarks([assetId], queriesAnswering({}, { listOutlines: () => slow.promise }));
		store.reset();
		slow.resolve(new Map([[assetId, MEASURED]]));
		await inFlight;

		expect(store.markFor(assetId)).toBeNull();
	});
});

describe('AssetLibraryStore change routing', () => {
	it('re-reads the listing and drops the named marks', async () => {
		const assetId = createAssetId();
		const store = useAssetLibraryStore();
		await store.requestMarks([assetId], queriesAnswering({}, { listOutlines: () => Promise.resolve(new Map([[assetId, MEASURED]])) }));
		await store.hydrate(queriesAnswering({}), scanned);

		await store.applyChange(
			{ catalogue: true, marks: [assetId], design: [], usage: [], replaced: [] },
			queriesAnswering({ entries: [anEntry()] }),
			scanned,
		);

		expect(store.entries).toHaveLength(1);
		expect(store.markFor(assetId)).toBeNull();
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
