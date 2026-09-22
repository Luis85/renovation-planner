/**
 * @vitest-environment jsdom
 *
 * AD18-R14's collision avoidance for `All dimensions` — the rule in `spreadLabels` and what the
 * mounted overlay draws once it has run.
 *
 * **Both halves in one file, and the environment is jsdom for the second one only.** The rule is
 * pure and would run in node; the mounted case reaches `DesignerDimensions.vue`, and a node test
 * that reaches an SFC is refused by `scripts/vitest-no-ssr-sfc.mjs`. One file rather than two
 * because per-file overhead — a jsdom environment and a module registry — is what this suite's own
 * accounting says the cost is.
 *
 * **NOTHING here proves the RENDERED result, and no test in this repository can.** jsdom computes
 * no layout, so every claim below is about the POINTS the rule answers and about the `left`/`top`
 * the template writes from them. Whether two drawn boxes overlap on a screen is a browser
 * measurement; the card's report names what one has to check.
 *
 * The camera is `DEFAULT_VIEWPORT` (`camera: 'default'`) — zoom 0.1, pan (-480, -480) — so
 * `screen = (world + 480) / 10`, and `designerRig`'s stage is 800 x 600. `editableShape()`'s
 * footprint is 1000 x 600 centred on the origin and its clearance is 1400 x 1000 centred on
 * (0, 200): the clearance's top edge is therefore the footprint's, at y = -300, and both are
 * centred on x = 0 — so `clearance-width` and `overall-width` want the SAME point, (48, 18). That
 * is AD18-R14's exact-coincidence defect reproduced from a fixture this repository already had.
 */
import { describe, expect, it } from 'vitest';
import { dimensionFigures, spreadLabels } from '../../../../src/presentation/designer/dimensions/dimensionFigures';
import { screenPoint, worldToScreen, STAGE_PIXELS, type ScreenPoint, type StageSize } from '../../../../src/presentation/editor/viewport/Viewport';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig, type DesignerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';

/** The rig `designerDimensions.test.ts` starts from, so both files reason at one camera. */
const designer = (): Promise<DesignerRig> => designerRig({ shape: editableShape(), camera: 'default' });

const STAGE: StageSize = { width: 800, height: 600 };

/** `[name, left, top]` for every dimension button the overlay draws, in DOM order. */
function drawn(rig: DesignerRig): [string, string, string][] {
	return rig.wrapper.findAll('.rp-designer-dimensions .rp-designer-dimension__value').map((button) => {
		const element = button.element as HTMLElement;
		const wrapper = element.parentElement;
		return [element.dataset['rpDimension'] ?? '', wrapper?.style.left ?? '', wrapper?.style.top ?? ''];
	});
}

const at = (x: number, y: number): ScreenPoint => screenPoint(x, y);

/** Every pair of placed points that would land on one row, as names, so a failure says WHICH. */
function sharing(points: readonly ScreenPoint[], names: readonly string[]): string[] {
	const pairs: string[] = [];
	points.forEach((one, index) => {
		points.slice(index + 1).forEach((other, offset) => {
			if (Math.abs(one.x - other.x) < 40 && Math.abs(one.y - other.y) < 8) {
				pairs.push(`${names[index]} / ${names[index + 1 + offset]}`);
			}
		});
	});
	return pairs;
}

