// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { expectOk } from '../../../helpers/domain';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('keeps a room-less wall selected while the Renovate work and layout routes use existing actions', async () => {
	const rig = await renovationEditor(true); mounted.push(rig); await rig.runtime.refreshProjection(); await settle();
	rig.selection.select(['wall-a' as never]); await settle();
	const before = [...rig.stack.vault.entries];

	await rig.runtime.renovation.perspective('renovate'); await settle();
	await settleUntil(() => rig.selection.selectedIds[0] === 'wall-a' && rig.wrapper.find('.rp-renovation-inspector > h3').exists(), 'room-less wall Renovate Inspector');
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

it('keeps standalone Area rotation in Plan while Renovate offers the explicit layout route', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	const area = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Garden', zoneType: 'Garden',
		geometry: { points: [{ x: 5000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 2000 }, { x: 5000, y: 2000 }] } })).zone.entity;
	await rig.runtime.refreshProjection(); rig.selection.select([area.id]); await settle();
	await rig.runtime.renovation.perspective('plan'); await settle();
	await settleUntil(() => rig.selection.selectedIds[0] === area.id && rig.wrapper.find('.rp-room-more-actions').exists(), 'standalone Area Plan disclosure');
	expect(rig.wrapper.find('.rp-room-more-actions').exists()).toBe(true);

	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.find('.rp-room-more-actions').exists()).toBe(false);
	expect(rig.wrapper.find('[data-rp-action="rotate-object"]').exists()).toBe(false);
	expect(rig.wrapper.find('.rp-renovation-overview-actions [data-rp-action="edit-layout"]').exists()).toBe(true);
});
