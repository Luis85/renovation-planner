// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { pointerAt } from '../../helpers/tool-context';
import { alongWall, wallLength, type Opening, type Structure } from '../../../src/domain/spatial/Structure';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';

function unreleased(): never { throw new Error('operation not started'); }
const door: Opening = { id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 800, width: 900, height: 2100, sill: 0, swing: { hinge: 'end', side: 'right', angle: 45 } };
const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { rigs.splice(0).forEach(rig => rig.unmount()); });
async function setup(openings: readonly Opening[] = [door], structure: Structure = WALL_LOOP) {
	const rig = await structureEditor(); rigs.push(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...structure, openings } }, read.version));
	await rig.runtime.refreshProjection(); rig.selection.select([door.id as never]); await settle();
	return rig;
}
function escape(rig: Awaited<ReturnType<typeof setup>>): void { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })); }
function click(rig: Awaited<ReturnType<typeof setup>>, x: number, y = 0): void {
	rig.runtime.toolManager.pointerDown(pointerAt(x, y)); rig.runtime.toolManager.pointerUp(pointerAt(x, y));
}
async function arm(rig: Awaited<ReturnType<typeof setup>>): Promise<void> {
	expect(rig.runtime.openingMove.start(door.id)).toBe(true);
	await settleUntil(() => !rig.runtime.openingMove.loading.value, 'opening baseline');
}

it('admits Inspector Move, previews without writes, commits the literal centre and reverses all opening metadata', async () => {
	const rig = await setup(), workspace = useWorkspaceStore(rig.pinia);
	workspace.setLayoutMode('constrained'); workspace.openOverlay('inspector'); await settle();
	await rig.wrapper.get('[data-rp-action="move-opening"]').trigger('click');
	await settleUntil(() => !rig.runtime.openingMove.loading.value, 'inspector move baseline');
	expect(workspace.overlay).toBe('none'); expect(document.activeElement).toBe(rig.canvasEl);
	const write = vi.spyOn(rig.geometry, 'write');
	rig.runtime.toolManager.pointerMove(pointerAt(3000, 0));
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...door, offset: 2550 }]);
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.openingMove.hostId.value).toBe(door.hostId);
	click(rig, 3000); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'moved opening');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.openings).toEqual([{ ...door, offset: 2550 }]);
	expect(rig.selection.selectedIds).toEqual([door.id]); expect(rig.runtime.structureActions.preview.value).toBeNull();
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
	await rig.runtime.redo(); expect(rig.project.structure.openings).toEqual([{ ...door, offset: 2550 }]);
});

it('exposes the same Move action in the keyboard context menu and Escape retires the preview without a write', async () => {
	const rig = await setup(), before = [...rig.stack.vault.entries];
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ContextMenu' })); await settle();
	await rig.wrapper.get('[data-rp-context-action="move-opening"]').trigger('click');
	await settleUntil(() => !rig.runtime.openingMove.loading.value, 'menu move baseline');
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	rig.runtime.toolManager.pointerMove(pointerAt(2500, 0)); escape(rig); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(rig.selection.selectedIds).toEqual([door.id]); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.canUndo.value).toBe(false);
});

it('refuses another host and overlapping positions, then clamps a valid endpoint to the complete width', async () => {
	const other = { ...door, id: 'opening-other', offset: 2300 };
	const rig = await setup([door, other]); await arm(rig);
	const write = vi.spyOn(rig.geometry, 'write');
	click(rig, 4000, 1500); expect(rig.runtime.structureActions.preview.value).toBeNull();
	click(rig, 2500); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(rig.runtime.openingMove.message.value).not.toBe(''); expect(write).not.toHaveBeenCalled();
	click(rig, 0); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'endpoint move');
	expect(rig.project.structure.openings).toEqual([{ ...door, offset: 0 }, other]);
});

it.each([false, true])('queues one early click and retires it on Escape=%s', async cancel => {
	const rig = await setup(), result = await rig.services.read(rig.plan.id);
	let release: () => void = unreleased;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(result); }));
	const write = vi.spyOn(rig.geometry, 'write');
	expect(rig.runtime.openingMove.start(door.id)).toBe(true); click(rig, 3000); click(rig, 2000);
	if (cancel) escape(rig);
	release(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'queued click outcome');
	expect(write).toHaveBeenCalledTimes(cancel ? 0 : 1);
	expect(rig.project.structure.openings).toEqual([cancel ? door : { ...door, offset: 2550 }]);
});

it('declines Review/hidden-layer admission and retires a pending baseline when the selection changes', async () => {
	const rig = await setup(), session = useRenovationSession(rig.pinia), workspace = useWorkspaceStore(rig.pinia);
	session.perspective = 'review'; expect(rig.runtime.openingMove.start(door.id)).toBe(false);
	session.perspective = 'plan'; workspace.toggleLayer('architecture'); expect(rig.runtime.openingMove.start(door.id)).toBe(false);
	workspace.toggleLayer('architecture');
	const result = await rig.services.read(rig.plan.id);
	let release: () => void = unreleased;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(result); }));
	expect(rig.runtime.openingMove.start(door.id)).toBe(true); click(rig, 3000);
	rig.selection.select([]); release(); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.project.structure.openings).toEqual([door]);
	expect(rig.runtime.structureActions.active.value).toBe(false); expect(rig.runtime.canUndo.value).toBe(false);
});

