// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { SECTION_A } from '../../helpers/drafting';
import { registerEditorIcons } from '../../../src/plugin/editorIconRegistration';

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
	await item(rig, 'draft-grid').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'grid placed from the menu');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'grid' });
	expect(rig.runtime.activeToolId.value).toBe('place-grid');
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

it('flips a selected section line from its menu, and offers it no record creations', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await menu(rig);
	expect(has(rig, 'add-menu')).toBe(false);
	await item(rig, 'flip-section').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.[0].flipped === true, 'flipped from the menu');
});
