/**
 * @vitest-environment jsdom
 *
 * The Asset library root's DOORS — §3.1's `New asset`, §4's two empty-state actions, §4's
 * failure row and the change subscription §5.5 hangs the whole surface's freshness on. Split
 * from `assetLibraryRoot.test.ts` by subject rather than by size: that file is the shelves,
 * the repair strip and search; this one is everything that leaves the surface or brings it
 * back. Both mount through `tests/helpers/assetLibraryRootHarness.ts`, so neither can drift
 * into certifying a different composition from the other.
 *
 * Every case here asserts on what the door REACHED — the composed command, the read count,
 * `openDesigner` — never on the fact a dialog opened. "A dialog opened" is equally true of a
 * caller that wired the wrong command, which is `viewRootCreateAsset.test.ts`'s own recorded
 * lesson for the identical door on the sibling surface.
 */
import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import type { Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { Asset } from '../../../src/domain/asset/Asset';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../../src/application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetLibraryChange } from '../../../src/application/events/assetLibraryChangeSource';
import type { CatalogueListing } from '../../../src/application/queries/ListCatalogueEntries';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { tr } from '../../../src/presentation/i18n/strings';
import { makeAsset } from '../../helpers/entities';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { anEntry, mountRoot } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

const ASSET = makeAsset();

/**
 * Typed with their real INPUTS rather than as `() => …`, for `viewRootCreateAsset.test.ts`'s
 * own recorded reason: the cases below read `mock.calls[0][0]`, and a zero-parameter signature
 * makes that a `TS2493` on an empty tuple — which is `npm run build` type-checking `tests/**`
 * catching a fake declared thinner than the thing it stands for, in the file asserting a
 * wiring.
 */
function creationCommands() {
	const createAsset = vi.fn<(input: CreateAssetInput) => Promise<Result<Asset, AppError>>>(() =>
		Promise.resolve(ok(ASSET)),
	);
	const setAssetFootprintFromDimensions = vi.fn<
		(input: SetAssetFootprintFromDimensionsInput) => Promise<DispatchResult>
	>(() => Promise.resolve(ok('wrote')));
	const openDesigner = vi.fn<(assetId: AssetId) => Promise<void>>(() => Promise.resolve());
	return {
		createAsset,
		setAssetFootprintFromDimensions,
		openDesigner,
		commands: {
			createAsset: { execute: createAsset },
			setAssetFootprintFromDimensions: { execute: setAssetFootprintFromDimensions },
		},
	};
}

/** A listing that refuses, so §4's failure row is what draws. */
function refusingWith(code: string) {
	const listCatalogue = vi.fn<() => Promise<Result<CatalogueListing, RepositoryError>>>(() =>
		Promise.resolve(err({ category: 'Persistence', code, message: 'io' })),
	);
	return { listCatalogue, queries: { ...unavailableAssetLibraryQueries(), listCatalogue } };
}

describe('AssetLibraryRoot, the New asset door', () => {
	it('hands the form the composed commands and opens the designer on what it made', async () => {
		const { commands, createAsset, setAssetFootprintFromDimensions, openDesigner } =
			creationCommands();
		const root = await mountRoot({ entries: [anEntry()], commands, openDesigner });

		await root.get('.rp-al-create').trigger('click');
		await settle();
		const form = root.findComponent(NewAssetForm);
		expect(form.exists()).toBe(true);

		await form.get('[data-field="name"]').setValue('Kitchen island');
		await form.get('[data-field="width"]').setValue('1200');
		await form.get('[data-field="depth"]').setValue('800');
		await form.get('form').trigger('submit');
		await settle();

		expect(createAsset.mock.calls[0][0]).toEqual(
			expect.objectContaining({ name: 'Kitchen island' }),
		);
		// The SECOND door, which a build could wire one of and forget: both prop lambdas are
		// separate arrow functions in the descriptor, and only a submit carrying dimensions
		// reaches this one.
		expect(setAssetFootprintFromDimensions.mock.calls[0][0]).toEqual(
			expect.objectContaining({ assetId: ASSET.id, width: 1200, depth: 800 }),
		);
		expect(openDesigner).toHaveBeenCalledWith(ASSET.id);
	});

	/** The other half: a cancelled dialog made nothing, so there is nothing to open. */
	it('opens no designer when the dialog is cancelled', async () => {
		const { commands, openDesigner } = creationCommands();
		const root = await mountRoot({ entries: [anEntry()], commands, openDesigner });

		await root.get('.rp-al-create').trigger('click');
		await settle();
		await root.get('[data-rp-action="cancel"]').trigger('click');
		await settle();

		expect(openDesigner).not.toHaveBeenCalled();
	});

	/**
	 * `openDialog` THROWS while one is already open, and this button has no disabled state of
	 * its own — so the guard is a `current` check made BEFORE the dialog is opened at all.
	 *
	 * Asserted on the CALL COUNT and never on `dialogs.current`, which is the trap the sibling
	 * suite recorded: `openDialog` throws BEFORE it assigns, so `current` still holds the first
	 * descriptor in both builds and only the count says whether the second click reached it.
	 */
	it('refuses to open a second dialog over the one already up', async () => {
		const { commands } = creationCommands();
		const root = await mountRoot({ entries: [anEntry()], commands });
		const openDialog = vi.spyOn(useDialogStore(), 'openDialog');

		await root.get('.rp-al-create').trigger('click');
		await settle();
		await root.get('.rp-al-create').trigger('click');
		await settle();

		expect(openDialog).toHaveBeenCalledTimes(1);
		expect(root.findComponent(NewAssetForm).exists()).toBe(true);
	});
});

