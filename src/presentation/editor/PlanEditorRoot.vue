<script setup lang="ts">
/**
 * The Plan Editor's Vue root — §60's five regions, and the one component that hydrates.
 *
 * Hydration happens HERE and not in `PlanEditorView` so that the view stays what it is:
 * an Obsidian lifecycle object that mounts an app. The store's `hydrate` is the single
 * routine (slice 8 re-runs the same one after a committed command), and the context it
 * needs arrives through the one injection the view provides.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import { usePlanEditorContext } from './PlanEditorContext';
import { provideEditorRuntime } from './runtime';
import { useThemeTokens } from './theme/useThemeTokens';
import { useProjectStore } from '../stores/ProjectStore';
import { useSaveStateStore } from './save-state/save-state-store';
import DialogHost from '../dialogs/DialogHost.vue';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { activateCreationEntry } from './add/creationCatalogue';
import PlanCanvas from './PlanCanvas.vue';
import EditorContextBar from './shell/EditorContextBar.vue';
import FloatingPrimaryActions from './shell/FloatingPrimaryActions.vue';
import EntityInspector from './shell/EntityInspector.vue';
import PersistentWarningStrip from './shell/PersistentWarningStrip.vue';
import PropertyLayerPanel from './shell/PropertyLayerPanel.vue';
import ResponsiveEditorShell from './shell/ResponsiveEditorShell.vue';
import SelectionGuidance from './shell/SelectionGuidance.vue';
import StatusBar from './shell/StatusBar.vue';
import { editorWarnings } from './shell/warnings';
import AddMenu from './add/AddMenu.vue';
import TemporaryToolBanner from './shell/TemporaryToolBanner.vue';
import { useSelectionStore } from './selection/selection-store';
import { routeEscape } from './escapeRouting';

const context = usePlanEditorContext();
// The return value is USED now, not discarded: `activeToolId` is what displaces the empty
// state and `setTool` is what the noZones action calls, and this is the same runtime object
// every tool, the context bar and the floating Select/Add group already share.
const runtime = provideEditorRuntime(context);
const projectStore = useProjectStore();
const selection = useSelectionStore();
const { status, error, stale, unreadableZones, plan, refreshing, retriesFailed } = storeToRefs(projectStore);
const { emptyStateKey } = storeToRefs(projectStore);
const { unrecoveredWrite } = storeToRefs(useSaveStateStore());

/**
 * The overlay's props, or `null` for no overlay.
 *
 * Two gates answering different questions. `emptyStateKey` is "is this plan legitimately
 * empty", decided from query results alone. `activeToolId` is "is the user mid-task", and it
 * is checked HERE rather than in the selector because it is a rendering rule: a panel still
 * floating over the canvas after its own button activated the draw tool would leave the user
 * in a mode they cannot reach the stage in.
 *
 * **`null` is not the only tool this yields to any more.** Design spec §7.3/task 10 made
 * Select the tool armed the moment a plan becomes ready — the safe default camera mode used
 * to be — so treating EVERY non-null tool as "mid-task" would hide this overlay the instant
 * any plan finished hydrating, whether it has anything to show or not: measured, every case in
 * `emptyStateOverlay.test.ts` but the two that assert nothing about the overlay went red the
 * day Select stopped being `null`. A CREATION tool is what places the user mid-gesture; Select
 * is the resting state Task 10 gave this editor in place of camera mode, so it yields the
 * overlay no more than camera mode itself ever did.
 */
const overlay = computed(() => {
	const key = emptyStateKey.value;
	const tool = runtime.activeToolId.value;
	if (key === null || (tool !== null && tool !== 'select')) return null;
	// Reference onboarding must not obscure selected geometry or its focus badges.
	if (key === 'noBackground' && selection.selectedIds.length > 0) return null;
	return resolveEmptyState(EMPTY_STATE_CONTENT.planEditor[key]);
});

