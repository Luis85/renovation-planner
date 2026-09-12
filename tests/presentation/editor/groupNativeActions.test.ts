// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { err, ok } from '../../../src/core/result/Result';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await groupEditor(); mounted.push(rig); return rig; }
async function idle(rig: Awaited<ReturnType<typeof setup>>) { await settleUntil(() => !rig.runtime.groupActions.active.value, 'group action complete'); }

it('moves an assembly from the native numeric fields and uses both quarter-turn buttons with exact history', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const form = rig.wrapper.get('[data-rp-group-controls] form'), write = vi.spyOn(rig.geometry, 'write');
	await form.trigger('submit'); expect(write).not.toHaveBeenCalled();
	await form.get('[name="group-dx"]').setValue('invalid'); await form.trigger('submit'); expect(write).not.toHaveBeenCalled();
	await form.get('[name="group-dx"]').setValue('-0,125'); await form.get('[name="group-dy"]').setValue('0.25');
	await form.trigger('submit'); await idle(rig);
	expect(rig.project.zones.get(rig.room.id)?.points[0]).toEqual({ x: -125, y: 250 });
	const moved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	await rig.wrapper.get('[data-rp-group-transform="right"]').trigger('click'); await idle(rig);
	await rig.wrapper.get('[data-rp-group-transform="left"]').trigger('click'); await idle(rig);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(moved);
	await rig.runtime.undo(); await rig.runtime.undo(); await rig.runtime.undo();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before); expect(write).toHaveBeenCalledTimes(6);
});
it('opens precise rotation through the Inspector, rejects invalid/no-op input and previews both directions without writing', async () => {
	const rig = await setup(), write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'precise group form');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	for (const angle of ['bad', '0', '360']) { await form.get('input').setValue(angle); await form.trigger('submit'); }
	expect(write).not.toHaveBeenCalled();
	await form.get('input').setValue('-15,25'); expect(rig.runtime.groupActions.preview.value).not.toBeNull();
	await rig.runtime.groupActions.moveBy({ dx: 100, dy: 200 }); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await idle(rig); expect(rig.runtime.groupActions.preview.value).toBeNull();
});
it('keeps hidden assembly members in precise operations, while layer visibility removes every pointer handle', async () => {
	const rig = await setup(), workspace = useWorkspaceStore(rig.pinia);
	workspace.layerVisibility.zone = false; workspace.layerVisibility.architecture = false;
	expect(rig.runtime.rotationActions.handle.value).toBeNull();
	await rig.wrapper.get('[data-rp-group-transform="right"]').trigger('click'); await idle(rig);
	expect(rig.project.structure.walls[0].start).toEqual({ x: 3575, y: -575 });
	await rig.runtime.undo(); expect(rig.project.structure.walls[0].start).toEqual({ x: -75, y: -75 });
});
it('retains the saved document after a baseline read error and after an unexpected repository exception', async () => {
	const rig = await setup(), services = expectDefined(rig.deps.commands.groups, 'group services'), before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const write = vi.spyOn(rig.geometry, 'write'), read = vi.spyOn(services, 'read');
	read.mockResolvedValueOnce(err(injectedPersistenceError())); await rig.runtime.groupActions.moveBy({ dx: 150, dy: 100 });
	read.mockRejectedValueOnce(new Error('injected read failure')); await rig.runtime.groupActions.moveBy({ dx: 150, dy: 100 });
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.groupActions.active.value).toBe(false);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});
it('refreshes a peer-modified assembly instead of applying a transform captured from older visible geometry', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
	const next = { ...before.document, structure: { ...rig.project.structure, walls: rig.project.structure.walls.map(wall => ({ ...wall, height: 2800 })) } };
	expectOk(await rig.geometry.write(rig.plan.id, next, before.version)); const write = vi.spyOn(rig.geometry, 'write');
	await rig.runtime.groupActions.moveBy({ dx: 100, dy: 50 }); expect(write).not.toHaveBeenCalled();
	expect(rig.project.structure.walls[0].height).toBe(2800); expect(rig.project.zones.get(rig.room.id)?.points).toEqual(rig.room.geometry.points);
});
it.each(['selection', 'perspective', 'unmount'] as const)('retires a delayed group read on %s before any write', async change => {
	const rig = await setup(), services = expectDefined(rig.deps.commands.groups, 'group services'), baseline = expectOk(await services.read(rig.plan.id));
	let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
	vi.spyOn(services, 'read').mockImplementationOnce(async () => { await wait; return ok(baseline); });
	const write = vi.spyOn(rig.geometry, 'write'), operation = rig.runtime.groupActions.moveBy({ dx: 100, dy: 50 });
	if (change === 'selection') rig.selection.clear();
	if (change === 'perspective') useRenovationSession(rig.pinia).perspective = 'review';
	if (change === 'unmount') { rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); }
	release(); await operation; expect(write).not.toHaveBeenCalled();
	if (change === 'unmount') await rig.runtime.groupActions.moveBy({ dx: 400, dy: 0 });
	expect(write).not.toHaveBeenCalled();
});
it('keeps the native move form inert during an existing save and rejects an invalid transform without adding history', async () => {
	const rig = await setup(), saves = useSaveStateStore(rig.pinia), before = expectOk(await rig.geometry.read(rig.plan.id)).document, write = vi.spyOn(rig.geometry, 'write');
	saves.beginSaving();
	const form = rig.wrapper.get('[data-rp-group-controls] form'); await form.get('[name="group-dx"]').setValue('1'); await form.trigger('submit');
	expect(form.get('[name="group-dx"]').element).toHaveProperty('value', '0');
	expect(write).not.toHaveBeenCalled(); saves.resolveNeutral();
	await rig.runtime.groupActions.moveBy({ dx: 2e9, dy: 0 }); expect(write).not.toHaveBeenCalled();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});
