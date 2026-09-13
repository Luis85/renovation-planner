// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { editorWith, KITCHEN_BEAM, POST_A, type EditorRig } from '../../helpers/structural';
import { postOutline, postSection } from '../../../src/domain/spatial/structuralElement';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('summarises a beam, switches load-bearing through undoable history, and edits its width', async () => {
	const rig = await editorWith(mounted, KITCHEN_BEAM);
	rig.selection.select([KITCHEN_BEAM.id as never]); await settle();
	const text = rig.wrapper.get('.rp-element-inspector').text();
	expect(text).toContain('Beam'); expect(text).toContain('3 m · 0.16 m wide');
	const toggle = rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]');
	expect(toggle.element.checked).toBe(true);
	toggle.element.click();
	await settleUntil(() => rig.project.structure.elements?.[0].loadBearing === false, 'switched off');
	expect(rig.wrapper.get<HTMLInputElement>('input[name="load-bearing"]').element.checked).toBe(false);
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.elements?.[0].loadBearing).toBe(true);
	const editing = rig.runtime.elementActions.edit(KITCHEN_BEAM.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.find('input[name="structural-depth"]').exists()).toBe(false);
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.trigger('submit'); await editing; await settle();
	expect(rig.project.structure.elements?.[0]).toMatchObject({ width: 200, points: KITCHEN_BEAM.points, loadBearing: true });
});

it('summarises a post and resizes it about its centre from the dimensions form', async () => {
	const rig = await editorWith(mounted, POST_A);
	rig.selection.select([POST_A.id as never]); await settle();
	expect(rig.wrapper.get('.rp-element-inspector').text()).toContain('0.14 × 0.14 m');
	const editing = rig.runtime.elementActions.edit(POST_A.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="structural-edit"]');
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input[name="structural-width"]').setValue('0,2');
	await form.get('input[name="structural-depth"]').setValue('0,1');
	await form.trigger('submit'); await editing; await settle();
	const saved = expectDefined(rig.project.structure.elements?.[0], 'resized post');
	expect(saved.points).toEqual(postOutline({ x: 1000, y: 1000 }, 200, 100));
	expect(postSection(saved.points)).toEqual({ width: 200, depth: 100 });
});
