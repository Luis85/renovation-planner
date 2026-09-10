import { afterEach, expect, it, vi } from 'vitest';
import { structureStack } from '../../../helpers/structure';
import { makeZone } from '../../../helpers/entities';
import { expectDefined, expectErr, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { err } from '../../../../src/core/result/Result';
import { leftWritesBehind } from '../../../../src/application/commands/DispatchOutcome';

afterEach(() => vi.restoreAllMocks());

it('omits an externally deleted indexed Room without hiding another Room or rewriting its sidecar', async () => {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const id = expectDefined(rig.room.createdZoneId, 'deleted Room'), path = expectDefined(rig.stack.index.getPath(id), 'indexed note');
	const remaining = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Remaining room' });
	expectOk(await rig.stack.zones.save(remaining, 'absent'));
	rig.stack.vault.entries.delete(path);
	expect(rig.stack.index.getPath(id)).toBe(path);
	const bytes = [...rig.stack.vault.entries], listed = expectOk(await rig.stack.zones.listByPlan(rig.plan.id));
	expect(listed.refused).toBe(0); expect(listed.loaded.map(zone => zone.entity.id)).toEqual([remaining.id]);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('treats a just-created note already removed by a peer as compensated after sidecar refusal and permits retry', async () => {
	const rig = await structureStack(), zone = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Room during sync' });
	const bytes = [...rig.stack.vault.entries], trash = vi.spyOn(rig.stack.deps.fileManager, 'trashFile');
	const mutation = vi.spyOn(rig.stack.store, 'mutate').mockImplementationOnce(() => {
		const note = expectDefined([...rig.stack.vault.entries].find(([path, content]) => path.endsWith('.md') && content.includes(zone.id)), 'new Room note before sidecar write');
		rig.stack.vault.entries.delete(note[0]);
		return Promise.resolve(err(injectedPersistenceError()));
	});
	const failure = expectErr(await rig.stack.zones.save(zone, 'absent'));
	expect(failure.code).toBe('zone.sidecar-insert-failed'); expect(leftWritesBehind(failure)).toBe(false);
	expect(mutation).toHaveBeenCalledOnce(); expect(trash).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.stack.index.getPath(zone.id)).toBeUndefined();
	expectOk(await rig.stack.zones.save(zone, 'absent'));
	expect(expectOk(await rig.stack.zones.getById(zone.id))?.entity).toEqual(zone);
});
