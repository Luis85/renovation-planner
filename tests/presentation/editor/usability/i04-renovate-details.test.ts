// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('keeps a room-less wall selected while the Renovate work and layout routes use existing actions', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle();
	rig.selection.select(['wall-a' as never]); await settle();
	const before = [...rig.stack.vault.entries];

	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.get('.rp-renovation-inspector > h3').text()).toBe('Wall');
	const addWork = rig.wrapper.get('.rp-renovation-overview-actions [data-rp-action="add-work"]');
	await addWork.trigger('click'); await settle();
	expect(rig.session.mode).toBe('work');
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect(rig.dialogs.current?.kind).toBe('form');
	rig.dialogs.resolve('cancel'); await settle();

	await rig.runtime.renovation.focus('', 'overview'); await settle();
	await rig.wrapper.get('.rp-renovation-overview-actions [data-rp-action="edit-layout"]').trigger('click'); await settle();
	expect(rig.session.perspective).toBe('plan');
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect([...rig.stack.vault.entries]).toEqual(before);
});
