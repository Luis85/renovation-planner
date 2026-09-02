/**
 * The Inspector's own subscription: "this requirement's STORED figures moved."
 *
 * A FOURTH source beside the plan, catalogue and project-list ones, and the argument for it is
 * an ORDERING rather than a narrowing. The unit-cost block has three inputs — the library's
 * price, this project's own, and the provenance `calculatedFrom.unitCost` records — and neither
 * `AssetUpdated` nor `AssetPriceOverrideChanged` rewrites the third. The cascade does, and it is
 * a SIBLING subscriber of any refresh bound to those two: `EventBus.publish` delivers to every
 * handler without ordering them, so re-reading on either races the recalculation rather than
 * following it, and the block settles showing the new price beside the old provenance.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createRequirementFiguresChangeSource } from '../../../src/application/events/requirementFiguresChangeSource';
import {
	costEstimateChanged,
	requirementCreated,
	requirementInvalidated,
	requirementRecalculated,
} from '../../../src/domain/requirement/Requirement.events';
import { assetPriceOverrideChanged } from '../../../src/domain/asset-price/AssetPriceOverride.events';
import { assetUpdated } from '../../../src/domain/asset/Asset.events';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../src/core/money/Money';

function wired() {
	const bus = createEventBus(() => undefined);
	const heard: string[] = [];
	const dispose = createRequirementFiguresChangeSource(bus)((requirementId) => heard.push(requirementId));
	return { bus, heard, dispose };
}

const aRequirement = createRequirementId();
const anotherRequirement = createRequirementId();
const aProject = createProjectId();
const anAsset = createAssetId();

describe('createRequirementFiguresChangeSource', () => {
	/**
	 * BOTH events, and the invalidation is the one a `RequirementRecalculated`-only source would
	 * miss on exactly the path that needs it most. Measured in `cascade.ts`'s `recalculateOne`:
	 * it persists the stale marker, publishes `RequirementInvalidated`, then recalculates — and
	 * on a recalculation FAILURE it publishes nothing at all, deliberately, because
	 * `RequirementRecalculated` "would misrepresent what happened". So after a failed
	 * recalculation the durable status is `stale` and the invalidation is the only event that
	 * followed the write; a source hearing recalculations alone would leave a mounted Inspector
	 * rendering that row as `current` for the life of the selection.
	 */
	it.each([
		['RequirementInvalidated', () => requirementInvalidated(aRequirement)],
		['RequirementRecalculated', () => requirementRecalculated({ requirementId: aRequirement, projectId: aProject })],
	])('delivers %s with the id it names', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

		expect(heard).toEqual([aRequirement]);
	});

	/**
	 * A successful recalculation delivers BOTH, in that order. Collapsing the pair is the
	 * consumer's single-flight loader's job, not this source's — picking one event here to
	 * avoid the second delivery is exactly the choice that loses the failure path above.
	 */
	it('delivers both events of one successful recalculation, in the order the cascade published them', async () => {
		const { bus, heard } = wired();

		await bus.publish(requirementInvalidated(aRequirement));
		await bus.publish(requirementRecalculated({ requirementId: aRequirement, projectId: aProject }));

		expect(heard).toEqual([aRequirement, aRequirement]);
	});

	/**
	 * The id is what the CONSUMER filters on, so delivering the wrong one is worse than
	 * delivering none: the Inspector would re-read for a requirement it is not drawing and skip
	 * the one it is. Two ids, asserted as a sequence rather than a membership.
	 */
	it('delivers each requirement its own id', async () => {
		const { bus, heard } = wired();

		await bus.publish(requirementInvalidated(aRequirement));
		await bus.publish(requirementRecalculated({ requirementId: anotherRequirement, projectId: aProject }));

		expect(heard).toEqual([aRequirement, anotherRequirement]);
	});

	/**
	 * The events this source must NOT carry, and each is a different reason rather than three
	 * spellings of one. `AssetPriceOverrideChanged` and `AssetUpdated` are the two the price and
	 * catalogue doors already answer — delivering them here would make this source a duplicate
	 * of those and would put the race back, since both fire before the figure they move.
	 * `RequirementCreated` names a requirement whose figures have not MOVED. And
	 * `CostEstimateChanged` is the one that would slip past a guard written on "does it mention
	 * a requirement": it carries the id inside `scope`, not as `payload.requirementId`, so the
	 * narrowing guard declines it rather than delivering an `undefined`.
	 */
	it.each([
		['AssetPriceOverrideChanged', () => assetPriceOverrideChanged({ projectId: aProject, assetId: anAsset })],
		['AssetUpdated', () => assetUpdated({ assetId: anAsset })],
		['RequirementCreated', () => requirementCreated({ requirementId: aRequirement, projectId: aProject })],
		[
			'CostEstimateChanged',
			() =>
				costEstimateChanged({
					costType: 'estimated',
					scope: { kind: 'requirement', id: aRequirement },
					currency: 'EUR',
					previous: moneyOf('1.00', 'EUR'),
					current: moneyOf('2.00', 'EUR'),
				}),
		],
	])('stays silent for %s', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

		expect(heard).toEqual([]);
	});

	/**
	 * The narrowing guard, driven directly rather than through a factory — no factory in
	 * `Requirement.events.ts` can produce these, which is the point: the guard is there so that
	 * an event added to the list above WITHOUT a `requirementId` is simply never delivered,
	 * instead of handing every listener an `undefined` to filter its rows on. `planChangeSource`
	 * carries the identical guard and drives it the same way.
	 */
	it.each([
		['no payload at all', { type: 'RequirementInvalidated' }],
		['a payload naming something else', { type: 'RequirementRecalculated', payload: { projectId: aProject } }],
	])('declines an event carrying %s', async (_name, event) => {
		const { bus, heard } = wired();

		await bus.publish(event as never);

		expect(heard).toEqual([]);
	});

	/**
	 * The disposal, asserted for BOTH events. A source that unsubscribed one of the two would
	 * leave a retired Vue tree still re-reading on the other — and Obsidian REUSES a view, so
	 * that listener writes into a store nothing renders any more.
	 */
	it('stops delivering both events once disposed', async () => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(requirementInvalidated(aRequirement));
		await bus.publish(requirementRecalculated({ requirementId: aRequirement, projectId: aProject }));

		expect(heard).toEqual([]);
	});
});
