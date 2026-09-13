import { expect, it } from 'vitest';
import { makeAsset } from '../../helpers/entities';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { constructionSteps } from '../../../src/application/commands/renovation/constructionEntries';
import type { PlanningBaseline } from '../../../src/application/commands/renovation/materialPlanning';

it('counts a door product priced per piece and gives a room-bound wall its room (ADR-0031)', () => {
	const door = makeAsset({ name: 'Oak door', unit: 'piece', category: 'fixture' }), render = makeAsset({ name: 'Render', unit: 'm2', category: 'material' });
	const baseline = { plan: { entity: { id: 'plan-a' } }, materials: [], catalogue: [door, render].map(asset => ({ asset })) } as unknown as PlanningBaseline;
	const steps = constructionSteps(baseline, { ...EMPTY_RENOVATION, subjects: [
		{ id: 'detail-door', targetId: 'opening-a', kind: 'door', existing: null, planned: { change: 'add', description: 'Oak door', assetId: door.id } },
		{ id: 'detail-wall', roomId: 'room-a', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good' }, planned: { change: 'modify', description: 'Rendered', assetId: render.id } },
	] });
	expect(steps.map(step => step.kind === 'save' ? [step.input.assetId, step.input.source.rule, step.input.roomId] : step)).toEqual([[door.id, 'count', undefined], [render.id, 'wall-net', 'room-a']]);
});
