import { describe, expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
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
	it('does not let local move/undo conceal a peer sidecar write from earlier wall history', async () => {
		const rig = await structureStack(), history = new CommandHistory();
		expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, room: rig.room, ledger: rig.ledger })));
		const id = expectDefined(rig.room.createdZoneId, 'Room'), loaded = expectDefined(expectOk(await rig.stack.zones.getById(id)), 'Room note');
		const before = expectOk(await rig.geometry.read(rig.plan.id)); expectOk(await rig.geometry.write(rig.plan.id, before.document, before.version));
		const move = new ReversibleMoveZoneCommand(new MoveSpatialObjectCommand(rig.stack.zones, rig.stack.events), rig.ledger, id, { points: loaded.entity.geometry.points.map(p => ({ x: p.x + 100, y: p.y })) }, loaded.entity.geometry);
		expectOk(await history.run(move)); expectOk(await history.undo());
		const bytes = [...rig.stack.vault.entries]; expect(await history.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } }); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
