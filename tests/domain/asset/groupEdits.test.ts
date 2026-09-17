import { describe, expect, it } from 'vitest';
import {
	groupDetails,
	groupOfDetail,
	moveGroupToEnd,
	nextGroupId,
	ungroupDetails,
} from '../../../src/domain/asset/groupEdits';
import { graphicIds, grouped, threeBoxes, withPending } from '../../helpers/arrangeShapes';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Contract C06's grouping half: shallow groups that change no coordinates and no order, refuse
 * rather than repair, and give a group exactly one ordering action at each end.
 */

const code = (result: ReturnType<typeof groupDetails>): string => expectErr(result).code;

describe('groupDetails', () => {
	it('adds one group over the named graphics and writes their ids in canonical order', () => {
		// Named back to front on purpose: the stored membership must be the draw order, not the
		// order they were pressed, or two identical groups would compare unequal.
		const shape = expectOk(groupDetails(threeBoxes(), ['detail-3', 'detail-1']));
		expect(shape.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-3'] }]);
	});

	it('changes no coordinate, no order and none of the shape’s other parts', () => {
		const before = threeBoxes();
		const after = expectOk(groupDetails(before, ['detail-1', 'detail-2']));
		expect(after.details).toEqual(before.details);
		expect({ ...after, groups: undefined }).toEqual({ ...before, groups: undefined });
	});

	it('leaves interleaved members interleaved', () => {
		const after = expectOk(groupDetails(threeBoxes(), ['detail-1', 'detail-3']));
		expect(graphicIds(after)).toEqual(['detail-1', 'detail-2', 'detail-3']);
	});

	it('refuses fewer than two graphics', () => {
		expect(code(groupDetails(threeBoxes(), ['detail-1']))).toBe('asset.too-few-parts');
	});

	it('refuses a graphic the design has not got', () => {
		expect(code(groupDetails(threeBoxes(), ['detail-1', 'detail-9']))).toBe('asset.part-not-found');
	});

	it('refuses the same graphic named twice', () => {
		expect(code(groupDetails(threeBoxes(), ['detail-1', 'detail-1']))).toBe('asset.duplicate-part');
	});

	it('refuses a graphic that is already in another group, under the aggregate’s own code', () => {
		expect(code(groupDetails(grouped(['detail-1', 'detail-2']), ['detail-2', 'detail-3']))).toBe('asset.overlapping-groups');
	});

	/**
	 * **The other half of ruling AD10-R1**, and the reason the mixed-space check sits in
	 * `arrangeDetails.participants` rather than in the `resolveParticipants` both files share: a group
	 * carries no coordinates, so nothing here combines two coordinate spaces and C07's metadata half
	 * applies. A refusal in the shared resolver would refuse exactly the case the ruling permits.
	 */
	it('groups a selection mixing background pixels with millimetres, because a group holds no coordinates', () => {
		const shape = expectOk(groupDetails(withPending(['detail-3']), ['detail-1', 'detail-3']));
		expect(shape.groups).toEqual([{ id: 'group-1', members: ['detail-1', 'detail-3'] }]);
	});
});

describe('group then ungroup', () => {
	/**
	 * **The invariance the whole feature rests on**, and the one that passes trivially against an
	 * operation that does nothing — so the case above asserting a group is actually written is its
	 * other half, and both were watched failing against a `groupDetails` that reordered `details`.
	 */
	it('answers a design identical to the one it started from', () => {
		const before = threeBoxes();
		const grouped_ = expectOk(groupDetails(before, ['detail-1', 'detail-3']));
		const after = expectOk(ungroupDetails(grouped_, 'group-1'));
		// `validateAssetShape` answers `groups: []` for an absent array, which the fixture has not
		// got; compared through the same validator so the two sides mean the same thing.
		expect(after).toEqual({ ...before, groups: [] });
	});
});

describe('ungroupDetails', () => {
	it('removes only the named group and leaves the members where they are', () => {
		const before = grouped(['detail-1', 'detail-2']);
		const after = expectOk(ungroupDetails(before, 'group-1'));
		expect(after.groups).toEqual([]);
		expect(after.details).toEqual(before.details);
	});

	it('refuses a group the design has not got', () => {
		expect(code(ungroupDetails(threeBoxes(), 'group-7'))).toBe('asset.group-not-found');
	});
});

describe('nextGroupId', () => {
	it('starts at group-1 and then goes one above the highest numbered id', () => {
		expect(nextGroupId(threeBoxes())).toBe('group-1');
		expect(nextGroupId(grouped(['detail-1', 'detail-2'], { id: 'group-4' }))).toBe('group-5');
	});
});

describe('groupOfDetail', () => {
	it('answers the group a graphic is in, and null for one in none', () => {
		const shape = grouped(['detail-1', 'detail-2']);
		expect(groupOfDetail(shape, 'detail-2')?.id).toBe('group-1');
		expect(groupOfDetail(shape, 'detail-3')).toBeNull();
	});
});

describe('moveGroupToEnd', () => {
	it('moves a noncontiguous group to the front as a block, keeping its internal order', () => {
		const shape = expectOk(moveGroupToEnd(grouped(['detail-1', 'detail-3']), 'group-1', 'front'));
		expect(graphicIds(shape)).toEqual(['detail-2', 'detail-1', 'detail-3']);
	});

	it('moves it to the back the same way', () => {
		const shape = expectOk(moveGroupToEnd(grouped(['detail-2', 'detail-3']), 'group-1', 'back'));
		expect(graphicIds(shape)).toEqual(['detail-2', 'detail-3', 'detail-1']);
	});

	it('moves no coordinates and no membership', () => {
		const before = grouped(['detail-1', 'detail-3']);
		const after = expectOk(moveGroupToEnd(before, 'group-1', 'front'));
		expect(after.groups).toEqual(before.groups);
		expect(after.details.map((detail) => detail.outline)).toEqual(
			['detail-2', 'detail-1', 'detail-3'].map((id) => before.details.find((detail) => detail.id === id)?.outline),
		);
	});

	it('refuses a group the design has not got', () => {
		expect(code(moveGroupToEnd(threeBoxes(), 'group-7', 'front'))).toBe('asset.group-not-found');
	});

	/**
	 * **The very shape back, not an equal one** (contract C05): Bring group to front on a group
	 * already at the front is a reachable no-op, and an equal-but-fresh shape costs a sidecar
	 * revision and an undo entry that appears to do nothing. The two cases at the top of this
	 * describe are the other half — they assert a reorder that really reorders.
	 */
	it.each([['front', ['detail-2', 'detail-3']], ['back', ['detail-1', 'detail-2']]] as const)(
		'answers the very shape it was handed where the members already sit at the %s',
		(to, members) => {
			const before = grouped(members);
			expect(expectOk(moveGroupToEnd(before, 'group-1', to))).toBe(before);
		},
	);

	/** Reordering writes no coordinate, so the ruling that binds the four spatial operations does not bind this one. */
	it('reorders a group holding both a pending and a measured graphic', () => {
		const shape = expectOk(moveGroupToEnd(expectOk(groupDetails(withPending(['detail-3']), ['detail-1', 'detail-3'])), 'group-1', 'front'));
		expect(graphicIds(shape)).toEqual(['detail-2', 'detail-1', 'detail-3']);
	});
});
