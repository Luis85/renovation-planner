/**
 * What the designer's on-canvas dimensions measure and what typing one back writes — the asset
 * designer snapping spec (2026-09-15) §0's increment 2, authorised by AD18-R11.
 *
 * Pure, in node: this is the arithmetic half, and `designerDimensions.test.ts` beside it owns the
 * mounted component, the preview binding and the field. `rulerMarks.test.ts` and
 * `designerRulers.test.ts` draw the same line for increment 3.
 *
 * **Every number below is read off `editableShape()`**, whose own docblock is the authority:
 * a 1000 x 600 footprint centred on the origin, so its corners are (-500, -300) and (500, 300);
 * `detail-1` ("top") a 400 x 200 rectangle centred on (-200, 0), so (-400, -100) to (0, 100);
 * `detail-2` ("bowl") a circle, and PENDING; a 1400 x 1000 clearance centred on (0, 200), so
 * (-700, -300) to (700, 700) — which reaches OUTSIDE the footprint on three edges and is what
 * makes the signed-offset case a real fixture rather than a contrived one.
 */
import { describe, expect, it } from 'vitest';
import { dimensionFigures, type DimensionFigure } from '../../../../src/presentation/designer/dimensions/dimensionFigures';
import { partMeasure } from '../../../../src/presentation/designer/selection/partExtent';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { OutlinePart } from '../../../../src/domain/asset/shapeEdits';
import { editableShape } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';

const TOP: OutlinePart = { kind: 'detail', id: 'detail-1' };

function figures(selection: DesignerSelection | null, all = false, shape: AssetShape = editableShape()): DimensionFigure[] {
	return dimensionFigures(shape, selection, all);
}

/** One figure by name, refused loudly rather than read off an `undefined`. */
function named(list: readonly DimensionFigure[], name: string): DimensionFigure {
	const found = list.find((figure) => figure.name === name);
	if (found === undefined) throw new Error(`no figure named ${name} among: ${list.map((one) => one.name).join(', ')}`);
	return found;
}

/** What one figure reads and where it is drawn, as one tuple so a case states both at once. */
const reading = (list: readonly DimensionFigure[], name: string): [number, number, number] => {
	const figure = named(list, name);
	return [figure.value, figure.at.x, figure.at.y];
};

/** The part's box after `edit` has run, so a case asserts the SHAPE rather than the figure it typed into. */
function after(figure: DimensionFigure, typed: number, part: OutlinePart): { min: number; max: number } {
	const written = expectOk(figure.edit(typed)(editableShape()));
	const box = partMeasure(written, part);
	if (box === null) throw new Error('the edited shape lost the part');
	return { min: box.centre.x - box.width / 2, max: box.centre.x + box.width / 2 };
}

