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
		private readonly deps: PlanEditorDeps,
	) {
		super(leaf);
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
		};

		const app = createApp(PlanEditorRoot);
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
