import { afterEach, expect, it, vi } from 'vitest';
import { structureStack, WALL_LOOP } from '../../helpers/structure';
import { expectErr, expectOk } from '../../helpers/domain';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { CommandHistory } from '../../../src/presentation/editor/tools/command-history';

afterEach(() => vi.restoreAllMocks());

it('refuses an unchanged structure before writing or publishing and preserves the no-write history contract', async () => {
	const rig = await structureStack();
	expectOk(await rig.services.command({ ...rig, planId: rig.plan.id, structure: WALL_LOOP, room: undefined }).execute());
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), write = vi.spyOn(rig.geometry, 'write'), publish = vi.spyOn(rig.stack.events, 'publish');
	const command = rig.services.command({ planId: rig.plan.id, baseline, ledger: rig.ledger, structure: structuredClone(WALL_LOOP) }), history = new CommandHistory();
	expect(expectOk(await history.run(command))).toBe('no-write');
	// History deliberately records successful commands, including no-write outcomes.
	expect(history.canUndo).toBe(true); expect(expectOk(await history.undo())).toBe('no-write');
	expect(write).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled(); expect(history.canUndo).toBe(false);
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(baseline);
});

it.each(['execute', 'undo'] as const)('retires a saved structure after %s publication fails without replaying writes', async direction => {
	const rig = await structureStack(), command = rig.services.command({ planId: rig.plan.id, baseline: rig.baseline, ledger: rig.ledger, structure: WALL_LOOP });
	if (direction === 'undo') expectOk(await command.execute());
	const write = vi.spyOn(rig.geometry, 'write'), publish = vi.spyOn(rig.stack.events, 'publish').mockRejectedValueOnce(new Error('Subscriber failed'));
	const result = await command[direction]();
	expect(leftWritesBehind(expectErr(result))).toBe(true);
	expect(write).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenCalledTimes(1);
	expect(write.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]);
	const stored = expectOk(await rig.geometry.read(rig.plan.id));
	expect(stored.document.structure).toEqual(direction === 'execute' ? WALL_LOOP : rig.baseline.document.structure);
	expect(expectErr(await command.execute()).code).toBe('spatial.recovery-required');
	expect(expectErr(await command.undo()).code).toBe('spatial.recovery-required');
	expect(write).toHaveBeenCalledTimes(1); expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(stored);
});
