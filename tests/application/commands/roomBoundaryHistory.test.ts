import { describe, expect, it, vi } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectFound, expectOk, expectErr } from '../../helpers/domain';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { ReversibleDeleteZoneCommand } from '../../../src/application/commands/zone/reversible-delete-zone-command';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { RoomBoundaryHistory } from '../../../src/application/commands/spatial/RoomBoundaryHistory';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { err } from '../../../src/core/result/Result';

const fault = { category: 'Persistence' as const, code: 'test.read', message: 'Unavailable' };
async function seeded() {
	const rig = await structureStack();
	expectOk(await rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, ledger: rig.ledger, room: rig.room }).execute());
	const id = rig.room.createdZoneId as ZoneId;
	const zone = expectFound(await rig.stack.zones.getById(id)).entity;
	const command = new ReversibleDeleteZoneCommand(makeDeleteZoneCommand(rig.stack.zones, rig.stack.events, rig.stack.requirements), rig.stack.zones, rig.ledger,
		{ zoneId: id }, { boundary: rig.services.roomHistory(), events: rig.stack.events, requirements: rig.stack.requirements, locks: new ReferenceLocks(), logger: rig.stack.logger });
	return { ...rig, id, zone, command };
}
describe('Room boundary deletion history through actual repositories', () => {
	it('returns a conditional relationship write refusal to the enclosing restore transaction', async () => {
		const { geometry, zone, command, stack } = await seeded();
		const history = new RoomBoundaryHistory({ read: geometry.read.bind(geometry), write: () => Promise.resolve(err(fault)) });
		expectOk(await history.capture(zone)); expectOk(await command.execute()); expectOk(await stack.zones.save(zone, 'absent'));
		expect(await history.restore(zone)).toEqual(err(fault));
	});
	it('restores Room adjacency with the original IDs across repeated delete/undo', async () => {
		const { command, geometry, plan, id } = await seeded();
		const before = expectOk(await geometry.read(plan.id)).document;
		for (let i = 0; i < 2; i++) {
			expectOk(await command.execute());
			expect(expectOk(await geometry.read(plan.id)).document.structure?.boundaries).toEqual([]);
			expectOk(await command.undo());
			expect(expectOk(await geometry.read(plan.id)).document).toEqual(before);
			expect(before.structure?.boundaries[0].roomId).toBe(id);
		}
	});
	it('refuses missing host walls and compensates the restored Room without replacing peer geometry', async () => {
		const { command, geometry, plan, stack, id } = await seeded();
		expectOk(await command.execute());
		const read = expectOk(await geometry.read(plan.id));
		const peer = { ...read.document, structure: { walls: [], openings: [], boundaries: [] } };
		expectOk(await geometry.write(plan.id, peer, read.version));
		expect(expectErr(await command.undo()).code).toBe('spatial.boundary-invalid');
		expect(expectOk(await stack.zones.getById(id))).toBeNull();
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(peer);
	});
	it('preserves a pending deletion when its relationship snapshot cannot be read', async () => {
		const { command, geometry, stack, id } = await seeded();
		vi.spyOn(geometry, 'read').mockResolvedValueOnce(err(fault));
		expect(await command.execute()).toEqual(err(fault));
		expect(expectFound(await stack.zones.getById(id)).entity.id).toBe(id);
	});
	it('maps thrown reads/writes and does no work for a Room with no association', async () => {
		const { geometry, zone, plan, command } = await seeded();
		const read = vi.fn<typeof geometry.read>(geometry.read.bind(geometry)), write = vi.fn<typeof geometry.write>(geometry.write.bind(geometry));
		const history = new RoomBoundaryHistory({ read, write });
		expectOk(await history.restore(zone)); expect(read).not.toHaveBeenCalled();
		read.mockRejectedValueOnce(new Error('read')); expect(expectErr(await history.capture(zone)).code).toBe('spatial.read-failed');
		expectOk(await history.capture(zone));
		await command.execute();
		read.mockResolvedValueOnce(err(fault)); expect(await history.restore(zone)).toEqual(err(fault));
		read.mockRejectedValueOnce(new Error('read')); expect(expectErr(await history.restore(zone)).code).toBe('spatial.write-failed');
		const now = expectOk(await geometry.read(plan.id));
		expectOk(await geometry.write(plan.id, { ...now.document, structure: undefined }, now.version));
		expect(expectErr(await history.restore(zone)).code).toBe('spatial.boundary-missing');
	});
});
