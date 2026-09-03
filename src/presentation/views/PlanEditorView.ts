import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import PlanEditorRoot from '../editor/PlanEditorRoot.vue';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../editor/PlanEditorContext';
import type {
	PlanEditorCommandServices,
} from '../editor/planEditorCommands';
import type { BackgroundVault } from '../editor/layers/background/BackgroundRenderModel';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import { tr } from '../i18n/strings';
import { nextAppIdPrefix } from './app-id-prefix';
import { notifyFault } from '../notices/notify';

/**
 * The Plan Editor (SDD §11's second surface).
 *
 * Unlike `RenovationProjectView` this is PER PLAN, not a singleton: a user comparing
 * Ground Floor against First Floor wants both open at once. The view TYPE is still one
 * constant — Obsidian persists it in the workspace layout, so it is data and renaming it
 * orphans every leaf a user has — and the open Plan travels in Obsidian's own per-leaf
 * ephemeral view state, which is rebuildable UI state and not a source of truth.
 */
export const PLAN_EDITOR_VIEW = 'renovation-plan-editor';

/** One fact for the tab and for anything that opens it, so the two cannot drift. */
export const PLAN_EDITOR_ICON = 'map';

interface PlanEditorViewState {
	readonly planId: string;
}

/**
 * What the composition root hands in. The view never imports a repository: it sees the
 * query interface `presentation/` declares and a narrow slice of the Vault, both composed
 * in `plugin/`.
 */
