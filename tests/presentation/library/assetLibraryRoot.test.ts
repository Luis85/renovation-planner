/**
 * @vitest-environment jsdom
 *
 * The Asset library's root (design "Asset library overview" §3, §3.1, §3.6, §4, §6.1): the
 * toolbar, the shelves container, search, the status bar and every one of §4's states.
 *
 * Mounted BARE through `@vue/test-utils`' own `mount`, the same shape `viewRoot.test.ts` uses
 * for its sibling — a Pinia plugin and a provided context, never the whole `AssetLibraryView`
 * lifecycle, which `assetLibraryView.test.ts` already owns.
 *
 * `.rp-al-shelf`/`.rp-al-row`/`.rp-al-shelf__head` are the classes `AssetShelf.vue`/
 * `AssetRow.vue` actually ship (Task 12), not the `.rp-asset-shelf` spelling an earlier plan
 * draft used in prose — CLAUDE.md's own rule for this exact situation ("Where this text and
 * the shipped file disagree, the shipped file wins") applied to a second file.
 */
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import type { Result } from '../../../src/core/result/Result';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { CatalogueListing } from '../../../src/application/queries/ListCatalogueEntries';
import { createAssetId, type AssetId } from '../../../src/domain/asset/AssetId';
import { unavailableAssetLibraryQueries } from '../../../src/presentation/read-models/assetLibraryQueries';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { tr } from '../../../src/presentation/i18n/strings';
import { ASSET_CATEGORIES } from '../../../src/domain/asset/AssetCategory';
import { ASSET_CATEGORY_LABELS } from '../../../src/presentation/views/assetLabels';
import { installObsidianDom } from '../../helpers/dom';
import { settle } from '../../helpers/async';
import { aNoIdNote, anEntry, definite, mountRoot } from '../../helpers/assetLibraryRootHarness';

installObsidianDom();

/**
 * The REAL code `MigrationRunner.migrateToLatest` raises for a note written by a newer build
 * — derived from the actual class rather than typed as a literal in this file, per the brief's
 * own instruction: a hand-typed string here could silently drift from what production raises
 * (or simply be wrong from the start) while still agreeing with an equally hand-typed literal
 * in `AssetLibraryRoot.vue`, which is exactly the failure mode this derivation avoids. `asset`
 * is the kind `migrationSet.ts` registers this catalogue's schema under.
 */
function realFutureSchemaCode(): string {
	const runner = new MigrationRunner();
	runner.registerAll('asset', []);
	try {
		runner.migrateToLatest('asset', {}, 2);
	} catch (error) {
		return (error as { code: string }).code;
	}
	throw new Error('expected migrateToLatest to refuse a future schema version');
}

describe('AssetLibraryRoot', () => {
	it('draws the shelves beside the unreadable strip, never instead of them', async () => {
		const root = await mountRoot({ entries: [anEntry()], unreadable: [aNoIdNote()] });

		expect(root.find('.rp-view-notice').exists()).toBe(true);
		expect(root.find('.rp-al-shelf').exists()).toBe(true);
	});

	it('offers Open note per row, and withholds it for a future-schema refusal', async () => {
		const root = await mountRoot({
			unreadable: [
				{ assetId: 'a' as AssetId, path: 'x.md', reason: 'read-failed', code: realFutureSchemaCode() },
				aNoIdNote({ path: 'y.md' }),
			],
		});

		const rows = root.findAll('.rp-view-notice li');
		expect(rows).toHaveLength(2);
		expect(definite(rows[0]).find('button').exists()).toBe(false);
		expect(definite(rows[1]).find('button').exists()).toBe(true);
	});

	/**
	 * §4's own rule: an empty answer before the index has been scanned is not an empty vault.
	 * `indexScanCompleted: () => false` is exactly the pre-`onLayoutReady` restore §4 describes
	 * — `AssetLibraryStore.hydrate` drops that answer and holds `'loading'` rather than
	 * publishing it as `'ready'`, so `noAssets` must never be reachable from it.
	 */
	it('never draws the no-assets invitation before the index scan has run', async () => {
		const root = await mountRoot({ entries: [], unreadable: [], indexScanCompleted: () => false });

		expect(root.find('.rp-empty-state').exists()).toBe(false);
	});

	it('announces the match count in a live region', async () => {
		const root = await mountRoot({
			entries: [anEntry({ name: 'Oak plank floor' }), anEntry({ assetId: createAssetId(), name: 'Wall paint' })],
		});

		await root.get('.rp-al-search__input').setValue('Oak');
		await settle();

		const status = root.get('[role="status"].rp-al-results');
		expect(status.text()).toBe(tr('view.asset-library.search.results', { count: '1' }));
	});

	it('restores the prior expansion state when the search is cleared', async () => {
		const material = anEntry({ category: 'material', name: 'Oak plank floor' });
		const furniture = anEntry({ assetId: createAssetId(), category: 'furniture', name: 'Sofa' });
		const root = await mountRoot({ entries: [material, furniture] });

		const shelfHeaders = () => root.findAll('.rp-al-shelf__head');
		expect(shelfHeaders()).toHaveLength(2);
		await definite(shelfHeaders()[0]).trigger('click');
		await settle();
		expect(definite(shelfHeaders()[0]).attributes('aria-expanded')).toBe('true');

		// A search matching NOTHING is the case that actually exercises the claim: `emptyStateKey`
		// answers `noMatches`, `AssetShelves` is replaced by `EmptyState` and UNMOUNTS entirely —
		// a search that merely narrows the shelves (e.g. one still matching a row) would leave
		// `AssetShelves` mounted throughout and could not tell this component's own state from
		// state `AssetShelves.vue` held locally.
		await root.get('.rp-al-search__input').setValue('zzz-no-match');
		await settle();
		expect(root.find('.rp-al-shelf__head').exists()).toBe(false);
		expect(root.find('.rp-empty-state').exists()).toBe(true);

		await root.get('.rp-al-search__input').setValue('');
		await settle();
		expect(definite(shelfHeaders()[0]).attributes('aria-expanded')).toBe('true');
	});

	it('matches on name, supplier and SKU, and never on notes', async () => {
		const target = anEntry({
			name: 'Oak plank floor',
			supplier: 'Holzhandel Nord',
			sku: 'EIC-1200-190',
			notes: 'a rare word xyz123',
		});
		const other = anEntry({ assetId: createAssetId(), name: 'Wall paint', supplier: null, sku: null, notes: null });
		const root = await mountRoot({ entries: [target, other] });

		await root.get('.rp-al-search__input').setValue('xyz123');
		await settle();
		expect(root.findAll('.rp-al-row')).toHaveLength(0);
		expect(root.find('.rp-empty-state').exists()).toBe(true);

		await root.get('.rp-al-search__input').setValue('Holzhandel');
		await settle();
		expect(root.findAll('.rp-al-row')).toHaveLength(1);

		await root.get('.rp-al-search__input').setValue('EIC-1200');
		await settle();
		expect(root.findAll('.rp-al-row')).toHaveLength(1);
	});
});

