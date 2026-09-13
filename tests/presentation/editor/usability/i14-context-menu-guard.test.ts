// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import CanvasMenuList from '../../../../src/presentation/editor/selection/CanvasMenuList.vue';
import { isSubmenu } from '../../../../src/presentation/editor/selection/useCanvasMenuActions';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); return rig; }
async function menuAt(rig: Awaited<ReturnType<typeof setup>>, x: number, y: number) {
	const at = worldToScreen({ x, y }, useEditorStore(rig.pinia).viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + at.x, clientY: box.top + at.y }));
	await settle();
	return rig.wrapper.getComponent(CanvasMenuList).props('items').flatMap(item => isSubmenu(item) ? item.children : [item]);
}

it.each([{ name: 'Room', x: 2000, y: 300 }, { name: 'wall', x: 1000, y: 0 }])('disables $name Add point and refuses a captured Plan action after navigation', async ({ x, y }) => {
	const rig = await setup();
	const actions = await menuAt(rig, x, y);
	const addPoint = expectDefined(actions.find(item => item.id === 'add-point'), 'Add point');
	expect(addPoint.disabled).toBe(false);
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	await rig.runtime.renovation.perspective('renovate'); await settle();
	expect(rig.wrapper.get('[data-rp-context-action="add-point"]').attributes('aria-disabled')).toBe('true');
	await addPoint.run();
	await rig.wrapper.get('[data-rp-context-action="add-point"]').trigger('click');
	await settle();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	expect(rig.dialogs.current).toBeNull();
	// Copy and framing remain useful in Renovate.
	expect(rig.wrapper.get('[data-rp-context-action="copy"]').attributes('aria-disabled')).not.toBe('true');
	await rig.wrapper.get('[data-rp-context-action="copy"]').trigger('click');
	await menuAt(rig, x, y);
	expect(rig.wrapper.get('[data-rp-context-action="paste"]').attributes('aria-disabled')).not.toBe('true');
	expect(rig.wrapper.get('[data-rp-context-action="fit"]').attributes('aria-disabled')).not.toBe('true');
});

it('guards wall/opening measurement actions at the menu and runtime boundaries', async () => {
	const rig = await setup();
	const baseline = expectOk(await rig.services.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, ledger: rig.runtime.structureTask.ledger,
		structure: { ...rig.project.structure, openings: [{ id: 'opening-guard', kind: 'door', hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] } })));
	const actions = await menuAt(rig, 800, 0);
	const edit = expectDefined(actions.find(item => item.id === 'edit'), 'Edit');
	expect(edit.disabled).toBe(false);
	await rig.runtime.renovation.perspective('renovate'); await settle();
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	expect(rig.wrapper.get('[data-rp-context-action="edit"]').attributes('aria-disabled')).toBe('true');
	await edit.run();
	await rig.runtime.structureActions.edit('opening-guard');
	await rig.runtime.structureActions.moveOpeningToPoint('opening-guard', { x: 2000, y: 0 });
	await rig.runtime.structureActions.edit('wall-a');
	await rig.runtime.structureActions.addPoint('wall-a', 2000);
	await rig.runtime.structureActions.editMany(['wall-a', 'wall-b']);
	await settle();
	expect(rig.dialogs.current).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	rig.selection.select(['wall-a' as never]); await settle();
	expect(rig.wrapper.get('[data-rp-wall-length]').attributes('aria-disabled')).toBe('true');
	await rig.wrapper.get('[data-rp-wall-length]').trigger('click'); await settle();
	expect(rig.dialogs.current).toBeNull();
});

it.each(['edit', 'editMany', 'addPoint'] as const)('rechecks permission after a pending structure read for %s', async action => {
	const rig = await setup();
	rig.selection.select(['wall-a' as never]);
	const before = expectOk(await rig.services.read(rig.plan.id));
	let resume!: () => void;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { resume = () => resolve({ ok: true, value: before }); }));
	const pending = action === 'edit' ? rig.runtime.structureActions.edit('wall-a') : action === 'editMany'
		? rig.runtime.structureActions.editMany(['wall-a', 'wall-b']) : rig.runtime.structureActions.addPoint('wall-a', 2000);
	await rig.runtime.renovation.perspective('renovate');
	resume(); await pending; await settle();
	expect(rig.dialogs.current).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect(rig.runtime.structureActions.active.value).toBe(false);
});
