// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import { editorRotationScene } from '../../harness/editorRotationProbe';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, mountPlanEditorCanvas, runtimeOf } from '../../helpers/editor';
import { stackFoundation } from '../../helpers/repositoryStack';
import { ObsidianZoneRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianPlanRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { renovationServices } from '../../../src/application/commands/renovation/RenovationCommand';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { pointerAt } from '../../helpers/tool-context';
import { hoverRotation } from '../../helpers/rotationHover';
import { err, ok } from '../../../src/core/result/Result';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { defer } from '../../helpers/async';
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const element: NamedSpatialElement = { id: 'element-object', kind: 'object', name: 'Desk', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }] };
async function setup(source: NamedSpatialElement = element) {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const input = elementInput(baseline, source);
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { ...input, intended: { walls: [], openings: [], boundaries: [], elements: [{ id: source.id, kind: source.kind, points: source.points.map(p => ({ ...p, x: p.x + 300 })) }] } }, rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as never]); await settle(); await hoverRotation(rig.runtime, useEditorStore(rig.pinia), source.points[0]); return rig;
}
it('commits numeric decimal comma once, matches preview, preserves intended metadata, and restores exact Undo/Redo', async () => {
	const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id));
	const operation = rig.runtime.rotationActions.rotate(element.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input[name="angle"]').setValue('27,25'); await settle();
	const preview = rig.runtime.rotationActions.preview.value?.points;
	expect(preview).toEqual(rotationPoints(element, 27.25, expectDefined(rotationPivot(element), 'pivot')));
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
	const write = vi.spyOn(rig.geometry, 'write'); await form.trigger('submit'); await operation; await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.project.structure.elements?.[0].points).toEqual(preview);
	const after = expectOk(await rig.renovation.read(rig.plan.id)); expect(after.geometry.document.intended).toEqual(before.geometry.document.intended); expect(after.plan.entity.spatialElements).toEqual(before.plan.entity.spatialElements);
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
	await rig.runtime.redo(); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(preview);
});
it('refuses invalid/no-op input and discards numeric cancellation without a write', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.rotationActions.rotate(element.id, 360); await rig.runtime.rotationActions.rotate(element.id, NaN); expect(write).not.toHaveBeenCalled();
	const operation = rig.runtime.rotationActions.rotate(element.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	for (const value of ['invalid', '', '360', '0']) { await form.get('input[name="angle"]').setValue(value); await form.trigger('submit'); }
	expect(write).not.toHaveBeenCalled();
	await form.get('input[name="angle"]').setValue('-45'); rig.dialogs.resolve('cancel'); await operation; await settle(); expect(rig.runtime.rotationActions.preview.value).toBeNull(); expect(write).not.toHaveBeenCalled();
});
it('retains a conflicted numerical draft and never retries the refused write', async () => {
	const rig = await setup(); const operation = rig.runtime.rotationActions.rotate(element.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input[name="angle"]').setValue('35');
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, { ...element, name: 'Peer desk' }), rig.runtime.structureTask.ledger).execute());
	await form.trigger('submit'); await settle(); expect(form.text()).toContain('changed'); expect(form.get<HTMLInputElement>('input[name="angle"]').element.value).toBe('35');
	const write = vi.spyOn(rig.geometry, 'write'); await form.trigger('submit'); await settle(); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});
