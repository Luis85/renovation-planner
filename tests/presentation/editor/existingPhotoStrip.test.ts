// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
it('opens a saved photo from Existing details while retaining the spatial context, camera and vault bytes', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	const roomId = rig.room.id;
	const evidence: Evidence[] = [
		{ id: 'room-photo', roomId, targetId: roomId, workId: '', recordId: '', path: 'scan.png', subpath: '', description: 'Before kitchen work', type: 'photo', phase: 'before', pin: { x: 0.2, y: 0.2 }, date: '2026-08-01' },
		{ id: 'wall-photo', roomId, targetId: 'wall-a', workId: '', recordId: '', path: 'scan.png', subpath: '', description: 'North wall services', type: 'photo', phase: 'hidden-services', pin: { x: 0.8, y: 0.3 }, date: '2026-07-01' },
		{ id: 'room-note', roomId, targetId: roomId, workId: '', recordId: '', path: 'Note.md', subpath: '', description: 'Survey notes', type: 'note', phase: 'before', pin: null },
	];
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)), {
		renovation: { subjects: [], decisions: [], work: [], depth: { ...EMPTY_DEPTH, evidence } }, intended: undefined,
	}, rig.runtime.structureTask.ledger)));
	const editor = useEditorStore(rig.pinia), bytes = [...rig.stack.vault.entries], camera = { ...editor.viewport };
	rig.runtime.renovation.focus(roomId, 'existing'); await settle();
	const strip = rig.wrapper.get('.rp-existing-photo-strip');
	expect(strip.findAll('[data-rp-evidence-photo]').map(button => button.attributes('data-rp-evidence-photo'))).toEqual(['wall-photo', 'room-photo']);
	expect(rig.wrapper.find('.rp-direct-actions').exists()).toBe(false);
	const workspace = useWorkspaceStore(rig.pinia);
	workspace.layerVisibility.annotation = false; await settle(); expect(rig.wrapper.find('.rp-existing-photo-strip').exists()).toBe(false);
	workspace.layerVisibility.annotation = true; await settle();
	await rig.wrapper.get('[data-rp-evidence-photo="room-photo"]').trigger('click'); await settle();
	expect(rig.session).toMatchObject({ mode: 'photos', focusedId: 'room-photo', targetId: roomId });
	expect(rig.wrapper.find('.rp-existing-photo-strip').exists()).toBe(false);
	expect(rig.wrapper.get('[data-rp-record="room-photo"]').classes()).toContain('is-selected');
	expect(rig.selection.selectedIds).toEqual([roomId]); expect(editor.viewport).toEqual(camera);
	rig.selection.select(['wall-a' as never]); await settle();
	await rig.wrapper.get('.rp-structure-renovation-entry select').setValue(roomId); await settle();
	rig.runtime.renovation.focus(roomId, 'existing'); await settle();
	expect(rig.wrapper.get('.rp-existing-photo-strip').findAll('[data-rp-evidence-photo]').map(button => button.attributes('data-rp-evidence-photo'))).toEqual(['wall-photo']);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	const thumbnail = rig.wrapper.get<HTMLButtonElement>('[data-rp-evidence-photo="wall-photo"]').element;
	thumbnail.focus(); expect(document.activeElement).toBe(thumbnail);
	const current = expectFound(await rig.stack.plans.getById(rig.plan.id));
	const renovation = expectDefined(current.entity.renovation, 'saved renovation');
	expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(current.entity, {
		...renovation, depth: { ...EMPTY_DEPTH, evidence: evidence.filter(item => item.id !== 'wall-photo') },
	})), current.version));
	rig.changePlan(); await settle();
	expect(rig.wrapper.find('.rp-existing-photo-strip').exists()).toBe(false);
	expect(document.activeElement).toBe(rig.wrapper.get('.rp-plan-canvas').element);
	rig.selection.select([roomId]); rig.runtime.renovation.focus(roomId, 'existing'); await settle();
	expect(rig.wrapper.find('.rp-existing-photo-strip').exists()).toBe(true);
	const external = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="select"]').element, retained = [...rig.stack.vault.entries];
	external.focus(); workspace.layerVisibility.annotation = false; await settle();
	expect(rig.wrapper.find('.rp-existing-photo-strip').exists()).toBe(false);
	expect(document.activeElement).toBe(external); expect([...rig.stack.vault.entries]).toEqual(retained);
});
