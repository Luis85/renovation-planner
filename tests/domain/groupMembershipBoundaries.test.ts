import { expect, it } from 'vitest';
import { groupsAfterStructureChange, restoreGroupMember } from '../../src/domain/spatial/groupMembership';
import { EMPTY_STRUCTURE } from '../../src/domain/spatial/Structure';
import { expectErr, expectOk } from '../helpers/domain';

it('preserves independent Room membership when structure is introduced or entirely removed', () => {
	const group = { id: 'group-room', name: 'Kitchen', memberIds: ['room-one'] };
	const structure = { ...EMPTY_STRUCTURE, walls: [{ id: 'wall-one', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 100, height: 2400 }] };
	expect(groupsAfterStructureChange([group], undefined, structure)).toEqual([group]);
	const mixed = { ...group, memberIds: ['wall-one', 'room-one'] };
	expect(groupsAfterStructureChange([mixed], structure, undefined)).toEqual([group]);
	expect(mixed.memberIds).toEqual(['wall-one', 'room-one']);
});

it.each([
	{ name: 'Reused identity', memberIds: ['peer-room'] },
	{ name: 'Original', memberIds: ['another-peer-room'] },
])('refuses a deleted singleton identity reused by a peer: $name', peer => {
	const original = { id: 'group-one', name: 'Original', memberIds: ['deleted-room'] };
	const current = [{ id: original.id, ...peer }], before = structuredClone(current);
	expect(expectErr(restoreGroupMember([original], current, 'deleted-room'))).toMatchObject({ code: 'spatial-group.restore-conflict' });
	expect(current).toEqual(before);
});

it('leaves peer groups intact when restoring a Room that was never a member', () => {
	const current = [{ id: 'group-peer', name: 'Peer selection', memberIds: ['peer-room'] }];
	expect(expectOk(restoreGroupMember([], current, 'unrelated-room'))).toEqual(current);
});
