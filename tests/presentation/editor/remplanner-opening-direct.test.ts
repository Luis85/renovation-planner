// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import type { Opening } from '../../../src/domain/spatial/Structure';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
const door: Opening = { id: 'opening-direct-door', kind: 'door', hostId: 'wall-a', offset: 800, width: 900, height: 2100, sill: 0, swing: { hinge: 'end', side: 'right', angle: 45 } };
async function setup(openings: readonly Opening[] = [door]) {
	const rig = await structureEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...WALL_LOOP, openings } }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select([(openings[0] ?? door).id as never]); await settle();
	return rig;
}
afterEach(() => mounted.splice(0).forEach(rig => rig.unmount()));

it('uses one selected-opening panel from Inspector and context actions, centre-anchors width, and reverses exactly', async () => {
	const rig = await setup();
	await rig.wrapper.get('[data-rp-action="opening-size-swing"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('.rp-opening-direct-panel').exists(), 'direct opening panel');
	expect(rig.wrapper.get('.rp-opening-direct-panel').text()).toContain('Door size and swing');
	const width = rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="width"]');
	await width.setValue('1.1'); await settle();
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	expect(rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="offset"]').element.value).toBe('0.7');
	await rig.wrapper.get('[aria-label="Move toward wall end by 10 mm"]').trigger('click');
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...door, width: 1100, offset: 710 }]);
	await rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="offset"]').setValue('0.7');
	expect(rig.wrapper.get('[aria-label="Decrease width by 10 mm"]').attributes('type')).toBe('button');
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('.rp-opening-direct-panel').trigger('submit');
	await settleUntil(() => !rig.runtime.structureActions.openingDirect.target.value, 'direct opening write');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
	await rig.runtime.redo(); expect(rig.project.structure.openings).toEqual([{ ...door, width: 1100, offset: 700 }]);
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ContextMenu' })); await settle();
	expect(rig.wrapper.find('[data-rp-context-action="opening-width"]').exists()).toBe(true);
	expect(rig.wrapper.find('[data-rp-context-action="opening-offset"]').exists()).toBe(true);
	expect(rig.wrapper.find('[data-rp-context-action="opening-swing"]').exists()).toBe(true);
});

it('refuses invalid containment and overlap without resizing or adding history', async () => {
	const other = { ...door, id: 'opening-direct-other', offset: 2200 };
	const rig = await setup([door, other]); await rig.runtime.structureActions.openingDirect.begin(door.id);
	await settleUntil(() => rig.wrapper.find('.rp-opening-direct-panel').exists(), 'direct opening panel');
	await rig.wrapper.get<HTMLInputElement>('.rp-opening-direct-panel input[name="width"]').setValue('4.5'); await settle();
	expect(rig.wrapper.find('.rp-opening-direct-panel [role="alert"]').text()).toContain('fit within');
	expect(rig.runtime.structureActions.preview.value).toBeNull();
	await rig.wrapper.get('.rp-opening-direct-panel').trigger('submit');
	expect(rig.project.structure.openings).toEqual([door, other]); expect(rig.runtime.canUndo.value).toBe(false);
});

it('retires a pending panel read on a perspective departure and refuses the old Renovate move action', async () => {
	const rig = await setup(), session = useRenovationSession(rig.pinia);
	const response = await rig.services.read(rig.plan.id); let release!: () => void;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(response); }));
	const pending = rig.runtime.structureActions.openingDirect.begin(door.id); session.perspective = 'renovate'; release(); await pending;
	expect(rig.runtime.structureActions.openingDirect.target.value).toBeNull(); expect(rig.project.structure.openings).toEqual([door]);
	expect(rig.runtime.openingMove.start(door.id)).toBe(false);
});

it('steps exact raw millimetres, preserves the current centre, and leaves an untouched default swing absent', async () => {
	const fractional: Opening = { id: 'opening-fractional', kind: 'door', hostId: 'wall-a', offset: 1200.2, width: 900.4, height: 2100, sill: 0 };
	const rig = await setup([fractional]); await rig.runtime.structureActions.openingDirect.begin(fractional.id);
	await settleUntil(() => rig.runtime.structureActions.openingDirect.target.value === fractional.id, 'fractional direct panel');
	const control = rig.runtime.structureActions.openingDirect;
	expect(control.changed.value).toBe(false); control.step('width', 1);
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 910.4, offset: 1195.2 }]);
	control.step('offset', 1); expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 910.4, offset: 1205.2 }]);
	control.step('width', 1); expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...fractional, width: 920.4, offset: 1200.2 }]);
	await control.close(); await rig.runtime.structureActions.openingDirect.begin(fractional.id);
	await settleUntil(() => control.target.value === fractional.id, 'fresh fractional panel');
	const write = vi.spyOn(rig.geometry, 'write'); await control.apply(); expect(write).not.toHaveBeenCalled();
});
