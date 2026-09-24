/**
 * `separateLabels` — the RESTING state's floor (AD18-R17): with `All dimensions` off, no two labels
 * may share any area, at the camera the designer opens with, at any leaf width.
 *
 * AD18-R14 set that floor and it was only ever measured at a 1280 leaf. At a 460 leaf, with the
 * vanity's basin selected, the eight labels overlapped in five pairs (`360/126`, `360/800`,
 * `270/220`, `220/450`, `126/800`) — every one pressable, so `spreadLabels`' two rules, both about a
 * label being COVERED, could not see them.
 *
 * **The box is this file's own model, restated rather than imported**: 14 px of chrome, 6.4 px per
 * digit and 24 px for ` mm`, 30 px tall — a test that reads the constant it checks passes when the
 * constant moves. It is a MODEL: jsdom draws nothing, and the rendered count is the integrator's.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dimensionFigures, outsideAnchor, restingFigures, separateLabels } from '../../../../src/presentation/designer/dimensions/dimensionFigures';
import { fitViewport, screenPoint, STAGE_PIXELS, worldPerScreenPixel, worldToScreen, type ScreenPoint, type StageSize } from '../../../../src/presentation/editor/viewport/Viewport';
import { partMeasure } from '../../../../src/presentation/designer/selection/partExtent';
import { selectionHandles } from '../../../../src/presentation/designer/selection/handles';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../../src/domain/asset/presets/presetGeometry';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { propertyOf, stylesheetRules } from '../../../helpers/selectors';

const STAGE: StageSize = { width: 800, height: 600 };
const width = (value: number): number => 14 + 6.4 * String(Math.round(value)).length + 24;
const at = (x: number, y: number, value = 100): { at: ScreenPoint; value: number } => ({ at: screenPoint(x, y), value });

/** Every pair of placed labels whose modelled boxes share any area, as `value/value`. */
function overlapping(points: readonly ScreenPoint[], values: readonly number[]): string[] {
	const pairs: string[] = [];
	points.forEach((one, index) => {
		points.slice(index + 1).forEach((other, offset) => {
			const next = index + 1 + offset;
			if (Math.abs(one.x - other.x) < (width(values[index]) + width(values[next])) / 2 && Math.abs(one.y - other.y) < 30) {
				pairs.push(`${String(Math.round(values[index]))}/${String(Math.round(values[next]))}`);
			}
		});
	});
	return pairs;
}

/**
 * Every placed label whose modelled box reaches into a handle's GRAB square — `VERTEX_GRAB_RADIUS_PX`,
 * 8 px, each way, restated rather than imported — as `value@x,y`. A label there takes the press
 * the handle was meant to get, since the overlay paints over the stage (AD18-R21).
 */
function covering(points: readonly ScreenPoint[], values: readonly number[], handles: readonly ScreenPoint[]): string[] {
	return points.flatMap((one, index) => handles
		.filter((handle) => Math.abs(one.x - handle.x) < width(values[index]) / 2 + 8 && Math.abs(one.y - handle.y) < 15 + 8)
		.map((handle) => `${String(Math.round(values[index]))}@${handle.x.toFixed(1)},${handle.y.toFixed(1)}`));
}

/** The box `DesignerCanvas` fits on mount: the footprint and the clearance (`designFrame`). */
function frame(shape: AssetShape): { min: { x: number; y: number }; max: { x: number; y: number } } {
	const boxes = [partMeasure(shape, { kind: 'footprint' }), partMeasure(shape, { kind: 'clearance' })].filter((box) => box !== null);
	return {
		min: { x: Math.min(...boxes.map((box) => box.centre.x - box.width / 2)), y: Math.min(...boxes.map((box) => box.centre.y - box.depth / 2)) },
		max: { x: Math.max(...boxes.map((box) => box.centre.x + box.width / 2)), y: Math.max(...boxes.map((box) => box.centre.y + box.depth / 2)) },
	};
}

/**
 * One resting frame at the fit camera: the anchors, where the rule draws them, and their values.
 * The anchors are the ones `DesignerDimensions.vue` hands the rule — the overall pair first run
 * through `outsideAnchor` — so this is the frame the component draws, not an earlier one.
 *
 * **`'drawn'` is that frame since AD18-R21**: the figures thinned by `restingFigures` while the
 * footprint is small on screen, and the selection's Transform handles — the mode a selection
 * starts in, under Select, which the designer rests in — handed to the rule as obstacles.
 * **`'every'`** is the frame before it, every figure and no handle: what `separateLabels` is
 * handed on its own, which is the subject of the cases that measured its reach.
 */
