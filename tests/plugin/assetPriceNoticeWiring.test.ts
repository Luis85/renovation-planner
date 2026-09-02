// @vitest-environment jsdom
// jsdom: the notice host builds its markup with Obsidian's own `createSpan`/`createEl`
// globals, exactly as `tests/plugin/sequenceNoticeWiring.test.ts` does.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Mock-only surface, imported BY NAME — see `sequenceNoticeWiring.test.ts`'s own comment for
// why this is the same class the `'obsidian'` alias resolves to.
import { Notice } from '../helpers/obsidian-mock';
import { activateNotices } from '../../src/presentation/notices/notify';
import { installObsidianDom } from '../helpers/dom';
import { composeSlice10 } from '../../src/plugin/slice10Composition';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryAssetRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { RecalculateRequirementCommand } from '../../src/application/commands/requirement/RecalculateRequirement';
import { SetAssetPriceOverrideCommand } from '../../src/application/commands/asset-price/SetAssetPriceOverride';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../src/core/events/EventBus';
import { err } from '../../src/core/result/Result';
import { persistenceError } from '../../src/application/errors';
import { of as moneyOf } from '../../src/core/money/Money';
import { recorder as logger } from '../helpers/logger';
import { expectOk } from '../helpers/domain';
import { makeAsset, makeProject } from '../helpers/entities';

installObsidianDom();

/**
 * `DeleteAssetDeps.notify` is OPTIONAL, for the suite's benefit — which is exactly what lets
 * a composition that forgets to bind `priceCleanupFailed` compile, pass and say nothing: the
 * promised user-visible warning would silently degrade back to the log line Task 7a exists to
 * stop it being. This wires `composeSlice10` for real — the module `deleteAsset` and
 * `sequenceNotices` are both actually built in — and drives an override-delete failure through
 * it, the same shape `sequenceNoticeWiring.test.ts` already uses for its marker-clear sibling.
 */
async function wired() {
	const projects = new InMemoryProjectRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const events = createEventBus();
	const locks = new ReferenceLocks();
	const index = new InMemoryProjectIndex();
	const recalculate = new RecalculateRequirementCommand({ requirements, zones, assets, events, projects, overrides });
	const slice10 = composeSlice10({
		zones,
		assets,
		requirements,
		projects,
		index,
		recalculate,
		events,
		locks,
		logger,
		overrides,
	});

	const project = expectOk(await projects.save(makeProject(), 'absent'));
	const asset = expectOk(await assets.save(makeAsset(), 'absent'));
	const setOverride = new SetAssetPriceOverrideCommand({ overrides, projects, assets, events, locks });
	expectOk(await setOverride.execute({
		projectId: project.entity.id,
		assetId: asset.entity.id,
		unitCost: moneyOf('19.50', 'EUR'),
		expected: 'absent',
	}));

	return { slice10, overrides, assetId: asset.entity.id };
}

beforeEach(() => {
	activateNotices();
});

describe('asset price cleanup notice wiring', () => {
	it('tells the user when an asset delete leaves a price note behind', async () => {
		const { slice10, overrides, assetId } = await wired();
		vi.spyOn(overrides, 'delete').mockResolvedValue(err(persistenceError('asset-price.delete-failed', 'no')));

		const before = Notice.shown.length;
		const deleted = await slice10.deleteAsset.execute({ assetId });

		// Both halves together. The delete SUCCEEDED — the asset really is gone — so asserting
		// the notice alone would pass just as well against a build that had started failing the
		// whole deletion, which is the over-correction this pairing exists to refuse.
		expect(deleted.ok).toBe(true);
		expect(Notice.shown.length).toBe(before + 1);
		expect(Notice.shown.at(-1)).toContain('price note');
	});

	it('a delete that cleans up its overrides normally says nothing to the user', async () => {
		const { slice10, assetId } = await wired();

		const before = Notice.shown.length;
		const deleted = await slice10.deleteAsset.execute({ assetId });

		// The counterpart, without which the case above is satisfied by a `notify` called
		// after every successful delete — a warning on the happy path.
		expect(deleted.ok).toBe(true);
		expect(Notice.shown.length).toBe(before);
	});
});