it.each(['quarter', 'numeric'] as const)('keeps successful-write/failed-readback recovery read-only for %s rotation', async mode => {
	const rig = await setup(), getPlan = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	const write = vi.spyOn(rig.geometry, 'write');
	if (mode === 'quarter') await rig.runtime.rotationActions.rotate(element.id, 90);
	else { const operation = rig.runtime.rotationActions.rotate(element.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input[name="angle"]').setValue('90'); await form.trigger('submit'); await operation; }
	await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true);
	await rig.runtime.rotationActions.rotate(element.id, 90); expect(write).toHaveBeenCalledOnce();
	getPlan.mockRestore(); await rig.runtime.refreshProjection(); await settle(); expect(write).toHaveBeenCalledOnce();
	expect(rig.project.structure.elements?.[0].points).toEqual(rotationPoints(element, 90, expectDefined(rotationPivot(element), 'pivot')));
});
it.each(['object', 'path', 'fence', 'measurement'] as const)('reconstructs index, repositories and runtime from persisted %s rotation and restores it exactly', async kind => {
	const rig = await setup({ ...element, kind, points: kind === 'measurement' ? element.points.slice(0, 2) : element.points }); await rig.runtime.rotationActions.rotate(element.id, 90); await settle();
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document, bytes = [...rig.stack.vault.entries];
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); rig.stack.metadataCache.catchUp();
	const fresh = stackFoundation({ vault: rig.stack.vault, fileManager: rig.stack.fileManager, metadataCache: rig.stack.metadataCache }, rig.stack.projectFolder); fresh.rebuildIndex();
	const plans = new ObsidianPlanRepository(fresh.deps, fresh.store), geometry = new ObsidianPlanGeometrySidecar(fresh.store), renovation = renovationServices(plans, geometry, fresh.events);
	const plan = expectFound(await plans.getById(rig.plan.id)).entity;
	const queries = { ...rig.deps.queries, getPlan: async () => ok(toPlanDto(expectFound(await plans.getById(plan.id)).entity)), findZonesByPlan: async () => { const data = expectOk(await geometry.read(plan.id)).document; return ok({ zones: [], unreadable: 0, structure: data.structure, intended: data.intended }); } };
	const reopened = await mountPlanEditorCanvas({ plan: toPlanDto(plan), queries, commands: { ...rig.deps.commands, renovation } }); mounted.push(reopened);
	const runtime = runtimeOf(reopened), project = useProjectStore(reopened.pinia), selection = useSelectionStore(reopened.pinia);
	expect(project.structure).toEqual(saved.structure); expect(project.intended).toEqual(saved.intended); expect(project.plan?.spatialElements).toEqual([{ id: element.id, name: element.name }]); expect([...rig.stack.vault.entries]).toEqual(bytes);
	selection.select([element.id as never]); await settle(); await runtime.rotationActions.rotate(element.id, -90); await settle();
	await runtime.undo(); await settle(); expect(project.structure).toEqual(saved.structure);
	await runtime.redo(); await settle(); expect(project.structure.elements?.[0].points).not.toEqual(saved.structure?.elements?.[0].points);
});
it('abandons a delayed numeric baseline after a tool switch even if Select is restored', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	let resolveRead: ((value: Awaited<ReturnType<typeof rig.renovation.read>>) => void) | undefined;
	const pending = new Promise<Awaited<ReturnType<typeof rig.renovation.read>>>(resolve => { resolveRead = resolve; });
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending);
	const operation = rig.runtime.rotationActions.rotate(element.id, 90); await settle();
	rig.runtime.setTool(null); rig.runtime.setTool('select');
	expectDefined(resolveRead, 'pending read')(ok(baseline)); await operation;
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points); expect(rig.dialogs.current).toBeNull();
});

it('uses the rendered handle under pan/zoom, previews final Shift bearing and makes one pointer history entry', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia); editor.viewport = { ...editor.viewport, zoom: 0.2, pan: { x: 70, y: 90 } }; await settle();
	const handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	const painted = expectDefined(expectDefined(rig.stage, 'stage').findOne<Konva.Group>('.object-rotation-handle'), 'painted handle');
	const control = expectDefined(painted.findOne<Konva.Rect>('.rotation-control-target'), 'edge target'); expect(control.x() + control.width() / 2).toBe(handle.x); expect(control.y() + control.height() / 2).toBe(handle.y);
	const tool = rig.runtime.toolManager, write = vi.spyOn(rig.geometry, 'write');
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(pointerAt(2000, 800)); await settle();
	const release = pointerAt(1900, 1500), snapped = { ...release, modifiers: { ...release.modifiers, shift: true } };
	tool.pointerMove(snapped); await settle(); const preview = rig.runtime.rotationActions.preview.value?.points;
	expect(rig.runtime.renderState.rotationDegrees).not.toBeNull(); tool.pointerUp(snapped); await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.project.structure.elements?.[0].points).toEqual(preview); expect(rig.runtime.renderState.rotationDegrees).toBeNull();
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
});
it('abandons pointer release awaiting its baseline after tool changes', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	let resolveRead: ((value: Awaited<ReturnType<typeof rig.renovation.read>>) => void) | undefined;
	const pending = new Promise<Awaited<ReturnType<typeof rig.renovation.read>>>(resolve => { resolveRead = resolve; });
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending);
	const handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	rig.runtime.toolManager.pointerDown(pointerAt(handle.x, handle.y)); rig.runtime.toolManager.pointerUp(pointerAt(2000, 1000)); await settle();
	rig.runtime.setTool(null); rig.runtime.setTool('select'); expectDefined(resolveRead, 'pending read')(ok(baseline)); await settle();
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
});


