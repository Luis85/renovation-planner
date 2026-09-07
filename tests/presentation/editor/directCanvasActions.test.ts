// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const value of mounted.splice(0)) value.unmount(); });
async function setup() {
	const value = await renovationEditor(true); mounted.push(value);
	value.changePlan(); await settle(); value.runtime.renovation.focus(value.room.id, 'overview'); await settle(); return value;
}
async function detail(value: Awaited<ReturnType<typeof setup>>, mode: string): Promise<void> {
	await value.wrapper.get('[data-rp-canvas-detail]').trigger('click');
	await value.wrapper.get(`[data-rp-canvas-detail-mode="${mode}"]`).trigger('click'); await settle();
}
async function applyDetail(value: Awaited<ReturnType<typeof setup>>): Promise<void> {
	await value.wrapper.get('[data-rp-form="renovation"]').trigger('submit');
	await value.wrapper.get('[data-rp-form="renovation"]').trigger('submit'); await settle();
}
describe('selected spatial canvas actions', () => {
	it('routes current openings and generic paths to their existing editors and hides unavailable geometry', async () => {
		const value = await setup(); await value.runtime.renovation.perspective('plan');
		const baseline = expectOk(await value.services.read(value.plan.id));
		const structure = { ...value.project.structure, openings: [{ id: 'opening-direct', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		expectOk(await value.runtime.dispatcher.run(value.services.command({ planId: value.plan.id, baseline, structure, ledger: value.runtime.structureTask.ledger })));
		value.selection.select(['opening-direct' as never]); await settle();
		await value.wrapper.get('[data-rp-canvas-edit]').trigger('click'); await settle();
		expect(value.wrapper.find('input[name="offset"]').exists()).toBe(true); value.dialogs.resolve('cancel'); await settle();
		const read = expectOk(await value.renovation.read(value.plan.id));
		const element = { id: 'element-direct-path', kind: 'path' as const, name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }] };
		expectOk(await value.runtime.dispatcher.run(value.renovation.command(read, elementInput(read, element), value.runtime.structureTask.ledger)));
		value.selection.select([element.id as never]); await settle(); await value.wrapper.get('[data-rp-canvas-edit]').trigger('click'); await settle();
		expect(value.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(true); value.dialogs.resolve('cancel'); await settle();
		useWorkspaceStore(value.pinia).toggleLayer('architecture'); await settle(); expect(value.wrapper.find('.rp-direct-actions').exists()).toBe(false);
		value.selection.select(['missing-source' as never]); await settle(); expect(value.wrapper.find('.rp-direct-actions').exists()).toBe(false);
	});
	it('offers supported detail routes without planning services and refuses a paused popup before opening a form', async () => {
		const value = await renovationEditor(); mounted.push(value); value.runtime.renovation.focus(value.room.id, 'overview'); await settle();
		await value.wrapper.get('[data-rp-canvas-detail]').trigger('click');
		expect(value.wrapper.findAll('[data-rp-canvas-detail-mode]')).toHaveLength(3);
		const existing = value.wrapper.get('[data-rp-canvas-detail-mode="existing"]');
		for (const modifiers of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) {
			await existing.trigger('keydown', { key: 'Escape', ...modifiers }); expect(value.wrapper.find('[data-rp-canvas-detail-mode]').exists()).toBe(true);
		}
		value.project.stale = true; await settle();
		await existing.trigger('click'); await value.wrapper.get('[data-rp-canvas-edit]').trigger('click');
		expect(value.dialogs.current).toBeNull(); expect(value.wrapper.get('[data-rp-canvas-edit]').attributes('aria-disabled')).toBe('true');
	});
	it('opens the canonical Room outline form and all eight detail routes without changing selection', async () => {
		const value = await setup(), bytes = [...value.stack.vault.entries];
		await value.wrapper.get('[data-rp-canvas-edit]').trigger('click'); await settle();
		expect(value.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(true);
		value.dialogs.resolve('cancel'); await settle();
		for (const mode of ['existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes']) {
			await detail(value, mode);
			expect(value.dialogs.current?.kind).toBe('form'); expect(value.selection.selectedIds).toEqual([value.room.id]);
			expect(value.session.mode).toBe(mode);
			const evidenceType = value.wrapper.find<HTMLSelectElement>('select[name="type"]');
			expect(evidenceType.exists() ? evidenceType.element.value : null).toBe(mode === 'photos' ? 'photo' : mode === 'notes' ? 'note' : mode === 'documents' ? 'document' : null);
			value.dialogs.resolve('cancel'); await settle();
		}
		expect([...value.stack.vault.entries]).toEqual(bytes);
	});
	it('saves existing Room detail through the popup, preserves its context, and undoes it', async () => {
		const value = await setup(); await detail(value, 'existing');
		await value.wrapper.get('textarea[name="description"]').setValue('Original oak floor');
		await applyDetail(value);
		expect(value.project.plan?.renovation?.subjects[0]).toMatchObject({ roomId: value.room.id, targetId: value.room.id, existing: { description: 'Original oak floor' } });
		expect(value.selection.selectedIds).toEqual([value.room.id]);
		await value.runtime.undo(); expect(value.project.plan?.renovation?.subjects ?? []).toHaveLength(0);
	});
	it('keeps wall length behind Preview/Apply and routes Mark change through Planned authority', async () => {
		const value = await setup();
		value.selection.select(['wall-a' as never]); await settle();
		value.session.roomId = value.room.id; value.session.targetId = 'wall-a'; await settle();
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
	it('dismisses the native detail disclosure with Escape and hides actions for multiple selection and Review', async () => {
		const value = await setup(); await value.wrapper.get('[data-rp-canvas-detail]').trigger('click');
		await value.wrapper.get('[data-rp-canvas-detail-mode="existing"]').trigger('keydown', { key: 'Escape' }); await settle();
		expect(value.wrapper.find('[data-rp-canvas-detail-mode]').exists()).toBe(false);
		expect(document.activeElement).toBe(value.wrapper.get('[data-rp-canvas-detail]').element);
		await value.wrapper.get('[data-rp-canvas-detail]').trigger('keydown', { key: 'Escape' }); await settle();
		expect(value.selection.selectedIds).toEqual([]);
		value.selection.select([value.room.id, 'wall-a' as never]); await settle(); expect(value.wrapper.find('.rp-direct-actions').exists()).toBe(false);
		value.selection.select([value.room.id]); await value.runtime.renovation.perspective('review'); await settle();
		expect(value.wrapper.find('.rp-direct-actions').exists()).toBe(false);
	});
});
