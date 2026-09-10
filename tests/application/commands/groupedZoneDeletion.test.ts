import { afterEach, expect, it, vi } from 'vitest';
import { groupDeletionStack } from '../../helpers/groupDeletion';
import { expectErr, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../helpers/entities';
import { err } from '../../../src/core/result/Result';

afterEach(() => vi.restoreAllMocks());

it.each([false, true])('prunes grouped Room membership and restores exact history through fresh repositories; singleton=%s', async singleton => {
	const rig = await groupDeletionStack(singleton), command = rig.deletion();
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	for (let cycle = 0; cycle < 2; cycle++) {
		expectOk(await command.execute());
		let fresh = rig.reopen();
		expect(expectOk(await fresh.zones.getById(rig.id))).toBeNull();
		const removed = expectOk(await fresh.geometry.read(rig.plan.id)).document;
		expect(removed.groups).toEqual(singleton ? [rig.unrelated] : [{ ...rig.group, memberIds: ['wall-a', rig.object.id, 'wall-b'] }, rig.unrelated]);
		expect(removed.structure?.openings).toEqual([rig.opening]); expect(removed.structure?.boundaries).toEqual([]);
		expectOk(await command.undo()); fresh = rig.reopen();
		expect(expectOk(await fresh.geometry.read(rig.plan.id)).document).toEqual(before);
		expect(expectFound(await fresh.zones.getById(rig.id)).entity.geometry).toEqual(rig.zone.geometry);
	}
});

it.each(['rename', 'reorder', 'replace'] as const)('refuses Room membership restoration after peer %s and compensates its note', async kind => {
	const rig = await groupDeletionStack(), command = rig.deletion(); expectOk(await command.execute());
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const remaining = ['wall-a', rig.object.id, 'wall-b'];
	const changed = kind === 'rename' ? { ...rig.group, name: 'Peer name', memberIds: remaining }
		: kind === 'reorder' ? { ...rig.group, memberIds: remaining.toReversed() } : { id: 'group-peer', name: 'Peer assembly', memberIds: remaining };
	const peer = { ...read.document, groups: [changed, rig.unrelated] };
	expectOk(await rig.geometry.write(rig.plan.id, peer, read.version));
	expect(expectErr(await command.undo()).code).toBe('spatial.group-restore-conflict');
	const fresh = rig.reopen(); expect(expectOk(await fresh.zones.getById(rig.id))).toBeNull();
	expect(expectOk(await fresh.geometry.read(rig.plan.id)).document).toEqual(peer);
});

it('preserves a peer change to an unrelated group while restoring the deleted member in its original position', async () => {
	const rig = await groupDeletionStack(), command = rig.deletion(); expectOk(await command.execute());
	const read = expectOk(await rig.geometry.read(rig.plan.id)), other = { ...rig.unrelated, name: 'Peer retained name' };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [{ ...rig.group, memberIds: ['wall-a', rig.object.id, 'wall-b'] }, other] }, read.version));
	expectOk(await command.undo());
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document.groups).toEqual([rig.group, other]);
});

it('compensates a failed relationship write without leaving a restored Room or changing surviving groups', async () => {
	const rig = await groupDeletionStack(), command = rig.deletion(); expectOk(await command.execute());
	const removed = expectOk(await rig.geometry.read(rig.plan.id)).document;
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await command.undo()).ok).toBe(false);
	expect(expectOk(await rig.stack.zones.getById(rig.id))).toBeNull();
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(removed);
	expectOk(await command.undo()); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual([rig.group, rig.unrelated]);
});

it('prunes restored membership again when Requirement restoration fails, then retries the complete undo', async () => {
	const rig = await groupDeletionStack(), asset = makeAsset(); expectOk(await rig.stack.assets.save(asset, 'absent'));
	const requirement = makeRequirement({ projectId: rig.plan.projectId, assetId: asset.id, origin: { kind: 'zone', zoneId: rig.id } });
	expectOk(await rig.stack.requirements.save(requirement, 'absent'));
	const command = rig.deletion({ resolution: 'remove-references', resolvedReferents: [requirement.id] });
	expectOk(await command.execute()); const removed = expectOk(await rig.geometry.read(rig.plan.id)).document;
	vi.spyOn(rig.stack.requirements, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await command.undo()).ok).toBe(false);
	expect(expectOk(await rig.stack.zones.getById(rig.id))).toBeNull(); expect(expectOk(await rig.stack.requirements.getById(requirement.id))).toBeNull();
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(removed);
	expectOk(await command.undo());
	expect(expectFound(await rig.stack.requirements.getById(requirement.id)).entity.origin).toEqual(requirement.origin);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual([rig.group, rig.unrelated]);
});

it('restores a grouped Area with no Room boundary without disturbing the existing Room relationship', async () => {
	const rig = await groupDeletionStack(), area = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Custom', name: 'Area' });
	expectOk(await rig.stack.zones.save(area, 'absent'));
	const read = expectOk(await rig.geometry.read(rig.plan.id)), group = { id: 'group-area', name: 'Area', memberIds: [area.id] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [group, rig.group, rig.unrelated] }, read.version));
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document, command = rig.deletion({ zoneId: area.id });
	expectOk(await command.execute()); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual([rig.group, rig.unrelated]);
	expectOk(await command.undo()); expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(before);
});

it('removes the last saved group and restores its exact membership when the deleted Room was its only member', async () => {
	const rig = await groupDeletionStack(true), read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [rig.group] }, read.version));
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document, command = rig.deletion();
	expectOk(await command.execute()); expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document.groups ?? []).toEqual([]);
	expectOk(await command.undo()); expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(before);
});

it('does not overwrite a removed singleton group ID reused by a peer', async () => {
	const rig = await groupDeletionStack(true), command = rig.deletion(); expectOk(await command.execute());
	const read = expectOk(await rig.geometry.read(rig.plan.id)), peer = { ...read.document, groups: [{ ...rig.group, memberIds: ['wall-a'] }, rig.unrelated] };
	expectOk(await rig.geometry.write(rig.plan.id, peer, read.version));
	expect(expectErr(await command.undo()).code).toBe('spatial.group-restore-conflict');
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(peer);
});

it('restores the original note and membership if the repository sidecar removal fails', async () => {
	const rig = await groupDeletionStack(), before = expectOk(await rig.geometry.read(rig.plan.id)).document, command = rig.deletion();
	vi.spyOn(rig.stack.store, 'mutate').mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await command.execute()).ok).toBe(false); expect(expectFound(await rig.stack.zones.getById(rig.id)).entity.id).toBe(rig.id);
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(before);
	expectOk(await command.execute()); expectOk(await command.undo());
});
