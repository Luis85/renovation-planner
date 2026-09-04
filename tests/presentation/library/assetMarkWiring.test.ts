/**
 * @vitest-environment jsdom
 *
 * The Asset library's geometry mark, asked AT THE MOUNT (design "Asset library overview" §3.4,
 * §5.3, §5.4) — the one question no test BELOW the surface could answer, whatever it supplied,
 * because what was missing was the composition and not a component.
 *
 * **Stated that way because the narrower version of it was wrong.** An earlier draft here said
 * each of `AssetShelf`, `AssetRow`, `AssetMark` and `ViewportMarks` "supplies its own outline",
 * which `assetShelf.test.ts`'s *answers "not yet read" for every row when outlineFor is not
 * supplied* falsifies directly — a case that exists for the omission — and eleven of that
 * file's twelve mounts omit the prop. (Named, never addressed by line: the review that caught
 * this claim quoted line numbers, and the numbers are the half that goes stale.) What holds is
 * narrower and is about TYPES: `AssetRow.outline` and `AssetMark.outline` are required, so no
 * mount of either can omit one. And `AssetShelves` is worse than any of them —
 * its only test mount (`shelfFocus.test.ts`, for §6.2's arrow keys) omitted the prop exactly as
 * the production mount did, so nothing anywhere had ever handed that component an outline.
 *
 * **This file exists because four tasks of correct, fully tested work reached no user.**
 * `AssetLibraryBody.vue` mounted `<AssetShelves>` without `:outline-for`, that prop was OPTIONAL
 * with an `undefined` default, so `outlineOf` answered `null` for every row and every mark drew
 * §3.4's *not yet read* state for the life of the view — measured in a browser against the
 * harness fixture: 17 marks, one class. Nothing was wrong with any component; the composition
 * was what nobody asserted. So every case here mounts the REAL root through `mountRoot` and
 * looks at what a row actually draws.
 *
 * **What is asserted is the CLASS on the mark, never a call count**, and that is the whole
 * point of the file: `setVisibleMarks` having been called is equally true of a build whose
 * answers reach no row, which is exactly the defect that shipped.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ok } from '../../../src/core/result/Result';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetOutline } from '../../../src/application/queries/ListAssetOutlines';
import type { CatalogueEntryDto } from '../../../src/application/queries/ListCatalogueEntries';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import type { AssetLibraryChange } from '../../../src/application/events/assetLibraryChangeSource';
import { anEntry, mountRoot } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

const A_FOOTPRINT = [
	{ x: 0, y: 0 },
	{ x: 1200, y: 0 },
	{ x: 1200, y: 190 },
	{ x: 0, y: 190 },
];

const MEASURED: AssetOutline = {
	kind: 'measured',
	points: A_FOOTPRINT,
	extent: { width: 1200, depth: 190 },
};

/**
 * The listing and the outlines, as one bundle — `listOutlines` answers exactly the ids it is
 * asked for, which is its own contract (`ListAssetOutlines`: "The answered map always has
 * exactly one entry per requested id"), so an id this fixture has no outline for reads `none`
 * rather than being dropped.
 */
function queriesFor(
	entries: readonly CatalogueEntryDto[],
	outlines: ReadonlyMap<AssetId, AssetOutline>,
	listOutlines?: AssetLibraryQueryServices['listOutlines'],
): AssetLibraryQueryServices {
	return {
		...unavailableAssetLibraryQueries(),
		listCatalogue: () => Promise.resolve(ok({ entries, unreadable: [] })),
		listOutlines:
			listOutlines ??
			((assetIds) =>
				Promise.resolve(new Map(assetIds.map((id) => [id, outlines.get(id) ?? { kind: 'none' }])))),
	};
}

