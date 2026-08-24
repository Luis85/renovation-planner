<script setup lang="ts">
/**
 * The Plan Editor's Vue root — §60's five regions, and the one component that hydrates.
 *
 * Hydration happens HERE and not in `PlanEditorView` so that the view stays what it is:
 * an Obsidian lifecycle object that mounts an app. The store's `hydrate` is the single
 * routine (slice 8 re-runs the same one after a committed command), and the context it
 * needs arrives through the one injection the view provides.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { useEditorContext } from './EditorContext';
import { useThemeTokens } from './theme/useThemeTokens';
import { useProjectStore } from '../stores/ProjectStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import PlanCanvas from './PlanCanvas.vue';
import EditorToolbar from './shell/EditorToolbar.vue';
import InspectorPanel from './shell/InspectorPanel.vue';
import LayersPanel from './shell/LayersPanel.vue';
import StatusBar from './shell/StatusBar.vue';

const context = useEditorContext();
const projectStore = useProjectStore();
const { status } = storeToRefs(projectStore);
const { layersPanelOpen, inspectorPanelOpen } = storeToRefs(useWorkspaceStore());

const root = ref<HTMLElement | null>(null);
const { tokens, refresh } = useThemeTokens(root);
const backgroundStatus = ref<BackgroundStatus>('none');

function hydrate(): void {
	void projectStore.hydrate(context.queries, context.planId);
}

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
			/>
			<div
				v-else
				class="rp-editor-canvas-message"
			>
				<p v-if="status === 'missing'">
					{{ tr('editor.plan-missing') }}
				</p>
				<p v-else-if="status === 'failed'">
					{{ tr('editor.plan-failed') }}
				</p>
				<p v-else>
					{{ tr('editor.loading') }}
				</p>
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
		<StatusBar />
	</div>
</template>
