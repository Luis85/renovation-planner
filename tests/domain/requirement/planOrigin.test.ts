import { describe, expect, it } from 'vitest';
import { makeAsset, makeProject, makeRequirement } from '../../helpers/entities';
import { Requirement } from '../../../src/domain/requirement/Requirement';
import { originRoomId, requirementContext } from '../../../src/domain/requirement/RequirementOrigin';
import type { RequirementSource } from '../../../src/domain/requirement/RequirementSource';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';

const planId = 'plan-border' as PlanId;
const source: RequirementSource = { planId, targetId: 'wall-a', workId: '', outcomeId: '', state: 'intended', rule: 'wall-net', manual: '0', coverage: '1', lot: '', minimum: '' };

describe('a requirement whose origin is a plan (ADR-0031)', () => {
	it('names its context by its source target and has no room', () => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'plan', planId }, source });
		expect(originRoomId(requirement.origin)).toBeUndefined();
		expect(requirementContext(requirement)).toEqual({ roomId: 'wall-a', targetId: 'wall-a' });
		const zoneId = createZoneId();
		expect(requirementContext({ origin: { kind: 'zone', zoneId }, source })).toEqual({ roomId: zoneId, targetId: 'wall-a' });
	});
	it('needs a source on the same plan', () => {
		const base = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'plan', planId }, source });
		const props = { id: base.id, projectId: base.projectId, assetId: base.assetId, unit: base.unit, wasteFactor: base.wasteFactor, quantity: base.quantity, estimatedCost: base.estimatedCost, calculatedFrom: base.calculatedFrom };
		expect(Requirement.create({ ...props, origin: { kind: 'plan', planId } }).ok).toBe(false);
		expect(Requirement.create({ ...props, origin: { kind: 'plan', planId }, source: { ...source, planId: 'other' } }).ok).toBe(false);
	});
});
