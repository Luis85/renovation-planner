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
import { ref } from 'vue';
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
import type {
	CatalogueEntryDto,
	CatalogueListing,
} from '../../../src/application/queries/ListCatalogueEntries';
import type { AssetLibraryQueryServices } from '../../../src/presentation/read-models/assetLibraryQueries';
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
 * §3.2's order claim, asked of the two surfaces it is about rather than of a list either of them
 * reads: *"in `ASSET_CATEGORY_LABELS`'s order — the same order `NewAssetForm`'s own control
 * renders, so the category a user picked in the form is in the position they picked it from."*
 *
 * This is the one case that can see the two part company. Both read the same Record today, so a
 * case asserting the shelves against a list would agree with the drift; comparing the two
 * RENDERED controls does not. It lives in this file because the form is already mounted here.
 */
describe('AssetLibraryRoot, the shelf order against the form that fills them', () => {
	it('shelves the categories in the order the New asset control offers them', async () => {
		const { commands } = creationCommands();
		const root = await mountRoot({ entries: [anEntry()], commands });
		const shelves = root.findAll('.rp-al-shelf__name').map((name) => name.text());

		await root.get('.rp-al-create').trigger('click');
		await settle();
		const options = root
			.findComponent(NewAssetForm)
			.findAll('[data-field="category"] option')
			.map((option) => option.text());

		expect(options.length).toBeGreaterThan(1);
		expect(shelves).toEqual(options);
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

	/**
	 * Attached, because §12's focus half cannot be faked: `focus()` on a detached element does
	 * nothing at all, so a free-floating mount reports `<body>` for the fixed build and the
	 * broken one alike.
	 */
	it('clears the search from the no-matches state, moves the caret, and opens no dialog', async () => {
		const { commands } = creationCommands();
		const root = await mountRoot({
			entries: [anEntry({ name: 'Oak plank floor' })],
			commands,
			attach: true,
		});

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
		// The gesture REMOVES the control that was pressed, so the caret has nowhere of its own
		// to stay — `<body>` here means the next Tab restarts at the top of the pane, which is
		// what this surface shipped until a review found it.
		//
		// WHERE it lands is asserted as *inside the pane* rather than as one element, because
		// jsdom evaluates no container query: §7's narrow composition is what decides whether
		// `.rp-al-inspector__back` is laid out at all, so pinning it here would pin this
		// environment's answer rather than the rule (`shelfFocus.ts`'s own header records the
		// same blind spot). Both destinations `focusWithin` can choose are in this subtree, and
		// `<body>` — the defect — is not.
		expect(document.activeElement).not.toBe(document.body);
		expect(root.element.contains(document.activeElement)).toBe(true);
		root.unmount();
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

		// A channel the CATALOGUE listing holds no state for costs a listing read nothing — the
		// store's own arm decides, which is why the subscription hands the whole change over
		// rather than re-reading. This says nothing about whether that channel reaches anybody
		// AT ALL; the category cases below are what ask that, and until the branch's final review
		// the answer for this very channel was no.
		announce({ catalogue: false, marks: [], design: ['a' as AssetId], usage: [], replaced: [] });
		await settle();
		expect(listCatalogue).toHaveBeenCalledTimes(2);

		expect(disposed).toBe(false);
		root.unmount();
		expect(disposed).toBe(true);
	});
});

/**
 * EVERY channel of `AssetLibraryChange` reaches a read — the CATEGORY, asked of the listener the
 * root actually registered rather than of either store's door.
 *
 * This exists because three of the five reached nobody until the branch's final review: it routed
 * the whole change to `AssetLibraryStore` alone, so an `AssetPriceOverrideChanged` did literally
 * nothing (§11 item 6's *Used in* marks never refreshed), a design edit moved a row's mark beside
 * an inspector still printing the pre-edit millimetres, and `replaced` lost what §5.5 calls the
 * load-bearing half of the ticket rule. Every gate was green: a store door with no caller is not
 * a defect a linter or a type has a name for, and the case above passes identically in both
 * worlds.
 *
 * A SIXTH channel cannot slip past this: `CHANNEL_READS` is keyed by `keyof AssetLibraryChange`
 * and `changeWith` builds a complete literal, so adding one to the interface is two compile
 * errors before it is a missing case — which is what makes this a rule rather than a list of the
 * five somebody thought of.
 */
const CHANNEL_READS: Record<keyof AssetLibraryChange, keyof AssetLibraryQueryServices> = {
	catalogue: 'listCatalogue',
	marks: 'listOutlines',
	design: 'getDesign',
	usage: 'listOverridingProjects',
	replaced: 'listReferencing',
};

/** One channel carrying `assetId` and every other one empty — the whole point being that a
 *  build routing four of five passes on the four and fails here on the fifth. */
function changeWith(channel: keyof AssetLibraryChange, assetId: AssetId): AssetLibraryChange {
	const ids = [assetId];
	return {
		catalogue: channel === 'catalogue',
		marks: channel === 'marks' ? ids : [],
		design: channel === 'design' ? ids : [],
		usage: channel === 'usage' ? ids : [],
		replaced: channel === 'replaced' ? ids : [],
	};
}

/**
 * The refusing bundle with a real listing over it, every member spied. The selection reads are
 * left REFUSING deliberately: this asks whether the read was ISSUED, and a refusal is issued
 * exactly as a success is — while a fixture that had to build a valid `AssetDesignDto` would be
 * a second answer to what a design is.
 */
function countingQueries(entries: readonly CatalogueEntryDto[]): AssetLibraryQueryServices {
	const base = unavailableAssetLibraryQueries();
	return {
		...base,
		listCatalogue: vi.fn<AssetLibraryQueryServices['listCatalogue']>(() =>
			Promise.resolve(ok({ entries, unreadable: [] })),
		),
		listOutlines: vi.fn<AssetLibraryQueryServices['listOutlines']>(base.listOutlines),
		getDesign: vi.fn<AssetLibraryQueryServices['getDesign']>(base.getDesign),
		listReferencing: vi.fn<AssetLibraryQueryServices['listReferencing']>(base.listReferencing),
		listOverridingProjects: vi.fn<AssetLibraryQueryServices['listOverridingProjects']>(
			base.listOverridingProjects,
		),
	};
}

describe('AssetLibraryRoot, every change channel', () => {
	let announce!: (change: AssetLibraryChange) => void;


	// `Object.keys` answers `string[]` whatever its argument's key type is — TS's own widening,
	// not a gap in the table: COMPLETENESS is held by `CHANNEL_READS`'s `Record` key type above,
	// which is where a sixth channel is refused.
	const channels = Object.keys(CHANNEL_READS) as (keyof AssetLibraryChange)[];

	it.each(channels)('re-reads for the %s channel', async (channel) => {
		const entry = anEntry();
		const queries = countingQueries([entry]);
		const root = await mountRoot({
			queries,
			// Drawn AND selected: `marks` re-reads only what a shelf is drawing, and the other
			// three arms are about the SELECTED asset. Neither is a property of the change.
			expanded: ref([entry.category]),
			assetId: ref<string>(entry.assetId),
			onLibraryChanged: (listener) => {
				announce = listener;
				return () => undefined;
			},
		});
		const read = vi.mocked(queries[CHANNEL_READS[channel]]);
		const before = read.mock.calls.length;

		announce(changeWith(channel, entry.assetId));
		await settle();

		expect(read.mock.calls.length).toBeGreaterThan(before);
		root.unmount();
	});
});
