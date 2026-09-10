// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

let rig: Awaited<ReturnType<typeof renovationEditor>> | undefined;
afterEach(() => { rig?.unmount(); rig = undefined; });

it('switches perspectives with roving keyboard focus while preserving selection, viewport and saved data', async () => {
	rig = await renovationEditor();
	await rig.runtime.renovation.perspective('renovate');
	rig.runtime.renovation.focus(rig.room.id, 'overview');
	await settle();
	const viewport = { ...useEditorStore(rig.pinia).viewport };
	const saved = [...rig.stack.vault.entries];
	const current = rig.wrapper.get('[data-rp-perspective="renovate"]');
	(current.element as HTMLElement).focus();
	await current.trigger('keydown', { key: 'ArrowLeft' });
	await settle();
	const plan = rig.wrapper.get('[data-rp-perspective="plan"]');
	expect(plan.attributes('role')).toBe('radio');
	expect(plan.attributes('aria-checked')).toBe('true');
	expect(document.activeElement).toBe(plan.element);
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	expect(useEditorStore(rig.pinia).viewport).toEqual(viewport);
	expect([...rig.stack.vault.entries]).toEqual(saved);
	await plan.trigger('keydown', { key: 'End' });
	await settle();
	expect(rig.session.perspective).toBe('review');
	expect(rig.wrapper.findAll('[role="radio"][tabindex="0"]')).toHaveLength(1);
	await rig.wrapper.get('[data-rp-perspective="review"]').trigger('keydown', { key: 'Home' });
	await settle();
	expect(rig.session.perspective).toBe('plan');
});

it('keeps the accessible element list in a disclosure and layer visibility separate from saved data', async () => {
	rig = await renovationEditor();
	const disclosure = rig.wrapper.get('.rp-property-elements');
	expect(disclosure.attributes('open')).toBeUndefined();
	expect(disclosure.find(`[data-rp-id="${rig.room.id}"]`).exists()).toBe(true);
	const saved = [...rig.stack.vault.entries];
	const visibility = rig.wrapper.get('.rp-property-layers > .rp-layer-toggle input');
	await visibility.setValue(false);
	expect(rig.session.visible).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(saved);
});

it('retains the history footprint in Review while withdrawing its controls from interaction', async () => {
	rig = await renovationEditor();
	const undo = rig.wrapper.get('[data-rp-action="undo"]').element;
	const redo = rig.wrapper.get('[data-rp-action="redo"]').element;
	const saved = [...rig.stack.vault.entries];
	await rig.runtime.renovation.perspective('review'); await settle();
	expect(rig.wrapper.get('.rp-context-history').attributes('aria-hidden')).toBe('true');
	expect(rig.wrapper.get('[data-rp-action="undo"]').element).toBe(undo);
	expect(rig.wrapper.get('[data-rp-action="redo"]').element).toBe(redo);
	expect(undo).toHaveProperty('disabled', true);
	expect(redo).toHaveProperty('disabled', true);
	await rig.runtime.renovation.perspective('plan'); await settle();
	expect(rig.wrapper.get('.rp-context-history').attributes('aria-hidden')).toBeUndefined();
	expect(rig.wrapper.get('[data-rp-action="undo"]').element).toBe(undo);
	expect([...rig.stack.vault.entries]).toEqual(saved);
});
