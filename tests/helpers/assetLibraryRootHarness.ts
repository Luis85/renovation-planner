/**
 * Mounts `AssetLibraryRoot.vue` BARE — a Pinia plugin and a provided context, never the whole
 * `AssetLibraryView` lifecycle, which `assetLibraryView.test.ts` already owns.
 *
 * Extracted out of `tests/presentation/library/assetLibraryRoot.test.ts` when that surface's
 * cases split by subject across two files (the shelves and the strip; the doors and the
 * failure state), for the reason `makeAssetLibraryView.ts`'s own header gives about itself: a
 * second suite needing this mount would otherwise hand-roll a second, silently drifting copy —
 * and a mount whose `commands` bundle or `activePinia` handling differs between two files is a
 * pair of suites certifying two different programs.
 *
 * `installObsidianDom()` is deliberately NOT called here: it is a per-file jsdom decision and
 * each suite makes it at its own top level, as every other file in this tree does.
 */
import { createPinia, setActivePinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref, type Ref } from 'vue';
import AssetLibraryRoot from '../../src/presentation/library/AssetLibraryRoot.vue';
import {
	ASSET_LIBRARY_CONTEXT,
	type AssetLibraryContext,
} from '../../src/presentation/library/AssetLibraryContext';
import type {
	AssetLibraryCommandServices,
	AssetLibraryDeps,
} from '../../src/presentation/library/AssetLibraryDeps';
import { ok } from '../../src/core/result/Result';
import { currencyOf } from '../../src/core/money/Money';
import { createAssetId, type AssetId } from '../../src/domain/asset/AssetId';
import type {
	CatalogueEntryDto,
	UnreadableEntry,
} from '../../src/application/queries/ListCatalogueEntries';
import type { AssetLibraryQueryServices } from '../../src/presentation/read-models/assetLibraryQueries';
import { unavailableAssetLibraryQueries } from '../../src/presentation/read-models/assetLibraryQueries';
import { defaultAssetLibraryDeps } from './makeAssetLibraryView';
import { settle } from './async';

/** Never `!`: `.oxlintrc.json` bans the non-null assertion, and this is the alternative every
 *  case addressing a list entry by position needs. */
export function definite<T>(value: T | undefined): T {
	if (value === undefined) throw new Error('expected a defined array element');
	return value;
}

export function anEntry(overrides: Partial<CatalogueEntryDto> = {}): CatalogueEntryDto {
	return {
		assetId: createAssetId(),
		name: 'Oak plank floor',
		category: 'material',
		unit: 'm2',
		unitCostAmount: '34.95',
		currency: currencyOf('EUR'),
		wasteFactorDefault: '0.08',
		supplier: 'Holzhandel Nord',
		sku: 'EIC-1200-190',
		height: null,
		notes: null,
		background: null,
		...overrides,
	};
}

export function aNoIdNote(overrides: Partial<UnreadableEntry> = {}): UnreadableEntry {
	return {
		assetId: null,
		path: 'Renovation/Library/mystery.md',
		reason: 'no-id',
		code: null,
		...overrides,
	};
}

function fakeQueries(
	entries: readonly CatalogueEntryDto[],
	unreadable: readonly UnreadableEntry[],
): AssetLibraryQueryServices {
	return {
		...unavailableAssetLibraryQueries(),
		listCatalogue: () => Promise.resolve(ok({ entries, unreadable })),
	};
}

/**
 * Everything a case can vary, in one options object rather than as parameters (`max-params`
 * is 5, and this is already past it).
 *
 * `queries` overrides the listing wholesale, which is what a case counting READS or driving a
 * refusal needs; `commands` is MERGED over the refusal bundle, so a case naming one door still
 * gets the other five refusing rather than a bundle it had to spell out in full.
 */
export interface MountOptions {
	entries?: readonly CatalogueEntryDto[];
	unreadable?: readonly UnreadableEntry[];
	queries?: AssetLibraryQueryServices;
	commands?: Partial<AssetLibraryCommandServices>;
	indexScanCompleted?: () => boolean;
	openNote?: (path: string) => Promise<'opened' | 'missing' | 'failed'>;
	openDesigner?: (assetId: AssetId) => Promise<void>;
	onLibraryChanged?: AssetLibraryDeps['onLibraryChanged'];
	/**
	 * §6.3's own per-leaf view state, as the WRITABLE refs `AssetLibraryView` holds privately —
	 * so a case can move them after the mount, which is the whole of what §6.3 claims ("a
	 * selection or an expansion changes what is drawn without the view remounting the tree").
	 * Passed in rather than returned, because a case that moves one already holds it.
	 */
	assetId?: Ref<string>;
	expanded?: Ref<readonly string[]>;
	/**
	 * §6.3's WRITE half, which `AssetLibraryView` supplies in production. The default below
	 * models the view faithfully in the one respect a bare mount can — it writes the refs above,
	 * exactly as `publishViewState` does BEFORE its `setViewState` round trip — so a case that
	 * clicks a row sees the same `context.assetId` a leaf would. What it deliberately does not
	 * model is Obsidian's round trip back through `setState`; `assetLibraryViewState.test.ts`
	 * drives the real view for that.
	 */
	publishViewState?: (assetId: string, expanded: readonly string[]) => void;
	/**
	 * Mount INTO `document.body` rather than into a free-floating element.
	 *
	 * Off by default because it costs every case a `wrapper.unmount()` it would not otherwise
	 * need. §6.2's cases require it and cannot fake it: `focus()` on a detached element does
	 * nothing at all, and `getComputedStyle` only resolves a STYLESHEET rule for an element that
	 * is actually in the document — which is how a case stands in for §7's container query, the
	 * one mechanism this jsdom does not evaluate.
	 */
	attach?: boolean;
}

export async function mountRoot(options: MountOptions = {}): Promise<VueWrapper> {
	const base = defaultAssetLibraryDeps();
	const deps = defaultAssetLibraryDeps({
		queries: options.queries ?? fakeQueries(options.entries ?? [], options.unreadable ?? []),
		commands: { ...base.commands, ...options.commands },
		indexScanCompleted: options.indexScanCompleted ?? (() => true),
		openNote: options.openNote ?? (() => Promise.resolve('opened')),
		openDesigner: options.openDesigner ?? (() => Promise.resolve()),
		onLibraryChanged: options.onLibraryChanged ?? base.onLibraryChanged,
	});
	const assetId = options.assetId ?? ref('');
	const expanded = options.expanded ?? ref<readonly string[]>([]);
	const context: AssetLibraryContext = {
		...deps,
		assetId,
		expanded,
		publishViewState:
			options.publishViewState ??
			((id, categories): void => {
				assetId.value = id;
				expanded.value = categories;
			}),
	};
	// The SAME pinia the tree installs is made active here, so a case reaching for
	// `useDialogStore()` after the mount resolves the store this root is actually writing.
	// `createPinia().install` claims the module global on its own, but relying on that is the
	// `activePinia` trap `AssetLibraryStore.hydrate` carries a whole paragraph about.
	const pinia = createPinia();
	setActivePinia(pinia);
	const wrapper = mount(AssetLibraryRoot, {
		...(options.attach === true ? { attachTo: document.body } : {}),
		global: { plugins: [pinia], provide: { [ASSET_LIBRARY_CONTEXT as symbol]: context } },
	});
	await settle();
	return wrapper;
}
