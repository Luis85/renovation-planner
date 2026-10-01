/**
 * @vitest-environment jsdom
 *
 * `Design an Asset.md` step 102a: a rounded rectangle dragged by a CANVAS handle keeps its four corners round
 * "through the whole drag" — at its old radius while the box has room, clamped to the largest whole millimetre
 * under half the shorter side once it has not. Sampled MID-drag on the mounted designer, with the button still
 * down, both as the preview the canvas draws from and as the line it drew. The end-to-end case reads the
 * committed field after the release; `selectionDragRoundedRect.test.ts` reads the tool's first preview against
 * a harness context, and only where the radius is kept.
 *
 * The expected radius is taken from the box the preview actually drew rather than from the pointer, because the
 * mounted rig snaps the handle to the footprint's lines within 80 mm.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type Konva from 'konva';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { cornerRadiusOf } from '../../../src/domain/asset/cornerRadius';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { partMeasure } from '../../../src/presentation/designer/selection/partExtent';
import { t } from '../../../src/presentation/i18n/strings';
import { shapeWithRoundedRect } from '../../helpers/assetShapes';
import { click, designerRig, held, type DesignerRig } from '../../helpers/designerRig';
import { expectDefined } from '../../helpers/domain';
import { settle } from '../../helpers/editor';

const ROUNDED = { kind: 'detail', id: 'detail-3' } as const;
/** `ROUNDED_RECT` is 1000 x 600, radius 150, about (20, 30): its bottom-right handle sits on (520, 330). */
const BOTTOM_RIGHT = { x: 520, y: 330 };
/**
 * Mid-drag stops: two with room for 150, then two whose depth (about 240, then about 210) forces the clamp. All
 * four sit clear of the canvas's 40 px edge-scroll band, which a held pointer would otherwise pan the camera in.
 */
const STOPS = [{ x: 420, y: 250 }, { x: 300, y: 120 }, { x: 420, y: -30 }, { x: 300, y: -60 }];
const EDGE_BAND_PX = 40;

let live: DesignerRig | null = null;
afterEach(() => {
	live?.unmount();
	live = null;
});

/** The rule the typed Width/Depth path uses: the old radius if it fits, else the largest whole mm under half the shorter side. */
function expectedRadius(width: number, depth: number): number {
	const half = Math.min(width, depth) / 2;
	return 150 < half ? 150 : Math.ceil(half) - 1;
}

describe('a canvas handle drag of a rounded rectangle, sampled before the release', () => {
	it('draws round corners at every stop — the old radius while it fits, the clamped one once it does not', async () => {
		live = await designerRig({ shape: shapeWithRoundedRect() });
		const rig = live;
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		await settle();
		click(rig, { x: 0, y: 250 });
		await settle();
		const store = useAssetDesignStore(rig.pinia);
		expect(store.selection).toEqual(ROUNDED);

		held(rig, 'pointerdown', BOTTOM_RIGHT, 1);
		const radii: number[] = [];
		for (const stop of STOPS) {
			const at = rig.at(stop);
			expect(Math.min(at.x, at.y, 800 - at.x, 600 - at.y)).toBeGreaterThan(EDGE_BAND_PX);
			held(rig, 'pointermove', stop, 1);
			await settle();
			const preview: AssetShape = expectDefined(store.preview, `a preview at (${String(stop.x)}, ${String(stop.y)})`);
			const box = expectDefined(partMeasure(preview, ROUNDED), 'the dragged part');
			const radius = cornerRadiusOf(expectDefined(preview.details.find((detail) => detail.id === 'detail-3'), 'detail-3'));
			expect(radius).toBe(expectedRadius(box.width, box.depth));
			radii.push(radius as number);

			// What the canvas drew is that preview, arcs and all: its line spans the dragged box and is not four corners.
			const line = expectDefined(rig.stage.findOne<Konva.Line>('#detail-3'), 'the drawn detail');
			const xs = line.points().filter((_value, index) => index % 2 === 0), ys = line.points().filter((_value, index) => index % 2 === 1);
			expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(box.width, 6);
			expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(box.depth, 6);
			expect(xs.length).toBeGreaterThan(4);
		}
		// The sweep reached both arms of the rule, rather than four kept radii.
		expect(radii.slice(0, 2)).toEqual([150, 150]);
		expect(radii.slice(2).every((radius) => radius < 150)).toBe(true);

		held(rig, 'pointerup', STOPS[STOPS.length - 1], 0);
		await settle();
	});
});