/**
 * §4's two empty states share ONE action handler and mean opposite things by it — a create
 * offered from *no matches* is the wrong gesture, and a *clear the search* offered over an
 * empty vault clears a field the user never filled. A build with the two arms swapped draws
 * both states identically and fails only here.
 */
describe('AssetLibraryRoot, the empty-state actions', () => {
	it('opens the New asset form from the no-assets invitation', async () => {
		const { commands } = creationCommands();
		const root = await mountRoot({ entries: [], commands });

		expect(root.get('.rp-empty-state__headline').text()).toBe(
			tr('empty.asset-library.no-assets.headline'),
		);
		await root.get('.rp-empty-state__action').trigger('click');
		await settle();

		expect(root.findComponent(NewAssetForm).exists()).toBe(true);
	});

	it('clears the search from the no-matches state, and opens no dialog', async () => {
		const { commands } = creationCommands();
		const root = await mountRoot({ entries: [anEntry({ name: 'Oak plank floor' })], commands });

		await root.get('.rp-al-search__input').setValue('zzz-no-match');
		await settle();
		expect(root.get('.rp-empty-state__headline').text()).toBe(
			tr('empty.asset-library.no-matches.headline'),
		);

		await root.get('.rp-empty-state__action').trigger('click');
		await settle();

		expect((root.get('.rp-al-search__input').element as HTMLInputElement).value).toBe('');
		expect(root.find('.rp-al-shelf').exists()).toBe(true);
		expect(root.findComponent(NewAssetForm).exists()).toBe(false);
	});
});

/**
 * §4's failure row, and the one thing that separates its two arms: a read that really tried
 * and failed can be re-run, and a session that composed no query services at all cannot. A
 * single case would pass against a build offering a retry to both — the live control that does
 * nothing slice 14's own amendment refuses.
 */
describe('AssetLibraryRoot, when the catalogue read refused', () => {
	it('names the library failure and re-reads on the retry', async () => {
		const { queries, listCatalogue } = refusingWith('vault.unexpected-failure');
		const root = await mountRoot({ queries });

		expect(root.get('.rp-view-failure__headline').text()).toBe(
			tr('view.asset-library.failed.headline'),
		);
		expect(listCatalogue).toHaveBeenCalledTimes(1);

		await root.get('.rp-view-failure__action').trigger('click');
		await settle();

		expect(listCatalogue).toHaveBeenCalledTimes(2);
	});

	it('withholds the retry from a session that composed no queries', async () => {
		const { queries } = refusingWith('settings.unrecovered');
		const root = await mountRoot({ queries });

		expect(root.get('.rp-view-failure__headline').text()).toBe(
			tr('view.session-failure.headline'),
		);
		expect(root.find('.rp-view-failure__action').exists()).toBe(false);
	});
});

/**
 * §5.5's freshness: the surface re-reads because the bus told it to, not because anything
 * polls. Driven through the listener the root actually registered, and asserted on the read
 * COUNT — a build that subscribed and did nothing with the change renders identically.
 */
describe('AssetLibraryRoot, the change subscription', () => {
	it('re-reads the catalogue on a catalogue change, and unsubscribes on unmount', async () => {
		const listCatalogue = vi.fn<() => Promise<Result<CatalogueListing, RepositoryError>>>(() =>
			Promise.resolve(ok({ entries: [], unreadable: [] })),
		);
		let announce!: (change: AssetLibraryChange) => void;
		let disposed = false;
		const root = await mountRoot({
			queries: { ...unavailableAssetLibraryQueries(), listCatalogue },
			onLibraryChanged: (listener) => {
				announce = listener;
				return () => {
					disposed = true;
				};
			},
		});
		expect(listCatalogue).toHaveBeenCalledTimes(1);

		announce({ catalogue: true, marks: [], design: [], usage: [], replaced: [] });
		await settle();
		expect(listCatalogue).toHaveBeenCalledTimes(2);

		// A change this store holds no state for costs nothing — the store's own arm decides,
		// which is why the subscription hands the whole change over rather than re-reading.
		announce({ catalogue: false, marks: [], design: ['a' as AssetId], usage: [], replaced: [] });
		await settle();
		expect(listCatalogue).toHaveBeenCalledTimes(2);

		expect(disposed).toBe(false);
		root.unmount();
		expect(disposed).toBe(true);
	});
});
