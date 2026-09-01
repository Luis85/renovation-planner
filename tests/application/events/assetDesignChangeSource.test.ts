/**
 * The asset designer's own subscription: "the design of THIS asset may have changed."
 *
 * A FOURTH source beside the plan, project-list and catalogue ones, and it takes an id like
 * `createPlanChangeSource` does rather than being unfiltered like the catalogue's: every
 * design command in this increment publishes `AssetDesignChanged`, so an unfiltered listener
 * would re-read one asset's design because a different asset was edited.
 *
 * **One event, not a list of them.** `SetAssetHeight` changes a field the designer draws and
 * touches no geometry, and it publishes the same `AssetDesignChanged` the five shape commands
 * do. A source keyed on shape events alone would leave a peer leaf's height stale, and a
 * per-field list is a rule stated as a list: it goes stale the day a ninth command is added,
 * silently and in the direction of a stale surface.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createAssetDesignChangeSource } from '../../../src/application/events/assetDesignChangeSource';
import { projectIndexEntryChanged, projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { assetDesignChanged, assetUpdated } from '../../../src/domain/asset/Asset.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import type { EntityId } from '../../../src/core/identity/EntityId';

const THE_ASSET = createAssetId();
const ANOTHER_ASSET = createAssetId();

function wired(assetId: string = THE_ASSET) {
	const bus = createEventBus(() => undefined);
	const heard: string[] = [];
	const dispose = createAssetDesignChangeSource(bus)(assetId, () => heard.push('heard'));
	return { bus, heard, dispose };
}

describe('createAssetDesignChangeSource', () => {
	it('delivers a design change for the asset this leaf is showing', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetDesignChanged({ assetId: THE_ASSET }));

		expect(heard).toEqual(['heard']);
	});

	/**
	 * The filter is what makes ONE event for every design command affordable: a vault full of
	 * assets being edited elsewhere costs an open designer nothing.
	 */
	it('ignores a design change for a different asset', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetDesignChanged({ assetId: ANOTHER_ASSET }));

		expect(heard).toEqual([]);
	});

	/**
	 * `AssetUpdated` is the catalogue's event — a rename or a price edit — and the designer
	 * draws neither. Delivering it would make this source a second catalogue subscription
	 * wearing the design's name.
	 */
	it('ignores AssetUpdated, which says nothing about the design', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetUpdated({ assetId: THE_ASSET }));

		expect(heard).toEqual([]);
	});

	/**
	 * The event a designer leaf restored at startup depends on. Obsidian restores its leaves
	 * BEFORE `onLayoutReady`, and the index scan runs from it — so the mount read asks an
	 * EMPTY index, `GetAssetDesign` answers `asset.not-found`, and without this arm the leaf
	 * sits on its failure screen until the user retries by hand.
	 *
	 * Unfiltered, deliberately: a rebuild carries no payload because it cannot say which
	 * entities changed, so it must reach every leaf. Naming that category is what makes
	 * "applies to every asset" a decision rather than a hole in the guard above.
	 */
	it('delivers ProjectIndexRebuilt, so a leaf restored before the scan recovers', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual(['heard']);
	});

	/**
	 * An asset note added by hand, copied in, or arriving through sync. `VaultChangeAdapter`
	 * is the sole index writer for those and publishes no domain event of its own, so without
	 * this arm a synced height edit reaches the index and no designer.
	 */
	it('delivers an index entry change for this asset', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexEntryChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' }));

		expect(heard).toEqual(['heard']);
	});

	/**
	 * BOTH halves of that filter, because a build testing one of them passes with the other
	 * inverted: an entry event names one entity, and neither its type nor its id alone says
	 * this leaf is about it.
	 */
	it.each([
		['another asset', ANOTHER_ASSET as EntityId<string>, 'renovation-asset' as const],
		['a note of another kind carrying this id', THE_ASSET as EntityId<string>, 'renovation-plan' as const],
	])('ignores an index entry change for %s', async (_name, entityId, entityType) => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexEntryChanged({ entityId, entityType }));

		expect(heard).toEqual([]);
	});

	/**
	 * An event on either list WITHOUT the payload its filter reads is simply never delivered,
	 * rather than comparing `undefined` against an asset id and matching whichever leaf also has
	 * none — `planChangeSource.planIdOf`'s rule, and the reason both guards narrow rather than
	 * cast. The rebuild arm is deliberately not in this list: it carries no payload BY DESIGN
	 * and reaching every leaf is what it is for.
	 */
	it.each([
		['a design change', { type: 'AssetDesignChanged' as const }],
		['an index entry change', { type: 'ProjectIndexEntryChanged' as const }],
	])('ignores %s that carries no payload at all', async (_name, event) => {
		const { bus, heard } = wired();

		await bus.publish(event);

		expect(heard).toEqual([]);
	});

	/**
	 * The disposer releases EVERY arm, not the one a case happened to drive. A source whose
	 * `dispose` unsubscribed its first list only would leave a closed leaf re-reading on every
	 * later rebuild — the leak this increment's disposal test exists for, one layer down.
	 */
	it.each([
		['a design change', () => assetDesignChanged({ assetId: THE_ASSET })],
		['a rebuild', () => projectIndexRebuilt()],
		['an entry change', () => projectIndexEntryChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' })],
	])('stops delivering %s once disposed', async (_name, make) => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(make());

		expect(heard).toEqual([]);
	});
});
