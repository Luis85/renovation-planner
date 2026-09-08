import { describe, expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeZone } from '../../helpers/entities';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';
import { RenameZoneCommand } from '../../../src/application/commands/zone/RenameZone';
import { ReversibleRenameZoneCommand } from '../../../src/application/commands/zone/reversible-rename-zone-command';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { ReversibleMoveZoneCommand } from '../../../src/presentation/editor/tools/reversible-move-zone-command';

describe('PR86 mixed Room and whole-structure history regressions', () => {
	it.each(['rename', 'move'] as const)('undoes Room %s then optional Room+walls with the shared geometry receipt', async kind => {
		const rig = await structureStack(), history = new CommandHistory();
		expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, room: rig.room, ledger: rig.ledger })));
		const id = expectDefined(rig.room.createdZoneId, 'Room'), loaded = expectDefined(expectOk(await rig.stack.zones.getById(id)), 'Room note');
		const command = kind === 'rename'
			? new ReversibleRenameZoneCommand(new RenameZoneCommand(rig.stack.zones, rig.stack.events), rig.ledger, { zoneId: id, name: 'Office', inverse: loaded.entity.name, expected: loaded.version })
			: new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, id, { points: loaded.entity.geometry.points.map(p => ({ x: p.x + 500, y: p.y + 200 })) }, loaded.entity.geometry);
		expectOk(await history.run(command)); expectOk(await history.undo()); expectOk(await history.undo());
		expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(rig.baseline.document);
		expectOk(await history.redo()); expectOk(await history.redo());
	});
	it('undoes wall history after moving and restoring the first of two sidecar objects', async () => {
		const rig = await structureStack(), history = new CommandHistory();
		const rooms = [];
		for (const name of ['First', 'Second']) rooms.push(expectOk(await rig.stack.zones.save(makeZone({ planId: rig.plan.id, projectId: rig.plan.projectId, name }), 'absent')).entity);
		const baseline = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.ledger })));
		const first = expectDefined(rooms[0], 'first Room');
		const moved = { points: first.geometry.points.map(point => ({ x: point.x + 100, y: point.y })) };
		expectOk(await history.run(new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, first.id, moved, first.geometry)));
		expectOk(await history.undo());
		const reordered = expectOk(await rig.geometry.read(rig.plan.id));
		expect(reordered.document.objects.map(object => object.id)).toEqual([...baseline.document.objects].toReversed().map(object => object.id));
		expectOk(await history.undo());
		const restored = expectOk(await rig.geometry.read(rig.plan.id));
		expect(restored.document.structure).toEqual(baseline.document.structure);
		expect(restored.document.objects.find(object => object.id === first.id)?.points).toEqual(first.geometry.points);
		expectOk(await history.redo()); expectOk(await history.redo());
	});
});
