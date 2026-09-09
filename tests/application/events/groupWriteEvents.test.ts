import { afterEach, expect, it, vi } from 'vitest';
import { structureStack } from '../../helpers/structure';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { groupGeometryServices } from '../../../src/application/commands/spatial/GroupGeometryCommand';
import { err } from '../../../src/core/result/Result';

afterEach(() => vi.restoreAllMocks());
async function setup(move: boolean) {
	const rig = await structureStack(); expectOk(await rig.room.execute());
	const roomId = expectDefined(rig.room.createdZoneId, 'Room'), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const services = groupGeometryServices(rig.geometry, rig.stack.zones, rig.stack.events);
	const document = { ...baseline.document, groups: [{ id: 'group-one', name: 'Kitchen', memberIds: [roomId] }],
		objects: baseline.document.objects.map(object => ({ ...object, points: object.points.map(point => ({ x: point.x + (move ? 150 : 0), y: point.y })) })) };
	const command = services.command({ planId: rig.plan.id, baseline, document, ledger: rig.ledger });
	const observed: { type: string; document: typeof baseline.document }[] = [];
	const subscriptions = ['ZoneGeometryChanged', 'PlanStructureChanged'].map(type => rig.stack.events.subscribe(type, async event => {
		observed.push({ type: event.type, document: expectOk(await rig.geometry.read(rig.plan.id)).document });
	}));
	return { ...rig, roomId, baseline, services, document, command, observed, dispose: () => { for (const subscription of subscriptions) subscription.dispose(); } };
}
it.each([false, true])('announces only committed group state on execute, undo and redo (moves Room: %s)', async move => {
	const rig = await setup(move), publish = vi.spyOn(rig.stack.events, 'publish');
	const types = move ? ['ZoneGeometryChanged', 'PlanStructureChanged'] : ['PlanStructureChanged'];
	for (const [operation, document] of [[() => rig.command.execute(), rig.document], [() => rig.command.undo(), rig.baseline.document], [() => rig.command.execute(), rig.document]] as const) {
		rig.observed.length = 0; publish.mockClear(); expectOk(await operation());
		expect(rig.observed).toEqual(types.map(type => ({ type, document })));
		expect(publish.mock.calls.map(([event]) => event)).toEqual(move
			? [{ type: 'ZoneGeometryChanged', payload: { zoneId: rig.roomId, planId: rig.plan.id, projectId: rig.plan.projectId } }, { type: 'PlanStructureChanged', payload: { planId: rig.plan.id } }]
			: [{ type: 'PlanStructureChanged', payload: { planId: rig.plan.id } }]);
	}
	rig.dispose();
});
it('emits nothing for unused undo, unchanged content, invalid input, failed writes or superseded undo', async () => {
	const rig = await setup(true), publish = vi.spyOn(rig.stack.events, 'publish');
	expectOk(await rig.command.undo());
	const noop = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document: rig.baseline.document, ledger: rig.ledger });
	expectOk(await noop.execute());
	const invalid = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, document: { ...rig.document, objects: [{ id: rig.roomId, points: [] }] }, ledger: rig.ledger });
	expect((await invalid.execute()).ok).toBe(false);
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	expect((await rig.command.execute()).ok).toBe(false); expect(publish).not.toHaveBeenCalled(); expect(rig.observed).toEqual([]);
	expectOk(await rig.command.execute()); publish.mockClear(); rig.observed.length = 0;
	expectOk(await rig.command.execute()); expect(publish).not.toHaveBeenCalled();
	const current = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, current.document, current.version));
	expect((await rig.command.undo()).ok).toBe(false); expect(publish).not.toHaveBeenCalled(); expect(rig.observed).toEqual([]);
	rig.dispose();
});
