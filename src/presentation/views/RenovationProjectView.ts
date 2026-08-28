import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import ViewRoot from './ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps } from './RenovationProjectContext';
import { tr } from '../i18n/strings';
import { nextAppIdPrefix } from './app-id-prefix';

/**
 * The workspace view the SDD names first (§11): the project surface.
 *
 * The view TYPE is persisted by Obsidian in the workspace layout, so it is data rather
 * than text — renaming it orphans every leaf a user already has open, exactly like a
 * frontmatter key. The display name beside it is text, and translatable.
 */
export const RENOVATION_PROJECT_VIEW = 'renovation-project';

/**
 * The surface's icon: ONE fact for the view tab and the ribbon button, exported so the
 * two cannot drift — a ribbon whose icon disagrees with the tab it opens is invisible to
 * every check here (the harness deliberately renders no icons yet) and found by a user.
 */
export const RENOVATION_PROJECT_ICON = 'hammer';

/**
 * The Renovation Project view's first data dependency (design slice 14): a list of
 * projects, and an empty state when there are none.
 *
 * Slice 1 reserved this seam in writing: "Query-service access is constructor-injected …
 * exactly like `RenovationProjectView` would be once it has data needs." `deps` is that
 * need — extending the seam by a constructor field rather than relocating it. What this
 * class itself still proves is the LIFECYCLE the SDD's §12 asks for — one isolated Vue app
 * per Obsidian view, created in `onOpen` and unmounted in `onClose`. Nothing outside this
 * file learns that a view is Vue.
 *
 * `contentEl`, not `containerEl`: the outer element carries Obsidian's own view chrome —
 * the header and the tab actions — and emptying it takes those with it.
 */
export class RenovationProjectView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly deps: RenovationProjectDeps,
	) {
		super(leaf);
	}

	getViewType(): string {
		return RENOVATION_PROJECT_VIEW;
	}

	getDisplayText(): string {
		return tr('view.project.name');
	}

	getIcon(): string {
		return RENOVATION_PROJECT_ICON;
	}

	/**
	 * The Vue app this view mounted, held only so `onClose` can unmount the same one. `null`
	 * between a close and the next open — Obsidian keeps the leaf and reuses the view.
	 *
	 * `vueApp` and not `app`: `View.app` is Obsidian's OWN member (the `App` instance), so
	 * the shorter name shadows it with an incompatible type and makes the whole class
	 * unassignable to `View` — `registerView`'s factory stops type-checking, three files
	 * away from the declaration. Invisible to the suite, which does not type-check; found by
	 * `vue-tsc` in `npm run build`.
	 */
	private vueApp: VueApp | null = null;

	onOpen(): Promise<void> {
		// The hook the stylesheet keys on to reset Obsidian's own pane paddings
		// (styles/chrome.css) — on `containerEl`, because the padding lives on
		// `.view-content`, a descendant of it. Idempotent across re-opens: Obsidian
		// reuses this view, and `addClass` is set-membership.
		this.containerEl.addClass('renovation-planner-container');
		this.contentEl.empty();
		// One isolated app per ItemView with its OWN Pinia (ADR-004, SDD §12) rather than a
		// shared singleton. Mounted onto `contentEl` directly — not `containerEl`, which
		// carries Obsidian's own view chrome — so the component's root element IS the
		// `.renovation-planner-view` the stylesheet keys off, with no wrapper in the height
		// chain.
		const app = createApp(ViewRoot);
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());
		// Provided BEFORE mount, the same order `PlanEditorView` uses: a component's setup
		// runs during `mount`, and `useRenovationProjectContext` throws if it runs before the
		// context is there to find.
		app.provide(RENOVATION_PROJECT_CONTEXT, this.deps);
		app.mount(this.contentEl);
		this.vueApp = app;
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its
	 * effects alive against a detached tree and the next open would stack a second one.
	 * Emptying afterwards is what makes a re-open start from a clean pane; detaching the
	 * leaf instead would lose the user's layout, which is a recurring review rejection.
	 */
	onClose(): Promise<void> {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.contentEl.empty();
		return Promise.resolve();
	}
}
