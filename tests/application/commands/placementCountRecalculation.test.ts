import { expect, it, vi } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { placementPoints } from '../../../src/domain/spatial/assetPlacement';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { registerOnPlanningChanged } from '../../../src/application/event-handlers/requirement/onPlanningChanged';

it('recalculates a placement-count material each time a placement is written into its room', async () => {
	const rig = await planningStack();
	const radiator = makeAsset({ name: 'Radiator', unit: 'piece' }); expectOk(await rig.stack.assets.save(radiator, 'absent'));
	const input = { ...rig.input, assetId: radiator.id, waste: '0', source: { ...rig.input.source, rule: 'placement-count' as const } };
	expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
	const recalculate = new RecalculateRequirementCommand({ ...rig.deps, zones: rig.stack.zones });
	const notify = { cascadeAborted: vi.fn<() => void>(), staleMarkerFailed: vi.fn<() => void>() };
	const subscription = registerOnPlanningChanged(rig.deps.events, { ...rig.deps, logger: rig.stack.logger, notify, recalculate: request => recalculate.execute({ requirementId: request.requirementId as RequirementId }) });
	async function placeAndCount(x: number, y: number): Promise<string> {
		const before = expectOk(await rig.geometry.read(rig.plan.id)), structure = before.document.structure ?? EMPTY_STRUCTURE;
		const element = { id: `element-${x}`, kind: 'asset' as const, assetId: radiator.id, points: placementPoints({ x, y }, 0) };
		expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, elements: [...structure.elements ?? [], element] } }, before.version));
		await rig.deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: rig.plan.id } });
		return expectDefined(expectOk(await rig.read()).materials.find(item => item.entity.id === input.id), 'placement material').entity.quantity.calculated.value.toString();
	}
	expect(await placeAndCount(1000, 1000)).toBe('1');
	expect(await placeAndCount(2000, 1500)).toBe('2');
	expect(notify.cascadeAborted).not.toHaveBeenCalled();
	subscription.dispose();
});
