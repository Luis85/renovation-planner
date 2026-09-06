import { describe, expect, it } from 'vitest';
import { planningDraft, planningInput } from '../../../src/presentation/editor/planning/planningDraft';
import { planningStack } from '../../helpers/planning';
import { expectOk } from '../../helpers/domain';

async function setup() {
	const rig = await planningStack();
	const input = { ...rig.input, source: { ...rig.input.source, targetId: 'wall-a', rule: 'wall-net' as const } };
	expectOk(await rig.planning.material(expectOk(await rig.read()), input, rig.ledger).execute());
	const cost = { ...rig.cost, targetId: 'wall-a' };
	const evidence = { ...rig.evidence, targetId: 'wall-a' };
	expectOk(await rig.renovation.command(expectOk(await rig.read()), {
		renovation: { ...rig.value, depth: { ...rig.depth, costs: [cost], evidence: [evidence] } }, intended: undefined,
	}, rig.ledger).execute());
	return { ...rig, baseline: expectOk(await rig.read()) };
}

describe('contextual planning drafts through canonical records', () => {
	it('inherits material target, Work and record link into a persistable new document', async () => {
		const rig = await setup();
		const draft = planningDraft('evidence', rig.baseline, rig.roomId, '', rig.input.id);
		expect(draft).toMatchObject({ targetId: 'wall-a', workId: 'work-sand', recordId: rig.input.id });
		draft.title = 'Wall specification'; draft.path = 'Evidence/wall.md';
		expectOk(await rig.renovation.command(rig.baseline, planningInput(draft, rig.baseline), rig.ledger).execute());
		expect(expectOk(await rig.read()).plan.entity.renovation?.depth?.evidence.find(item => item.id === draft.id))
			.toMatchObject({ targetId: 'wall-a', workId: 'work-sand', recordId: rig.input.id });
	});
	it('links a new cost to a focused material without copying its override into a new material', async () => {
		const rig = await setup();
		expect(planningDraft('cost', rig.baseline, rig.roomId, '', rig.input.id))
			.toMatchObject({ targetId: 'wall-a', workId: 'work-sand', requirementId: rig.input.id });
		const material = planningDraft('material', rig.baseline, rig.roomId, '', rig.input.id);
		expect(material).toMatchObject({ targetId: 'wall-a', requirementId: '', assetId: '', override: '' });
		expect(material.id).not.toBe(rig.input.id);
	});
	it('uses a cost context and unwraps evidence focus to its linked record rather than linking evidence to itself', async () => {
		const rig = await setup();
		for (const id of [rig.cost.id, rig.evidence.id]) {
			expect(planningDraft('evidence', rig.baseline, rig.roomId, '', id))
				.toMatchObject({ targetId: 'wall-a', workId: 'work-sand', recordId: rig.cost.id, path: '', title: '' });
		}
	});
	it('keeps existing record identity and context when another item has focus', async () => {
		const rig = await setup();
		expect(planningDraft('evidence', rig.baseline, rig.roomId, rig.evidence.id, 'detail-floor'))
			.toMatchObject({ id: rig.evidence.id, targetId: 'wall-a', workId: 'work-sand', recordId: rig.cost.id, path: rig.evidence.path });
	});
	it('drops stale and foreign-room focus and supports Work, Existing/Planned and Decision context', async () => {
		const rig = await setup();
		for (const id of ['missing', rig.input.id, rig.cost.id, rig.evidence.id, 'work-sand', 'detail-floor', 'decision-finish']) {
			expect(planningDraft('evidence', rig.baseline, 'different-room', '', id))
				.toMatchObject({ targetId: 'different-room', workId: '', recordId: '' });
		}
		for (const id of ['work-sand', 'detail-floor', 'decision-finish']) {
			expect(planningDraft('evidence', rig.baseline, rig.roomId, '', id).recordId).toBe(id);
		}
		expect(planningDraft('material', rig.baseline, rig.roomId, '', 'detail-floor').source.outcomeId).toBe('detail-floor');
	});
});