describe('the geometry mark, through the real mount', () => {
	it('draws a measured mark for an asset whose sidecar answered', async () => {
		const assetId = createAssetId();
		const root = await mountRoot({
			queries: queriesFor([anEntry({ assetId, category: 'material' })], new Map([[assetId, MEASURED]])),
			expanded: ref<readonly string[]>(['material']),
		});
		await settle();

		expect(root.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--measured');
	});

	/**
	 * §5.3's own named hole in the per-shelf bound it replaced: *"Search replaces the shelves
	 * with a flat Results list, so no shelf is ever expanded and every result row would have sat
	 * in* not yet read *for ever — contradicting rule 2 one line below it."* The `searching` arm
	 * of `drawnAssetIds` is the whole of what closes it, and this is the case that reddens if it
	 * is dropped: no shelf here is open, so the else-arm reads nothing at all.
	 */
	it('draws marks for search results, whose shelves are all closed', async () => {
		const assetId = createAssetId();
		const root = await mountRoot({
			queries: queriesFor([anEntry({ assetId, name: 'Oak plank floor' })], new Map([[assetId, MEASURED]])),
			expanded: ref<readonly string[]>([]),
		});

		await root.get('.rp-al-search__input').setValue('oak');
		await settle();

		expect(root.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--measured');
	});

	/**
	 * The BOUND, asserted on both halves — what was asked for, and what the row draws. A case
	 * that only checked the call argument would pass against a build that read nothing at all,
	 * and one that only checked the class would pass against a build that read every sidecar in
	 * the vault and drew the answers correctly.
	 */
	it('asks for nothing on behalf of a closed shelf, and leaves its rows unread', async () => {
		const open = createAssetId();
		const closed = createAssetId();
		const listOutlines = vi.fn<AssetLibraryQueryServices['listOutlines']>((assetIds) =>
			Promise.resolve(new Map(assetIds.map((id) => [id, MEASURED]))),
		);
		const root = await mountRoot({
			queries: queriesFor(
				[
					anEntry({ assetId: open, category: 'material', name: 'A open' }),
					anEntry({ assetId: closed, category: 'fixture', name: 'B closed' }),
				],
				new Map(),
				listOutlines,
			),
			expanded: ref<readonly string[]>(['material']),
		});
		await settle();

		expect(listOutlines.mock.calls.flatMap((call) => call[0])).toEqual([open]);
		const marks = new Map(
			root.findAll('.rp-al-row').map((row) => [
				row.attributes('data-asset-id'),
				row.get('svg.rp-al-mark').classes(),
			]),
		);
		expect(marks.get(open)).toContain('rp-al-mark--measured');
		expect(marks.get(closed)).toContain('rp-al-mark--pending');
	});

	/**
	 * §5.4, end to end and at the ROW rather than at the store: a peer leaf's footprint edit
	 * reaches `onLibraryChanged` as `marks: [assetId]`, the store invalidates, `ViewportMarks`
	 * re-reads at once because that row is drawn, and the mark REDRAWS. Every hop of that chain
	 * had a test before this one; that the chain arrives at a row had none, which is precisely
	 * the gap this file exists for.
	 */
	it('redraws a row whose mark an AssetDesignChanged invalidated', async () => {
		const assetId = createAssetId();
		const answers = [{ kind: 'none' } as AssetOutline, MEASURED];
		let listener!: (change: AssetLibraryChange) => void;
		const root = await mountRoot({
			queries: queriesFor([anEntry({ assetId, category: 'material' })], new Map(), (assetIds) =>
				Promise.resolve(new Map(assetIds.map((id) => [id, answers.shift() ?? MEASURED]))),
			),
			expanded: ref<readonly string[]>(['material']),
			onLibraryChanged: (fn) => {
				listener = fn;
				return () => {};
			},
		});
		await settle();
		expect(root.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--none');

		listener({ catalogue: false, marks: [assetId], design: [], usage: [], replaced: [] });
		await settle();

		expect(root.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--measured');
	});

	/**
	 * §5.5's per-asset generation, asked of the drawn MARK: the first read is still out when an
	 * `AssetDesignChanged` invalidation starts its replacement, the replacement lands first, and
	 * the slower earlier answer must not paint itself over it — *"the stale outline then survives for the
	 * life of the view, which is exactly the guarantee §5.4 exists to give."*
	 *
	 * Watched failing against the mutation rather than reasoned: deleting `viewportMarks.ts`'s
	 * generation comparison flips this row from `measured` to `none`.
	 */
	it('keeps the fresher outline when a slower earlier read lands last', async () => {
		const assetId = createAssetId();
		let releaseFirst!: () => void;
		let call = 0;
		let listener!: (change: AssetLibraryChange) => void;
		const root = await mountRoot({
			queries: queriesFor([anEntry({ assetId, category: 'material' })], new Map(), (assetIds) => {
				call += 1;
				if (call > 1) return Promise.resolve(new Map(assetIds.map((id) => [id, MEASURED])));
				return new Promise((resolve) => {
					releaseFirst = () =>
						resolve(new Map(assetIds.map((id) => [id, { kind: 'none' } as AssetOutline])));
				});
			}),
			expanded: ref<readonly string[]>(['material']),
			onLibraryChanged: (fn) => {
				listener = fn;
				return () => {};
			},
		});
		await settle();

		listener({ catalogue: false, marks: [assetId], design: [], usage: [], replaced: [] });
		await settle();
		releaseFirst();
		await settle();

		expect(call).toBe(2);
		expect(root.get('svg.rp-al-mark').classes()).toContain('rp-al-mark--measured');
	});
});