/**
 * The empty state's one hand-off, through `activateCreationEntry` — Task 10's ONE door onto a
 * catalogue entry's `activate`, shared with the Add menu's own click/keyboard activation
 * (`AddMenu.vue`). Never `runtime.setTool(...)` directly here: a second, independently-decided
 * route to the room tool is exactly what `CLAUDE.md`'s one-action-every-input rule refuses, and
 * `creationCatalogue.test.ts` reads this file's own source text to hold that (see its
 * `PlanEditorRoot.vue's empty-state action goes through activateCreationEntry` case).
 *
 * Arming a tool rather than dispatching a command is deliberate: a Zone cannot be created with
 * zero user-supplied geometry, so there is no command call to make here at all — the correct
 * action is putting the user in the drawing mode the catalogue entry names (Task 13 retired the
 * toolbar button that used to make this call directly; nothing else in the shell offers it).
 *
 * `noBackground` has no button (settled at the top of this task): slice 5's picker is a
 * PLUGIN COMMAND, not a member of the editor's bundle, so there is nothing here to call that
 * would not be either a new seam or a reach for the global `app`.
 *
 * **Returns early while `runtime.writesBlocked`** (design spec §2.9): the button stays
 * `aria-disabled` rather than `:disabled` so it is still focusable and its reason still
 * readable, and the GATE is here rather than trusted to the attribute alone — a control that
 * only looks paused is not a control that pauses.
 */
function onEmptyStateAction(): void {
	if (runtime.writesBlocked.value) return;
	activateCreationEntry('room', runtime);
}

/**
 * The canvas is drawing data it can no longer confirm.
 *
 * `ProjectStore.hydrate(..., { keepPreviousOnFailure: true })` — which is how every post-command
 * refresh reads back — deliberately keeps `status === 'ready'` and the previous scene when the
 * read fails. Nothing rendered that, so the write succeeded, the indicator said Saved, and the
 * canvas silently showed pre-command geometry.
 *
 * `'ready'` is the whole point of the guard: any other status is already replaced by the
 * failure state, and this exists only for the case where there IS content to keep showing.
 *
 * **It reads `stale` and not `error`, which is the correction of three findings rather than
 * one.** `error` means "why is there nothing to show" — `fail()` sets it beside `plan = null` —
 * and this needs "what is on screen is real but may be out of date". Reading the first as the
 * second made the strip withdraw for the length of any in-flight read, including the plain
 * `hydrate()` this file subscribes to `onPlanChanged` below. `ProjectStore.stale` states that
 * lifetime once; see its declaration.
 */
const staleAfterRefresh = computed(() => status.value === 'ready' && stale.value);

const root = ref<HTMLElement | null>(null);
const { tokens, refresh } = useThemeTokens(root, context.onThemeChange);
const backgroundStatus = ref<BackgroundStatus>('none');

/**
 * Task 20's keyed collection over the facts the shell used to read independently — see
 * `editorWarnings`' own header for the fixed order and why the collection replaced four
 * separate `v-if`s. Task 9 widens the input with the trust path's own facts
 * (`unrecoveredWrite`, `refreshing`, `retriesFailed`) and the two callbacks every action here
 * dispatches through: `retry` is `runtime.refreshProjection` and nothing else (§2.3 — a
 * retry re-reads, it cannot replay a write, because this closure takes no command), and
 * `openSourceNote` is `runtime.openPlanNote`, forwarded from the context so every row's
 * action reaches the same door `EditorContextBar`'s own note-opening affordance would.
 */
const warnings = computed(() =>
	editorWarnings({
		unrecoveredWrite: unrecoveredWrite.value,
		stale: staleAfterRefresh.value,
		refreshing: refreshing.value,
		retriesFailed: retriesFailed.value,
		unreadableZones: unreadableZones.value,
		backgroundStatus: backgroundStatus.value,
		retry: () => void runtime.refreshProjection(),
		openSourceNote: () => void runtime.openPlanNote(),
	}),
);

