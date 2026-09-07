import type { downstreamStack } from './downstream';
import { expectDefined, expectOk } from './domain';
import { makePlan, makeZone } from './entities';
import { withPlanRenovation } from '../../src/domain/plan/Plan';
/** A second canonical floor makes source identity and local filtering observable. */
export async function downstreamFloor(rig: Awaited<ReturnType<typeof downstreamStack>>) {
 const plan = makePlan({ projectId: rig.plan.projectId, name: 'Upper floor' }); expectOk(await rig.persistence.plans.save(plan, 'absent'));
 const room = makeZone({ projectId: rig.plan.projectId, planId: plan.id, name: 'Upper room', zoneType: 'Room' }); expectOk(await rig.persistence.zones.save(room, 'absent'));
 const loaded = expectDefined(expectOk(await rig.persistence.plans.getById(plan.id)), 'other floor');
 const work = { ...rig.value.work[0], id: 'work-upper', roomId: room.id, targetId: room.id, outcomes: [] };
 expectOk(await rig.persistence.plans.save(expectOk(withPlanRenovation(loaded.entity, { subjects: [], work: [work], decisions: [] })), loaded.version));
 return { plan, room, work };
}
