// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { fakeQueries, mountPlanEditor, settle, settleUntil } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { defer } from '../../helpers/async';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import type { AssetShapeAnswer } from '../../../src/presentation/read-models/assetShapes';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('loads the shape of every placed asset and answers missing for a deleted one', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await rig.place(radiator.id, { x: 1000, y: 1000 });
	await rig.place('asset-gone', { x: 2000, y: 1000 }, 0, 'Old boiler');
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answers.size === 2, 'asset shapes');
	expect(shapes.answerFor(radiator.id)?.kind).toBe('placeable');
	expect(shapes.shapeOf(radiator.id)?.footprint.points).toHaveLength(4);
	expect(shapes.answerFor('asset-gone')).toEqual({ kind: 'missing' });
});

/**
 * F1: "the latest read wins" is asserted in a comment (`assetShapeLoader.ts`) and enforced by
 * a ticket counter, and had no test of its own. Follows `projectStore.test.ts`'s race-case
 * shape: start a SLOW read, start a second (fresher) one while the first is still open, land
 * the fresh one first, and assert the stale one landing afterwards does not clobber it.
 *
 * Driven through a real trigger (`changeCatalogue`) rather than calling `watchAssetShapes`
 * directly — `onCatalogueChanged` is one of the two doors `load()` listens on.
 */
it('the latest read wins: a stale earlier read does not overwrite a fresher one', async () => {
	const first = defer<ReadonlyMap<string, AssetShapeAnswer>>();
	const second = defer<ReadonlyMap<string, AssetShapeAnswer>>();
	let call = 0;
	const assetShapes = () => (++call === 1 ? first.promise : second.promise);
	const harness = await mountPlanEditor({ queries: { ...fakeQueries(FIXTURE_PLAN), assetShapes } });
	const shapes = useAssetShapeStore(harness.pinia);
	expect(call).toBe(1); // the immediate watch fired the first (slow) read on mount.

	// A catalogue change starts a second read while the first is still in flight.
	harness.changeCatalogue();
	expect(call).toBe(2);

	second.resolve(new Map([['fresh', { kind: 'missing' }]]));
	await settle();
	expect([...shapes.answers.keys()]).toEqual(['fresh']);

	first.resolve(new Map([['stale', { kind: 'missing' }]]));
	await settle();
	expect([...shapes.answers.keys()]).toEqual(['fresh']);

	harness.unmount();
});
