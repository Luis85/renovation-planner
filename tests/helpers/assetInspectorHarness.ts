/**
 * Mounts `AssetInspector.vue` BARE — a Pinia plugin, a provided context and an already-hydrated
 * `AssetLibraryStore`, never the whole `AssetLibraryView` lifecycle.
 *
 * The hydration is not a convenience: the panel resolves its selected id against the LISTING
 * (`entryFor`, plus §5.1a's `unreadable` rows), and a store that has not read yet resolves every
 * id to nothing — so a panel mounted over an unhydrated store reports every asset as gone. That
 * is the precondition `AssetInspector.vue`'s own docblock states and Task 16 owns; this helper
 * establishes it once so no case can forget it and pass for the wrong reason.
 *
 * `installObsidianDom()` is deliberately NOT called here: it is a per-file jsdom decision and
 * each suite makes it at its own top level, as every other file in this tree does.
 */
import { createPinia, setActivePinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref } from 'vue';
import AssetInspector from '../../src/presentation/library/AssetInspector.vue';
import {
	ASSET_LIBRARY_CONTEXT,
	type AssetLibraryContext,
} from '../../src/presentation/library/AssetLibraryContext';
import type { AssetLibraryCommandServices } from '../../src/presentation/library/AssetLibraryDeps';
import type { AssetLibraryQueryServices } from '../../src/presentation/read-models/assetLibraryQueries';
import { useAssetLibraryStore } from '../../src/presentation/stores/AssetLibraryStore';
import { ok } from '../../src/core/result/Result';
import type {
	CatalogueEntryDto,
	UnreadableEntry,
} from '../../src/application/queries/ListCatalogueEntries';
import type { AssetId } from '../../src/domain/asset/AssetId';
import { assetDesign } from './assetDesign';
import { defaultAssetLibraryDeps } from './makeAssetLibraryView';
import { settle } from './async';

/**
 * Answers every one of the five doors successfully, which is what makes a case that overrides
 * ONE of them a case about that door — the refusal bundle would leave the other four failing
 * and every section drawing its refusal state at once.
 */
function answeringQueries(
	entries: readonly CatalogueEntryDto[],
	unreadable: readonly UnreadableEntry[],
): AssetLibraryQueryServices {
	return {
		listCatalogue: () => Promise.resolve(ok({ entries, unreadable })),
		listOutlines: (assetIds) => Promise.resolve(new Map(assetIds.map((id) => [id, { kind: 'none' }]))),
		getDesign: (assetId) => Promise.resolve(ok(assetDesign({ assetId }))),
		listReferencing: () => Promise.resolve(ok([])),
		listOverridingProjects: () => Promise.resolve(ok([])),
	};
}

export interface InspectorOptions {
	assetId?: AssetId | null;
	entries?: readonly CatalogueEntryDto[];
	unreadable?: readonly UnreadableEntry[];
	/** MERGED over the answering bundle above, so a case names only the door it is about. */
	queries?: Partial<AssetLibraryQueryServices>;
	commands?: Partial<AssetLibraryCommandServices>;
	openNote?: (path: string) => Promise<'opened' | 'missing' | 'failed'>;
	openAssetNote?: (assetId: AssetId) => Promise<'opened' | 'missing' | 'failed'>;
	openDesigner?: (assetId: AssetId) => Promise<void>;
}

export interface MountedInspector {
	readonly panel: VueWrapper;
	/** A row click, as the root performs it: the prop moves, and nothing else. */
	select(assetId: AssetId | null): Promise<void>;
}

export async function mountInspector(options: InspectorOptions = {}): Promise<MountedInspector> {
	const base = defaultAssetLibraryDeps();
	const queries: AssetLibraryQueryServices = {
		...answeringQueries(options.entries ?? [], options.unreadable ?? []),
		...options.queries,
	};
	const context: AssetLibraryContext = {
		...defaultAssetLibraryDeps({
			queries,
			commands: { ...base.commands, ...options.commands },
			openNote: options.openNote ?? (() => Promise.resolve('opened')),
			openAssetNote: options.openAssetNote ?? (() => Promise.resolve('opened')),
			openDesigner: options.openDesigner ?? (() => Promise.resolve()),
			indexScanCompleted: () => true,
		}),
		assetId: ref(''),
		expanded: ref<readonly string[]>([]),
	};
	const pinia = createPinia();
	setActivePinia(pinia);
	// The listing is read BEFORE the mount, so the panel opens against a store that has an
	// answer — see this file's own header for why that is a precondition and not a shortcut.
	await useAssetLibraryStore().hydrate(queries, () => true);

	const panel = mount(AssetInspector, {
		props: { assetId: options.assetId ?? null },
		global: { plugins: [pinia], provide: { [ASSET_LIBRARY_CONTEXT as symbol]: context } },
	});
	await settle();

	return {
		panel,
		async select(assetId) {
			await panel.setProps({ assetId });
			await settle();
		},
	};
}
