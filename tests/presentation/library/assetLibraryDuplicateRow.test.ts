/**
 * @vitest-environment jsdom
 *
 * AD18 Task 8, take.md step 9's D clause: the case's own pass condition for Duplicate is "a note
 * named `Oven (copy)` appears in the library folder..., a row for it joins the shelves, the panel
 * closes, and the inspector is still showing `Oven`". `assetHandoff.e2e.ts` pins the note and the
 * selection staying put; `assetUsageDuplicate.test.ts`'s *closes on success, leaving the selection
 * where it was* pins the panel closing. Nothing pins the ROW — `assetLibraryRootDoors.test.ts`'s
 * *re-reads the catalogue on a catalogue change, and unsubscribes on unmount* only counts calls to
 * `listCatalogue`, never reading the DOM the re-read is supposed to produce.
 *
 * Driven through the real change subscription `AssetLibraryRoot` registers, at the same
 * `{ catalogue: true, ... }` shape `assetLibraryChangeSource.ts`'s `AssetCreated`/`AssetUpdated`
 * arm actually raises — which is what a successful `DuplicateAsset` publishes — rather than by
 * asserting a row appears in a bare mount, since the point of the clause is that the row appears
 * FROM THE EVENT, not merely that the component can draw two rows if handed two entries.
 */
import { describe, expect, it } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import type { Result } from '../../../src/core/result/Result';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { AssetLibraryChange } from '../../../src/application/events/assetLibraryChangeSource';
import type { CatalogueListing } from '../../../src/application/queries/ListCatalogueEntries';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, mountRoot } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

describe('the Duplicate action, once it lands (take.md step 9)', () => {
	it('adds the copy\'s row to the shelves once the catalogue change is announced', async () => {
		const original = anEntry({ name: 'Oven' });
		const copy = anEntry({ name: 'Oven (copy)' });
		let listing: CatalogueListing = { entries: [original], unreadable: [] };
		let announce!: (change: AssetLibraryChange) => void;
		const root = await mountRoot({
			queries: {
				...unavailableAssetLibraryQueries(),
				listCatalogue: (): Promise<Result<CatalogueListing, RepositoryError>> =>
					Promise.resolve(ok(listing)),
			},
			onLibraryChanged: (listener) => {
				announce = listener;
				return () => undefined;
			},
		});

		expect(root.findAll('[data-asset-id]').map((row) => row.attributes('data-asset-id'))).toEqual([
			original.assetId,
		]);
		expect(root.text()).not.toContain('Oven (copy)');

		// The real shape `DuplicateAsset` publishes through `AssetCreated`: only the catalogue
		// arm is set, exactly as `assetLibraryChangeSource.ts`'s own subscription for that event
		// does.
		listing = { entries: [original, copy], unreadable: [] };
		announce({ catalogue: true, marks: [], design: [], usage: [], replaced: [] });
		await settle();

		expect(
			root
				.findAll('[data-asset-id]')
				.map((row) => row.attributes('data-asset-id'))
				.toSorted(),
		).toEqual([original.assetId, copy.assetId].toSorted());
		expect(root.text()).toContain('Oven (copy)');
	});
});