it('hides and refuses the rotation handle in Renovate and Review', async () => {
	const rig = await setup(), handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	for (const perspective of ['renovate', 'review'] as const) {
		await rig.runtime.renovation.perspective(perspective); await settle();
		rig.runtime.toolManager.pointerMove(pointerAt(handle.x, handle.y)); expect(rig.runtime.renderState.hoveredTargetKind).not.toBe('rotation');
		expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();
	}
});

it('Escape discards the pointer preview and a refreshed peer edit cannot be overwritten by its old gesture', async () => {
	const rig = await setup(), handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	const tool = rig.runtime.toolManager, canvas = expectDefined(rig.canvasEl, 'canvas'), write = vi.spyOn(rig.geometry, 'write');
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(pointerAt(2000, 1000)); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); tool.pointerUp(pointerAt(2000, 1000)); await settle();
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.rotationActions.preview.value).toBeNull();
	rig.selection.select([element.id as never]); await hoverRotation(rig.runtime, useEditorStore(rig.pinia), element.points[0]); tool.pointerDown(pointerAt(handle.x, handle.y));
	const baseline = expectOk(await rig.renovation.read(rig.plan.id)), peer = { ...element, points: element.points.map(point => ({ ...point, x: point.x + 200 })) };
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, peer), rig.runtime.structureTask.ledger).execute()); await rig.runtime.refreshProjection(); const count = write.mock.calls.length;
	tool.pointerMove(pointerAt(2000, 1000)); await settle(); expect(rig.runtime.rotationActions.preview.value).toBeNull(); expect(rig.runtime.renderState.rotationDegrees).toBeNull();
	tool.pointerUp(pointerAt(2000, 1000)); await settle(); expect(write.mock.calls).toHaveLength(count); expect(rig.project.structure.elements?.[0].points).toEqual(peer.points);
});

it('suppresses rotation handle paint and targeting while a quarter-turn save is pending', async () => {
	const rig = await setup(), originalWrite = rig.geometry.write.bind(rig.geometry);
	let resumeWrite: (() => void) | undefined; const pending = new Promise<void>(resolve => { resumeWrite = resolve; });
	vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await pending; return originalWrite(...args); });
	const handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle');
	const operation = rig.runtime.rotationActions.rotate(element.id, 90); await settle();
	expect(rig.runtime.rotationActions.active.value).toBe(true); expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();
	rig.runtime.toolManager.pointerMove(pointerAt(handle.x, handle.y)); expect(rig.runtime.renderState.hoveredTargetKind).not.toBe('rotation');
	rig.runtime.toolManager.pointerDown(pointerAt(handle.x, handle.y)); rig.runtime.toolManager.pointerMove(pointerAt(2000, 1000)); expect(rig.runtime.renderState.rotationDegrees).toBeNull();
	expectDefined(resumeWrite, 'pending save')(); await operation; await settle();
});
it('does not write when the editor is disposed while the rotation baseline is pending', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	let resolveRead: ((value: Awaited<ReturnType<typeof rig.renovation.read>>) => void) | undefined;
	const pending = new Promise<Awaited<ReturnType<typeof rig.renovation.read>>>(resolve => { resolveRead = resolve; });
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending);
	const operation = rig.runtime.rotationActions.rotate(element.id, 90); await settle(); rig.unmount(); mounted.splice(mounted.indexOf(rig), 1);
	expectDefined(resolveRead, 'pending read')(ok(baseline)); await operation; expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});





