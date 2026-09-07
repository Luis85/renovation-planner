// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import type { EditorNavigation } from '../../../src/presentation/editor/PlanEditorContext';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { tr } from '../../../src/presentation/i18n/strings';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

it('opens Schedule from an unfocused Work collection with only its real Room origin', async () => {
	const downstream = vi.fn<NonNullable<EditorNavigation['downstream']>>().mockResolvedValue(undefined);
	const navigation: EditorNavigation = { downstream, project: vi.fn<EditorNavigation['project']>().mockResolvedValue(undefined), library: vi.fn<EditorNavigation['library']>() };
	const rig = await renovationEditor(true, navigation); mounted.push(rig);
	const work = { id: 'work-collection-navigation', roomId: rig.room.id, targetId: rig.room.id, title: 'Prepare walls', description: '', order: 0,
		progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [work], decisions: [], depth: EMPTY_DEPTH },
		intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'work'); await settle();
	expect(rig.session.focusedId).toBe(''); expect(rig.wrapper.text()).toContain(work.title);
	const bytes = [...rig.stack.vault.entries], stage = rig.stage, root = rig.wrapper.element, run = vi.spyOn(rig.runtime.dispatcher, 'run');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-downstream="schedule"]').element.click(); await settle();
	expect(downstream).toHaveBeenCalledExactlyOnceWith(rig.plan.projectId, { section: 'schedule', origin: { planId: rig.plan.id, roomId: rig.room.id } });
	expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.session.focusedId).toBe('');
	expect(rig.stage).toBe(stage); expect(rig.wrapper.element).toBe(root); expect(run).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('names both Wall and Opening in native batch deletion, cancels safely and undoes the exact confirmed relationship', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(baseline.document.structure, 'walls');
	const opening = { id: 'opening-batch-door', hostId: 'wall-a', kind: 'door' as const, offset: 500, width: 900, height: 2000, sill: 0 };
	const structure = { ...current, openings: [opening] };
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.runtime.structureTask.ledger })));
	rig.selection.select(['wall-a', opening.id] as never[]); await settle();
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document, bytes = [...rig.stack.vault.entries], room = rig.project.zones.get(rig.room.id);
	const run = vi.spyOn(rig.runtime.dispatcher, 'run');
	const open = () => {
		const details = expectDefined(rig.wrapper.get<HTMLButtonElement>('[data-rp-batch="delete"]').element.closest('details'), 'batch disclosure');
		if (!details.open) expectDefined(details.querySelector('summary'), 'batch disclosure control').click();
		rig.wrapper.get<HTMLButtonElement>('[data-rp-batch="delete"]').element.click();
	};
	open(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'mixed deletion confirmation');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Wall 1');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain(tr('renovation.geometry.opening'));
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Openings removed: 1');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click(); await settle();
	expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	open(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'confirmed mixed deletion');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="confirm"]').element.click();
	await settleUntil(() => !rig.runtime.structureActions.active.value, 'mixed deletion read-back');
	expect(run).toHaveBeenCalledOnce(); expect(rig.project.structure.walls.map(wall => wall.id)).toEqual(['wall-b', 'wall-c', 'wall-d']);
	expect(rig.project.structure.openings).toEqual([]); expect(rig.project.zones.get(rig.room.id)).toEqual(room);
	expectOk(await rig.runtime.dispatcher.undo()); await settle();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	expect(rig.project.structure.openings).toEqual([opening]); expect(rig.project.zones.get(rig.room.id)).toEqual(room);
});
