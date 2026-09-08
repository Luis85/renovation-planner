/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
const cleanups: (() => void)[] = [];
async function rig() { const value = await structureEditor(); cleanups.push(value.unmount); return value; }
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });
function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent { const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); target.dispatchEvent(event); return event; }
it('pans using the explicit Pan button without forwarding primary drag to Select', async () => {
	const value = await rig(), editor = useEditorStore(value.pinia), tool = vi.spyOn(value.runtime.toolManager, 'pointerDown');
	await value.wrapper.get('[data-rp-action="pan"]').trigger('click');
	const before = { ...editor.viewport.pan };
	for (const [type, x, buttons] of [['pointerdown', 100, 1], ['pointermove', 160, 1], ['pointerup', 160, 0]] as const) value.canvasEl.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons, clientX: x, clientY: 100 }));
	expect(value.runtime.activeToolId.value).toBe('pan'); expect(editor.viewport.pan).not.toEqual(before); expect(tool).not.toHaveBeenCalled();
	key(value.canvasEl, { key: 'Escape' }); await settle(); expect(value.runtime.activeToolId.value).toBe('select');
});
it('routes Ctrl Z/Y from editor buttons through real history and leaves text/modal editing alone', async () => {
	const value = await rig(), baseline = expectOk(await value.geometry.read(value.plan.id));
	expectOk(await value.runtime.dispatcher.run(value.services.command({ planId: value.plan.id, baseline, structure: WALL_LOOP, ledger: value.runtime.structureTask.ledger })));
	const button = value.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	expect(key(button, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => value.project.structure.walls.length === 0, 'history undo');
	key(button, { key: 'y', ctrlKey: true }); await settleUntil(() => value.project.structure.walls.length === 4, 'history redo');
	value.runtime.setTool('draw-room'); await settle();
	const input = value.wrapper.get('.rp-new-room input').element as HTMLElement;
	expect(key(input, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false); expect(value.project.structure.walls).toHaveLength(4);
	const pending = value.dialogs.openDialog({ kind: 'confirm', title: 'Confirm', message: 'Example' }); await settle();
	expect(key(button, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false); expect(value.project.structure.walls).toHaveLength(4);
	value.dialogs.resolve('cancel'); await pending;
});
it('opens empty-canvas and keyboard context actions, invokes Pan, and dismisses back to the canvas', async () => {
	const value = await rig();
	value.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 })); await settle();
	expect(value.wrapper.get('.rp-canvas-context-menu').text()).toContain('Pan');
	await value.wrapper.get('[data-rp-context-action="pan"]').trigger('click'); expect(value.runtime.activeToolId.value).toBe('pan');
	key(value.canvasEl, { key: 'ContextMenu' }); await settle();
	const item = value.wrapper.get('[data-rp-context-action="add"]').element as HTMLElement;
	key(item, { key: 'Escape' }); await settle();
	expect(value.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false); expect(document.activeElement).toBe(value.canvasEl);
});
it('opens the selected Room rename action through its existing guarded form without clearing selection', async () => {
	const value = await rig(); value.runtime.setTool('draw-room');
	value.runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4000, depth: 3000 });
	value.runtime.roomDraft.setName('Kitchen'); await value.runtime.createRoom(); await settle();
	const selected = [...value.selection.selectedIds];
	key(value.canvasEl, { key: 'F10', shiftKey: true }); await settle();
	expect(value.wrapper.find('[data-rp-context-action="group"]').exists()).toBe(false);
	await value.wrapper.get('[data-rp-context-action="rename"]').trigger('click'); await settle();
	expect(value.wrapper.get('.rp-dialog').text()).toContain('Kitchen');
	expect(value.selection.selectedIds).toEqual(selected);
	value.dialogs.resolve('cancel'); await settle();
});
