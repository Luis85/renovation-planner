/**
 * "A project's own price for some asset may have moved."
 *
 * Written here rather than in the task that consumes it second: the Plan Editor's Inspector and
 * the project pane both need this door, and one source with two callers cannot drift the way two
 * hand-spelled subscriptions can.
 *
 * It REPORTS which project changed and narrows NOTHING itself, which is a decision about having
 * two callers rather than one. Filtering here would mean binding an active project id into the
 * source, and the Plan Editor holds a PLAN: resolving that to a project is an async read a
 * subscription cannot wait on before deciding to skip work, so a filtered source would charge
 * the caller that cannot pay. Each caller narrows at its own end, where the id already is.
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
import type { ProjectId } from '../../../src/domain/project/ProjectId';

/**
 * `heard` records the ARGUMENT of every delivery, not just how many there were. The count is
 * still what most cases assert; the two below that are about the argument read the list, because
 * a source that delivered the right number of callbacks carrying the wrong project would pass
 * every count assertion in this file.
 */
function wired() {
	const bus = createEventBus(() => undefined);
	const heard: (ProjectId | null)[] = [];
	const dispose = createProjectPricesChangeSource(bus)((projectId) => {
		heard.push(projectId);
	});
	return { bus, dispose, count: (): number => heard.length, delivered: heard };
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

	/**
	 * **The argument, which is the whole of Ruling 15.** The source used to hand its listener
	 * nothing, so a price set in project A re-read the price rows in every open pane for project
	 * B — correct and unusable. It reports the project instead, and each caller decides.
	 *
	 * Asserted on the DELIVERED VALUE rather than on a count: a build that fired the right number
	 * of callbacks carrying the wrong project passes every other case in this file.
	 */
	it('delivers the project the domain event names', async () => {
		const { bus, delivered } = wired();
		const other = createProjectId();

		await bus.publish(assetPriceOverrideChanged({ projectId: aProject, assetId: anAsset }));
		await bus.publish(assetPriceOverrideChanged({ projectId: other, assetId: createAssetId() }));

		expect(delivered).toEqual([aProject, other]);
	});

	/**
	 * **`null` for the index arm, and it means "cannot say" rather than "no project".**
	 * `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType` and no project id at
	 * all — the entry is a price NOTE whose owning project only a vault read could name — so
	 * this is the honest answer, and every narrowing caller treats it as a MATCH. A source that
	 * invented one here would be guessing.
	 */
	it('delivers null for an index-entry change, which no payload can name a project for', async () => {
		const { bus, delivered } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: 'price-1' as EntityId<string>, entityType: 'renovation-asset-price' }),
		);

		expect(delivered).toEqual([null]);
	});

	/**
	 * The narrowing guard on the PROJECT, the twin of the entity-type one above and there for the
	 * same reason: an event added to `PRICE_CHANGE_EVENTS` without this payload reports `null` —
	 * which every caller refreshes for — rather than an `undefined` compared against a project id
	 * and matching nothing.
	 */
	it('reports null for a price event carrying no project id', async () => {
		const { bus, delivered } = wired();

		await bus.publish({ type: 'AssetPriceOverrideChanged', payload: { assetId: anAsset } } as never);

		expect(delivered).toEqual([null]);
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
