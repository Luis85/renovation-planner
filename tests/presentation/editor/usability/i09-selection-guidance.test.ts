// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle } from '../../../helpers/editor';
import { expectOk } from '../../../helpers/domain';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../../src/presentation/editor/viewport/Viewport';
import { tr } from '../../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup() {
	const rig = await renovationEditor(true);
	mounted.push(rig);
	rig.changePlan();
	await settle();
	return rig;
}

async function openAt(rig: Awaited<ReturnType<typeof setup>>, world: { x: number; y: number }, altKey = false) {
	const editor = useEditorStore(rig.pinia), point = worldToScreen(world, editor.viewport, STAGE_PIXELS), bounds = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, altKey, clientX: bounds.left + point.x, clientY: bounds.top + point.y }));
	await settle();
}

async function dismiss(rig: Awaited<ReturnType<typeof setup>>) {
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	await settle();
}

it('names the current overlap target, retains the existing Alt cycle, and restores canvas focus on Escape', async () => {
	const rig = await setup(), baseline = expectOk(await rig.services.read(rig.plan.id));
	const structure = { ...rig.project.structure, openings: [{ id: 'i09-overlap-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.runtime.structureTask.ledger })));
	await settle();

	await openAt(rig, { x: 1000, y: 0 });
	expect(rig.selection.selectedIds).toEqual(['i09-overlap-door']);
	expect(rig.wrapper.get('.rp-canvas-context-menu-title').text()).toBe(`${tr('editor.input.current-target', { target: tr('editor.add.door.label') })} ${tr('editor.input.overlap-cycle-guidance')}`);
	await dismiss(rig);
	expect(document.activeElement).toBe(rig.canvasEl);
	expect(rig.selection.selectedIds).toEqual(['i09-overlap-door']);

	await openAt(rig, { x: 1000, y: 0 }, true);
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect(rig.wrapper.get('.rp-canvas-context-menu-title').text()).toBe(`${tr('editor.input.current-target', { target: tr('editor.structure.wall-number', { n: '1' }) })} ${tr('editor.input.overlap-cycle-guidance')}`);
	await dismiss(rig);
	expect(document.activeElement).toBe(rig.canvasEl);
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
});
