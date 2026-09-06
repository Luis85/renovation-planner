import { expect, it } from 'vitest';
import { guardRenovationGeometry } from '../../../../src/infrastructure/obsidian/repositories/renovationGeometryGuard';
import type { PlanGeometryDTO } from '../../../../src/infrastructure/persistence/dto/planGeometry';
import { renovationStack } from '../../../helpers/renovation';
import { expectDefined, expectOk } from '../../../helpers/domain';

it.each(['missing-index', 'missing-file', 'legacy-body', 'linked-room'] as const)('inspects actual source bytes before removing unrelated geometry: %s', async state => {
 const rig = await renovationStack(), path = expectDefined(rig.stack.index.getPath(rig.plan.id), 'Plan path');
 const room = { id: rig.roomId, type: 'polygon' as const, points: [[0, 0], [1000, 0], [0, 1000]] as [number, number][] };
 const after: PlanGeometryDTO = { schemaVersion: 3, planId: rig.plan.id, revision: 1, unit: 'mm', calibration: null, objects: [room] };
 const before = { ...after, objects: [...after.objects, { ...room, id: 'unlinked-area' }] };
 if (state === 'missing-index') rig.stack.index.remove(rig.plan.id);
 if (state === 'missing-file') rig.stack.vault.entries.delete(path);
 if (state === 'legacy-body') rig.stack.vault.entries.set(path, 'A note without frontmatter.');
 if (state === 'linked-room') expectOk(await rig.renovation.command(expectOk(await rig.read()), { renovation: rig.value, intended: undefined }, rig.ledger).execute());
 const bytes = [...rig.stack.vault.entries];
 const result = await guardRenovationGeometry(rig.stack.deps, rig.plan.id, before, after);
 expect(result).toMatchObject(state.startsWith('missing') ? { ok: false, error: { code: 'renovation.room-missing' } } : { ok: true });
 expect([...rig.stack.vault.entries]).toEqual(bytes);
});
