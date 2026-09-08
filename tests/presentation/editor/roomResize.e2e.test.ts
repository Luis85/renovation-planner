// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rig, click, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { makeAsset, makeZone } from '../../helpers/entities';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { err, ok } from '../../../src/core/result/Result';
installObsidianDom();
beforeEach(() => { activateNotices(); });
type Rig = Awaited<ReturnType<typeof rig>>;
async function open(r: Rig, canvas = false): Promise<void> {
	if (canvas) click(expectDefined(r.harness.canvasEl, 'canvas'), 300, 250);
	else await r.harness.wrapper.get('.rp-room-list__row[data-rp-id="zone-a"]').trigger('click');
	await settle();
	const button = r.harness.wrapper.get('[data-rp-action="resize-room"]');
	(button.element as HTMLElement).focus();
	await button.trigger('click');
	await settleUntil(() => r.harness.wrapper.find('.rp-room-dimensions').exists(), 'dimensions dialog');
}
async function type(r: Rig, width = '4,2', depth = '3.5'): Promise<void> {
	await r.harness.wrapper.get('input[name="width"]').setValue(width);
	await r.harness.wrapper.get('input[name="depth"]').setValue(depth);
}
async function read(r: Rig) { return expectFound(await r.zonesRepo.getById('zone-a' as never)); }
async function apply(r: Rig): Promise<void> { await r.harness.wrapper.get('.rp-room-dimensions').trigger('submit'); await settle(); }
async function cancel(r: Rig): Promise<void> { await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await settle(); }

