<script setup lang="ts">
/**
 * The Plan Editor's Vue root — §60's five regions, and the one component that hydrates.
 *
 * Hydration happens HERE and not in `PlanEditorView` so that the view stays what it is:
 * an Obsidian lifecycle object that mounts an app. The store's `hydrate` is the single
 * routine (slice 8 re-runs the same one after a committed command), and the context it
 * needs arrives through the one injection the view provides.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import { usePlanEditorContext } from './PlanEditorContext';
import { provideEditorRuntime } from './runtime';
import { useThemeTokens } from './theme/useThemeTokens';
import { useProjectStore } from '../stores/ProjectStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import DialogHost from '../dialogs/DialogHost.vue';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import PlanCanvas from './PlanCanvas.vue';
import EditorContextBar from './shell/EditorContextBar.vue';
import FloatingPrimaryActions from './shell/FloatingPrimaryActions.vue';
import InspectorPanel from './shell/InspectorPanel.vue';
import PropertyLayerPanel from './shell/PropertyLayerPanel.vue';
import StatusBar from './shell/StatusBar.vue';

const context = usePlanEditorContext();
// The return value is USED now, not discarded: `activeToolId` is what displaces the empty
// state and `setTool` is what the noZones action calls, and this is the same runtime object
// every tool, the context bar and the floating Select/Add group already share.
const runtime = provideEditorRuntime(context);
const projectStore = useProjectStore();
const { status, error, stale, unreadableZones, plan } = storeToRefs(projectStore);
const { layersPanelOpen, inspectorPanelOpen } = storeToRefs(useWorkspaceStore());
const { emptyStateKey } = storeToRefs(projectStore);

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
	return resolveEmptyState(EMPTY_STATE_CONTENT.planEditor[key]);
});

/**
 * The one hand-off this slice wires, to the ONE entry point that already exists — never a
 * second, independently-decided path to the same effect (`CLAUDE.md`'s one-action-every-input
 * rule, applied to a new kind of input).
 *
 * Setting the tool rather than dispatching a command is deliberate: a Zone cannot be created
 * with zero user-supplied geometry, so there is no `CreateZoneCommand` call to make — the
 * correct action is putting the user in the same drawing mode `runtime.setTool('draw-polygon')`
 * always would (Task 13 retired the toolbar button that used to make this call; nothing in the
 * shell offers Draw zone directly today).
 *
 * `noBackground` has no button (settled at the top of this task): slice 5's picker is a
 * PLUGIN COMMAND, not a member of the editor's bundle, so there is nothing here to call that
 * would not be either a new seam or a reach for the global `app`.
 */
function onEmptyStateAction(): void {
	runtime.setTool('draw-polygon');
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
	>
		<EditorContextBar />
		<div class="rp-editor-body">
			<PropertyLayerPanel
				v-if="layersPanelOpen"
				:plan="plan"
			/>
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
			>
				<EmptyState
					v-if="overlay !== null"
					v-bind="overlay"
					overlay
					@action="onEmptyStateAction()"
				/>
				<!-- Task 18 replaces this handler with the real Add menu. -->
				<FloatingPrimaryActions @open-add="() => {}" />
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
			<InspectorPanel v-if="inspectorPanelOpen" />
		</div>
		<!--
			ADDITIVE, and never the in-place failure state, because the canvas is showing valid
			data. `withEditorStateRefresh` re-reads after a successful write with
			`keepPreviousOnFailure`, so a failed read-back leaves `status === 'ready'` with the
			PRE-command scene still drawn and an `error` set. Replacing that with a failure panel
			would hide a plan the user can still work on, to report a read that failed; saying
			nothing left the indicator reading Saved over a canvas quietly out of date. A strip
			that persists while the condition does is the shape that fits — the same one the two
			background notices already use. Reported by a review bot.

			**Its own `v-if`, and NOT a link in the chain below it, which is how it first
			shipped.** The two background notices are alternatives to each other — a background
			is missing or unreadable, never both — so they are one chain. Staleness is an
			independent fact about a re-READ, and chaining it in front meant a failed read-back
			suppressed the sentence explaining why the background was absent: two unrelated
			failures, one of them silently swallowing the other, and the survivor being the one
			that says nothing about the background. Also reported by a review bot.
		-->
		<p
			v-if="staleAfterRefresh"
			class="rp-editor-notice"
			role="status"
		>
			{{ tr('editor.refresh-failed') }}
		</p>
		<!--
			Its OWN `v-if`, never chained into the background `v-if`/`v-else-if` below, for the
			reason the block above already paid for: "some zones could not be read" and "this
			plan's background is missing" are independent facts, and a plan can have both. As a
			link in that chain, one of them silently swallows the other — measured, by making it
			one and watching `unreadableZonesNotice.test.ts`'s third case go red.
		-->
		<p
			v-if="unreadableZones > 0"
			class="rp-editor-notice"
			role="status"
		>
			{{ tr('editor.some-zones-unreadable', { count: String(unreadableZones) }) }}
		</p>
		<p
			v-if="backgroundStatus === 'missing'"
			class="rp-editor-notice"
			role="status"
		>
			{{ tr('editor.background-missing') }}
		</p>
		<p
			v-else-if="backgroundStatus === 'unreadable'"
			class="rp-editor-notice"
			role="status"
		>
			{{ tr('editor.background-failed') }}
		</p>
		<StatusBar :active-tool-id="runtime.activeToolId.value" />
		<!--
			Last child, and a sibling of the five regions rather than nested in one: the host
			makes its parent's OTHER children inert while a dialog is open, so every region
			has to be a sibling of it for the background to actually go inert.
		-->
		<DialogHost />
	</div>
</template>
