// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';
import { expectOk } from '../../../helpers/domain';
import StructureBulkEditForm from '../../../../src/presentation/editor/structure/StructureBulkEditForm.vue';
import TransformationStage from '../../../../src/presentation/editor/renovation/TransformationStage.vue';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('explains the unavailable multi-selection dimensions action in Renovate and restores it in Plan', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.selection.select([rig.room.id, 'wall-a' as never]); await settle();
	const action = () => rig.wrapper.get('[data-rp-action="edit-dimensions"]');
	expect(action().attributes('aria-disabled')).toBe('false');
	expect(action().attributes('title')).toBeUndefined();
	await rig.runtime.renovation.perspective('renovate'); await settle();
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const selection = [...rig.selection.selectedIds];
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	expect(action().attributes('aria-disabled')).toBe('true');
	expect(action().attributes('title')).toBe('Edit geometry in plan');
	await action().trigger('click'); await settle();
	expect(rig.dialogs.current).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect(rig.selection.selectedIds).toEqual(selection);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	await rig.runtime.renovation.perspective('plan'); await settle();
	expect(action().attributes('aria-disabled')).toBe('false');
	expect(action().attributes('title')).toBeUndefined();
	await action().trigger('click'); await settle();
	expect(rig.wrapper.findComponent(StructureBulkEditForm).exists()).toBe(true);
	expect(action().attributes('aria-disabled')).toBe('true');
	rig.dialogs.resolve({ action: 'cancel' }); await settle();
});

it.each(['0/0 complete', '12/24 abgeschlossen'])('gives compact work progress its own line without squeezing the stage heading (%s)', async progress => {
	const stage = mount(TransformationStage, { props: { kind: 'work', items: [{ id: 'synthetic-work', text: 'Prepare the synthetic room' }], compact: true, progress },
		global: { stubs: { HostIcon: true } } });
	try {
		expect(stage.get('h4').text()).toBe('Work');
		expect(stage.get('h4').find('.rp-transformation-progress').exists()).toBe(false);
		expect(stage.get('h4 + .rp-transformation-progress').text()).toBe(progress);
		expect(stage.get('.rp-transformation-progress + p').text()).toBe('Prepare the synthetic room');
		await stage.setProps({ compact: false });
		expect(stage.find('.rp-transformation-progress').exists()).toBe(false);
		expect(stage.get('ul').text()).toBe('Prepare the synthetic room');
	} finally { stage.unmount(); }
});
