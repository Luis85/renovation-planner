import { expect, it } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { makeZone } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import { of } from '../../../src/core/money/Money';
import { recordChoices } from '../../../src/presentation/editor/planning/recordChoices';
import { hasRoomContext } from '../../../src/domain/renovation/SharedLinks';

it('uses shared Work for a linked Room outcome, material, cost and evidence without moving its owner', async () => {
	const rig = await planningStack(), room = makeZone({ planId: rig.plan.id, projectId: rig.plan.projectId, name: 'Annex' });
	expectOk(await rig.stack.zones.save(room, 'absent'));
	const subject = { ...rig.value.subjects[0], id: 'detail-annex', roomId: room.id, targetId: room.id };
	const shared = { ...rig.value.work[0], links: [{ roomId: room.id, targetId: room.id }], outcomes: ['detail-floor', subject.id] };
	const cost = { ...rig.cost, id: 'cost-annex', roomId: room.id, targetId: room.id, requirementId: '', planned: of('100', 'EUR'), facts: [] };
	const evidence = { ...rig.evidence, roomId: room.id, targetId: room.id, recordId: shared.id };
	const value = { ...rig.value, subjects: [...rig.value.subjects, subject], work: [shared], depth: { ...EMPTY_DEPTH, costs: [cost], evidence: [evidence] } };
	expectOk(await rig.renovation.command(expectOk(await rig.read()), { renovation: value, intended: undefined }, rig.ledger).execute());
	const baseline = expectOk(await rig.read());
	expect(recordChoices(baseline, room.id)).toContainEqual({ id: shared.id, label: shared.title });
	expect(recordChoices(baseline, 'unrelated')).not.toContainEqual({ id: shared.id, label: shared.title });
	const input = { ...rig.input, roomId: room.id, source: { ...rig.input.source, targetId: room.id, outcomeId: subject.id } };
	const material = rig.planning.material(baseline, input, rig.ledger); expectOk(await material.execute());
	const saved = expectOk(await rig.read());
	expect(saved.materials[0].entity.source).toMatchObject({ workId: shared.id, outcomeId: subject.id });
	expect(saved.plan.entity.renovation?.work[0].roomId).toBe(rig.roomId);
	expect(hasRoomContext(shared, room.id)).toBe(true); expect(hasRoomContext(shared, 'unrelated')).toBe(false);
	expect(hasRoomContext(undefined, room.id)).toBe(false); expect(hasRoomContext(shared, undefined)).toBe(false);
	const unlinked = { ...value, work: [{ ...shared, links: [] }] };
	expect((await rig.renovation.command(saved, { renovation: unlinked, intended: undefined }, rig.ledger).execute()).ok).toBe(false);
	// Even after removing the secondary outcome/cost/evidence, its material still needs this context.
	const materialOnly = { ...unlinked, work: [{ ...shared, links: [], outcomes: ['detail-floor'] }], depth: EMPTY_DEPTH };
	expect((await rig.renovation.command(expectOk(await rig.read()), { renovation: materialOnly, intended: undefined }, rig.ledger).execute()).ok).toBe(false);
	expect(expectOk(await rig.read()).plan.entity.renovation).toEqual(value);
	expectOk(await material.undo()); expect(expectOk(await rig.read()).materials).toHaveLength(0);
});
