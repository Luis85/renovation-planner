import { describe, expect, it } from 'vitest';
import { planningStack } from '../../../helpers/planning';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { of } from '../../../../src/core/money/Money';
import { withPlanRenovation } from '../../../../src/domain/plan/Plan';
import { createRequirementId } from '../../../../src/domain/requirement/RequirementId';
import { EMPTY_DEPTH, type CostRecord, type Evidence } from '../../../../src/domain/renovation/PlanningDepth';
import { planningDraft, planningInput } from '../../../../src/presentation/editor/planning/planningDraft';
import { planningSelectionContext } from '../../../../src/presentation/editor/planning/planningSelectionContext';
import { planningFindings } from '../../../../src/presentation/editor/planning/planningProjection';
import { removalSources } from '../../../../src/presentation/editor/planning/removalSources';
import type { PlanEditorContext } from '../../../../src/presentation/editor/PlanEditorContext';

/** A plan-origin material, a cost and a photo on `wall-a`, none of them bound to a room (ADR-0030, ADR-0031). */
async function roomlessRig() {
	const rig = await planningStack();
	const render = makeAsset({ name: 'Render', unit: 'm2', category: 'material' }); expectOk(await rig.stack.assets.save(render, 'absent'));
	const materialId = createRequirementId();
	expectOk(await rig.planning.material(expectOk(await rig.read()), { id: materialId, assetId: render.id, waste: '0', override: '',
		source: { planId: rig.plan.id, targetId: 'wall-a', workId: '', outcomeId: '', state: 'current', rule: 'wall-net', manual: '0', coverage: '1', lot: '', minimum: '' } }, rig.ledger).execute());
	const cost: CostRecord = { id: 'cost-wall', targetId: 'wall-a', workId: '', title: 'Mortar', category: 'other', requirementId: '', planned: of('10', 'EUR'), cancelled: false,
		facts: [{ id: 'order', stage: 'committed', amount: of('25', 'EUR'), description: 'Order', commitmentId: '', cancelled: false }] };
	const evidence: Evidence = { id: 'photo-wall', targetId: 'wall-a', workId: '', recordId: '', path: 'Evidence/wall.jpg', subpath: '', description: 'Cracked render', type: 'photo', phase: 'before', pin: null };
	const read = expectOk(await rig.read());
	const plan = expectOk(withPlanRenovation(read.plan.entity, { ...rig.value, depth: { ...EMPTY_DEPTH, costs: [cost], evidence: [evidence] } }));
	return { ...rig, render, materialId, baseline: { ...read, plan: { ...read.plan, entity: plan } } };
}

describe('planning drafts for records with no room', () => {
	it('opens a room-less material, cost and photo with no room, on their own wall', async () => {
		const rig = await roomlessRig(), focus = { targetId: 'wall-a' };
		expect(planningDraft('material', rig.baseline, '', rig.materialId, focus)).toMatchObject({ id: rig.materialId, requirementId: rig.materialId, roomId: '', targetId: 'wall-a', assetId: rig.render.id });
		expect(planningDraft('cost', rig.baseline, '', 'cost-wall', focus)).toMatchObject({ id: 'cost-wall', roomId: '', targetId: 'wall-a', title: 'Mortar' });
		expect(planningDraft('evidence', rig.baseline, '', 'photo-wall', focus)).toMatchObject({ id: 'photo-wall', roomId: '', targetId: 'wall-a', title: 'Cracked render' });
	});

	it('writes a room-less draft back without a room rather than with an empty one', async () => {
		const rig = await roomlessRig();
		const input = planningInput({ ...planningDraft('cost', rig.baseline, '', 'cost-wall', { targetId: 'wall-a' }), title: 'Lime mortar' }, rig.baseline);
		const saved = expectDefined(input.renovation.depth?.costs.find(item => item.id === 'cost-wall'), 'saved cost');
		expect(saved).toMatchObject({ targetId: 'wall-a', title: 'Lime mortar' });
		expect(saved).not.toHaveProperty('roomId');
	});

	it('resolves a focused plan-origin material as the requirement link, with no room', async () => {
		const rig = await roomlessRig();
		const context = planningSelectionContext(rig.baseline, '', rig.materialId, 'wall-a');
		expect(context).toMatchObject({ requirementId: rig.materialId, recordId: rig.materialId, targetId: 'wall-a' });
		expect(context).not.toHaveProperty('roomId');
	});
});

describe('planning findings and removal names for records with no room', () => {
	it('reports a stale plan-origin material and an overspent room-less cost under no room', async () => {
		const rig = await roomlessRig();
		const stale = { ...rig.baseline, materials: rig.baseline.materials.map(item => ({ ...item, entity: expectOk(item.entity.markedStale()) })) };
		expect(planningFindings(stale).map(({ kind, roomId, id }) => ({ kind, roomId, id }))).toEqual([
			{ kind: 'reconciliation', roomId: '', id: 'cost-wall' },
			{ kind: 'stale', roomId: '', id: rig.materialId },
		]);
	});

	it('names a plan-origin material before its wall is removed', async () => {
		const rig = await roomlessRig();
		const context = { planId: rig.plan.id, commands: { planning: rig.planning } } as unknown as Pick<PlanEditorContext, 'planId' | 'commands'>;
		expect(expectOk(await removalSources(context, ['wall-a']))).toEqual(['Render']);
		expect(expectOk(await removalSources(context, ['wall-b']))).toEqual([]);
	});
});
