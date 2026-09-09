// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await groupEditor(); mounted.push(rig); return rig; }
function action(rig: Awaited<ReturnType<typeof groupEditor>>, id: string) {
	return expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(item => item.id === id), id);
}
it('regroups a long-named Room with a bounded default name and expands the real transient member IDs', async () => {
	const rig = await setup(); await action(rig, 'ungroup').run();
	const before = expectFound(await rig.stack.zones.getById(rig.room.id));
	expectOk(await rig.stack.zones.save(expectOk(before.entity.withName('Kitchen '.repeat(20))), before.version));
	await rig.runtime.refreshProjection();
	const ids = [rig.room.id, rig.project.structure.walls[0].id as never]; rig.selection.select(ids); await settle();
	expect(rig.runtime.groupActions.expandSelection('selection-group')).toEqual(ids);
	await action(rig, 'group').run(); await settle();
	expect(rig.project.groups[0].name).toBe('Group 1'); expect(rig.project.groups[0].memberIds).toEqual(ids);
	expect(expectFound(await rig.stack.zones.getById(rig.room.id)).entity.name).toBe('Kitchen '.repeat(20).trim());
});
it.each(['group', 'ungroup'] as const)('refuses a previously offered %s action while a numeric rotation owns the input', async kind => {
	const rig = await setup();
	if (kind === 'group') await action(rig, 'ungroup').run();
	const captured = action(rig, kind), bytes = [...rig.stack.vault.entries];
	const target = expectDefined(rig.runtime.groupActions.target.value, 'assembly');
	const rotating = rig.runtime.groupActions.rotate(target.id);
	await settleUntil(() => rig.dialogs.current?.kind === 'form', 'group rotation dialog');
	await captured.run(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.dialogs.resolve('cancel'); await rotating; expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('refuses enclosure across an existing crossing wall and retires its action while Pan is active', async () => {
	const rig = await renovationEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const wall = { id: 'wall-crossing', start: { x: 2000, y: -1000 }, end: { x: 2000, y: 4000 }, height: 2400, thickness: 150 };
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline,
		structure: { walls: [wall], openings: [], boundaries: [] }, ledger: rig.runtime.structureTask.ledger })));
	rig.selection.select([rig.room.id]); await settle();
	const enclose = expectDefined(rig.runtime.groupActions.actions([rig.room.id]).find(item => item.id === 'enclose'), 'enclosure');
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write');
	await enclose.run(); expect(write).not.toHaveBeenCalled(); expect(rig.project.groups).toEqual([]);
	rig.runtime.setTool('pan'); await enclose.run(); expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('keeps an Object-bearing assembly read-only in Renovate, including previously offered actions', async () => {
	const rig = await setup(); rig.changePlan(); await settle();
	const services = expectDefined(rig.deps.commands.renovation, 'renovation services'), baseline = expectOk(await services.read(rig.plan.id));
	const object = { id: 'element-in-group', kind: 'object' as const, name: 'Desk', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1200 }, { x: 500, y: 1200 }] };
	expectOk(await rig.runtime.dispatcher.run(services.command(baseline, elementInput(baseline, object), rig.runtime.structureTask.ledger)));
	rig.selection.select([rig.room.id, object.id as never]); await settle(); await action(rig, 'group').run();
	const captured = action(rig, 'ungroup'), target = expectDefined(rig.runtime.groupActions.target.value, 'object group'), bytes = [...rig.stack.vault.entries];
	useRenovationSession(rig.pinia).perspective = 'renovate'; await settle();
	expect(rig.runtime.groupActions.disabled.value).toBe(true);
	await captured.run(); await rig.runtime.groupActions.rotate(target.id, 90); await rig.runtime.groupActions.moveBy({ dx: 100, dy: 50 });
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.project.structure.elements?.[0].points).toEqual(object.points);
});
it('rejects invalid and complete turns and clears a retired group preview without committing it', async () => {
	const rig = await setup(), target = expectDefined(rig.runtime.groupActions.target.value, 'group'), bytes = [...rig.stack.vault.entries];
	for (const angle of [NaN, Infinity, 0, 360]) await rig.runtime.groupActions.rotate(target.id, angle);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	const points = expectDefined(rotationPoints(target, 15, expectDefined(rotationPivot(target), 'pivot')), 'preview');
	rig.runtime.groupActions.previewRotation(target.id, points); expect(rig.runtime.groupActions.preview.value).not.toBeNull();
	rig.selection.clear(); await settle(); await rig.runtime.groupActions.moveRotation(points, target);
	rig.runtime.groupActions.previewRotation(target.id, points);
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('does not apply connected-wall movement after selection changes while its impact is being reviewed', async () => {
	const rig = await setup(); rig.selection.select([rig.room.id, rig.project.structure.walls[0].id as never]); await settle();
	const bytes = [...rig.stack.vault.entries], moving = rig.runtime.groupActions.moveBy({ dx: 100, dy: 100 });
	await settleUntil(() => rig.dialogs.current?.kind === 'confirm', 'connected impact');
	rig.selection.clear(); rig.dialogs.resolve('confirm'); await moving;
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.selection.selectedIds).toEqual([]);
	expect(rig.runtime.groupActions.preview.value).toBeNull(); expect(rig.runtime.groupActions.active.value).toBe(false);
});
