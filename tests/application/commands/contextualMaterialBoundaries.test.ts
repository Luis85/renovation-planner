import { expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { zoneSequenceCollaborators } from '../../helpers/slice10';
import { Requirement } from '../../../src/domain/requirement/Requirement';
import { of } from '../../../src/core/money/Money';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';

async function setup() {
	const rig = await planningStack();
	expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
	const material = expectDefined(expectOk(await rig.read()).materials[0], 'persisted contextual material');
	const recalculate = new RecalculateRequirementCommand({ ...rig.deps, zones: rig.stack.zones });
	return { ...rig, material, recalculate };
}

it('recalculates an unpackaged material while preserving its identity, due date and independent overrides', async () => {
	const rig = await setup();
	const dated = expectOk(Requirement.create({ ...rig.material.entity, requiredDate: '2026-10-20' }));
	const quantified = expectOk(dated.withQuantityOverride({ value: new Decimal('20'), unit: 'm2' }));
	const edited = expectOk(quantified.withCostOverride(of('999', 'EUR')));
	expectOk(await rig.deps.requirements.save(expectOk(edited.markedStale()), rig.material.version));
	const write = vi.spyOn(rig.deps.requirements, 'save');
	const result = expectOk(await rig.recalculate.execute({ requirementId: rig.material.entity.id }));
	expect(write).toHaveBeenCalledOnce();
	expect(result.id).toBe(rig.material.entity.id);
	expect(result.source).toEqual(rig.input.source);
	expect(result.requiredDate).toBe('2026-10-20');
	expect(result.quantity.calculated.value.toString()).toBe('13.2');
	expect(result.quantity.override?.value.toString()).toBe('20');
	expect(result.estimatedCost.calculated).toEqual(of('900', 'EUR'));
	expect(result.estimatedCost.override).toEqual(of('999', 'EUR'));
	expect(result.recalculationStatus).toBe('current');
	const persisted = expectDefined(expectOk(await rig.deps.requirements.getById(result.id)), 'reread material');
	expect(persisted.entity).toEqual(result);
});

it('refuses moving a contextual material to another Room during delete resolution and leaves no writes or recovery marker', async () => {
	const rig = await setup();
	const createRoom = new CreateZoneCommand(rig.stack.zones, rig.deps.plans, rig.deps.events);
	const target = expectOk(await createRoom.execute({ planId: rig.plan.id, name: 'Alternative room', zoneType: 'Room', geometry: { points: [{ x: 6000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 2000 }, { x: 6000, y: 2000 }] } })).zone.entity;
	const sequence = zoneSequenceCollaborators();
	const remove = new DeleteZoneCommand({ ...rig.deps, ...sequence, zones: rig.stack.zones, recalculate: rig.recalculate, logger: rig.stack.logger });
	const before = [...rig.stack.vault.entries];
	const save = vi.spyOn(rig.deps.requirements, 'save'), deleted = vi.spyOn(rig.stack.zones, 'delete'), recalculated = vi.spyOn(rig.recalculate, 'execute');
	const failure = expectErr(await remove.execute({ zoneId: rig.roomId, resolution: 'reassign', reassignTo: target.id, resolvedReferents: [rig.material.entity.id] }));
	expect(failure.code).toBe('requirement.source-invalid');
	expect(save).not.toHaveBeenCalled();
	expect(deleted).not.toHaveBeenCalled();
	expect(recalculated).not.toHaveBeenCalled();
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(expectOk(await sequence.markers.list())).toEqual([]);
	expect(expectOk(await rig.deps.requirements.getById(rig.material.entity.id))).toEqual(rig.material);
});
