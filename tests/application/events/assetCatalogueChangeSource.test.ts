/**
 * The asset picker's own subscription: "the vault's catalogue may have changed."
 *
 * A THIRD source beside `createPlanChangeSource` and `createProjectListChangeSource`, for the
 * reason the second one gives for existing at all: an Asset belongs to no project since design
 * slice 19 and to no plan ever, so there is no id to bind and the unfiltered category is the
 * whole of what this caller wants.
 *
 * It exists because the picker was borrowing `onPlanChanged`, which is right for exactly one
 * of the six events that door carries — `ProjectIndexRebuilt`, without which a leaf restored
 * before `onLayoutReady` reads an empty index and offers an empty picker for the session — and
 * wasteful for the other five: a zone gesture re-read every asset note in the vault.
 */
import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/core/events/EventBus';
import { createAssetCatalogueChangeSource } from '../../../src/application/events/assetCatalogueChangeSource';
import { projectIndexEntryChanged, projectIndexRebuilt } from '../../../src/application/events/projectIndex.events';
import { assetCreated, assetDeleted, assetUpdated } from '../../../src/domain/asset/Asset.events';
import { zoneGeometryChanged } from '../../../src/domain/zone/Zone.events';
import { planBackgroundChanged } from '../../../src/domain/plan/Plan.events';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import type { EntityId } from '../../../src/core/identity/EntityId';

function wired() {
	const bus = createEventBus(() => undefined);
	const heard: string[] = [];
	const dispose = createAssetCatalogueChangeSource(bus)(() => heard.push('heard'));
	return { bus, heard, dispose };
}

const anAsset = createAssetId();
const aPlan = createPlanId();
const aProject = createProjectId();
const zonePayload = { zoneId: createZoneId(), planId: aPlan, projectId: aProject };

describe('createAssetCatalogueChangeSource', () => {
	it.each([
		['AssetCreated', () => assetCreated({ assetId: anAsset })],
		['AssetUpdated', () => assetUpdated({ assetId: anAsset })],
		['AssetDeleted', () => assetDeleted({ assetId: anAsset })],
	])('delivers %s, because each changes what the catalogue holds', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

		expect(heard).toEqual(['heard']);
	});

	/**
	 * The one event the picker was already getting right through `onPlanChanged`, and the
	 * reason that borrowing could not simply be deleted: leaves are restored BEFORE
	 * `onLayoutReady`, so the read at mount lands against a still-empty index.
	 */
	it('delivers ProjectIndexRebuilt, so a restored leaf recovers from an empty index', async () => {
		const { bus, heard } = wired();

		await bus.publish(projectIndexRebuilt());

		expect(heard).toEqual(['heard']);
	});

	/**
	 * The whole point of the third source. These two reach `onPlanChanged` and say nothing
	 * about the catalogue; under the old borrowing each one re-read every asset note in the
	 * vault.
	 */
	it.each([
		['ZoneGeometryChanged', () => zoneGeometryChanged(zonePayload)],
		['PlanBackgroundChanged', () => planBackgroundChanged({ planId: aPlan, projectId: aProject })],
	])('ignores %s, which says nothing about the catalogue', async (_name, make) => {
		const { bus, heard } = wired();

		await bus.publish(make());

		expect(heard).toEqual([]);
	});

	/**
	 * An asset note added by hand, copied in, or arriving through sync reaches the index
	 * through `VaultChangeAdapter` and publishes no domain event of its own — the same gap
	 * `projectListChangeSource` closes for projects, with the same filter, for the same
	 * reason: unfiltered, a burst of synced zone notes would re-read the whole catalogue once
	 * per note.
	 */
	it('delivers an index entry change for an asset and ignores one for any other type', async () => {
		const { bus, heard } = wired();

		await bus.publish(
			projectIndexEntryChanged({ entityId: 'z1' as EntityId<string>, entityType: 'renovation-zone' }),
		);
		expect(heard).toEqual([]);

		await bus.publish(
			projectIndexEntryChanged({ entityId: 'a1' as EntityId<string>, entityType: 'renovation-asset' }),
		);
		expect(heard).toEqual(['heard']);
	});

	it('stops delivering once disposed', async () => {
		const { bus, heard, dispose } = wired();

		dispose();
		await bus.publish(assetCreated({ assetId: anAsset }));

		expect(heard).toEqual([]);
	});
});