it.each(['Room', 'Custom'] as const)('rotates %s through the guarded Zone command without changing wall/current/intended associations', async zoneType => {
	const rig = await setup();
	const zone = zoneType === 'Room' ? rig.room : expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Outside area', zoneType, geometry: { points: element.points.map(point => ({ ...point, x: point.x + 5000 })) } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.runtime.selectAndFrame(zone.id); await settle(); await hoverRotation(rig.runtime, useEditorStore(rig.pinia), zone.geometry.points[0]);
	const original = zone.geometry.points, document = expectOk(await rig.geometry.read(rig.plan.id)).document, structure = document.structure, intended = document.intended;
	const shape = expectDefined(rig.runtime.rotationActions.target.value, 'rotation target'); expect(editorRotationScene(zone.id).points).toEqual(zone.geometry.points.flatMap(point => [point.x, point.y])); expect(shape.kind).toBe(zoneType === 'Room' ? 'room' : 'area');
	await rig.runtime.rotationActions.rotate(zone.id, 27.25); await settle();
	const rotated = rotationPoints(shape, 27.25, expectDefined(rotationPivot(shape), 'pivot'));
	expect(rig.project.zones.get(zone.id)?.points).toEqual(rotated); expect(rig.project.structure).toEqual(structure); expect(rig.project.intended).toEqual(intended);
	await rig.runtime.undo(); await settle(); expect(rig.project.zones.get(zone.id)?.points).toEqual(original);
	await rig.runtime.redo(); await settle(); expect(rig.project.zones.get(zone.id)?.points).toEqual(rotated);
	rig.stack.metadataCache.catchUp(); const fresh = stackFoundation({ vault: rig.stack.vault, fileManager: rig.stack.fileManager, metadataCache: rig.stack.metadataCache }, rig.stack.projectFolder); fresh.rebuildIndex();
	const loaded = expectFound(await new ObsidianZoneRepository(fresh.deps, fresh.store).getById(zone.id)); expect(loaded.entity.geometry.points).toEqual(rotated); expect(loaded.entity.name).toBe(zone.name);
	await rig.runtime.renovation.perspective('renovate'); await settle(); expect(rig.runtime.rotationActions.blocked.value).toBe(false);
	await rig.runtime.rotationActions.rotate(zone.id, -90); await settle(); expect(rig.project.zones.get(zone.id)?.points).not.toEqual(rotated);
});
it('refuses a peer-modified Room baseline at numeric Apply without replacing its geometry or metadata', async () => {
	const rig = await setup(); rig.selection.select([rig.room.id]); await settle();
	const operation = rig.runtime.rotationActions.rotate(rig.room.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input[name="angle"]').setValue('45');
	const baseline = expectFound(await rig.stack.zones.getById(rig.room.id)); expectOk(await rig.stack.zones.save(expectOk(baseline.entity.withName('Peer room')), baseline.version));
	await form.trigger('submit'); await settle(); expect(form.text()).toContain('changed');
	const saved = expectFound(await rig.stack.zones.getById(rig.room.id)); expect(saved.entity.name).toBe('Peer room'); expect(saved.entity.geometry.points).toEqual(baseline.entity.geometry.points);
	rig.dialogs.resolve('cancel'); await operation;
});

it('paints Room rotation in the top interaction layer and hides only its pointer handle with the source layer', async () => {
	const rig = await setup(); rig.runtime.selectAndFrame(rig.room.id); await settle(); await hoverRotation(rig.runtime, useEditorStore(rig.pinia), rig.room.geometry.points[0]);
	expect(rig.runtime.renderState.rotationHoverId).toBe(rig.room.id);
	const handle = expectDefined(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle'), 'Room handle'); expect(handle.getLayer()?.name()).toBe('interaction');
	const workspace = useWorkspaceStore(rig.pinia); workspace.toggleLayer('zone'); await settle();
	expect(rig.runtime.rotationActions.handle.value).toBeNull(); expect(rig.runtime.rotationActions.available.value).toBe(true);
	expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();
	const original = rig.project.zones.get(rig.room.id)?.points; await rig.runtime.rotationActions.rotate(rig.room.id, 90); await settle(); expect(rig.project.zones.get(rig.room.id)?.points).not.toEqual(original);
});



it('preserves Object paint/list order, complete metadata and the other Object through rotation and history', async () => {
	const rig = await setup(), second: NamedSpatialElement = { ...element, id: 'element-second', name: 'Second desk', points: element.points.map(point => ({ ...point, x: point.x + 100 })) };
	const baseline = expectOk(await rig.renovation.read(rig.plan.id)); expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, second), rig.runtime.structureTask.ledger))); rig.selection.select([element.id as never]); await settle();
	const before = expectOk(await rig.renovation.read(rig.plan.id)), ids = before.geometry.document.structure?.elements?.map(item => item.id), metadata = before.plan.entity.spatialElements;
	await rig.runtime.rotationActions.rotate(element.id, 90); await settle(); const rotated = rig.project.structure.elements?.[0].points;
	for (const action of [null, 'undo', 'redo'] as const) {
		if (action) { await rig.runtime[action](); await settle(); }
		const after = expectOk(await rig.renovation.read(rig.plan.id)); expect(after.geometry.document.structure?.elements?.map(item => item.id)).toEqual(ids); expect(after.plan.entity.spatialElements).toEqual(metadata);
		expect(after.geometry.document.structure?.elements?.[1]).toEqual(before.geometry.document.structure?.elements?.[1]);
		expect(after.geometry.document.structure?.elements?.[0].points).toEqual(action === 'undo' ? element.points : rotated);
	}
});


