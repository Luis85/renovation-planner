import { projectOriginFrom, type ProjectOrigin } from '../../application/navigation/ProjectDestination';
import { ItemView, Platform, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { createApp, watch, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import PlanEditorRoot from '../editor/PlanEditorRoot.vue';
import { useSaveStateStore } from '../editor/save-state/save-state-store';
import {
	PLAN_EDITOR_CONTEXT,
	type PlanEditorContext,
	type EditorNavigation,
	type DeviceStorage,
	type EditorViewPreferences,
} from '../editor/PlanEditorContext';
import type {
	PlanEditorCommandServices,
} from '../editor/planEditorCommands';
import type { BackgroundVault } from '../editor/layers/background/BackgroundRenderModel';
import type { EditorClipboard } from '../editor/clipboard/editorClipboard';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import { tr } from '../i18n/strings';
import { nextAppIdPrefix } from './app-id-prefix';
import { drawMobileRefusal } from './mobileRefusal';
import { notifyFault, notifyWarning } from '../notices/notify';
import type { ProjectOpenOutcome } from './RenovationProjectContext';

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
	readonly origin?: ProjectOrigin;
	/** See the field of the same name on the view — an open unrecovered-write incident. */
	readonly unrecoveredWrite: boolean;
}

/**
 * What the composition root hands in. The view never imports a repository: it sees the
 * query interface `presentation/` declares and a narrow slice of the Vault, both composed
 * in `plugin/`.
 */
export interface PlanEditorDeps {
	readonly navigation?: EditorNavigation;
	readonly queries: PlanEditorQueryServices;
	/** The write side the editor's tools dispatch through — see `planEditorCommands.ts`. */
	readonly commands: PlanEditorCommandServices;
	/**
	 * Opens THIS plan's own note (design spec §2.6) — the SAME `openProjectNote` the project
	 * view's `openProject` binds, because that function resolves any entity id through the
	 * index and a plan's note needs no second opener. The composition root knows the workspace
	 * and the index; this view has neither.
	 *
	 * `ProjectOpenOutcome` rather than a fourth declaration of the same three-member union:
	 * `AssetLibraryDeps.NoteOpenOutcome`'s own docblock names the THIRD copy in
	 * `presentation/` as the point past which the next author should share rather than repeat
	 * — there is no layer ban between two `presentation/` folders, only between this layer and
	 * `infrastructure/`.
	 */
	readonly openNote: (entityId: string) => Promise<ProjectOpenOutcome>;
	readonly vault: BackgroundVault;
	/**
	 * The ONE clipboard the plugin holds for every Plan Editor leaf. Required, so a composition
	 * that forgets it does not compile rather than giving each leaf a private clipboard.
	 */
	readonly clipboard: EditorClipboard;
	/** The side panels' per-device layout slot. Required, for `clipboard`'s reason. */
	readonly panelLayout: DeviceStorage;
	/** Grid and object-snap choices every leaf shares — see `PlanEditorContext.viewPreferences`. */
	readonly viewPreferences?: EditorViewPreferences;
	readonly onThemeChange: (listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "this Plan changed", filtered to one plan
	 * id. The composition root builds it from the `EventBus`, so the view never subscribes
	 * to an event type by name and `presentation/` never learns the vocabulary of
	 * `domain/plan/Plan.events.ts`.
	 */
	readonly onPlanChanged: (planId: string, listener: () => void) => () => void;
	/**
	 * Subscribe to the domain events that mean "some plan of this project changed", filtered
	 * to one project id — the same source the Renovation project view takes. Passed straight
	 * through rather than partially applied like the door above, because the view holds no
	 * project id: the root binds one once the plan has hydrated.
	 */
	readonly onProjectPlansChanged: (projectId: string, listener: () => void) => () => void;
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
	const origin = projectOriginFrom((state as Record<string, unknown>)['origin']);
	// A literal `true` and nothing else. Anything a hand-edited layout or another version of
	// this plugin left there reads as no incident, which is the only direction this value may
	// be wrong in cheaply: inventing one blocks a leaf nobody blocked.
	const unrecoveredWrite = (state as Record<string, unknown>)['unrecoveredWrite'] === true;
	return typeof planId === 'string' && planId.length > 0 ? { planId, unrecoveredWrite, ...(origin?.planId === planId ? { origin } : {}) } : null;
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
	 *
	 * `unrecoveredWrite` takes the OPPOSITE spelling — present only when there is an incident
	 * — because `false` is the absence of one and every reader of this state is already
	 * written to that: `revealPlanEditor`'s `{ planId }`, `planEditorCommands`' `getState()
	 * ['planId']`, and the cases that assert the whole object. It is what Obsidian persists,
	 * so an incident outlives a restart; that is the conservative direction and is deliberate
	 * (a dropped one would be an all-clear over a vault nobody repaired), and it is still not
	 * crash recovery — nothing here knows WHAT was left half-written.
	 */
	getState(): Record<string, unknown> {
		return {
			planId: this.planId ?? '',
			...(this.origin ? { origin: this.origin } : {}),
			...(this.unrecoveredWrite ? { unrecoveredWrite: true } : {}),
		};
	}

	/**
	 * Called by Obsidian both when a leaf is restored and when `revealPlanEditor` sets the
	 * state on a leaf it just created — and the ORDER relative to `onOpen` is not something
	 * a plugin gets to assume. Both therefore route through one `sync()`, which mounts when
	 * there is a plan to mount and does nothing when the plan has not changed. Deciding it
	 * in one place is what keeps a restore from mounting twice.
	 */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const parsed = planIdFrom(state);
		if (parsed?.origin && parsed.planId === this.mountedPlanId && this.root && !(await this.root.navigateToRecord(parsed.origin))) { result.history = false; return; }
		// The incident is OR-ed in and never assigned: `revealPlanEditor` sets `{ planId }` on a
		// leaf it created, and Obsidian re-enters here on a restore. Assigning would let either
		// arrival say "all clear" about a vault this view knows is half-written, and only a
		// write that actually succeeded may say that.
		if (parsed !== null) { this.planId = parsed.planId; this.origin = parsed.origin; if (parsed.unrecoveredWrite) this.unrecoveredWrite = true; }
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
	private origin: ProjectOrigin | undefined;

	/**
	 * **This leaf's open unrecovered-write incident — a write that landed half-way and whose
	 * compensation refused.** Here rather than in the Pinia store that still reports it,
	 * because `rebind` builds a fresh Pinia on every settings save: the flag lived for the
	 * MOUNT and a user who saved any preference — units, currency, verbose logging — with the
	 * warning on screen was shown an all-clear over a vault nobody had repaired (ruling R1,
	 * and `tests/plugin/rootSwapRebind.test.ts` pinned the loss before it pinned the fix).
	 *
	 * View-owned and per LEAF, the way `planId` above already is, and carried through the same
	 * `getState`/`setState`: Obsidian reuses this object across a rebind, so the field outlives
	 * the mount, and two Plan Editors on two plans still hold two incidents. Keying by view
	 * TYPE would collapse them.
	 *
	 * **Set, never unset.** `mount` seeds each new store from it and watches the store to learn
	 * about a new one; nothing here clears it, because only a write that actually succeeded may
	 * clear a save error and neither this view nor the store it seeds can tell a write that
	 * repaired the half-written rows from any other write that happened to land. A stale
	 * warning is cheaper than a false all-clear.
	 *
	 * **What it does NOT reach**, stated because the sentence is easy to widen: a SECOND Plan
	 * Editor leaf on the same plan, which has its own view, its own Pinia and its own gate, and
	 * is not gated by this one with or without a rebind. That is a pre-existing hole needing an
	 * affected-identity model, not this field.
	 */
	private unrecoveredWrite = false;

	/** Stops the mounted store's watcher — see `mount`. `null` while nothing is mounted. */
	private stopIncidentWatch: (() => void) | null = null;
	private root: { navigateToRecord: (origin: ProjectOrigin) => Promise<boolean> } | null = null;

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
		// The ONE place that decides what is mounted is the one place that can decide NOT to
		// (requirement extension 2a). Here rather than in `onOpen`, because `setState` reaches
		// `sync` too and Obsidian's order between the two is not a plugin's to assume — a guard in
		// `onOpen` alone would refuse and then mount the canvas anyway on the restore path.
		if (Platform.isMobile) {
			this.unmount();
			drawMobileRefusal(this.contentEl);
			return;
		}
		if (this.planId === null || this.planId === this.mountedPlanId) return;
		this.unmount();
		this.mount(this.planId);
	}

	private mount(planId: string): void {
		this.contentEl.empty();
		const host = this.contentEl.createDiv('renovation-plan-editor-view');
		const context: PlanEditorContext = {
			planId,
			initialNavigation: this.origin,
			navigation: this.deps.navigation,
			queries: this.deps.queries,
			commands: this.deps.commands,
			vault: this.deps.vault,
			clipboard: this.deps.clipboard,
			panelLayout: this.deps.panelLayout,
			viewPreferences: this.deps.viewPreferences,
			onThemeChange: this.deps.onThemeChange,
			onPlanChanged: (listener) => this.deps.onPlanChanged(planId, listener),
			// Passed straight through: the id it takes is a PROJECT's, which the root learns from the plan.
			onProjectPlansChanged: this.deps.onProjectPlansChanged,
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
			// §2.6: partially applied with THIS leaf's plan id, the same shape as `closeLeaf`
			// and `focusLeaf` above — the composition root composes services and knows nothing
			// about which leaf this is, so the leaf is what binds the id.
			openPlanNote: async () => {
				const outcome = await this.deps.openNote(planId);
				if (outcome === 'missing') notifyWarning(tr('editor.source-note-missing'));
				// 'failed' has already been reported once, inside the opener.
			},
		};

		const app = createApp(PlanEditorRoot);
		app.config.idPrefix = nextAppIdPrefix();
		const pinia = createPinia();
		app.use(pinia);
		// **Both directions of this leaf's incident, before anything in the tree reads the
		// store.** Seeding is what makes a rebind keep the warning; the watcher is what makes
		// the NEXT rebind keep one raised since. `withSaveStateTracking` is the only caller of
		// `markUnrecovered`, and it runs inside this app, so the store is where the view has to
		// hear about it — a callback on the context would be a second seam for one boolean.
		//
		// `flush: 'sync'` because a rebind is not required to give Vue a tick first, and a
		// watcher that had not run yet would seed the next mount from a stale field.
		const saveState = useSaveStateStore(pinia);
		if (this.unrecoveredWrite) saveState.markUnrecovered();
		this.stopIncidentWatch = watch(() => saveState.unrecoveredWrite, () => { this.unrecoveredWrite = true; }, { flush: 'sync' });
		// On the APP instance and not globally: each ItemView's Vue app is isolated
		// (ADR-004), and a global `app.use` at plugin scope would leak vue-konva's component
		// registration into every future view whether it draws a canvas or not.
		app.use(VueKonva);
		app.provide(PLAN_EDITOR_CONTEXT, context);
		this.root = app.mount(host) as unknown as { navigateToRecord: (origin: ProjectOrigin) => Promise<boolean> };

		this.vueApp = app;
		this.mountedPlanId = planId;
	}

	private unmount(): void {
		// Stopped for the reason the app is unmounted at all: the watcher holds the retired
		// store, and a second mount would otherwise leave one watcher per rebind alive.
		this.stopIncidentWatch?.();
		this.stopIncidentWatch = null;
		this.vueApp?.unmount();
		this.vueApp = null;
		this.root = null;
		this.mountedPlanId = null;
	}
}
