/**
 * @vitest-environment jsdom
 *
 * AD11's two new tools, driven through the real toolbar and canvas: `draw-line`, the one tool on
 * this surface that writes an OPEN graphic, and `draw-rounded-rect`, one more registration of the
 * drag tool the box and the circle already use.
 *
 * **What these cases exist to say, beyond "the tool works".** The open arm of `AssetDetail` has
 * been in the model since AD04 with nothing in the product able to reach it, so every assertion
 * here about `kind: 'open'` is checking the whole path — the tool, `addDetail`'s widened input,
 * `validateDetails`' open branch, the sidecar's schema-3 write and the read back — rather than one
 * function. `rig.document()` is the document as it stands on "disk", so a case that reads it has
 * already been through a save and a read.
 *
 * Geometry: the rig's camera is 10 mm per screen pixel, so the snap tolerance is 80 mm and the
 * vertex grab radius is measured in SCREEN pixels. Every point below sits well clear of the
 * fixture's corners (±1000) and of its anchor (the origin).
 */
import { describe, expect, it } from 'vitest';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { Point } from '../../../src/core/geometry/Point';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, move, type DesignerRig } from '../../helpers/designerRig';

const SQUARE = expectOk(shapeFromDimensions(2000, 2000));
const QUARTER = Math.tan(Math.PI / 8);
const RUN: readonly Point[] = [{ x: -400, y: -300 }, { x: 0, y: -300 }, { x: 0, y: 200 }];

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function details(rig: DesignerRig) {
	return (await rig.document()).shape?.details ?? [];
}

function key(rig: DesignerRig, init: KeyboardEventInit): void {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

/** Clicks every point of `run` without finishing it. */
function placeRun(rig: DesignerRig, run: readonly Point[] = RUN): void {
	for (const vertex of run) click(rig, vertex);
}

function expectNear(points: readonly Point[], expected: readonly Point[]): void {
	expect(points).toHaveLength(expected.length);
	points.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index].x, 6);
		expect(point.y).toBeCloseTo(expected[index].y, 6);
	});
}

