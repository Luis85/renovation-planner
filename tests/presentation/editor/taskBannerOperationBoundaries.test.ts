// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }

it('applies a reviewed curve from its canvas task banner and restores the original document with undo', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	await rig.wrapper.get('[data-rp-action="edit-curves"]').trigger('click'); await settleUntil(() => rig.runtime.curveTask.target.value !== null, 'curve baseline');
	await rig.wrapper.get('[data-rp-form="edit-curves"] input[name="depth"]').setValue('0.25');
	const gate = defer<void>(), persist = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate.promise; return persist(...args); });
	await rig.wrapper.get('.rp-task-banner__finish').trigger('click');
	try {
		await settleUntil(() => write.mock.calls.length === 1, 'pending curve Apply');
		const cancel = rig.wrapper.get('.rp-task-banner__cancel'); expect(cancel.attributes('aria-disabled')).toBe('true');
		await cancel.trigger('click'); expect(rig.runtime.activeToolId.value).toBe('edit-curves');
		gate.resolve(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'banner curve Apply');
		expect(write).toHaveBeenCalledTimes(1); expect(rig.project.zones.get(rig.room.id)?.bulges?.[0]).toBeCloseTo(0.125);
		await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	} finally { gate.resolve(); }
});

it('finishes a wall entered in native numeric fields through the same canvas banner command', async () => {
	const rig = await setup(), task = rig.runtime.structureTask, before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline'); await settle();
	const form = rig.wrapper.get('.rp-structure-task');
	await form.get('input[name="x"]').setValue('6'); await form.get('input[name="y"]').setValue('0.5'); await form.trigger('submit');
	await form.get('input[name="length"]').setValue('2'); await form.get('input[name="angle"]').setValue('0'); await form.trigger('submit');
	expect(task.draft.points).toEqual([{ x: 6000, y: 500 }, { x: 8000, y: 500 }]);
	const write = vi.spyOn(rig.geometry, 'write'); await rig.wrapper.get('.rp-task-banner__finish').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'banner wall finish');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.walls).toHaveLength(5);
	expect(rig.project.structure.walls[4]).toMatchObject({ start: { x: 6000, y: 500 }, end: { x: 8000, y: 500 } });
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});

it('keeps the Room task and reviewed dimensions when free-form switching is pressed during pending creation', async () => {
	const rig = await setup(); rig.runtime.setTool('draw-room'); await settle();
	const draft = rig.runtime.roomDraft; draft.setName('Pending room');
	draft.commitDimension('width', '4', () => ({ x: 6000, y: 500 })); draft.commitDimension('depth', '3', () => ({ x: 6000, y: 500 })); await settle();
	const points = draft.geometry?.points, gate = defer<void>(), execute = rig.deps.commands.createZone.execute.bind(rig.deps.commands.createZone);
	const creating = vi.spyOn(rig.deps.commands.createZone, 'execute').mockImplementationOnce(async (...args) => { await gate.promise; return execute(...args); });
	await rig.wrapper.get('.rp-task-banner__finish').trigger('click');
	try {
		await settleUntil(() => creating.mock.calls.length === 1, 'held Room creation');
		const free = rig.wrapper.get('.rp-task-banner [data-rp-action="draw-free-room"]');
		expect(free.attributes('aria-disabled')).toBe('true');
		await free.trigger('click'); await settle();
		expect(rig.runtime.activeToolId.value).toBe('draw-room'); expect(draft.geometry?.points).toEqual(points); expect(draft.name).toBe('Pending room');
		expect(creating).toHaveBeenCalledTimes(1); gate.resolve();
		await settleUntil(() => !draft.submitting, 'Room creation completed'); await settle();
		expect([...rig.project.zones.values()].find(zone => zone.name === 'Pending room')?.points).toEqual(points);
	} finally { gate.resolve(); }
});
