// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { expectOk } from '../../helpers/domain';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
function key(target: Element, name: string, extra: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra }); target.dispatchEvent(event); return event;
}
function context(target: Element) { const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; }
async function open(rig: Awaited<ReturnType<typeof setup>>, target: Element = rig.canvasEl) { key(target, 'ContextMenu'); await settle(); return rig.wrapper.get('.rp-canvas-context-menu'); }

it('changes pointer context from a selected Room to empty canvas and back without changing geometry', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), bytes = [...rig.stack.vault.entries];
	editor.fitTo({ min: { x: -1000, y: -1000 }, max: { x: 5000, y: 4000 } }, editor.stageSize);
	for (const [point, ids, action] of [[{ x: -500, y: -500 }, [], 'add'], [{ x: 1000, y: 1000 }, [rig.room.id], 'rename']] as const) {
		const at = worldToScreen(point, editor.viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
		rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + at.x, clientY: box.top + at.y })); await settle();
		expect(rig.selection.selectedIds).toEqual(ids); expect(rig.wrapper.find(`[data-rp-context-action="${action}"]`).exists()).toBe(true);
	}
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('navigates and wraps every menu item, leaves unrelated keys alone, and restores the keyboard opener on Tab', async () => {
	const rig = await setup(), opener = rig.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	opener.focus(); const menu = await open(rig, opener), items = menu.findAll('[role="menuitem"]');
	expect(document.activeElement).toBe(items[0].element);
	expect(key(document.activeElement as Element, 'a').defaultPrevented).toBe(false);
	key(menu.element, 'End'); expect(document.activeElement).toBe(items.at(-1)?.element);
	key(menu.element, 'ArrowDown'); expect(document.activeElement).toBe(items[0].element);
	key(menu.element, 'ArrowUp'); expect(document.activeElement).toBe(items.at(-1)?.element);
	// With focus OUTSIDE the items, ↑ lands on the last entry (not the one before it) and ↓ on the first.
	(document.activeElement as HTMLElement).blur();
	key(menu.element, 'ArrowUp'); expect(document.activeElement).toBe(items.at(-1)?.element);
	(document.activeElement as HTMLElement).blur();
	key(menu.element, 'ArrowDown'); expect(document.activeElement).toBe(items[0].element);
	key(menu.element, 'Home'); expect(document.activeElement).toBe(items[0].element);
	key(menu.element, 'ArrowDown'); expect(document.activeElement).toBe(items[1].element);
	expect(key(menu.element, 'Tab').defaultPrevented).toBe(true); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false); expect(document.activeElement).toBe(opener);
});

it('keeps an in-menu press local and dismisses on outside presses or focus leaving the editor', async () => {
	const rig = await setup(), outside = document.createElement('button'); document.body.append(outside);
	try {
		const menu = await open(rig), item = menu.get('[role="menuitem"]');
		await item.trigger('pointerdown'); await item.trigger('pointerup'); await settle();
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(true);
		rig.rootEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: rig.canvasEl })); await settle();
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(true);
		outside.focus(); await settle();
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false); expect(document.activeElement).toBe(outside);
		await open(rig); rig.rootEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await settle();
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
		await open(rig); rig.rootEl.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null })); await settle();
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	} finally { outside.remove(); }
});

it('refuses native text/control context menus and active drawing or drag input without changing the vault', async () => {
	const rig = await setup(), before = [...rig.stack.vault.entries];
	const input = document.createElement('input'), editable = document.createElement('div'); editable.setAttribute('contenteditable', 'true');
	rig.rootEl.append(input, editable);
	try {
		expect(context(input).defaultPrevented).toBe(false); expect(context(editable).defaultPrevented).toBe(false);
		expect(context(rig.wrapper.get('[data-rp-action="select"]').element).defaultPrevented).toBe(false);
		rig.runtime.setTool('draw-path'); await settle(); expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false);
		// Camera mode — no active tool at all — is neither 'select' nor 'pan' either, and it is
		// the one state where `activeToolId.value` is genuinely `null` rather than some other
		// tool's id.
		rig.runtime.setTool(null); await settle(); expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false);
		rig.runtime.setTool('select'); rig.runtime.toolManager.pointerDown(pointerAt(-10000, -10000));
		expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false); rig.runtime.toolManager.cancelGesture();
		await rig.wrapper.get('[data-rp-action="pan"]').trigger('click');
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: 100, clientY: 100 }));
		expect(useEditorStore(rig.pinia).dragState).not.toBeNull(); expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false);
		rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0, buttons: 0, clientX: 100, clientY: 100 }));
		await rig.wrapper.get('[data-rp-action="add"]').trigger('click'); await settle();
		expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false);
		expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false); expect([...rig.stack.vault.entries]).toEqual(before);
	} finally { input.remove(); editable.remove(); }
});