describe('where the designer puts a label that another one would cover', () => {
	/**
	 * **The floor AD18-R14 sets, and the one this card may not trade.** The resting state is two
	 * labels — the overall pair, anchored on the middles of two different edges — and they share no
	 * row, so the rule has to be a no-op on them: the same objects back, at the same points.
	 * A fix that improved the toggle by nudging these has made the feature worse at the state every
	 * user meets first.
	 */
	it('returns an anchor untouched when nothing else wants its row', () => {
		const anchors = [at(48, 18), at(-2, 48)];

		expect(spreadLabels(anchors, STAGE)).toEqual(anchors);
	});

	/**
	 * The defect itself: two anchors on one point. The EARLIER one keeps its place, because
	 * `dimensionFigures` appends the overall pair last and a part's own label has the more specific
	 * subject. One full box height is the step, so the two share no row at all afterwards rather
	 * than merely differing.
	 */
	it('steps a label one box off an anchor that is already taken', () => {
		expect(spreadLabels([at(48, 18), at(48, 18)], STAGE)).toEqual([at(48, 18), at(48, 48)]);
	});

	/**
	 * **Down from the top half and up from the bottom half**, which is `placement`'s own rule and is
	 * there for a measured reason: `.rp-plan-canvas` is `overflow: hidden` and `DesignerCanvas` fits
	 * an asset with 48 px of margin, so an unconditional outward step would push the overall pair
	 * off the top of the canvas, where it is clipped rather than merely moved.
	 */
	it.each([
		['top', 18, 48],
		['bottom', 560, 530],
	])('steps a coincident label away from the nearer edge in the %s half', (_half, y, moved) => {
		expect(spreadLabels([at(48, y), at(48, y)], STAGE)[1]).toEqual(at(48, moved));
	});

	/**
	 * Two anchors are only one label when they share BOTH a row and a column. A pair far enough
	 * apart on either axis is left alone, because the lower or the further one still shows a strip
	 * a user can press — and moving it would scatter an overlay that was merely crowded.
	 */
	it.each([
		['a column apart', at(140, 18)],
		['a row apart', at(48, 38)],
	])('leaves a label that is only %s where it asked to be', (_how, second) => {
		expect(spreadLabels([at(48, 18), second], STAGE)).toEqual([at(48, 18), second]);
	});

	/**
	 * A label is pushed four steps and no further. Uncapped the sweep still terminates, but a label
	 * 700 px from the edge it measures is a worse lie than two labels on one row; the sixth of six
	 * coincident anchors therefore keeps its fourth slot and overlaps the fifth, which is a PARTIAL
	 * overlap and still clickable.
	 */
	it('stops pushing a label after four steps and lets the rest overlap', () => {
		const six = Array.from({ length: 6 }, () => at(48, 18));

		expect(spreadLabels(six, STAGE).map((point) => point.y)).toEqual([18, 48, 78, 108, 138, 138]);
	});

	/**
	 * The rule over the real figure set, at the real camera, in the state AD18-R14 measured: every
	 * drawable part plus the clearance plus the overall pair. Read this narrowly — it asserts that
	 * no two ANCHORS share a row, which is the defect's mechanism, and not that no two rendered
	 * boxes touch. jsdom draws nothing.
	 */
	it('leaves no two labels on one row across the whole All dimensions set', () => {
		const figures = dimensionFigures(editableShape(), null, true, new Set());
		const anchors = figures.map((figure) => worldToScreen(figure.at, { pan: { x: -480, y: -480 }, zoom: 0.1 }, STAGE_PIXELS));
		const names = figures.map((figure) => figure.name);

		expect(sharing(anchors, names)).not.toEqual([]);
		expect(sharing(spreadLabels(anchors, STAGE), names)).toEqual([]);
	});
});

describe('what the mounted overlay draws once the rule has run', () => {
	/**
	 * **The defect, end to end, through the real View menu checkbox.** `clearance-width` and
	 * `overall-width` both want (48, 18) over `editableShape()`; before this card the overall label
	 * was drawn last at that exact point and covered the clearance's outright, so a user could not
	 * press the clearance's reading at all. The two `top` values differing is the whole of what
	 * makes both reachable.
	 */
	it('draws no two All dimensions labels at one point', async () => {
		const rig = await designer();
		try {
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);

			const labels = drawn(rig);
			const places = labels.map(([, left, top]) => `${left}|${top}`);

			expect(labels.map(([name]) => name)).toContain('clearance-width');
			expect(new Set(places).size).toBe(places.length);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * Which one moved, named rather than merely counted: the clearance keeps the anchor and the
	 * overall pair — appended last by `dimensionFigures`, which is why it was the label on top —
	 * steps down into the canvas.
	 *
	 * **THREE boxes rather than one, and that is the cascade rather than a surprise.** The two rows
	 * below the anchor were already taken by `detail-1`'s right offset at (73, 48) and by the
	 * clearance's own top offset, which had been pushed to (48, 78) for the same reason. Written
	 * from the run rather than from arithmetic: the first draft of this case predicted one step,
	 * and hand-walking a greedy sweep over fourteen labels is exactly the arithmetic a person gets
	 * wrong.
	 */
	it('keeps the part’s own label on the anchor and steps the overall one off it', async () => {
		const rig = await designer();
		try {
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);

			expect(drawn(rig)).toContainEqual(['clearance-width', '48px', '18px']);
			expect(drawn(rig)).toContainEqual(['overall-width', '48px', '108px']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * The floor again, at the surface rather than at the rule: with the toggle off the overlay draws
	 * the overall pair exactly where `designerDimensions.test.ts` has always asserted it does.
	 * Selecting a part is the other resting shape and is asserted the same way.
	 */
	it('moves nothing in the resting state, with or without a selection', async () => {
		const rig = await designer();
		try {
			expect(drawn(rig)).toEqual([['overall-width', '48px', '18px'], ['overall-depth', '-2px', '48px']]);

			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();

			// detail-1 is (-400, -100) to (0, 100), so its width label's anchor is (-200, -100) —
			// (28, 38) at this camera — and its left offset's is (-450, 0), which is (3, 48).
			expect(drawn(rig)).toContainEqual(['detail-detail-1-width', '28px', '38px']);
			expect(drawn(rig)).toContainEqual(['overall-width', '48px', '18px']);
		} finally {
			rig.unmount();
		}
	});
});
