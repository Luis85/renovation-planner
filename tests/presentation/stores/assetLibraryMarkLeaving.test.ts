/**
 * §5.4's listing rule for marks (design "Asset library overview"): **an entry LEAVING the
 * listing invalidates its mark** — the case no event announces: a note turned unreadable, a
 * hand-edited id, a delete-and-recreate the events missed. A row whose entry left is not drawn
 * by that listing, so its mark is FORGOTTEN rather than held across a re-read: nothing is read
 * for it, and an id that comes back is read afresh instead of drawing the footprint of the
 * entry that left.
 *
 * Only an APPLIED listing is diffed — §5.5's latest-wins ticket, the index-scan gate and a
 * failed read all leave the marks as they were.
 *
 * Beside `assetLibraryMarkRefresh.test.ts` for that file's reason: `assetLibraryStore.test.ts`'s
 * line budget, and the store as the door a view reaches.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { watch } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useAssetLibraryStore } from '../../../src/presentation/stores/AssetLibraryStore';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { anEntry } from '../../helpers/entities';
import { defer } from '../../helpers/async';

const OLD: AssetOutline = { kind: 'none' };
const NEW: AssetOutline = {
	kind: 'measured',
	points: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	],
	extent: { width: 1, depth: 1 },
	details: [],
};

const READ_FAILED = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'boom' } as const;
const scanned = (): boolean => true;

type Outlines = ReadonlyMap<AssetId, AssetOutline>;
type CatalogueAnswer = Awaited<ReturnType<AssetLibraryQueryServices['listCatalogue']>>;

/** Queries listing `ids`, whose outline reads answer `outline` through a spy. */
function queries(ids: readonly AssetId[], outline: AssetOutline = OLD) {
	const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>((assetIds) =>
		Promise.resolve(new Map(assetIds.map((assetId) => [assetId, outline]))),
	);
	const listing: CatalogueAnswer = ok({ entries: ids.map((assetId) => anEntry({ assetId })), unreadable: [] });
	return { ...unavailableAssetLibraryQueries(), listCatalogue: () => Promise.resolve(listing), listOutlines };
}

/** A store whose applied listing is `ids`, all drawn with `OLD` read, and every value `watched`'s mark takes. */
async function drawn(ids: readonly AssetId[], watched: AssetId) {
	const store = useAssetLibraryStore();
	await store.hydrate(queries(ids), scanned);
	await store.setVisibleMarks(ids, queries(ids));
	const seen: (AssetOutline | null)[] = [];
	watch(() => store.markFor(watched), (mark) => { seen.push(mark); }, { flush: 'sync' });
	return { store, seen };
}

const X = 'asset-x' as AssetId;
const Y = 'asset-y' as AssetId;

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('an entry leaving the listing', () => {
	it('forgets the mark of the entry that left, reads nothing for it, and keeps the rest', async () => {
		const { store, seen } = await drawn([X, Y], Y);
		const refresh = queries([X]);

		await store.hydrate(refresh, scanned);

		expect(seen).toEqual([null]);
		expect(store.markFor(X)).toEqual(OLD);
		expect(refresh.listOutlines).not.toHaveBeenCalled();
	});

	it('reads a returning id afresh, and drops the read that was out when it left', async () => {
		const store = useAssetLibraryStore();
		await store.hydrate(queries([X]), scanned);
		const early = defer<Outlines>();
		const pending = store.setVisibleMarks([X], { ...queries([X]), listOutlines: () => early.promise });
		const seen: (AssetOutline | null)[] = [];
		watch(() => store.markFor(X), (mark) => { seen.push(mark); }, { flush: 'sync' });

		await store.hydrate(queries([]), scanned);
		await store.hydrate(queries([X]), scanned);
		const back = queries([X], NEW);
		await store.setVisibleMarks([X], back);
		early.resolve(new Map([[X, OLD]]));
		await pending;

		expect(back.listOutlines).toHaveBeenCalledWith([X]);
		expect(seen).toEqual([NEW]);
	});

	it('counts the entry that left as undrawn until the caller says otherwise', async () => {
		const { store } = await drawn([X], X);
		await store.hydrate(queries([]), scanned);
		const event = queries([]);

		await store.invalidateMarks([X], event);

		expect(event.listOutlines).not.toHaveBeenCalled();
	});

	it('forgets nothing for a listing that was superseded, refused or taken before the scan', async () => {
		const { store, seen } = await drawn([X], X);
		const slow = defer<CatalogueAnswer>();

		const superseded = store.hydrate({ ...queries([]), listCatalogue: () => slow.promise }, scanned);
		await store.hydrate(queries([X]), scanned);
		slow.resolve(ok({ entries: [], unreadable: [] }));
		await superseded;
		await store.hydrate({ ...queries([]), listCatalogue: () => Promise.resolve(err(READ_FAILED)) }, scanned);
		await store.hydrate(queries([]), () => false);

		expect(seen).toEqual([]);
	});
});