export interface PlanEditorDeps {
	readonly queries: PlanEditorQueryServices;
	/** The write side the editor's tools dispatch through — see `planEditorCommands.ts`. */
	readonly commands: PlanEditorCommandServices;
	readonly vault: BackgroundVault;
	readonly onThemeChange: (listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "this Plan changed", filtered to one plan
	 * id. The composition root builds it from the `EventBus`, so the view never subscribes
	 * to an event type by name and `presentation/` never learns the vocabulary of
	 * `domain/plan/Plan.events.ts`.
	 */
	readonly onPlanChanged: (planId: string, listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "the vault's asset catalogue changed".
	 *
	 * Takes NO id, which is the whole difference from the door above: an Asset has belonged
	 * to no project since design slice 19 and to no plan ever, so there is nothing to filter
	 * on and every leaf wants the same unfiltered category.
	 */
	readonly onCatalogueChanged: (listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "a project's own price for an asset moved".
	 *
	 * Takes no id for the same reason the door above does not: this view's subject is a PLAN,
	 * and the price event names a project. Filtering here would mean resolving the plan to a
	 * project first, which is an async read a subscription cannot wait on.
	 */
	readonly onProjectPricesChanged: (listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "this requirement's stored figures moved",
	 * delivering the requirement's id so the Inspector can skip a row it is not drawing.
	 */
	readonly onRequirementFiguresChanged: (listener: (requirementId: string) => void) => () => void;
	/**
	 * "A vault file appeared, changed, moved or went" — every path, unfiltered, so a surface
	 * drawing a document can notice the document itself moving under it.
	 *
	 * A background is a PNG or a PDF the user put in their vault, which puts it outside every
	 * other change door this bundle carries: `VaultChangeAdapter` reads `.md` and `.rpgeo` and
	 * drops the rest, and a frontmatter reference does not move when the file it names does. So a
	 * replaced or deleted sheet went unnoticed for as long as the surface sat idle — the residual
	 * `BackgroundLayer`'s document key disclosed, and the reason this member is REQUIRED rather
	 * than optional: a surface that mounts that layer has to answer the question.
	 *
	 * Takes NO id, for `onCatalogueChanged`'s reason: there is nothing to filter on here either,
	 * and the subscriber compares the path against the one it is drawing.
	 */
	readonly onVaultFileChanged: (listener: (path: string) => void) => () => void;
}

/**
 * The workspace layout is a file the user can edit and a file another version of this
 * plugin wrote, so the plan id arrives as `unknown` and is validated rather than cast —
 * the same trust boundary `settingsFrom` draws around `data.json`. A missing or empty id
 * leaves the view showing its loading state instead of hydrating a plan called
 * `undefined`.
 */
function planIdFrom(state: unknown): PlanEditorViewState | null {
	if (typeof state !== 'object' || state === null) return null;
	const planId = (state as Record<string, unknown>)['planId'];
	return typeof planId === 'string' && planId.length > 0 ? { planId } : null;
}

export class PlanEditorView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private deps: PlanEditorDeps,
	) {
		super(leaf);
	}

	/**
	 * Points this view at a NEW composition root, remounting so the Vue tree stops holding the
	 * old one — the same contract as `RenovationProjectView.rebind`, and that file carries the
	 * account of why "the factory resolves per call" was never enough. `saveSettings` calls
	 * both for every open leaf of each type.
	 *
	 * It goes back through `sync` rather than calling `mount` directly, because `sync` is the
	 * ONE place that decides whether this view has a plan to draw — a second mounting decision
	 * beside it is exactly what its own docblock exists to prevent. `unmount` clearing
	 * `mountedPlanId` is what then lets the SAME plan through that guard, so the leaf redraws
	 * the plan it was already showing: `planId` is this view's own field and a rebind never
	 * touches it.
	 *
	 * The cost, stated rather than glossed: a remount discards the editor's transient state —
	 * the undo history, the camera, the selection. That is a real loss on a rare, deliberate
	 * action, and the alternative is a canvas that goes on writing through a root the vault
	 * has stopped agreeing with.
	 *
	 * **A second cost is RECORDED rather than closed, and it is the same residual
	 * `DialogHost.onBeforeUnmount` carries on the project side.** A `saveSettings` landing while
	 * an editor write is still awaiting the vault remounts over it: the write completes, but its
	 * domain event is published on the RETIRED bus, and `createPlanChangeSource` subscribes to
	 * `PLAN_CHANGE_EVENTS` and `ProjectIndexRebuilt` — neither of which the retired bus will
	 * raise for it — so the remounted canvas can sit stale over a write that succeeded, until
	 * the leaf is reopened. Reported in review, and the remedy it names is the one declined
	 * above it: deferring the rebind needs a seam from here back out to the `ItemView` that does
	 * not exist, and keeps the retired root live for the write's length, which is what this
	 * method exists to stop. Subscribing to `ProjectIndexEntryChanged` looks like the cheap
	 * partial and is not one — the write is this plugin's own, so `VaultChangeAdapter`'s echo
	 * window suppresses it by design and no index event is ever raised to carry it.
	 * `docs/tasks/16`'s sixteenth-round section has the full account.
	 */
	rebind(deps: PlanEditorDeps): void {
		this.deps = deps;
		if (this.mountedPlanId === null) return;
		this.unmount();
		this.sync();
	}

	getViewType(): string {
		return PLAN_EDITOR_VIEW;
	}

	getDisplayText(): string {
		return tr('view.plan-editor.name');
	}

	getIcon(): string {
		return PLAN_EDITOR_ICON;
	}

	/**
	 * What Obsidian persists for this leaf, so reopening the app reopens the same Plan.
	 * `''` rather than omitting the key when there is no plan yet: a leaf restored from a
	 * state with no `planId` is exactly the case `planIdFrom` rejects, and a key that is
	 * sometimes absent makes that a different shape to reason about.
	 */
	getState(): Record<string, unknown> {
		return { planId: this.planId ?? '' };
	}

	/**
	 * Called by Obsidian both when a leaf is restored and when `revealPlanEditor` sets the
	 * state on a leaf it just created — and the ORDER relative to `onOpen` is not something
	 * a plugin gets to assume. Both therefore route through one `sync()`, which mounts when
	 * there is a plan to mount and does nothing when the plan has not changed. Deciding it
	 * in one place is what keeps a restore from mounting twice.
	 */
	setState(state: unknown, _result: ViewStateResult): Promise<void> {
		const parsed = planIdFrom(state);
		if (parsed !== null) this.planId = parsed.planId;
		this.sync();
		return Promise.resolve();
	}

	onOpen(): Promise<void> {
		this.containerEl.addClass('renovation-planner-container');
		this.sync();
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its
	 * effects — a `ResizeObserver`, a `css-change` listener, a Konva stage — alive against a
	 * detached tree, and the next open would stack a second one on top.
	 */
	onClose(): Promise<void> {
		this.unmount();
		this.contentEl.empty();
		return Promise.resolve();
	}

	private planId: string | null = null;

	/**
	 * The Vue app this view mounted, held only so `onClose` can unmount the same one.
	 *
	 * `vueApp` and not `app`: `View.app` is Obsidian's OWN member, so the shorter name
	 * shadows it with an incompatible type and makes the whole class unassignable to
	 * `View` — `registerView`'s factory stops type-checking three files away. Invisible to
	 * the suite, which does not type-check; found by `vue-tsc`.
	 */
	private vueApp: VueApp | null = null;

	/** Which Plan the currently mounted app is showing; `null` when nothing is mounted. */
	private mountedPlanId: string | null = null;

	private sync(): void {
		if (this.planId === null || this.planId === this.mountedPlanId) return;
		this.unmount();
		this.mount(this.planId);
	}

	private mount(planId: string): void {
		this.contentEl.empty();
		const host = this.contentEl.createDiv('renovation-plan-editor-view');
		const context: PlanEditorContext = {
			planId,
			queries: this.deps.queries,
			commands: this.deps.commands,
			vault: this.deps.vault,
			onThemeChange: this.deps.onThemeChange,
			onPlanChanged: (listener) => this.deps.onPlanChanged(planId, listener),
			// Passed straight through rather than partially applied: there is no id to bind.
			onCatalogueChanged: this.deps.onCatalogueChanged,
			// Passed straight through for the same reason, and for the three below the reason is
			// the same one more time: none of the price, figure or vault-file doors takes an id
			// this view holds.
			onProjectPricesChanged: this.deps.onProjectPricesChanged,
			onRequirementFiguresChanged: this.deps.onRequirementFiguresChanged,
			onVaultFileChanged: this.deps.onVaultFileChanged,
			// NOT a `PlanEditorDeps` member: the composition root composes services and knows
			// nothing about which leaf this is. The leaf is the VIEW's, so the view is what can
			// close it.
			closeLeaf: () => {
				this.leaf.detach();
			},
			// The same shape as `closeLeaf` above and for the same reason: the leaf is the
			// VIEW's, so the view is what can reveal it. Detached like every other door
			// CLAUDE.md's Architecture section names — the promise is the workspace's own
			// animation and nothing here awaits it — but a rejection still owes a fault door:
			// this is the ONLY control an unsupported-width pane offers, so a silent `void`
			// here would be a control that visibly does nothing. `src/plugin/runDetached.ts`
			// is that door and `presentation/` may not import `plugin/` (the layer bans), so
			// its one step — map, log, notify — is inlined via `notifyFault` directly, the
			// same function `runDetached` itself calls.
			focusLeaf: () => {
				this.app.workspace.revealLeaf(this.leaf).catch((cause: unknown) => {
					notifyFault(cause, this.deps.commands.logger, 'plan-editor.focus-leaf-failed');
				});
			},
		};

		const app = createApp(PlanEditorRoot);
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());
		// On the APP instance and not globally: each ItemView's Vue app is isolated
		// (ADR-004), and a global `app.use` at plugin scope would leak vue-konva's component
		// registration into every future view whether it draws a canvas or not.
		app.use(VueKonva);
		app.provide(PLAN_EDITOR_CONTEXT, context);
		app.mount(host);

		this.vueApp = app;
		this.mountedPlanId = planId;
	}

	private unmount(): void {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.mountedPlanId = null;
	}
}
