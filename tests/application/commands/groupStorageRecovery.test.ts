import { afterEach, expect, it, vi } from 'vitest';
import { groupDeletionStack } from '../../helpers/groupDeletion';
import { expectDefined, expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { withStateRefresh } from '../../../src/presentation/editor/tools/with-state-refresh';
import { err } from '../../../src/core/result/Result';

afterEach(() => vi.restoreAllMocks());
async function setup() {
	const rig = await groupDeletionStack(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const services = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	return { ...rig, baseline, services };
}

it.each(['groups', 'members'] as const)('persists a change to only %s order and restores exact repeated history', async order => {
	const rig = await setup(), groups = expectDefined(rig.baseline.document.groups, 'groups');
	const document = { ...rig.baseline.document, groups: order === 'groups' ? groups.toReversed() : groups.map(group => ({ ...group, memberIds: group.memberIds.toReversed() })) };
	const command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document, ledger: rig.ledger });
	const write = vi.spyOn(rig.geometry, 'write');
	for (let cycle = 0; cycle < 2; cycle++) {
		expect(expectOk(await command.execute())).toBe('wrote');
		expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(document);
		expect(expectOk(await command.undo())).toBe('wrote');
		expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(rig.baseline.document);
	}
	expect(write).toHaveBeenCalledTimes(4);
});

it('round-trips an accepted padded group name without making its own Undo look superseded', async () => {
	const rig = await setup(), document = { ...rig.baseline.document, groups: [{ ...rig.group, name: '  Kitchen assembly  ' }, rig.unrelated] };
	const command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document, ledger: rig.ledger });
	expectOk(await command.execute());
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(document);
	expectOk(await command.undo());
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(rig.baseline.document);
	expectOk(await command.execute());
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(document);
});

it('keeps a saved group as one history entry through failed readback and repeated read-only retries', async () => {
	const rig = await setup(), document = { ...rig.baseline.document, groups: [{ ...rig.group, name: 'Saved assembly' }, rig.unrelated] };
	const command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document, ledger: rig.ledger });
	const history = new CommandHistory(), fresh = rig.reopen().geometry;
	const read = vi.spyOn(fresh, 'read').mockResolvedValue(err(injectedPersistenceError()));
	const refresh = vi.fn<() => Promise<void>>(async () => { const result = await fresh.read(rig.plan.id); if (!result.ok) throw result.error; });
	const dispatcher = withStateRefresh(history, refresh), write = vi.spyOn(rig.geometry, 'write');
	expect(expectOk(await dispatcher.run(command))).toBe('wrote');
	expect(history.canUndo).toBe(true); expect(history.canRedo).toBe(false);
	const saved = [...rig.stack.vault.entries];
	for (let retry = 0; retry < 3; retry++) await expect(refresh()).rejects.toMatchObject({ category: 'Persistence' });
	expect([...rig.stack.vault.entries]).toEqual(saved); expect(write).toHaveBeenCalledTimes(1);
	read.mockRestore(); await refresh();
	expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(document);
	expectOk(await dispatcher.undo()); expect(history.canUndo).toBe(false); expect(history.canRedo).toBe(true);
	expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(rig.baseline.document);
	expectOk(await dispatcher.redo()); expect(write).toHaveBeenCalledTimes(3);
	expect(expectOk(await fresh.read(rig.plan.id)).document).toEqual(document);
	const peer = expectOk(await fresh.read(rig.plan.id));
	expectOk(await fresh.write(rig.plan.id, peer.document, peer.version));
	const peerBytes = [...rig.stack.vault.entries]; await refresh();
	expect(expectErr(await dispatcher.undo()).code).toBe('undo.superseded');
	expect([...rig.stack.vault.entries]).toEqual(peerBytes); expect(write).toHaveBeenCalledTimes(3);
});

it('refuses a peer write arriving after the baseline check, without rebasing a retry onto it', async () => {
	const rig = await setup(), document = { ...rig.baseline.document, groups: [{ ...rig.group, name: 'Our proposal' }, rig.unrelated] };
	const command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document, ledger: rig.ledger });
	const peer = rig.reopen().geometry, original = rig.geometry.write.bind(rig.geometry);
	vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		expectOk(await peer.write(rig.plan.id, { ...rig.baseline.document, groups: [{ ...rig.group, name: 'Peer proposal' }, rig.unrelated] }, rig.baseline.version));
		return original(...args);
	});
	expect(expectErr(await command.execute()).code).toBe('plan-geometry.revision-conflict');
	const bytes = [...rig.stack.vault.entries];
	expect(expectOk(await peer.read(rig.plan.id)).document.groups?.[0].name).toBe('Peer proposal');
	expect(expectErr(await command.execute()).code).toBe('undo.superseded');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
