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
import { screenPoint, worldToScreen, fitViewport, STAGE_PIXELS, type ScreenPoint, type StageSize } from '../../../../src/presentation/editor/viewport/Viewport';
import { partMeasure } from '../../../../src/presentation/designer/selection/partExtent';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { expectDefined, expectOk } from '../../../helpers/domain';
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

/** Every measured part's box, unioned — what `DesignerCanvas` frames on mount. */
function shapeBounds(shape: AssetShape): { min: { x: number; y: number }; max: { x: number; y: number } } {
	const parts = [{ kind: 'footprint' } as const, { kind: 'clearance' } as const, ...shape.details.map((detail) => ({ kind: 'detail', id: detail.id }) as const)];
	const boxes = parts.map((part) => partMeasure(shape, part)).filter((box) => box !== null);
	return {
		min: { x: Math.min(...boxes.map((box) => box.centre.x - box.width / 2)), y: Math.min(...boxes.map((box) => box.centre.y - box.depth / 2)) },
		max: { x: Math.max(...boxes.map((box) => box.centre.x + box.width / 2)), y: Math.max(...boxes.map((box) => box.centre.y + box.depth / 2)) },
	};
}

/** The label box `labelWidth` models, restated: chrome, one tabular digit each, and ` mm` (AD18-R17). */
const width = (value: number): number => 14 + 6.4 * String(Math.round(value)).length + 24;

/**
 * A label the rule places: where it wants to be, and the number whose digits give it its width.
 * `0` is one glyph and the narrowest box this surface draws — a zero gap draws one — which is why
 * most cases here use a three-digit reading and the union case uses a `0`.
 */
const at = (x: number, y: number, value = 100): { at: ScreenPoint; value: number } => ({ at: screenPoint(x, y), value });
const point = (x: number, y: number): ScreenPoint => screenPoint(x, y);

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

/**
 * The tallest strip of label `index` that no LATER label covers, in pixels — the card's own
 * instrument for AD18-R14's *"impossible to click"*, and a SECOND implementation of the rule's
 * `freeBand` rather than a call to it, because a test that asks the code under test whether it is
 * right has checked nothing. It samples a grid across the box exactly as the browser capture's
 * `elementFromPoint` sweep does, and it models the same width the rule does.
 *
 * **It judges only labels lying fully inside the stage.** The integrator's first reachability sweep
 * scored labels pushed off-screen as "covered" and reported the count RISING with zoom; restricted
 * to labels inside the canvas the honest series fell. A clipped label is a different defect from a
 * covered one, and an instrument that conflates them over-reports.
 */
function clearRows(points: readonly ScreenPoint[], values: readonly number[], stage: StageSize, index: number): number {
	const mine = points[index];
	const half = width(values[index]) / 2;
	if (mine.x - half < 0 || mine.x + half > stage.width || mine.y - 15 < 0 || mine.y + 15 > stage.height) return Number.NaN;
	let free = 0;
	for (let column = 0; column <= 20; column += 1) {
		for (let row = 0; row <= 20; row += 1) {
			const x = mine.x - half + (half * 2 * column) / 20;
			const y = mine.y - 15 + (30 * row) / 20;
			const covered = points.slice(index + 1).some((other, offset) =>
				Math.abs(y - other.y) <= 15 && Math.abs(x - other.x) <= width(values[index + 1 + offset]) / 2);
			if (!covered) free += 1;
		}
	}
	return free;
}

