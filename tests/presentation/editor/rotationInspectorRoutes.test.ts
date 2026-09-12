// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { pointerAt } from '../../helpers/tool-context';
import { hoverRotation } from '../../helpers/rotationHover';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('opens the canonical rotation form from every eligible Inspector and explains opening-host rotation', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	const points = [{ x: 1000, y: 500 }, { x: 1800, y: 500 }, { x: 1800, y: 1100 }, { x: 1000, y: 1100 }];
	const area = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Patio', zoneType: 'Custom', geometry: { points } })).zone.entity;
	for (const kind of ['object', 'path', 'fence', 'measurement'] as const) {
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline,
			elementInput(baseline, { id: `element-${kind}`, name: kind, kind, points: kind === 'object' ? points : points.slice(0, 2) }), rig.runtime.structureTask.ledger)));
	}
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = expectDefined(baseline.document.structure, 'saved walls');
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, ledger: rig.runtime.structureTask.ledger,
		structure: { ...structure, openings: [{ id: 'opening-rotation', kind: 'door', hostId: 'wall-a', offset: 500, width: 800, height: 2000, sill: 0 }] } })));
	const saved = new Map(rig.stack.vault.entries);
	const ids = [rig.room.id, area.id, 'element-object', 'element-path', 'element-fence', 'element-measurement', 'wall-a', 'opening-rotation'];
	for (const id of ids) {
		rig.selection.select([id as never]); await settle();
		const controls = rig.wrapper.findAll('[data-rp-region="inspector"] .rp-object-rotation-actions');
		expect(controls).toHaveLength(1);
		expect(controls[0].findAll('button')).toHaveLength(3);
		expect(rig.wrapper.findAll('.rp-direct-actions .rp-object-rotation-actions')).toHaveLength(0);
		expect(controls[0].get('[data-rp-action="rotate-object"]').text()).toContain(id === 'opening-rotation' ? 'Rotate host wall' : 'Rotate by');
		expect(controls[0].find('.rp-object-rotation-hint').exists()).toBe(id === 'opening-rotation');
		await controls[0].get('[data-rp-action="rotate-object"]').trigger('click'); await settle();
		expect(rig.wrapper.find(`[data-rp-form="${id === 'wall-a' || id === 'opening-rotation' ? 'wall-rotation' : 'object-rotation'}"]`).exists()).toBe(true);
		rig.dialogs.resolve('cancel'); await settle();
		expect(rig.selection.selectedIds).toEqual([id]);
	}
	expect(rig.wrapper.get('.rp-object-rotation-hint').text()).toContain('other openings in that wall');
	await rig.runtime.renovation.perspective('renovate');
	resizeTo(rig.rootEl, 460, 900); await settle();
	for (const id of [rig.room.id, area.id, 'wall-a', 'opening-rotation']) {
		rig.selection.select([id as never]); await settle();
		useWorkspaceStore(rig.pinia).openOverlay('inspector'); await settle();
		expect(rig.wrapper.findAll('.rp-object-rotation-actions')).toHaveLength(1);
	}
	rig.selection.select(['element-object' as never]); await settle();
	expect(rig.wrapper.findAll('.rp-object-rotation-actions')).toHaveLength(0);
	expect(rig.wrapper.find('[data-rp-action="element-plan-geometry"]').exists()).toBe(true);
	await rig.runtime.renovation.perspective('review'); await settle();
	expect(rig.wrapper.findAll('.rp-object-rotation-actions')).toHaveLength(0);
	expect(rig.stage.find('.object-rotation-handle')).toHaveLength(0);
	expect(new Map(rig.stack.vault.entries)).toEqual(saved);
});

it('keeps rotation feedback clear of the direct-action popover and restores actions after cancellation', async () => {
	const rig = await renovationEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const object = { id: 'element-feedback', kind: 'object' as const, name: 'Cabinet', points: [{ x: 1000, y: 500 }, { x: 1800, y: 500 }, { x: 1800, y: 1100 }, { x: 1000, y: 1100 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, object), rig.runtime.structureTask.ledger)));
	rig.selection.select([object.id as never]); await settle();
	// A Room context gives the object its Add detail popover, the one this feedback must stay clear of.
	rig.session.roomId = rig.room.id; rig.session.targetId = object.id; await settle();
	await hoverRotation(rig.runtime, useEditorStore(rig.pinia), object.points[0]);
	const saved = new Map(rig.stack.vault.entries);
	const handle = expectDefined(rig.runtime.rotationActions.handle.value, 'rotation handle');
	const tool = rig.runtime.toolManager, destination = pointerAt(handle.x + 1000, handle.y + 1000);
	expect(rig.wrapper.find('.rp-direct-actions').exists()).toBe(true);
	tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerMove(destination); await settle();
	expect(rig.runtime.renderState.rotationDegrees).not.toBeNull();
	expect(rig.stage.find('.rotation-angle-label')).toHaveLength(1);
	expect(rig.wrapper.find('.rp-direct-actions').exists()).toBe(false);
	const canvas = rig.wrapper.get('.rp-plan-canvas').element as HTMLElement;
	canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); tool.pointerUp(destination); await settle();
	expect(rig.wrapper.find('.rp-direct-actions').exists()).toBe(true);
	expect(new Map(rig.stack.vault.entries)).toEqual(saved);
});
