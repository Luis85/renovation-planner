// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { err } from '../../../src/core/result/Result';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
it('refuses a queued saved-group menu action after selection has retired', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	const ungroup = expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'ungroup'), 'ungroup');
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write'); rig.selection.clear(); await ungroup.run();
	expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.project.groups).toHaveLength(1);
});
it('filters deleted members from a transient group and refuses numeric routes for an absent group', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	rig.selection.select([rig.room.id, 'missing' as never]);
	expect(rig.runtime.groupActions.expandSelection('selection-group')).toEqual([rig.room.id]);
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.groupActions.rotate('missing', 90);
	await rig.runtime.groupActions.moveRotation(rig.room.geometry.points, { id: 'missing', kind: 'group', points: rig.room.geometry.points });
	expect(write).not.toHaveBeenCalled();
});
it('refuses blocked group, ungroup and enclosure callbacks without a write', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	const ungroup = expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'ungroup'), 'ungroup');
	rig.project.stale = true; const write = vi.spyOn(rig.geometry, 'write'); await ungroup.run();
	rig.project.stale = false; await ungroup.run(); write.mockClear();
	const group = expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'group'), 'group');
	rig.project.stale = true; await group.run();
	rig.selection.select([rig.room.id]);
	await expectDefined(rig.runtime.groupActions.actions([rig.room.id]).find(action => action.id === 'enclose'), 'enclose').run();
	expect(write).not.toHaveBeenCalled();
});
it('keeps a failed grouping retry explicit and preserves the selection and stored document', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	await expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'ungroup'), 'ungroup').run();
	const selected = [...rig.selection.selectedIds], bytes = [...rig.stack.vault.entries];
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await expectDefined(rig.runtime.groupActions.actions(selected).find(action => action.id === 'group'), 'group').run();
	expect(write).toHaveBeenCalledOnce(); expect(rig.selection.selectedIds).toEqual(selected); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('names a wall-only saved group without borrowing a Room name and reverses its membership exactly', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	await expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'ungroup'), 'ungroup').run();
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const ids = rig.project.structure.walls.slice(0, 2).map(wall => wall.id);
	rig.selection.select(ids.map(id => id as never)); await settle();
	await expectDefined(rig.runtime.groupActions.actions(rig.selection.selectedIds).find(action => action.id === 'group'), 'group').run();
	expect(rig.project.groups[0]).toMatchObject({ name: 'Group 1', memberIds: ids });
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});
it('refuses enclosure of a degenerate legacy Room without minting stored walls or changing its contour', async () => {
	const rig = await renovationEditor(); mounted.push(rig);
	const before = expectFound(await rig.stack.zones.getById(rig.room.id));
	const room = expectOk(before.entity.withGeometry({ points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 }] }));
	expectOk(await rig.stack.zones.save(room, before.version)); await rig.runtime.refreshProjection(); rig.selection.select([room.id]); await settle();
	const bytes = [...rig.stack.vault.entries], write = vi.spyOn(rig.geometry, 'write'), notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	await expectDefined(rig.runtime.groupActions.actions([room.id]).find(action => action.id === 'enclose'), 'enclose').run();
	expect(notify).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
