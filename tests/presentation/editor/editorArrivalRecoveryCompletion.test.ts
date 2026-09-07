// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import type { ProjectOrigin } from '../../../src/application/navigation/ProjectDestination';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';
import { EMPTY_DEPTH, type CostRecord } from '../../../src/domain/renovation/PlanningDepth';
import { of } from '../../../src/core/money/Money';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	const work = { id: 'arrival-work', roomId: rig.room.id, targetId: rig.room.id, title: 'Prepare floor', description: '', order: 0,
		progress: 'pending' as const, responsibility: 'diy' as const, outcomes: [], dependencies: [] };
	const cost: CostRecord = { id: 'arrival-cost', roomId: rig.room.id, targetId: rig.room.id, workId: work.id, title: 'Floor preparation',
		category: 'labor', requirementId: '', planned: of('125.005', 'EUR'), facts: [], cancelled: false };
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [work], decisions: [], depth: { ...EMPTY_DEPTH, costs: [cost] } }, intended: baseline.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	await settle();
	// This is PlanEditorRoot's exposed host arrival API, also used by PlanEditorView.
	const navigate = (rig.wrapper.vm as unknown as { navigateToRecord(origin: ProjectOrigin): Promise<boolean> }).navigateToRecord;
	return { ...rig, navigate, cost, origin: { planId: rig.plan.id, costId: cost.id } };
}
async function draft(rig: Awaited<ReturnType<typeof setup>>) {
	rig.runtime.setTool('draw-path'); await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'path baseline');
	rig.runtime.elementTask.draft.name = 'Retained garden route'; rig.runtime.elementTask.draft.text.x = '3,75'; await settle();
}
async function failRead(rig: Awaited<ReturnType<typeof setup>>) {
	const planning = expectDefined(rig.deps.commands.planning, 'planning');
	const read = vi.spyOn(planning, 'read').mockResolvedValue(err(injectedPersistenceError()));
	rig.changeCatalogue(); await settleUntil(() => rig.runtime.writesBlocked.value, 'planning read failure');
	return read;
}
function answer(rig: Awaited<ReturnType<typeof setup>>, choice: 'cancel' | 'confirm') {
	rig.wrapper.get<HTMLButtonElement>(`[data-rp-action="${choice}"]`).element.click();
}

describe('real Cost and Room arrival recovery', () => {
	it('derives the Room from the saved Cost and reuses the mounted editor without writing', async () => {
		const rig = await setup(), stage = rig.stage, root = rig.wrapper.element, bytes = [...rig.stack.vault.entries];
		rig.selection.clear(); await settle();
		expect(await rig.navigate(rig.origin)).toBe(true); await settle();
		expect(rig.session).toMatchObject({ mode: 'costs', perspective: 'renovate', roomId: rig.room.id, focusedId: rig.cost.id });
		expect(rig.wrapper.get(`[data-rp-record="${rig.cost.id}"]`).text()).toContain(rig.cost.title);
		expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.stage).toBe(stage); expect(rig.wrapper.element).toBe(root);
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('returns from Cost detail to a Room-only overview with no invented record identity', async () => {
		const rig = await setup(); expect(await rig.navigate(rig.origin)).toBe(true); await settle();
		const bytes = [...rig.stack.vault.entries];
		expect(await rig.navigate({ planId: rig.plan.id, roomId: rig.room.id })).toBe(true); await settle();
		expect(rig.session).toMatchObject({ mode: 'overview', roomId: rig.room.id, focusedId: '', perspective: 'renovate' });
		expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('refuses a queued Cost arrival when a peer removes its record before read recovery', async () => {
		const rig = await setup(), read = await failRead(rig), warning = vi.spyOn(notices, 'notifyWarning').mockImplementation(() => undefined);
		expect(await rig.navigate(rig.origin)).toBe(true);
		const baseline = expectOk(await rig.renovation.read(rig.plan.id)), renovation = expectDefined(baseline.plan.entity.renovation, 'renovation');
		const depth = expectDefined(renovation.depth, 'planning depth');
		const peer = expectOk(withPlanRenovation(baseline.plan.entity, { ...renovation, depth: { ...depth, costs: [] } }));
		expectOk(await rig.stack.plans.save(peer, baseline.plan.version));
		const bytes = [...rig.stack.vault.entries];
		read.mockRestore(); await rig.runtime.refreshProjection(); await settle();
		expect(warning).toHaveBeenCalledOnce(); expect(rig.session.focusedId).not.toBe(rig.cost.id);
		expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('keeps a queued arrival cancelled through later refreshes without discarding the native path draft', async () => {
		const rig = await setup(); await draft(rig); const read = await failRead(rig);
		expect(await rig.navigate(rig.origin)).toBe(true); const bytes = [...rig.stack.vault.entries];
		read.mockRestore(); await rig.runtime.refreshProjection(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'queued arrival confirmation');
		answer(rig, 'cancel'); await settle(); await rig.runtime.refreshProjection(); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.activeToolId.value).toBe('draw-path');
		expect(rig.runtime.elementTask.draft).toMatchObject({ name: 'Retained garden route', text: { x: '3,75' } });
		expect(rig.session.focusedId).not.toBe(rig.cost.id); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('defers a confirmed arrival when planning fails during confirmation, retaining the draft until recovery is confirmed', async () => {
		const rig = await setup(); await draft(rig);
		const arrival = rig.navigate(rig.origin); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'arrival confirmation');
		const read = await failRead(rig), bytes = [...rig.stack.vault.entries];
		answer(rig, 'confirm'); expect(await arrival).toBe(true); await settle();
		expect(rig.runtime.activeToolId.value).toBe('draw-path'); expect(rig.runtime.elementTask.draft.name).toBe('Retained garden route');
		read.mockRestore(); await rig.runtime.refreshProjection(); await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'recovered arrival confirmation');
		answer(rig, 'confirm'); await settle();
		expect(rig.session).toMatchObject({ mode: 'costs', roomId: rig.room.id, focusedId: rig.cost.id });
		expect(rig.runtime.activeToolId.value).toBe('select'); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
