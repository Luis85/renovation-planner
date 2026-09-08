// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, mountPlanEditorCanvas, runtimeOf } from '../../helpers/editor';
import { stackFoundation } from '../../helpers/repositoryStack';
import { ObsidianPlanRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { renovationServices } from '../../../src/application/commands/renovation/RenovationCommand';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { rotationPivot, rotationPoints, rotationHandle } from '../../../src/presentation/editor/elements/objectRotation';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldPerScreenPixel, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';
import { pointerAt } from '../../helpers/tool-context';
import { err, ok } from '../../../src/core/result/Result';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
const element: NamedSpatialElement = { id: 'element-object', kind: 'object', name: 'Desk', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }] };
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const input = elementInput(baseline, element);
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { ...input, intended: { walls: [], openings: [], boundaries: [], elements: [{ id: element.id, kind: element.kind, points: element.points.map(p => ({ ...p, x: p.x + 300 })) }] } }, rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as never]); await settle(); return rig;
}
it('commits numeric decimal comma once, matches preview, preserves intended metadata, and restores exact Undo/Redo', async () => {
	const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id));
	const operation = rig.runtime.elementActions.rotate(element.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input[name="angle"]').setValue('27,25'); await settle();
	const preview = rig.runtime.elementActions.preview.value?.points;
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
	await rig.runtime.elementActions.rotate(element.id, 360); await rig.runtime.elementActions.rotate(element.id, NaN); expect(write).not.toHaveBeenCalled();
	const operation = rig.runtime.elementActions.rotate(element.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	for (const value of ['invalid', '', '360', '0']) { await form.get('input[name="angle"]').setValue(value); await form.trigger('submit'); }
	expect(write).not.toHaveBeenCalled();
	await form.get('input[name="angle"]').setValue('-45'); rig.dialogs.resolve('cancel'); await operation; await settle(); expect(rig.runtime.elementActions.preview.value).toBeNull(); expect(write).not.toHaveBeenCalled();
});
it('retains a conflicted numerical draft and never retries the refused write', async () => {
	const rig = await setup(); const operation = rig.runtime.elementActions.rotate(element.id); await settle(); const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	await form.get('input[name="angle"]').setValue('35');
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, { ...element, name: 'Peer desk' }), rig.runtime.structureTask.ledger).execute());
	await form.trigger('submit'); await settle(); expect(form.text()).toContain('changed'); expect(form.get<HTMLInputElement>('input[name="angle"]').element.value).toBe('35');
	const write = vi.spyOn(rig.geometry, 'write'); await form.trigger('submit'); await settle(); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});
it('keeps successful-write/failed-readback recovery read-only', async () => {
	const rig = await setup(), getPlan = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	const write = vi.spyOn(rig.geometry, 'write'); await rig.runtime.elementActions.rotate(element.id, 90); await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true);
	await rig.runtime.elementActions.rotate(element.id, 90); expect(write).toHaveBeenCalledOnce();
	getPlan.mockRestore(); await rig.runtime.refreshProjection(); await settle(); expect(write).toHaveBeenCalledOnce();
	expect(rig.project.structure.elements?.[0].points).toEqual(rotationPoints(element, 90, expectDefined(rotationPivot(element), 'pivot')));
});
it('reconstructs the index, repositories and runtime from persisted bytes and edits/restores the rotated Object', async () => {
	const rig = await setup(); await rig.runtime.elementActions.rotate(element.id, 90); await settle();
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document, bytes = [...rig.stack.vault.entries];
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); rig.stack.metadataCache.catchUp();
	const fresh = stackFoundation({ vault: rig.stack.vault, fileManager: rig.stack.fileManager, metadataCache: rig.stack.metadataCache }, rig.stack.projectFolder); fresh.rebuildIndex();
	const plans = new ObsidianPlanRepository(fresh.deps, fresh.store), geometry = new ObsidianPlanGeometrySidecar(fresh.store), renovation = renovationServices(plans, geometry, fresh.events);
	const plan = expectFound(await plans.getById(rig.plan.id)).entity;
	const queries = { ...rig.deps.queries, getPlan: async () => ok(toPlanDto(expectFound(await plans.getById(plan.id)).entity)), findZonesByPlan: async () => { const data = expectOk(await geometry.read(plan.id)).document; return ok({ zones: [], unreadable: 0, structure: data.structure, intended: data.intended }); } };
	const reopened = await mountPlanEditorCanvas({ plan: toPlanDto(plan), queries, commands: { ...rig.deps.commands, renovation } }); mounted.push(reopened);
	const runtime = runtimeOf(reopened), project = useProjectStore(reopened.pinia), selection = useSelectionStore(reopened.pinia);
	expect(project.structure).toEqual(saved.structure); expect(project.intended).toEqual(saved.intended); expect(project.plan?.spatialElements).toEqual([{ id: element.id, name: element.name }]); expect([...rig.stack.vault.entries]).toEqual(bytes);
	selection.select([element.id as never]); await settle(); await runtime.elementActions.rotate(element.id, -90); await settle();
	await runtime.undo(); await settle(); expect(project.structure).toEqual(saved.structure);
	await runtime.redo(); await settle(); expect(project.structure.elements?.[0].points).not.toEqual(saved.structure?.elements?.[0].points);
});
it('abandons a delayed numeric baseline after a tool switch even if Select is restored', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	let resolveRead: ((value: Awaited<ReturnType<typeof rig.renovation.read>>) => void) | undefined;
	const pending = new Promise<Awaited<ReturnType<typeof rig.renovation.read>>>(resolve => { resolveRead = resolve; });
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending);
	const operation = rig.runtime.elementActions.rotate(element.id, 90); await settle();
	rig.runtime.setTool(null); rig.runtime.setTool('select');
	expectDefined(resolveRead, 'pending read')(ok(baseline)); await operation;
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points); expect(rig.dialogs.current).toBeNull();
});

