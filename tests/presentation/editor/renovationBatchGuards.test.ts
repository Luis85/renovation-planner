// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { err, ok } from '../../../src/core/result/Result';
import type { BatchTarget } from '../../../src/presentation/editor/renovation/renovationBatch';
import { structureEditor } from '../../helpers/structureEditor';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig);
	rig.selection.select(['wall-a', 'wall-b'] as never[]); await settle();
	const targets: BatchTarget[] = ['wall-a', 'wall-b'].map(targetId => ({ roomId: rig.room.id, targetId, name: targetId, kind: 'wall' }));
	return { ...rig, targets };
}
it('rejects unavailable, single-target and failed-read batches without opening a stale dialog', async () => {
	const rig = await setup(), batch = rig.runtime.renovation.batch;
	await batch('work', []); expect(rig.dialogs.current).toBeNull();
	rig.project.stale = true; await batch('work', rig.targets); expect(rig.dialogs.current).toBeNull(); rig.project.stale = false;
	const read = vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err({ category: 'Persistence', code: 'read.failed', message: 'Unavailable' })).mockRejectedValueOnce(new Error('offline'));
	await batch('work', rig.targets); await batch('work', rig.targets); expect(rig.dialogs.current).toBeNull(); expect(read).toHaveBeenCalledTimes(2);
});
it.each(['selection', 'dispose'] as const)('abandons a pending batch read after %s changes', async change => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id)), pending = defer<Awaited<ReturnType<typeof rig.renovation.read>>>();
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(pending.promise);
	const opening = rig.runtime.renovation.batch('modify', rig.targets);
	if (change === 'selection') rig.selection.clear(); else rig.unmount();
	pending.resolve(ok(baseline)); await opening; expect(rig.dialogs.current).toBeNull();
});
it('keeps unsupported Area combinations explicit and exposes the current-geometry deletion action', async () => {
	const rig = await setup();
	await rig.wrapper.get('[data-rp-batch="delete"]').trigger('click'); await settle();
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Wall 1, Wall 2'); rig.dialogs.resolve('cancel'); await settle();
	const area = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Wet area', zoneType: 'ConstructionArea', geometry: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] } })).zone.entity;
	rig.selection.select([rig.room.id, area.id]); await settle();
	expect(rig.wrapper.get('[data-rp-batch="work"]').attributes('disabled')).toBeDefined();
	expect(rig.wrapper.get('[data-rp-batch="delete"]').attributes('disabled')).toBeDefined();
	rig.selection.select([rig.room.id, 'wall-a' as never]); await settle();
	await rig.wrapper.get('.rp-batch-actions select').setValue(rig.room.id);
	expect(rig.wrapper.get('[data-rp-batch="work"]').attributes('disabled')).toBeUndefined();
	expect(rig.wrapper.get('[data-rp-batch="modify"]').attributes('disabled')).toBeDefined();
});
it.each(['door', 'window', 'opening'] as const)('includes a selected hosted %s in a reversible modification batch', async kind => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
	const opening = { id: 'opening-shared', hostId: 'wall-a', kind, offset: 100, width: 900, height: 2000, sill: 0 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { walls: before.document.structure?.walls ?? [], boundaries: [], openings: [opening] } }, before.version));
	await rig.runtime.refreshProjection(); rig.selection.select(['wall-a', opening.id] as never[]); await settle();
	await rig.wrapper.get('.rp-batch-actions select').setValue(rig.room.id);
	await rig.wrapper.get('[data-rp-batch="modify"]').trigger('click'); await settle();
	await rig.wrapper.get('input[name="batch-title"]').setValue('Refinish both surfaces');
	await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await settle();
	expect(rig.project.plan?.renovation?.subjects.find(item => item.targetId === opening.id)).toMatchObject({ kind: kind === 'opening' ? 'other' : kind, planned: { change: 'modify' } });
	expect(rig.project.structure.openings).toEqual([opening]);
	expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.subjects ?? []).toHaveLength(0);
});
it('shares Work between two Rooms without requiring a wall-first floor plan', async () => {
	const rig = await structureEditor(true);
	try {
		const rooms = [];
		for (const name of ['Kitchen', 'Living room']) rooms.push(expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name, zoneType: 'Room', geometry: { points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }] } })).zone.entity);
		await rig.runtime.refreshProjection(); rig.selection.select(rooms.map(room => room.id)); await settle();
		expect(rig.wrapper.find('.rp-batch-actions select').exists()).toBe(false);
		await rig.wrapper.get('[data-rp-batch="work"]').trigger('click'); await settle();
		await rig.wrapper.get('input[name="batch-title"]').setValue('Prepare both rooms');
		await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await rig.wrapper.get('[data-rp-form="renovation-batch"]').trigger('submit'); await settle();
		expect(rig.project.plan?.renovation?.work[0]).toMatchObject({ roomId: rooms[0].id, targetId: rooms[0].id, links: [{ roomId: rooms[1].id, targetId: rooms[1].id }] });
		expect(rig.project.structure.walls).toEqual([]);
		expectOk(await rig.runtime.dispatcher.undo()); await settle(); expect(rig.project.plan?.renovation?.work ?? []).toEqual([]);
	} finally { rig.unmount(); }
});