describe('drawing an open line', () => {
	it('writes one OPEN graphic with the clicked vertices, selects it and returns to Select', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig);
		key(rig, { key: 'Enter' });
		await settle();

		const [drawn, ...rest] = await details(rig);
		expect(rest).toEqual([]);
		expect(drawn).toMatchObject({ id: 'detail-1', kind: 'open', name: 'line', line: 'solid', pending: false });
		expectNear(drawn.outline.points, RUN);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	/**
	 * Criterion 2: *one line stroke with zero width or height can be valid without applying the
	 * closed-area validator.* A two-click horizontal run is the shape no closed graphic could be —
	 * `validateDetail` asks a ring to enclose an area and asks a path only for length.
	 */
	it('writes a flat two-point line, which the closed-area rule would have refused', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig, [{ x: -500, y: 400 }, { x: 500, y: 400 }]);
		key(rig, { key: 'Enter' });
		await settle();

		const [drawn] = await details(rig);
		expect(drawn.kind).toBe('open');
		expectNear(drawn.outline.points, [{ x: -500, y: 400 }, { x: 500, y: 400 }]);
		rig.unmount();
	});

	/**
	 * The pointer-only completion, and the LAST vertex is the target rather than the first: a
	 * ring's completion is its closure, a path's is its far end. Judged in screen pixels against
	 * the unsnapped pointer, exactly as `closesPolygon` is.
	 */
	it('finishes on a click back on the last vertex, the way Enter does', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig);
		click(rig, RUN[RUN.length - 1]);
		await settle();

		expectNear((await details(rig))[0].outline.points, RUN);
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	it('finishes nothing on a single vertex, and stays on the tool', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		click(rig, RUN[0]);
		key(rig, { key: 'Enter' });
		await settle();

		expect(await details(rig)).toEqual([]);
		expect(rig.activeToolId()).toBe('draw-line');
		rig.unmount();
	});

	/**
	 * **The preview must not draw the edge the write does not contain.** `DesignerGestureLayer`
	 * binds `closed` to `RenderState.previewClosed`, which this tool is the only writer of; a
	 * `closed: true` preview would promise a triangle where the user is drawing two segments.
	 */
	it('previews the placed run and the rubber band as an OPEN polyline', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig, RUN.slice(0, 2));
		move(rig, RUN[2]);
		await settle();

		const preview = rig.stage.findOne('.detail-preview');
		expect(preview?.getAttr('closed')).toBe(false);
		const drawn: number[] = preview?.getAttr('points') ?? [];
		expect(drawn).toHaveLength(6);
		RUN.flatMap((vertex) => [rig.at(vertex).x, rig.at(vertex).y]).forEach((value, index) => expect(drawn[index]).toBeCloseTo(value, 6));
		rig.unmount();
	});

	it('is one undo entry', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');
		placeRun(rig);
		key(rig, { key: 'Enter' });
		await settle();

		await press(rig, 'designer.toolbar.undo');

		expect(await details(rig)).toEqual([]);
		rig.unmount();
	});

	/**
	 * Escape's two arms, in the order `routeEscape` decides them: a run in progress is a DRAFT, so
	 * the first press discards it and stays on the tool, and only the second — with nothing
	 * placed — returns to Select. `hasDraft()` is what tells the two apart.
	 */
	it('discards a run in progress on Escape, writes nothing, and returns to Select on the next', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');
		placeRun(rig);

		key(rig, { key: 'Escape' });
		await settle();

		expect(await details(rig)).toEqual([]);
		expect(rig.activeToolId()).toBe('draw-line');
		expect(rig.stage.findOne('.detail-preview')).toBeUndefined();

		key(rig, { key: 'Escape' });
		await settle();
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	/**
	 * A repeated click on a vertex that is not the last one places nothing: a doubled point is a
	 * zero-length segment, which every measurement downstream divides through. It is not a
	 * completion either, because completion asks about the LAST vertex only.
	 */
	it('ignores a second click on a vertex that is not the last', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig);
		click(rig, RUN[0]);
		key(rig, { key: 'Enter' });
		await settle();

		const drawn = await details(rig);
		expect(drawn).toHaveLength(1);
		expectNear(drawn[0].outline.points, RUN);
		rig.unmount();
	});

	it('reports a run on an asset with no shape and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const rig = await designerRig();
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig);
		key(rig, { key: 'Enter' });
		await settle();

		expect((await rig.document()).shape).toBeNull();
		expect(Notice.shown).not.toEqual([]);
		rig.unmount();
	});

	it('marks the graphic as awaiting a scale when it is drawn over an uncalibrated sheet', async () => {
		const rig = await designerRig({ shape: SQUARE, background: true });
		await press(rig, 'designer.toolbar.draw-line');

		placeRun(rig);
		key(rig, { key: 'Enter' });
		await settle();

		expect((await details(rig)).map((detail) => detail.pending)).toEqual([true]);
		rig.unmount();
	});
});

describe('drawing a rounded rectangle', () => {
	/**
	 * Eight points and four quarter-circle bulges, at the corners of the drag. The radius is a
	 * quarter of the shorter side and is DERIVED rather than stored (AD11 item 2), so it is checked
	 * here as a fact about the geometry written: 300 is a quarter of the 1200 depth.
	 */
	it('writes one solid detail with four exact quarter-circle corners', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rounded-rect');

		drag(rig, { x: -800, y: -600 }, { x: 800, y: 600 });
		await settle();

		const [drawn, ...rest] = await details(rig);
		expect(rest).toEqual([]);
		expect(drawn).toMatchObject({ id: 'detail-1', name: 'rounded-rectangle', line: 'solid' });
		expect(drawn.kind).toBe('closed');
		expect(drawn.outline.bulges).toEqual([0, QUARTER, 0, QUARTER, 0, QUARTER, 0, QUARTER]);
		expectNear(drawn.outline.points, [
			{ x: -500, y: -600 }, { x: 500, y: -600 },
			{ x: 800, y: -300 }, { x: 800, y: 300 },
			{ x: 500, y: 600 }, { x: -500, y: 600 },
			{ x: -800, y: 300 }, { x: -800, y: -300 },
		]);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-1' });
		expect(rig.activeToolId()).toBe('select');
		rig.unmount();
	});

	it('writes nothing for a drag with no width, and stays on the tool', async () => {
		const rig = await designerRig({ shape: SQUARE });
		await press(rig, 'designer.toolbar.draw-rounded-rect');

		drag(rig, { x: -800, y: -600 }, { x: -800, y: 600 });
		await settle();

		expect(await details(rig)).toEqual([]);
		expect(rig.activeToolId()).toBe('draw-rounded-rect');
		rig.unmount();
	});
});
