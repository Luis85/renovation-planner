// @vitest-environment jsdom
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { rig, pointer, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

installObsidianDom();
beforeEach(() => { activateNotices(); });
type Rig = Awaited<ReturnType<typeof rig>>;
const selector = '[data-rp-form="room-dimension"]';
async function open(r: Rig, axis = 'width'): Promise<void> {
	runtimeOf(r.harness).selectAndFrame('zone-a'); await settle();
	const button = r.harness.wrapper.get(`[data-rp-dimension="${axis}"]`);
	(button.element as HTMLElement).focus();
	await button.trigger('pointerdown'); await button.trigger('pointerup');
	expect(runtimeOf(r.harness).toolManager.gestureInFlight).toBe(false);
	await button.trigger('click');
	await settleUntil(() => r.harness.wrapper.find(selector).exists(), 'native dimension entry');
}
async function apply(r: Rig): Promise<void> { await r.harness.wrapper.get(selector).trigger('submit'); await settle(); }
async function read(r: Rig) { return expectFound(await r.zonesRepo.getById('zone-a' as never)); }

describe('native selected Room dimension editing', () => {
	it('treats retyped display text as exact numeric input and leaves the untouched axis precise', async () => {
		const original = [{ x: 1500.25, y: 1500.5 }, { x: 2734.65, y: 1500.5 }, { x: 2734.65, y: 3400.75 }, { x: 1500.25, y: 3400.75 }];
		const r = await rig(async ({ zones }) => {
			const before = expectFound(await zones.getById('zone-a' as never));
			expectOk(await zones.save(expectOk(before.entity.withGeometry({ points: original })), before.version));
		});
		onTestFinished(() => r.harness.unmount());
		const runtime = runtimeOf(r.harness);
		await open(r); await apply(r);
		expect(runtime.canUndo.value).toBe(false); expect((await read(r)).entity.geometry.points).toEqual(original);
		await open(r);
		await r.harness.wrapper.get(`${selector} input`).setValue('1.234');
		expect(runtime.renderState.previewPolygon?.[2]).toEqual({ x: 2734.25, y: 3400.75 });
		await apply(r);
		expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 2734.25, y: 3400.75 });
		await runtime.undo(); expect((await read(r)).entity.geometry.points).toEqual(original);
		expect(runtime.canUndo.value).toBe(false);
		await runtime.redo();
		await open(r); await r.harness.wrapper.get(`${selector} input`).setValue('1,2340'); await apply(r);
		await runtime.undo(); expect((await read(r)).entity.geometry.points).toEqual(original);
		expect(runtime.canUndo.value).toBe(false);
	});
	it('edits one scalar in Renovate, preserves raw comma text through viewport changes, and reverses exactly', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness), before = await read(r);
		useRenovationSession(r.harness.pinia).perspective = 'renovate';
		await open(r);
		const input = r.harness.wrapper.get(`${selector} input`);
		expect(document.activeElement).toBe(input.element);
		await input.setValue('4,200');
		const editor = useEditorStore(r.harness.pinia); editor.viewport = { pan: { x: -1000, y: 230 }, zoom: 0.07 }; await settle();
		expect(input.element).toHaveProperty('value', '4,200');
		expect((await read(r)).version).toEqual(before.version);
		expect(runtime.renderState.previewPolygon?.[2]).toEqual({ x: 5700, y: 3400 });
		await apply(r);
		await settleUntil(() => !r.harness.wrapper.find(selector).exists(), 'dimension saved');
		expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 5700, y: 3400 });
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(document.activeElement).toBe(r.harness.wrapper.get('[data-rp-dimension="width"]').element);
		expect(runtime.activeToolId.value).toBe('select');
		await r.harness.wrapper.get('[data-rp-action="undo"]').trigger('click'); await settle(); expect((await read(r)).entity.geometry).toEqual(before.entity.geometry);
		await r.harness.wrapper.get('[data-rp-action="redo"]').trigger('click'); await settle(); expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 5700, y: 3400 });
		r.harness.unmount();
	});
	it('keeps invalid text and native key ownership, and cancels without history', async () => {
		const r = await rig(); await open(r, 'depth');
		const input = r.harness.wrapper.get(`${selector} input`);
		await input.setValue('0'); await apply(r);
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(input.element);
		for (const detail of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...detail });
			input.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
			await input.trigger('keydown', { key: 'Escape', ...detail });
			expect(r.harness.wrapper.find(selector).exists()).toBe(true);
		}
		await input.trigger('keydown', { key: 'Escape' }); await settle();
		expect(r.harness.wrapper.find(selector).exists()).toBe(false);
		expect((await read(r)).entity.geometry.points).toEqual(ZONE_A_DTO.points);
		expect(runtimeOf(r.harness).canUndo.value).toBe(false); r.harness.unmount();
	});
	it('vetoes cancellation and every tool switch before mutating a pending save', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness); await open(r);
		await r.harness.wrapper.get(`${selector} input`).setValue('4.2');
		const save = r.zonesRepo.save.bind(r.zonesRepo); let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		const spy = vi.spyOn(r.zonesRepo, 'save').mockImplementation(async (...args) => { await wait; return save(...args); });
		await apply(r); runtime.cancelActiveTask(); runtime.setTool('draw-area'); runtime.setTool(null); runtime.toolManager.cancelGesture();
		await r.harness.wrapper.get(`${selector} input`).trigger('keydown', { key: 'Escape' });
		await r.harness.wrapper.get(`${selector} button[type="button"]`).trigger('click');
		await r.harness.wrapper.get('[data-rp-action="add"]').trigger('click');
		expect(r.harness.wrapper.find('.rp-add-menu').exists()).toBe(false);
		expect(r.harness.wrapper.get('[data-rp-action="select"]').attributes('aria-disabled')).toBe('true');
		await apply(r); await r.harness.wrapper.get(`${selector} input`).setValue('9');
		expect(runtime.activeToolId.value).toBe('edit-room-dimension');
		expect(runtime.toolManager.activeToolId).toBe('edit-room-dimension');
		expect(r.harness.wrapper.get(`${selector} input`).element).toHaveProperty('value', '4.2');
		expect(spy).toHaveBeenCalledTimes(1);
		release(); await settleUntil(() => runtime.activeToolId.value === 'select', 'pending save completed');
		expect(spy).toHaveBeenCalledTimes(1); r.harness.unmount();
	});
	it('retains a conflicted baseline and refuses replay after an external edit', async () => {
		const r = await rig(); await open(r); await r.harness.wrapper.get(`${selector} input`).setValue('4.2');
		const before = await read(r), changed = expectOk(before.entity.withGeometry({ points: ZONE_A_DTO.points.map(p => ({ x: p.x + 100, y: p.y })) }));
		expectOk(await r.zonesRepo.save(changed, before.version)); await apply(r);
		expect((await read(r)).entity.geometry).toEqual(changed.geometry);
		expect(r.harness.wrapper.get(`${selector} input`).element).toHaveProperty('value', '4.2');
		expect(r.harness.wrapper.get(`${selector} button[type="submit"]`).attributes('aria-disabled')).toBe('true');
		await apply(r); expect(runtimeOf(r.harness).canUndo.value).toBe(false); r.harness.unmount();
	});
	it('preserves text while keyboard selection changes and only abandons on an explicit new tool', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness); await open(r);
		await r.harness.wrapper.get(`${selector} input`).setValue('4,2');
		useSelectionStore(r.harness.pinia).clear(); await settle();
		await r.harness.wrapper.get('[data-rp-dimension="depth"]').trigger('click');
		expect(r.harness.wrapper.get(`${selector} input`).element).toHaveProperty('value', '4,2');
		expect(r.harness.wrapper.get(selector).text()).toContain('Selection changed');
		await apply(r); expect(runtime.canUndo.value).toBe(false);
		runtime.setTool('draw-area'); await settle();
		expect(r.harness.wrapper.find(selector).exists()).toBe(false);
		expect(runtime.activeToolId.value).toBe('draw-area');
		expect(runtime.renderState.previewPolygon).toBeNull(); r.harness.unmount();
	});
	it('keeps its scalar draft through canvas pointer gestures and cancels from canvas Escape', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness); await open(r);
		await r.harness.wrapper.get(`${selector} input`).setValue('4,2');
		const canvas = expectDefined(r.harness.canvasEl, 'canvas');
		pointer(canvas, 'pointerdown', 300, 250); pointer(canvas, 'pointermove', 350, 300); pointer(canvas, 'pointerup', 350, 300);
		pointer(canvas, 'pointerdown', 300, 250); pointer(canvas, 'pointercancel', 300, 250); await settle();
		expect(r.harness.wrapper.get(`${selector} input`).element).toHaveProperty('value', '4,2');
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(runtime.toolManager.activeToolHasDraft()).toBe(true);
		canvas.focus(); await r.harness.wrapper.get('.rp-plan-canvas').trigger('keydown', { key: 'Escape' }); await settle();
		expect(r.harness.wrapper.find(selector).exists()).toBe(false); expect(runtime.canUndo.value).toBe(false);
		expect(runtime.activeToolId.value).toBe('select'); r.harness.unmount();
	});
	it('offers no canvas editing in Review and closes an unchanged scalar without a write', async () => {
		const r = await rig(), runtime = runtimeOf(r.harness); await open(r); await apply(r);
		expect(runtime.canUndo.value).toBe(false);
		useRenovationSession(r.harness.pinia).perspective = 'review'; await settle();
		expect(r.harness.wrapper.find('[data-rp-dimension]').exists()).toBe(false);
		expect(r.harness.wrapper.find('[data-rp-canvas-edit]').exists()).toBe(false);
		await runtime.roomDimension.open('zone-a' as never, 'width');
		expect(runtime.activeToolId.value).toBe('select'); r.harness.unmount();
	});
});
