import { describe, expect, it } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { ReversibleDeleteZoneCommand } from '../../../src/application/commands/zone/reversible-delete-zone-command';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';

async function setup(peer: boolean) {
	const rig = await structureStack(), history = new CommandHistory();
	expectOk(await history.run(rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, structure: WALL_LOOP, room: rig.room, ledger: rig.ledger })));
	const id = expectDefined(rig.room.createdZoneId, 'Room');
	if (peer) {
		const before = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await rig.geometry.write(rig.plan.id, before.document, before.version));
	}
	const deletion = new ReversibleDeleteZoneCommand(makeDeleteZoneCommand(rig.stack.zones, rig.stack.events, rig.stack.requirements), rig.stack.zones, rig.ledger,
		{ zoneId: id }, { boundary: rig.services.roomHistory(), events: rig.stack.events, requirements: rig.stack.requirements, locks: new ReferenceLocks(), logger: rig.stack.logger });
	expectOk(await history.run(deletion)); expectOk(await history.undo());
	return { ...rig, history };
}

describe('Room deletion in mixed structure history', () => {
	it('records deletion and boundary restoration through repeated history cycles', async () => {
		const rig = await setup(false), { history } = rig;
		expect(rig.ledger.lastWritten(rig.plan.id)).toEqual(expectOk(await rig.geometry.read(rig.plan.id)).version);
		expectOk(await history.undo());
		expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(rig.baseline.document);
		for (let cycle = 0; cycle < 2; cycle++) {
			expectOk(await history.redo()); expectOk(await history.redo());
			expectOk(await history.undo()); expectOk(await history.undo());
		}
	});
	it('does not conceal a peer sidecar revision between local writes', async () => {
		const rig = await setup(true);
		const bytes = [...rig.stack.vault.entries];
		expect(await rig.history.undo()).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
