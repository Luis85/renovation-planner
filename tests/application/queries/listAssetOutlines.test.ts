/**
 * `ListAssetOutlines` — the Asset Library's batched mark read (design "Asset library
 * overview" §5.3, §3.4). Driven through the real `ObsidianAssetGeometrySidecar` over the
 * in-memory vault, per this codebase's own convention for anything joining the store's read
 * with the domain's validation: a hand-written double answers whatever it was told to, and
 * the rule this query exists for — that a damaged sidecar settles ONLY its own entry — is a
 * property of the real read path, not of a fixture.
 */
import { describe, expect, it } from 'vitest';
import { ListAssetOutlines } from '../../../src/application/queries/ListAssetOutlines';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../src/infrastructure/obsidian/repositories/paths';
import { createRepositoryStack } from '../../helpers/vault';
import { expectOk } from '../../helpers/domain';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { AssetGeometrySidecar } from '../../../src/application/ports/AssetGeometrySidecar';
import type { AssetShape, FootprintOrigin } from '../../../src/domain/asset/AssetShape';

/** 100 wide, 60 deep, so a bounding box read is not a bounding box guessed — copied from
 * `getAssetDesign.test.ts`'s own fixture rather than reinvented. */
const RECTANGLE = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 60 },
	{ x: 0, y: 60 },
];

const shapeWith = (footprintOrigin: FootprintOrigin, footprintPending: boolean): AssetShape => ({
	footprint: { points: [...RECTANGLE] },
	footprintOrigin,
	footprintPending,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
});

/**
 * The identical NEEDLE `getAssetDesign.test.ts` uses for its own "refuses ... rather than
 * measuring it" case: a valid, area-enclosing footprint whose bounding box spans a distance
 * `Number` cannot represent. Copied rather than invented — that file's own docblock records
 * why the vertex order and the needle shape (not the obvious rectangle) are load-bearing.
 */
const overflowingFootprint = (): AssetShape => ({
	...shapeWith('traced', false),
	footprint: {
		points: [
			{ x: 0, y: 1e-300 },
			{ x: 1e308, y: 0 },
			{ x: -1e308, y: 0 },
		],
	},
});

interface OutlinesFixture {
	readonly geometry: AssetGeometrySidecar;
	readonly libraryFolder: string;
	readonly vault: { entries: Map<string, string> };
}

/**
 * A repository stack plus a real port over it, with one measured (`typed`, unpending)
 * rectangle written for each id named. No `Asset` note exists for any of these ids — this
 * query never touches `AssetRepository`, only the geometry sidecar, so a bare branded
 * string is as real an id here as one `createAssetId()` mints.
 */
async function stackWithAssets(ids: readonly string[]): Promise<OutlinesFixture> {
	const stack = createRepositoryStack();
	const geometry = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	for (const id of ids) {
		expectOk(await geometry.write(id as AssetId, { calibration: null, shape: shapeWith('typed', false) }));
	}
	return { geometry, libraryFolder: stack.libraryFolder, vault: stack.vault };
}

/** The bytes a hand edit, a sync conflict or a truncated write would leave: not JSON at all. */
function damageSidecar(stack: OutlinesFixture, id: string): void {
	const path = assetSidecarPathFor(stack.libraryFolder, id as AssetId);
	stack.vault.entries.set(path, 'not json at all');
}

describe('ListAssetOutlines', () => {
	it('settles one damaged sidecar without disturbing the three beside it', async () => {
		const stack = await stackWithAssets(['a', 'b', 'broken', 'd']);
		damageSidecar(stack, 'broken');

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['a', 'b', 'broken', 'd'] as AssetId[],
		});

		expect(answered.get('broken' as AssetId)?.kind).toBe('refused');
		expect(answered.get('a' as AssetId)?.kind).toBe('measured');
		expect(answered.get('b' as AssetId)?.kind).toBe('measured');
		expect(answered.get('d' as AssetId)?.kind).toBe('measured');
		// Never dropped, which is the false-absence rule §3.4's fifth state exists to refuse.
		expect(answered.size).toBe(4);
	});

	it('answers none for an asset with no sidecar, which is the ordinary state', async () => {
		const stack = await stackWithAssets([]);

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['ghost' as AssetId],
		});

		expect(answered.get('ghost' as AssetId)).toEqual({ kind: 'none' });
	});

	it('answers unscaled for a footprint traced before a scale existed', async () => {
		const stack = await stackWithAssets([]);
		expectOk(
			await stack.geometry.write('traced' as AssetId, {
				calibration: null,
				shape: shapeWith('traced', true),
			}),
		);

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['traced' as AssetId],
		});

		expect(answered.get('traced' as AssetId)).toMatchObject({
			kind: 'unscaled',
			extent: { width: 100, depth: 60 },
		});
	});

	it('carries the sidecar path on a refusal so the inspector can name the file', async () => {
		const stack = await stackWithAssets(['broken']);
		damageSidecar(stack, 'broken');

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['broken' as AssetId],
		});

		expect(answered.get('broken' as AssetId)).toMatchObject({
			kind: 'refused',
			code: 'asset-geometry.corrupt',
			sidecarPath: assetSidecarPathFor(stack.libraryFolder, 'broken' as AssetId),
		});
	});

	/**
	 * The other cause of a struck box (§3.4): an id `usableAsFilename` refuses before any
	 * path is derived, so `pathFor`'s own `asset-geometry.unusable-id` refusal — unlike every
	 * other refusal here — carries no `sidecarPath` by construction. A slash is a
	 * filename-forbidden character that `AssetId`'s own type carries no rule against.
	 */
	it('carries no sidecar path for an id that cannot name a file', async () => {
		const stack = await stackWithAssets([]);

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['has/slash' as AssetId],
		});

		expect(answered.get('has/slash' as AssetId)).toEqual({
			kind: 'refused',
			code: 'asset-geometry.unusable-id',
			sidecarPath: undefined,
		});
	});

	/**
	 * A finite vertex set can have a non-finite SPAN, and a mark that cannot be measured is
	 * not one this row can draw — `refused` rather than a fabricated `Infinity` extent, which
	 * is exactly the guard `GetAssetDesign` already applies to the same call. This is the one
	 * behaviour in this file the brief's own four cases do not name; see the task report.
	 */
	it('answers refused, with no sidecar path, for a footprint whose extent overflows', async () => {
		const stack = await stackWithAssets([]);
		expectOk(
			await stack.geometry.write('huge' as AssetId, {
				calibration: null,
				shape: overflowingFootprint(),
			}),
		);

		const answered = await new ListAssetOutlines(stack.geometry).execute({
			assetIds: ['huge' as AssetId],
		});

		expect(answered.get('huge' as AssetId)).toEqual({
			kind: 'refused',
			code: 'dimensions-overflow',
			sidecarPath: undefined,
		});
	});
});
