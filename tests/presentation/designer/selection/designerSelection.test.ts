import { describe, expect, it } from 'vitest';
import {
	isOutlineSelection,
	partKey,
	sameSelection,
	selectionExists,
	type DesignerSelection,
} from '../../../../src/presentation/designer/selection/designerSelection';
import { editableShape, shapeWithOpenGraphic } from '../../../helpers/assetShapes';

/** Spec 2026-09-13 Decision 10: what the designer can select, and how two selections compare. */
const FOOTPRINT: DesignerSelection = { kind: 'footprint' };
const CLEARANCE: DesignerSelection = { kind: 'clearance' };
const TOP: DesignerSelection = { kind: 'detail', id: 'detail-1' };
const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };
const ANCHOR: DesignerSelection = { kind: 'anchor' };
const FACING: DesignerSelection = { kind: 'facing' };

describe('the designer selection', () => {
	it.each<readonly [DesignerSelection | null, boolean]>([
		[FOOTPRINT, true],
		[CLEARANCE, true],
		[TOP, true],
		[ANCHOR, false],
		[FACING, false],
		[null, false],
	])('isOutlineSelection(%o) is %s', (selection, expected) => {
		expect(isOutlineSelection(selection)).toBe(expected);
	});

	it('keys each part, a detail by its id', () => {
		expect([FOOTPRINT, CLEARANCE, TOP, ANCHOR, FACING].map((selection) => partKey(selection))).toEqual([
			'footprint',
			'clearance',
			'detail:detail-1',
			'anchor',
			'facing',
		]);
	});

	it('compares selections by the part they name, not by identity', () => {
		expect(sameSelection(null, null)).toBe(true);
		expect(sameSelection(null, FOOTPRINT)).toBe(false);
		expect(sameSelection(FOOTPRINT, null)).toBe(false);
		expect(sameSelection({ kind: 'detail', id: 'detail-1' }, TOP)).toBe(true);
		expect(sameSelection(TOP, BOWL)).toBe(false);
		expect(sameSelection(FOOTPRINT, CLEARANCE)).toBe(false);
	});

	it('says whether the part a selection names is still on the shape', () => {
		const shape = editableShape();
		expect(selectionExists(null, ANCHOR)).toBe(false);
		expect(selectionExists(shape, FOOTPRINT)).toBe(true);
		expect(selectionExists(shape, CLEARANCE)).toBe(true);
		expect(selectionExists(editableShape({ clearance: null }), CLEARANCE)).toBe(false);
		expect(selectionExists(shape, BOWL)).toBe(true);
		expect(selectionExists(shape, { kind: 'detail', id: 'detail-9' })).toBe(false);
		expect(selectionExists(shape, FACING)).toBe(true);
	});

	/**
	 * **An OPEN graphic is a part that exists**, and asking `outlineOf` was the wrong question here.
	 * That function deliberately answers `null` for an open graphic so no closed-only EDIT can reach
	 * one (AD04); this predicate is not an edit, it is what `AssetDesignStore.hydrate` prunes the
	 * selection with. Routed through `outlineOf`, a selected open graphic was dropped from the
	 * selection on the next read-back — the part is on the shape, drawn on the canvas and listed in
	 * the Parts panel, and the selection silently emptied itself on every write.
	 */
	it('counts an open graphic as a part that is there, which an outline lookup cannot answer', () => {
		expect(selectionExists(shapeWithOpenGraphic(), { kind: 'detail', id: 'detail-3' })).toBe(true);
	});
});
