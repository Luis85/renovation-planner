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

/**
 * Every pair of placed points that would land on one row, as names, so a failure says WHICH.
 *
 * The two numbers are `SAME_COLUMN_PX` and `SAME_ROW_PX` restated rather than imported, which is
 * deliberate: a test that reads the constant it is checking passes when the constant moves. If
 * `spreadLabels` is retuned, this is a second place to edit and the case is meant to go red first.
 */
function sharing(points: readonly ScreenPoint[], names: readonly string[]): string[] {
	const pairs: string[] = [];
	points.forEach((one, index) => {
		points.slice(index + 1).forEach((other, offset) => {
			if (Math.abs(one.x - other.x) < 15 && Math.abs(one.y - other.y) < 8) {
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
	 * **The column reach is a CONTAINMENT bound, not a box width**, so a pair far enough apart along
	 * the row that neither reading can swallow the other whole is left alone even though their boxes
	 * plainly overlap. 20 px is inside a ~33 px label and outside the 15 px bound.
	 *
	 * The first version of this rule used the label's own ~40 px width here, which moved this pair
	 * and every one like it: 79 placements against 60 across ten cameras, for one label MORE left
	 * covered rather than fewer. `SAME_COLUMN_PX` carries that table.
	 */
	it('leaves a pair whose boxes overlap but whose readings cannot contain each other', () => {
		expect(spreadLabels([at(48, 18), at(68, 18)], STAGE)).toEqual([at(48, 18), at(68, 18)]);
	});

	/**
	 * A label is pushed four steps and no further, because an uncapped sweep pushes one clean off a
	 * canvas that is `overflow: hidden`.
	 *
	 * **THE LAST TWO LAND ON ONE POINT, AND THAT IS AD18-R14's ORIGINAL DEFECT SURVIVING AT THE
	 * BOTTOM OF THE FIX FOR IT.** The fifth and sixth both exhaust the cap, so the fifth is painted
	 * under the sixth and cannot be pressed at all. This case exists to PIN that residual rather
	 * than to bless it: the first version of this file called it a partial overlap and therefore
	 * still clickable, which the assertion three lines down already disproved.
	 *
	 * It needs six labels on one point, which is far outside the camera AD18-R14 measured —
	 * `MIN_ZOOM` is 0.01, ten wheel-steps further out. `MAX_STEPS`' docblock carries why neither
	 * alternative dominates.
	 */
	it('stops pushing a label after four steps, and the sixth then hides the fifth', () => {
		const six = Array.from({ length: 6 }, () => at(48, 18));

		const placed = spreadLabels(six, STAGE);

		// The residual FIRST, because vitest stops a case at its first failing expect and this is
		// the assertion the docblock above is about.
		expect(placed[4]).toEqual(placed[5]);
		expect(placed.map((point) => point.y)).toEqual([18, 48, 78, 108, 138, 138]);
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
	 * press the clearance's reading at all.
	 *
	 * **Read the assertion as exactly what it says: DISTINCT POSITIONS, not proven reachability.**
	 * Two labels one pixel apart are distinct and the earlier is still covered whole; jsdom computes
	 * no layout, so nothing here can measure a box or a hit. What this pins is that the defect's own
	 * signature — fourteen labels occupying twelve points — is gone.
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
	 * **TWO boxes rather than one, and that is the cascade rather than a surprise.** The row below
	 * the anchor was already taken by the clearance's own top offset, which had been pushed to
	 * (48, 48) for the same reason. Written from the run rather than from arithmetic: the first
	 * draft of this case predicted one step, and hand-walking a greedy sweep over fourteen labels is
	 * exactly the arithmetic a person gets wrong. (It read THREE boxes while `SAME_COLUMN_PX` was
	 * the label's own width rather than the containment bound.)
	 */
	it('keeps the part’s own label on the anchor and steps the overall one off it', async () => {
		const rig = await designer();
		try {
			await rig.wrapper.get('.rp-designer-tools [data-rp-view="all-dimensions"]').setValue(true);

			expect(drawn(rig)).toContainEqual(['clearance-width', '48px', '18px']);
			expect(drawn(rig)).toContainEqual(['overall-width', '48px', '78px']);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **AD18-R14's floor, at the surface rather than at the rule**: with nothing selected the
	 * overlay draws the two labels the ruling measured, at exactly the pixels
	 * `designerDimensions.test.ts` has always asserted, and this rule moves neither.
	 */
	it('moves neither label of the unselected resting state', async () => {
		const rig = await designer();
		try {
			expect(drawn(rig)).toEqual([['overall-width', '48px', '18px'], ['overall-depth', '-2px', '48px']]);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * **Selecting a part DOES move two of its eight labels, and this case exists to say which.**
	 * An earlier version of it was called "moves nothing … with or without a selection" and asserted
	 * `toContainEqual` on exactly the two labels that stay put, so it read as a floor while the
	 * module's own docblock recorded the movement — the claim was the defect, not the behaviour.
	 *
	 * The behaviour is a FIX rather than a regression, and the distinction is what makes the
	 * renaming sufficient: three of these eight anchors sat on y = 48 before this card
	 * (`detail-1`'s depth at (8, 48), its left offset at (3, 48) and the overall depth at (-2, 48)),
	 * so the selected state was never at zero overlaps. AD18-R14's floor is the state it measured —
	 * the unselected pair above, at zero overlapping pairs — and that is untouched.
	 *
	 * Asserted by EXACT ARRAY, in DOM order, so a future retune cannot move a third label quietly.
	 */
	it('moves two of the eight labels a selected part draws, and names them', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();

			// detail-1 is (-400, -100) to (0, 100), so its width label's anchor is (-200, -100) —
			// (28, 38) at this camera — and its left offset's is (-450, 0), which is (3, 48). That
			// offset and the overall depth are the two that move, each off `detail-1`'s own depth
			// label at (8, 48); every other row here is the anchor untouched.
			expect(drawn(rig)).toEqual([
				['detail-detail-1-width', '28px', '38px'],
				['detail-detail-1-depth', '8px', '48px'],
				['detail-detail-1-offset-left', '3px', '78px'],
				['detail-detail-1-offset-right', '73px', '48px'],
				['detail-detail-1-offset-top', '28px', '28px'],
				['detail-detail-1-offset-bottom', '28px', '68px'],
				['overall-width', '48px', '18px'],
				['overall-depth', '-2px', '108px'],
			]);
		} finally {
			rig.unmount();
		}
	});
});
