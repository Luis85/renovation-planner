// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectFound } from '../../helpers/domain';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
function key(target: Element, name: string, modifiers: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: name, ...modifiers }); target.dispatchEvent(event); return event;
}

it('cycles perspective radios forward and vertically while leaving modified arrows and ordinary typing untouched', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], viewport = { ...useEditorStore(rig.pinia).viewport };
	const plan = rig.wrapper.get('[data-rp-perspective="plan"]'); (plan.element as HTMLElement).focus();
	for (const modifiers of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
		expect(key(plan.element, 'ArrowRight', modifiers).defaultPrevented).toBe(false);
	}
	expect(key(plan.element, 'x').defaultPrevented).toBe(false); await settle(); expect(rig.session.perspective).toBe('plan');
	expect(key(plan.element, 'ArrowRight').defaultPrevented).toBe(true); await settle();
	expect(rig.session.perspective).toBe('renovate'); expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-perspective="renovate"]').element);
	key(document.activeElement as Element, 'ArrowDown'); await settle(); expect(rig.session.perspective).toBe('review');
	key(document.activeElement as Element, 'ArrowRight'); await settle(); expect(rig.session.perspective).toBe('plan');
	expect(rig.wrapper.findAll('[role="radio"][tabindex="0"]')).toHaveLength(1);
	expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(useEditorStore(rig.pinia).viewport).toEqual(viewport); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('restores the real Room edit through the header Redo button after native Undo', async () => {
	const rig = await setup(), before = expectFound(await rig.stack.zones.getById(rig.room.id)).entity.geometry;
	await rig.runtime.nudgeSelection({ dx: 100, dy: 0 }); await settle();
	const moved = expectFound(await rig.stack.zones.getById(rig.room.id)).entity.geometry; expect(moved).not.toEqual(before);
	await rig.wrapper.get('[data-rp-action="undo"]').trigger('click'); await settleUntil(() => rig.runtime.canRedo.value, 'undo complete');
	expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.geometry).toEqual(before);
	await rig.wrapper.get('[data-rp-action="redo"]').trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.points[0].x === moved.points[0].x, 'redo published');
	expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.geometry).toEqual(moved);
});

it('renders explicit Pan ownership and accepts real no-button-change pointer moves without leaking overlay cancellation', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), bytes = [...rig.stack.vault.entries], ids = [...rig.selection.selectedIds];
	const box = rig.canvasEl.getBoundingClientRect(), hover = worldToScreen({ x: 1500, y: 1000 }, editor.viewport, STAGE_PIXELS);
	rig.canvasEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, button: -1, buttons: 0, clientX: box.left + hover.x, clientY: box.top + hover.y })); await settle();
	expect(rig.runtime.renderState.hoveredObjectId).toBe(rig.room.id);
	await rig.wrapper.get('[data-rp-action="pan"]').trigger('click'); const pan = { ...editor.viewport.pan }, zoom = editor.viewport.zoom;
	rig.canvasEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: 100, clientY: 100 })); await settle();
	expect(rig.canvasEl.classList.contains('rp-plan-canvas-panning')).toBe(true);
	await rig.wrapper.get('.rp-plan-overlay').trigger('pointercancel', { pointerId: 2 });
	expect(editor.dragState).not.toBeNull();
	rig.canvasEl.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, button: -1, buttons: 1, clientX: 170, clientY: 130 })); await settle();
	expect(editor.viewport.pan).toEqual({ x: pan.x - 70 / zoom, y: pan.y - 30 / zoom });
	rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0, buttons: 0, clientX: 170, clientY: 130 })); await settle();
	expect(rig.canvasEl.classList.contains('rp-plan-canvas-armed')).toBe(true); expect(editor.dragState).toBeNull();
	expect(rig.selection.selectedIds).toEqual(ids); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('opens a wall context menu with Shift+F10 from its native list row and returns focus there on Escape', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries];
	const row = rig.wrapper.get<HTMLButtonElement>('.rp-property-elements [data-rp-id="wall-a"]');
	await rig.wrapper.get('.rp-property-elements > summary').trigger('click'); row.element.focus();
	expect(key(row.element, 'F10', { shiftKey: true }).defaultPrevented).toBe(true); await settle();
	expect(rig.selection.selectedIds).toEqual(['wall-a']); expect(rig.selection.focusedId).toBe('wall-a');
	expect(rig.wrapper.find('[data-rp-context-action="edit"]').exists()).toBe(true);
	key(rig.wrapper.get('.rp-canvas-context-menu').element, 'Escape'); await settle();
	expect(document.activeElement).toBe(row.element); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