it('continues a frozen pointer draft through a geometry-identical projection refresh', async () => {
	const rig = await setup(), handle = expectDefined(rig.runtime.rotationActions.handle.value, 'handle'), tool = rig.runtime.toolManager;
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(pointerAt(2000, 1000)); await settle(); expect(rig.runtime.rotationActions.preview.value).not.toBeNull();
	await rig.runtime.refreshProjection(); tool.pointerMove(pointerAt(1900, 1600)); await settle();
	const preview = expectDefined(rig.runtime.rotationActions.preview.value, 'retained preview').points;
	tool.pointerUp(pointerAt(1900, 1600)); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(preview);
});

it.each([false, true])('handles a rejected rotation baseline with disposed=%s without leaking geometry or notices', async disposed => {
	const rig = await setup(), pending = defer<Awaited<ReturnType<typeof rig.renovation.read>>>(), cause = new Error('rotation source unavailable');
	const bytes = [...rig.stack.vault.entries], log = vi.spyOn(rig.deps.commands.logger, 'error');
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending.promise);
	const operation = rig.runtime.rotationActions.rotate(element.id, 90); await settle();
	if (disposed) { rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); }
	pending.reject(cause); await operation;
	expect(log.mock.calls.some(([event]) => event === 'editor.rotation.failed')).toBe(!disposed);
	expect(rig.runtime.rotationActions.preview.value).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it.each(['kind', 'curve'] as const)('refuses a drag snapshot after a peer changes only its %s metadata', async changed => {
	const rig = await setup();
	if (changed === 'curve') { rig.selection.select([rig.room.id]); await settle(); }
	const original = expectDefined(rig.runtime.rotationActions.target.value, 'original target'), points = expectDefined(rotationPoints(original, 90, expectDefined(rotationPivot(original), 'pivot')), 'rotation');
	if (changed === 'kind') {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.renovation.command(baseline, elementInput(baseline, { ...element, kind: 'path' }), rig.runtime.structureTask.ledger).execute());
	} else {
		const service = expectDefined(rig.deps.commands.groups, 'geometry service'), baseline = expectOk(await service.read(rig.plan.id));
		expectOk(await service.command({ planId: rig.plan.id, baseline, ledger: rig.runtime.structureTask.ledger, document: { ...baseline.document, objects: baseline.document.objects.map(object => object.id === rig.room.id ? { ...object, bulges: [0.25, 0, 0, 0] } : object) } }).execute());
	}
	await rig.runtime.refreshProjection(); const bytes = [...rig.stack.vault.entries];
	await rig.runtime.rotationActions.move(original.id, points, original);
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.runtime.rotationActions.preview.value).toBeNull();
});

it('keeps geometry intact when the guarded pointer rotation write is refused', async () => {
	const rig = await setup(), original = expectDefined(rig.runtime.rotationActions.target.value, 'target'), bytes = [...rig.stack.vault.entries];
	const points = expectDefined(rotationPoints(original, 90, expectDefined(rotationPivot(original), 'pivot')), 'turned points');
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.rotationActions.move(original.id, points, original); await settle();
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.runtime.rotationActions.active.value).toBe(false);
});
