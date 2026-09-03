/**
 * The Asset library's own subscription: "keeping a loaded mark honest" (design spec §5.4).
 *
 * A FOURTH source beside the plan, project-list and catalogue ones — §11 item 7's own ruling —
 * because widening `createAssetCatalogueChangeSource` would make the assign picker re-read
 * every asset note on a design or geometry event it has no use for, a cost on a surface this
 * increment does not own.
 *
 * Every case here AWAITS `publish`: `EventBus.publish` is Promise-aware and costs one
 * microtask hop per delivery even for a synchronous handler (its own docblock says so
 * "deliberate"). A case asserting on an unawaited publish reads `heard` before any subscriber
 * has run — the positive cases would be red against correct code, and the negative cases would
 * pass vacuously, which is worse: the mutations below could not discriminate at all.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import {
	createAssetLibraryChangeSource,
	type AssetLibraryChange,
} from '../../../src/application/events/assetLibraryChangeSource';
import {
	geometrySidecarChanged,
	projectIndexEntryChanged,
	projectIndexExclusionChanged,
	projectIndexRebuilt,
} from '../../../src/application/events/projectIndex.events';
import {
	assetCreated,
	assetDeleted,
	assetDesignChanged,
	assetUpdated,
} from '../../../src/domain/asset/Asset.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { assetPriceOverrideChanged } from '../../../src/domain/asset-price/AssetPriceOverride.events';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { EntityId } from '../../../src/core/identity/EntityId';

const THE_ASSET = createAssetId();

function wired() {
	const bus = createEventBus(() => undefined);
	const heard: AssetLibraryChange[] = [];
	const dispose = createAssetLibraryChangeSource(bus)((change) => heard.push(change));
	return { bus, heard, dispose };
}

describe('createAssetLibraryChangeSource', () => {
	it.each([
		['AssetCreated', () => assetCreated({ assetId: THE_ASSET })],
		['AssetUpdated', () => assetUpdated({ assetId: THE_ASSET })],
	])('refreshes only the catalogue on %s, because neither touches geometry', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

		expect(heard).toEqual([{ catalogue: true, marks: [], design: [], usage: [], replaced: [] }]);
	});

	it('restarts BOTH selection reads when an entry is deleted, and invalidates its mark', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetDeleted({ assetId: THE_ASSET }));

		expect(heard).toEqual([{ catalogue: true, marks: [THE_ASSET], design: [], usage: [], replaced: [THE_ASSET] }]);
	});

	it('refreshes the catalogue on a design change, not only the mark', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));

		expect(heard).toEqual([{ catalogue: true, marks: [THE_ASSET], design: [THE_ASSET], usage: [], replaced: [] }]);
	});

	it('invalidates the design read on a design change, and never the usage read', async () => {
		// The vault-wide ListRequirementsReferencing scan must not re-run for a footprint edit.
		const { bus, heard } = wired();

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));

		expect(heard).toHaveLength(1);
		expect(heard[0]?.replaced).toEqual([]);
	});

	it('invalidates the mark and the design read on this asset’s own sidecar change, without refreshing the catalogue', async () => {
		const { bus, heard } = wired();

		await bus.publish(geometrySidecarChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' }));

		expect(heard).toEqual([{ catalogue: false, marks: [THE_ASSET], design: [THE_ASSET], usage: [], replaced: [] }]);
	});

	it('ignores a PLAN sidecar, which raises the same event an asset sidecar does', async () => {
		const { bus, heard } = wired();

		await bus.publish(geometrySidecarChanged({ entityId: 'plan-01' as EntityId<string>, entityType: 'renovation-plan' }));

		expect(heard).toEqual([]);
	});

	it('restarts BOTH selection reads on this asset’s own index entry change, and invalidates its mark', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexEntryChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' }));

		expect(heard).toEqual([{ catalogue: true, marks: [THE_ASSET], design: [], usage: [], replaced: [THE_ASSET] }]);
	});

	/**
	 * §11 item 6's mark, kept honest. A price override set or cleared in ANOTHER leaf changes
	 * which *Used in* rows a default-price edit will not reach — and changes no note this
	 * catalogue lists, no geometry and no design — so this is the one event that moves the
	 * usage read alone.
	 *
	 * Driven on the EVENT rather than by constructing a change object: a case that builds the
	 * payload itself proves the type compiles, not that anything subscribes, and this arm was
	 * missing entirely for a round with every other case green.
	 *
	 * The other four channels are asserted quiet, and each is a real claim. `replaced` would
	 * re-read `GetAssetDesign` — the asset's whole sidecar — for a number in a different note;
	 * `design` invalidates the read that did not change; `catalogue` re-reads every asset note
	 * in the vault for a per-project figure this surface never prints (§3.5).
	 */
	it("restarts the usage read alone when a project's price override for this asset moves", async () => {
		const { bus, heard } = wired();

		await bus.publish(
			assetPriceOverrideChanged({ projectId: 'project-01' as ProjectId, assetId: THE_ASSET }),
		);

		expect(heard).toEqual([
			{ catalogue: false, marks: [], design: [], usage: [THE_ASSET], replaced: [] },
		]);
	});

	it('ignores a zone note arriving through the index', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexEntryChanged({ entityId: 'zone-1' as EntityId<string>, entityType: 'renovation-zone' }));

		expect(heard).toEqual([]);
	});

	it('refreshes only the catalogue on a full rebuild', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual([{ catalogue: true, marks: [], design: [], usage: [], replaced: [] }]);
	});

	it('refreshes only the catalogue when an asset note becomes excluded', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexExclusionChanged({ path: 'Renovation/Library/broken.md', entityType: 'renovation-asset' }));

		expect(heard).toEqual([{ catalogue: true, marks: [], design: [], usage: [], replaced: [] }]);
	});

	it('ignores an exclusion change for a note of another kind', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexExclusionChanged({ path: 'Renovation/Kitchen/Zones/broken.md', entityType: 'renovation-zone' }));

		expect(heard).toEqual([]);
	});

	/**
	 * An event on ANY payload-reading list, arriving WITHOUT that payload, is simply never
	 * delivered — rather than comparing `undefined` against an asset id or an entity type and
	 * matching whichever listener also has none. `assetDesignChangeSource.assetIdOf`'s rule.
	 */
	it.each([
		['a deletion', { type: 'AssetDeleted' as const }],
		['a design change', { type: 'AssetDesignChanged' as const }],
		['a sidecar change', { type: 'GeometrySidecarChanged' as const }],
		['an index entry change', { type: 'ProjectIndexEntryChanged' as const }],
		['an exclusion change', { type: 'ProjectIndexExclusionChanged' as const }],
		['a price override change', { type: 'AssetPriceOverrideChanged' as const }],
	])('ignores %s that carries no payload at all', async (_name, event) => {
		const { bus, heard } = wired();

		await bus.publish(event);

		expect(heard).toEqual([]);
	});

	/**
	 * The disposer releases EVERY arm, not the one a case happened to drive — the leak
	 * `assetDesignChangeSource`'s own disposal test guards against, one layer down.
	 */
	it.each([
		['a create', () => assetCreated({ assetId: THE_ASSET })],
		['an update', () => assetUpdated({ assetId: THE_ASSET })],
		['a deletion', () => assetDeleted({ assetId: THE_ASSET })],
		['a design change', () => assetDesignChanged({ assetId: THE_ASSET })],
		['a sidecar change', () => geometrySidecarChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' })],
		['an entry change', () => projectIndexEntryChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' })],
		['a rebuild', () => projectIndexRebuilt()],
		[
			'an exclusion change',
			() => projectIndexExclusionChanged({ path: 'Renovation/Library/broken.md', entityType: 'renovation-asset' }),
		],
		[
			'a price override change',
			() => assetPriceOverrideChanged({ projectId: 'project-01' as ProjectId, assetId: THE_ASSET }),
		],
	])('stops delivering %s once disposed', async (_name, make) => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(make());

		expect(heard).toEqual([]);
	});
});