it('groups only walls with a useful default name, expands saved identity, and supports list toggling without metadata changes', async () => {
	const rig = await setup(); await rig.wrapper.get('[data-rp-group-action="ungroup"]').trigger('click'); await idle(rig);
	const ids = rig.project.structure.walls.slice(0, 2).map(wall => wall.id as never); rig.selection.select(ids); await settle();
	await rig.wrapper.get('[data-rp-group-action="group"]').trigger('click'); await idle(rig);
	const group = rig.project.groups[0]; expect(group.name).toBe('Group 1'); expect(rig.runtime.groupActions.expandSelection(group.id)).toEqual(ids);
	expect(rig.runtime.groupActions.expandSelection('missing')).toEqual([]); expect(rig.runtime.groupActions.expandSelection('missing', true)).toEqual([]);
	rig.runtime.selectAndFrame(ids[0], false); expect(rig.selection.selectedIds).toEqual(ids);
	rig.runtime.selectAndFrame(ids[0], true); expect(rig.selection.selectedIds).toEqual([]);
	rig.runtime.selectAndFrame(ids[0], true); expect(rig.selection.selectedIds).toEqual(ids); expect(rig.project.groups).toEqual([group]);
});
it('repeating explicit enclosure reuses the saved group and walls without a new write', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document, write = vi.spyOn(rig.geometry, 'write');
	rig.selection.select([rig.room.id]); await settle();
	// A room's group controls sit inside its body, directly above Delete at the Inspector's foot (side panels spec §3).
	const region = rig.wrapper.get('[data-rp-region="inspector"]'), regionButtons = region.findAll('button');
	expect(region.find('.rp-room-inspector [data-rp-group-controls] + .rp-inspector-danger').exists()).toBe(true);
	expect(regionButtons[regionButtons.length - 1].classes()).toContain('rp-editor-inspector-delete');
	await rig.wrapper.get('[data-rp-group-action="enclose"]').trigger('click'); await idle(rig);
	expect(write).not.toHaveBeenCalled(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	expect(rig.selection.selectedIds).toHaveLength(5);
});
it('draws a grouped wall\'s group controls above its Delete, at the foot of the Inspector region', async () => {
	const rig = await setup(), wall = expectDefined(rig.project.structure.walls.find(item => rig.project.groups[0].memberIds.includes(item.id)), 'enclosing wall');
	rig.selection.select([wall.id as never]); await settle();
	const region = rig.wrapper.get('[data-rp-region="inspector"]'), regionButtons = region.findAll('button');
	expect(region.find('.rp-structure-inspector [data-rp-group-controls] + .rp-inspector-danger').exists()).toBe(true);
	expect(regionButtons[regionButtons.length - 1].attributes('data-rp-action')).toBe('delete-structure');
});
it('keeps precise group text during read-only recovery and routes Open source without replaying a command', async () => {
	const rig = await setup(); await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'group form');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input').setValue('15.25');
	const write = vi.spyOn(rig.geometry, 'write'), read = vi.spyOn(rig.deps.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
	await rig.runtime.refreshProjection(); await settle();
	const recovery = form.get('.rp-draft-recovery'), buttons = recovery.findAll('button');
	await buttons[1].trigger('click'); expect(rig.openedNote()).toBe(1);
	await buttons[0].trigger('click'); await settle(); expect(write).not.toHaveBeenCalled(); expect(form.get('input').element).toHaveProperty('value', '15.25');
	read.mockRestore(); await buttons[0].trigger('click'); await settleUntil(() => !rig.project.stale, 'group draft recovered');
	await form.trigger('submit'); await idle(rig); expect(write).toHaveBeenCalledTimes(1);
});
it('refuses a peer-conflicted precise rotation and retains the draft instead of replacing newer wall facts', async () => {
	const rig = await setup(); await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'group form');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input').setValue('12.5');
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...rig.project.structure, walls: rig.project.structure.walls.map(wall => ({ ...wall, height: 2900 })) } }, baseline.version));
	const write = vi.spyOn(rig.geometry, 'write'); await form.trigger('submit'); await settle();
	expect(write).not.toHaveBeenCalled(); expect(rig.dialogs.current).not.toBeNull(); expect(form.get('input').element).toHaveProperty('value', '12.5');
	rig.dialogs.resolve('cancel'); await idle(rig); expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.walls[0].height).toBe(2900);
});
it('allows a corrected group angle after invalid shared-wall geometry was refused without writing', async () => {
	const rig = await setup(); rig.selection.select([rig.room.id, rig.project.structure.walls[0].id as never]); await settle();
	await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'partial assembly form');
	const form = rig.wrapper.get('[data-rp-form="object-rotation"]'), write = vi.spyOn(rig.geometry, 'write');
	await form.get('input').setValue('90'); await form.trigger('submit'); await settle(); expect(write).not.toHaveBeenCalled();
	expect(rig.dialogs.current).not.toBeNull();
	await form.get('input').setValue('5'); await form.trigger('submit'); await idle(rig); expect(write).toHaveBeenCalledTimes(1);
});
