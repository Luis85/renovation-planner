/**
 * "A project's own price for some asset may have moved."
 *
 * Written here rather than in the task that consumes it second: the Plan Editor's Inspector and
 * the project pane both need this door, and one source with two callers cannot drift the way two
 * hand-spelled subscriptions can.
 *
 * UNFILTERED, which is a decision about the CALLER rather than about the event — the payload
 * carries both ids, and the Plan Editor holds neither: its subject is a PLAN, and resolving that
 * to a project is an async read a subscription cannot wait on before deciding to skip work.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createProjectPricesChangeSource } from '../../../src/application/events/projectPricesChangeSource';
import { assetPriceOverrideChanged } from '../../../src/domain/asset-price/AssetPriceOverride.events';
import { assetUpdated } from '../../../src/domain/asset/Asset.events';
import { requirementInvalidated } from '../../../src/domain/requirement/Requirement.events';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';

function wired() {
	const bus = createEventBus(() => undefined);
	let heard = 0;
	const dispose = createProjectPricesChangeSource(bus)(() => {
		heard += 1;
	});
	return { bus, dispose, count: (): number => heard };
}

const aProject = createProjectId();
const anAsset = createAssetId();

describe('createProjectPricesChangeSource', () => {
	/**
	 * ONE event for set, replace and clear alike — `AssetPriceOverride.events.ts` states that as
	 * its own decision, so this list is that decision read back rather than a narrowing.
	 */
	it('delivers AssetPriceOverrideChanged, whichever project and asset it names', async () => {
		const { bus, count } = wired();

		await bus.publish(assetPriceOverrideChanged({ projectId: aProject, assetId: anAsset }));
		await bus.publish(assetPriceOverrideChanged({ projectId: createProjectId(), assetId: createAssetId() }));

		expect(count()).toBe(2);
	});

	/**
	 * The two neighbouring doors, each a separate reason. `AssetUpdated` is the CATALOGUE's
	 * event — the shared library default moved for every project — and the price door delivering
	 * it would make the two sources duplicates. `RequirementInvalidated` is the recalculation
	 * door's, and it fires AFTER the figure moved rather than when the price did.
	 */
	it.each([
		['AssetUpdated', () => assetUpdated({ assetId: anAsset })],
		['RequirementInvalidated', () => requirementInvalidated(createRequirementId())],
	])('stays silent for %s', async (_name, make) => {
		const { bus, count } = wired();

		await bus.publish(make());

		expect(count()).toBe(0);
	});

	it('stops delivering once disposed', async () => {
		const { bus, dispose, count } = wired();

		dispose();
		await bus.publish(assetPriceOverrideChanged({ projectId: aProject, assetId: anAsset }));

		expect(count()).toBe(0);
	});
});
