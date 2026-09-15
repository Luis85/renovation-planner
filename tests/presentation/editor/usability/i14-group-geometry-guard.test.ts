// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); return rig; }

it('refuses Enclose from both Details and a captured Plan action in Renovate', async () => {
	const rig = await setup(), groups = rig.runtime.groupActions;
	const enclose = expectDefined(groups.actions([rig.room.id]).find(action => action.id === 'enclose'), 'Enclose');
	expect(enclose.disabled).toBe(false);
	await rig.runtime.renovation.perspective('renovate'); await settle();
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	expect(rig.wrapper.get('[data-rp-group-action="enclose"]').attributes('disabled')).toBeDefined();
	await enclose.run();
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await settle();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	expect(rig.dialogs.current).toBeNull();
});

it('retains grouping and member selection while refusing group geometry transforms in Renovate', async () => {
	const rig = await setup(), groups = rig.runtime.groupActions;
	rig.selection.select([rig.room.id, 'wall-a' as never]); await settle();
	const rotationId = expectDefined(groups.target.value, 'Plan rotation target').id;
	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(groups.target.value).toBeNull();
	expect(rig.wrapper.find('[data-rp-group-transform]').exists()).toBe(false);
	const group = expectDefined(groups.actions(rig.selection.selectedIds).find(action => action.id === 'group'), 'Group');
	expect(group.disabled).toBe(false);
	await group.run(); await settle();
	expect(rig.project.groups).toHaveLength(1);
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	await groups.moveBy({ dx: 1000, dy: 500 }); await groups.rotate(rotationId, 90); await settle();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	expect(rig.dialogs.current).toBeNull();
	const inspect = expectDefined(groups.actions(rig.selection.selectedIds).find(action => action.id === 'inspect'), 'Select member');
	await inspect.run(); await settle();
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
});
