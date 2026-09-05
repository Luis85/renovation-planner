// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rig, click, pointer, PLAN_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
installObsidianDom();
import { err } from '../../../src/core/result/Result';

beforeEach(() => { activateNotices(); });
type Harness = Awaited<ReturnType<typeof rig>>['harness'];
type Repo = Awaited<ReturnType<typeof rig>>['zonesRepo'];
const list = async (repo: Repo) => expectOk(await repo.listByPlan(PLAN_DTO.id as never)).loaded;

async function start(harness: Harness): Promise<void> {
	await harness.wrapper.find('[data-rp-action="add"]').trigger('click');
	await harness.wrapper.find('[data-rp-entry="area"]').trigger('click');
	await settle();
}

function outline(harness: Harness): void {
	for (const [x, y] of [[100, 200], [500, 200], [500, 450], [100, 450]]) click(harness.canvasEl as HTMLElement, x, y);
}

function key(target: Element, value: string, extra: KeyboardEventInit = {}): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra }));
}

describe('M02 Area through the real catalogue, tools, commands and repositories', () => {
	it.each(['target', 'Enter', 'Finish'])('%s completes one Area, then Undo/Redo preserves its identity and geometry', async (door) => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		const setTool = vi.spyOn(runtime, 'setTool');
		await start(harness);
		expect(setTool).toHaveBeenCalledExactlyOnceWith('draw-area');
		expect(runtime.keepAddingAreas.value).toBe(false);
		expect(await list(zonesRepo)).toHaveLength(1);
		expect(runtime.canUndo.value).toBe(false);
		expect(harness.wrapper.find('.rp-task-banner').text()).toContain('Adding an area');
		expect(harness.wrapper.find('.rp-task-banner__finish').text()).toBe('Create area');
		outline(harness);
		await settle();
		if (door === 'target') click(harness.canvasEl as HTMLElement, 100, 200);
		else if (door === 'Enter') key(harness.canvasEl as HTMLElement, 'Enter');
		else {
			const button = harness.wrapper.find('.rp-task-banner__finish');
			(button.element as HTMLElement).focus();
			await button.trigger('click');
		}
		await settleUntil(() => runtime.activeToolId.value === 'select', 'Area completion');
		const created = (await list(zonesRepo)).find((entry) => entry.entity.id !== 'zone-a')?.entity;
		if (created === undefined) throw new Error('Expected a persisted Area');
		expect(created.zoneType).toBe('Custom');
		expect(created.name).toBe('Area 2');
		expect(created.geometry.points).toEqual([
			{ x: 520, y: 1520 }, { x: 4520, y: 1520 }, { x: 4520, y: 4020 }, { x: 520, y: 4020 },
		]);
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([created.id]);
		expect(harness.wrapper.find('.rp-room-inspector').text()).toContain('Other');
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
		expect(document.activeElement).toBe(harness.canvasEl);
		await runtime.undo();
		expect(await list(zonesRepo)).toHaveLength(1);
		await runtime.redo();
		const restored = expectOk(await zonesRepo.getById(created.id))?.entity;
		if (restored === undefined) throw new Error('Expected the restored Area');
		expect(restored.geometry).toEqual(created.geometry);
		expect(restored.zoneType).toBe('Custom');
		expect(runtime.activeToolId.value).toBe('select');
		harness.unmount();
	});

	it('repeats only while explicitly checked and resets that choice on the next activation', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		await start(harness);
		await harness.wrapper.find('.rp-task-banner__repeat input').setValue(true);
		outline(harness);
		key(harness.canvasEl as HTMLElement, 'Enter');
		await settleUntil(async () => (await list(zonesRepo)).length === 2, 'first repeated Area');
		await settle();
		expect(runtime.activeToolId.value).toBe('draw-area');
		expect(runtime.renderState.polygonSketch).toBeNull();
		expect(runtime.keepAddingAreas.value).toBe(true);
		await harness.wrapper.find('.rp-task-banner__repeat input').setValue(false);
		outline(harness);
		click(harness.canvasEl as HTMLElement, 100, 200);
		await settleUntil(() => runtime.activeToolId.value === 'select', 'second Area and Select');
		expect((await list(zonesRepo)).map((entry) => entry.entity.name)).toEqual(['Kitchen', 'Area 2', 'Area 3']);
		await start(harness);
		expect(runtime.keepAddingAreas.value).toBe(false);
		await harness.wrapper.find('.rp-task-banner__repeat input').setValue(true);
		await harness.wrapper.find('.rp-task-banner__cancel').trigger('click');
		await start(harness);
		expect(runtime.keepAddingAreas.value).toBe(false);
		harness.unmount();
	});

	it('invalid geometry and a refused write retain the outline without adding history', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		await start(harness);
		await harness.wrapper.find('.rp-task-banner__finish').trigger('click');
		key(harness.canvasEl as HTMLElement, 'Enter'); // too few points
		for (const x of [100, 300, 500]) click(harness.canvasEl as HTMLElement, x, 200);
		key(harness.canvasEl as HTMLElement, 'Enter'); // collinear
		await settle();
		expect(runtime.canFinishArea.value).toBe(false);
		expect(runtime.toolManager.activeToolHasDraft()).toBe(true);
		expect(runtime.canUndo.value).toBe(false);
		expect(await list(zonesRepo)).toHaveLength(1);
		click(harness.canvasEl as HTMLElement, 500, 450);
		vi.spyOn(zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		key(harness.canvasEl as HTMLElement, 'Enter');
		await settleUntil(() => harness.wrapper.find('.rp-save-state-label').classes().includes('rp-save-state-save-error'), 'save refusal');
		expect(runtime.activeToolId.value).toBe('draw-area');
		expect(runtime.canUndo.value).toBe(false);
		expect(await list(zonesRepo)).toHaveLength(1);
		key(harness.canvasEl as HTMLElement, 'Enter');
		await settleUntil(() => runtime.activeToolId.value === 'select', 'retry the retained outline');
		expect(await list(zonesRepo)).toHaveLength(2);
		harness.unmount();
	});

	it('a busy completion writes once; cancelling and starting Room prevents late task/selection changes', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		const save = zonesRepo.save.bind(zonesRepo);
		let release!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const saved = vi.spyOn(zonesRepo, 'save').mockImplementationOnce(async (...args) => { await gate; return save(...args); });
		await start(harness);
		outline(harness);
		key(harness.canvasEl as HTMLElement, 'Enter');
		await settleUntil(() => saved.mock.calls.length === 1, 'pending write');
		expect(runtime.canFinishArea.value).toBe(false);
		key(harness.canvasEl as HTMLElement, 'Enter');
		click(harness.canvasEl as HTMLElement, 100, 200);
		runtime.finishArea();
		await harness.wrapper.find('.rp-task-banner__cancel').trigger('click');
		runtime.setTool('draw-room');
		runtime.roomDraft.setRect({ x: 0, y: 0, width: 2000, depth: 2000 });
		release();
		await settleUntil(async () => (await list(zonesRepo)).length === 2, 'already submitted write');
		await settle();
		expect(saved).toHaveBeenCalledTimes(1);
		expect(runtime.activeToolId.value).toBe('draw-room');
		expect(runtime.roomDraft.rect?.width).toBe(2000);
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([]);
		harness.unmount();
	});

	it('Escape from a banner steps through draft, tool and single list selection; Add closes first', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		const row = harness.wrapper.find('.rp-editor-layers .rp-room-list__row');
		await row.trigger('click');
		await start(harness);
		outline(harness);
		await harness.wrapper.find('[data-rp-action="add"]').trigger('click');
		key(harness.canvasEl as HTMLElement, 'Escape');
		await settle();
		expect(harness.wrapper.find('.rp-add-menu').exists()).toBe(false);
		expect(runtime.toolManager.activeToolHasDraft()).toBe(true);
		const repeat = harness.wrapper.find('.rp-task-banner__repeat input').element;
		key(repeat, 'Escape');
		await settle();
		expect(runtime.toolManager.activeToolHasDraft()).toBe(false);
		expect(runtime.activeToolId.value).toBe('draw-area');
		key(repeat, 'Escape', { repeat: true });
		expect(runtime.activeToolId.value).toBe('draw-area');
		key(repeat, 'Escape');
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-a']);
		(row.element as HTMLElement).focus();
		key(row.element, 'Escape');
		await settle();
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([]);
		expect(document.activeElement).toBe(row.element);
		const idleEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		row.element.dispatchEvent(idleEscape);
		expect(idleEscape.defaultPrevented).toBe(false); // Nothing remains for this editor to dismiss.
		expect(document.activeElement).toBe(row.element);
		expect(await list(zonesRepo)).toHaveLength(1);
		harness.unmount();
	});

	it('native fields, checkbox activation, held Enter and a running pan cannot finish or move the canvas', async () => {
		const { harness, zonesRepo } = await rig();
		await harness.wrapper.find('.rp-room-list__row').trigger('click');
		await start(harness);
		outline(harness);
		await settle();
		const runtime = runtimeOf(harness);
		const editor = useEditorStore(harness.pinia);
		const viewport = { ...editor.viewport };
		const sketch = JSON.stringify(runtime.renderState.polygonSketch?.vertices);
		for (const selector of ['.rp-room-inspector select', '.rp-task-banner__repeat input']) {
			const field = harness.wrapper.find(selector).element;
			for (const value of ['Enter', 'Delete', 'Backspace', ' ', '+', '-']) key(field, value);
		}
		key(harness.wrapper.find('.rp-room-inspector select').element, 'Escape');
		// A future text/number form inside the overlay must inherit the same native-field boundary.
		for (const tag of ['input', 'textarea', 'div']) {
			const field = document.createElement(tag);
			field.setAttribute('contenteditable', tag === 'div' ? 'true' : 'false');
			harness.wrapper.find('.rp-plan-overlay').element.append(field);
			for (const value of ['Enter', 'Escape', 'Delete', ' ', '+', '-']) key(field, value);
			field.remove();
		}
		key(harness.canvasEl as HTMLElement, 'Enter', { repeat: true });
		key(harness.canvasEl as HTMLElement, 'Enter', { isComposing: true });
		key(harness.canvasEl as HTMLElement, 'Enter', { ctrlKey: true });
		key(harness.canvasEl as HTMLElement, 'Enter', { metaKey: true });
		key(harness.canvasEl as HTMLElement, 'Enter', { altKey: true });
		pointer(harness.canvasEl as HTMLElement, 'pointerdown', 600, 300, 1);
		key(harness.canvasEl as HTMLElement, 'Enter');
		pointer(harness.canvasEl as HTMLElement, 'pointerup', 600, 300, 1);
		await settle();
		expect(await list(zonesRepo)).toHaveLength(1);
		expect(editor.viewport).toEqual(viewport);
		expect(JSON.stringify(runtime.renderState.polygonSketch?.vertices)).toBe(sketch);
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-a']);
		// Stale projection refuses both the button facade and the keyboard's dispatcher path.
		useProjectStore(harness.pinia).stale = true;
		expect(runtime.canFinishArea.value).toBe(false);
		runtime.finishArea();
		key(harness.canvasEl as HTMLElement, 'Enter');
		await settle();
		expect(await list(zonesRepo)).toHaveLength(1);
		expect(runtime.toolManager.activeToolHasDraft()).toBe(true);
		harness.unmount();
	});
});