it('uses the rendered handle under pan/zoom, previews final Shift bearing and makes one pointer history entry', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia); editor.viewport = { ...editor.viewport, zoom: 0.2, pan: { x: 70, y: 90 } }; await settle();
	const scale = worldPerScreenPixel(editor.viewport, STAGE_PIXELS), handle = expectDefined(rotationHandle(element, scale), 'handle');
	const painted = expectDefined(expectDefined(rig.stage, 'stage').findOne<Konva.Group>('.object-rotation-handle'), 'painted handle');
	const circle = expectDefined(painted.findOne<Konva.Circle>('Circle'), 'handle circle'); expect(circle.x()).toBe(handle.x); expect(circle.y()).toBe(handle.y);
	const tool = rig.runtime.toolManager, write = vi.spyOn(rig.geometry, 'write');
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(pointerAt(2000, 800)); await settle();
	const release = pointerAt(1900, 1500), snapped = { ...release, modifiers: { ...release.modifiers, shift: true } };
	tool.pointerMove(snapped); await settle(); const preview = rig.runtime.elementActions.preview.value?.points;
	expect(rig.runtime.renderState.rotationDegrees).not.toBeNull(); tool.pointerUp(snapped); await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.project.structure.elements?.[0].points).toEqual(preview); expect(rig.runtime.renderState.rotationDegrees).toBeNull();
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
});
it('abandons pointer release awaiting its baseline after tool changes', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	let resolveRead: ((value: Awaited<ReturnType<typeof rig.renovation.read>>) => void) | undefined;
	const pending = new Promise<Awaited<ReturnType<typeof rig.renovation.read>>>(resolve => { resolveRead = resolve; });
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending);
	const editor = useEditorStore(rig.pinia), handle = expectDefined(rotationHandle(element, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)), 'handle');
	rig.runtime.toolManager.pointerDown(pointerAt(handle.x, handle.y)); rig.runtime.toolManager.pointerUp(pointerAt(2000, 1000)); await settle();
	rig.runtime.setTool(null); rig.runtime.setTool('select'); expectDefined(resolveRead, 'pending read')(ok(baseline)); await settle();
	expect(rig.project.structure.elements?.[0].points).toEqual(element.points);
});


it('hides and refuses the rotation handle in Renovate and Review', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), handle = expectDefined(rotationHandle(element, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)), 'handle');
	for (const perspective of ['renovate', 'review'] as const) {
		await rig.runtime.renovation.perspective(perspective); await settle();
		rig.runtime.toolManager.pointerMove(pointerAt(handle.x, handle.y)); expect(rig.runtime.renderState.hoveredTargetKind).not.toBe('rotation');
		expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();
	}
});

it('Escape discards the pointer preview and a refreshed peer edit cannot be overwritten by its old gesture', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), handle = expectDefined(rotationHandle(element, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)), 'handle');
	const tool = rig.runtime.toolManager, canvas = expectDefined(rig.canvasEl, 'canvas'), write = vi.spyOn(rig.geometry, 'write');
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(pointerAt(2000, 1000)); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); tool.pointerUp(pointerAt(2000, 1000)); await settle();
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.elementActions.preview.value).toBeNull();
	rig.selection.select([element.id as never]); tool.pointerDown(pointerAt(handle.x, handle.y));
	const baseline = expectOk(await rig.renovation.read(rig.plan.id)), peer = { ...element, points: element.points.map(point => ({ ...point, x: point.x + 200 })) };
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, peer), rig.runtime.structureTask.ledger).execute()); await rig.runtime.refreshProjection(); const count = write.mock.calls.length;
	tool.pointerUp(pointerAt(2000, 1000)); await settle(); expect(write.mock.calls).toHaveLength(count); expect(rig.project.structure.elements?.[0].points).toEqual(peer.points);
});

it('suppresses rotation handle paint and targeting while a quarter-turn save is pending', async () => {
	const rig = await setup(), originalWrite = rig.geometry.write.bind(rig.geometry);
	let resumeWrite: (() => void) | undefined; const pending = new Promise<void>(resolve => { resumeWrite = resolve; });
	vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await pending; return originalWrite(...args); });
	const editor = useEditorStore(rig.pinia), handle = expectDefined(rotationHandle(element, worldPerScreenPixel(editor.viewport, STAGE_PIXELS)), 'handle');
	const operation = rig.runtime.elementActions.rotate(element.id, 90); await settle();
	expect(rig.runtime.elementActions.active.value).toBe(true); expect(expectDefined(rig.stage, 'stage').findOne('.object-rotation-handle')).toBeUndefined();
	rig.runtime.toolManager.pointerMove(pointerAt(handle.x, handle.y)); expect(rig.runtime.renderState.hoveredTargetKind).not.toBe('rotation');
	rig.runtime.toolManager.pointerDown(pointerAt(handle.x, handle.y)); rig.runtime.toolManager.pointerMove(pointerAt(2000, 1000)); expect(rig.runtime.renderState.rotationDegrees).toBeNull();
	expectDefined(resumeWrite, 'pending save')(); await operation; await settle();
});
