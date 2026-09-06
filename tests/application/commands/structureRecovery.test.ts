import { describe, expect, it, vi } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectErr, expectOk } from '../../helpers/domain';
import { structureServices } from '../../../src/application/commands/spatial/StructureCommand';
import { err, ok } from '../../../src/core/result/Result';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { referencePlanServices } from '../../../src/application/commands/plan/ConfigurePlanReference';
import { sameGeometryDocument } from '../../../src/application/commands/spatial/sameGeometryDocument';

const fault = { category: 'Persistence' as const, code: 'test.io', message: 'Unavailable' };
describe('composite spatial recovery and populated reference calibration', () => {
	it('associates only newly created walls when another structure already exists', async () => {
		const { plan, geometry, services, ledger, baseline, room } = await structureStack();
		const existing = { walls: [{ ...WALL_LOOP.walls[0], id: 'wall-existing', start: { x: 10000, y: 0 }, end: { x: 11000, y: 0 } }], openings: [], boundaries: [] };
		expectOk(await services.command({ planId: plan.id, baseline, structure: existing, ledger }).execute());
		const now = expectOk(await geometry.read(plan.id));
		expectOk(await services.command({ planId: plan.id, baseline: now, structure: { ...WALL_LOOP, walls: [...existing.walls, ...WALL_LOOP.walls] }, ledger, room }).execute());
		expect(expectOk(await geometry.read(plan.id)).document.structure?.boundaries[0].wallIds).toEqual(WALL_LOOP.walls.map(wall => wall.id));
	});
	it('announces successful directions and compensates an unreadable post-Room snapshot before permitting retry', async () => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const read = vi.fn<typeof geometry.read>(geometry.read.bind(geometry)).mockResolvedValueOnce(ok(baseline)).mockResolvedValueOnce(err(fault));
		const publish = vi.spyOn(stack.events, 'publish');
		const command = structureServices({ read, write: geometry.write.bind(geometry) }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room });
		expect(await command.execute()).toEqual(err(fault)); expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
		expect(publish.mock.calls.filter(([event]) => event.type === 'PlanStructureChanged')).toEqual([]);
		expectOk(await command.execute()); expectOk(await command.undo());
		expect(publish.mock.calls.filter(([event]) => event.type === 'PlanStructureChanged')).toHaveLength(2);
	});
	it('does not write structure when Room creation refuses', async () => {
		const { services, plan, baseline, ledger, room, geometry } = await structureStack();
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: { ...room, execute: () => Promise.resolve(err(fault)) } });
		expect(await command.execute()).toEqual(err(fault)); expect(expectOk(await geometry.read(plan.id))).toEqual(baseline);
	});
	it.each(['undo', 'read'] as const)('retires when recovery after a changed Room snapshot fails at %s', async failure => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const read = vi.fn<typeof geometry.read>(geometry.read.bind(geometry)).mockResolvedValueOnce(ok(baseline)).mockResolvedValueOnce(ok({ ...baseline, document: { ...baseline.document, objects: [{ id: 'peer', points: [] }] } }));
		if (failure === 'read') read.mockResolvedValueOnce(err(fault));
		const undo = failure === 'undo' ? () => Promise.resolve(err(fault)) : room.undo;
		const command = structureServices({ read, write: geometry.write.bind(geometry) }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: { ...room, get createdZoneId() { return room.createdZoneId; }, undo } });
		expect(leftWritesBehind(expectErr(await command.execute()))).toBe(true);
		expect(expectErr(await command.undo()).code).toBe('spatial.recovery-required');
	});
	it('retires when the wall restoration after a refused Room undo also fails', async () => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const write = vi.fn<typeof geometry.write>(geometry.write.bind(geometry));
		const command = structureServices({ read: geometry.read.bind(geometry), write }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: { ...room, get createdZoneId() { return room.createdZoneId; }, undo: () => Promise.resolve(err(fault)) } });
		expectOk(await command.execute());
		write.mockImplementationOnce(geometry.write.bind(geometry)).mockResolvedValueOnce(err(fault));
		expect(leftWritesBehind(expectErr(await command.undo()))).toBe(true);
	});
	it('retires an unreadable final Room undo snapshot instead of claiming a coherent restoration', async () => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const read = vi.fn<typeof geometry.read>(geometry.read.bind(geometry));
		const command = structureServices({ read, write: geometry.write.bind(geometry) }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room });
		expectOk(await command.execute()); read.mockImplementationOnce(geometry.read.bind(geometry)).mockResolvedValueOnce(err(fault));
		expect(leftWritesBehind(expectErr(await command.undo()))).toBe(true);
	});
	it('reconfigures a populated reference, scales every spatial measurement and reverses appearance and geometry together', async () => {
		const { stack, plan, geometry, ledger, services, baseline, room } = await structureStack();
		const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'window' as const, hostId: 'wall-a', offset: 500, width: 900, height: 1000, sill: 500 }] };
		expectOk(await services.command({ planId: plan.id, baseline, structure, ledger, room }).execute());
		const reference = referencePlanServices(stack.plans, geometry, stack.events, { fileExists: () => true });
		const before = expectOk(await reference.read(plan.id));
		const background = { path: 'scan.png', kind: 'image' as const, appearance: { crop: { x: 20, y: 40, width: 800, height: 600 }, rotation: 90, opacity: 0.6, visible: true, locked: true } };
		const command = reference.command(before, { background, measurement: { pointA: { x: 0, y: 0 }, pointB: { x: 1000, y: 0 }, knownDistance: 2000 } });
		expectOk(await command.execute()); const after = expectOk(await reference.read(plan.id));
		expect(after.plan.entity.background).toEqual(background); expect(after.geometry.document.structure?.openings[0]).toMatchObject({ offset: 1000, width: 1800, height: 2000, sill: 1000 });
		expect(after.geometry.document.structure?.walls[0]).toMatchObject({ thickness: 300, height: 4800 });
		expect(sameGeometryDocument(after.geometry.document, { ...after.geometry.document })).toBe(true);
		expectOk(await command.undo()); expect(expectOk(await reference.read(plan.id)).geometry.document).toEqual(before.geometry.document);
		expectOk(await command.execute()); expect(expectOk(await reference.read(plan.id)).geometry.document).toEqual(after.geometry.document);
	});
});