it('keeps a paused action inert, then retires a popup whose selection changes', async () => {
	const rig = await setup(), before = [...rig.stack.vault.entries], remove = vi.spyOn(rig.runtime, 'deleteZone');
	rig.project.stale = true; await open(rig);
	const action = rig.wrapper.get('[data-rp-context-action="delete"]'); expect(action.attributes('aria-disabled')).toBe('true');
	await action.trigger('click'); expect(remove).not.toHaveBeenCalled(); expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(true);
	rig.selection.select([...rig.selection.selectedIds]); await settle(); expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(true);
	rig.selection.select(['wall-a' as never]); await settle(); expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	await open(rig); rig.selection.clear(); await settle(); expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('a dialog opened before menu paint owns focus and suppresses later context events', async () => {
	const rig = await setup(); key(rig.canvasEl, 'ContextMenu');
	const pending = rig.dialogs.openDialog({ kind: 'confirm', title: 'Keep this decision', message: 'Dialog owns the interaction' }); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	expect(rig.wrapper.get('.rp-dialog').element.contains(document.activeElement)).toBe(true);
	expect(key(rig.canvasEl, 'ContextMenu').defaultPrevented).toBe(false);
	rig.dialogs.resolve('cancel'); await pending;
});

it('targets the unlocked zone beneath a locked one, and offers no zone target over the locked zone alone (Z3, spec §3.10 row 2)', async () => {
	const rig = await setup();
	const under = expectOk(await rig.deps.commands.createZone.execute({
		planId: rig.plan.id, name: 'Nook', zoneType: 'Room',
		geometry: { points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1500 }, { x: 500, y: 1500 }] },
	})).zone.entity;
	await rig.runtime.refreshProjection();
	await rig.wrapper.get(`[data-rp-lock="${rig.room.id}"]`).trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.locked === true, 'room locked');

	const editor = useEditorStore(rig.pinia);
	editor.fitTo({ min: { x: -1000, y: -1000 }, max: { x: 5000, y: 4000 } }, editor.stageSize);
	const box = rig.canvasEl.getBoundingClientRect();

	// (1000, 1000) sits inside both the locked room (0,0)-(4000,3000) and the unlocked Nook
	// (500,500)-(1500,1500): the click-through case.
	const overlap = worldToScreen({ x: 1000, y: 1000 }, editor.viewport, STAGE_PIXELS);
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + overlap.x, clientY: box.top + overlap.y }));
	await settle();
	expect(rig.selection.selectedIds).toEqual([under.id]);
	expect(rig.wrapper.get('.rp-canvas-context-menu-title').text()).toBe('Nook');
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });

	// (3000, 2500) sits inside the locked room only — nothing else there to click through to.
	rig.selection.select([under.id]);
	await settle();
	const lockedOnly = worldToScreen({ x: 3000, y: 2500 }, editor.viewport, STAGE_PIXELS);
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + lockedOnly.x, clientY: box.top + lockedOnly.y }));
	await settle();
	expect(rig.selection.selectedIds).toEqual([]);
	expect(rig.wrapper.find('[data-rp-context-action="rename"]').exists()).toBe(false);
});

it('restores the canvas when a keyboard opener disappears and removes listeners on leaf disposal', async () => {
	const rig = await setup(), opener = document.createElement('button'); opener.dataset.rpId = 'retired-row'; rig.rootEl.append(opener);
	const selected = [...rig.selection.selectedIds]; opener.focus(); const menu = await open(rig, opener);
	expect(rig.selection.selectedIds).toEqual(selected); opener.remove(); key(menu.element, 'Escape'); await settle();
	expect(document.activeElement).toBe(rig.canvasEl);
	key(rig.canvasEl, 'ContextMenu'); mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	const outside = document.createElement('button'); document.body.append(outside); outside.focus();
	try {
		await settle(); expect(document.querySelector('.rp-canvas-context-menu')).toBeNull(); expect(document.activeElement).toBe(outside);
		expect(key(rig.rootEl, 'ContextMenu').defaultPrevented).toBe(false);
	} finally { outside.remove(); }
});