function resting(shape: AssetShape, selection: DesignerSelection | null, stage: StageSize, drawn: 'drawn' | 'every' = 'drawn') {
	const camera = expectDefined(fitViewport(frame(shape), stage, 48, 1), 'the fit camera');
	const worldPerPixel = worldPerScreenPixel(camera, STAGE_PIXELS);
	const measured = dimensionFigures(shape, selection, false, new Set());
	const figures = drawn === 'drawn' ? restingFigures(measured, shape, worldPerPixel) : measured;
	const handles = drawn === 'drawn' ? selectionHandles(shape, selection, 'transform', worldPerPixel).map((handle) => worldToScreen(handle.at, camera, STAGE_PIXELS)) : [];
	const raw = figures.map((figure) => worldToScreen(figure.at, camera, STAGE_PIXELS));
	const anchors = figures.map((figure, index) => {
		const point = raw[index];
		return { at: figure.outside ? outsideAnchor(figure.axis, point, figure.value) : point, value: figure.value };
	});
	return {
		raw,
		anchors: anchors.map((anchor) => anchor.at),
		placed: separateLabels(anchors, stage, handles),
		values: figures.map((figure) => figure.value),
		handles,
		names: figures.map((figure) => figure.name),
	};
}

const preset = (id: string): AssetShape => {
	const found = expectDefined(ASSET_PRESETS.find((one) => one.id === id), id);
	return expectOk(found.build(defaultValues(found)));
};

describe('where a resting label is drawn', () => {
	/** The floor's other half: a label nothing touches stays exactly on its anchor. */
	it('leaves labels that touch nothing where they asked to be', () => {
		expect(separateLabels([at(100, 100), at(300, 100)], STAGE)).toEqual([screenPoint(100, 100), screenPoint(300, 100)]);
	});

	/**
	 * A label touching one already placed takes the NEAREST free slot. Here the half-width shifts
	 * along the row are nearer (28.6 px) but still touch, so it is the row one height in — down from
	 * the stage's top half, up from its bottom half, `spreadLabels`' own direction rule.
	 */
	it.each([
		['top', 100, 130],
		['bottom', 500, 470],
	])('moves a touching label one row inward from the %s half', (_half, y, moved) => {
		expect(separateLabels([at(100, y), at(110, y)], STAGE)[1]).toEqual(screenPoint(110, moved));
	});

	/**
	 * **A slot off the stage is refused**, because the canvas clips it. On a stage one label high
	 * below the 18 px ruler strip the rows above and below are both out, a whole width sideways still
	 * touches, and the slot to the LEFT at one and a half widths runs onto the left ruler and off the
	 * stage — so the label goes right.
	 */
	it('refuses a slot the stage would clip, and shifts sideways instead', () => {
		const [, moved] = separateLabels([at(100, 33), at(100, 33)], { width: 260, height: 63 });

		expect(moved?.x).toBeCloseTo(100 + 1.5 * width(100));
		expect(moved?.y).toBe(33);
	});

	/**
	 * **A slot on the rulers' strip is refused too**, as `outsideAnchor` refuses one: a label paints
	 * above the rulers and would cover the scale. The row one height up — nearer than any free
	 * sideways slot, and inside the stage — would put this label's box at 5 to 35 px, over the 18 px
	 * strip, so it goes one and a half widths right instead.
	 */
	it('refuses a slot on the rulers’ strip', () => {
		const [, moved] = separateLabels([at(100, 50), at(100, 50)], { width: 260, height: 90 });

		expect(moved?.x).toBeCloseTo(100 + 1.5 * width(100));
		expect(moved?.y).toBe(50);
	});

	/** With no free slot at all it stays on its anchor: an overlap drawn honestly, not a label hidden. */
	it('keeps a label on its anchor when no slot is free', () => {
		expect(separateLabels([at(30, 15), at(30, 15)], { width: 60, height: 30 })).toEqual([screenPoint(30, 15), screenPoint(30, 15)]);
	});
});

/**
 * **The OVERALL pair stands outside the footprint when the canvas has room** (board 01): a width's
 * line 15 px above the top edge — half a 30 px label, so the label's box sits wholly outside the
 * outline and exactly fills the 30 px the fit camera leaves between the 18 px ruler and its 48 px
 * margin — and a depth's 36 px left of the left edge, half the widest overall label (a five-glyph
 * reading, 70 px) plus one. With no room — the label would run under the ruler — it stays on the edge.
 */
