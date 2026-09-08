// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { ElementMove } from '../../../src/presentation/editor/elements/ElementMove';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';

const element: NamedSpatialElement = { id: 'element-path', kind: 'path', name: 'Garden path', points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }] };
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup(saved = false) {
	const r = await renovationEditor(true); mounted.push(r); r.changePlan(); await settle();
	if (saved) {
		const baseline = expectOk(await r.renovation.read(r.plan.id));
		expectOk(await r.runtime.dispatcher.run(r.renovation.command(baseline, elementInput(baseline, element), r.runtime.structureTask.ledger)));
		r.selection.select([element.id as never]); await settle();
	}
	return r;
}
async function begin(r: Awaited<ReturnType<typeof setup>>) {
	r.runtime.setTool('draw-path'); await settleUntil(() => !r.runtime.elementTask.draft.loading, 'element read');
}
describe('generic element recovery and peer-edit protection', () => {
	it('reuses the same creation attempt after a compensated geometry failure', async () => {
		const r = await setup(); await begin(r); const task = r.runtime.elementTask;
		task.draft.name = element.name; task.setPoints(element.points);
		vi.spyOn(r.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
		await task.finish(); await settle(); expect(r.project.structure.elements ?? []).toEqual([]); expect(task.draft.name).toBe(element.name);
		await task.finish(); await settle(); expect(r.project.structure.elements).toHaveLength(1); expect(r.project.plan?.spatialElements?.[0].name).toBe(element.name);
		await r.runtime.undo(); await settle(); expect(r.project.structure.elements ?? []).toEqual([]);
	});
	it.each(['refusal', 'throw'] as const)('recovers an initial %s without discarding the root draft or replaying writes', async failure => {
		const r = await setup(), read = vi.spyOn(r.renovation, 'read');
		if (failure === 'throw') read.mockRejectedValueOnce(new Error('Read offline'));
		else read.mockResolvedValueOnce(err(injectedPersistenceError()));
		await begin(r); const task = r.runtime.elementTask;
		expect(task.needsRead.value).toBe(true); expect(task.draft.error).not.toBeNull();
		task.draft.name = 'Retained route'; task.setPoints(element.points);
		expect(task.canFinish.value).toBe(false); const before = [...r.stack.vault.entries];
		await task.retry(); await settle(); expect([...r.stack.vault.entries]).toEqual(before);
		expect(task.draft.name).toBe('Retained route'); expect(task.draft.points).toEqual(element.points); expect(task.canFinish.value).toBe(true);
		await task.finish(); await settle(); expect(r.project.structure.elements).toHaveLength(1); expect(r.project.plan?.spatialElements?.[0].name).toBe('Retained route');
	});
	it('ignores a late retry after Cancel and a new tool activation', async () => {
		const r = await setup(), original = expectOk(await r.renovation.read(r.plan.id));
		const pending = defer<Awaited<ReturnType<typeof r.renovation.read>>>();
		const read = vi.spyOn(r.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError())).mockReturnValueOnce(pending.promise);
		await begin(r); r.runtime.elementTask.draft.name = 'Cancelled';
		const retry = r.runtime.elementTask.retry(); await settleUntil(() => read.mock.calls.length === 2, 'retry read');
		r.runtime.cancelActiveTask(); r.runtime.setTool('draw-fence'); await settle();
		pending.resolve({ ok: true, value: original }); await retry; await settle();
		expect(r.runtime.elementTask.draft.kind).toBe('fence'); expect(r.runtime.elementTask.draft.name).not.toBe('Cancelled'); expect(r.runtime.elementTask.draft.points).toEqual([]);
		expect(r.project.structure.elements ?? []).toEqual([]);
	});
	it('keeps a drag baseline from overwriting a peer edit after this leaf refreshes', async () => {
		const r = await setup(true), original = expectDefined(r.project.structure.elements?.[0], 'original');
		let completed: Promise<void> = Promise.resolve();
		const move = new ElementMove({ moveElement: (id, points, captured) => { completed = r.runtime.elementActions.move(id, points, captured); } });
		const tool = toolContext(); move.start(tool.context, pointerAt(0, 0), original);
		const baseline = expectOk(await r.geometry.read(r.plan.id));
		const peer = { ...original, points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] };
		expectOk(await r.geometry.write(r.plan.id, { ...baseline.document, structure: { ...expectDefined(baseline.document.structure, 'structure'), elements: [peer] } }, baseline.version));
		await r.runtime.refreshProjection(); const bytes = [...r.stack.vault.entries], write = vi.spyOn(r.geometry, 'write');
		move.finish(tool.context, pointerAt(1000, 1000)); await completed; await settle();
		expect(write).not.toHaveBeenCalled(); expect([...r.stack.vault.entries]).toEqual(bytes); expect(r.project.structure.elements?.[0]).toEqual(peer);
	});
	it('moves and nudges current geometry through one history path while preserving its canonical label', async () => {
		const r = await setup(true), original = expectDefined(r.project.structure.elements?.[0], 'original');
		await r.runtime.elementActions.move(element.id, original.points.map(point => ({ x: point.x + 100, y: point.y + 200 })), original);
		expect(r.project.structure.elements?.[0].points[0]).toEqual({ x: 100, y: 200 });
		await r.runtime.nudgeSelection({ dx: 10, dy: 0 }); await r.runtime.nudgeSelection({ dx: 10, dy: 0 });
		expect(r.project.structure.elements?.[0].points[0]).toEqual({ x: 120, y: 200 });
		await r.runtime.undo(); await r.runtime.undo(); await r.runtime.undo(); await settle();
		expect(r.project.structure.elements?.[0]).toEqual(original); expect(r.project.plan?.spatialElements?.[0].name).toBe(element.name);
	});
	it('retries read-back inside an element edit modal while retaining editable text and the captured baseline', async () => {
		const r = await setup(true), planning = expectDefined(r.deps.commands.planning, 'planning');
		await r.wrapper.get('[data-rp-action="edit-element"]').trigger('click'); await settle();
		const form = r.wrapper.get('[data-rp-form="outline-points"]'), name = form.get<HTMLInputElement>('input[name="name"]');
		await name.setValue('Retained name'); name.element.focus();
		const read = vi.spyOn(planning, 'read').mockResolvedValue(err(injectedPersistenceError()));
		await r.runtime.refreshProjection(); await settle(); expect(document.activeElement).toBe(name.element); expect(name.attributes('readonly')).toBeUndefined();
		await form.get('input[name="1.x"]').setValue('4,5'); const bytes = [...r.stack.vault.entries];
		await form.trigger('submit'); await form.get('.rp-draft-recovery button').trigger('click'); await settle();
		expect([...r.stack.vault.entries]).toEqual(bytes); expect(name.element.value).toBe('Retained name');
		read.mockRestore(); await form.get('.rp-draft-recovery button').trigger('click'); await settle();
		expect(form.find('.rp-draft-recovery').exists()).toBe(false);
		await form.trigger('submit'); await settle(); expect(r.project.plan?.spatialElements?.[0].name).toBe('Retained name'); expect(r.project.structure.elements?.[0].points[1].x).toBe(4500);
	});
});
