import { afterEach, expect, it, vi } from 'vitest';
import { err } from '../../../../src/core/result/Result';
import { assignedRequirementFixture } from '../../../helpers/slice10';
import { expectFound, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

afterEach(() => vi.restoreAllMocks());

it.each(['assign', 'recalculate'] as const)('retains existing Room quantities and costs when %s cannot read project pricing, then permits retry', async action => {
	const rig = await assignedRequirementFixture(), asset = expectOk(await rig.assets.save(makeAsset(), 'absent')).entity;
	const before = expectFound(await rig.requirements.getById(rig.requirementId));
	const failure = injectedPersistenceError(), read = vi.spyOn(rig.overrides, 'getForPair').mockResolvedValueOnce(err(failure));
	const write = vi.spyOn(rig.requirements, 'save'), publish = vi.spyOn(rig.events, 'publish');
	const run = () => action === 'assign' ? rig.assign.execute({ zoneId: rig.zoneId, assetId: asset.id }) : rig.recalculate.execute({ requirementId: rig.requirementId });
	expect(await run()).toEqual({ ok: false, error: failure });
	expect(read).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
	expect(expectFound(await rig.requirements.getById(rig.requirementId))).toEqual(before);
	expect((await run()).ok).toBe(true); expect(write).toHaveBeenCalledOnce();
});