/**
 * Task 17's Add menu — owned HERE rather than by `FloatingPrimaryActions`, for the same
 * reason `DialogHost` sits at this level and not inside whatever opens a dialog: design spec
 * §6.3 puts the menu-open Escape precedence at this ROOT (`onRootKeydown` below, capture
 * phase) so the menu closes before the canvas's own `EditorSurface.onKeyDown` ever sees the
 * key, and a component nested inside the button that opens it could not sit ABOVE that button
 * in the DOM the way focus return and an outside-click check both need.
 *
 * `addButton` is resolved from the DOM at the moment Add is pressed rather than held as a
 * template ref on `FloatingPrimaryActions` itself: that component's job is the two buttons,
 * not exposing its internals to a parent, and by the time this handler runs the button is
 * already in the DOM — `FloatingPrimaryActions` only mounts once `PlanCanvas` does, which is
 * the same `status === 'ready'` gate this handler's own caller is behind. `root` is cast
 * rather than optional-chained for the same reason: it is this component's own outermost
 * element, bound unconditionally before any button inside it could be clickable, so there is
 * nothing left for that branch to decide — see `AddMenu.vue`'s own casts for the same shape.
 */
const addMenuOpen = ref(false);
const addButton = ref<HTMLElement | null>(null);

function onOpenAdd(): void {
	addButton.value = (root.value as HTMLElement).querySelector<HTMLElement>('[data-rp-action="add"]');
	addMenuOpen.value = !addMenuOpen.value;
}

/**
 * The menu-open Escape precedence, §6.3 — bound CAPTURE on this component's own root rather
 * than on `document`: capture runs top-down, ahead of anything a descendant's own `keydown`
 * listener (the canvas's `EditorSurface.onKeyDown`, or a focused control inside the shell)
 * could do with the same key, and it reaches only THIS editor leaf's tree rather than every
 * Plan Editor leaf a document-global handler would also close.
 *
 * With the menu closed, descendants handle their own Escape first. The root's bubbling
 * handler supplies the multi-selection fallback for controls outside the canvas.
 */
function onRootKeydown(event: KeyboardEvent): void {
	if (!addMenuOpen.value || event.key !== 'Escape') return;
	event.stopPropagation();
	event.preventDefault();
	addMenuOpen.value = false;
}

/** Overlays and the canvas consume Escape first; list and rail controls bubble here. */
function onSelectionKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || selection.selectedIds.length < 2) return;
	event.stopPropagation();
	event.preventDefault();
	const inspector = (event.target as HTMLElement).closest<HTMLElement>('[data-rp-region="inspector"]');
	const outcome = routeEscape({
		panning: false, // The canvas consumes its camera/gesture keys before bubbling.
		activeToolId: runtime.activeToolId.value,
		hasDraft: () => runtime.toolManager.activeToolHasDraft(),
		cancelGesture: () => runtime.toolManager.cancelGesture(),
		setTool: runtime.setTool,
		hasSelection: true,
		clearSelection: () => selection.clear(),
	});
	// M11 controls unmount on clear; persistent list/rail controls keep their own focus.
	if (outcome === 'cleared-selection' && inspector !== null) void nextTick(() => inspector.focus());
}

/**
 * The Add-menu state does not outlive the canvas subtree that anchored it. `ResponsiveEditorShell`
 * removes the `#canvas` slot outright below the floor width (its own `slot v-if`), which unmounts
 * `AddMenu` and the button `addButton` points at without ever touching the state held here — so
 * widening the pane back out used to remount the menu against a button already gone. Both fields
 * reset together: a stale `addButton` is exactly as unusable as a stale `addMenuOpen`.
 */
function retireAddMenu(): void {
	addMenuOpen.value = false;
	addButton.value = null;
}

function hydrate(): void {
	void projectStore.hydrate(context.queries, context.planId);
}

