import { expect, it } from 'vitest';
import { renovationStack } from '../../helpers/renovation';
import { expectDefined, expectOk } from '../../helpers/domain';

it.each([false, true])('preserves peer generation gaps across a Planned apply/undo between structure edits; peer=%s', async peer => {
 const rig = await renovationStack(), first = expectOk(await rig.geometry.read(rig.plan.id));
 const structure = expectDefined(first.document.structure, 'structure');
 const before = rig.services.command({ planId: rig.plan.id, baseline: first, ledger: rig.ledger,
  structure: { ...structure, walls: structure.walls.map((wall, index) => index === 0 ? { ...wall, thickness: 175 } : wall) } });
 expectOk(await before.execute());
 const current = expectOk(await rig.geometry.read(rig.plan.id));
 if (peer) expectOk(await rig.geometry.write(rig.plan.id, current.document, current.version));
 const baseline = expectOk(await rig.read());
 const proposed = rig.renovation.command(baseline, { renovation: rig.value, intended: baseline.geometry.document.structure }, rig.ledger);
 expectOk(await proposed.execute()); expectOk(await proposed.undo());
 const result = await before.undo();
 expect(result).toMatchObject(peer ? { ok: false, error: { code: 'undo.superseded' } } : { ok: true });
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.walls[0].thickness).toBe(peer ? 175 : structure.walls[0].thickness);
});
