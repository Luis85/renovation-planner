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
import type { DesignerSelection, SelectionMode } from '../../../../src/presentation/designer/selection/designerSelection';
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

/**
 * Every OVERALL label drawn further onto the footprint than it may be, as `name placed/edge`
 * (AD18-R17, board 01): one whose anchor stood OUTSIDE and whose box now reaches over the edge — below
 * the top edge for a width, right of the left edge for a depth — and one `outsideAnchor` left ON
 * the edge, for want of room, that was moved further onto the drawing than that anchor (fix round 3).
 */
function inside(drawn: { names: readonly string[]; raw: readonly ScreenPoint[]; anchors: readonly ScreenPoint[]; placed: readonly ScreenPoint[]; values: readonly number[] }): string[] {
	return drawn.names.flatMap((name, index) => {
		const [edge, anchor, placed] = [drawn.raw[index], drawn.anchors[index], drawn.placed[index]];
		if (name === 'overall-width' && anchor.y < edge.y && placed.y + 15 > edge.y) return [`${name} ${placed.y.toFixed(1)}/${edge.y.toFixed(1)}`];
		if (name === 'overall-depth' && anchor.x < edge.x && placed.x + width(drawn.values[index]) / 2 > edge.x) return [`${name} ${placed.x.toFixed(1)}/${edge.x.toFixed(1)}`];
		if (name === 'overall-width' && anchor.y === edge.y && placed.y > anchor.y) return [`edge ${name} ${placed.y.toFixed(1)}/${edge.y.toFixed(1)}`];
		if (name === 'overall-depth' && anchor.x === edge.x && placed.x > anchor.x) return [`edge ${name} ${placed.x.toFixed(1)}/${edge.x.toFixed(1)}`];
		return [];
	});
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
function resting(shape: AssetShape, selection: DesignerSelection | null, stage: StageSize, drawn: 'drawn' | 'every' = 'drawn', mode: SelectionMode = 'transform') {
	const camera = expectDefined(fitViewport(frame(shape), stage, 48, 1), 'the fit camera');
	const worldPerPixel = worldPerScreenPixel(camera, STAGE_PIXELS);
	const measured = dimensionFigures(shape, selection, false, new Set());
	const figures = drawn === 'drawn' ? restingFigures(measured, shape, worldPerPixel) : measured;
	const handles = drawn === 'drawn' ? selectionHandles(shape, selection, mode, worldPerPixel).map((handle) => worldToScreen(handle.at, camera, STAGE_PIXELS)) : [];
	const raw = figures.map((figure) => worldToScreen(figure.at, camera, STAGE_PIXELS));
	const anchors = figures.map((figure, index) => {
		const point = raw[index];
		return figure.outside
			? { at: outsideAnchor(figure.axis, point, figure.value), value: figure.value, overall: figure.axis }
			: { at: point, value: figure.value };
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
	 * handles are obstacles in the same slot search rather than a second rule after it — in all three
	 * selection modes, whose handles differ (Transform's box and rotate handles, Points' vertices,
	 * Bend's edge midpoints). **And no overall label drawn back over the footprint** where its anchor
	 * stood outside (fix round 2 of AD18-R21): the FOOTPRINT is selected here too, since its own box
	 * handles are the ones that sit under the overall pair's outside anchors. AD18-R23's exception — an
	 * overall label stepping onto the drawing off a handle — reaches no frame here, so `inside` stays strict.
	 */
	it('leaves no two labels touching, no label on a handle and no overall label inside, for any preset, selection, mode or leaf width', () => {
		const stages: StageSize[] = [{ width: 880, height: 650 }, { width: 380, height: 650 }, { width: 290, height: 620 }, { width: 458, height: 330 }];
		const failures = ASSET_PRESETS.flatMap((one) => {
			const shape = preset(one.id);
			const selections: (DesignerSelection | null)[] = [null, { kind: 'footprint' }, { kind: 'clearance' }, ...shape.details.map((detail) => ({ kind: 'detail' as const, id: detail.id }))];
			return stages.flatMap((stage) => selections.flatMap((selection) => (['transform', 'points', 'bend'] as const).flatMap((mode) => {
				const drawn = resting(shape, selection, stage, 'drawn', mode);
				return [...overlapping(drawn.placed, drawn.values), ...covering(drawn.placed, drawn.values, drawn.handles), ...inside(drawn)]
					.map((pair) => `${one.id} ${JSON.stringify(selection)} ${mode} ${String(stage.width)}: ${pair}`);
			})));
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

/**
 * **The OVERALL pair keeps its outside line with a part selected** (AD18-R17, board 01; fix round 1
 * of AD18-R21). Measured in Chromium on a2f313e32 at a 1280 leaf with the basin selected: the
 * `126 mm` offset stepped off the basin's rotate handle into the top slot, and the `800 mm` width,
 * placed after it, yielded and was pushed INSIDE the footprint, its line through the tap hole. A
 * detail label yields to the overall pair, never the other way round.
 *
 * A handle can still move an overall label, and not back over the outline while a slot along its line or further out is free (fix round 2's rule): at 580 and 460 the width's
 * outside anchor sits on the basin's rotate handle, so at 460 it slides sideways along its own row
 * (the ruler is directly above it) and at 580 it steps one row further out. At 1280 and 760 no
 * handle is in the way and the pair is exactly where `outsideAnchor` stood it.
 */
describe('the overall pair with a part selected', () => {
	/**
	 * **Fix round 2's named frame**: the rect table with its FOOTPRINT selected at the 1280 leaf. The
	 * width's outside anchor sits on the footprint's own top-middle box handle and its rotate handle
	 * both, and the nearer of two equal slots was the INWARD row, over the table, measured at 251.3
	 * below a top edge at 206.3. An overall label now takes no slot on the footprint's side of its
	 * anchor, so it takes the nearest one further OUT: two rows up, since one row up is on the rotate
	 * handle, and nearer than the slide along its row the handles leave free.
	 */
	it('steps the rect table’s overall width further out, not over the table, when its footprint is selected', () => {
		const table = resting(preset('rect-table'), { kind: 'footprint' }, { width: 880, height: 650 });
		const index = table.names.indexOf('overall-width');

		expect(table.anchors[index]?.y).toBeLessThan(expectDefined(table.raw[index], 'the top edge').y);
		const anchor = expectDefined(table.anchors[index], 'the outside anchor');
		expect(table.placed[index]).toEqual(screenPoint(anchor.x, anchor.y - 60));
		expect(inside(table)).toEqual([]);
	});

	it.each([
		['1280', 880, 650, 'unmoved'],
		['760', 380, 650, 'unmoved'],
		['580', 290, 620, 'one row out'],
		['460', 458, 330, 'along its row'],
	] as const)('keeps the overall pair outside the footprint at a %s leaf', (_leaf, stageWidth, stageHeight, how) => {
		const { names, raw, anchors, placed } = resting(preset('vanity'), { kind: 'detail', id: 'detail-2' }, { width: stageWidth, height: stageHeight });
		const [across, down] = [names.indexOf('overall-width'), names.indexOf('overall-depth')];
		const top = expectDefined(raw[across], 'the top edge').y;
		const wanted = expectDefined(anchors[across], 'the width’s outside anchor');
		const label = expectDefined(placed[across], 'the width');
		const expected = { 'unmoved': wanted, 'one row out': screenPoint(wanted.x, wanted.y - 30), 'along its row': screenPoint(label.x, wanted.y) }[how];

		// The width's whole box above the top edge — outside, where the canvas had room at all four.
		expect(label.y + 15).toBeLessThanOrEqual(top);
		expect(label).toEqual(expected);
		expect(label.x === wanted.x).toBe(how !== 'along its row');
		// The depth exactly where `outsideAnchor` stood it: outside where there was room, on the edge at 760.
		expect(placed[down]).toEqual(anchors[down]);
	});
});

/** An OVERALL label's anchor, as `DesignerDimensions.vue` hands one to the rule. */
const overall = (x: number, y: number, axis: 'x' | 'y') => ({ at: screenPoint(x, y), value: 100, overall: axis });
/** A handle every half-width along a row, or every row down a column: every slot on that line blocked. */
const alongRow = (y: number): ScreenPoint[] => Array.from({ length: 13 }, (_, step) => screenPoint(400 + (step - 6) * 28.6, y));
const downColumn = (x: number): ScreenPoint[] => Array.from({ length: 11 }, (_, step) => screenPoint(x, 200 + (step - 5) * 30));

/**
 * **Which slots an OVERALL label may take** (fix rounds 3 and 4 of AD18-R21): the nearest free one
 * along its own line or further out, and otherwise its own anchor — unless the anchor covers a HANDLE,
 * when it takes the nearest free slot on the drawing's side too (AD18-R23). A `100 mm` label is 57.2 px
 * wide, so a handle blocks it within 36.6 px along a row (half of that plus the 8 px grab) and 23 px across one.
 */
describe('where an overall label goes when its anchor is taken', () => {
	it('takes the nearest slot on its own side of the edge: a row further out before a longer slide along its row', () => {
		// The row above, 30 px away, is free and nearer than one width (57.2 px) along the row. The row
		// below is as near and free too, and is never a candidate for an overall width.
		expect(separateLabels([overall(400, 300, 'x')], STAGE, [screenPoint(400, 300)])).toEqual([screenPoint(400, 270)]);
	});

	it('steps a width whose row is taken further OUT, rather than onto the drawing', () => {
		// In the stage's top half the inward row, down, is tried first by any other label.
		expect(separateLabels([overall(400, 200, 'x')], STAGE, alongRow(200))).toEqual([screenPoint(400, 170)]);
	});

	it('moves a depth whose column is taken further LEFT, rather than onto the drawing', () => {
		const [placed] = separateLabels([overall(400, 200, 'y')], STAGE, downColumn(400));

		expect(placed?.y).toBe(200);
		expect(placed?.x).toBeCloseTo(400 - width(100));
	});

	it('steps onto the drawing when nothing along its line or further out is free and its anchor covers a handle', () => {
		// Right under the ruler, so every row above is refused; its own row is all handles (AD18-R23).
		expect(separateLabels([overall(400, 33, 'x')], STAGE, alongRow(33))).toEqual([screenPoint(400, 63)]);
	});

	it('keeps its anchor when nothing along its line or further out is free and only a label covers it', () => {
		// 100 px wide: every shift along the row runs off the stage or onto the left ruler, every row
		// above onto the ruler — and the row below is free, which only a handle may take it to.
		expect(separateLabels([overall(50, 33, 'x'), overall(50, 33, 'x')], { width: 100, height: 600 })).toEqual([screenPoint(50, 33), screenPoint(50, 33)]);
	});

	/**
	 * **A real frame from the 205 the review's grid left on a handle** (AD18-R23): the vanity with its
	 * footprint selected on a 280 x 300 canvas. The width stands 15 px under the ruler, over the
	 * footprint's top-middle box handle and its rotate handle; nothing along its row or above is free,
	 * so it steps two rows onto the drawing — one row down is still on the top-middle handle. (The depth,
	 * on the left-middle handle, has a free slot of its own and takes it as before.)
	 */
	it('steps the vanity’s overall width off its footprint’s handles on a 280 x 300 canvas', () => {
		const drawn = resting(preset('vanity'), { kind: 'footprint' }, { width: 280, height: 300 });
		const index = drawn.names.indexOf('overall-width');
		const anchor = expectDefined(drawn.anchors[index], 'the outside anchor');

		expect(covering(drawn.anchors, drawn.values, drawn.handles)).toEqual(['800@140.0,48.0', '800@140.0,18.0', '450@62.3,91.7']);
		expect(drawn.placed[index]).toEqual(screenPoint(anchor.x, anchor.y + 60));
		expect(covering(drawn.placed, drawn.values, drawn.handles)).toEqual([]);
		expect(inside(drawn)).toEqual(['overall-width 93.0/48.0']);
	});
});