describe('existing Room dimensions through the real editor', () => {
	it.each([false, true])('selects through list action/canvas (%s), previews without writing, applies once and reverses', async canvas => {
		const r = await rig(); const runtime = runtimeOf(r.harness); const before = await read(r);
		await open(r, canvas);
		expect(document.activeElement).toBe(r.harness.wrapper.get('input[name="width"]').element);
		await type(r);
		expect((await read(r)).version).toEqual(before.version);
		expect(useProjectStore(r.harness.pinia).zones.get('zone-a')?.points).toEqual(ZONE_A_DTO.points);
		expect(runtime.canUndo.value).toBe(false);
		expect(runtime.renderState.previewPolygon?.[2]).toEqual({ x: 5700, y: 5000 });
		await apply(r);
		await settleUntil(() => !r.harness.wrapper.find('.rp-room-dimensions').exists(), 'saved dimensions');
		const after = await read(r);
		expect(after.entity.geometry.points[2]).toEqual({ x: 5700, y: 5000 });
		expect(after.entity).toMatchObject({ id: before.entity.id, name: before.entity.name, zoneType: 'Room', status: before.entity.status });
		expect(runtime.inspectorDto.value).toMatchObject({ areaMm2: 14_700_000 });
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(runtime.renderState.previewPolygon).toBeNull();
		expect(document.activeElement).toBe(r.harness.wrapper.get('[data-rp-action="resize-room"]').element);
		await runtime.undo(); expect((await read(r)).entity.geometry).toEqual(before.entity.geometry);
		expect(runtime.canUndo.value).toBe(false);
		await runtime.redo(); expect((await read(r)).entity.geometry).toEqual(after.entity.geometry);
		r.harness.unmount();
	});
	it('announces resize unavailable during a temporary Area tool', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness);
		await r.harness.wrapper.get('.rp-room-list__row[data-rp-id="zone-a"]').trigger('click'); await settle();
		runtime.setTool('draw-area'); await settle();
		expect(r.harness.wrapper.get('[data-rp-action="resize-room"]').attributes('aria-disabled')).toBe('true');
		runtime.setTool('select'); await settle();
		expect(r.harness.wrapper.get('[data-rp-action="resize-room"]').attributes('aria-disabled')).toBe('false');
		r.harness.unmount();
	});
	it('keeps invalid text, focuses its error, and cancels without changing geometry or selection', async () => {
		const r = await rig(); await open(r); await type(r, 'bad', '0'); await apply(r);
		expect(r.harness.wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2);
		expect(document.activeElement).toBe(r.harness.wrapper.get('input[name="width"]').element);
		expect(runtimeOf(r.harness).renderState.previewPolygon).toBeNull();
		await type(r); await cancel(r);
		expect((await read(r)).entity.geometry.points).toEqual(ZONE_A_DTO.points);
		expect(runtimeOf(r.harness).canUndo.value).toBe(false);
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		r.harness.unmount();
	});
	it('refuses a peer write against the form baseline and retains the draft', async () => {
		const r = await rig(); await open(r); await type(r);
		const before = await read(r);
		const changed = expectOk(before.entity.withGeometry({ points: ZONE_A_DTO.points.map(p => ({ x: p.x === 1500 ? p.x : p.x + 100, y: p.y })) }));
		expectOk(await r.zonesRepo.save(changed, before.version));
		await apply(r);
		expect((await read(r)).entity.geometry).toEqual(changed.geometry);
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(true);
		expect(r.harness.wrapper.get('input[name="width"]').element).toHaveProperty('value', '4,2');
		expect(r.harness.wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(r.harness.wrapper.text()).toContain('Latest saved size: 3 m × 1.9 m');
		expect(r.harness.wrapper.get('.rp-room-dimensions button[type="submit"]').attributes('aria-disabled')).toBe('true');
		await apply(r);
		expect(runtimeOf(r.harness).canUndo.value).toBe(false);
		await cancel(r); r.harness.unmount();
	});
	it('holds focus and blocks duplicate Apply and Cancel while saving, then allows one success', async () => {
		const r = await rig(); await open(r); await type(r);
		const save = r.zonesRepo.save.bind(r.zonesRepo); let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		const spy = vi.spyOn(r.zonesRepo, 'save').mockImplementation(async (...args) => { await wait; return save(...args); });
		await apply(r); await apply(r); await cancel(r);
		await r.harness.wrapper.get('input[name="width"]').trigger('keydown', { key: 'Escape' }); await settle();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(r.harness.wrapper.get('input[name="width"]').attributes('readonly')).toBeDefined();
		await r.harness.wrapper.get('input[name="width"]').setValue('9');
		expect(r.harness.wrapper.get('input[name="width"]').element).toHaveProperty('value', '4,2');
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(true);
		release(); await settleUntil(() => !r.harness.wrapper.find('.rp-room-dimensions').exists(), 'released save');
		expect(spy).toHaveBeenCalledTimes(1); r.harness.unmount();
	});
	it('preserves the draft on a persistence refusal, retries explicitly and blocks stale projection', async () => {
		const r = await rig(); await open(r); await type(r);
		const spy = vi.spyOn(r.zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		await apply(r); expect(r.harness.wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(runtimeOf(r.harness).canUndo.value).toBe(false);
		const project = useProjectStore(r.harness.pinia); project.stale = true; await apply(r);
		expect(spy).toHaveBeenCalledTimes(1);
		await runtimeOf(r.harness).refreshProjection(); await apply(r);
		await settleUntil(() => !r.harness.wrapper.find('.rp-room-dimensions').exists(), 'explicit retry');
		expect(spy).toHaveBeenCalledTimes(2); r.harness.unmount();
	});
	it('does not create history for unchanged or equivalent text and keeps native key ownership', async () => {
		const r = await rig(); await open(r); const runtime = runtimeOf(r.harness);
		await apply(r); expect(runtime.canUndo.value).toBe(false);
		await type(r, '2.900', '1,900'); await apply(r); expect(runtime.canUndo.value).toBe(false);
		for (const detail of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...detail });
			r.harness.wrapper.get('input[name="width"]').element.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		}
		await type(r); await r.harness.wrapper.get('input[name="width"]').trigger('keydown', { key: 'Escape' }); await settle();
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(runtime.activeToolId.value).toBe('select'); expect(runtime.canUndo.value).toBe(false);
		r.harness.unmount();
	});
	it('recalculates linked quantity and cost only on Apply and follows Undo/Redo', async () => {
		const asset = makeAsset({ unit: 'm2' });
		const r = await rig(async ({ assets }) => { expectOk(await assets.save(asset, 'absent')); });
		const runtime = runtimeOf(r.harness);
		runtime.selectAndFrame('zone-a'); await settle();
		expectOk(await runtime.commitField({ kind: 'assign', zoneId: 'zone-a' as never, assetId: asset.id }));
		const before = expectDefined(runtime.inspectorRequirements.value[0], 'requirement row');
		await open(r); await type(r);
		expect(runtime.inspectorRequirements.value[0]).toEqual(before);
		await apply(r); await settleUntil(() => !r.harness.wrapper.find('.rp-room-dimensions').exists(), 'resize and cascade');
		const after = expectDefined(runtime.inspectorRequirements.value[0], 'requirement row');
		expect(after.quantity.calculated).not.toEqual(before.quantity.calculated);
		expect(after.cost.effective).not.toEqual(before.cost.effective);
		await runtime.undo(); expect(runtime.inspectorRequirements.value[0]?.quantity.calculated).toEqual(before.quantity.calculated);
		await runtime.redo(); expect(runtime.inspectorRequirements.value[0]?.quantity.calculated).toEqual(after.quantity.calculated);
		r.harness.unmount();
	});
	it('does not open during another save, on multiple selection, or on a stale floor', async () => {
		const r = await rig(); const runtime = runtimeOf(r.harness); const selection = useSelectionStore(r.harness.pinia);
		selection.select(['zone-a' as never, 'other' as never]); await runtime.resizeRoom('zone-a' as never);
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		selection.select(['zone-a' as never]); useProjectStore(r.harness.pinia).stale = true;
		await runtime.resizeRoom('zone-a' as never); expect(runtime.resizeRoomBlocked.value).toBe(true);
		useProjectStore(r.harness.pinia).stale = false;
		useSaveStateStore(r.harness.pinia).beginSaving(); await runtime.resizeRoom('zone-a' as never);
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		r.harness.unmount();
	});
	it('drops a delayed baseline after selection leaves and returns, and after leaf close', async () => {
		const r = await rig(); const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle();
		const baseline = await r.zonesRepo.getById('zone-a' as never);
		let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
		vi.spyOn(r.zonesRepo, 'getById').mockImplementation(async () => { await wait; return baseline; });
		const pending = runtime.resizeRoom('zone-a' as never);
		await runtime.resizeRoom('zone-a' as never); // no second baseline request
		const selection = useSelectionStore(r.harness.pinia); selection.clear(); selection.select(['zone-a' as never]);
		release(); await pending; await settle();
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		const pendingClose = runtime.resizeRoom('zone-a' as never); r.harness.unmount(); await pendingClose;
	});
	it('keeps a failed save visible and ignores its late completion after leaf close', async () => {
		const r = await rig(); await open(r); await type(r);
		vi.spyOn(r.zonesRepo, 'save').mockRejectedValueOnce(new Error('write failed'));
		await apply(r); expect(r.harness.wrapper.find('[role="alert"]').exists()).toBe(true);
		const save = r.zonesRepo.save.bind(r.zonesRepo); let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		vi.spyOn(r.zonesRepo, 'save').mockImplementationOnce(async (...args) => { await wait; return save(...args); });
		await apply(r); r.harness.unmount(); release(); await settle();
		expect(document.querySelector('.rp-dialog')).toBeNull();
	});
	it.each(['Room', 'Custom'] as const)('explains unsupported Room shapes and does not offer resize for %s triangles', async zoneType => {
		const r = await rig(async ({ zones }) => {
			const loaded = expectFound(await zones.getById('zone-a' as never));
			const polygon = makeZone({ ...loaded.entity, zoneType, geometry: { points: ZONE_A_DTO.points.slice(0, 3) } });
			expectOk(await zones.save(polygon, loaded.version));
		});
		runtimeOf(r.harness).selectAndFrame('zone-a'); await settle();
		expect(r.harness.wrapper.find('[data-rp-action="resize-room"]').exists()).toBe(false);
		expect(r.harness.wrapper.text().includes('only rectangles')).toBe(zoneType === 'Room');
		await runtimeOf(r.harness).resizeRoom('zone-a' as never);
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		r.harness.unmount();
	});

	it('keeps a confirmed write when readback fails, pauses further writes and refreshes without replay', async () => {
		let failReadback = false;
		const r = await rig(undefined, { wrapQueries: queries => ({ ...queries,
			findZonesByPlan: id => failReadback ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id),
		}) });
		await open(r); await type(r); const spy = vi.spyOn(r.zonesRepo, 'save');
		failReadback = true; await apply(r);
		await settleUntil(() => !r.harness.wrapper.find('.rp-room-dimensions').exists(), 'confirmed write');
		expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 5700, y: 5000 });
		expect(useProjectStore(r.harness.pinia).stale).toBe(true);
		expect(runtimeOf(r.harness).canUndo.value).toBe(true);
		failReadback = false; await runtimeOf(r.harness).refreshProjection();
		expect(useProjectStore(r.harness.pinia).stale).toBe(false); expect(spy).toHaveBeenCalledTimes(1);
		r.harness.unmount();
	});
	it.each(['missing', 'refusal', 'fault'] as const)('handles a %s baseline without opening a form or writing', async kind => {
		const r = await rig(); const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle();
		const spy = vi.spyOn(r.zonesRepo, 'getById');
		if (kind === 'fault') spy.mockRejectedValueOnce(new Error('read failed'));
		else spy.mockResolvedValueOnce(kind === 'missing' ? ok(null) : err(injectedPersistenceError()));
		await runtime.resizeRoom('zone-a' as never); await settle();
		expect(r.harness.wrapper.find('.rp-room-dimensions').exists()).toBe(false);
		expect(runtime.resizeRoomBlocked.value).toBe(false); expect(runtime.canUndo.value).toBe(false);
		r.harness.unmount();
	});

	it('reports when a conflicting current size cannot be read and keeps the baseline draft', async () => {
		let failReadback = false;
		const r = await rig(undefined, { wrapQueries: queries => ({ ...queries,
			findZonesByPlan: id => failReadback ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id),
		}) });
		await open(r); await type(r);
		const baseline = await read(r); expectOk(await r.zonesRepo.save(baseline.entity, baseline.version));
		failReadback = true; await apply(r);
		expect(r.harness.wrapper.text()).toContain('current room size cannot be read');
		expect(r.harness.wrapper.get('input[name="width"]').element).toHaveProperty('value', '4,2');
		await cancel(r); r.harness.unmount();
	});
	it('labels an oversized dimension with the shared unit limit', async () => {
		const r = await rig(); await open(r); await type(r, '1000.001', '3'); await apply(r);
		expect(r.harness.wrapper.text()).toContain('A side cannot be longer than 1000 m');
		await cancel(r); r.harness.unmount();
	});

});