describe('where the designer puts a label that another one would cover', () => {
	/**
	 * **The floor AD18-R14 sets, and the one no round of this card may trade.** The resting state is
	 * two labels — the overall pair, anchored on the middles of two different edges — so nothing
	 * covers anything and the rule has to be a no-op: the same points back.
	 */
	it('returns an anchor untouched when nothing would cover it', () => {
		expect(spreadLabels([at(48, 18), at(-2, 48)], STAGE)).toEqual([point(48, 18), point(-2, 48)]);
	});

	/**
	 * The defect AD18-R14 was written about: two anchors on one point. The EARLIER one keeps its
	 * place, because `dimensionFigures` appends the overall pair last and a part's own label has the
	 * more specific subject.
	 */
	it('steps a label one box off an anchor that is already taken', () => {
		expect(spreadLabels([at(48, 18), at(48, 18)], STAGE)).toEqual([point(48, 18), point(48, 48)]);
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
		expect(spreadLabels([at(48, y), at(48, y)], STAGE)[1]).toEqual(point(48, moved));
	});

	/**
	 * Two anchors are only one label when they share BOTH a row and a column. A pair far enough
	 * apart on either axis is left alone, because the lower or the further one still shows a strip a
	 * user can press — and moving it would scatter an overlay that was merely crowded.
	 */
	it.each([
		['a column apart', at(140, 18)],
		['a row apart', at(48, 38)],
	])('leaves a label that is only %s where it asked to be', (_how, second) => {
		expect(spreadLabels([at(48, 18), second], STAGE)).toEqual([point(48, 18), point(second.at.x, second.at.y)]);
	});

	/**
	 * **The column reach is a CONTAINMENT bound, not a box width**, so a pair far enough apart along
	 * the row that neither reading can swallow the other whole is left alone even though their boxes
	 * plainly overlap. 20 px is inside a ~33 px label and outside the 15 px bound.
	 */
	it('leaves a pair whose boxes overlap but whose readings cannot contain each other', () => {
		expect(spreadLabels([at(48, 18), at(68, 18)], STAGE)).toEqual([point(48, 18), point(68, 18)]);
	});

/**
	 * **The box's width comes from the DIGITS, and this is the case that holds it.** A one-glyph `0`
	 * — which a zero gap really does draw — is about 20 px wide; a four-glyph `1000` is about 40.
	 * Offset 12 px along the row, the wide one still reaches past both of the narrow one's edges and
	 * covers it, while two labels of one nominal width at that offset would not. Both are 9 px
	 * apart vertically, which is outside `SAME_ROW_PX`, so the pairwise rule is not what decides it.
	 *
	 * The three widths this model predicts were measured in a browser to within 0.2 px — 20.5, 26.9
	 * and 33.4 for one, two and three glyphs — which is also where AD18-R14's original 33.4 px box
	 * comes from. It still models ONE font at ONE size; `LABEL_CHROME_PX` says so.
	 */
	it('covers a one-glyph reading with a four-glyph one that a single nominal width would miss', () => {
		expect(spreadLabels([at(600, 120, 0), at(612, 129, 1000)], STAGE)[1]).not.toEqual(point(612, 129));
		expect(spreadLabels([at(600, 120, 1000), at(612, 129, 1000)], STAGE)[1]).toEqual(point(612, 129));
	});

	/**
	 * **THE ROUND 3 DEFECT, AT THE GEOMETRY A BROWSER MEASURED.** `detail-detail-1-offset-top` had
	 * ZERO reachable points in the re-capture, and its three coverers were 10.5, 8.1 and 19.1 px
	 * away — every one of them correctly outside `SAME_ROW_PX`, so the pairwise rule saw no
	 * collision with any of them individually while together they blanketed its whole 30 px height.
	 * Each is also wider than its one-glyph 20.5 px box, so they covered it horizontally too.
	 *
	 * The victim goes FIRST because a label is covered by the ones drawn AFTER it. Nothing here
	 * asserts a position: what is asserted is the property AD18-R14 states, measured by an
	 * instrument that does not ask the rule whether the rule is right.
	 */
	it('keeps a strip of a narrow label clear when three wider ones would blanket it together', () => {
		// The capture's own dy values. Its x offsets — 6.5 px and 3.2 px — are collapsed to zero
		// here on purpose: at the measured offsets the victim's right edge sits 0.05 px outside the
		// widest coverer under this file's width model, so the case would be testing that model to
		// a twentieth of a pixel rather than testing the union rule. The subject is the dy union.
		const victim = at(605.8, 127, 0);
		const coverers = [at(605.8, 137.5, 100), at(605.8, 118.9, 20), at(605.8, 107.9, 20)];
		const values = [victim.value, ...coverers.map((one) => one.value)];

		const before = [victim, ...coverers].map((one) => one.at);
		const after = spreadLabels([victim, ...coverers], { width: 1280, height: 800 });

		expect(clearRows(before, values, { width: 1280, height: 800 }, 0)).toBe(0);
		expect(clearRows(after, values, { width: 1280, height: 800 }, 0)).toBeGreaterThan(0);
		expect(after[0]).toEqual(victim.at);
	});

	/**
	 * The union rule is about the UNION and this is the pair that proves it is not two pairwise
	 * checks in a coat: either coverer alone leaves the victim a strip and is left where it asked to
	 * be, and the second one — which together with the first would blanket it — is the one that
	 * moves.
	 */
	it('moves the second of two coverers that are each harmless alone', () => {
		const victim = at(600, 120, 0);
		const above = at(600, 108, 100);
		const below = at(600, 132, 100);

		expect(spreadLabels([victim, above], STAGE)).toEqual([victim.at, above.at]);
		expect(spreadLabels([victim, below], STAGE)).toEqual([victim.at, below.at]);
		expect(spreadLabels([victim, above, below], STAGE)[2]).not.toEqual(below.at);
	});

	/**
	 * A label is pushed four steps and no further, because an uncapped sweep pushes one clean off a
	 * canvas that is `overflow: hidden`.
	 *
	 * **The residual at the cap is now BOUNDED and pinned rather than mis-described.** Five slots
	 * cannot hold six labels, so one must repeat another — this case asserts exactly that, and no
	 * more than that. What round 3 changed is WHICH: the rule used to take the last slot it had
	 * stepped to, so the fifth and sixth both landed on the fourth step; it now scores the five
	 * candidates and takes the emptiest, which is free and is the difference between two dead labels
	 * and none on the browser-measured frame.
	 */
	it('stops pushing a label after four steps, and then repeats a slot rather than inventing one', () => {
		const placed = spreadLabels(Array.from({ length: 6 }, () => at(48, 18)), STAGE);
		const rows = placed.map((one) => one.y);

		expect(rows.slice(0, 5)).toEqual([18, 48, 78, 108, 138]);
		expect(new Set(rows).size).toBe(5);
		expect(rows.every((row) => row >= 18 && row <= 138)).toBe(true);
	});

	/**
	 * The rule over the real figure set, at the real camera, in the state AD18-R14 measured. Read
	 * this narrowly — it asserts that no two ANCHORS share a row, which is the pairwise half, and
	 * not that no two rendered boxes touch. jsdom draws nothing.
	 */
/**
	 * **THE FRAME THE BROWSER MEASURED, END TO END.** The vanity preset is the shape the re-capture
	 * used, `All dimensions` draws 26 labels over it, and at the camera `DesignerCanvas` fits on
	 * mount TWO of them had no reachable point anywhere in their box —
	 * `detail-detail-1-offset-top` and `clearance-offset-top`, both narrow readings under wider
	 * neighbours. This case reconstructs that frame from the real preset and the real `fitViewport`,
	 * asserts the defect is present without the rule, and asserts every label keeps a strip with it.
	 *
	 * It is also the case that holds the SCORED FALLBACK at the cap: the smaller pure cases above
	 * all pass with the older "take the last slot stepped to", and only at this density does the
	 * difference between the two show up as a label nobody can press.
	 *
	 * **A 1280 x 800 stage is an approximation of the leaf the capture used** and the numbers here
	 * are this model's, not the browser's — the report carries the comparison. What is not an
	 * approximation is which two labels die without the rule: those are the capture's own.
	 */
	it('leaves every label of the vanity’s All dimensions frame a strip, at the camera it opens with', () => {
		const preset = expectDefined(ASSET_PRESETS.find((one) => one.id === 'vanity'), 'the vanity preset');
		const shape = expectOk(preset.build(defaultValues(preset)));
		const stage: StageSize = { width: 1280, height: 800 };
		const camera = expectDefined(fitViewport(shapeBounds(shape), stage, 48, 1), 'the fit camera');
		const figures = dimensionFigures(shape, null, true, new Set());
		const anchors = figures.map((figure) => ({ at: worldToScreen(figure.at, camera, STAGE_PIXELS), value: figure.value }));
		const values = figures.map((figure) => figure.value);
		const blind = (points: readonly ScreenPoint[]): string[] => figures
			.map((figure, index) => [figure.name, clearRows(points, values, stage, index)] as const)
			.filter(([, clear]) => clear === 0)
			.map(([name]) => name);

		expect(figures).toHaveLength(26);
		expect(blind(anchors.map((one) => one.at))).toEqual(['detail-detail-1-offset-top', 'clearance-offset-top']);
		expect(blind(spreadLabels(anchors, stage))).toEqual([]);
	});

	it('leaves no two labels on one row across the whole All dimensions set', () => {
		const figures = dimensionFigures(editableShape(), null, true, new Set());
		const anchors = figures.map((figure) => ({ at: worldToScreen(figure.at, { pan: { x: -480, y: -480 }, zoom: 0.1 }, STAGE_PIXELS), value: figure.value }));
		const names = figures.map((figure) => figure.name);

		expect(sharing(anchors.map((one) => one.at), names)).not.toEqual([]);
		expect(sharing(spreadLabels(anchors, STAGE), names)).toEqual([]);
	});

	/**
	 * **Every label in that set keeps a pressable strip**, which is the whole of AD18-R14's
	 * constraint and the thing the pairwise rule alone could not deliver. Measured with
	 * `clearRows`, which is this file's own reimplementation rather than a call into the rule.
	 */
	it('leaves every label in the All dimensions set a strip nothing covers', () => {
		const figures = dimensionFigures(editableShape(), null, true, new Set());
		const anchors = figures.map((figure) => ({ at: worldToScreen(figure.at, { pan: { x: -480, y: -480 }, zoom: 0.1 }, STAGE_PIXELS), value: figure.value }));
		const placed = spreadLabels(anchors, STAGE);
		const values = figures.map((figure) => figure.value);

		const blind = figures
			.map((figure, index) => [figure.name, clearRows(placed, values, STAGE, index)] as const)
			.filter(([, clear]) => clear === 0);

		expect(blind).toEqual([]);
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
	 * **A selected part's eight labels are the RESTING state, and since AD18-R17 none of them may
	 * touch another** — `separateLabels`, not `spreadLabels`. At this rig's zoomed-out camera the
	 * part is 40 x 20 px and its labels are ~55 px wide, so most of them move: the case pins WHERE,
	 * by exact array in DOM order rounded to a tenth of a pixel, so a retune cannot move one quietly,
	 * and asserts the property itself with this file's own box model.
	 *
	 * The first label keeps its anchor (earlier wins). A MOVED label never leaves the stage, which is
	 * why `detail-1`'s depth and left offset jump right, off the left edge.
	 *
	 * **And this camera shows the rule's one residual, pinned rather than hidden.** `overall-depth`,
	 * placed last, finds every slot within reach either taken or off the stage, so it stays on its
	 * anchor and touches `detail-1`'s width — `separateLabels`' "no slot is free" arm. At the camera
	 * the designer OPENS with, the floor AD18-R17 names, `restingLabels.test.ts` finds no such frame.
	 */
	it('keeps a selected part’s labels apart but for one the zoomed-out camera leaves no slot', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select({ kind: 'detail', id: 'detail-1' });
			await settle();

			const labels = drawn(rig).map(([name, left, top]) => [name, Math.round(Number.parseFloat(left) * 10) / 10, Number.parseFloat(top)] as const);
			expect(labels).toEqual([
				['detail-detail-1-width', 28, 38],
				['detail-detail-1-depth', 36.6, 78],
				['detail-detail-1-offset-left', 31.6, 108],
				['detail-detail-1-offset-right', 101.6, 48],
				['detail-detail-1-offset-top', 113.8, 88],
				['detail-detail-1-offset-bottom', 56.6, 158],
				['overall-width', 111.6, 18],
				['overall-depth', -2, 48],
			]);
			const values = [400, 200, 100, 500, 200, 200, 1000, 600];
			const touching = labels.flatMap(([name, x, y], index) => labels.slice(index + 1)
				.filter(([, ox, oy], offset) => Math.abs(x - ox) < (width(values[index]) + width(values[index + 1 + offset])) / 2 && Math.abs(y - oy) < 30)
				.map(([other]) => `${name} / ${other}`));
			expect(touching).toEqual(['detail-detail-1-width / overall-depth']);
		} finally {
			rig.unmount();
		}
	});
});
