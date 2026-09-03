import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { createApp, ref, type App as VueApp, type Ref } from 'vue';
import { createPinia } from 'pinia';
import AssetLibraryRoot from './AssetLibraryRoot.vue';
import { ASSET_LIBRARY_CONTEXT, type AssetLibraryContext } from './AssetLibraryContext';
import type { AssetLibraryDeps } from './AssetLibraryDeps';
import { tr } from '../i18n/strings';
import { nextAppIdPrefix } from '../views/app-id-prefix';

/**
 * §2's fourth registered view and third workspace surface: the vault-wide asset catalogue, a
 * SINGLETON exactly as the Renovation Project view is one — there is at most one library, not
 * one per subject the way the Plan Editor and the Asset designer are.
 *
 * The view TYPE is persisted in Obsidian's workspace layout, so it is DATA and never renamed —
 * the same rule every registered view here already carries.
 */
export const ASSET_LIBRARY_VIEW = 'renovation-asset-library';

/**
 * The surface's icon: ONE fact for the view tab, exported so a future caller cannot drift from
 * it the way `RENOVATION_PROJECT_ICON` guards its own ribbon-versus-tab pair. §2 refuses this
 * surface a ribbon button of its own, so today this is read only by `getIcon()`.
 */
export const ASSET_LIBRARY_ICON = 'boxes';

interface AssetLibraryViewState {
	readonly assetId: string;
	readonly expanded: readonly string[];
}

/**
 * The workspace layout is a file the user can edit and a file another version of this plugin
 * wrote, so the state arrives as `unknown` and is validated rather than cast — the same trust
 * boundary `settingsFrom` draws around `data.json`.
 *
 * **`assetId` is `projectIdFrom`'s own three-way parse**, per §6.3: a non-object refuses, a
 * non-string refuses, and `''` is ACCEPTED — it means nothing selected, which is the state a
 * restore has to be able to reach. A validator that refused `''` would discard exactly the
 * value a fresh leaf, or a user who has cleared their selection, needs to persist.
 *
 * **`expanded` is read leniently rather than refusing the whole state over it.** Which shelf a
 * user last left open is cosmetic, where `assetId` names the row the inspector is showing —
 * the two do not deserve the same strictness, so an absent or malformed `expanded` falls back
 * to an empty set rather than refusing a perfectly good `assetId` beside it.
 */
function assetLibraryStateFrom(state: unknown): AssetLibraryViewState | null {
	if (typeof state !== 'object' || state === null) return null;
	const record = state as Record<string, unknown>;
	const assetId = record['assetId'];
	if (typeof assetId !== 'string') return null;
	const rawExpanded = record['expanded'];
	const expanded =
		Array.isArray(rawExpanded) && rawExpanded.every((category) => typeof category === 'string')
			? rawExpanded
			: [];
	return { assetId, expanded };
}

/**
 * §2's fourth workspace view, mounted once per session rather than per subject: the library
 * always has something to draw — the catalogue, with or without a selection — so unlike the
 * Plan Editor or the Asset designer there is no "nothing to show yet" state that withholds the
 * mount.
 *
 * `contentEl`, not `containerEl` — the outer element carries Obsidian's own view chrome, and
 * emptying it takes that with it. The Vue app mounts onto `contentEl` DIRECTLY, with NO wrapper
 * div, exactly as `RenovationProjectView` does and for the identical reason its own docblock
 * gives: a `contentEl.createDiv(...)` host has `height: auto` and collapses the pane to a
 * sliver, invisible to jsdom and caught only by the browser harness.
 */
