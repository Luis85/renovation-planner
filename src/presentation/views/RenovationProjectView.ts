import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
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
 * The workspace layout is a file the user can edit and a file another version of this plugin
 * wrote, so the project id arrives as `unknown` and is validated rather than cast — the same
 * trust boundary `settingsFrom` draws around `data.json`.
 *
 * **The parse is three-way, and the third arm is the one `PlanEditorView` does not have.**
 * `''` is the LIST — a state, not an absence — so it must be ACCEPTED and turned into `null`
 * rather than refused. `planIdFrom` refuses an empty id because that view's empty case is
 * *nothing to draw*; refusing it here would refuse the only state the back arrow ever
 * restores, and the pane would never leave the detail state.
 *
 * A value that is not a string at all is a layout this build does not recognise, and the
 * conservative answer to that is to go on drawing whatever is already drawn — which is the
 * refusal arm. A leaf restored from a layout written BEFORE this slice carries no `projectId`
 * key at all and lands there, correctly, because a freshly constructed view's field is already
 * `null` and `null` is the list. That the two coincide is worth stating so that nobody later
 * "simplifies" the refusal into a default and discovers the difference on a view that has
 * already navigated.
 */
function projectIdFrom(state: unknown): { projectId: string | null } | null {
	if (typeof state !== 'object' || state === null) return null;
	const projectId = (state as Record<string, unknown>)['projectId'];
	if (typeof projectId !== 'string') return null;
	return { projectId: projectId.length > 0 ? projectId : null };
}

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
 * the header and the tab actions — and emptying it takes those with it. The Vue app mounts
 * onto `contentEl` DIRECTLY, with no wrapper div, so the component's root element IS the
 * `.renovation-planner-view` the stylesheet gives `height: 100%` — `PlanEditorView` mounts
 * into a `contentEl.createDiv(...)` host instead, and copying that here puts an element with
 * `height: auto` into the chain and collapses the pane to a sliver. That defect is invisible
 * to jsdom, which lays nothing out; the browser harness caught it in slice 1.
 *
 * **Design slice 21 gave it a second state**, and one field decides which: `projectId` is
 * `null` for the LIST and a project id for that project's detail state. Every navigation
 * REMOUNTS (`sync`), because `RenovationProjectDeps.projectId` is fixed per mount rather than
 * reactive — so the tree is built from the state it draws and the two cannot disagree. The
 * cost is the one `rebind` already carries and is stated rather than glossed: the list's
 * scroll position goes, and a dialog open at that moment settles through
 * `DialogHost.onBeforeUnmount`. Both are correct for a deliberate navigation, which is the
 * only thing that reaches here.
 */
