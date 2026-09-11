import { afterEach, expect, it, vi } from 'vitest';
import { groupDeletionStack } from '../../helpers/groupDeletion';
import { expectDefined, expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { spatialRemovalInput } from '../../../src/presentation/editor/elements/spatialRemovalInput';
import { err } from '../../../src/core/result/Result';

afterEach(() => vi.restoreAllMocks());
type Kind = 'wall' | 'object' | 'mixed';
async function setup(kind: Kind) {
	const rig = await groupDeletionStack(), before = expectOk(await rig.renovation.read(rig.plan.id));
	const proposal = spatialRemovalInput(before, kind === 'wall' ? ['wall-a'] : ['wall-a', rig.object.id]);
	const command = kind === 'wall'
		? rig.services.command({ planId: rig.plan.id, baseline: before.geometry, structure: expectDefined(proposal.input.spatial?.structure, 'removed wall'), ledger: rig.ledger })
		: rig.renovation.command(before, kind === 'object' ? elementInput(before, rig.object, true) : proposal.input, rig.ledger);
	return { ...rig, before, command };
}

it('leaves a plan with no renovation without one after a mixed deletion, its undo and its redo', async () => {
	const rig = await setup('mixed');
	expect(rig.before.plan.entity.renovation).toBeUndefined();
	expectOk(await rig.command.execute());
	expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation).toBeUndefined();
	expectOk(await rig.command.undo());
	expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation).toBeUndefined();
	expectOk(await rig.command.execute());
	expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation).toBeUndefined();
});

it.each(['wall', 'object', 'mixed'] as const)('prunes %s membership through its existing command and restores exact repeated history after reopening', async kind => {
	const rig = await setup(kind);
	const remaining = rig.group.memberIds.filter(id => !(kind !== 'object' && id === 'wall-a') && !(kind !== 'wall' && id === rig.object.id));
	for (let cycle = 0; cycle < 2; cycle++) {
		expectOk(await rig.command.execute());
		const removed = expectOk(await rig.reopen().geometry.read(rig.plan.id)).document;
		expect(removed.groups).toEqual([{ ...rig.group, memberIds: remaining }, rig.unrelated]);
		expect(removed.objects).toEqual(rig.before.geometry.document.objects);
		expect(removed.structure?.openings).toEqual(kind === 'object' ? [rig.opening] : []);
		const plan = expectOk(await rig.renovation.read(rig.plan.id)).plan.entity;
		expect(plan.spatialElements).toEqual(kind === 'wall' ? rig.before.plan.entity.spatialElements : undefined);
		expectOk(await rig.command.undo());
		expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(rig.before.geometry.document);
		expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.spatialElements).toEqual(rig.before.plan.entity.spatialElements);
	}
});

it.each(['wall', 'object'] as const)('refuses %s Undo after peer regrouping without writing any file', async kind => {
	const rig = await setup(kind); expectOk(await rig.command.execute());
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = expectDefined(read.document.groups, 'remaining groups').map(group => group.id === rig.group.id ? { ...group, name: 'Peer assembly' } : group);
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups }, read.version));
	const bytes = [...rig.stack.vault.entries];
	expect(expectErr(await rig.command.undo()).code).toBe('undo.superseded'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('refuses element Undo after a peer changes only member order', async () => {
	const rig = await setup('object'); expectOk(await rig.command.execute());
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = expectDefined(read.document.groups, 'remaining groups').map(group => ({ ...group, memberIds: group.memberIds.toReversed() }));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups }, read.version)); const bytes = [...rig.stack.vault.entries];
	expect(expectErr(await rig.command.undo()).code).toBe('undo.superseded'); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it.each(['wall', 'object'] as const)('refuses a stale %s deletion proposal before changing files', async kind => {
	const rig = await setup(kind), read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [rig.unrelated] }, read.version));
	const bytes = [...rig.stack.vault.entries]; expect((await rig.command.execute()).ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('compensates element metadata after a failed sidecar deletion and retains exact groups for retry', async () => {
	const rig = await setup('object');
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await rig.command.execute()).ok).toBe(false);
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(rig.before.geometry.document);
	expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.spatialElements).toEqual(rig.before.plan.entity.spatialElements);
	expectOk(await rig.command.execute()); expectOk(await rig.command.undo());
	expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(rig.before.geometry.document);
});

it('keeps the host group when deleting only its implicit opening, and restores the complete opening metadata', async () => {
	const rig = await groupDeletionStack(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = expectDefined(baseline.document.structure, 'structure');
	const command = rig.services.command({ planId: rig.plan.id, baseline, structure: { ...structure, openings: [] }, ledger: rig.ledger });
	expectOk(await command.execute()); const after = expectOk(await rig.reopen().geometry.read(rig.plan.id)).document;
	expect(after.groups).toEqual(baseline.document.groups); expect(after.structure?.walls).toEqual(structure.walls);
	expectOk(await command.undo()); expect(expectOk(await rig.reopen().geometry.read(rig.plan.id)).document).toEqual(baseline.document);
});
