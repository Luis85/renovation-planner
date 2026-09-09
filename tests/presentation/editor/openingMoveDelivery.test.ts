// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { WALL_LOOP } from '../../helpers/structure';
import { pointerAt } from '../../helpers/tool-context';
import { err } from '../../../src/core/result/Result';
import { alongWall, wallLength, wallTangent, type Opening } from '../../../src/domain/spatial/Structure';
import { PlanGeometryStore } from '../../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { mounted.splice(0).forEach(rig => rig.unmount()); vi.restoreAllMocks(); });
async function setup(bulge = 0, kind: Opening['kind'] = 'door', legacy = false) {
	const rig = await structureEditor(); mounted.push(rig);
	const wall = { ...WALL_LOOP.walls[0], ...(bulge ? { bulge } : {}) };
	const opening: Opening = { id: 'opening-move', hostId: wall.id, kind, offset: 800.123456789, width: 900.123456789, height: 2100.125, sill: 123.75,
		...(legacy || kind === 'opening' ? {} : { swing: { hinge: 'end' as const, side: 'right' as const, angle: 37.125 } }) };
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const original = { ...baseline.document, structure: { ...WALL_LOOP, walls: [wall, ...WALL_LOOP.walls.slice(1)], openings: [opening] },
		groups: [{ id: 'group-move', name: '  Host assembly  ', memberIds: [wall.id, 'wall-b'] }], intended: WALL_LOOP };
	expectOk(await rig.geometry.write(rig.plan.id, original, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select([opening.id as never]); await settle();
	const stack = rig.stack;
	const fresh = () => new ObsidianPlanGeometrySidecar(new PlanGeometryStore(stack.deps.vault, stack.deps.fileManager, stack.index, stack.migrations, stack.echo));
	const arm = async () => { expect(rig.runtime.openingMove.start(opening.id)).toBe(true); await settleUntil(() => !rig.runtime.openingMove.loading.value, 'fresh Move baseline'); };
	const click = (point: { x: number; y: number }) => { rig.runtime.toolManager.pointerDown(pointerAt(point.x, point.y)); rig.runtime.toolManager.pointerUp(pointerAt(point.x, point.y)); };
	return { ...rig, wall, opening, original, fresh, arm, click };
}

it.each([0, 0.25, -0.25])('projects distant pointers onto the existing host and clamps both endpoints, bulge=%s', async bulge => {
	const rig = await setup(bulge), length = wallLength(rig.wall), write = vi.spyOn(rig.geometry, 'write'), command = vi.spyOn(rig.services, 'command');
	for (const fraction of [0, 0.65, 1]) {
		await rig.arm();
		const centre = length * fraction, onWall = alongWall(rig.wall, centre), tangent = wallTangent(rig.wall, centre);
		const extension = fraction === 0 ? -600 : fraction === 1 ? 600 : 0;
		const point = { x: onWall.x + tangent.y * 500 + tangent.x * extension, y: onWall.y - tangent.x * 500 + tangent.y * extension };
		const offset = Math.max(0, Math.min(length - rig.opening.width, centre - rig.opening.width / 2));
		rig.runtime.toolManager.pointerMove(pointerAt(point.x, point.y));
		const preview = expectDefined(rig.runtime.structureActions.preview.value, 'projected preview');
		expect(preview.openings[0].offset).toBeCloseTo(offset, 8); expect(preview.walls).toEqual(rig.original.structure.walls);
		const calls = write.mock.calls.length, commands = command.mock.calls.length; rig.click(point);
		await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'projected Move');
		expect(write).toHaveBeenCalledTimes(calls + 1); expect(command).toHaveBeenCalledTimes(commands + 1);
		expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual({ ...rig.original, structure: preview });
		await rig.runtime.undo(); expect(rig.runtime.canUndo.value).toBe(false);
		expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
		await rig.runtime.redo(); expect(rig.runtime.canRedo.value).toBe(false);
		expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual({ ...rig.original, structure: preview });
		await rig.runtime.undo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	}
});

it('previews the latest pointer when the initial read completes without requiring another pointer event', async () => {
	const rig = await setup(), result = await rig.services.read(rig.plan.id), pending = defer<typeof result>();
	vi.spyOn(rig.services, 'read').mockReturnValueOnce(pending.promise);
	const write = vi.spyOn(rig.geometry, 'write'); expect(rig.runtime.openingMove.start(rig.opening.id)).toBe(true);
	rig.runtime.toolManager.pointerMove(pointerAt(2000, 0)); rig.runtime.toolManager.pointerMove(pointerAt(3000, 0));
	pending.resolve(result); await settleUntil(() => !rig.runtime.openingMove.loading.value, 'hover baseline');
	expect(rig.runtime.structureActions.preview.value?.openings).toEqual([{ ...rig.opening, offset: 3000 - rig.opening.width / 2 }]);
	expect(write).not.toHaveBeenCalled();
});

it.each(['door', 'window', 'opening'] as const)('preserves legacy optional fields for a curved %s through exact Undo/Redo and fresh reads', async kind => {
	const rig = await setup(0.25, kind, true); await rig.arm();
	rig.click(alongWall(rig.wall, 2600.987654321));
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'legacy Move');
	const saved = expectOk(await rig.fresh().read(rig.plan.id)).document;
	const opening = expectDefined(saved.structure, 'saved structure').openings[0];
	expect(opening).toEqual({ ...rig.opening, offset: opening.offset }); expect(opening).not.toHaveProperty('swing');
	expect(opening.offset).toBeCloseTo(2600.987654321 - rig.opening.width / 2, 8);
	await rig.runtime.undo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original);
	await rig.runtime.redo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(saved);
});

