// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { editorWith, type EditorRig } from '../../../helpers/structural';
import { SECTION_A } from '../../../helpers/drafting';
import { expectOk } from '../../../helpers/domain';
import { settle, settleUntil } from '../../../helpers/editor';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import CanvasMenuList from '../../../../src/presentation/editor/selection/CanvasMenuList.vue';
import { isSubmenu } from '../../../../src/presentation/editor/selection/useCanvasMenuActions';
import type { ElementToolId } from '../../../../src/presentation/editor/elements/elementDraft';
import { pointerAt } from '../../../helpers/tool-context';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const tools: ElementToolId[] = ['draw-dimension', 'draw-section', 'place-view', 'draw-hatch', 'place-text', 'draw-boundary', 'place-grid'];
async function menu(rig: EditorRig) {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
	await settle();
	return rig.wrapper.getComponent(CanvasMenuList).props('items').flatMap(item => isSubmenu(item) ? item.children : [item]);
}

it('refuses every captured drafting entry and runtime start outside Plan, preserving selection, camera and history', async () => {
	const rig = await editorWith(mounted, SECTION_A), editor = useEditorStore(rig.pinia);
	rig.selection.select([SECTION_A.id as never]);
	const actions = (await menu(rig)).filter(item => item.id.startsWith('draft-'));
	expect(actions).toHaveLength(7);
	const before = expectOk(await rig.geometry.read(rig.plan.id)), camera = { ...editor.viewport };
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.get('[data-rp-context-action="drafting-menu"]').attributes('aria-disabled')).toBe('true');
	expect(rig.wrapper.get('[data-rp-context-action="drafting-menu"]').attributes('title')).toBe('Edit geometry in plan');
	for (const mode of ['renovate', 'review'] as const) {
		await rig.runtime.renovation.perspective(mode); await settle();
		for (const action of actions) await action.run();
		for (const tool of tools) {
			await rig.runtime.elementTask.startAt(tool, { x: 1000, y: 1000 });
			expect(rig.runtime.activeToolId.value).toBe('select');
		}
		await rig.runtime.elementActions.flip(SECTION_A.id);
		expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
		expect(rig.selection.selectedIds).toEqual([SECTION_A.id]);
		expect(editor.viewport).toEqual(camera);
		expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	}
	await rig.runtime.renovation.perspective('plan');
	await rig.runtime.elementTask.startAt('draw-section', { x: 1000, y: 1000 });
	expect(rig.runtime.elementTask.draft.points).toEqual([{ x: 1000, y: 1000 }]);
});

it.each(['draw-section', 'draw-hatch'] as const)('cancels a %s gesture on mode handoff without a late save or camera jump', async tool => {
	const rig = await editorWith(mounted), editor = useEditorStore(rig.pinia);
	const before = expectOk(await rig.geometry.read(rig.plan.id)), camera = { ...editor.viewport };
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'draft baseline');
	rig.runtime.toolManager.pointerDown(pointerAt(5000, 5000));
	rig.runtime.toolManager.pointerMove(pointerAt(7000, 7000));
	const handoff = rig.runtime.renovation.perspective('renovate');
	rig.dialogs.resolve('confirm'); await handoff;
	expect(rig.runtime.toolManager.activeToolTracksPointer()).toBe(false);
	await rig.runtime.renovation.perspective('plan');
	rig.runtime.toolManager.pointerUp(pointerAt(8000, 8000));
	await rig.runtime.elementTask.finish(); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect(editor.viewport).toEqual(camera);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
});

it('keeps a hovered submenu open for the first pointer click, then lets a second click close it', async () => {
	const rig = await editorWith(mounted);
	await menu(rig);
	const parent = rig.wrapper.get('[data-rp-context-action="drafting-menu"]');
	await parent.trigger('pointerenter'); await parent.trigger('click'); await settle();
	expect(rig.wrapper.find('[data-rp-context-action="draft-hatch"]').exists()).toBe(true);
	await parent.trigger('click'); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested').exists()).toBe(false);
});

it('keeps drafting marks out of single and bulk renovation records, including remembered Room context and direct runtime calls', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]);
	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.find('.rp-renovation-overview-actions').exists()).toBe(false);
	expect(rig.wrapper.find('[data-rp-action="add-work"]').exists()).toBe(false);
	expect(rig.runtime.renovation.canAddWork('')).toBe(false);
	expect(rig.runtime.renovation.canAddWork(rig.room.id)).toBe(false);
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	await rig.runtime.renovation.addWork(rig.room.id);
	await rig.runtime.renovation.edit('work', rig.room.id);
	const targets = [SECTION_A.id, 'wall-a'].map(targetId => ({ targetId, roomId: rig.room.id, name: targetId, kind: 'other' as const }));
	await rig.runtime.renovation.batch('work', targets);
	expect(rig.dialogs.current).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	rig.selection.select([rig.room.id, SECTION_A.id] as never[]); await settle();
	await rig.wrapper.get('.rp-batch-actions select').setValue(rig.room.id);
	for (const kind of ['work', 'evidence', 'remove', 'modify']) expect(rig.wrapper.get(`[data-rp-batch="${kind}"]`).attributes('disabled')).toBeDefined();
});
