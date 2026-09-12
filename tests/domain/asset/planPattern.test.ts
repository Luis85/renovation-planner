import { expect, it } from 'vitest';
import { makeAsset } from '../../helpers/entities';
import { Asset } from '../../../src/domain/asset/Asset';
import { PLAN_PATTERNS, isPlanPattern } from '../../../src/domain/asset/PlanPattern';

it('keeps a plan pattern from the fixed list and edits it independently', () => {
	expect(PLAN_PATTERNS).toEqual(['brick', 'stone', 'concrete', 'timber', 'insulation', 'drywall', 'glass']);
	expect(isPlanPattern('brick')).toBe(true); expect(isPlanPattern('marble')).toBe(false);
	const asset = makeAsset({ planPattern: 'brick' });
	expect(asset.planPattern).toBe('brick');
	expect(asset.withChanges({ name: 'Renamed' })).toMatchObject({ ok: true, value: { planPattern: 'brick' } });
	expect(asset.withChanges({ planPattern: null })).toMatchObject({ ok: true, value: { planPattern: null } });
	expect(makeAsset().planPattern).toBeNull();
});

it('refuses a pattern outside the list', () => {
	const asset = makeAsset();
	expect(Asset.create({ id: asset.id, name: 'x', category: 'material', unit: 'm2', unitCost: asset.unitCost, planPattern: 'marble' as never })).toMatchObject({ ok: false, error: { code: 'asset.unknown-plan-pattern' } });
});
