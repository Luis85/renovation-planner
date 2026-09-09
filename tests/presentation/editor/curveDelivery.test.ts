// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { roomEdges } from '../../../src/presentation/editor/resize/roomEdgeMeasurements';
import { formatMetres } from '../../../src/presentation/editor/shell/formatLength';
import { PlanGeometryStore } from '../../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(baseline.document.structure, 'walls');
	const original = { ...baseline.document,
		objects: baseline.document.objects.map(object => object.id === rig.room.id ? { ...object, bulges: [0.123456789, 0, 0, 0] } : object),
		groups: [{ id: 'group-curves', name: '  Curved assembly  ', memberIds: ['wall-a', rig.room.id] }],
		intended: structure,
		structure: { ...structure, openings: [{ id: 'opening-curves', hostId: 'wall-a', kind: 'door' as const, offset: 500, width: 800, height: 2100, sill: 0, swing: { hinge: 'end' as const, side: 'right' as const, angle: 65 } }] },
	};
	expectOk(await rig.geometry.write(rig.plan.id, original, baseline.version)); await rig.runtime.refreshProjection(); await settle();
	const stack = rig.stack;
	const fresh = () => new ObsidianPlanGeometrySidecar(new PlanGeometryStore(stack.deps.vault, stack.deps.fileManager, stack.index, stack.migrations, stack.echo));
	return { ...rig, task: rig.runtime.curveTask, original, fresh };
}

it('leaves an untouched precise curve and a cancelled edit byte-for-byte unchanged', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	await rig.task.open(rig.room.id); rig.task.choose(2); rig.task.choose(0); await rig.task.finish(); await settle();
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	await rig.task.open(rig.room.id); rig.task.input('depth', '0.9'); rig.task.cancel(); await settle();
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps a completed write exact when the leaf closes before its receipt returns', async () => {
	const rig = await setup(); await rig.task.open(rig.room.id); rig.task.input('depth', '0.625123456');
	const expected = expectDefined(rig.task.preview.value, 'preview'), committed = defer<void>(), release = defer<void>();
	const originalWrite = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		const result = await originalWrite(...args); committed.resolve(undefined); await release.promise; return result;
	});
	const finish = rig.task.finish(); await committed.promise;
	rig.unmount(); mounted.pop(); release.resolve(undefined); await finish;
	expect(write).toHaveBeenCalledOnce(); expect(rig.task.target.value).toBeNull();
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected);
});

it('does not replay a saved curve after failed readback and repeated retries, and preserves exact metadata through history and a fresh store', async () => {
	const rig = await setup(); await rig.task.open(rig.room.id); rig.task.input('radius', '4.123456789');
	const expected = expectDefined(rig.task.preview.value, 'preview'), write = vi.spyOn(rig.geometry, 'write');
	const read = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.task.finish(); await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true); expect(rig.task.target.value).toBeNull();
	const bytes = [...rig.stack.vault.entries];
	for (let retry = 0; retry < 3; retry++) { await rig.runtime.refreshProjection(); await rig.task.finish(); }
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(write).toHaveBeenCalledOnce();
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected);
	read.mockRestore(); await rig.runtime.refreshProjection(); await settle();
	expect(rig.runtime.writesBlocked.value).toBe(false); expect(write).toHaveBeenCalledOnce();
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	await rig.runtime.redo(); await settle(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected);
	expect(write).toHaveBeenCalledTimes(3);
});

it('retains a refused write draft and never retries it implicitly during refresh', async () => {
	const rig = await setup(); await rig.task.open(rig.room.id); rig.task.input('depth', '0.375123456');
	const draft = rig.task.target.value, text = { ...rig.task.state.text }, bytes = [...rig.stack.vault.entries];
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.task.finish(); await settle();
	expect(rig.task.target.value).toEqual(draft); expect(rig.task.state.text).toEqual(text); expect(rig.task.state.error?.category).toBe('Persistence');
	await rig.runtime.refreshProjection(); await rig.task.finish();
	expect(write).toHaveBeenCalledOnce(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.task.cancel(); await settle(); await rig.task.open(rig.room.id);
	expect(rig.task.target.value?.geometry.bulges?.[0]).toBe(0.123456789);
});

it('refuses a self-intersecting curve draft without repairing points or writing', async () => {
	const rig = await setup(); await rig.task.open(rig.room.id);
	for (let edge = 0; edge < 4; edge++) rig.task.set(edge, -1);
	const draft = rig.task.target.value, bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	expect(rig.task.validation.value?.code).toBe('curve-self-intersection');
	await rig.task.finish(); expect(rig.task.target.value).toEqual(draft); expect(write).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('measures every curved Room edge during point editing and rotation, then restores the exact saved geometry', async () => {
	const rig = await setup(), room = expectDefined(rig.project.zones.get(rig.room.id), 'Room');
	const labels = () => rig.wrapper.findAll('[data-rp-room-edge]').map(label => label.get('[aria-hidden="true"]').text());
	const lengths = (points: typeof room.points) => roomEdges(points, true, false, room.bulges).map(edge => `${formatMetres(edge.length)} m`);
	expect(labels()).toEqual(lengths(room.points));
	const first = room.points[0];
	rig.runtime.toolManager.pointerDown(pointerAt(first.x, first.y));
	rig.runtime.toolManager.pointerMove(pointerAt(first.x - 400, first.y - 300)); await settle();
	const points = expectDefined(rig.runtime.renderState.previewPolygon, 'point preview');
	expect(points[0]).not.toEqual(first); expect(labels()).toEqual(lengths(points));
	rig.runtime.toolManager.pointerUp(pointerAt(first.x - 400, first.y - 300));
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.points[0].x !== first.x, 'saved point');
	expect(rig.project.zones.get(rig.room.id)?.bulges).toEqual(room.bulges);
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	void rig.runtime.rotationActions.rotate(rig.room.id);
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'rotation form');
	const angle = rig.wrapper.get('[data-rp-form="object-rotation"] [name="angle"]');
	await angle.setValue('37'); await settle(); expect(labels()).toEqual(lengths(room.points));
	await rig.wrapper.get('[data-rp-form="object-rotation"]').trigger('submit'); await settle();
	expect(rig.project.zones.get(rig.room.id)?.bulges).toEqual(room.bulges);
	const rotated = expectOk(await rig.fresh().read(rig.plan.id)).document;
	expect(rotated.objects).not.toEqual(rig.original.objects);
	await rig.runtime.undo(); await settle(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	await rig.runtime.redo(); await settle(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rotated);
});
