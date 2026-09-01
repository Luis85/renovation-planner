import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { createApp, type App as VueApp } from 'vue';
import VueKonva from 'vue-konva';
import { createPinia } from 'pinia';
import AssetDesignerRoot from './AssetDesignerRoot.vue';
import { ASSET_DESIGNER_CONTEXT, type AssetDesignerContext, type AssetDesignerDeps } from './AssetDesignerContext';
import { tr } from '../i18n/strings';
import { nextAppIdPrefix } from '../views/app-id-prefix';

/**
 * The asset designer (ADR-0015), the plugin's third workspace view.
 *
 * PER ASSET, not a singleton, for the reason the Plan Editor is per plan: comparing two objects
 * means having both open. The view TYPE is one constant — Obsidian persists it in the workspace
 * layout, so it is DATA and renaming it orphans every leaf a user has — and the open asset
 * travels in Obsidian's own per-leaf ephemeral view state, which is rebuildable UI state and
 * not a source of truth.
 */
export const ASSET_DESIGNER_VIEW = 'renovation-asset-designer';

/** One fact for the tab and for anything that opens it, so the two cannot drift. */
export const ASSET_DESIGNER_ICON = 'box';

interface AssetDesignerViewState {
	readonly assetId: string;
}

/**
 * The workspace layout is a file the user can edit and a file another version of this plugin
 * wrote, so the asset id arrives as `unknown` and is validated rather than cast — the same trust
 * boundary `settingsFrom` draws around `data.json`, and the shape `planIdFrom` already takes.
 *
 * A missing, empty or non-string id leaves the view mounting nothing at all rather than
 * hydrating an asset called `undefined`.
 *
 * Deliberately NOT `projectIdFrom`'s three-way parse: there, `''` is a real DESTINATION — the
 * project list — so refusing it would strip the state the back arrow restores. A designer leaf
 * has no such second state, so an empty id means only "no asset yet" and is refused like any
 * other unusable value.
 */
function assetIdFrom(state: unknown): AssetDesignerViewState | null {
	if (typeof state !== 'object' || state === null) return null;
	const assetId = (state as Record<string, unknown>)['assetId'];
	return typeof assetId === 'string' && assetId.length > 0 ? { assetId } : null;
}

