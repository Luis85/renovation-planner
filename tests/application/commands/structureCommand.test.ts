import { describe, expect, it, vi } from 'vitest';
import { WALL_LOOP, structureStack } from '../../helpers/structure';
import { expectOk, expectErr } from '../../helpers/domain';
import { err, ok } from '../../../src/core/result/Result';
import { leftWritesBehind, type DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { structureServices } from '../../../src/application/commands/spatial/StructureCommand';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { createRepositoryStack } from '../../helpers/vault';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { calibrateDocument } from '../../../src/application/commands/plan/ReversibleCalibratePlan';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';

const fault = { category: 'Persistence' as const, code: 'test.write-failed', message: 'Test persistence refusal.' };

describe('connected structure repository transactions', () => {
	it('creates walls plus the Room as one history item; reloads the same IDs through a fresh stack', async () => {
		const { stack, plan, geometry, services, ledger, baseline, room } = await structureStack();
		const history = new CommandHistory();
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room });
		expectOk(await history.run(command));
		const after = expectOk(await geometry.read(plan.id));
		expect(after.document.structure).toMatchObject({ walls: WALL_LOOP.walls, boundaries: [{ roomId: room.createdZoneId, wallIds: WALL_LOOP.walls.map(wall => wall.id) }] });
		expect(after.document.objects).toEqual([{ id: room.createdZoneId, points: room.points }]);
		expect(expectOk(await stack.zones.listByPlan(plan.id)).loaded[0].entity.name).toBe('Kitchen');
		const fresh = createRepositoryStack();
		for (const [path, content] of stack.vault.entries) fresh.vault.entries.set(path, content);
		fresh.rebuildIndex();
		expect(expectOk(await new ObsidianPlanGeometrySidecar(fresh.store).read(plan.id)).document).toEqual(after.document);
		expectOk(await history.undo());
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
		expect(expectOk(await stack.zones.listByPlan(plan.id)).loaded).toEqual([]);
		expectOk(await history.redo());
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(after.document);
		expect(await command.execute()).toEqual(ok('no-write'));
		expectOk(await history.undo());
		expect(await command.undo()).toEqual(ok('no-write'));
	});
	it('undoes after a sibling geometry write and its reversal, when the live document is exactly what it wrote', async () => {
		// A Room move and its undo are two sidecar writes recorded under the ZONE, never under
		// the plan, so the plan's observed revision moves while the document comes back
		// byte-for-byte. Refusing on the revision alone broke every mixed reverse-order history.
		const { plan, geometry, services, ledger, baseline } = await structureStack();
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger });
		expectOk(await command.execute());
		const written = expectOk(await geometry.read(plan.id));
		const moved = expectOk(await geometry.write(plan.id, { ...written.document, objects: [{ id: 'zone-moved', points: WALL_LOOP.walls.map(wall => wall.start) }] }, written.version));
		expectOk(await geometry.write(plan.id, written.document, moved));
		expectOk(await command.undo());
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
	});
	it('composes opening placement, edit, deletion and reverse order history with shared versions', async () => {
		const { plan, geometry, services, ledger, baseline } = await structureStack();
		const history = new CommandHistory();
		expectOk(await history.run(services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger })));
		const added = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		expectOk(await history.run(services.command({ planId: plan.id, baseline: expectOk(await geometry.read(plan.id)), structure: added, ledger })));
		expectOk(await history.run(services.command({ planId: plan.id, baseline: expectOk(await geometry.read(plan.id)), structure: WALL_LOOP, ledger })));
		for (let index = 0; index < 3; index++) expectOk(await history.undo());
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
		for (let index = 0; index < 3; index++) expectOk(await history.redo());
		expect(expectOk(await geometry.read(plan.id)).document.structure).toEqual(WALL_LOOP);
	});
	it('refuses stale initial projection and peer writes without replacing either document', async () => {
		const { plan, geometry, services, ledger, baseline } = await structureStack();
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger });
		expectOk(await geometry.write(plan.id, { ...baseline.document, structure: EMPTY_STRUCTURE }, baseline.version));
		expect(await command.execute()).toMatchObject({ ok: false, error: { code: 'plan-geometry.revision-conflict' } });
		const now = expectOk(await geometry.read(plan.id));
		const liveCommand = services.command({ planId: plan.id, baseline: now, structure: WALL_LOOP, ledger });
		expectOk(await liveCommand.execute());
		const saved = expectOk(await geometry.read(plan.id));
		expectOk(await geometry.write(plan.id, { ...saved.document, structure: { ...WALL_LOOP, walls: WALL_LOOP.walls.map(wall => ({ ...wall, height: 2500 })) } }, saved.version));
		expect(await liveCommand.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		expect(expectOk(await geometry.read(plan.id)).document.structure?.walls[0].height).toBe(2500);
	});
	it('validates before writing and preserves a draft command after a recoverable failure', async () => {
		const { stack, plan, geometry, services, ledger, baseline } = await structureStack();
		const invalid = services.command({ planId: plan.id, baseline, structure: { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door', hostId: 'missing', offset: 0, width: 900, height: 2000, sill: 0 }] }, ledger });
		expect(await invalid.execute()).toMatchObject({ ok: false, error: { code: 'spatial.host-missing' } });
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger });
		vi.spyOn(stack.vault, 'modify').mockRejectedValueOnce(new Error('Disk unavailable'));
		expect(await command.execute()).toMatchObject({ ok: false });
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
		expectOk(await command.execute());
	});
	it.each(['refuse', 'throw'] as const)('compensates Room creation when the structure write fails (%s)', async mode => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const write = vi.fn<typeof geometry.write>(geometry.write.bind(geometry));
		if (mode === 'refuse') write.mockResolvedValueOnce(err(fault)); else write.mockRejectedValueOnce(new Error('Disk failure'));
		const services = structureServices({ read: id => geometry.read(id), write }, stack.events);
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room });
		expect(await command.execute()).toMatchObject({ ok: false });
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(baseline.document);
		expect(expectOk(await stack.zones.listByPlan(plan.id)).loaded).toEqual([]);
		expectOk(await command.execute());
		expect(expectOk(await geometry.read(plan.id)).document.structure?.boundaries[0].roomId).toBe(room.createdZoneId);
	});
	it.each(['refuse', 'throw'] as const)('reports and retires failed compensation (%s)', async mode => {
		const { stack, plan, geometry, ledger, baseline, room } = await structureStack();
		const undo = mode === 'throw' ? vi.fn<() => Promise<DispatchResult>>().mockRejectedValue(new Error('Cannot restore')) : vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(err(fault));
		const services = structureServices({ read: id => geometry.read(id), write: () => Promise.resolve(err(fault)) }, stack.events);
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: { ...room, get createdZoneId() { return room.createdZoneId; }, undo } });
		const result = await command.execute();
		expect(result.ok).toBe(false);
		expect(leftWritesBehind(expectErr(result))).toBe(true);
		expect(await command.execute()).toMatchObject({ ok: false, error: { code: 'spatial.recovery-required' } });
	});
	it('compensates the structure when Room undo refuses and retries without losing openings', async () => {
		const { plan, geometry, services, ledger, baseline, room } = await structureStack();
		const undo = vi.fn<typeof room.undo>(room.undo);
		const command = services.command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger, room: { ...room, get createdZoneId() { return room.createdZoneId; }, undo } });
		expectOk(await command.execute()); const after = expectOk(await geometry.read(plan.id));
		undo.mockResolvedValueOnce(err(fault));
		expect(await command.undo()).toEqual(err(fault));
		expect(expectOk(await geometry.read(plan.id)).document).toEqual(after.document);
		expectOk(await command.undo());
	});
	it('refuses missing sidecar reads and catches thrown reads without writing', async () => {
		const { stack, plan, geometry, ledger, baseline } = await structureStack();
		const write = vi.fn<typeof geometry.write>(geometry.write.bind(geometry));
		for (const read of [() => Promise.resolve(err(fault)), (): Promise<never> => Promise.reject(new Error('Unreadable'))]) {
			const command = structureServices({ read, write }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger });
			expect(await command.execute()).toMatchObject({ ok: false });
		}
		expect(write).not.toHaveBeenCalled();
	});
	it('does not duplicate a command while its first write is pending', async () => {
		const { stack, plan, geometry, ledger, baseline } = await structureStack();
		let release!: () => void;
		const pending = new Promise<void>(resolve => { release = resolve; });
		const write = vi.fn<typeof geometry.write>(async (...args: Parameters<typeof geometry.write>) => { await pending; return geometry.write(...args); });
		const command = structureServices({ read: id => geometry.read(id), write }, stack.events).command({ planId: plan.id, baseline, structure: WALL_LOOP, ledger });
		const first = command.execute();
		expect(await command.execute()).toEqual(ok('no-write'));
		release(); expectOk(await first); expect(write).toHaveBeenCalledTimes(1);
	});
	it('calibrates a populated document and refuses collapsed or unrepresentable structure', async () => {
		const { baseline } = await structureStack();
		const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'window' as const, hostId: 'wall-a', offset: 500, width: 1000, height: 1000, sill: 500 }] };
		const document = { ...baseline.document, structure };
		const scaled = expectOk(calibrateDocument(document, { pointA: { x: 0, y: 0 }, pointB: { x: 1000, y: 0 }, knownDistance: 2000 }));
		expect(scaled.structure?.walls[0].end.x).toBe(8000);
		expect(scaled.structure?.openings[0]).toMatchObject({ offset: 1000, width: 2000, height: 2000, sill: 1000 });
		expect(calibrateDocument(document, { pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, knownDistance: 1e12 }).ok).toBe(false);
	});
});
