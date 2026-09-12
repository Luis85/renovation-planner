import { describe, expect, it } from 'vitest';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';
import { structureCandidates } from '../../../../src/presentation/editor/structure/structureCandidates';
import { WALL_LOOP } from '../../../helpers/structure';

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

	it('ranks Object before Opening before Wall before Room across paint orders and cycles every overlap', () => {
		const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'window' as const, hostId: 'wall-a', offset: 500, width: 1000, height: 1000, sill: 700 }] };
		const room = square('room', 0, 0, 4000);
		const object = { ...square('object', 600, -100, 400), kind: 'object' as const };
		const all = [object, ...structureCandidates(structure), room];
		const order = ['object', 'opening-a', 'wall-a', 'room'];
		for (const candidates of [all, all.toReversed()]) {
			const hit = { candidates, selectedIds: [], worldPoint: { x: 800, y: 0 }, handleToleranceWorld: 10 };
			expect(resolveSelectionTarget(hit)).toEqual({ kind: 'body', id: 'object' });
			for (const [index, id] of order.entries()) {
				expect(resolveSelectionTarget({ ...hit, selectedIds: [id], cycle: true })).toEqual({ kind: 'body', id: order[(index + 1) % order.length] });
			}
			expect(resolveSelectionTarget({ ...hit, worldPoint: { x: 9000, y: 9000 }, cycle: true })).toBeNull();
		}
	});
	it('preserves object stacking within kind without mutating candidates and lets handles and badges take precedence', () => {
		const first = { ...square('first-object', -100, -100, 1200), kind: 'object' as const };
		const last = { ...first, id: 'last-object' };
		const candidates = [first, last, below];
		const original = candidates.slice();
		const hit = { ...base, candidates, worldPoint: { x: 500, y: 500 } };
		expect(resolveSelectionTarget(hit)).toEqual({ kind: 'body', id: 'last-object' });
		expect(resolveSelectionTarget({ ...hit, candidates: candidates.toReversed() })).toEqual({ kind: 'body', id: 'first-object' });
		expect(candidates).toEqual(original);
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['below'], worldPoint: { x: 0, y: 0 } })).toEqual({ kind: 'handle', id: 'below', vertexIndex: 0 });
		const badge = { ...hit, selectedIds: ['first-object', 'below'], worldPoint: { x: 0, y: 0 }, badgeToleranceWorld: 150 };
		expect(resolveSelectionTarget(badge)).toEqual({ kind: 'body', id: 'below' });
		expect(resolveSelectionTarget({ ...badge, cycle: true })).toEqual({ kind: 'body', id: 'below' });
	});

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

	it('measures a collapsed edge from its own endpoint instead of dividing by its length', () => {
		// Two identical consecutive points give the projection no length to divide by. The
		// distance is still the one from that endpoint, so the record stays selectable.
		const collapsed = { id: 'marker', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
		const at = (x: number) =>
			resolveSelectionTarget({
				candidates: [collapsed],
				selectedIds: [],
				handleToleranceWorld: 50,
				worldPoint: { x, y: 0 },
			});
		expect(at(10)).toEqual({ kind: 'body', id: 'marker' });
		expect(at(400)).toBeNull();
	});

	it('offers no multi-selection badge at all when no badge tolerance is supplied', () => {
		const input = {
			candidates: [below, above],
			selectedIds: ['below', 'above'],
			handleToleranceWorld: 50,
			worldPoint: { x: 100, y: 100 },
		};
		// With a tolerance the press lands on the badge anchored at the outline's first point.
		expect(resolveSelectionTarget({ ...input, badgeToleranceWorld: 200 })).toEqual({ kind: 'body', id: 'below' });
		// Without one it is no badge rather than an unbounded one, so the body answers instead.
		expect(resolveSelectionTarget(input)).toEqual({ kind: 'body', id: 'below' });
	});
});

describe('resolveSelectionTarget caption grabs', () => {
	const room = square('room', 0, 0, 1000);
	const labels = [{ id: 'room', bounds: { min: { x: 400, y: 450 }, max: { x: 600, y: 520 } }, offset: { dx: 0, dy: 0 } }];
	const hit = { candidates: [room], labels, worldPoint: { x: 500, y: 500 }, handleToleranceWorld: 50, labelToleranceWorld: 10 };

	it('grabs a selected item caption, padded, ahead of its body', () => {
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'] })).toEqual({ kind: 'label', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], worldPoint: { x: 395, y: 500 } })).toEqual({ kind: 'label', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], worldPoint: { x: 380, y: 500 } })).toEqual({ kind: 'body', id: 'room' });
	});

	it('never grabs an unselected, undrawn or cycled caption', () => {
		expect(resolveSelectionTarget({ ...hit, selectedIds: [] })).toEqual({ kind: 'body', id: 'room' });
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], candidates: [] })).toBeNull();
		expect(resolveSelectionTarget({ ...hit, selectedIds: ['room'], cycle: true })).toEqual({ kind: 'body', id: 'room' });
	});

	it('leaves a vertex handle to the handle even where a caption covers it', () => {
		const corner = [{ id: 'room', bounds: { min: { x: -20, y: -20 }, max: { x: 100, y: 100 } }, offset: { dx: 0, dy: 0 } }];
		expect(resolveSelectionTarget({ ...hit, labels: corner, selectedIds: ['room'], worldPoint: { x: 0, y: 0 } })).toEqual({ kind: 'handle', id: 'room', vertexIndex: 0 });
		expect(resolveSelectionTarget({ ...hit, labels: corner, selectedIds: ['room'], worldPoint: { x: 90, y: 90 } })).toEqual({ kind: 'label', id: 'room' });
	});
});