/**
 * The failure state's one button, which means two different things.
 *
 * A plan that could not be READ is retryable — the query really tried and may succeed on a
 * second attempt. A plan that is GONE is not: `GetPlan` succeeded and reported an absence, so
 * re-running it answers the same thing, and the useful action is to close the tab.
 *
 * Branching HERE rather than emitting two events, because `ViewFailure` is deliberately generic
 * (resolved strings in, one `action` out) and teaching it which of its callers means what would
 * make it this slice's component rather than any view's.
 */
function onFailureAction(): void {
	if (status.value === 'missing') context.closeLeaf();
	else hydrate();
}

/**
 * The two states that replace the canvas with a reason, or `null` for loading — design slice
 * 17's answer to BOTH cases slice 14 deferred to it, which land in the same slot and are not
 * the same thing.
 *
 * **`missing` is not an error at all**, and that is the distinction worth keeping. `GetPlan`
 * SUCCEEDED and correctly reported that no plan resolves — this tab points at something that
 * is gone. It reaches `surfaceFor` never, which `planEditorDangling.test.ts` pins as an
 * absence, because an absence nothing asserts is indistinguishable from an omission. So it
 * carries its own body rather than a mapped one; there is no `AppError` to map.
 *
 * **`failed` used to say ONE fixed sentence**, `editor.plan-failed`, so unrecovered settings
 * and a vault fault told the user the same thing. Slice 11 fixed exactly that defect in the
 * Renovation Project view and it was never carried here. `trError` is the fix, and it makes
 * this view's copy behave like that one's.
 *
 * The retry follows the same rule as `ViewRoot`'s and through the same function: a query that
 * really tried can be re-run, and a session that composed no query services cannot.
 */
