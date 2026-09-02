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
import { projectIndexEntryChanged } from '../../../src/application/events/projectIndex.events';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createRequirementId } from '../../../src/domain/requirement/RequirementId';
import type { EntityId } from '../../../src/core/identity/EntityId';

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
	 * **The half no COMMAND can raise.** An override note edited by hand, copied in, arriving
	 * through sync, or deleted outside the two commands publishes no domain event at all —
	 * `VaultChangeAdapter` is the sole index writer for those and announces this instead. Without
	 * it a mounted Inspector shows the previous project price, and the provenance beside it, for
	 * the life of the leaf.
	 */
	it('delivers an index-entry change for a price override note', async () => {
		const { bus, count } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: 'price-1' as EntityId<string>, entityType: 'renovation-asset-price' }),
		);

		expect(count()).toBe(1);
	});

	/**
	 * The FILTER, and it is the widened-mutation guard for the case above rather than a
	 * politeness: unfiltered, a burst of synced zone notes would re-read one selected zone's
	 * requirements once per note. Asserted per entity type, because a guard comparing the wrong
	 * field — or an inverted comparison — passes the case above and fails only here.
	 */
	it.each(['renovation-project', 'renovation-plan', 'renovation-zone', 'renovation-asset', 'renovation-requirement'] as const)(
		'stays silent for an index-entry change naming %s',
		async (entityType) => {
			const { bus, count } = wired();

			await bus.publish(projectIndexEntryChanged({ entityId: 'e-1' as EntityId<string>, entityType }));

			expect(count()).toBe(0);
		},
	);

	/**
	 * The narrowing guard itself, driven with an event carrying no type at all — the shape that
	 * exists so an event added to the list above WITHOUT this payload is never delivered, rather
	 * than comparing `undefined` against an entity type.
	 */
	it('declines an index-entry change carrying no entity type', async () => {
		const { bus, count } = wired();

		await bus.publish({ type: 'ProjectIndexEntryChanged', payload: { entityId: 'e-1' } } as never);

		expect(count()).toBe(0);
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

	/** Disposal, asserted for BOTH lists — a source that unsubscribed one would leave a retired
	 *  Vue tree still re-reading on the other. */
	it('stops delivering both events once disposed', async () => {
		const { bus, dispose, count } = wired();

		dispose();
		await bus.publish(assetPriceOverrideChanged({ projectId: aProject, assetId: anAsset }));
		await bus.publish(
			projectIndexEntryChanged({ entityId: 'price-1' as EntityId<string>, entityType: 'renovation-asset-price' }),
		);

		expect(count()).toBe(0);
	});
});
