import { afterEach, describe, expect, it, vi } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makePlan, makeZone } from '../../helpers/entities';
import { readProjectWork } from '../../../src/application/queries/schedule/ProjectWork';
import { err } from '../../../src/core/result/Result';
import { withPlanRenovation } from '../../../src/domain/plan/Plan';

// Pure application reads retain the Node-only layer boundary. The native plugin
// command wiring is exercised separately in tests/plugin/projectWork.test.ts.
afterEach(() => { vi.restoreAllMocks(); });
describe('project Work read model', () => {
 it('lists Work once across shared rooms and floors, resolves blockers, and preserves missing-room and partial-read truth', async () => {
  const rig = await planningStack();
   const room = makeZone({ projectId: rig.plan.projectId, planId: rig.plan.id, name: 'Second room', zoneType: 'Room' }); expectOk(await rig.stack.zones.save(room, 'absent'));
   const first = expectDefined(expectOk(await rig.stack.plans.getById(rig.plan.id)), 'floor');
   const work = { ...rig.value.work[0], links: [{ roomId: room.id, targetId: room.id }] };
   const next = { ...rig.value, work: [work, { ...work, id: 'later', title: 'Finish', links: [], dependencies: [work.id], outcomes: [], order: 1 }] };
   expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(first.entity, next)), first.version));
   const other = makePlan({ projectId: rig.plan.projectId, name: 'Upper floor' }); expectOk(await rig.stack.plans.save(other, 'absent'));
   const read = expectOk(await readProjectWork(rig.stack, rig.plan.projectId));
   expect(read.rows).toHaveLength(2); expect(read.rows[0].rooms.map(item => item.id)).toEqual([rig.roomId, room.id]); expect(read.rows[1].blocking.map(item => item.id)).toEqual([work.id]);
   const offline = { category: 'Persistence' as const, code: 'test.rooms', message: 'offline' };
   vi.spyOn(rig.stack.zones, 'listByProject').mockResolvedValueOnce(err(offline));
   const partial = expectOk(await readProjectWork(rig.stack, rig.plan.projectId)); expect(partial.roomsIncomplete).toBe(true); expect(partial.rows[0].rooms.every(item => item.name === null)).toBe(true); expect(partial.rows).toHaveLength(2);
 });
 it.each(['projects', 'plans'] as const)('preserves a %s read refusal instead of presenting an empty Work schedule', async (repository) => {
  const rig = await planningStack();
  const fault = { category: 'Persistence' as const, code: 'test.schedule-read', message: 'Cannot read schedule source' };
  if (repository === 'projects') vi.spyOn(rig.stack.projects, 'getById').mockResolvedValueOnce(err(fault));
  else vi.spyOn(rig.stack.plans, 'listByProject').mockResolvedValueOnce(err(fault));
  const bytes = [...rig.stack.vault.entries];
  expect(await readProjectWork(rig.stack, rig.plan.projectId)).toEqual(err(fault));
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 });
 it('reports a removed Project without recreating it or returning orphaned floor Work', async () => {
  const rig = await planningStack();
  rig.stack.vault.entries.delete(expectDefined(rig.stack.index.getPath(rig.plan.projectId), 'project path'));
  const bytes = [...rig.stack.vault.entries];
  expect(await readProjectWork(rig.stack, rig.plan.projectId)).toMatchObject({ ok: false, error: { code: 'project.not-found' } });
  expect([...rig.stack.vault.entries]).toEqual(bytes);
 });
});