const failure = computed(() => {
	if (status.value === 'missing') {
		// **The action closes the tab, and it is the only useful one.** There is nothing to
		// retry: `GetPlan` succeeded and reported that no plan resolves, so the plan is not
		// coming back and re-running the query would answer the same thing. What the user can
		// do is stop looking at a tab that points at nothing.
		//
		// This shipped with NO action for one commit, because `PlanEditorContext` carried no
		// door to close a leaf and reaching for the global `app` is what the marketplace rules
		// refuse. `closeLeaf` is that door — a narrow callback the VIEW partially applies from
		// its own `WorkspaceLeaf`, the same shape `onPlanChanged` already had.
		return {
			headline: tr('editor.plan-missing.headline'),
			body: tr('editor.plan-missing.body'),
			actionLabel: tr('editor.plan-missing.action'),
		};
	}
	const failed = error.value;
	if (status.value !== 'failed' || failed === null) return null;
	const session = surfaceFor(failed, viewHydrationOrigin(failed)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'editor.plan-failed.headline'),
		body: trError(failed),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

onMounted(() => {
	// Re-resolved against the real root element now that there is one; the setup-time
	// value came from the document, which is right for a first paint and not for a theme
	// that scopes its variables.
	refresh();
	hydrate();
});

// The SAME routine on both occasions — open, and this plan changing underneath the view.
// A second "refresh" path would be a second answer to what the canvas is showing.
onBeforeUnmount(context.onPlanChanged(hydrate));
</script>

<template>
	<div
		ref="root"
		class="renovation-plan-editor"
		@keydown.capture="onRootKeydown"
		@keydown="onSelectionKeydown"
	>
		<!--
			The layout is `ResponsiveEditorShell`'s (Task 19, design spec §5.4) and the CONTENT
			of each region is still this component's: what the canvas region draws — a canvas, a
			failure, a loading line — is a question about hydration, which is what this file
			owns, and the shell only decides where that region goes and whether the pane is wide
			enough for one at all.
		-->
		<ResponsiveEditorShell>
			<template #context-bar>
				<EditorContextBar />
			</template>
			<template #panel>
				<PropertyLayerPanel :plan="plan" />
			</template>
			<template #canvas>
				<!--
					The canvas is mounted only once there is a Plan to draw. A Konva stage over a
					plan that is still loading, or over one that does not exist, would size itself,
					bind a camera and draw an empty scene indistinguishable from a plan with no
					zones — which is the state slice 14's empty states exist to tell apart.
				-->
				<PlanCanvas
					v-if="status === 'ready'"
					:tokens="tokens"
					@background-status="(next) => (backgroundStatus = next)"
					@vue:unmounted="retireAddMenu"
				>
					<EmptyState
						v-if="overlay !== null"
						v-bind="overlay"
						overlay
						:action-disabled="runtime.writesBlocked.value"
						:action-described-by="runtime.writesBlocked.value ? runtime.pausedReasonId : undefined"
						@action="onEmptyStateAction()"
					/>
					<TemporaryToolBanner />
					<FloatingPrimaryActions
						:add-open="addMenuOpen"
						@open-add="onOpenAdd"
					/>
					<AddMenu
						v-if="addMenuOpen"
						:anchor="addButton"
						@close="addMenuOpen = false"
					/>
				</PlanCanvas>
				<ViewFailure
					v-else-if="failure !== null"
					v-bind="failure"
					@action="onFailureAction()"
				/>
				<div
					v-else
					class="rp-editor-canvas-message"
				>
					<p>{{ tr('editor.loading') }}</p>
				</div>
			</template>
			<template #inspector>
				<EntityInspector />
			</template>
			<template #warnings>
				<!--
					ADDITIVE, and never the in-place failure state, because the canvas is showing valid
					data. `withEditorStateRefresh` re-reads after a successful write with
					`keepPreviousOnFailure`, so a failed read-back leaves `status === 'ready'` with the
					PRE-command scene still drawn and an `error` set. Replacing that with a failure panel
					would hide a plan the user can still work on, to report a read that failed; saying
					nothing left the indicator reading Saved over a canvas quietly out of date. A strip
					that persists while the condition does is the shape that fits.

					Task 20 collapsed what used to be four independent `<p class="rp-editor-notice">`
					blocks — each with its own `v-if`, none sharing an identity Vue could track — into
					`editorWarnings`, one pure derivation of the same three facts, rendered by
					`PersistentWarningStrip` keyed on `w.id`. The independence those four blocks were
					careful to keep (a review bot's own finding: chaining staleness in front of the
					background notices let a failed read-back silently swallow the sentence explaining
					an absent background) is now a property of `editorWarnings`' fixed order rather than
					of four separate template conditions agreeing not to chain.


					SelectionGuidance mounts here too, BEFORE the strip (R15,
					[[Selection clearing is silent while the constrained Inspector is closed]]): this
					region exists in every layout mode, where EntityInspector does not — the
					constrained drawer unmounts it while closed, and a watcher that is not mounted
					hears nothing.
				-->
				<!--
					Design spec §2.9: the ONE hidden sentence every paused control's `aria-describedby`
					points at, minted here as `runtime.pausedReasonId` (one `useId()` per leaf) and
					rendered only while `runtime.writesBlocked` — a reference naming an id no element
					carries is what axe reports as `aria-valid-attr-value`, so the two share this one
					`v-if` rather than the sentence being always in the DOM.
				-->
				<p
					v-if="runtime.writesBlocked.value"
					:id="runtime.pausedReasonId"
					class="rp-visually-hidden"
				>
					{{ tr('editor.paused.reason') }}
				</p>
				<SelectionGuidance />
				<PersistentWarningStrip :warnings="warnings" />
			</template>
			<template #status>
				<StatusBar :active-tool-id="runtime.activeToolId.value" />
			</template>
		</ResponsiveEditorShell>
		<!--
			Last child, and a sibling of the SHELL rather than nested inside one of its regions:
			the host makes its parent's OTHER children inert while a dialog is open, so the whole
			shell — every region at once — is what has to be its sibling for the background to
			actually go inert. It sat beside the five regions until Task 19 moved them one level
			down into `ResponsiveEditorShell`; the rule is unchanged and now covers them in one.
		-->
		<DialogHost />
	</div>
</template>
