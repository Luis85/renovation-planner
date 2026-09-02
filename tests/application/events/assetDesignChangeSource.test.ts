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
import {
	geometrySidecarChanged,
	projectIndexEntryChanged,
	projectIndexRebuilt,
} from '../../../src/application/events/projectIndex.events';
import { assetDeleted, assetDesignChanged, assetUpdated } from '../../../src/domain/asset/Asset.events';
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
	 * **This case used to assert the OPPOSITE, and it was a green test pinning a defect.** Its
	 * argument was that `AssetUpdated` is the catalogue's event — a rename or a price edit — and
	 * that the designer draws neither, so delivering it would make this source a second
	 * catalogue subscription wearing the design's name.
	 *
	 * Both halves were wrong. `AssetDesignDto` carries `name`, so a rename IS something this
	 * leaf draws; and the reasoning was about what the event is CALLED rather than about what
	 * the leaf has to re-read. The rule is "this leaf's subject moved", and a rename moves it.
	 *
	 * It is not a second catalogue subscription either, because it is filtered to ONE asset —
	 * the picker's source is the unfiltered one, and that difference is the whole reason two
	 * sources exist.
	 */
	it('delivers AssetUpdated, because a rename is something this leaf draws', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetUpdated({ assetId: THE_ASSET }));

		expect(heard).toHaveLength(1);
	});

	/**
	 * **The half that outlives a stale name: an asset deleted under an open designer.**
	 *
	 * Nothing else reaches this leaf for it. `DeleteAssetCommand` removes the index entry
	 * before the vault event that follows, and `VaultChangeAdapter`'s echo check then declines
	 * to announce this plugin's own write — correctly — so no `ProjectIndexEntryChanged`
	 * arrives to compensate. Without this arm the designer goes on drawing an asset the vault
	 * no longer has, and every write it dispatches refuses with nothing on screen saying why.
	 *
	 * It is the trigger half of a pair: `AssetDesignStore.hydrate` blanks on an AUTHORITATIVE
	 * `asset.not-found` rather than keeping the previous design, and that rule can only fire
	 * for a re-read something asked for.
	 */
	it('delivers AssetDeleted, so a designer stops drawing an asset that is gone', async () => {
		const { bus, heard } = wired();

		await bus.publish(assetDeleted({ assetId: THE_ASSET }));

		expect(heard).toHaveLength(1);
	});

	/** Both lifecycle arms take the SAME id filter as the design one, not a looser one. */
	it.each([
		['an update', () => assetUpdated({ assetId: ANOTHER_ASSET })],
		['a deletion', () => assetDeleted({ assetId: ANOTHER_ASSET })],
	])('ignores %s of a different asset', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

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
	 * **The asset's own geometry SIDECAR, edited or deleted out of band.** The design a
	 * designer draws lives in that file rather than in the note, so this is the one arm that
	 * covers a synced or hand-edited SHAPE — and no other arm can: the sidecar carries no index
	 * entry (ADR-0014 derives its home), so `ProjectIndexEntryChanged` is never raised for it,
	 * and the pipeline publishes no domain event of its own.
	 */
	it('delivers a sidecar change for this asset, which no other arm covers', async () => {
		const { bus, heard } = wired();

		await bus.publish(geometrySidecarChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' }));

		expect(heard).toEqual(['heard']);
	});

	/**
	 * BOTH halves of that filter again, for the reason the entry arm's pair gives: a plan's
	 * `.rpgeo` and an asset's are the same file type under two owners, so the TYPE is what
	 * keeps a plan's geometry landing on a plan id out of every designer.
	 */
	it.each([
		['another asset', ANOTHER_ASSET as EntityId<string>, 'renovation-asset' as const],
		['a note of another kind carrying this id', THE_ASSET as EntityId<string>, 'renovation-plan' as const],
	])('ignores a sidecar change for %s', async (_name, entityId, entityType) => {
		const { bus, heard } = wired();

		await bus.publish(geometrySidecarChanged({ entityId, entityType }));

		expect(heard).toEqual([]);
	});

	/**
	 * An event on ANY payload-reading list, arriving WITHOUT that payload, is simply never
	 * delivered — rather than comparing `undefined` against an asset id and matching whichever
	 * leaf also has none. `planChangeSource.planIdOf`'s rule, and the reason all three guards
	 * narrow rather than cast. The rebuild arm is deliberately not in this list: it carries no
	 * payload BY DESIGN and reaching every leaf is what it is for.
	 */
	it.each([
		['a design change', { type: 'AssetDesignChanged' as const }],
		['an index entry change', { type: 'ProjectIndexEntryChanged' as const }],
		['a sidecar change', { type: 'GeometrySidecarChanged' as const }],
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
		['a deletion', () => assetDeleted({ assetId: THE_ASSET })],
		['a rebuild', () => projectIndexRebuilt()],
		['an entry change', () => projectIndexEntryChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' })],
		['a sidecar change', () => geometrySidecarChanged({ entityId: THE_ASSET, entityType: 'renovation-asset' })],
	])('stops delivering %s once disposed', async (_name, make) => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(make());

		expect(heard).toEqual([]);
	});
});
