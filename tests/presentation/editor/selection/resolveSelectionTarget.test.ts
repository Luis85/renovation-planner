import { describe, expect, it } from 'vitest';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';

/**
 * The ONE answer to "what would a click here select" (design spec §6.1) — see the function's
 * own docblock for the priority it resolves. Hover asks it to predict, `SelectTool.pointerDown`
 * asks it to act, and these cases are what stops the two from being able to disagree.
 */

const square = (id: string, x: number, y: number, size: number) => ({
	id,
	points: [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }],
});

describe('resolveSelectionTarget', () => {
	const below = square('below', 0, 0, 1000);
	const above = square('above', 500, 500, 1000);
	const base = { candidates: [below, above], selectedIds: [], handleToleranceWorld: 50 };

	it('picks the topmost body where two overlap', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 700, y: 700 } })).toEqual({ kind: 'body', id: 'above' });
	});
	it('picks the only body containing the point', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 100, y: 100 } })).toEqual({ kind: 'body', id: 'below' });
	});
	it('answers null over empty canvas', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 5000, y: 5000 } })).toBeNull();
	});
	it('a vertex handle of the SELECTED record beats every body', () => {
		expect(resolveSelectionTarget({ ...base, selectedIds: ['below'], worldPoint: { x: 1010, y: 1010 } })).toEqual({ kind: 'handle', id: 'below', vertexIndex: 2 });
	});
	it('a vertex of an UNSELECTED record is just a body hit', () => {
		expect(resolveSelectionTarget({ ...base, worldPoint: { x: 1010, y: 1010 } })).toEqual({ kind: 'body', id: 'above' });
	});
	/**
	 * [[The overlap-order test repeats the same candidate order]]: the case this replaces
	 * computed both values from the SAME `[below, above]` order, so it was the same call
	 * repeated and could not detect nondeterminism or an accidental reversal of the z-order
	 * rule. `candidates` is z-order, bottom first (design spec §6.1), and
	 * `resolveSelectionTarget` deliberately scans it in reverse so the LAST drawn body wins —
	 * so the discriminating property is that the same ORDERED list is stable, and reversing
	 * that order makes the other body newly topmost.
	 */
	it('is a function of z-order: the same ordered list answers the same, and reversing it makes the other body topmost', () => {
		const at = { x: 700, y: 700 };
		expect(resolveSelectionTarget({ ...base, worldPoint: at })).toEqual(resolveSelectionTarget({ ...base, worldPoint: at }));
		expect(resolveSelectionTarget({ ...base, candidates: [above, below], worldPoint: at })).toEqual({ kind: 'body', id: 'below' });
	});

	// Two arms the six cases above never drive, each a coverage-floor requirement rather than
	// an afterthought: this repository's own rule is that an untested arm in a tight metric
	// fails the gate outright.
	it('a selected id naming no candidate is skipped rather than thrown on', () => {
		// The selection names a record the current candidate list no longer has — deleted
		// elsewhere, exactly like `SelectTool`'s own existing case for the same situation.
		// `selected === undefined` must `continue` past it to the next selected id, and here
		// there is no next one, so the body scan is what answers.
		expect(
			resolveSelectionTarget({ ...base, selectedIds: ['zone-gone'], worldPoint: { x: 700, y: 700 } }),
		).toEqual({ kind: 'body', id: 'above' });
	});
	it('a degenerate candidate polygon is skipped by the body scan rather than thrown on', () => {
		// Two vertices cannot enclose anything: `contains` refuses it as a `GeometryError`
		// rather than answering `true`/`false`, and `inside.ok === false` must be treated as
		// "not a hit" so the scan moves on to the next candidate down instead of crashing.
		const degenerate = { id: 'sliver', points: [{ x: 0, y: 0 }, { x: 1000, y: 1000 }] };
		expect(
			resolveSelectionTarget({
				candidates: [below, degenerate],
				selectedIds: [],
				handleToleranceWorld: 50,
				worldPoint: { x: 100, y: 100 },
			}),
		).toEqual({ kind: 'body', id: 'below' });
	});
});