/**
 * The strip's remaining two sentences and its repair action.
 *
 * `reasonLabel` is a four-way answer and the two cases above reach two of its arms; a build
 * that folded `duplicate-id` into the generic `read-failed` sentence — or into `no-id`, whose
 * arm sits directly above it — draws a strip that looks right and tells the user to fix the
 * wrong thing.
 */
/**
 * §3.2's shelf DERIVATION, which is `AssetShelves.vue`'s own and which nothing before this
 * task built: EVERY category the build declares, in `ASSET_CATEGORIES`' own order, INCLUDING
 * the ones holding nothing — an empty shelf is what tells a user the category exists and that
 * the thing they are about to define has a home. Asserted against the whole list rather than
 * against a member of it: a build that drew only the categories with rows, or drew them in the
 * order the entries happened to arrive in, passes every other case in this file.
 *
 * The SECOND group §3.2 describes — a category the listing names that the build does not — is
 * deliberately unasserted, because nothing in this tree can produce one: `kebabEnum` answers
 * `z.NEVER` and `Asset.create` refuses independently, so such a note is skipped by `listAll()`
 * and lands in the repair strip instead. A case seeding one past the type would pass for the
 * wrong reason and certify a gap that is not closed; see this task's report.
 */
describe('AssetLibraryRoot, the shelf list', () => {
	it('draws every declared category in the build order, empty ones included', async () => {
		const root = await mountRoot({ entries: [anEntry({ category: 'material' })] });

		expect(root.findAll('.rp-al-shelf__name').map((name) => name.text())).toEqual(
			ASSET_CATEGORIES.map((category) => tr(ASSET_CATEGORY_LABELS[category])),
		);
	});

	/** §6.1: a search collapses every shelf into ONE flat result list, and that heading is not
	 *  a disclosure control — there is nothing left to collapse it into. */
	it('collapses the shelves into one non-collapsible Results shelf while searching', async () => {
		const root = await mountRoot({ entries: [anEntry({ name: 'Oak plank floor' })] });

		await root.get('.rp-al-search__input').setValue('Oak');
		await settle();

		expect(root.findAll('.rp-al-shelf')).toHaveLength(1);
		expect(root.get('.rp-al-shelf__name').text()).toBe(tr('view.asset-library.results'));
		expect(root.find('.rp-al-shelf__head').exists()).toBe(false);
	});
});

