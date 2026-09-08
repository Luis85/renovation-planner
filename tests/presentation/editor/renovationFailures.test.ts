import { withPlanRenovation } from '../../../src/domain/plan/Plan';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { err, ok } from '../../../src/core/result/Result';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { removeRenovationRecord } from '../../../src/presentation/editor/renovation/renovationRemoval';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { defer } from '../../helpers/async';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
const fault = { category: 'Persistence' as const, code: 'renovation.write-failed', message: 'Disk unavailable' };
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(); mounted.push(rig); rig.runtime.renovation.focus(rig.room.id, 'existing'); await settle(); return rig; }
async function draft(rig: Awaited<ReturnType<typeof setup>>) {
	const pending = rig.runtime.renovation.edit('existing', rig.room.id); await settle();
	const form = rig.wrapper.get('[data-rp-form="renovation"]'); await form.trigger('submit'); expect(rig.wrapper.find('[role="alert"]').exists()).toBe(true);
	await rig.wrapper.get('textarea[name="description"]').setValue('Timber'); await form.trigger('submit'); return { pending, form };
}
describe('renovation UI failure boundaries', () => {
	it('finishes an authorized save after leaf disposal without reopening the form or stealing focus', async () => {
		const rig = await setup(), { pending, form } = await draft(rig), saving = defer<void>(), entered = defer<void>();
		const save = rig.stack.plans.save.bind(rig.stack.plans);
		vi.spyOn(rig.stack.plans, 'save').mockImplementationOnce(async (...args) => { entered.resolve(undefined); await saving.promise; return save(...args); });
		const run = vi.spyOn(rig.runtime.dispatcher, 'run');
		await form.trigger('submit'); await entered.promise;
		expect(rig.wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		rig.unmount(); await pending;
		const outside = document.createElement('button'); outside.textContent = 'Another leaf'; document.body.append(outside); outside.focus();
		try {
			saving.resolve(undefined); expectOk(await run.mock.results[0].value as DispatchResult); await settle();
			expect(expectOk(await rig.renovation.read(rig.plan.id)).plan.entity.renovation?.subjects[0].existing?.description).toBe('Timber');
			expect(rig.project.plan?.renovation).toBeUndefined(); expect(rig.dialogs.current).toBeNull();
			expect(document.activeElement).toBe(outside); expect(document.querySelector('[data-rp-form="renovation"]')).toBeNull();
		} finally { outside.remove(); }
	});
	it('keeps invalid and failed drafts, gates duplicate submission and retries a recoverable failure', async () => {
		const rig = await setup(), { pending, form } = await draft(rig);
		const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('disk'));
		await form.trigger('submit'); await settle(); expect(rig.wrapper.get('textarea').element.value).toBe('Timber');
		let resolve!: (value: DispatchResult) => void; run.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
		await form.trigger('submit'); await form.trigger('submit'); expect(run).toHaveBeenCalledTimes(2);
		await rig.runtime.renovation.perspective('review'); expect(rig.session.perspective).toBe('renovate');
		resolve(err(fault)); await settle(); expect(rig.wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('false');
		await form.trigger('submit'); await pending; expect(rig.project.plan?.renovation?.subjects).toHaveLength(1);
	});
	it('retains conflicted text and blocks a stale projection even with a fresh persistence baseline', async () => {
		const rig = await setup(), { pending, form } = await draft(rig);
		vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Validation', code: 'plan.revision-conflict', message: 'Peer' }));
		await form.trigger('submit'); await settle(); expect(rig.wrapper.get('textarea').element.value).toBe('Timber'); expect(rig.wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		rig.dialogs.resolve('cancel'); await pending;
		const before = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(before.plan.entity, { subjects: [], work: [{ id: 'work-peer', roomId: rig.room.id, targetId: rig.room.id, title: 'Peer work', description: '', progress: 'pending', responsibility: 'unassigned', order: 0, outcomes: [], dependencies: [] }], decisions: [] })), before.plan.version));
		await rig.runtime.renovation.edit('existing', rig.room.id); expect(rig.dialogs.current).toBeNull(); expect(rig.project.plan?.renovation?.work[0].title).toBe('Peer work');
	});
	it('does not resurrect a pending read or write after leaf disposal', async () => {
		const rig = await setup(); let resolve!: (value: Awaited<ReturnType<typeof rig.renovation.read>>) => void;
		const baseline = expectOk(await rig.renovation.read(rig.plan.id)); vi.spyOn(rig.renovation, 'read').mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
		const pending = rig.runtime.renovation.edit('existing', rig.room.id); rig.unmount(); resolve(ok(baseline)); await pending; expect(rig.dialogs.current).toBeNull();
		const second = await setup(), editing = await draft(second); let reject!: (cause: Error) => void;
		vi.spyOn(second.runtime.dispatcher, 'run').mockImplementationOnce(() => new Promise((_resolve, _reject) => { void _resolve; reject = _reject; })); await editing.form.trigger('submit'); second.unmount(); reject(new Error('late')); await editing.pending; expect(second.project.plan?.renovation).toBeUndefined();
	});
	it('handles cancellation, stale and saving gates, refused/thrown reads and changed selection during a read', async () => {
		const rig = await setup(), actions = rig.runtime.renovation;
		rig.project.stale = true; await actions.edit('existing', rig.room.id); expect(rig.dialogs.current).toBeNull(); rig.project.stale = false;
		const save = useSaveStateStore(rig.pinia); save.beginSaving(); actions.focus(rig.room.id, 'work'); await actions.edit('existing', rig.room.id); expect(rig.session.mode).toBe('existing'); save.resolveOk();
		vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(fault)).mockRejectedValueOnce(new Error('read'));
		await actions.edit('existing', rig.room.id); await actions.edit('existing', rig.room.id); expect(rig.dialogs.current).toBeNull();
		const baseline = expectOk(await rig.renovation.read(rig.plan.id)); let resolve!: (value: ReturnType<typeof ok<typeof baseline>>) => void;
		vi.spyOn(rig.renovation, 'read').mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; })); const pending = actions.edit('existing', rig.room.id);
		rig.selection.select(['wall-a' as never]); resolve(ok(baseline)); await pending; expect(rig.dialogs.current).toBeNull();
	});
	it('requires draft confirmation on perspective switches and cancels or applies deletion explicitly', async () => {
		const rig = await setup(), actions = rig.runtime.renovation;
		await actions.perspective('plan'); rig.runtime.setTool('draw-wall'); await settle(); rig.runtime.structureTask.addNumeric();
		let pending = actions.perspective('review'); await settle(); rig.dialogs.resolve('cancel'); await pending; expect(rig.runtime.activeToolId.value).toBe('draw-wall');
		pending = actions.perspective('review'); await settle(); rig.dialogs.resolve('confirm'); await pending; expect(rig.runtime.activeToolId.value).toBe('select');
		rig.runtime.setTool('draw-wall'); expect(rig.runtime.activeToolId.value).toBe('select');
		await actions.perspective('renovate'); actions.focus(rig.room.id, 'existing');
		const editing = await draft(rig); await editing.form.trigger('submit'); await editing.pending;
		const id = rig.project.plan?.renovation?.subjects[0].id as string;
		const make = (read: Parameters<typeof removeRenovationRecord>[0]) => removeRenovationRecord(read, id, false);
		pending = actions.change(make, 'Timber'); await settle(); rig.dialogs.resolve('cancel'); await pending; expect(rig.project.plan?.renovation?.subjects).toHaveLength(1);
		pending = actions.change(make, 'Timber'); await settle(); rig.dialogs.resolve('confirm'); await pending; expect(rig.project.plan?.renovation?.subjects).toHaveLength(0);
	});
 it('retains tool drafts when context navigation is cancelled and reports failed confirmed changes', async () => {
  const rig = await setup(), actions = rig.runtime.renovation;
  await actions.perspective('plan'); rig.runtime.setTool('draw-wall'); await settle();
  actions.focus(rig.room.id, 'work'); await settle(); rig.dialogs.resolve('cancel'); await settle(); expect(rig.runtime.activeToolId.value).toBe('draw-wall');
  actions.focus(rig.room.id, 'work'); await settle(); rig.dialogs.resolve('confirm'); await settle(); expect(rig.session.mode).toBe('work'); expect(rig.session.perspective).toBe('renovate');
  const make = (read: Parameters<typeof removeRenovationRecord>[0]) => removeRenovationRecord(read, rig.room.id, false);
  vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(fault)); await actions.change(make, 'Check'); expect(rig.dialogs.current).toBeNull();
  vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(fault)).mockRejectedValueOnce(new Error('late disk fault'));
  for (let i = 0; i < 2; i++) { const pending = actions.change(make, 'Check'); await settle(); rig.dialogs.resolve('confirm'); await pending; expect(rig.project.plan?.renovation).toBeUndefined(); }
  rig.project.stale = true; await actions.change(make, 'Check'); expect(rig.dialogs.current).toBeNull();
 });

});
