// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil, mountPlanEditorCanvas, runtimeOf } from '../../helpers/editor';
import { expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { rotateWallStructure } from '../../../src/domain/spatial/rotateWall';
import { err, ok } from '../../../src/core/result/Result';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { makeZone } from '../../helpers/entities';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { stackFoundation } from '../../helpers/repositoryStack';
import { ObsidianPlanRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianZoneRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { structureServices } from '../../../src/application/commands/spatial/StructureCommand';
import { toPlanDto, toZoneDto } from '../../../src/presentation/read-models/PlanDto';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const openings = [{ id: 'opening-a', kind: 'window' as const, hostId: 'wall-a', offset: 425.25, width: 1000, height: 1200, sill: 800 }];
const intended = { ...WALL_LOOP, walls: WALL_LOOP.walls.map(wall => ({ ...wall, height: 2750 })) };
async function setup() {
	const rig = await structureEditor(); mounted.push(rig);
	const room = makeZone({ id: 'room-wall-rotation' as never, projectId: rig.plan.projectId, planId: rig.plan.id, zoneType: 'Room', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } });
	expectOk(await rig.stack.zones.save(room, 'absent'));
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...WALL_LOOP, openings, boundaries: [{ roomId: room.id, wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure, intended }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select(['wall-a' as never]); await settle();
	return { rig, room, structure };
}
const formSelector = '[data-rp-form="wall-rotation"]';
async function formReady(rig: Awaited<ReturnType<typeof structureEditor>>) { await settleUntil(() => rig.wrapper.find(formSelector).exists(), 'wall rotation form'); return rig.wrapper.get(formSelector); }

describe('reviewed wall rotation and hosted opening runtime', () => {
	it.each(['wall-a', 'opening-a'])('reviews %s host rotation, writes once and restores exact hosted facts and independent Room geometry', async id => {
		const { rig, room, structure } = await setup(); rig.selection.select([id as never]); await settle();
		const operation = rig.runtime.structureActions.rotateWall(id, 90);
		const form = await formReady(rig), write = vi.spyOn(rig.geometry, 'write');
		expect(rig.runtime.structureActions.rotationHostId.value).toBe('wall-a'); expect(rig.selection.selectedIds).toEqual([id]);
		expect(rig.wrapper.get('.rp-dialog').text()).toContain(id === 'opening-a' ? 'Rotate host wall: Wall 1' : 'Rotate Wall 1');
		expect(form.text()).toContain('3 walls change'); expect(form.text()).toContain('1 hosted openings'); expect(form.text()).toContain(room.name);
		const expected = expectOk(rotateWallStructure(structure, 'wall-a', 90)); expect(rig.runtime.structureActions.preview.value).toEqual(expected);
		expect(rig.project.structure).toEqual(structure); expect(write).not.toHaveBeenCalled();
		await form.trigger('submit'); await operation; expect(write).toHaveBeenCalledTimes(1);
		expect(rig.project.structure).toEqual(expected); expect(rig.project.zones.get(room.id)?.points).toEqual(room.geometry.points);
		expect(expectOk(await rig.geometry.read(rig.plan.id)).document.intended).toEqual(intended);
		expect(rig.selection.selectedIds).toEqual([id]); expect(rig.runtime.structureActions.rotationHostId.value).toBeNull();
		await rig.runtime.undo(); expect(rig.project.structure).toEqual(structure); expect(rig.runtime.canUndo.value).toBe(false);
		await rig.runtime.redo(); expect(rig.project.structure).toEqual(expected); expect(rig.project.structure.openings).toEqual(openings);
	});
	it('requires renewed impact review after text edits and cancels decimal-comma preview with no writes', async () => {
		const { rig, structure } = await setup(), write = vi.spyOn(rig.geometry, 'write');
		const operation = rig.runtime.structureActions.rotateWall('wall-a'), form = await formReady(rig);
		await form.trigger('submit'); expect(write).not.toHaveBeenCalled();
		await form.get('input').setValue('15,25'); await form.trigger('submit');
		expect(rig.runtime.structureActions.preview.value).toEqual(expectOk(rotateWallStructure(structure, 'wall-a', 15.25)));
		await form.get('input').setValue('30'); expect(rig.runtime.structureActions.preview.value).toBeNull();
		await form.trigger('submit'); expect(write).not.toHaveBeenCalled();
		await form.get('input').trigger('keydown', { key: 'Escape' }); await operation;
		expect(rig.project.structure).toEqual(structure); expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(rig.runtime.canUndo.value).toBe(false);
	});
	it('shows invalid angle/intersection errors and retains true no-op drafts without history', async () => {
		const { rig } = await setup(), write = vi.spyOn(rig.geometry, 'write');
		const operation = rig.runtime.structureActions.rotateWall('wall-a'), form = await formReady(rig);
		for (const text of ['invalid', '180', '360', '0']) { await form.get('input').setValue(text); await form.trigger('submit'); }
		expect(write).not.toHaveBeenCalled(); rig.dialogs.resolve('cancel'); await operation;
	});
	it('keeps the reviewed angle immutable and rejects duplicate Apply or Cancel while its write is pending', async () => {
		const { rig } = await setup(), operation = rig.runtime.structureActions.rotateWall('wall-a', 90), form = await formReady(rig);
		let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }), originalWrite = rig.geometry.write.bind(rig.geometry);
		const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await wait; return originalWrite(...args); });
		await form.trigger('submit'); await settleUntil(() => useSaveStateStore(rig.pinia).state === 'saving', 'pending wall rotation');
		await form.trigger('submit'); await form.get('input').setValue('45');
		await rig.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await form.get('input').trigger('keydown', { key: 'Escape' });
		expect(form.get('input').element).toHaveProperty('value', '90'); expect(write).toHaveBeenCalledTimes(1); expect(rig.dialogs.current).not.toBeNull();
		release(); await operation; expect(write).toHaveBeenCalledTimes(1); expect(rig.dialogs.current).toBeNull();
	});
	it('retains a peer-conflicted draft and ignores stale pointer baselines and retired selections', async () => {
		const { rig, structure } = await setup();
		const operation = rig.runtime.structureActions.rotateWall('wall-a', 90), form = await formReady(rig);
		const before = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, walls: structure.walls.map(wall => ({ ...wall, height: 2800 })) } }, before.version));
		const write = vi.spyOn(rig.geometry, 'write'); await form.trigger('submit'); await settle();
		expect(form.text()).toContain('changed'); await form.trigger('submit'); expect(write).toHaveBeenCalledTimes(0);
		rig.dialogs.resolve('cancel'); await operation;
		await rig.runtime.refreshProjection();
		await rig.runtime.structureActions.rotateWall('wall-a', 90, structure.walls[0]); expect(rig.dialogs.current).toBeNull();
		const baseline = expectOk(await rig.services.read(rig.plan.id)); let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
		vi.spyOn(rig.services, 'read').mockImplementationOnce(async () => { await wait; return ok(baseline); });
		const pending = rig.runtime.structureActions.rotateWall('wall-a', 90); rig.selection.clear(); rig.selection.select(['wall-a' as never]); release(); await pending;
		expect(rig.dialogs.current).toBeNull(); expect(write).not.toHaveBeenCalled();
	});
	it('allows Renovate and rejects Review or saving, while successful-write readback recovery never replays', async () => {
		const { rig, structure } = await setup(), session = useRenovationSession(rig.pinia), save = useSaveStateStore(rig.pinia);
		session.perspective = 'review'; await rig.runtime.structureActions.rotateWall('wall-a', 90); expect(rig.dialogs.current).toBeNull();
		session.perspective = 'renovate'; save.beginSaving(); await rig.runtime.structureActions.rotateWall('wall-a', 90); expect(rig.dialogs.current).toBeNull(); save.resolveNeutral();
		const operation = rig.runtime.structureActions.rotateWall('wall-a', 90), form = await formReady(rig);
		const write = vi.spyOn(rig.geometry, 'write'), read = vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
		await form.trigger('submit'); await operation; expect(write).toHaveBeenCalledTimes(1); expect(rig.project.stale).toBe(true);
		for (let i = 0; i < 2; i++) { await rig.runtime.refreshProjection(); expect(write).toHaveBeenCalledTimes(1); }
		read.mockRestore(); await rig.runtime.refreshProjection(); expect(rig.project.stale).toBe(false); expect(write).toHaveBeenCalledTimes(1);
		expect(rig.project.structure).toEqual(expectOk(rotateWallStructure(structure, 'wall-a', 90)));
	});
	it('reloads rotated walls and opening facts through fresh repositories/index/runtime and reverses a subsequent rotation', async () => {
		const { rig, room } = await setup();
		const operation = rig.runtime.structureActions.rotateWall('wall-a', 20), form = await formReady(rig);
		await form.trigger('submit'); await operation;
		const saved = expectOk(await rig.geometry.read(rig.plan.id)).document;
		const bytes = [...rig.stack.vault.entries]; rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); rig.stack.metadataCache.catchUp();
		const fresh = stackFoundation({ vault: rig.stack.vault, fileManager: rig.stack.fileManager, metadataCache: rig.stack.metadataCache }, rig.stack.projectFolder); fresh.rebuildIndex();
		const plans = new ObsidianPlanRepository(fresh.deps, fresh.store), zones = new ObsidianZoneRepository(fresh.deps, fresh.store), geometry = new ObsidianPlanGeometrySidecar(fresh.store);
		const plan = expectFound(await plans.getById(rig.plan.id)).entity;
		const queries = { ...rig.deps.queries, getPlan: async () => ok(toPlanDto(expectFound(await plans.getById(plan.id)).entity)),
			findZonesByPlan: async () => { const document = expectOk(await geometry.read(plan.id)).document, listing = expectOk(await zones.listByPlan(plan.id)); return ok({ zones: listing.loaded.map(zone => toZoneDto(zone.entity)), unreadable: listing.refused, structure: document.structure, intended: document.intended }); } };
		const reopened = await mountPlanEditorCanvas({ plan: toPlanDto(plan), queries, commands: { ...rig.deps.commands, zones, structure: structureServices(geometry, fresh.events) } }); mounted.push(reopened);
		const runtime = runtimeOf(reopened), projection = useProjectStore(reopened.pinia), selection = useSelectionStore(reopened.pinia);
		expect(projection.structure).toEqual(saved.structure); expect(projection.structure.openings).toEqual(openings);
		expect(projection.intended).toEqual(intended);
		expect(projection.zones.get(room.id)?.points).toEqual(room.geometry.points); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(runtime.canUndo.value).toBe(false);
		selection.select(['opening-a' as never]); await settle();
		const next = runtime.structureActions.rotateWall('opening-a', -15); await settleUntil(() => reopened.wrapper.find(formSelector).exists(), 'reopened wall rotation');
		await reopened.wrapper.get(formSelector).trigger('submit'); await next;
		const rotated = projection.structure; expect(rotated).not.toEqual(saved.structure);
		await runtime.undo(); expect(projection.structure).toEqual(saved.structure); expect(runtime.canUndo.value).toBe(false);
		await runtime.redo(); expect(projection.structure).toEqual(rotated); expect(projection.structure.openings).toEqual(openings);
	});
});