describe('AssetLibraryRoot, the repair strip', () => {
	it('names each reason with its own sentence', async () => {
		const root = await mountRoot({
			unreadable: [
				aNoIdNote({ path: 'a.md', reason: 'duplicate-id' }),
				{ assetId: 'b' as AssetId, path: 'b.md', reason: 'read-failed', code: 'asset.read-failed' },
				aNoIdNote({ path: 'c.md' }),
			],
		});

		expect(root.findAll('.rp-view-notice__reason').map((reason) => reason.text())).toEqual([
			tr('view.asset-library.unreadable.duplicate-id'),
			tr('view.asset-library.unreadable.read-failed'),
			tr('view.asset-library.unreadable.no-id'),
		]);
		// A `read-failed` that is NOT the future-schema code still offers the action: the
		// carve-out is exact rather than reason-wide, and a guard narrowed to `reason` alone
		// would withhold `Open note` from a note this build really could open.
		expect(root.findAll('.rp-view-notice li button')).toHaveLength(3);
	});

	/**
	 * The two arms of `onOpenNoteRow`, asserted on the READ COUNT rather than on the DOM: both
	 * arms draw the identical strip, so nothing rendered can tell them apart. `'missing'` means
	 * the listing this row came from is stale, and re-reading is the whole point of the action
	 * in that case; `'opened'` re-reading would be a second answer to what refreshes this list.
	 */
	it('re-reads the listing only when the note the row named is gone', async () => {
		const unreadable = [aNoIdNote({ path: 'gone.md' })];

		const opened = vi.fn<() => Promise<'opened'>>(() => Promise.resolve('opened'));
		const openedReads = vi.fn<() => Promise<Result<CatalogueListing, RepositoryError>>>(() =>
			Promise.resolve(ok({ entries: [], unreadable })),
		);
		const stable = await mountRoot({
			queries: { ...unavailableAssetLibraryQueries(), listCatalogue: openedReads },
			openNote: opened,
		});
		await stable.get('.rp-view-notice li button').trigger('click');
		await settle();
		expect(opened).toHaveBeenCalledWith('gone.md');
		expect(openedReads).toHaveBeenCalledTimes(1);

		const missing = vi.fn<() => Promise<'missing'>>(() => Promise.resolve('missing'));
		const missingReads = vi.fn<() => Promise<Result<CatalogueListing, RepositoryError>>>(() =>
			Promise.resolve(ok({ entries: [], unreadable })),
		);
		const stale = await mountRoot({
			queries: { ...unavailableAssetLibraryQueries(), listCatalogue: missingReads },
			openNote: missing,
		});
		await stale.get('.rp-view-notice li button').trigger('click');
		await settle();
		expect(missingReads).toHaveBeenCalledTimes(2);
	});
});

/**
 * §3.2's disclosure and §3.5's selection, both of which are the ROOT's state rather than
 * `AssetShelves`'s — see that component's own header for why.
 */
describe('AssetLibraryRoot, shelves and selection', () => {
	it('collapses a shelf it has already expanded', async () => {
		const root = await mountRoot({ entries: [anEntry({ category: 'material' })] });
		const head = () => root.get('.rp-al-shelf__head');

		await head().trigger('click');
		await settle();
		expect(head().attributes('aria-expanded')).toBe('true');

		await head().trigger('click');
		await settle();
		expect(head().attributes('aria-expanded')).toBe('false');
	});

	/**
	 * Seeded from `context.expanded` ONCE, at setup — a leaf reopened on a saved expansion has
	 * to show it on the first paint rather than after the user touches something. Asserted
	 * against a shelf that is NOT expanded in the same render, so a build that expanded
	 * everything passes neither half.
	 */
	it('opens the shelves the restored view state named', async () => {
		const root = await mountRoot({
			entries: [anEntry({ category: 'material' }), anEntry({ assetId: createAssetId(), category: 'furniture' })],
			expanded: ['material'],
		});

		const open = root
			.findAll('.rp-al-shelf__head')
			.map((head) => head.attributes('aria-expanded'));
		expect(open).toEqual(['true', 'false']);
	});

	it('marks the row a click selected, on a category shelf', async () => {
		const root = await mountRoot({ entries: [anEntry({ category: 'material' })] });
		await root.get('.rp-al-shelf__head').trigger('click');
		await settle();

		await root.get('.rp-al-row').trigger('click');
		await settle();

		expect(root.find('.rp-al-row--on').exists()).toBe(true);
	});

	/**
	 * The flattened Results shelf is a SECOND `<AssetShelf>` in `AssetShelves.vue`'s template,
	 * with its own `@select` binding — a build that wired the category branch and forgot this
	 * one draws a result list whose rows cannot be selected at all, and every case above still
	 * passes.
	 */
	it('marks the row a click selected, in the flattened search results', async () => {
		const root = await mountRoot({
			entries: [anEntry({ name: 'Oak plank floor' }), anEntry({ assetId: createAssetId(), name: 'Wall paint' })],
		});

		await root.get('.rp-al-search__input').setValue('Oak');
		await settle();
		expect(root.findAll('.rp-al-row')).toHaveLength(1);

		await root.get('.rp-al-row').trigger('click');
		await settle();

		expect(root.find('.rp-al-row--on').exists()).toBe(true);
	});

	/** §6.1's escape hatch out of a search, from the field itself. */
	it('clears the search field on Escape', async () => {
		const root = await mountRoot({ entries: [anEntry({ name: 'Oak plank floor' })] });
		const field = () => root.get('.rp-al-search__input');

		await field().setValue('Oak');
		await settle();
		expect(root.find('.rp-al-results').exists()).toBe(true);

		await field().trigger('keydown', { key: 'Escape' });
		await settle();

		expect((field().element as HTMLInputElement).value).toBe('');
		expect(root.find('.rp-al-results').exists()).toBe(false);
	});
});