describe('where an overall dimension stands', () => {
	it.each([
		['a width, at the fit camera’s 48 px margin', 'x', at(200, 48, 1000), screenPoint(200, 33)],
		['a width with a pixel less', 'x', at(200, 47, 1000), screenPoint(200, 47)],
		['a depth with room', 'y', at(100, 200, 600), screenPoint(64, 200)],
		['a depth whose label would reach the ruler', 'y', at(82, 200, 600), screenPoint(82, 200)],
	] as const)('places %s', (_case, axis, anchor, expected) => {
		expect(outsideAnchor(axis, anchor.at, anchor.value)).toEqual(expected);
	});

	/** The 18 px `outsideAnchor` measures room against is the rulers' strip, declared in their partial. */
	it('measures room against the rulers’ own strip', () => {
		const declared = stylesheetRules(readFileSync('styles/designer-rulers.css', 'utf8'))
			.flatMap((rule) => rule.declarations.filter((entry) => propertyOf(entry) === '--rp-designer-ruler-size').map((entry) => entry.value));
		const reference = stylesheetRules('.reference { --rp-designer-ruler-size: 18px; }')[0]?.declarations[0]?.value;

		expect(declared).toEqual([reference]);
	});
});

describe('the resting floor at the fit camera', () => {
	/**
	 * **AD18-R17's measured defect, reproduced and closed.** 458 x 330 approximates the canvas at a
	 * 460 leaf (the regions stack and the canvas takes half the body); at it the vanity's basin, drawn
	 * as the surface drew it before this card — every label on its raw anchor — has every pair the
	 * browser found, and `separateLabels` over the same eight leaves none.
	 *
	 * **Over the `'every'` frame since AD18-R21**, which rests the overall pair ALONE at this leaf
	 * (the footprint draws about 178 px across here, under `restingFigures`' 240). The eight are what
	 * the rule is handed once the user zooms past that, so its reach is still the subject.
	 */
	it('separates the five pairs a 460 leaf overlapped with the vanity’s basin selected', () => {
		const { raw, placed, values } = resting(preset('vanity'), { kind: 'detail', id: 'detail-2' }, { width: 458, height: 330 }, 'every');

		expect(overlapping(raw, values)).toEqual(expect.arrayContaining(['360/126', '360/800', '270/220', '220/450', '126/800']));
		expect(overlapping(placed, values)).toEqual([]);
	});

	/**
	 * **Every catalogue preset, every resting selection, at the four leaf widths the floor names** —
	 * the canvas each is modelled as, since jsdom lays nothing out: about 880 x 650 at 1280, 380 x 650
	 * at 760, 290 x 620 at 580 (68.8% of the leaf at 1280, half at 760 and 580) and 458 x 330 at 460. The integrator measures the
	 * real ones.
	 *
	 * **And no label on a handle of the selected part** (AD18-R21), over the same frames, since the
	 * handles are obstacles in the same slot search rather than a second rule after it.
	 */
	it('leaves no two labels touching and no label on a handle, for any preset, selected part or leaf width', () => {
		const stages: StageSize[] = [{ width: 880, height: 650 }, { width: 380, height: 650 }, { width: 290, height: 620 }, { width: 458, height: 330 }];
		const failures = ASSET_PRESETS.flatMap((one) => {
			const shape = preset(one.id);
			const selections: (DesignerSelection | null)[] = [null, { kind: 'clearance' }, ...shape.details.map((detail) => ({ kind: 'detail' as const, id: detail.id }))];
			return stages.flatMap((stage) => selections.flatMap((selection) => {
				const { placed, values, handles } = resting(shape, selection, stage);
				return [...overlapping(placed, values), ...covering(placed, values, handles)]
					.map((pair) => `${one.id} ${JSON.stringify(selection)} ${String(stage.width)}: ${pair}`);
			}));
		});

		expect(failures).toEqual([]);
	});

	/**
	 * **The frames that set `RESTING_ROWS` at five.** With the overall pair outside the footprint
	 * and moved labels kept off the rulers, an armchair's or a sofa's second detail on a canvas under
	 * 640 px crowds the top band so that three or four rows of reach leave its `600/800` or `700/900`
	 * pair touching. Five rows separate them; this case goes red below that.
	 *
	 * **Over the `'every'` frame since AD18-R21**, because the case is about the rule's reach and
	 * the `'drawn'` frame changes its input: the armchair's footprint draws about 139 px across here,
	 * under 240, so the component rests its overall pair alone; the sofa's about 302, above it, but that
	 * frame hands the rule the detail's handles too, which is a second question in the same search.
	 */
	it.each([
		['armchair', 320, 340],
		['sofa', 480, 300],
	] as const)('separates the %s’s second detail on a %i x %i canvas, where a shorter reach could not', (id, stageWidth, stageHeight) => {
		const { placed, values } = resting(preset(id), { kind: 'detail', id: 'detail-2' }, { width: stageWidth, height: stageHeight }, 'every');

		expect(overlapping(placed, values)).toEqual([]);
	});
});

