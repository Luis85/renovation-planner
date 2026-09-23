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
import { footprintFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { roundedRect } from '../../../../src/domain/asset/presets/presetGeometry';
import { editableShape, shapeWithRoundedRect } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';

const TOP: OutlinePart = { kind: 'detail', id: 'detail-1' };
const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

function figures(
	selection: DesignerSelection | null,
	all = false,
	shape: AssetShape = editableShape(),
	hidden: ReadonlySet<string> = NOTHING_HIDDEN,
): DimensionFigure[] {
	return dimensionFigures(shape, selection, all, hidden);
}

/**
 * The shape `edit` writes, refusing a `null` loudly. **`null` is a real answer here and means "no
 * command at all"** (C03), so a case that expects a WRITE has to say which it expected rather than
 * letting `expectOk` swallow the distinction.
 */
function written(figure: DimensionFigure, typed: number, shape: AssetShape = editableShape()): AssetShape {
	const result = figure.edit(typed)(shape);
	if (result === null) throw new Error(`${figure.name} answered no-write for ${String(typed)}, which this case did not expect`);
	return expectOk(result);
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
	const box = partMeasure(written(figure, typed), part);
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
	 * **A HIDDEN part is not measured, which is a second per-part fact and not the pending one.**
	 * `DesignerCanvas` drops a hidden graphic from what it draws through this same `partView.hidden`
	 * set, so measuring one would put six editable millimetre labels over nothing — and a user who
	 * hid a part to get it out of the way would get its numbers back the moment they ticked
	 * `All dimensions`.
	 *
	 * Both modes again, because the selection and the toggle reach a part by different paths.
	 */
	it('measures no hidden part, neither selected nor under the toggle', () => {
		const hidden = new Set(['detail-1']);

		expect(figures(TOP, false, editableShape(), hidden).map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
		expect(figures(null, true, editableShape(), hidden).some((figure) => figure.name.startsWith('detail-detail-1-'))).toBe(false);
	});

	/**
	 * `locked` is deliberately NOT asked beside `hidden`, and this case pins the decision rather
	 * than the absence of code: `DesignerSelectionInspector` already lets a locked part be resized
	 * by typing, so a lock that stopped this field and not that one would be two answers to what a
	 * lock means. Nothing here consults it, and a locked part measures exactly as it did.
	 */
	it('measures a locked part exactly as an unlocked one', () => {
		expect(figures(TOP).map((figure) => [figure.name, figure.value]))
			.toEqual(figures(TOP, false, editableShape(), NOTHING_HIDDEN).map((figure) => [figure.name, figure.value]));
	});

	/**
	 * A selection naming a detail the shape has not got draws nothing for it — the frame between a
	 * peer's delete landing and the store pruning the selection, which `DesignerSelectionInspector`'s
	 * `exists` guard covers on the other surface.
	 */
	it('draws nothing for a selected detail the shape has lost', () => {
		expect(figures({ kind: 'detail', id: 'detail-gone' }).map((figure) => figure.name)).toEqual(['overall-width', 'overall-depth']);
	});

	/**
	 * **`Show clearance` off withholds the clearance's figures (AD18-R17)**, in both modes, for the
	 * hidden part's reason: the canvas stops drawing that boundary, so six editable millimetre labels
	 * would stand over nothing.
	 */
	it('measures no clearance while Show clearance is off, neither selected nor under the toggle', () => {
		const hiddenClearance = (selection: DesignerSelection | null, all: boolean): string[] =>
			dimensionFigures(editableShape(), selection, all, NOTHING_HIDDEN, false).map((figure) => figure.name);

		expect(hiddenClearance({ kind: 'clearance' }, false)).toEqual(['overall-width', 'overall-depth']);
		expect(hiddenClearance(null, true).some((name) => name.startsWith('clearance-'))).toBe(false);
		expect(hiddenClearance(null, true)).toContain('detail-detail-1-width');
	});
});

/**
 * **What each dimension LINE spans (AD18-R17, board 01)**: the axis it runs along and the two points
 * on the edges it measures, at the row or column its label is anchored on. The component turns them
 * into a line, two arrowheads and two extension lines; this module states only the world geometry.
 */
describe('the span each figure measures', () => {
	const span = (list: readonly DimensionFigure[], name: string): [string, number, number, number, number] => {
		const figure = named(list, name);
		return [figure.axis, figure.from.x, figure.from.y, figure.to.x, figure.to.y];
	};

	it('runs each size along its own edge, from one corner to the other', () => {
		const drawn = figures(TOP);

		expect(span(drawn, 'overall-width')).toEqual(['x', -500, -300, 500, -300]);
		expect(span(drawn, 'overall-depth')).toEqual(['y', -500, -300, -500, 300]);
		expect(span(drawn, 'detail-detail-1-width')).toEqual(['x', -400, -100, 0, -100]);
		expect(span(drawn, 'detail-detail-1-depth')).toEqual(['y', -400, -100, -400, 100]);
	});

	/** From the edge the gap is measured OFF to the edge it is measured TO — signed, so it can run backwards. */
	it('runs each offset across its gap, through the middle of the part', () => {
		const drawn = figures(TOP);

		expect(span(drawn, 'detail-detail-1-offset-left')).toEqual(['x', -500, 0, -400, 0]);
		expect(span(drawn, 'detail-detail-1-offset-right')).toEqual(['x', 0, 0, 500, 0]);
		expect(span(drawn, 'detail-detail-1-offset-top')).toEqual(['y', -200, -300, -200, -100]);
		expect(span(drawn, 'detail-detail-1-offset-bottom')).toEqual(['y', -200, 100, -200, 300]);
		// The clearance reaches 400 past the footprint's bottom edge: the span runs back up to it.
		expect(span(figures({ kind: 'clearance' }), 'clearance-offset-bottom')).toEqual(['y', 0, 700, 0, 300]);
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
		const moved = written(named(figures(TOP), 'detail-detail-1-offset-right'), 600);

		expect(named(dimensionFigures(moved, TOP, false, NOTHING_HIDDEN), 'detail-detail-1-offset-right').value).toBe(600);
		expect(named(dimensionFigures(moved, TOP, false, NOTHING_HIDDEN), 'detail-detail-1-width').value).toBe(400);
	});

	/**
	 * Both y-axis offsets, so the `axis === 'y'` arm of the displacement is driven in BOTH signs —
	 * the x pair above cannot reach it, and a module that wrote `dy` where it meant `dx` would pass
	 * every case that only ever typed a left or a right.
	 */
	it.each([['top'], ['bottom']] as const)('moves a part along y for the %s offset', (edge: string) => {
		const moved = written(named(figures(TOP), `detail-detail-1-offset-${edge}`), 300);
		const again = dimensionFigures(moved, TOP, false, NOTHING_HIDDEN);

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
		const moved = written(named(rendered, 'detail-detail-1-offset-left'), 200);

		const again = written(named(rendered, 'detail-detail-1-offset-left'), 150, moved);

		expect(partMeasure(again, TOP)?.centre.x).toBe(-150);
	});

	/** A part deleted between the render and the write is refused by name rather than written past. */
	it('refuses an offset for a part the shape no longer has', () => {
		const result = named(figures(TOP), 'detail-detail-1-offset-left').edit(150)(editableShape({ details: [] }));

		expect(result === null ? null : result.ok).toBe(false);
	});

	/**
	 * **F3's gap, closed: the DEPTH edit is executed here.** Both of its arrow functions had zero
	 * hits in `coverage-final.json` while every width case passed, which is precisely where a
	 * `'width'`/`'depth'` transposition would have lived — the twin of the axis red watched for the
	 * offsets, which the size pair had no equivalent of.
	 */
	it('resizes a part along depth, about its own centre', () => {
		const box = partMeasure(written(named(figures(TOP), 'detail-detail-1-depth'), 100), TOP);

		expect(box === null ? null : [box.centre.y - box.depth / 2, box.centre.y + box.depth / 2]).toEqual([-50, 50]);
	});
});

describe('typing the current value, which is no command at all', () => {
	/**
	 * **C03 in as many words**: *"Typing the current value, Escape and cancelling a dialog create no
	 * command/history entry"*, and C05's *"a cancelled/refused/no-op gesture is none"*.
	 *
	 * Nothing below the figure answers this, which is why the figure has to. `editShape`'s only
	 * no-op door fires on a `null` EDIT; `SetAssetShapeCommand`'s `ALWAYS_CHANGED` is
	 * `() => false` with a docblock saying nothing is compared, deliberately; and `CommandHistory`
	 * pushes for any ok result and clears the redo stack. So before this, typing back the number a
	 * figure already showed wrote a vault revision, pushed an undo entry and discarded redo.
	 *
	 * Every family is driven, because the three build their edits through different functions and
	 * a guard added to one of them would leave the other two writing.
	 */
	it.each([
		['overall-width', 1000],
		['detail-detail-1-width', 400],
		['detail-detail-1-depth', 200],
		['detail-detail-1-offset-left', 100],
		['detail-detail-1-offset-right', 500],
		['detail-detail-1-offset-top', 200],
		['detail-detail-1-offset-bottom', 200],
	])('answers no-write when %s is typed its own value, %i', (name: string, current: number) => {
		expect(named(figures(TOP), name).edit(current)(editableShape())).toBeNull();
	});

	/**
	 * **The clause C03 states separately, and the one the first version of this card missed
	 * entirely**: *"do not quantize canonical values merely because the inspector displays rounded
	 * measurements"*.
	 *
	 * The button and the field both show `Math.round(value)`, so a footprint measuring 999.6 opens
	 * a field reading `1000`. A user who changes nothing and presses Apply has typed the value they
	 * were SHOWN — and comparing only against the canonical 999.6 would have written 1000 and lost
	 * the six tenths, in a gesture that edited nothing.
	 *
	 * `AssetDesignerRoot.editDimensions` took this decision first for the whole-design form and
	 * states the cost this inherits: 1000 cannot be typed onto a 999.6 part through this field,
	 * because that gesture is indistinguishable from leaving it alone.
	 */
	it('answers no-write for the ROUNDED number the field actually showed', () => {
		const odd = editableShape({ footprint: expectOk(footprintFromDimensions(999.6, 600)) });
		const figure = named(figures(null, false, odd), 'overall-width');

		expect(figure.value).toBe(999.6);
		expect(figure.edit(Math.round(figure.value))(odd)).toBeNull();
		// A number the user actually changed still writes, so the guard is not a wall.
		expect(figure.edit(1001)(odd)).not.toBeNull();
	});

	/** A part deleted between the render and the write is refused rather than read as a no-op. */
	it('refuses rather than answering no-write when the part is gone', () => {
		const result = named(figures(TOP), 'detail-detail-1-offset-left').edit(100)(editableShape({ details: [] }));

		expect(result === null ? null : result.ok).toBe(false);
	});
});

/** AD18-R17: typing a Width or Depth into a rounded rectangle's own dimension label keeps its corners round. */
describe('a rounded rectangle’s dimension labels', () => {
	it('keep its radius through a typed width', () => {
		const shape = shapeWithRoundedRect();
		const figure = named(figures({ kind: 'detail', id: 'detail-3' }, false, shape), 'detail-detail-3-width');

		expect(written(figure, 1400, shape).details.find((detail) => detail.id === 'detail-3')?.outline).toEqual(roundedRect(1400, 600, 150, 20, 30));
	});
});