export class AssetLibraryView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private deps: AssetLibraryDeps,
	) {
		super(leaf);
	}

	/**
	 * Points this view at a NEW composition root — the fourth member of the category
	 * `RenovationProjectView.rebind`'s own docblock already names (a view built against a
	 * replaced root), and the one §2's placement table calls out by name: §83's library-folder
	 * migration MOVES every catalogue note and then swaps the root, so an un-rebound library
	 * goes on resolving asset notes at the folder they have just left — showing an empty or
	 * wrong library immediately after the single gesture most likely to be performed from it.
	 *
	 * REMOUNTS when something is already mounted, unlike a `setState`-driven selection change:
	 * `deps` carries the queries and commands a rebind must replace, and those are handed down
	 * once, at the one `provide()` call `mount` makes — the same trade `AssetDesignerView.rebind`
	 * and `RenovationProjectView.rebind` already take, for the identical reason a member-by-
	 * member update would be a second, drifting spelling of the whole bundle.
	 *
	 * `assetId` and `expanded` are this VIEW's own fields, never the bundle's, so a rebind
	 * carries the current selection across the remount rather than losing it — `mount` reads
	 * them fresh each time it runs.
	 */
	rebind(deps: AssetLibraryDeps): void {
		this.deps = deps;
		if (!this.mounted) return;
		this.unmount();
		this.mount();
	}

	getViewType(): string {
		return ASSET_LIBRARY_VIEW;
	}

	getDisplayText(): string {
		return tr('view.asset-library.title');
	}

	getIcon(): string {
		return ASSET_LIBRARY_ICON;
	}

	/**
	 * `''` rather than omitting the key, for the reason every sibling `getState` already
	 * gives: a key that is sometimes absent is a different shape for every reader to reason
	 * about, and here it also carries meaning — `''` IS "nothing selected". `expanded` is
	 * always present as an array, even when empty, for the identical reason.
	 */
	getState(): Record<string, unknown> {
		return { assetId: this.assetId, expanded: this.expanded };
	}

	/**
	 * §6.3: neither a selection nor an expansion is a navigation, so `result.history` is left
	 * untouched here — never set true, for ANY accepted change. `RenovationProjectView.setState`
	 * sets it true on an accepted, CHANGED `projectId`; copying that shape here would put a
	 * history entry behind every row a user clicks, which is exactly the defect a review bot
	 * found reading the API rather than an early draft of this spec's own sentence.
	 *
	 * A refused parse leaves both fields untouched — the conservative answer is to go on
	 * showing whatever is already shown, `projectIdFrom`'s own refusal arm.
	 *
	 * **Never remounts.** This is what makes a selection change different from a navigation at
	 * the mechanism level, not only at the `history` flag: the two refs `mount` handed the tree
	 * are updated IN PLACE, so an already-mounted app sees the new subject without losing
	 * anything else it holds — the shelves' scroll position among them (§6.3). Before the first
	 * mount there is nothing to update in place, so only the view's own fields move; `mount`
	 * reads them when it eventually runs.
	 */
	setState(state: unknown, _result: ViewStateResult): Promise<void> {
		const parsed = assetLibraryStateFrom(state);
		if (parsed !== null) {
			this.assetId = parsed.assetId;
			this.expanded = parsed.expanded;
			if (this.assetIdRef !== null) this.assetIdRef.value = parsed.assetId;
			if (this.expandedRef !== null) this.expandedRef.value = parsed.expanded;
		}
		return Promise.resolve();
	}

	onOpen(): Promise<void> {
		// The hook the stylesheet keys on to reset Obsidian's own pane paddings
		// (styles/chrome.css), the same line every other view here carries.
		this.containerEl.addClass('renovation-planner-container');
		if (!this.mounted) this.mount();
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its
	 * effects alive against a detached tree and the next open would stack a second one.
	 */
	onClose(): Promise<void> {
		this.unmount();
		return Promise.resolve();
	}

	private assetId = '';
	private expanded: readonly string[] = [];

	/**
	 * The Vue app this view mounted, held only so `unmount` can unmount the same one. `null`
	 * between a close and the next open — Obsidian keeps the leaf and reuses the view.
	 *
	 * `vueApp` and not `app`: `View.app` is Obsidian's OWN member (the `App` instance), so the
	 * shorter name shadows it with an incompatible type — `RenovationProjectView`'s own
	 * docblock records the build error this produces three files away from the declaration.
	 */
	private vueApp: VueApp | null = null;

	/** The two refs `setState` writes in place once mounted; `null` before the first mount. */
	private assetIdRef: Ref<string> | null = null;
	private expandedRef: Ref<readonly string[]> | null = null;

	private mounted = false;

	private mount(): void {
		this.contentEl.empty();
		// One isolated app per ItemView with its OWN Pinia (ADR-004, SDD §12), exactly as every
		// other registered view here.
		const app = createApp(AssetLibraryRoot);
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());

		const assetIdRef = ref(this.assetId);
		const expandedRef = ref<readonly string[]>(this.expanded);
		// Provided BEFORE mount, the same order every sibling view uses: a component's setup
		// runs during `mount`, and `useAssetLibraryContext` throws if it runs before the context
		// is there to find.
		const context: AssetLibraryContext = {
			...this.deps,
			assetId: assetIdRef,
			expanded: expandedRef,
		};
		app.provide(ASSET_LIBRARY_CONTEXT, context);
		// Onto `contentEl` itself, with no wrapper — see the class docblock's height chain.
		app.mount(this.contentEl);

		this.vueApp = app;
		this.assetIdRef = assetIdRef;
		this.expandedRef = expandedRef;
		this.mounted = true;
	}

	private unmount(): void {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.assetIdRef = null;
		this.expandedRef = null;
		this.mounted = false;
	}
}