/**
 * **AD18-R21: while the footprint draws under 240 px across, the resting labels are the overall pair
 * alone.** Measured over the vanity at a fit camera: about 470 px across at a 1280 leaf, 285 at 760,
 * 190 at 580 and 170 at 460, where the detail labels nearly covered the drawing. The four canvases
 * are the ones the floor above models, which put the footprint at 422, 284, 194 and 178 px.
 */
describe('the resting set while the drawing is small', () => {
	const vanity = preset('vanity');
	const basin: DesignerSelection = { kind: 'detail', id: 'detail-2' };
	const footprint = expectDefined(partMeasure(vanity, { kind: 'footprint' }), 'the footprint').width;
	const every = dimensionFigures(vanity, basin, false, new Set()).map((figure) => figure.name);

	it.each([
		['just under 240 px', 239.9, ['overall-width', 'overall-depth']],
		['at 240 px', 240, every],
	] as const)('rests %s', (_case, pixels, names) => {
		expect(restingFigures(dimensionFigures(vanity, basin, false, new Set()), vanity, footprint / pixels).map((figure) => figure.name)).toEqual(names);
	});

	it.each([
		['1280', 880, 650, 8],
		['760', 380, 650, 8],
		['580', 290, 620, 2],
		['460', 458, 330, 2],
	] as const)('rests the basin’s figures at a %s leaf only while the drawing is big enough', (_leaf, stageWidth, stageHeight, count) => {
		const { names, placed, values } = resting(vanity, basin, { width: stageWidth, height: stageHeight });

		expect(names).toHaveLength(count);
		expect(overlapping(placed, values)).toEqual([]);
	});
});

/**
 * **AD18-R21 asks that a resting label never cover a handle of the selected part** — held where the
 * slot search finds a free slot, which every frame below does. Measured at a 1280 leaf
 * with the vanity's basin selected: the `54 mm` offset sat on the basin's bottom-middle box handle, so
 * a press there reached the label and the handle could not be grabbed. The handles are obstacles in
 * `separateLabels`' own slot search, each its grab square — 8 px each way of the handle's point.
 */
describe('a resting label and the selected part’s handles', () => {
	it.each([
		['one pixel inside its grab square below it', screenPoint(100, 122), false],
		['exactly clear of it below', screenPoint(100, 123), true],
		['one pixel inside its grab square beside it', screenPoint(136, 100), false],
	] as const)('moves a label with a handle %s, or leaves it', (_case, handle, stays) => {
		const [placed] = separateLabels([at(100, 100)], STAGE, [handle]);
		const drawn = expectDefined(placed, 'the label');

		expect(drawn.x === 100 && drawn.y === 100).toBe(stays);
		expect(covering([drawn], [100], [handle])).toEqual([]);
	});

	/**
	 * The four leaves, with the basin selected: the anchors the rule is handed DO sit on handles —
	 * the `54 mm` on the bottom-middle box handle at 1280 and 760, and the overall width on the rotate
	 * handle at 580 and 460 — and the frame drawn has none on any.
	 */
	it.each([
		['1280', 880, 650, '54@440.0,256.9'],
		['760', 380, 650, '54@190.0,279.2'],
		['580', 290, 620, '800@145.0,183.2'],
		['460', 458, 330, '800@229.0,46.1'],
	] as const)('keeps every label of the basin’s frame off its handles at a %s leaf', (_leaf, stageWidth, stageHeight, covered) => {
		const { anchors, placed, values, handles } = resting(preset('vanity'), { kind: 'detail', id: 'detail-2' }, { width: stageWidth, height: stageHeight });

		expect(covering(anchors, values, handles)).toContain(covered);
		expect(covering(placed, values, handles)).toEqual([]);
	});
});
