// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import type { ElementToolId } from '../../../src/presentation/editor/elements/elementDraft';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup(tool: ElementToolId): Promise<Rig> {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, `${tool} baseline`);
	return rig;
}

it('labels a text\'s name field Text, hands it the keyboard once the point is placed, and saves the typed words', async () => {
	const rig = await setup('place-text');
	const field = rig.wrapper.get<HTMLInputElement>('[data-rp-form="element-create"] input[name="element-name"]');
	expect(field.element.closest('label')?.textContent).toContain('Text');
	rig.runtime.elementTask.addPoint({ x: 1500, y: 1500 }); await settle();
	expect(document.activeElement).toBe(field.element);
	await field.setValue('Wintergarten');
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'saved text');
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Wintergarten');
});

it('offers an Offset field only while a chain\'s line is placed, holds Finish on unreadable text, and saves the typed offset', async () => {
	const rig = await setup('draw-dimension'), task = rig.runtime.elementTask;
	task.addPoint({ x: 0, y: 0 }); task.addPoint({ x: 4000, y: 0 }); await settle();
	expect(rig.wrapper.find('input[name="dimension-offset"]').exists()).toBe(false);
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click'); await settle();
	const offset = rig.wrapper.get('input[name="dimension-offset"]');
	await offset.setValue('x');
	expect(offset.attributes('aria-invalid')).toBe('true');
	expect(task.canFinish.value).toBe(false);
	await offset.setValue('-0,8');
	await rig.wrapper.get('[data-rp-action="finish-element"]').trigger('click');
	await settleUntil(() => rig.project.structure.elements?.length === 1, 'saved chain');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -800 });
});
