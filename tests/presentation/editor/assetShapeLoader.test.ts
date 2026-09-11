// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { fakeQueries, mountPlanEditor, settle, settleUntil } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { defer } from '../../helpers/async';
import { expectDefined, expectOk } from '../../helpers/domain';
import { useAssetShapeStore } from '../../../src/presentation/stores/AssetShapeStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import type { AssetShapeAnswer } from '../../../src/presentation/read-models/assetShapes';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';
import { elementFootprint, NO_SHAPES } from '../../../src/presentation/editor/elements/elementFootprint';
import { assetShapesFor } from '../../../src/presentation/editor/elements/assetShapeLoader';
import { createAssetCatalogueChangeSource } from '../../../src/application/events/assetCatalogueChangeSource';
import { assetDesignChanged } from '../../../src/domain/asset/Asset.events';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';

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

/**
 * I2: a list row's click runs `selectAndFrame` with no injection context, and every view's
 * mount reassigns Pinia's module-global active instance. So the lookup has to come from what
 * this leaf registered at setup, never from whichever Pinia happens to be active at click time.
 */
it('frames a placement from a list by its real footprint while another Pinia is active, creating no store there', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia), editor = useEditorStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	const element = expectDefined(rig.project.structure.elements?.find(item => item.id === id), 'placement');
	editor.fitTo(expectDefined(boundsOfZones([{ points: elementFootprint(element, shapes.shapeOf) }]), 'footprint bounds'), editor.stageSize);
	const expected = editor.viewport;
	editor.zoomByFactor(screenPoint(0, 0), 5);
	expect(editor.viewport).not.toEqual(expected);
	const foreign = createPinia();
	setActivePinia(foreign);
	try { rig.runtime.selectAndFrame(id); } finally { setActivePinia(rig.pinia); }
	expect(editor.viewport).toEqual(expected);
	expect(foreign.state.value['asset-shapes']).toBeUndefined();
	expect(assetShapesFor(rig.project)).toBe(shapes.shapeOf);
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	expect(assetShapesFor(rig.project)).toBe(NO_SHAPES);
});

/**
 * I3 (ruling R19): a designer commit publishes `AssetDesignChanged`, and an open plan has to
 * re-read on it or keep a stale outline, hit area, clearance and dimension line. The rig's
 * catalogue door is a fake listener set, so the real source is bridged onto it here.
 */
it('re-reads a placed asset\'s shape when its design changes', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia), wider = expectOk(shapeFromDimensions(1200, 600));
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	const dispose = createAssetCatalogueChangeSource(rig.stack.events)(rig.changeCatalogue);
	try {
		expectOk(await new ObsidianAssetGeometrySidecar(rig.stack.assetGeometry).write(radiator.id, { calibration: null, shape: wider }));
		await rig.stack.events.publish(assetDesignChanged({ assetId: radiator.id }));
		await settleUntil(() => JSON.stringify(shapes.shapeOf(radiator.id)?.footprint) === JSON.stringify(wider.footprint), 'the re-read shape');
		expect(shapes.shapeOf(radiator.id)?.footprint).toEqual(wider.footprint);
	} finally { dispose(); }
});
