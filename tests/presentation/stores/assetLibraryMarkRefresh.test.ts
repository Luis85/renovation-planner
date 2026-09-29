/**
 * A drawn row's mark across its own re-read (design "Asset library overview" §5.4, amended
 * 2026-09-29): the row keeps the mark it has until the re-read answers, and the answer replaces
 * it in one step — never through §3.4's *not yet read*. The flash this closes was caught by the
 * Browse 3 pixel guard on Linux CI, where a late re-read put a drawn row back to three dots
 * between a class poll and a capture.
 *
 * Its own file rather than `assetLibraryStore.test.ts`, whose line budget this would exhaust;
 * asked through the store for the reason `viewportMarks.ts`'s header gives — the store is what a
 * view reaches. What is asserted is every value `markFor` TAKES, through a synchronous watcher,
 * because a final-state read cannot tell "replaced" from "blanked, then filled".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { watch } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAssetLibraryStore } from '../../../src/presentation/stores/AssetLibraryStore';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../src/domain/asset/AssetId';

const OLD: AssetOutline = { kind: 'none' };
const NEW: AssetOutline = {
	kind: 'measured',
	points: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
	],
	extent: { width: 1, depth: 1 },
};

type Outlines = ReadonlyMap<AssetId, AssetOutline>;

/** A `listOutlines` answer the case settles by hand, either way. */
function held() {
	let fulfil!: (outlines: Outlines) => void;
	let refuse!: (error: Error) => void;
	let asked: readonly AssetId[] = [];
	const answer = new Promise<Outlines>((resolve, reject) => {
		fulfil = resolve;
		refuse = reject;
	});
	const resolve = (outline: AssetOutline): void => { fulfil(new Map(asked.map((assetId) => [assetId, outline]))); };
	const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>((assetIds) => {
		asked = assetIds;
		return answer;
	});
	return { queries: queriesWith(listOutlines), listOutlines, resolve, reject: refuse };
}

function queriesWith(listOutlines: AssetLibraryQueryServices['listOutlines']): AssetLibraryQueryServices {
	return { ...unavailableAssetLibraryQueries(), listOutlines };
}

const answering = (outline: AssetOutline) =>
	queriesWith((assetIds) => Promise.resolve(new Map(assetIds.map((assetId) => [assetId, outline]))));

/** A store drawing `assetId` with `OLD` read, and every value its mark takes from here on. */
async function drawnWithOld(assetId: AssetId) {
	const store = useAssetLibraryStore();
	await store.setVisibleMarks([assetId], answering(OLD));
	const seen: (AssetOutline | null)[] = [];
	watch(() => store.markFor(assetId), (mark) => { seen.push(mark); }, { flush: 'sync' });
	return { store, seen };
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('a drawn mark across its re-read', () => {
	it('keeps the drawn mark until the re-read answers, then replaces it in one step', async () => {
		const assetId = createAssetId();
		const { store, seen } = await drawnWithOld(assetId);
		const read = held();

		const invalidated = store.invalidateMarks([assetId], read.queries);

		expect(read.listOutlines).toHaveBeenCalledWith([assetId]);
		expect(store.markFor(assetId)).toEqual(OLD);
		read.resolve(NEW);
		await invalidated;

		expect(seen).toEqual([NEW]);
	});

	it('lets no older read overwrite the answer that replaced a held mark', async () => {
		const assetId = createAssetId();
		const { store, seen } = await drawnWithOld(assetId);
		const first = held();
		const second = held();

		const stale = store.invalidateMarks([assetId], first.queries);
		const fresh = store.invalidateMarks([assetId], second.queries);
		second.resolve(NEW);
		await fresh;
		first.resolve(OLD);
		await stale;

		expect(seen).toEqual([NEW]);
	});

	it('drops a held mark whose re-read failed, and reads it again on the next pass', async () => {
		const assetId = createAssetId();
		const { store, seen } = await drawnWithOld(assetId);
		const read = held();

		const invalidated = store.invalidateMarks([assetId], read.queries);
		read.reject(new Error('boom'));

		await expect(invalidated).rejects.toThrow('boom');
		expect(seen).toEqual([null]);

		await store.setVisibleMarks([assetId], answering(NEW));

		expect(seen).toEqual([null, NEW]);
	});

	it('keeps a held mark when a read it no longer waits on fails', async () => {
		const assetId = createAssetId();
		const { store, seen } = await drawnWithOld(assetId);
		const first = held();
		const second = held();

		const superseded = store.invalidateMarks([assetId], first.queries);
		const fresh = store.invalidateMarks([assetId], second.queries);
		first.reject(new Error('boom'));
		await expect(superseded).rejects.toThrow('boom');

		expect(store.markFor(assetId)).toEqual(OLD);
		second.resolve(NEW);
		await fresh;

		expect(seen).toEqual([NEW]);
	});

	/**
	 * Same-id replacement: a row that stops being drawn while its re-read is out — an asset
	 * deleted, the catalogue refresh taking its row away — still has that read's answer replace
	 * the held mark, so the old footprint outlives one read at most. Invalidated again while
	 * undrawn (the same id recreated), it is dropped, and drawn again it is read afresh.
	 */
	it('holds the old footprint for one read at most, drawn or not', async () => {
		const assetId = createAssetId();
		const { store, seen } = await drawnWithOld(assetId);
		const read = held();

		const invalidated = store.invalidateMarks([assetId], read.queries);
		await store.setVisibleMarks([], answering(OLD));
		read.resolve(NEW);
		await invalidated;

		expect(seen).toEqual([NEW]);

		await store.invalidateMarks([assetId], answering(OLD));

		expect(seen).toEqual([NEW, null]);

		await store.setVisibleMarks([assetId], answering(NEW));

		expect(seen).toEqual([NEW, null, NEW]);
	});
});
