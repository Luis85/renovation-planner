/**
 * The reorder arithmetic (ADR-0029): siblings renumbered 0..n-1 with the moved one at its new
 * index, and ONE write per sibling whose STORED `order` differs from that index — never per
 * sibling whose POSITION changed. Every existing vault holds `order: 0` on every plan (sorted
 * by name), so a move that skipped "unchanged positions" would leave stale zeros that re-sort
 * wrongly on the next read; the two ALL_ZERO cases pin that.
 *
 * A NODE test, importing the pure module and never the composable: `planOrderWrites.ts`'s
 * docblock carries what importing `usePlanReorder` from here cost the coverage gate.
 */
import { describe, expect, it } from 'vitest';
import { plannedWrites } from '../../../../src/presentation/editor/shell/planOrderWrites';
import type { PropertyTreeNode } from '../../../../src/presentation/read-models/planHierarchy';

const node = (id: string, order: number): PropertyTreeNode => ({ id, name: id, kind: 'floor', order, parentId: null, children: [] });
/** Stored order equal to the position, as a vault this build has already renumbered holds it. */
const SIBLINGS = [node('a', 0), node('b', 1), node('c', 2), node('d', 3)];
/** Stored order 0 on every sibling, as every vault older than this build holds it. */
const ALL_ZERO = [node('a', 0), node('b', 0), node('c', 0), node('d', 0)];

describe('plannedWrites', () => {
	it('renumbers 0..n-1 after the move and writes only what changed', () => {
		expect(plannedWrites(SIBLINGS, 'c', 0)).toEqual([{ planId: 'c', order: 0 }, { planId: 'a', order: 1 }, { planId: 'b', order: 2 }]);
		expect(plannedWrites(SIBLINGS, 'a', 3)).toEqual([{ planId: 'b', order: 0 }, { planId: 'c', order: 1 }, { planId: 'd', order: 2 }, { planId: 'a', order: 3 }]);
	});

	it('writes nothing for a move to the same place or an unknown id, and clamps an index off the end', () => {
		expect(plannedWrites(SIBLINGS, 'b', 1)).toEqual([]);
		expect(plannedWrites(SIBLINGS, 'zz', 0)).toEqual([]);
		expect(plannedWrites(SIBLINGS, 'a', 9)).toEqual([{ planId: 'b', order: 0 }, { planId: 'c', order: 1 }, { planId: 'd', order: 2 }, { planId: 'a', order: 3 }]);
	});

	it('compares against the STORED order, so an all-zero vault is renumbered in full', () => {
		expect(plannedWrites(ALL_ZERO, 'a', 1)).toEqual([{ planId: 'a', order: 1 }, { planId: 'c', order: 2 }, { planId: 'd', order: 3 }]);
		// The positions are already right and the move is a no-op — the renumbering is the point.
		expect(plannedWrites(ALL_ZERO, 'b', 1)).toEqual([{ planId: 'b', order: 1 }, { planId: 'c', order: 2 }, { planId: 'd', order: 3 }]);
	});
});
