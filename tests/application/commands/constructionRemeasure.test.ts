import { expect, it, vi } from 'vitest';
import { planningStack } from '../../helpers/planning';
import { expectDefined, expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { createRequirementId, type RequirementId } from '../../../src/domain/requirement/RequirementId';
import { RecalculateRequirementCommand } from '../../../src/application/commands/requirement/RecalculateRequirement';
import { registerOnPlanningChanged } from '../../../src/application/event-handlers/requirement/onPlanningChanged';

it('re-measures a plan-origin construction entry after its wall is raised (spec §6.5)', async () => {
	const rig = await planningStack();
	const render = makeAsset({ name: 'Render', unit: 'm2', category: 'material' }); expectOk(await rig.stack.assets.save(render, 'absent'));
	const input = { id: createRequirementId(), assetId: render.id, waste: '0', override: '',
		source: { planId: rig.plan.id, targetId: 'wall-a', workId: '', outcomeId: '', state: 'current' as const, rule: 'wall-gross' as const, manual: '0', coverage: '1', lot: '', minimum: '', construction: true as const } };
	expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
	const recalculate = new RecalculateRequirementCommand({ ...rig.deps, zones: rig.stack.zones });
	const notify = { cascadeAborted: vi.fn<() => void>(), staleMarkerFailed: vi.fn<() => void>() };
	const subscription = registerOnPlanningChanged(rig.deps.events, { ...rig.deps, logger: rig.stack.logger, notify, recalculate: request => recalculate.execute({ requirementId: request.requirementId as RequirementId }) });
	const entry = async () => expectDefined(expectOk(await rig.read()).materials.find(item => item.entity.id === input.id), 'construction entry').entity;
	expect((await entry()).origin).toEqual({ kind: 'plan', planId: rig.plan.id });
	const before = (await entry()).quantity.calculated.value.toString();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), structure = read.document.structure ?? EMPTY_STRUCTURE;
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...structure, walls: structure.walls.map(wall => wall.id === 'wall-a' ? { ...wall, height: 3000 } : wall) } }, read.version));
	await rig.deps.events.publish({ type: 'PlanStructureChanged', payload: { planId: rig.plan.id } });
	expect([before, (await entry()).quantity.calculated.value.toString()]).toEqual(['9.6', '12']);
	expect(notify.cascadeAborted).not.toHaveBeenCalled();
	subscription.dispose();
});
