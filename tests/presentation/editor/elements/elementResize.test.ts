import { expect, it, vi } from 'vitest';
import { ElementResize, type ElementResizeDeps } from '../../../../src/presentation/editor/elements/ElementResize';
import { itemTransformBox } from '../../../../src/presentation/editor/elements/transformBox';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';
import { expectDefined } from '../../../helpers/domain';

const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const frame = expectDefined(itemTransformBox(item), 'item frame');
const wider = [{ x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }];

function rig(options: Parameters<typeof toolContext>[0] = {}) {
	const commitResize = vi.fn<NonNullable<ElementResizeDeps['commitResize']>>(), previewResize = vi.fn<NonNullable<ElementResizeDeps['previewResize']>>();
	return { context: toolContext(options).context, commitResize, previewResize, resize: new ElementResize({ commitResize, previewResize }) };
}

it('drags from where the handle was pressed, previews, and commits the release once against the original element', () => {
	const { context, commitResize, previewResize, resize } = rig();
	// Pressed on the padded far corner, 12 px outside (1000, 500) at 1 mm/px.
	resize.start(context, pointerAt(1012, 512), frame, 4);
	resize.move(context, pointerAt(1262, 1012));
	expect(previewResize).toHaveBeenLastCalledWith(item.id, { points: [{ x: 0, y: 0 }, { x: 1250, y: 0 }, { x: 1250, y: 1000 }, { x: 0, y: 1000 }] });
	resize.finish(context, pointerAt(1512, 1012)); resize.finish(context, pointerAt(1512, 1012));
	expect(commitResize).toHaveBeenCalledExactlyOnceWith(item.id, { points: wider }, item);
	expect(previewResize).toHaveBeenLastCalledWith(item.id, { points: wider });
	expect(resize.active).toBe(false);
});

it('treats a press without travel as a click, and Shift as keep proportions', () => {
	const { context, commitResize, previewResize, resize } = rig();
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1013, 512)); resize.finish(context, pointerAt(1013, 512));
	expect(commitResize).not.toHaveBeenCalled(); expect(previewResize).toHaveBeenLastCalledWith(null);
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.finish(context, shiftPointerAt(2012, 612));
	expect(commitResize).toHaveBeenCalledWith(item.id, { points: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1000 }, { x: 0, y: 1000 }] }, item);
});

it('keeps the last valid preview past a limit and cancels a release there', () => {
	const { context, commitResize, previewResize, resize } = rig();
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1262, 1012));
	const last = previewResize.mock.calls.at(-1);
	resize.move(context, pointerAt(-500, 1012));
	expect(previewResize.mock.calls.at(-1)).toEqual(last);
	resize.finish(context, pointerAt(-500, 1012));
	expect(commitResize).not.toHaveBeenCalled(); expect(previewResize).toHaveBeenLastCalledWith(null); expect(resize.active).toBe(false);
});

it('snaps the dragged handle against the plan minus the element, draws guides and clears them', () => {
	const excluded: string[][] = [];
	const { context, commitResize, resize } = rig({ snapCandidates: exclude => { excluded.push([...(exclude ?? [])]); return { vertices: [{ x: 1504, y: 1000 }] }; } });
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.move(context, pointerAt(1512, 1012));
	expect(context.renderState.snapGuides.length).toBeGreaterThan(0);
	expect(excluded.every(ids => ids.includes(item.id))).toBe(true);
	resize.finish(context, pointerAt(1512, 1012));
	expect(commitResize.mock.calls[0]?.[1].points[1]).toEqual({ x: 1504, y: 0 });
	expect(context.renderState.snapGuides).toEqual([]);
});

it('never starts while writes are blocked, with Alt or without a commit, and gives up when writes block mid-drag', () => {
	const { context, commitResize, resize } = rig();
	resize.start(toolContext({ writesBlocked: true }).context, pointerAt(1012, 512), frame, 4); expect(resize.active).toBe(false);
	const alt = pointerAt(1012, 512); resize.start(context, { ...alt, modifiers: { ...alt.modifiers, alt: true } }, frame, 4); expect(resize.active).toBe(false);
	const bare = new ElementResize({}); bare.start(context, pointerAt(1012, 512), frame, 4); expect(bare.active).toBe(false);
	let blocked = false;
	const blockable = { ...context, writesBlocked: () => blocked };
	resize.start(blockable, pointerAt(1012, 512), frame, 4); blocked = true; resize.move(blockable, pointerAt(1512, 1012)); expect(resize.active).toBe(false);
	blocked = false; resize.start(blockable, pointerAt(1012, 512), frame, 4); resize.move(blockable, pointerAt(1512, 1012)); blocked = true; resize.finish(blockable, pointerAt(1512, 1012));
	expect(commitResize).not.toHaveBeenCalled(); expect(resize.active).toBe(false);
	resize.start(context, pointerAt(1012, 512), frame, 4); resize.finish(context, { ...pointerAt(1512, 1012), button: 'secondary' }); expect(resize.active).toBe(true);
	resize.cancel(); resize.move(context, pointerAt(0, 0)); resize.finish(context, pointerAt(0, 0));
	expect(commitResize).not.toHaveBeenCalled();
});

/**
 * The controller ruling (task 5): `resizeTransformBox` only bounds a resized SIDE to
 * [1, 1e6] mm, never the resulting COORDINATE — `validSpatialElement` bounds that
 * separately (abs <= 1e9). An item positioned near that edge with a near-maximal side can
 * pass the side check while a corner lands outside the coordinate bound, so `acceptsElementPoints`
 * has to be asked too, exactly as `ElementMove.finish`'s vertex-drag gate does.
 */
it('does not commit a resize whose result fails acceptsElementPoints, though resizeTransformBox allows it', () => {
	const wide: SpatialElement = {
		id: 'element-far', kind: 'object',
		points: [{ x: 999_900_000, y: 0 }, { x: 1_000_000_000, y: 0 }, { x: 1_000_000_000, y: 500 }, { x: 999_900_000, y: 500 }],
	};
	const wideFrame = expectDefined(itemTransformBox(wide), 'wide item frame');
	const { context, commitResize, previewResize, resize } = rig();
	resize.start(context, pointerAt(1_000_000_000, 500), wideFrame, 4);
	// The far corner's new width (1e6 mm) is within resizeTransformBox's own limit, but the
	// world coordinate it lands at (1,000,900,000) is past validSpatialElement's 1e9 bound.
	resize.move(context, pointerAt(1_000_900_000, 500));
	expect(previewResize).not.toHaveBeenCalled();
	resize.finish(context, pointerAt(1_000_900_000, 500));
	expect(commitResize).not.toHaveBeenCalled();
	expect(previewResize).toHaveBeenLastCalledWith(null);
	expect(resize.active).toBe(false);
});