describe('which figures the designer draws over a design', () => {
	/**
	 * The overall pair is drawn for every scaled design and is never the empty answer: every
	 * `AssetShape` has a footprint, which is the guarantee `footprintCorners` rests its cast on.
	 * Width sits on the middle of the top edge and depth on the middle of the left one, which is
	 * where `RoomDimensionLabels` anchors the plan editor's equivalent pair.
	 */
	it('measures the footprint with nothing selected, and nothing else', () => {
		const drawn = figures(null);

		expect(drawn.map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
		expect(reading(drawn, 'overall-width')).toEqual([1000, 0, -300]);
		expect(reading(drawn, 'overall-depth')).toEqual([600, -500, 0]);
	});

	/**
	 * **The footprint, the anchor and the facing add nothing of their own**, and each for its own
	 * reason rather than by one rule: the footprint IS the overall pair, so measuring it again as a
	 * "part" would draw the same two numbers twice; the anchor and the facing are points
	 * `selectionFrame` answers as degenerate boxes, and a point has no size to state and no edge to
	 * stand off from. The Inspector owns both of those numbers.
	 */
	it.each([
		[{ kind: 'footprint' } as DesignerSelection],
		[{ kind: 'anchor' } as DesignerSelection],
		[{ kind: 'facing' } as DesignerSelection],
	])('adds no part figures for %o', (selection: DesignerSelection) => {
		expect(figures(selection).map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
	});

	/**
	 * The spec's three families, on one selected part: its size, its four offsets to the footprint's
	 * edges, and the overall pair that never goes away. **Each offset is drawn at the MIDDLE of the
	 * gap it measures** and not at the part's own edge, which is what makes a reader able to tell
	 * which of two neighbouring gaps a number belongs to.
	 */
	it('measures a selected part’s size and its four offsets, each at the middle of its gap', () => {
		const drawn = figures(TOP);

		expect(drawn.map((figure) => figure.name)).toEqual([
			'detail-detail-1-width', 'detail-detail-1-depth',
			'detail-detail-1-offset-left', 'detail-detail-1-offset-right',
			'detail-detail-1-offset-top', 'detail-detail-1-offset-bottom',
			'overall-width', 'overall-depth',
		]);
		expect(reading(drawn, 'detail-detail-1-width')).toEqual([400, -200, -100]);
		expect(reading(drawn, 'detail-detail-1-depth')).toEqual([200, -400, 0]);
		// -400 stands 100 off the footprint's -500, drawn halfway between at -450.
		expect(reading(drawn, 'detail-detail-1-offset-left')).toEqual([100, -450, 0]);
		// 0 stands 500 off the footprint's 500, drawn halfway between at 250.
		expect(reading(drawn, 'detail-detail-1-offset-right')).toEqual([500, 250, 0]);
		expect(reading(drawn, 'detail-detail-1-offset-top')).toEqual([200, -200, -200]);
		expect(reading(drawn, 'detail-detail-1-offset-bottom')).toEqual([200, -200, 200]);
	});

	/**
	 * **A gap is SIGNED, and the clearance is why that is not a nicety.** It reaches 200 outside the
	 * footprint on the left, 200 on the right and 400 below, which is what a clearance is FOR. An
	 * unsigned distance would read 200 for a part standing 200 inside the edge and 200 for one
	 * hanging 200 over it — the same number for opposite designs — and would not round-trip, since
	 * typing it back would have to guess which one the user meant.
	 */
	it('reads a gap as negative where the part reaches outside the footprint', () => {
		const drawn = figures({ kind: 'clearance' });

		expect(named(drawn, 'clearance-offset-left').value).toBe(-200);
		expect(named(drawn, 'clearance-offset-right').value).toBe(-200);
		// The clearance's top edge is the footprint's own, so that gap is exactly zero.
		expect(named(drawn, 'clearance-offset-top').value).toBe(0);
		expect(named(drawn, 'clearance-offset-bottom').value).toBe(-400);
	});

	/**
	 * `all` widens the SET of parts and changes nothing about what each one gets, which is the
	 * property that keeps "All dimensions" from being a second answer to what a part's dimensions
	 * are: the six figures a selected part draws are byte-identical to the six it draws unselected
	 * under the toggle.
	 */
	it('draws every drawable part under the toggle, each exactly as a selection draws it', () => {
		const all = figures(null, true);
		const selected = figures(TOP);

		expect(all.filter((figure) => figure.name.startsWith('detail-detail-1-')).map((figure) => [figure.name, figure.value, figure.at]))
			.toEqual(selected.filter((figure) => figure.name.startsWith('detail-detail-1-')).map((figure) => [figure.name, figure.value, figure.at]));
		expect(all.map((figure) => figure.name)).toEqual([
			'detail-detail-1-width', 'detail-detail-1-depth',
			'detail-detail-1-offset-left', 'detail-detail-1-offset-right',
			'detail-detail-1-offset-top', 'detail-detail-1-offset-bottom',
			'clearance-width', 'clearance-depth',
			'clearance-offset-left', 'clearance-offset-right',
			'clearance-offset-top', 'clearance-offset-bottom',
			'overall-width', 'overall-depth',
		]);
	});

	/**
	 * **§0's "no numbers on an unscaled part" read at the PART.** `detail-2` is `pending` — captured
	 * over an uncalibrated background, so its coordinates are placeholder pixels a later calibration
	 * multiplies. A millimetre drawn beside it would put a unit on a number that is not a
	 * measurement, and one typed into it would be rescaled too; `DesignerSelectionInspector`'s
	 * `pendingPart` withholds the same part's length fields for the same reason.
	 *
	 * Asserted in BOTH modes, because the two reach the part by different paths and a filter applied
	 * to only one of them would leave "All dimensions" drawing what a selection refuses to.
	 */
	it('measures no pending part, neither selected nor under the toggle', () => {
		expect(figures({ kind: 'detail', id: 'detail-2' }).map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
		expect(figures(null, true).some((figure) => figure.name.startsWith('detail-detail-2-'))).toBe(false);
	});

	/**
	 * A pending CLEARANCE is withheld by the same rule, and a design with no clearance has nothing
	 * to withhold — two arms of one predicate, so neither can be the one nobody drove.
	 */
	it.each([
		['pending', editableShape({ clearancePending: true })],
		['absent', editableShape({ clearance: null })],
	])('measures no %s clearance under the toggle', (_state: string, shape: AssetShape) => {
		expect(figures(null, true, shape).some((figure) => figure.name.startsWith('clearance-'))).toBe(false);
	});

	/**
	 * A selection naming a detail the shape has not got draws nothing for it — the frame between a
	 * peer's delete landing and the store pruning the selection, which `DesignerSelectionInspector`'s
	 * `exists` guard covers on the other surface.
	 */
	it('draws nothing for a selected detail the shape has lost', () => {
		expect(figures({ kind: 'detail', id: 'detail-gone' }).map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
	});
});

describe('what typing a figure back writes', () => {
	/**
	 * **An offset MOVES the part and never resizes it.** Widening the left gap by pushing the left
	 * edge right would shrink the part and silently change its own Width field at the same time, so
	 * the edit is a translation — the part keeps its 400 and its right edge takes the complementary
	 * change, which the user can see on the canvas.
	 */
	it('moves a part to the left offset typed, leaving its size alone', () => {
		const box = after(named(figures(TOP), 'detail-detail-1-offset-left'), 150, TOP);

		expect([box.min, box.max]).toEqual([-350, 50]);
	});

	/**
	 * The opposite sign, which is the half a single-direction test would leave undriven: a `right`
	 * or `bottom` gap grows as the part moves TOWARDS the origin, so the displacement is negated.
	 * Typing 600 where the gap reads 500 moves the part 100 left, and the new gap reads 600 — the
	 * round trip, rather than the arithmetic restated.
	 */
	it('moves a part the other way for a right offset, and the new gap reads what was typed', () => {
		const moved = expectOk(named(figures(TOP), 'detail-detail-1-offset-right').edit(600)(editableShape()));

		expect(named(dimensionFigures(moved, TOP, false), 'detail-detail-1-offset-right').value).toBe(600);
		expect(named(dimensionFigures(moved, TOP, false), 'detail-detail-1-width').value).toBe(400);
	});

	/**
	 * Both y-axis offsets, so the `axis === 'y'` arm of the displacement is driven in BOTH signs —
	 * the x pair above cannot reach it, and a module that wrote `dy` where it meant `dx` would pass
	 * every case that only ever typed a left or a right.
	 */
	it.each([['top'], ['bottom']] as const)('moves a part along y for the %s offset', (edge: string) => {
		const moved = expectOk(named(figures(TOP), `detail-detail-1-offset-${edge}`).edit(300)(editableShape()));
		const again = dimensionFigures(moved, TOP, false);

		expect(named(again, `detail-detail-1-offset-${edge}`).value).toBe(300);
		expect(named(again, 'detail-detail-1-depth').value).toBe(200);
		// The part moved on y alone: its x gaps are what they were.
		expect(named(again, 'detail-detail-1-offset-left').value).toBe(100);
	});

	/** A part's size goes through `resizeToExtent`, about its own box centre, exactly as the Inspector's field does. */
	it('resizes a part to the size typed, about its own centre', () => {
		const box = after(named(figures(TOP), 'detail-detail-1-width'), 200, TOP);

		expect([box.min, box.max]).toEqual([-300, -100]);
	});

	/** And the overall pair resizes the FOOTPRINT, which is the part it measures. */
	it('resizes the footprint for the overall pair', () => {
		const box = after(named(figures(null), 'overall-width'), 2000, { kind: 'footprint' });

		expect([box.min, box.max]).toEqual([-1000, 1000]);
	});

	/**
	 * **An offset re-measures BOTH boxes off the shape it is HANDED**, never off the render that
	 * drew it. `editShape` hands each edit the shape the previous write left, so a gap captured at
	 * render would quietly undo a commit still in flight — `DesignerSelectionInspector`'s standing
	 * rule, on this surface.
	 *
	 * Driven by handing the edit a shape whose part has ALREADY moved 100 right: a closure over the
	 * rendered gap of 100 would answer a displacement of 50 and land the part at -300, while
	 * re-measuring answers the 150 that was typed against the 200 it now stands at and lands it back
	 * at -350. The two predict different numbers, which is what makes this a case rather than a
	 * restatement.
	 */
	it('measures the offset off the shape the edit is handed, not the one that was drawn', () => {
		const rendered = figures(TOP);
		const moved = expectOk(named(rendered, 'detail-detail-1-offset-left').edit(200)(editableShape()));

		const again = expectOk(named(rendered, 'detail-detail-1-offset-left').edit(150)(moved));

		expect(partMeasure(again, TOP)?.centre.x).toBe(-150);
	});

	/** A part deleted between the render and the write is refused by name rather than written past. */
	it('refuses an offset for a part the shape no longer has', () => {
		const figure = named(figures(TOP), 'detail-detail-1-offset-left');

		const result = figure.edit(150)(editableShape({ details: [] }));

		expect(result.ok).toBe(false);
	});
});
