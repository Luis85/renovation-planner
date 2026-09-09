import { afterEach, expect, it, vi } from 'vitest';
import { structureStack } from '../../helpers/structure';
import { expectDefined, expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { err, ok } from '../../../src/core/result/Result';
import { makePlan, makeZone } from '../../helpers/entities';

afterEach(() => vi.restoreAllMocks());
async function setup() {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'Room'), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const services = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const proposal = { ...baseline.document, groups: [{ id: 'group-one', name: 'Kitchen', memberIds: [roomId] }] };
	const command = services.command({ planId: rig.plan.id, baseline, document: proposal, ledger: rig.ledger });
	return { ...rig, roomId, baseline, services, proposal, command };
}
it('treats unchanged documents, duplicate execute and unused undo as genuine no-write operations', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	const noop = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document: rig.baseline.document, ledger: rig.ledger });
	expect(expectOk(await noop.execute())).toBe('no-write'); expect(expectOk(await noop.undo())).toBe('no-write');
	expect(expectOk(await rig.command.undo())).toBe('no-write'); expect(write).not.toHaveBeenCalled();
	expect(expectOk(await rig.command.execute())).toBe('wrote'); expect(expectOk(await rig.command.execute())).toBe('no-write'); expect(write).toHaveBeenCalledTimes(1);
});
it('admits only one write while the same command is already pending', async () => {
	const rig = await setup(); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
	const original = rig.geometry.write.bind(rig.geometry), write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await waiting; return original(...args); });
	const first = rig.command.execute();
	await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
	expect(expectOk(await rig.command.execute())).toBe('no-write'); expect(expectOk(await rig.command.undo())).toBe('no-write');
	release(); expectOk(await first); expect(write).toHaveBeenCalledTimes(1);
});
it('retires an applied command after publication failure and never replays or rolls back the saved group', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	vi.spyOn(rig.stack.events, 'publish').mockRejectedValueOnce(new Error('injected publication failure'));
	const error = expectErr(await rig.command.execute());
	expect(leftWritesBehind(error)).toBe(true); expect(write).toHaveBeenCalledTimes(1);
	expect((await rig.command.execute()).ok).toBe(false); expect((await rig.command.undo()).ok).toBe(false); expect(write).toHaveBeenCalledTimes(1);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(rig.proposal.groups);
});
it('allows a retry after a pre-write port refusal but preserves every byte until that retry succeeds', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	write.mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await rig.command.execute()).ok).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	expectOk(await rig.command.execute()); expect(write).toHaveBeenCalledTimes(2); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(rig.proposal.groups);
});
it('refuses unreadable or unexpectedly failing baselines before entering the write boundary', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], read = vi.spyOn(rig.geometry, 'read'), write = vi.spyOn(rig.geometry, 'write');
	read.mockResolvedValueOnce(err(injectedPersistenceError())); expect((await rig.command.execute()).ok).toBe(false);
	read.mockRejectedValueOnce(new Error('injected baseline exception')); expect((await rig.command.execute()).ok).toBe(false);
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it.each(['missing', 'wrong-plan', 'invalid-version'] as const)('refuses an unsafe Zone version receipt (%s) before the composite write', async fault => {
	const rig = await setup(), object = rig.baseline.document.objects[0];
	const source = expectDefined(expectOk(await rig.stack.zones.prepareGeometryVersions(rig.roomId, object)), 'Zone version source');
	const receipt = fault === 'missing' ? null : fault === 'wrong-plan'
		? { ...source, zone: { ...source.zone, entity: makeZone({ ...source.zone.entity, planId: makePlan({ projectId: rig.plan.projectId }).id }) } }
		: { ...source, versionFor: () => err({ category: 'Geometry' as const, code: 'test.invalid-geometry', message: 'Injected geometry version refusal.' }) };
	vi.spyOn(rig.stack.zones, 'prepareGeometryVersions').mockResolvedValueOnce(ok(receipt));
	const proposal = { ...rig.proposal, objects: [{ ...object, points: object.points.map(point => ({ x: point.x + 25, y: point.y })) }] };
	const command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document: proposal, ledger: rig.ledger });
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	expect((await command.execute()).ok).toBe(false); expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
