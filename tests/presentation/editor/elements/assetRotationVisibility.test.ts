// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { assetPlacementRig } from '../../../helpers/assetPlacement';
import { settle, settleUntil } from '../../../helpers/editor';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';
import { useAssetShapeStore } from '../../../../src/presentation/stores/AssetShapeStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import { boundsOfZones } from '../../../../src/presentation/editor/viewport/zoneExtent';
import { elementFootprint } from '../../../../src/presentation/editor/elements/elementFootprint';
import { expectDefined } from '../../../helpers/domain';
import { ROTATION_CONTROL_BOTTOM_PX, ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_WIDTH_PX, ROTATION_HANDLE_OFFSET_PX } from '../../../../src/presentation/editor/handleMetrics';

const mounted: Awaited<ReturnType<typeof assetPlacementRig>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

/**
 * F3: `rotationActions.ts`'s `sourceVisible` gained `if (shape.kind === 'asset') return
 * layers.asset;` and nothing failed without it. `handle` is the smallest signal that arm
 * gates — `handleGeometry` reads only the selected `target` and `sourceVisible`, with no
 * hover precondition, unlike `displayControls`/`displayTarget`.
 */
/**
 * G3 (2026-09-11 integration fix, ADR-0027): `lockAllowsCanvas` only looks up a `room`/`area`
 * shape, so a lock on the room a placement stands in has no bearing on the placement's own
 * rotation handle — the invariant `rotationActions.ts`'s own docblock states ("A lock has no
 * bearing on ... a spatial element"). Locking through the same sidebar door
 * `zoneLockRotation.test.ts` uses.
 */
it('keeps a placement\'s rotation handle and canRotateId live when the room around it locks', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	rig.selection.select([id as never]); await settle();
	expect(rig.runtime.rotationActions.handle.value).not.toBeNull();
	expect(rig.runtime.rotationActions.canRotateId(id)).toBe(true);

	await rig.wrapper.get(`[data-rp-lock="${rig.room.id}"]`).trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.locked === true, 'room locked');

	expect(rig.runtime.rotationActions.handle.value).not.toBeNull();
	expect(rig.runtime.rotationActions.canRotateId(id)).toBe(true);
});
it('offers a rotation handle for a selected placement while the Assets layer is visible, and none once it is hidden', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	rig.selection.select([id as never]); await settle();
	expect(rig.runtime.rotationActions.target.value?.id).toBe(id);
	expect(rig.runtime.rotationActions.handle.value).not.toBeNull();
	useWorkspaceStore(rig.pinia).toggleLayer('asset'); await settle();
	expect(rig.runtime.rotationActions.target.value?.id).toBe(id);
	expect(rig.runtime.rotationActions.handle.value).toBeNull();
});

/**
 * I1: the rotation hit is tested before the body (`select-tool.ts`'s `targetAt`), so a handle
 * laid over the footprint turns a press on that part of a selected radiator into a rotation.
 * The anchor→facing-point pair a placement stores is not an outline anyone sees; the handle has
 * to stand off the DERIVED footprint, at every zoom.
 *
 * "Off" is the shared layout's own guarantee and no more: every kind's control rectangle spans
 * 22 px either side of a centre laid 18 px beyond its edge, so each one reaches 4 px across the
 * edge it stands beside — a Room's and an Object's exactly as a placement's. The unfixed layout
 * reached 12 px into the footprint at 10 mm/px, with its centre inside it at closer zooms.
 */
it('lays a selected placement\'s rotation handle off its derived footprint, at two zoom levels', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	const shapes = useAssetShapeStore(rig.pinia), editor = useEditorStore(rig.pinia);
	await settleUntil(() => shapes.answerFor(radiator.id)?.kind === 'placeable', 'asset shape loaded');
	const element = expectDefined(rig.project.structure.elements?.find(item => item.id === id), 'placement');
	const footprint = expectDefined(boundsOfZones([{ points: elementFootprint(element, shapes.shapeOf) }]), 'footprint bounds');
	rig.selection.select([id as never]); await settle();
	for (const factor of [1, 3]) {
		editor.zoomByFactor(worldToScreen({ x: 1000, y: 1000 }, editor.viewport, STAGE_PIXELS), factor); await settle();
		const scale = worldPerScreenPixel(editor.viewport, STAGE_PIXELS);
		const { bounds, handle } = expectDefined(rig.runtime.rotationActions.handleGeometry.value, `handle at ${scale} mm/px`);
		const inside = handle.x > footprint.min.x && handle.x < footprint.max.x && handle.y > footprint.min.y && handle.y < footprint.max.y;
		const depth = Math.max(0, Math.min(Math.min(bounds.max.x, footprint.max.x) - Math.max(bounds.min.x, footprint.min.x), Math.min(bounds.max.y, footprint.max.y) - Math.max(bounds.min.y, footprint.min.y)));
		const sharedReach = (Math.max(ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_BOTTOM_PX, ROTATION_CONTROL_WIDTH_PX / 2) - ROTATION_HANDLE_OFFSET_PX) * scale;
		const at = `handle ${JSON.stringify(bounds)} at ${scale} mm/px, ${depth} mm into footprint ${JSON.stringify(footprint)}`;
		expect({ centreInside: inside, withinSharedReach: depth <= sharedReach + 1e-6, at }).toEqual({ centreInside: false, withinSharedReach: true, at });
	}
});
