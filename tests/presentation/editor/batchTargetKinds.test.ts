// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { DEFAULT_STAIR } from '../../../src/domain/spatial/stairGeometry';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
const ELEMENTS: readonly NamedSpatialElement[] = [
	{ id: 'element-object', kind: 'object', name: 'Boiler', points: [{ x: 500, y: 500 }, { x: 1000, y: 500 }, { x: 1000, y: 1000 }] },
	{ id: 'element-stair', kind: 'stair', name: 'Stair', points: [{ x: 1000, y: 3000 }, { x: 1000, y: 1500 }], stair: DEFAULT_STAIR },
	{ id: 'element-arrow', kind: 'arrow', name: 'Arrow', points: [{ x: 0, y: 2000 }, { x: 2000, y: 2000 }] },
];
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	for (const element of ELEMENTS) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	}
	return rig;
}

// An element kind the batch list does not name was once read as a wall, because "no opening
// has this id" was taken to mean "it must be a wall".
it('classifies every element kind by what it is, never as a wall', async () => {
	const rig = await setup();
	rig.selection.select(['element-object', 'element-stair', 'element-arrow', 'wall-a'] as never[]); await settle();
	await rig.wrapper.get('.rp-batch-actions select').setValue(rig.room.id);
	await rig.wrapper.get('[data-rp-batch="remove"]').trigger('click'); await settle();
	const form = rig.wrapper.get('[data-rp-form="renovation-batch"]');
	await form.trigger('submit'); await form.trigger('submit'); await settle();
	expect(Object.fromEntries(rig.project.plan?.renovation?.subjects.map(item => [item.targetId, item.kind]) ?? [])).toEqual({
		'element-object': 'fixture', 'element-stair': 'other', 'element-arrow': 'other', 'wall-a': 'wall',
	});
});

it('deletes a selection of stairs and arrows through element removal, not wall removal', async () => {
	const rig = await setup();
	rig.selection.select(['element-stair', 'element-arrow'] as never[]); await settle();
	await rig.wrapper.get('[data-rp-batch="delete"]').trigger('click'); await settle();
	rig.dialogs.resolve('confirm'); await settle();
	expect(rig.project.structure.elements?.map(item => item.id)).toEqual(['element-object']);
});
