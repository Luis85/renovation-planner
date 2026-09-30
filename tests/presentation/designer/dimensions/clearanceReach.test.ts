/**
 * The clearance's figures read its REACH (AD18-R40) and typing one moves that edge alone (AD18-R41).
 *
 * A sibling of `dimensionFigures.test.ts` rather than more of it: that file is at the `tests/**` line
 * cap, and this is one ruling's worth of cases. Every catalogue preset that carries a clearance is
 * swept, in both modes the ruling names — `All dimensions`, and the clearance selected — because the
 * vanity alone reaches outward on ONE side and would leave three of the four arms undriven.
 */
import { describe, expect, it } from 'vitest';
import { dimensionFigures, type DimensionFigure } from '../../../../src/presentation/designer/dimensions/dimensionFigures';
import { partMeasure, type PartBox } from '../../../../src/presentation/designer/selection/partExtent';
import { ASSET_PRESETS } from '../../../../src/domain/asset/presets/catalogue';
import { defaultValues, rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { clearanceRectangle, facingQuarter, rectangularFootprint } from '../../../../src/domain/asset/referenceFrame';
import { validateAssetShape, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { editableShape } from '../../../helpers/assetShapes';
import { expectDefined, expectOk } from '../../../helpers/domain';

const NOTHING_HIDDEN: ReadonlySet<string> = new Set();
const SIDES = ['left', 'right', 'top', 'bottom'] as const;
type Side = (typeof SIDES)[number];

const presetShape = (id: string): AssetShape => {
	const preset = expectDefined(ASSET_PRESETS.find((one) => one.id === id), `the ${id} preset`);
	return expectOk(preset.build(defaultValues(preset)));
};
const WITH_CLEARANCE = ASSET_PRESETS.map((preset) => preset.id).filter((id) => presetShape(id).clearance !== null);

const edges = (box: PartBox) => ({
	left: box.centre.x - box.width / 2,
	right: box.centre.x + box.width / 2,
	top: box.centre.y - box.depth / 2,
	bottom: box.centre.y + box.depth / 2,
});

/** Each side's reach measured here, independently of the module: how far the clearance stands OUTSIDE that footprint edge. */
function reaches(shape: AssetShape): Record<Side, number> {
	const outer = edges(expectDefined(partMeasure(shape, { kind: 'footprint' }), 'the footprint'));
	const box = edges(expectDefined(partMeasure(shape, { kind: 'clearance' }), 'the clearance'));
	return { left: outer.left - box.left, right: box.right - outer.right, top: outer.top - box.top, bottom: box.bottom - outer.bottom };
}

const clearanceOffsets = (list: readonly DimensionFigure[]): DimensionFigure[] => list.filter((figure) => figure.name.startsWith('clearance-offset-'));
const drawnReaches = (shape: AssetShape, all = true): Record<string, number> =>
	Object.fromEntries(clearanceOffsets(dimensionFigures(shape, all ? null : { kind: 'clearance' }, all, NOTHING_HIDDEN)).map((figure) => [figure.name.slice('clearance-offset-'.length), figure.value]));

const rounded = (all: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(all).map(([side, reach]) => [side, Math.round(reach)]));

function typed(shape: AssetShape, side: Side, value: number): AssetShape {
	const figure = expectDefined(clearanceOffsets(dimensionFigures(shape, { kind: 'clearance' }, false, NOTHING_HIDDEN)).find((one) => one.name === `clearance-offset-${side}`), side);
	const result = figure.edit(value)(shape);
	if (result === null) throw new Error(`${side} answered no-write for ${String(value)}`);
	return expectOk(result);
}

describe('the clearance reads its reach per side (AD18-R40)', () => {
	it('sweeps a non-empty set of presets', () => {
		expect(WITH_CLEARANCE.length).toBeGreaterThan(5);
	});

	/**
	 * Every preset reaches outward or sits flush, so each drawn figure is POSITIVE and equals the
	 * reach measured independently here; a flush side draws nothing. Both modes draw the same set.
	 */
	it.each(WITH_CLEARANCE)('%s: each side reads its positive reach, and a flush side draws no label', (id: string) => {
		const shape = presetShape(id);
		const expected = Object.fromEntries(Object.entries(reaches(shape)).filter(([, reach]) => Math.round(reach) !== 0));

		expect(Object.keys(expected).length).toBeGreaterThan(0);
		for (const all of [true, false]) {
			const drawn = drawnReaches(shape, all);
			expect(Object.keys(drawn).toSorted()).toEqual(Object.keys(expected).toSorted());
			for (const [side, reach] of Object.entries(expected)) expect(drawn[side]).toBeCloseTo(reach, 6);
			expect(Object.values(drawn).every((value) => value > 0)).toBe(true);
		}
	});

	/** The finding itself, in the critique's own terms: the vanity's front reads 600, and its three flush sides nothing. */
	it('reads the vanity’s 600 mm front reach as 600, with no 0 mm beside it', () => {
		expect(drawnReaches(presetShape('vanity'))).toEqual({ bottom: 600 });
	});

	/**
	 * **The reach is the SETBACK the Inspector generated it from** — the only number a user ever typed
	 * for it, since C07 keeps those fields empty afterwards. A negative setback reaches INWARD and reads
	 * signed (AD18-R41); a zero one draws nothing.
	 */
	it('reads back the setbacks Generate was typed with, a negative one signed', () => {
		const vanity = presetShape('vanity');
		const box = expectDefined(rectangularFootprint(vanity.footprint), 'a rectangular footprint');
		const quarter = expectDefined(facingQuarter(vanity.facing), 'a facing quarter');
		const shape = expectOk(validateAssetShape({ ...vanity, clearance: { points: clearanceRectangle(box, quarter, { front: 600, back: -50, left: 120, right: 0 }) } }));
		const drawn = drawnReaches(shape);

		// The preset faces +y, so its front is the bottom edge and its back the top one.
		expect(drawn.bottom).toBe(600);
		expect(drawn.top).toBe(-50);
		expect(Object.values(drawn).toSorted((one, other) => one - other)).toEqual([-50, 120, 600]);
	});

	/** A traced boundary standing 100 inside the footprint's top edge reads `-100`, not `100` and not nothing. */
	it('reads a side that reaches inward as a signed negative', () => {
		expect(drawnReaches(editableShape({ clearance: rect(1400, 1000, 0, 300) })).top).toBe(-100);
	});

	/** "No reach" is what the BUTTON would show as 0, so 0.4 is omitted where 0.6 — shown as 1 — is drawn. */
	it.each([[0.4, false], [-0.4, false], [0.6, true]])('omits a reach of %d only when its button would read 0', (reach: number, drawn: boolean) => {
		const shape = editableShape({ clearance: rect(1400, 1000 + reach, 0, 200 - reach / 2) });

		expect('top' in drawnReaches(shape)).toBe(drawn);
	});

	/**
	 * **Named as a reach, not an offset** (fix round 1): "Offset from the bottom edge" over a number
	 * that says how far the clearance reaches BEYOND it names the figure backwards. A detail's gap keeps
	 * its offset name.
	 */
	it('names the clearance’s sides as reaches and leaves a detail’s as offsets', () => {
		const drawn = dimensionFigures(editableShape(), null, true, NOTHING_HIDDEN);
		const labelOf = (name: string): string => expectDefined(drawn.find((figure) => figure.name === name), name).label;

		expect(clearanceOffsets(drawn).map((figure) => figure.label)).toEqual([
			'designer.dimension.reach-left', 'designer.dimension.reach-right', 'designer.dimension.reach-bottom',
		]);
		expect(labelOf('detail-detail-1-offset-bottom')).toBe('designer.dimension.offset-bottom');
	});

	/**
	 * **What `landTyped` checks a reach against**: the extent the typed reach asks for along its axis,
	 * AND the across extent it must leave alone — so a curved boundary whose across axis did not settle
	 * warns too, rather than only one whose typed side missed.
	 */
	it('asks landTyped for the grown extent and the unchanged across one', () => {
		const figure = expectDefined(clearanceOffsets(dimensionFigures(editableShape(), null, true, NOTHING_HIDDEN)).find((one) => one.name === 'clearance-offset-bottom'), 'bottom');

		expect(figure.typed?.(650)).toEqual({ part: { kind: 'clearance' }, width: 1400, depth: 1250 });
	});

	/** AD18-R22 unchanged: a detail flush with the footprint keeps its `0 mm`, and an overhang its sign. */
	it('leaves a detail’s signed gaps and 0 mm labels alone', () => {
		const vanity = dimensionFigures(presetShape('vanity'), null, true, NOTHING_HIDDEN);
		const cabinetTop = expectDefined(vanity.find((figure) => /^detail-.+-offset-top$/u.test(figure.name) && Math.round(figure.value) === 0), 'a flush detail gap');

		expect(cabinetTop.value).toBe(0);
		expect(dimensionFigures(editableShape(), { kind: 'detail', id: 'detail-1' }, false, NOTHING_HIDDEN).find((figure) => figure.name === 'detail-detail-1-offset-left')?.value).toBe(100);
	});
});

describe('typing a reach moves that edge alone (AD18-R41)', () => {
	/**
	 * **The case the ruling was taken on.** Translating would read front 800 and slide the back edge
	 * 200 inside the footprint; moving the front edge alone keeps the back flush, so no inward side
	 * appears and the other three still draw nothing.
	 */
	it('takes the vanity’s front from 600 to 800 and leaves its back flush with the footprint', () => {
		const vanity = presetShape('vanity');
		const edited = typed(vanity, 'bottom', 800);
		const before = edges(expectDefined(partMeasure(vanity, { kind: 'clearance' }), 'before'));
		const after = edges(expectDefined(partMeasure(edited, { kind: 'clearance' }), 'after'));

		expect(drawnReaches(edited)).toEqual({ bottom: 800 });
		expect([after.top, after.left, after.right]).toEqual([before.top, before.left, before.right]);
		expect(reaches(edited).top).toBe(0);
	});

	/**
	 * Every drawn side of every preset, 200 further out and 100 further in: that side reads it and the
	 * other three keep theirs — curved boundaries included, the round and oval tables' among them, where
	 * a single stretch moves the other axis too (see `reached`).
	 */
	it.each(WITH_CLEARANCE)('%s: moves each drawn side alone, out and in', (id: string) => {
		const shape = presetShape(id);
		const was = reaches(shape);
		for (const [side, reach] of Object.entries(drawnReaches(shape, false)) as [Side, number][]) {
			for (const value of [Math.round(reach) + 200, Math.round(reach) - 100]) {
				const next = reaches(typed(shape, side, value));
				expect(next[side]).toBeCloseTo(value, 6);
				for (const other of SIDES.filter((one) => one !== side)) expect(next[other]).toBeCloseTo(was[other], 6);
			}
		}
	});

	/**
	 * **A boundary curved on ONE side**, which no preset has: stretching it along x deepens that arc
	 * alone, and the across pass that restores the depth scales about the centre, so both across edges
	 * move and only the final shift puts them back. Every preset is symmetric across, where that shift
	 * is zero — this is the case that drives it.
	 */
	it('keeps both across sides of a boundary curved on one side only', () => {
		const lopsided = { points: [{ x: -700, y: -300 }, { x: 700, y: -300 }, { x: 700, y: 700 }, { x: -700, y: 700 }], bulges: [0.2, 0, 0, 0] };
		const shape = editableShape({ clearance: lopsided });
		const was = reaches(shape);
		const next = reaches(typed(shape, 'left', 900));

		expect(next.left).toBeCloseTo(900, 6);
		for (const side of ['right', 'top', 'bottom'] as const) expect(next[side]).toBeCloseTo(was[side], 6);
	});

	/**
	 * The left arm fixes the MAX edge, the right and bottom the MIN one. The fixture's top is flush and
	 * draws no label, so the top arm is driven by the inward-reach case below, not here.
	 */
	it.each(SIDES.filter((side) => side !== 'top'))('moves the %s edge on the fixture and nothing else', (side: Side) => {
		const was = reaches(editableShape());
		const next = reaches(typed(editableShape(), side, 450));

		expect(next).toEqual({ ...was, [side]: 450 });
	});

	/**
	 * **The untouched sides still READ what they read on a boundary curved on every edge** (fix round 1).
	 * A traced triangle around the washbasin, all three edges bulged — a shape the review's random sweep
	 * finds and no preset has: with a fixed three stretches its bottom reach drifted 6.1 mm (629 → 635,
	 * measured), because each restoring stretch of the depth moves the width again. Iterated until the
	 * depth settles, every other side keeps its rounded reading.
	 */
	it('keeps the rounded reading of every untouched side on a boundary curved on every edge', () => {
		const shape = { ...presetShape('washbasin'), clearance: { points: [{ x: 1162, y: 532 }, { x: -399, y: 633 }, { x: -203, y: -1163 }], bulges: [0.345, 0.296, -0.074] } };
		const was = drawnReaches(expectOk(validateAssetShape(shape)));
		const next = drawnReaches(typed(expectOk(validateAssetShape(shape)), 'left', Math.round(was.left) + 1500));
		
		expect(rounded(next)).toEqual({ ...rounded(was), left: Math.round(was.left) + 1500 });
	});

	/** Typing an inward reach is the user's own choice, and it round-trips signed. */
	it('writes an inward reach typed as a negative, and reads it back signed', () => {
		const shape = editableShape({ clearance: rect(1400, 1000, 0, 300) });

		expect(reaches(typed(shape, 'top', -40))).toEqual({ ...reaches(shape), top: -40 });
		expect(drawnReaches(typed(shape, 'top', 60)).top).toBe(60);
	});

	it('answers no-write for the reach it shows, canonical or rounded', () => {
		const shape = editableShape({ clearance: rect(1400, 1000.4, 0, 200.2) });
		const figure = expectDefined(clearanceOffsets(dimensionFigures(shape, null, true, NOTHING_HIDDEN)).find((one) => one.name === 'clearance-offset-bottom'), 'bottom');

		expect(figure.value).toBeCloseTo(400.4, 6);
		expect(figure.edit(figure.value)(shape)).toBeNull();
		expect(figure.edit(400)(shape)).toBeNull();
	});

	/** Measured off the shape the edit is HANDED: a closure over the render's 400 would land 400 + (500 − 400) on a shape already at 450. */
	it('measures the reach off the shape it is handed, not the one that was drawn', () => {
		const figure = expectDefined(clearanceOffsets(dimensionFigures(editableShape(), null, true, NOTHING_HIDDEN)).find((one) => one.name === 'clearance-offset-bottom'), 'bottom');
		const handed = typed(editableShape(), 'bottom', 450);

		expect(reaches(expectOk(expectDefined(figure.edit(500)(handed), 'a write'))).bottom).toBe(500);
	});

	/**
	 * A refusal from the RESTORING stretch comes back as it is: `typedLanding.test.ts`'s `QUAD` as a
	 * clearance around a 100 x 100 footprint, its left reach typed from 150 to 0 — the width lands, and
	 * putting the depth back makes two of its arcs cross, which validation refuses by code.
	 */
	it('refuses a reach whose restoring stretch would cross the boundary’s own arcs', () => {
		const quad = editableShape({ footprint: rect(100, 100), details: [], clearance: { points: rect(400, 300).points, bulges: [0.95, -0.4, 1, -0.95] } });
		const figure = expectDefined(clearanceOffsets(dimensionFigures(quad, null, true, NOTHING_HIDDEN)).find((one) => one.name === 'clearance-offset-left'), 'left');
		const result = figure.edit(0)(quad);

		expect(figure.value).toBe(150);
		expect(result !== null && !result.ok ? result.error.code : null).toBe('asset.invalid-clearance');
	});

	it('refuses a reach for a clearance the shape no longer has, and one that would leave it no depth', () => {
		const figure = expectDefined(clearanceOffsets(dimensionFigures(editableShape(), null, true, NOTHING_HIDDEN)).find((one) => one.name === 'clearance-offset-bottom'), 'bottom');

		expect(figure.edit(500)(editableShape({ clearance: null }))?.ok).toBe(false);
		expect(figure.edit(-2000)(editableShape())?.ok).toBe(false);
	});
});
