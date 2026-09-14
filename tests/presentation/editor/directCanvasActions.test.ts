// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { resizeTo } from '../../helpers/layout';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const value of mounted.splice(0)) value.unmount(); });
async function setup() {
	const value = await renovationEditor(true); mounted.push(value);
	value.changePlan(); await settle(); value.runtime.renovation.focus(value.room.id, 'overview'); await settle(); return value;
}
async function applyDetail(value: Awaited<ReturnType<typeof setup>>): Promise<void> {
	await value.wrapper.get('[data-rp-form="renovation"]').trigger('submit');
	await value.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await settle();
}
describe('selected spatial canvas actions', () => {
	it('leaves an opening and a path with nothing floating beside them, their edits being in the context menu, and hides a wall label with its layer', async () => {
		const value = await setup(); await value.runtime.renovation.perspective('plan');
		const baseline = expectOk(await value.services.read(value.plan.id));
		const structure = { ...value.project.structure, openings: [{ id: 'opening-direct', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		expectOk(await value.runtime.dispatcher.run(value.services.command({ planId: value.plan.id, baseline, structure, ledger: value.runtime.structureTask.ledger })));
		value.selection.select(['opening-direct' as never]); await settle(); expect(value.wrapper.find('.rp-wall-canvas-actions').exists()).toBe(false);
		const read = expectOk(await value.renovation.read(value.plan.id));
		const element = { id: 'element-direct-path', kind: 'path' as const, name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
		expectOk(await value.runtime.dispatcher.run(value.renovation.command(read, elementInput(read, element), value.runtime.structureTask.ledger)));
		value.selection.select([element.id as never]); await settle(); expect(value.wrapper.find('.rp-wall-canvas-actions').exists()).toBe(false);
		value.selection.select(['wall-a' as never]); await settle(); expect(value.wrapper.find('[data-rp-wall-length]').exists()).toBe(true);
		expect(value.wrapper.find('.rp-wall-canvas-actions__change').exists()).toBe(false);
		useWorkspaceStore(value.pinia).toggleLayer('architecture'); await settle(); expect(value.wrapper.find('.rp-wall-canvas-actions').exists()).toBe(false);
		value.selection.select(['missing-source' as never]); await settle(); expect(value.wrapper.find('.rp-wall-canvas-actions').exists()).toBe(false);
	});
	it('keeps wall length behind Preview/Apply and routes Mark change through Planned authority', async () => {
		const value = await setup();
		await value.runtime.renovation.perspective('plan');
		value.selection.select(['wall-a' as never]); await settle();
		value.session.roomId = value.room.id; value.session.targetId = 'wall-a'; await settle();
		expect(value.wrapper.find('[data-rp-canvas-detail]').exists()).toBe(false);
		const before = expectOk(await value.geometry.read(value.plan.id)), room = expectFound(await value.stack.zones.getById(value.room.id));
		await value.wrapper.get('[data-rp-wall-length]').trigger('click'); await settle();
		expect(value.wrapper.get('input[name="length"]').element).toHaveProperty('value', '4');
		await value.wrapper.get('input[name="length"]').setValue('5');
		await value.wrapper.get('.rp-dialog form').trigger('submit'); await settle();
		expect(expectOk(await value.geometry.read(value.plan.id)).version).toEqual(before.version);
		await value.wrapper.get('.rp-dialog form').trigger('submit'); await settle();
		expect(value.project.structure.walls[0].end).toEqual({ x: 5000, y: 0 });
		expect(expectFound(await value.stack.zones.getById(value.room.id)).entity.geometry).toEqual(room.entity.geometry);
		await value.runtime.undo();
		await value.wrapper.get('[data-rp-canvas-change]').trigger('click'); await settle();
		expect(value.session.mode).toBe('planned'); expect(value.selection.selectedIds).toEqual(['wall-a']);
		await value.wrapper.get('textarea[name="description"]').setValue('Repair plaster');
		await applyDetail(value);
		expect(value.project.structure).toEqual(before.document.structure);
		expect(value.project.plan?.renovation?.subjects[0]).toMatchObject({ targetId: 'wall-a', planned: { description: 'Repair plaster' } });
	});
});

it.each([460, 1200])('removes selected-item Add detail at %spx while mode changes preserve selection, camera and saved data', async width => {
	const value = await setup(); resizeTo(value.rootEl, width, 800); await settle();
	const editor = useEditorStore(value.pinia), camera = { ...editor.viewport }, bytes = new Map(value.stack.vault.entries);
	const selected = [...value.selection.selectedIds];
	for (const mode of ['renovate', 'review', 'plan'] as const) {
		await value.runtime.renovation.perspective(mode); await settle();
		expect(value.wrapper.find('[data-rp-canvas-detail]').exists()).toBe(false);
		expect(value.wrapper.find('.rp-wall-canvas-actions').exists()).toBe(false);
		expect(value.selection.selectedIds).toEqual(selected);
		expect(editor.viewport).toEqual(camera);
		expect(new Map(value.stack.vault.entries)).toEqual(bytes);
	}
});

it('keeps the Details rail, Room renovation form and undo reachable after removing the contextual action', async () => {
	const value = await setup(); await value.runtime.renovation.perspective('plan'); resizeTo(value.rootEl, 460, 800); await settle();
	const rail = value.wrapper.get<HTMLButtonElement>('[data-rp-rail="details"]');
	rail.element.focus(); await rail.trigger('click'); await settle();
	expect(value.wrapper.get('.rp-inspector-drawer').element.contains(document.activeElement)).toBe(true);
	await value.wrapper.get('[data-rp-action="renovate-room"]').trigger('click'); await settle();
	await value.wrapper.get('[data-rp-mode="existing"]').trigger('click'); await settle();
	await value.wrapper.get('[data-rp-action="new-record"]').trigger('click'); await settle();
	await value.wrapper.get('textarea[name="description"]').setValue('Original oak floor');
	await applyDetail(value);
	expect(value.project.plan?.renovation?.subjects[0]).toMatchObject({ roomId: value.room.id, targetId: value.room.id, existing: { description: 'Original oak floor' } });
	expect(value.selection.selectedIds).toEqual([value.room.id]);
	await value.runtime.undo(); expect(value.project.plan?.renovation?.subjects ?? []).toHaveLength(0);
});

it('keeps the wall length action disabled while the floor is stale', async () => {
	const value = await setup(); value.selection.select(['wall-a' as never]); value.project.stale = true; await settle();
	const length = value.wrapper.get('[data-rp-wall-length]');
	expect(length.attributes('aria-disabled')).toBe('true');
	await length.trigger('click'); expect(value.dialogs.current).toBeNull();
});