export class AssetDesignerView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private deps: AssetDesignerDeps,
	) {
		super(leaf);
	}

	/**
	 * Points this view at a NEW composition root, remounting so the Vue tree stops holding the
	 * old one — the same contract as `PlanEditorView.rebind` and `RenovationProjectView.rebind`,
	 * and `saveSettings` calls all three for every open leaf of each type. Without it a pane left
	 * open across a settings save goes on reading through services nothing maintains any more.
	 *
	 * It goes back through `sync` rather than calling `mount` directly, because `sync` is the ONE
	 * place that decides whether this view has an asset to draw. `unmount` clearing
	 * `mountedAssetId` is what then lets the SAME asset through that guard, so the leaf redraws
	 * what it was already showing: `assetId` is this view's own field and a rebind never touches
	 * it, which is what stops a settings save moving a leaf to a different asset.
	 *
	 * The cost, stated rather than glossed: a remount discards the designer's transient state —
	 * the read, and since Task B3a the undo history and the save-state batch with it, exactly as
	 * on the plan editor and for the same reason. The alternative is a canvas that goes on
	 * writing through a root the vault has stopped agreeing with.
	 */
	rebind(deps: AssetDesignerDeps): void {
		this.deps = deps;
		if (this.mountedAssetId === null) return;
		this.unmount();
		this.sync();
	}

	getViewType(): string {
		return ASSET_DESIGNER_VIEW;
	}

	getDisplayText(): string {
		return tr('view.asset-designer.name');
	}

	getIcon(): string {
		return ASSET_DESIGNER_ICON;
	}

	/**
	 * What Obsidian persists for this leaf, so reopening the app reopens the same asset.
	 *
	 * `''` rather than omitting the key when there is no asset: a leaf restored from a state with
	 * no `assetId` is exactly the case `assetIdFrom` rejects, and a key that is sometimes absent
	 * makes that a different shape for every reader to reason about. `PlanEditorView.getState`
	 * writes the same sentinel for the same reason, and two per-subject views spelling one
	 * absence two ways is drift with nothing to catch it.
	 */
	getState(): Record<string, unknown> {
		return { assetId: this.assetId ?? '' };
	}

	/**
	 * Called by Obsidian both when a leaf is restored and when whatever opens the designer sets
	 * the state on a leaf it has just created — and the ORDER relative to `onOpen` is not
	 * something a plugin gets to assume. Both therefore route through one `sync()`, which mounts
	 * when there is an asset to mount and does nothing when the asset has not changed. Deciding
	 * it in one place is what keeps a restore from mounting twice.
	 */
	setState(state: unknown, _result: ViewStateResult): Promise<void> {
		// **ALWAYS assigned, including when the parse refuses.** Assigning only on success left a
		// reused leaf showing the asset it already had when handed `{}`, a non-object, or the
		// empty-id sentinel `getState` itself writes — `assetIdFrom` answers `null` for all of
		// them. Two consequences, and the second outlived the session: the designer went on
		// showing an asset nobody asked it to open, and `getState()` reported that asset's id, so
		// Obsidian persisted it into the workspace layout. A state this view cannot read means it
		// does not know what is being asked for, and the honest answer to that is nothing.
		this.assetId = assetIdFrom(state)?.assetId ?? null;
		this.sync();
		return Promise.resolve();
	}

	onOpen(): Promise<void> {
		this.containerEl.addClass('renovation-planner-container');
		this.sync();
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its effects
	 * alive against a detached tree and the next open would stack a second one on top.
	 */
	onClose(): Promise<void> {
		// `unmount` empties the container now, so the separate call this used to make is gone
		// rather than left standing: a redundant line that reads as load-bearing is how the next
		// reader concludes the emptying lives here.
		this.unmount();
		return Promise.resolve();
	}

	private assetId: string | null = null;

	/**
	 * The Vue app this view mounted, held only so `onClose` can unmount the same one.
	 *
	 * `vueApp` and not `app`: `View.app` is Obsidian's OWN member, so the shorter name shadows it
	 * with an incompatible type and makes the whole class unassignable to `View` —
	 * `registerView`'s factory then stops type-checking three files away. Invisible to a suite
	 * that transpiles without checking; found by `vue-tsc`, on the sibling view, once already.
	 */
	private vueApp: VueApp | null = null;

	/** Which asset the currently mounted app is showing; `null` when nothing is mounted. */
	private mountedAssetId: string | null = null;

	private sync(): void {
		// Clearing the field is half a fix, and this is the other half: with no asset this used
		// to return early WITHOUT unmounting, so the previous tree stayed on screen and nothing a
		// user could see had changed. `unmount` is idempotent, so the ordinary no-asset case —
		// a leaf opened before any state arrives — costs nothing.
		if (this.assetId === null) {
			this.unmount();
			return;
		}
		if (this.assetId === this.mountedAssetId) return;
		this.unmount();
		this.mount(this.assetId);
	}

	private mount(assetId: string): void {
		this.contentEl.empty();
		const host = this.contentEl.createDiv('renovation-asset-designer-view');
		// `onDesignChanged` is partially applied HERE and nowhere else: the composition root
		// composes services and knows nothing about which leaf this is, while the asset is exactly
		// what this leaf IS — `PlanEditorView` binds its plan-change source the same way.
		const context: AssetDesignerContext = {
			assetId,
			queries: this.deps.queries,
			commands: this.deps.commands,
			logger: this.deps.logger,
			indexScanCompleted: this.deps.indexScanCompleted,
			onDesignChanged: (listener) => this.deps.onDesignChanged(assetId, listener),
		};

		const app = createApp(AssetDesignerRoot);
		// Two Vue apps' `useId()` calls must not collide, and this view is the third app that
		// can be on screen at once.
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());
		// On the APP instance and not globally, for `PlanEditorView`'s reason: each ItemView's
		// Vue app is isolated (ADR-0004), and a global `app.use` at plugin scope would leak
		// vue-konva's registration into every future view whether it draws a canvas or not.
		//
		// Task B4 is what made this necessary: without it `<VStage>` and `<VLayer>` resolve to
		// nothing, Vue warns and moves on, and the designer draws an empty pane with every gate
		// green — the shape of defect this whole increment's *Mounting is not optional* section
		// exists for. `assetDesignerView.test.ts` mounts the REAL view, so removing this line
		// reddens it rather than passing quietly.
		app.use(VueKonva);
		app.provide(ASSET_DESIGNER_CONTEXT, context);
		app.mount(host);

		this.vueApp = app;
		this.mountedAssetId = assetId;
	}

	/**
	 * **Unmounted means nothing of ours is in the DOM**, which is why the container is emptied
	 * here rather than by each caller. Unmounting the Vue app leaves the host `div` behind, and
	 * that went unnoticed because `mount` empties before it builds — so the leftover was always
	 * swept away by the NEXT mount. With no asset to show there is no next mount, and the pane
	 * kept a stale, inert shell of the design it had just been told to stop showing.
	 */
	private unmount(): void {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.mountedAssetId = null;
		this.contentEl.empty();
	}
}
