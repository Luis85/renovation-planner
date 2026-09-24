/**
 * @vitest-environment jsdom
 *
 * AD18-R21's two narrowings of the RESTING dimensions, at the mounted surface: the overall pair
 * alone while the footprint draws under 240 px across, and no label over a handle of the selected
 * part. The rules are `restingLabels.test.ts`'s, in node; this file holds the WIRING — that the
 * component asks them at the live camera, with the handles `DesignerCanvas` actually draws.
 *
 * The rig's camera is `DEFAULT_VIEWPORT` (`camera: 'default'`) — zoom 0.1, pan (-480, -480) — so
 * `screen = (world + 480) / 10` and `editableShape()`'s 1000 mm footprint draws 100 px across,
 * under the threshold. jsdom lays nothing out; every pixel here is one the template writes.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { DEFAULT_VIEWPORT } from '../../../../src/presentation/editor/viewport/Viewport';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';

const designer = (): Promise<DesignerRig> => designerRig({ shape: editableShape(), camera: 'default' });

/** Every drawn label's figure name, in DOM order. */
const names = (rig: DesignerRig): string[] => rig.wrapper.findAll('.rp-designer-dimensions .rp-designer-dimension__value')
	.map((button) => (button.element as HTMLElement).dataset['rpDimension'] ?? '');

/** Where one label's wrapper is drawn, read back from the pixels the template wrote. */
function placedAt(rig: DesignerRig, name: string): { x: number; y: number } {
	const style = rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="${name}"]`).element.parentElement?.style;
	return { x: Number.parseFloat(style?.left ?? ''), y: Number.parseFloat(style?.top ?? '') };
}

describe('the resting dimensions while the drawing is small', () => {
	it('rests the overall pair alone under 240 px, every figure past it, and all of them under All dimensions', async () => {
		const rig = await designer();
		try {
			const editor = useEditorStore(rig.pinia);
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();
			// 100 px across.
			expect(names(rig)).toEqual(['overall-width', 'overall-depth']);

			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);
			await settle();
			expect(names(rig)).toContain('detail-detail-1-offset-left');
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(false);
			await settle();

			// 250 px across: zoomed in past the threshold, the part's figures come back.
			editor.viewport = { ...DEFAULT_VIEWPORT, zoom: 0.25 };
			await settle();
			expect(names(rig)).toContain('detail-detail-1-offset-left');

			// 200 px across, and they go again.
			editor.viewport = { ...DEFAULT_VIEWPORT, zoom: 0.2 };
			await settle();
			expect(names(rig)).toEqual(['overall-width', 'overall-depth']);
		} finally {
			rig.unmount();
		}
	});
});

describe('a resting label and the handles the canvas draws', () => {
	/**
	 * With the FOOTPRINT selected, at the camera an asset OPENS with, its top-middle box handle and
	 * its rotate handle lie under the overall width's outside anchor, 15 px above the top edge's
	 * middle. Under Select, the tool the designer rests in and the one that draws handles, the label
	 * moves off them and stays OUTSIDE the footprint rather than going over the drawing (fix round 2 of
	 * AD18-R21). This camera leaves no row above it — the ruler — so it slides along its own row by one
	 * of its widths, 63.6 px for `1000 mm`. In camera mode no handle is drawn, so nothing moves it.
	 */
	it('moves the overall width off drawn handles, further outside, under Select, and leaves it in camera mode', async () => {
		const rig = await designerRig({ shape: editableShape(), camera: 'opened' });
		try {
			const edge = rig.at({ x: 0, y: -300 });
			const anchor = { x: edge.x, y: edge.y - 15 };
			expect(placedAt(rig, 'overall-width')).toEqual(anchor);

			useAssetDesignStore(rig.pinia).select({ kind: 'footprint' });
			await settle();
			expect(rig.activeToolId()).toBe('select');
			const moved = placedAt(rig, 'overall-width');
			expect(moved.y).toBe(anchor.y);
			expect(moved.x).toBeCloseTo(anchor.x + 63.6);
			expect(moved.y + 15).toBeLessThanOrEqual(edge.y);

			rig.toolbarButton(t('en', 'designer.toolbar.pan')).click();
			await settle();
			expect(rig.activeToolId()).toBeNull();
			// Still selected, so it is the TOOL that took the handles away and not the selection.
			expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
			expect(placedAt(rig, 'overall-width')).toEqual(anchor);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **An overall label left ON the edge slides along its own line first** (fix round 3 of AD18-R21).
	 * At the rig's default camera the top edge is at y 18, too near the ruler to stand the width outside
	 * it, so it is drawn on the edge's middle, (48, 18) — the footprint's own top-middle box handle. Its
	 * own row is tried before any other slot: half and one of its 63.6 px widths right still sit on the
	 * right corner handle at (98, 18), and to the left its box runs off the stage, so it takes one and a
	 * half widths right, (143.4, 18). Round 2 sent it to (79.8, 108), over the drawing and below it.
	 */
	it('slides an overall label left on the edge along its own row, off a handle and not over the drawing', async () => {
		const rig = await designer();
		try {
			expect(placedAt(rig, 'overall-width')).toEqual({ x: 48, y: 18 });

			useAssetDesignStore(rig.pinia).select({ kind: 'footprint' });
			await settle();

			const moved = placedAt(rig, 'overall-width');
			expect(moved.x).toBeCloseTo(48 + 1.5 * 63.6);
			expect(moved.y).toBe(18);
		} finally {
			rig.unmount();
		}
	});
});
