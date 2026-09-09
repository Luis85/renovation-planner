// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }

it('preserves a View disclosure for modified Escape and refuses its old Fit selection action after selection retires', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), fit = vi.spyOn(editor, 'fitTo');
	const menu = rig.wrapper.get<HTMLDetailsElement>('.rp-view-menu'), summary = menu.get<HTMLElement>('summary');
	summary.element.click(); summary.element.focus(); await settle(); expect(menu.element.open).toBe(true);
	for (const modifiers of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
		const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...modifiers });
		summary.element.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false); expect(menu.element.open).toBe(true);
	}
	const button = menu.get<HTMLButtonElement>('[data-rp-view="selection"]'), bytes = [...rig.stack.vault.entries];
	expect(button.element.disabled).toBe(false);
	rig.selection.clear(); button.element.click(); await settle();
	expect(fit).not.toHaveBeenCalled(); expect(button.element.disabled).toBe(true); expect([...rig.stack.vault.entries]).toEqual(bytes);
	const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); summary.element.dispatchEvent(escape); await settle();
	expect(escape.defaultPrevented).toBe(true); expect(menu.element.open).toBe(false); expect(document.activeElement).toBe(summary.element);
});

it('explains intersecting native curve edits without saving and preserves outside focus when that focused leaf closes', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-action="edit-curves"]').trigger('click');
	await settleUntil(() => rig.runtime.curveTask.target.value !== null, 'curve baseline');
	const form = rig.wrapper.get('[data-rp-form="edit-curves"]');
	await form.get('input[name="depth"]').setValue('-2'); await form.get('select[name="curve-edge"]').setValue('2');
	await form.get('input[name="depth"]').setValue('-2'); await settle();
	expect(rig.runtime.curveTask.state.invalidField).toBeNull(); expect(rig.runtime.curveTask.validation.value).not.toBeNull();
	expect(form.get('[role="alert"]').text()).toBe(tr('editor.curves.invalid'));
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true'); await form.trigger('submit');
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	form.get<HTMLInputElement>('input[name="depth"]').element.focus();
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
	const outside = document.createElement('button'); document.body.append(outside); outside.focus();
	try {
		await settle(); expect(document.activeElement).toBe(outside); expect(rig.runtime.curveTask.target.value).toBeNull();
		expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	} finally { outside.remove(); }
});
