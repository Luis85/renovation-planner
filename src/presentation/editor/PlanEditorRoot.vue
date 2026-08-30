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
import EditorToolbar from './shell/EditorToolbar.vue';
import InspectorPanel from './shell/InspectorPanel.vue';
import LayersPanel from './shell/LayersPanel.vue';
import StatusBar from './shell/StatusBar.vue';

const context = usePlanEditorContext();
// The return value is USED now, not discarded: `activeToolId` is what displaces the empty
// state and `setTool` is what the noZones action calls, and this is the same runtime object
// every tool and the toolbar already share.
const runtime = provideEditorRuntime(context);
const projectStore = useProjectStore();
const { status, error } = storeToRefs(projectStore);
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
 */
const overlay = computed(() => {
	const key = emptyStateKey.value;
	if (key === null || runtime.activeToolId.value !== null) return null;
	return resolveEmptyState(EMPTY_STATE_CONTENT.planEditor[key]);
});

/**
 * The one hand-off this slice wires, to the ONE entry point that already exists — never a
 * second, independently-decided path to the same effect (`CLAUDE.md`'s one-action-every-input
 * rule, applied to a new kind of input).
 *
 * Setting the tool rather than dispatching a command is deliberate: a Zone cannot be created
 * with zero user-supplied geometry, so there is no `CreateZoneCommand` call to make — the
 * correct action is putting the user in the same drawing mode the toolbar's own button would.
 *
 * `noBackground` has no button (settled at the top of this task): slice 5's picker is a
 * PLUGIN COMMAND, not a member of the editor's bundle, so there is nothing here to call that
 * would not be either a new seam or a reach for the global `app`.
 */
function onEmptyStateAction(): void {
	runtime.setTool('draw-polygon');
}

const root = ref<HTMLElement | null>(null);
const { tokens, refresh } = useThemeTokens(root);
const backgroundStatus = ref<BackgroundStatus>('none');

function hydrate(): void {
	void projectStore.hydrate(context.queries, context.planId);
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
		// **No action, and the reason is a missing SEAM rather than a decision that none is
		// wanted.** The state should offer a way out of the tab, and `PlanEditorContext` carries
		// no door to close a leaf — the view owns every Obsidian object the tree may not touch,
		// so adding one means widening that interface, and reaching for the global `app` instead
		// is what the marketplace rules refuse. Rendering the explanation without a control is
		// slice 14's own amendment applied here: a button that cannot do its job is worse than
		// no button. `editor.plan-missing.action` was added with this entry and REMOVED again
		// when the action was not wired, because an unused locale key reads as a control
		// somebody forgot to render.
		return {
			headline: tr('editor.plan-missing.headline'),
			body: tr('editor.plan-missing.body'),
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
		<EditorToolbar />
		<div class="rp-editor-body">
			<LayersPanel v-if="layersPanelOpen" />
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
			</PlanCanvas>
			<ViewFailure
				v-else-if="failure !== null"
				v-bind="failure"
				@action="hydrate()"
			/>
			<div
				v-else
				class="rp-editor-canvas-message"
			>
				<p>{{ tr('editor.loading') }}</p>
			</div>
			<InspectorPanel v-if="inspectorPanelOpen" />
		</div>
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