it.each(['escape', 'tool', 'selection', 'disposal'] as const)('retires an early click and hover after %s without reactivating from the late read', async cancellation => {
	const rig = await setup(), result = await rig.services.read(rig.plan.id), pending = defer<typeof result>();
	vi.spyOn(rig.services, 'read').mockReturnValueOnce(pending.promise);
	const write = vi.spyOn(rig.geometry, 'write'); expect(rig.runtime.openingMove.start(rig.opening.id)).toBe(true);
	rig.click({ x: 3000, y: 0 }); rig.runtime.toolManager.pointerMove(pointerAt(2200, 0));
	if (cancellation === 'escape') rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
	if (cancellation === 'tool') rig.runtime.setTool('pan');
	if (cancellation === 'selection') rig.selection.select([]);
	if (cancellation === 'disposal') { rig.unmount(); mounted.pop(); }
	pending.resolve(result); await settle();
	expect(write).not.toHaveBeenCalled(); expect(rig.runtime.openingMove.hostId.value).toBeNull();
	expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(rig.runtime.canUndo.value).toBe(false);
	expect(rig.runtime.toolManager.activeToolId).toBe(cancellation === 'disposal' ? null : cancellation === 'tool' ? 'pan' : 'select');
});

it.each(['host', 'opening', 'write-race'] as const)('refuses concurrent %s changes without overwriting or recording history', async change => {
	const rig = await setup(0.25); await rig.arm();
	const peer = rig.fresh(), read = expectOk(await peer.read(rig.plan.id));
	const document = { ...read.document, structure: { ...rig.original.structure,
		...(change === 'opening' ? { openings: [{ ...rig.opening, swing: { hinge: 'start' as const, side: 'left' as const, angle: 0 } }] }
			: { walls: [{ ...rig.wall, bulge: 0.3 }, ...WALL_LOOP.walls.slice(1)] }) } };
	const originalWrite = rig.geometry.write.bind(rig.geometry);
	if (change === 'write-race') vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		expectOk(await peer.write(rig.plan.id, document, read.version)); return originalWrite(...args);
	});
	else expectOk(await peer.write(rig.plan.id, document, read.version));
	rig.click(alongWall(rig.wall, 3000)); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'stale Move refusal');
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(document);
	expect(rig.runtime.canUndo.value).toBe(false); expect(rig.runtime.structureActions.preview.value).toBeNull();
});

it.each([0, 0.25])('keeps one successful Move through failed refresh and read-only retries, bulge=%s', async bulge => {
	const rig = await setup(bulge, 'window'); await rig.arm();
	const point = alongWall(rig.wall, 2800.123456789); rig.runtime.toolManager.pointerMove(pointerAt(point.x, point.y));
	const expected = { ...rig.original, structure: expectDefined(rig.runtime.structureActions.preview.value, 'Move preview') };
	const write = vi.spyOn(rig.geometry, 'write'), read = vi.spyOn(rig.deps.queries, 'getPlan').mockResolvedValue(err(injectedPersistenceError()));
	rig.click(point); await settleUntil(() => !rig.runtime.openingMove.saving.value, 'saved Move with failed refresh');
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.writesBlocked.value).toBe(true);
	expect(rig.runtime.openingMove.hostId.value).toBeNull();
	for (let retry = 0; retry < 3; retry++) { await rig.runtime.refreshProjection(); expect(rig.runtime.openingMove.start(rig.opening.id)).toBe(false); }
	expect(write).toHaveBeenCalledOnce(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected);
	read.mockRestore(); await rig.runtime.refreshProjection(); await settle();
	expect(rig.runtime.writesBlocked.value).toBe(false); expect(write).toHaveBeenCalledOnce();
	await rig.runtime.undo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(rig.original); expect(rig.runtime.canUndo.value).toBe(false);
	await rig.runtime.redo(); expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected); expect(write).toHaveBeenCalledTimes(3);
});

it('retires a failed write without history or implicit replay and accepts a fresh deliberate Move', async () => {
	const rig = await setup(); await rig.arm(); const bytes = [...rig.stack.vault.entries];
	const write = vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	rig.click({ x: 3000, y: 0 }); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'refused Move write');
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.canUndo.value).toBe(false); expect([...rig.stack.vault.entries]).toEqual(bytes);
	await rig.runtime.refreshProjection(); expect(write).toHaveBeenCalledOnce();
	await rig.arm(); rig.click({ x: 2500, y: 0 }); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'fresh Move after refusal');
	expect(write).toHaveBeenCalledTimes(2); expect(rig.project.structure.openings).toEqual([{ ...rig.opening, offset: 2500 - rig.opening.width / 2 }]);
});

it('keeps an actual completed Move when disposed before its write receipt returns', async () => {
	const rig = await setup(0.25); await rig.arm();
	const point = alongWall(rig.wall, 2700); rig.runtime.toolManager.pointerMove(pointerAt(point.x, point.y));
	const expected = { ...rig.original, structure: expectDefined(rig.runtime.structureActions.preview.value, 'Move preview') };
	const committed = defer<void>(), release = defer<void>(), originalWrite = rig.geometry.write.bind(rig.geometry);
	const write = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => {
		const result = await originalWrite(...args); committed.resolve(undefined); await release.promise; return result;
	});
	rig.click(point); await committed.promise; rig.unmount(); mounted.pop(); release.resolve(undefined); await settle();
	expect(write).toHaveBeenCalledOnce(); expect(rig.runtime.toolManager.activeToolId).toBeNull();
	expect(rig.runtime.openingMove.hostId.value).toBeNull(); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(expectOk(await rig.fresh().read(rig.plan.id)).document).toEqual(expected);
});
