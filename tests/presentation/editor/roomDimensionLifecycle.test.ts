// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { rig, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle } from '../../helpers/editor';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { defer } from '../../helpers/async';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { err } from '../../../src/core/result/Result';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import * as notices from '../../../src/presentation/notices/notify';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.restoreAllMocks(); });
const formSelector = '[data-rp-form="room-dimension"]';
async function dimensionRig() {
	const value = await rig(); cleanups.push(value.harness.unmount);
	const runtime = runtimeOf(value.harness); runtime.selectAndFrame('zone-a'); await settle();
	return { ...value, runtime, wrapper: value.harness.wrapper };
}
describe('Room scalar lifecycle and recovery', () => {
	it('does not steal focus after a delayed baseline when the user tabs to the other dimension', async () => {
		const value = await dimensionRig(), loaded = await value.zonesRepo.getById('zone-a' as never), gate = defer<typeof loaded>();
		vi.spyOn(value.zonesRepo, 'getById').mockReturnValue(gate.promise);
		const width = value.wrapper.get('[data-rp-dimension="width"]'); (width.element as HTMLElement).focus(); await width.trigger('click');
		const depth = value.wrapper.get('[data-rp-dimension="depth"]'); (depth.element as HTMLElement).focus();
		gate.resolve(loaded); await settle();
		expect(value.wrapper.find(formSelector).exists()).toBe(true); expect(document.activeElement).toBe(depth.element);
	});
	it('follows Room layer visibility while retaining an already active native draft', async () => {
		const value = await dimensionRig(), workspace = useWorkspaceStore(value.harness.pinia);
		workspace.toggleLayer('zone'); await settle(); expect(value.wrapper.find('[data-rp-dimension]').exists()).toBe(false);
		expect(value.wrapper.find('[data-rp-canvas-edit]').exists()).toBe(false);
		workspace.toggleLayer('zone'); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		await value.wrapper.get(`${formSelector} input`).setValue('4,2'); workspace.toggleLayer('zone'); await settle();
		expect(value.wrapper.get(`${formSelector} input`).element).toHaveProperty('value', '4,2');
	});
	it.each(['read-failed', 'unrecovered'] as const)('retains an inline draft and refuses %s through the canonical write gate', async reason => {
		const value = await renovationEditor(true); cleanups.push(value.unmount); await value.runtime.refreshProjection();
		void value.runtime.roomDimension.open(value.room.id, 'width'); await settle();
		const input = value.wrapper.get<HTMLInputElement>(`${formSelector} input`); await input.setValue('5,50'); input.element.focus();
		const service = expectDefined(value.deps.commands.planning, 'planning');
		const read = vi.spyOn(service, 'read');
		if (reason === 'read-failed') { read.mockResolvedValue(err(injectedPersistenceError())); value.changeCatalogue(); }
		else useSaveStateStore(value.pinia).markUnrecovered();
		await settle();
		expect(value.project.stale).toBe(false); expect(value.runtime.writesBlocked.value).toBe(true);
		expect(input.element.readOnly).toBe(true); expect(input.element.value).toBe('5,50'); expect(document.activeElement).toBe(input.element);
		const bytes = [...value.stack.vault.entries], dispatch = vi.spyOn(value.runtime.dispatcher, 'run');
		await value.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(dispatch).not.toHaveBeenCalled(); expect([...value.stack.vault.entries]).toEqual(bytes);
		read.mockRestore(); await value.runtime.refreshProjection(); await settle();
		expect(input.element.value).toBe('5,50'); expect(input.element.readOnly).toBe(reason === 'unrecovered');
		expect(dispatch).not.toHaveBeenCalled();
		value.runtime.roomDimension.cancel(); await settle();
		if (reason === 'unrecovered') await value.runtime.roomDimension.open(value.room.id, 'width');
		expect(value.wrapper.find(formSelector).exists()).toBe(false);
	});
	it('retires a delayed read on explicit tool cancellation without stealing the new tool', async () => {
		const value = await dimensionRig(), loaded = await value.zonesRepo.getById('zone-a' as never);
		const gate = defer<typeof loaded>(), read = vi.spyOn(value.zonesRepo, 'getById').mockReturnValue(gate.promise);
		const pending = value.runtime.roomDimension.open('zone-a' as never, 'width');
		await value.runtime.roomDimension.open('zone-a' as never, 'depth'); expect(read).toHaveBeenCalledTimes(1);
		value.runtime.setTool('draw-area'); gate.resolve(loaded); await pending; await settle();
		expect(value.wrapper.find(formSelector).exists()).toBe(false); expect(value.runtime.activeToolId.value).toBe('draw-area');
	});
	it('ignores a baseline that resolves after disposal and refuses future opens', async () => {
		const value = await dimensionRig(), loaded = await value.zonesRepo.getById('zone-a' as never), gate = defer<typeof loaded>();
		vi.spyOn(value.zonesRepo, 'getById').mockReturnValue(gate.promise);
		const pending = value.runtime.roomDimension.open('zone-a' as never, 'width');
		value.harness.unmount(); cleanups.length = 0; gate.resolve(loaded); await pending;
		await value.runtime.roomDimension.open('zone-a' as never, 'width');
		expect(value.runtime.toolManager.activeToolId).toBeNull(); expect(value.runtime.roomDimension.draft.value).toBeNull();
	});
	it('silences a baseline rejection after disposal and rejects a retired commit callback', async () => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		const draft = expectDefined(value.runtime.roomDimension.draft.value, 'draft'), before = expectFound(await value.zonesRepo.getById('zone-a' as never));
		value.runtime.roomDimension.cancel(); await settle();
		const save = vi.spyOn(value.zonesRepo, 'save');
		const result = await draft.controls.commit({ kind: 'geometry', zoneId: before.entity.id, forward: before.entity.geometry, inverse: before.entity.geometry, expected: before.version });
		expect(result.ok).toBe(false); expect(save).not.toHaveBeenCalled();
		let rejectRead!: (reason: Error) => void;
		vi.spyOn(value.zonesRepo, 'getById').mockImplementationOnce(() => new Promise((resolve, reject) => { void resolve; rejectRead = reject; }));
		const fault = vi.spyOn(notices, 'notifyFault'), pending = value.runtime.roomDimension.open(before.entity.id, 'width');
		value.harness.unmount(); cleanups.length = 0; rejectRead(new Error('Late read')); await pending;
		expect(fault).not.toHaveBeenCalled();
	});
	it('forces a pending write to retire with the leaf and ignores its late completion', async () => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		const input = value.wrapper.get<HTMLInputElement>(`${formSelector} input`); await input.setValue('4.2'); input.element.focus();
		const save = value.zonesRepo.save.bind(value.zonesRepo), gate = defer<void>();
		vi.spyOn(value.zonesRepo, 'save').mockImplementation(async (...args) => { await gate.promise; return save(...args); });
		const draft = expectDefined(value.runtime.roomDimension.draft.value, 'draft'), pending = draft.submit(); await settle();
		value.harness.unmount(); cleanups.length = 0; gate.resolve(); await pending;
		expect(value.runtime.toolManager.activeToolId).toBeNull(); expect(value.runtime.roomDimension.draft.value).toBeNull();
		expect(value.runtime.renderState.previewPolygon).toBeNull();
	});
	it('does not return focus after cancellation immediately retires the leaf', async () => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		value.wrapper.get<HTMLInputElement>(`${formSelector} input`).element.focus();
		value.runtime.roomDimension.cancel(); value.harness.unmount(); cleanups.length = 0; await settle();
		expect(value.runtime.toolManager.activeToolId).toBeNull(); expect(document.querySelector(formSelector)).toBeNull();
	});
	it('respects focus moved to another region while cancellation renders', async () => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		value.wrapper.get<HTMLInputElement>(`${formSelector} input`).element.focus();
		value.runtime.roomDimension.cancel();
		const otherRegion = value.wrapper.get<HTMLElement>('[data-rp-action="select"]'); otherRegion.element.focus();
		await settle();
		expect(value.wrapper.find(formSelector).exists()).toBe(false); expect(document.activeElement).toBe(otherRegion.element);
	});
	it('keeps a conflict explicit when the latest Room cannot be read back', async () => {
		let fail = false;
		const value = await rig(undefined, { wrapQueries: queries => ({ ...queries,
			findZonesByPlan: id => fail ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id) }) });
		cleanups.push(value.harness.unmount); const runtime = runtimeOf(value.harness);
		runtime.selectAndFrame('zone-a'); await settle(); void runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		await value.harness.wrapper.get(`${formSelector} input`).setValue('4.2');
		const before = expectFound(await value.zonesRepo.getById('zone-a' as never));
		expectOk(await value.zonesRepo.save(expectOk(before.entity.withGeometry({ points: ZONE_A_DTO.points.map(point => ({ x: point.x + 100, y: point.y })) })), before.version));
		fail = true; await value.harness.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(expectDefined(runtime.roomDimension.draft.value, 'retained draft').controls.latest.value).not.toBeNull();
		expect(useProjectStore(value.harness.pinia).stale).toBe(true);
		expect(value.harness.wrapper.get(`${formSelector} input`).element).toHaveProperty('value', '4.2');
		expect(runtime.canUndo.value).toBe(false);
	});
	it('retains a failed save for explicit retry and pauses edits when the projection becomes stale', async () => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'depth'); await settle();
		const input = value.wrapper.get(`${formSelector} input`); await input.setValue('3.2');
		const spy = vi.spyOn(value.zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		await value.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(value.wrapper.find(`${formSelector} [role="alert"]`).exists()).toBe(true);
		useProjectStore(value.harness.pinia).stale = true; await input.setValue('6');
		expect(input.element).toHaveProperty('value', '3.2');
		await value.wrapper.get(formSelector).trigger('submit'); await settle(); expect(spy).toHaveBeenCalledTimes(1);
		await value.runtime.refreshProjection(); await value.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(spy).toHaveBeenCalledTimes(2); expect(value.wrapper.find(formSelector).exists()).toBe(false);
	});
	it.each(['bad', '-1', '1001'])('announces invalid scalar %s without writing', async text => {
		const value = await dimensionRig(); void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		await value.wrapper.get(`${formSelector} input`).setValue(text); await value.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(value.wrapper.get(`${formSelector} input`).attributes('aria-invalid')).toBe('true');
		expect(value.runtime.canUndo.value).toBe(false); expect(value.runtime.renderState.previewPolygon).toBeNull();
	});
	it('refuses a numerically collapsed polygon instead of writing an apparently positive length', async () => {
		const value = await dimensionRig(), before = expectFound(await value.zonesRepo.getById('zone-a' as never));
		const points = [{ x: 1e20, y: 0 }, { x: 1e20 + 16384, y: 0 }, { x: 1e20 + 16384, y: 1000 }, { x: 1e20, y: 1000 }];
		expectOk(await value.zonesRepo.save(expectOk(before.entity.withGeometry({ points })), before.version)); await value.runtime.refreshProjection();
		void value.runtime.roomDimension.open('zone-a' as never, 'width'); await settle();
		await value.wrapper.get(`${formSelector} input`).setValue('0.001'); await value.wrapper.get(formSelector).trigger('submit'); await settle();
		expect(value.wrapper.get(`${formSelector} input`).attributes('aria-invalid')).toBe('true');
		expect(value.runtime.canUndo.value).toBe(false);
		expect(expectFound(await value.zonesRepo.getById('zone-a' as never)).entity.geometry.points).toEqual(points);
	});
	it('keeps irregular Room geometry intact and offers no coordinate form beside its canvas vertices', async () => {
		const value = await dimensionRig(), before = expectFound(await value.zonesRepo.getById('zone-a' as never));
		const triangle = makeZone({ ...before.entity, geometry: { points: ZONE_A_DTO.points.slice(0, 3) } });
		expectOk(await value.zonesRepo.save(triangle, before.version)); await value.runtime.refreshProjection(); await settle();
		expect(value.wrapper.find('[data-rp-dimension]').exists()).toBe(false);
		await value.runtime.roomDimension.open('zone-a' as never, 'width');
		expect(value.runtime.activeToolId.value).toBe('select'); expect(value.runtime.canUndo.value).toBe(false);
		expect(value.wrapper.find('[data-rp-canvas-edit]').exists()).toBe(false);
	});
});