export class RenovationProjectView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private deps: RenovationProjectDeps,
	) {
		super(leaf);
	}

	/**
	 * Points this view at a NEW composition root, remounting so the Vue tree stops holding
	 * the old one. Called by `saveSettings` for every open leaf of this type.
	 *
	 * **Why `deps` had to stop being `readonly`.** `registerView`'s factory resolves the
	 * dependencies per CALL, and its comment said that was what made a root swap safe — but
	 * Obsidian calls a factory when it CONSTRUCTS a view, so "per call" only ever covered
	 * views opened AFTER the swap. An already-mounted one kept the previous root: its queries
	 * read an index that `VaultChangeAdapter` had stopped maintaining, `createProject` wrote
	 * under the previous default folder, and its `ProjectIndexRebuilt` subscription was on a
	 * bus nothing published to any more. Measured across a real `saveSettings`, all four.
	 *
	 * A REMOUNT rather than per-call resolution of every member, and the trade is worth
	 * stating: the bundle behind this reaches four repository ports and a lock set, so
	 * delegating member by member would be a second spelling of the whole surface and a
	 * standing place for it to drift. Obsidian's own `rebuildView` would do this in one call
	 * and is absent from the `obsidian` typings this project pins to `minAppVersion`, which
	 * is precisely what that pin is for. So the remount is spelled from the lifecycle this
	 * class already owns, out of public API alone.
	 *
	 * No-op when nothing is mounted: a closed view takes the new `deps` and mounts with them
	 * on its next `onOpen`.
	 *
	 * It goes back through `sync` rather than through `onClose`/`onOpen`, for the reason
	 * `PlanEditorView.rebind` gives: `sync` is the ONE place that decides what this view has
	 * mounted, and a second mounting decision beside it is what that method's own docblock
	 * exists to prevent. `unmount` clearing `mounted` is what then lets the SAME state through
	 * the guard, so the pane redraws the project it was already showing — `projectId` is this
	 * view's own field and a rebind never touches it.
	 */
	rebind(deps: RenovationProjectDeps): void {
		this.deps = deps;
		if (!this.mounted) return;
		this.unmount();
		this.sync();
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
	 * What Obsidian persists for this leaf, so reopening the app reopens the same project —
	 * PRD Epic 6's "Last Context" arriving as a consequence rather than as a feature.
	 *
	 * `''` rather than omitting the key, for the reason `PlanEditorView.getState` already
	 * gives: a key that is sometimes absent is a different shape to reason about. Here it also
	 * carries meaning — `''` IS the list.
	 */
	getState(): Record<string, unknown> {
		return { projectId: this.projectId ?? '' };
	}

	/**
	 * Called by Obsidian both when a leaf is restored and when `navigate` sets the state, and
	 * the ORDER relative to `onOpen` is not something a plugin gets to assume. Both route
	 * through one `sync()`.
	 *
	 * `result.history = true` is the entire reason the pane's back and forward arrows walk
	 * these navigations: `ViewStateResult.history` is documented as "there is a state change
	 * which should be recorded in the navigation history". `PlanEditorView` ignores its own
	 * `_result` and gets the same one-line win whenever it is next touched — listed in the
	 * spec's *Deliberately out of scope* so the register can see it, rather than left as a
	 * comment nothing schedules.
	 */
	setState(state: unknown, result: ViewStateResult): Promise<void> {
		const parsed = projectIdFrom(state);
		// Only an ACCEPTED, CHANGED state is a navigation. `ViewStateResult.history` is
		// documented as "there is a state change which should be recorded in the navigation
		// history", and an unconditional assignment claims one where there is none: a refused
		// parse (a layout this build does not recognise) and a `setState` naming the project
		// already open would each add a back entry that restores the state the pane is
		// already in, so the arrow appears to do nothing. Reported by a review bot against an
		// earlier draft of this step.
		if (parsed !== null && parsed.projectId !== this.projectId) result.history = true;
		if (parsed !== null) this.projectId = parsed.projectId;
		this.sync();
		return Promise.resolve();
	}

	/** Which state this view is showing: `null` is the LIST, a string is that project. */
	private projectId: string | null = null;

	/**
	 * The Vue app this view mounted, held only so `unmount` can unmount the same one. `null`
	 * between a close and the next open — Obsidian keeps the leaf and reuses the view.
	 *
	 * `vueApp` and not `app`: `View.app` is Obsidian's OWN member (the `App` instance), so
	 * the shorter name shadows it with an incompatible type and makes the whole class
	 * unassignable to `View` — `registerView`'s factory stops type-checking, three files
	 * away from the declaration. Invisible to the suite, which does not type-check; found by
	 * `vue-tsc` in `npm run build`.
	 */
	private vueApp: VueApp | null = null;

	/** Which state the currently mounted app was built for. */
	private mountedProjectId: string | null = null;

	/**
	 * Whether anything is mounted at all — and it is NOT redundant with
	 * `mountedProjectId !== null`. `null` is the list, a real state, so without this flag a
	 * first open (`null === null`) is skipped by the guard and the pane draws nothing.
	 * `PlanEditorView` needs no equivalent because there `null` means *nothing to draw*.
	 */
	private mounted = false;

	onOpen(): Promise<void> {
		// The hook the stylesheet keys on to reset Obsidian's own pane paddings
		// (styles/chrome.css) — on `containerEl`, because the padding lives on
		// `.view-content`, a descendant of it. Here rather than in `mount`: it is a fact about
		// the LEAF rather than about what is drawn in it, and a navigation must not have to
		// re-establish it. Idempotent across re-opens: Obsidian reuses this view, and
		// `addClass` is set-membership.
		this.containerEl.addClass('renovation-planner-container');
		this.sync();
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its
	 * effects alive against a detached tree and the next open would stack a second one.
	 * Emptying afterwards is what makes a re-open start from a clean pane; detaching the
	 * leaf instead would lose the user's layout, which is a recurring review rejection.
	 */
	onClose(): Promise<void> {
		this.unmount();
		this.contentEl.empty();
		return Promise.resolve();
	}

	/**
	 * The ONE place that decides what is mounted, so `onOpen`, `setState` and `rebind` cannot
	 * grow three answers to it — and the reason a restore whose `setState` follows `onOpen`
	 * mounts exactly once.
	 */
	private sync(): void {
		if (this.mounted && this.projectId === this.mountedProjectId) return;
		this.unmount();
		this.mount(this.projectId);
	}

	private mount(projectId: string | null): void {
		this.contentEl.empty();
		// One isolated app per ItemView with its OWN Pinia (ADR-004, SDD §12) rather than a
		// shared singleton.
		const app = createApp(ViewRoot);
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());
		// Provided BEFORE mount, the same order `PlanEditorView` uses: a component's setup
		// runs during `mount`, and `useRenovationProjectContext` throws if it runs before the
		// context is there to find.
		//
		// The bundle with THIS mount's `projectId` written over it. `RenovationProjectDeps` is
		// a plain bundle rather than a `(projectId) => deps` factory, and this is the shape
		// that fits it — the sibling's own pattern, since `PlanEditorView.mount` likewise
		// builds its context locally rather than asking the root for a per-mount one. Nothing
		// in `plugin/` changes, and `projectId` stays the VIEW's field, which is the property
		// that mattered.
		app.provide(RENOVATION_PROJECT_CONTEXT, { ...this.deps, projectId });
		// Onto `contentEl` itself, with no wrapper — see the class docblock's height chain.
		app.mount(this.contentEl);
		this.vueApp = app;
		this.mountedProjectId = projectId;
		this.mounted = true;
	}

	private unmount(): void {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.mountedProjectId = null;
		this.mounted = false;
	}
}
