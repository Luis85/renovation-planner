import { expect, it } from 'vitest';
import { groupsAfterStructureChange, restoreGroupMember } from '../../../src/domain/spatial/groupMembership';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { WALL_LOOP } from '../../helpers/structure';
import { expectErr, expectOk } from '../../helpers/domain';

const GROUPS = [{ id: 'group-a', name: 'Group 1', memberIds: ['wall-a', 'wall-b'] }];

it('keeps every group when a structure edit has no walls or elements to compare on either side', () => {
	// Neither side names anything, so nothing is surviving and nothing is removed.
	expect(groupsAfterStructureChange(GROUPS, undefined, undefined)).toEqual(GROUPS);
	// A structure that genuinely drops a member still prunes it, so the case above is not vacuous.
	expect(groupsAfterStructureChange(GROUPS, WALL_LOOP, EMPTY_STRUCTURE)).toEqual([]);
	// No groups at all is answered as it was asked, rather than as an empty list.
	expect(groupsAfterStructureChange(undefined, WALL_LOOP, EMPTY_STRUCTURE)).toBeUndefined();
});

it('refuses to restore a member some group already holds again', () => {
	const current = [{ id: 'group-b', name: 'Peer', memberIds: ['wall-a'] }];
	expect(expectErr(restoreGroupMember(GROUPS, current, 'wall-a')).code).toBe('spatial-group.restore-conflict');
	// An id no stored group ever held is not a conflict; the current membership is returned unchanged.
	expect(expectOk(restoreGroupMember(GROUPS, current, 'wall-z'))).toBe(current);
});
