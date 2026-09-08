/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { err, ok } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function roomRig() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	rig.selection.select([rig.room.id]); await settle();
	expect(rig.runtime.rotationActions.target.value?.id).toBe(rig.room.id);
	return rig;
}
const item: NamedSpatialElement = { id: 'element-admission', kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };
async function elementRig() {
	const rig = await roomRig(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, item), rig.runtime.structureTask.ledger)));
	rig.selection.select([item.id as never]); await settle(); return rig;
}

it.each(['read-error', 'missing', 'other-plan'] as const)('refuses a %s Room admission without writing from the still-visible projection', async refusal => {
	const rig = await roomRig(), zones = rig.deps.commands.zones, loaded = expectFound(await zones.getById(rig.room.id));
	const before = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
	const answer = refusal === 'read-error' ? err(injectedPersistenceError()) : refusal === 'missing' ? ok(null)
		: ok({ ...loaded, entity: makeZone({ id: rig.room.id, projectId: rig.room.projectId, planId: 'different-plan' as never, name: rig.room.name, geometry: rig.room.geometry }) });
	vi.spyOn(zones, 'getById').mockResolvedValueOnce(answer);
	await rig.runtime.rotationActions.rotate(rig.room.id, 90); await settle();
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.rotationActions.active.value).toBe(false); expect(rig.runtime.rotationActions.preview.value).toBeNull(); expect(rig.dialogs.current).toBeNull();
});

it.each(['name', 'geometry'] as const)('refuses a Room %s changed by a peer before numeric rotation opens', async field => {
	const rig = await roomRig(), zones = rig.deps.commands.zones, loaded = expectFound(await zones.getById(rig.room.id));
	const changed = field === 'name' ? expectOk(loaded.entity.withName('Peer kitchen'))
		: expectOk(loaded.entity.withGeometry({ points: loaded.entity.geometry.points.map(point => ({ ...point, x: point.x + 250 })) }));
	expectOk(await zones.save(changed, loaded.version));
	const before = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
	await rig.runtime.rotationActions.rotate(rig.room.id, 90); await settle();
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	const current = expectFound(await zones.getById(rig.room.id)).entity;
	expect(current.name).toBe(changed.name); expect(current.geometry).toEqual(changed.geometry); expect(rig.dialogs.current).toBeNull();
});

it('maps an unexpected baseline read fault and releases the rotation operation without writing', async () => {
	const rig = await roomRig(), before = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
	const fault = new Error('Vault read failed'), log = vi.spyOn(rig.deps.commands.logger, 'error');
	vi.spyOn(rig.deps.commands.zones, 'getById').mockRejectedValueOnce(fault);
	await rig.runtime.rotationActions.rotate(rig.room.id, 90);
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before); expect(rig.runtime.rotationActions.active.value).toBe(false);
	expect(log).toHaveBeenCalledWith('editor.rotation.failed', expect.objectContaining({ cause: fault }));
});

it('refuses an element baseline read failure and keeps its geometry/name intact', async () => {
	const rig = await elementRig(), before = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
	vi.spyOn(rig.renovation, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.rotationActions.rotate(item.id, 90); await settle();
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.project.structure.elements?.[0].points).toEqual(item.points); expect(rig.project.plan?.spatialElements?.[0].name).toBe(item.name);
});

it('refuses a peer-renamed element before rotation admission and preserves the peer record', async () => {
	const rig = await elementRig(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.renovation.command(baseline, elementInput(baseline, { ...item, name: 'Peer cabinet' }), rig.runtime.structureTask.ledger).execute());
	const before = [...rig.stack.vault.entries], dispatch = vi.spyOn(rig.runtime.dispatcher, 'run');
	await rig.runtime.rotationActions.rotate(item.id, 90); await settle();
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.project.plan?.spatialElements?.[0].name).toBe('Peer cabinet');
});

it('rejects a retired or unchanged pointer proposal without creating history', async () => {
	const rig = await roomRig(), shape = expectDefined(rig.runtime.rotationActions.target.value, 'Room target');
	const points = expectDefined(rotationPoints(shape, 25, expectDefined(rotationPivot(shape), 'pivot')), 'rotated points');
	const dispatch = vi.spyOn(rig.runtime.dispatcher, 'run'), before = [...rig.stack.vault.entries];
	await rig.runtime.rotationActions.move(shape.id, shape.points, shape);
	rig.runtime.setTool(null); rig.runtime.setTool('select');
	await rig.runtime.rotationActions.move(shape.id, points, shape);
	expect(dispatch).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
});

it('does not overwrite refreshed peer geometry with a pointer proposal captured before that change', async () => {
	const rig = await roomRig(), original = expectDefined(rig.runtime.rotationActions.target.value, 'original Room target');
	const proposal = expectDefined(rotationPoints(original, 30, expectDefined(rotationPivot(original), 'pivot')), 'pointer proposal');
	const loaded = expectFound(await rig.deps.commands.zones.getById(rig.room.id));
	const peer = expectOk(loaded.entity.withGeometry({ points: loaded.entity.geometry.points.map(point => ({ ...point, y: point.y + 175 })) }));
	expectOk(await rig.deps.commands.zones.save(peer, loaded.version)); await rig.runtime.refreshProjection(); await settle();
	const before = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
	await rig.runtime.rotationActions.move(original.id, proposal, original);
	expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.project.zones.get(rig.room.id)?.points).toEqual(peer.geometry.points);
});

it('refuses a queued numeric callback after its form and selection lifetime retire', async () => {
	const rig = await roomRig(), operation = rig.runtime.rotationActions.rotate(rig.room.id); await settle();
	const form = rig.wrapper.getComponent(ObjectRotationForm), dispatch = form.props('dispatch'), element = form.props('element'), pivot = form.props('pivot');
	const points = expectDefined(rotationPoints(element, 20, pivot), 'proposal'), before = [...rig.stack.vault.entries];
	rig.dialogs.resolve('cancel'); await operation; rig.runtime.setTool(null); rig.runtime.setTool('select');
	const run = vi.spyOn(rig.runtime.dispatcher, 'run');
	expect((await dispatch(points)).ok).toBe(false); expect(run).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
});

it('lets the existing stale gate refuse a rotation at dispatch without a repository write', async () => {
	const rig = await roomRig(), before = [...rig.stack.vault.entries], run = rig.runtime.dispatcher.run.bind(rig.runtime.dispatcher);
	const write = vi.spyOn(rig.geometry, 'write'), save = vi.spyOn(rig.deps.commands.zones, 'save');
	vi.spyOn(rig.runtime.dispatcher, 'run').mockImplementationOnce(command => { rig.project.stale = true; return run(command); });
	await rig.runtime.rotationActions.rotate(rig.room.id, 90); await settle();
	expect(write).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.writesBlocked.value).toBe(true); expect(rig.runtime.rotationActions.preview.value).toBeNull();
});
