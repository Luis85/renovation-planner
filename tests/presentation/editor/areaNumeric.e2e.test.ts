// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rig, click, PLAN_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { installObsidianDom } from '../../helpers/dom';
import { err, ok } from '../../../src/core/result/Result';
installObsidianDom();
beforeEach(() => { activateNotices(); });

type Rig = Awaited<ReturnType<typeof rig>>;
async function start(h: Rig['harness']): Promise<void> {
	await h.wrapper.get('[data-rp-action="add"]').trigger('click');
	await h.wrapper.get('[data-rp-entry="area"]').trigger('click');
	(h.wrapper.get('.rp-area-corners details').element as HTMLDetailsElement).open = true;
	await settle();
}
async function type(h: Rig['harness'], x: string, y: string): Promise<void> {
	await h.wrapper.get('input[name="x"]').setValue(x);
	await h.wrapper.get('input[name="y"]').setValue(y);
}
async function add(h: Rig['harness'], x: string, y: string): Promise<void> {
	await type(h, x, y);
	await h.wrapper.get('input[name="y"]').trigger('keydown', { key: 'Enter' });
	await settle();
}
const list = async (r: Rig) => expectOk(await r.zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
const points = (r: Rig) => runtimeOf(r.harness).renderState.polygonSketch?.vertices ?? [];

describe('Area coordinate entry through the mounted editor and real command history', () => {
	it('creates and corrects a signed outline without a pointer, then Undo/Redo restores the same Area', async () => {
		const r = await rig();
		const h = r.harness;
		const runtime = runtimeOf(h);
		await start(h);
		await add(h, '-1,0004', '0');
		await add(h, '4.2', '0');
		await add(h, '4.2', '0.0004'); // rounds onto the previous corner: refused
		expect(points(r)).toHaveLength(2);
		expect(h.wrapper.get('[role="alert"]').text()).toContain('already has this position');
		await type(h, '4.2', '3');
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click');
		await h.wrapper.findAll('[data-rp-corner="edit"]')[1]?.trigger('click');
		expect(document.activeElement).toBe(h.wrapper.get('input[name="x"]').element);
		await type(h, '5', '0');
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click');
		await add(h, '-1', '3');
		await h.wrapper.findAll('[data-rp-corner="remove"]')[2]?.trigger('click');
		expect(document.activeElement).toBe(h.wrapper.get('input[name="x"]').element);
		expect(points(r)).toEqual([{ x: -1000, y: 0 }, { x: 5000, y: 0 }, { x: -1000, y: 3000 }]);
		expect(await list(r)).toHaveLength(1);
		expect(runtime.canUndo.value).toBe(false);
		const finish = h.wrapper.get('.rp-task-banner__finish');
		(finish.element as HTMLElement).focus();
		await finish.trigger('click');
		await settleUntil(() => runtime.activeToolId.value === 'select', 'numeric Area completion');
		const created = (await list(r))[1]?.entity;
		if (created === undefined) throw new Error('Expected a created Area');
		expect(created.zoneType).toBe('Custom');
		expect(created.geometry.points).toEqual([{ x: -1000, y: 0 }, { x: 5000, y: 0 }, { x: -1000, y: 3000 }]);
		expect(useSelectionStore(h.pinia).selectedIds).toEqual([created.id]);
		expect(document.activeElement).toBe(h.canvasEl);
		await runtime.undo();
		expect(await list(r)).toHaveLength(1);
		await runtime.redo();
		expect((await list(r))[1]?.entity.geometry).toEqual(created.geometry);
		h.unmount();
	});

	it('keeps bad input local, describes both fields, and prevents every completion while input is pending', async () => {
		const r = await rig();
		const h = r.harness;
		await start(h);
		for (const [x, y] of [['0', '0'], ['4', '0'], ['4', '3']]) await add(h, x as string, y as string);
		await type(h, '1e3', '9999999999999999999999999');
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click');
		expect(h.wrapper.findAll('input[aria-invalid="true"]')).toHaveLength(2);
		expect(h.wrapper.text()).toContain('too large');
		expect(document.activeElement).toBe(h.wrapper.get('input[name="x"]').element);
		await h.wrapper.get('.rp-task-banner__finish').trigger('click');
		await h.wrapper.get('.rp-plan-canvas').trigger('keydown', { key: 'Enter' });
		click(h.canvasEl as HTMLElement, 48, 48); // first corner in screen coordinates
		await h.wrapper.findAll('[data-rp-corner="edit"]')[0]?.trigger('click');
		await h.wrapper.findAll('[data-rp-corner="remove"]')[0]?.trigger('click');
		await settle();
		expect(points(r)).toHaveLength(3);
		expect(await list(r)).toHaveLength(1);
		await h.wrapper.get('[data-rp-corner="reset"]').trigger('click');
		expect(h.wrapper.findAll('input[aria-invalid="true"]')).toHaveLength(0);
		expect(runtimeOf(h).canFinishArea.value).toBe(true);
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click'); // An attempted blank pair is still invalid input.
		expect(runtimeOf(h).canFinishArea.value).toBe(false);
		await h.wrapper.get('[data-rp-corner="reset"]').trigger('click');
		h.unmount();
	});

	it('shares mouse points with numeric edits, rejects a flat outline and preserves native field keys', async () => {
		const r = await rig();
		const h = r.harness;
		const runtime = runtimeOf(h);
		await start(h);
		click(h.canvasEl as HTMLElement, 100, 200);
		await add(h, '4.52', '1.52');
		await add(h, '6', '1.52');
		expect(runtime.canFinishArea.value).toBe(false);
		await h.wrapper.findAll('[data-rp-corner="edit"]')[0]?.trigger('click');
		expect(runtime.areaCorners.text).toEqual({ x: '0.52', y: '1.52' });
		const before = JSON.stringify(points(r));
		for (const key of ['Escape', 'Delete', 'Backspace', ' ', '+', '-']) {
			await h.wrapper.get('input[name="x"]').trigger('keydown', { key });
		}
		for (const extra of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...extra });
			h.wrapper.get('input[name="y"]').element.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(extra.repeat === true); // Native IME/chords retain their default.
		}
		expect(JSON.stringify(points(r))).toBe(before);
		expect(runtime.areaCorners.pending.value).toBe(true);
		await type(h, '0.52', '4');
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click');
		expect(runtime.canFinishArea.value).toBe(true);
		expect(points(r)[0]).toEqual({ x: 520, y: 4000 });
		expect(await list(r)).toHaveLength(1);
		h.unmount();
	});

	it('refuses canvas Enter and first-corner close while another editor command is saving', async () => {
		const r = await rig();
		const h = r.harness;
		const runtime = runtimeOf(h);
		await start(h);
		await add(h, '0', '0'); await add(h, '4', '0'); await add(h, '4', '3');
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const saving = runtime.dispatcher.run({ execute: async () => { await gate; return ok('wrote'); }, undo: () => Promise.resolve(ok('wrote')) });
		await settle();
		expect(runtime.canFinishArea.value).toBe(false);
		await h.wrapper.get('.rp-plan-canvas').trigger('keydown', { key: 'Enter' });
		click(h.canvasEl as HTMLElement, 48, 48);
		await h.wrapper.get('.rp-task-banner__finish').trigger('click');
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('click');
		release(); await saving; await settle();
		expect(await list(r)).toHaveLength(1);
		expect(points(r)).toHaveLength(3);
		expect(runtime.activeToolId.value).toBe('draw-area');
		useProjectStore(h.pinia).stale = true;
		expect(runtime.areaCorners.editable.value).toBe(false);
		h.unmount();
	});

	it('retains a refused outline, repeats explicitly and resets input on draft Escape and task cancellation', async () => {
		const r = await rig();
		const h = r.harness;
		const runtime = runtimeOf(h);
		await start(h);
		await add(h, '0', '0'); await add(h, '4', '0'); await add(h, '4', '3');
		vi.spyOn(r.zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		await h.wrapper.get('.rp-task-banner__finish').trigger('click');
		await settleUntil(() => h.wrapper.find('.rp-save-state-save-error').exists(), 'refused Area');
		expect(points(r)).toHaveLength(3);
		await h.wrapper.get('.rp-task-banner__repeat input').setValue(true);
		await h.wrapper.get('.rp-task-banner__finish').trigger('click');
		await settleUntil(() => runtime.renderState.polygonSketch === null, 'repeated completion');
		expect(runtime.activeToolId.value).toBe('draw-area');
		await add(h, '0', '0'); await type(h, 'unfinished', '');
		await h.wrapper.get('[data-rp-action="add"]').trigger('click');
		await h.wrapper.get('input[name="x"]').trigger('keydown', { key: 'Escape' });
		expect(runtime.areaCorners.pending.value).toBe(true);
		expect(points(r)).toHaveLength(1);
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('keydown', { key: 'Escape' });
		expect(points(r)).toHaveLength(0);
		expect(runtime.areaCorners.pending.value).toBe(false);
		await h.wrapper.get('[data-rp-corner="apply"]').trigger('keydown', { key: 'Escape', repeat: true });
		expect(runtime.activeToolId.value).toBe('draw-area');
		await type(h, '2', '3'); // no applied corner, but leaving the empty tool still retires input
		await h.wrapper.get('.rp-task-banner__cancel').trigger('click');
		await start(h);
		expect(runtime.areaCorners.text).toEqual({ x: '', y: '' });
		expect(runtime.keepAddingAreas.value).toBe(false);
		h.unmount();
	});
});
