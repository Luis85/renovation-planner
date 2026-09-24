// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { BOUNDARY_A, DRAFTING_MARKS, GRID_A, HATCH_A, SECTION_A, TEXT_A, VIEW_A } from '../../helpers/drafting';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: EditorRig[] = [];
let unregister: () => void;
beforeEach(() => { unregister = registerEditorIcons(); });
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); unregister(); });

async function menu(rig: EditorRig): Promise<void> { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
async function close(rig: EditorRig): Promise<void> { await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' }); await settle(); }
const item = (rig: EditorRig, id: string) => rig.wrapper.get(`[data-rp-context-action="${id}"]`);
const has = (rig: EditorRig, id: string) => rig.wrapper.find(`[data-rp-context-action="${id}"]`).exists();

it('offers every drafting tool from the empty canvas with a known icon, and starts the chosen one at the menu\'s point', async () => {
	const rig = await editorWith(mounted);
	rig.selection.clear(); await menu(rig);
	await item(rig, 'drafting-menu').trigger('click'); await settle();
	expect(rig.wrapper.findAll('.rp-canvas-context-menu--nested [data-rp-context-action]').map(entry => entry.attributes('data-rp-context-action')))
		.toEqual(['draft-dimension', 'draft-section', 'draft-view', 'draft-hatch', 'draft-text', 'draft-boundary', 'draft-grid']);
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested [data-icon-missing]').exists()).toBe(false);
	const stored = () => ({ elements: rig.project.structure.elements ?? [], metadata: rig.project.plan?.spatialElements ?? [] }), before = stored();
	await item(rig, 'draft-grid').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'grid placed from the menu');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'grid' });
	expect(rig.runtime.activeToolId.value).toBe('place-grid');
	// Creation is one history step: `runtime.undo()` leaves exactly what was stored before it, `runtime.redo()` exactly what it saved.
	const created = stored();
	await rig.runtime.undo(); await settle();
	expect(stored()).toEqual(before);
	await rig.runtime.redo(); await settle();
	expect(stored()).toEqual(created);
});

it('offers the Drafting submenu with one item and with several selected, but not in Review', async () => {
	const rig = await editorWith(mounted);
	rig.selection.select(['wall-a' as never]); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(true); expect(has(rig, 'add-menu')).toBe(true);
	await close(rig);
	rig.selection.select(['wall-a', 'wall-b'] as never[]); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(true);
	await close(rig);
	await rig.runtime.renovation.perspective('review'); rig.selection.clear(); await menu(rig);
	expect(has(rig, 'drafting-menu')).toBe(false);
});

it('greys the Drafting submenu with its reason while the floor is stale', async () => {
	const rig = await editorWith(mounted);
	rig.project.stale = true; rig.selection.clear(); await menu(rig);
	expect(item(rig, 'drafting-menu').attributes('aria-disabled')).toBe('true');
	expect(item(rig, 'drafting-menu').attributes('title')).toBe('Editing is paused until the floor is re-read.');
});

it('right-clicks a section line a few pixels off its line and offers its Delete', async () => {
	const rig = await editorWith(mounted, SECTION_A), editorStore = useEditorStore(rig.pinia);
	rig.selection.clear(); await settle();
	const at = worldToScreen({ x: 3000, y: 2000 }, editorStore.viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + at.x, clientY: box.top + at.y + 3 }));
	await settle();
	expect(rig.selection.selectedIds).toEqual([SECTION_A.id]);
	expect(item(rig, 'delete').attributes('aria-disabled')).not.toBe('true');
});

it('flips a selected section line from its menu, and offers it no record creations', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await menu(rig);
	expect(has(rig, 'add-menu')).toBe(false);
	await item(rig, 'flip-section').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0].flipped === true, 'flipped from the menu');
	await rig.runtime.renovation.perspective('renovate'); rig.selection.select([SECTION_A.id as never]); await menu(rig);
	expect(has(rig, 'flip-section')).toBe(false);
});

// One param per kind, so a Hatch failure cannot hide a Boundary one. Door: the context menu's Delete over the one selected mark, answered on its confirm.
it.each([VIEW_A, HATCH_A, TEXT_A, BOUNDARY_A, GRID_A].map(mark => [mark.kind, mark] as const))('deletes a %s mark from its context menu on confirm, and leaves every other mark and label as it was', async (_kind, mark) => {
	const rig = await editorWith(mounted, ...DRAFTING_MARKS);
	const stored = () => ({ elements: rig.project.structure.elements ?? [], metadata: rig.project.plan?.spatialElements ?? [] }), before = stored();
	rig.selection.select([mark.id as never]); await menu(rig);
	await item(rig, 'delete').trigger('click');
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', `${mark.kind} delete confirmation`);
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
	await settleUntil(() => rig.dialogs.current === null && !rig.runtime.elementActions.active.value, `${mark.kind} delete finished`); await settle();
	const after = stored();
	expect(after.elements.map(entry => entry.id)).not.toContain(mark.id);
	expect(after.metadata.map(entry => entry.id)).not.toContain(mark.id);
	expect(after).toEqual({ elements: before.elements.filter(entry => entry.id !== mark.id), metadata: before.metadata.filter(entry => entry.id !== mark.id) });
});