it('holds one pending write through duplicate clicks and Escape, then releases the task after success', async () => {
	const rig = await setup(); await arm(rig);
	let release: () => void = unreleased;
	const gate = new Promise<void>(resolve => { release = resolve; });
	const original = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate; return original(...args); });
	click(rig, 3000); await settleUntil(() => write.mock.calls.length === 1, 'pending move write');
	click(rig, 2000); escape(rig);
	expect(rig.runtime.activeToolId.value).toBe('move-opening'); expect(rig.runtime.toolManager.canDeactivateActiveTool()).toBe(false);
	release(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'move write finished');
	expect(write).toHaveBeenCalledTimes(1); expect(rig.project.structure.openings).toEqual([{ ...door, offset: 2550 }]);
});

it('retires the frozen preview after a peer refresh and leaves the peer geometry intact', async () => {
	const rig = await setup(); await arm(rig); rig.runtime.toolManager.pointerMove(pointerAt(3000, 0));
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	const peer = { ...door, offset: 1000 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, openings: [peer] } }, read.version));
	await rig.runtime.refreshProjection();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(rig.project.structure.openings).toEqual([peer]); expect(rig.runtime.canUndo.value).toBe(false);
});

it('ignores invalid pointer coordinates and exits an unchanged centre without history', async () => {
	const rig = await setup(); await arm(rig);
	const write = vi.spyOn(rig.geometry, 'write');
	click(rig, Number.NaN); expect(rig.runtime.structureActions.preview.value).toBeNull();
	click(rig, door.offset + door.width / 2); await settle();
	expect(rig.runtime.activeToolId.value).toBe('select'); expect(write).not.toHaveBeenCalled();
	expect(rig.project.structure.openings).toEqual([door]); expect(rig.runtime.canUndo.value).toBe(false);
});

it('moves on the frozen curved host by along-arc distance and preserves its bulge and opening swing', async () => {
	const wall = { ...WALL_LOOP.walls[0], bulge: 0.25 };
	const structure = { ...WALL_LOOP, walls: [wall, ...WALL_LOOP.walls.slice(1)] };
	const rig = await setup([door], structure); await arm(rig);
	const centre = wallLength(wall) * 0.65, point = alongWall(wall, centre);
	click(rig, point.x, point.y); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'curved host move');
	expect(rig.project.structure.openings[0].offset).toBeCloseTo(centre - door.width / 2, 8);
	expect(rig.project.structure.openings[0].swing).toEqual(door.swing);
	expect(rig.project.structure.walls).toEqual(structure.walls);
	await rig.runtime.undo(); expect(rig.project.structure).toMatchObject({ ...structure, openings: [door] });
});

it('refuses a stale baseline at the command boundary without replacing peer geometry', async () => {
	const rig = await setup(); await arm(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id)), peer = { ...door, offset: 1000 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, openings: [peer] } }, read.version));
	const before = [...rig.stack.vault.entries];
	click(rig, 3000); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'stale move refusal');
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.openings).toEqual([peer]);
	expect(rig.runtime.canUndo.value).toBe(false); expect(rig.runtime.structureActions.preview.value).toBeNull();
});

it('retires a failed baseline read and allows a fresh Move admission', async () => {
	const rig = await setup();
	vi.spyOn(rig.services, 'read').mockRejectedValueOnce(new Error('read unavailable'));
	expect(rig.runtime.openingMove.start(door.id)).toBe(true);
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'failed baseline read');
	expect(rig.runtime.structureActions.active.value).toBe(false); expect(rig.runtime.openingMove.loading.value).toBe(false);
	await arm(rig); escape(rig); await settle();
	expect(rig.project.structure.openings).toEqual([door]); expect(rig.runtime.canUndo.value).toBe(false);
});

it('drops an interrupted early press when focus leaves before its release', async () => {
	const rig = await setup(), result = await rig.services.read(rig.plan.id);
	let release: () => void = unreleased;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(result); }));
	expect(rig.runtime.openingMove.start(door.id)).toBe(true);
	rig.runtime.toolManager.pointerDown(pointerAt(3000, 0)); rig.runtime.toolManager.cancelInterruptedGesture();
	release(); await settleUntil(() => !rig.runtime.openingMove.loading.value, 'interrupted opening baseline');
	expect(rig.runtime.activeToolId.value).toBe('move-opening'); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(rig.project.structure.openings).toEqual([door]); expect(rig.runtime.canUndo.value).toBe(false);
	escape(rig);
});

it.each([false, true])('preserves a requested next tool while switching away from a held Move press; loading=%s', async loading => {
	const rig = await setup(), result = await rig.services.read(rig.plan.id);
	let release: () => void = unreleased;
	if (loading) vi.spyOn(rig.services, 'read').mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(result); }));
	expect(rig.runtime.openingMove.start(door.id)).toBe(true);
	if (!loading) await settleUntil(() => !rig.runtime.openingMove.loading.value, 'move baseline');
	rig.runtime.toolManager.pointerDown(pointerAt(2000, loading ? 0 : 1500));
	rig.runtime.setTool('pan');
	if (loading) release();
	await settle();
	expect(rig.runtime.activeToolId.value).toBe('pan'); expect(rig.runtime.toolManager.activeToolId).toBe('pan');
	expect(rig.runtime.structureActions.active.value).toBe(false); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(rig.project.structure.openings).toEqual([door]); expect(rig.runtime.canUndo.value).toBe(false);
});
