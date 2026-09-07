// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import StructureEditForm from '../../../src/presentation/editor/structure/StructureEditForm.vue';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig);
	await rig.runtime.renovation.perspective('plan'); rig.selection.select(['wall-a' as never]); await settle();
	return rig;
}

describe('structural action recovery after peer replacement', () => {
	it.each(['edit', 'remove'] as const)('refreshes a displayed wall after the peer removed the entire structure before %s', async action => {
		const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
		expect(rig.project.structure.walls.some(wall => wall.id === 'wall-a')).toBe(true);
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: undefined }, before.version));
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await rig.runtime.structureActions[action]('wall-a'); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect(rig.project.structure.walls).toEqual([]);
		expect(rig.project.zones.get(rig.room.id)?.points).toEqual(rig.room.geometry.points);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('refreshes when only the selected wall disappeared, retaining the peer’s other walls', async () => {
		const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
		const current = expectDefined(before.document.structure, 'structure');
		const structure = { ...current, walls: current.walls.filter(wall => wall.id !== 'wall-a'), boundaries: [] };
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure }, before.version));
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await rig.runtime.structureActions.edit('wall-a'); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect(rig.project.structure.walls).toEqual(structure.walls);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('refuses a captured wall form callback after disposal without writing or restoring its preview', async () => {
		const rig = await setup(), editing = rig.runtime.structureActions.edit('wall-a'); await settle();
		const component = rig.wrapper.getComponent(StructureEditForm), dispatch = component.props('dispatch');
		await component.get('[name="length"]').setValue('5'); await component.trigger('submit');
		const proposal = expectDefined(rig.runtime.structureActions.preview.value, 'reviewed wall change');
		expect(proposal.walls.find(wall => wall.id === 'wall-a')?.end.x).toBe(5000);
		const run = vi.spyOn(rig.runtime.dispatcher, 'run'), bytes = [...rig.stack.vault.entries];
		rig.unmount(); await editing;
		expect(expectErr(await dispatch(proposal)).code).toBe('editor.stale-write-refused');
		expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
