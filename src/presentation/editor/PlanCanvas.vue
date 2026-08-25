<script setup lang="ts">
/**
 * The Konva stage: §17's seven layers in their fixed order, sized to the pane, with the
 * baseline camera on top.
 *
 * **Pan and zoom are a camera, not an `EditorTool`.** §57 lists a `PanTool` among the
 * initial tools, which is slice 6's framework — but the read-only view this slice must
 * deliver needs a camera before any tool exists to select, and an always-on wheel-zoom
 * regardless of active tool is what this class of editor does. Slice 6's `PanTool`, if it
 * is built as a selectable mode at all, shares this same `Viewport` and these same
 * functions; it does not change how panning works.
 *
 * Every layer sets `listening: false`. There is no interactive tool yet to receive pointer
 * events, and per §62 an inert hit graph on layers nothing interacts with is pure cost —
 * Konva would maintain a second, hidden canvas per layer for nothing. Slice 6 turns
 * listening on selectively, per node, without restructuring this list. The camera itself
 * therefore listens on the DOM container rather than on the Stage, which is also what lets
 * it keep working once individual nodes start listening.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import type { ThemeTokens } from './theme/themeTokens';
import { screenPoint, screenToWorld, viewportTransform, STAGE_PIXELS, type ScreenPoint } from './viewport/Viewport';
import type { EditorPointerEvent } from './tools/editor-tool';
import { useEditorRuntime } from './runtime';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import BackgroundLayer from './layers/background/BackgroundLayer.vue';
import EmptyLayer from './layers/EmptyLayer.vue';
import InteractionLayer from './layers/InteractionLayer.vue';
import ZoneLayer from './layers/zone/ZoneLayer.vue';

const props = defineProps<{ tokens: ThemeTokens }>();
const emit = defineEmits<{ backgroundStatus: [status: BackgroundStatus] }>();

const editor = useEditorStore();
const workspace = useWorkspaceStore();
const runtime = useEditorRuntime();
const { viewport } = storeToRefs(editor);
const { layerVisibility } = storeToRefs(workspace);

const container = ref<HTMLElement | null>(null);
const size = ref({ width: 0, height: 0 });

const transform = computed(() => viewportTransform(viewport.value));
const stageConfig = computed(() => ({ width: size.value.width, height: size.value.height }));

/** How fast a wheel notch zooms. Exponential, so the feel is the same at every scale. */
const WHEEL_SENSITIVITY = 0.002;
/** One `+`/`-` press. A ratio rather than an increment, for the same reason. */
const KEY_ZOOM_STEP = 1.2;

/**
 * A pointer position as a `ScreenPoint` in the STAGE's own coordinate space.
 *
 * Measured from the container's bounding rect rather than taken from `offsetX`/`offsetY`,
 * which are relative to whatever element the event happened to land on — the canvas, or
 * the container when the canvas has not been laid out yet — and would silently disagree
 * between the two.
 */
function stagePoint(event: { clientX: number; clientY: number }) {
	const rect = container.value?.getBoundingClientRect();
	return screenPoint(event.clientX - (rect?.left ?? 0), event.clientY - (rect?.top ?? 0));
}

function onWheel(event: WheelEvent): void {
	// The pane scrolls otherwise, and a plan editor that scrolls its own leaf away on the
	// first zoom is the defect this one line prevents.
	//
	// It is also why Chrome logs `[Violation] Added non-passive event listener to a
	// scroll-blocking 'wheel' event` when this canvas mounts. That line is the cost of this
	// one, not a defect to clear: `preventDefault()` is INERT in a passive listener, so
	// marking the handler passive — which is what the message suggests — would trade the
	// console line for a plan editor that scrolls itself away on every zoom. Declaring
	// `{ passive: false }` explicitly does not silence it either; Chrome reports the
	// listener being non-passive at all.
	event.preventDefault();
	editor.zoomAt(stagePoint(event), viewport.value.zoom * Math.exp(-event.deltaY * WHEEL_SENSITIVITY));
}

/**
 * Design slice 8's routing rule: with a TOOL active, primary-button pointer events go to
 * `ToolManager` and the camera keeps only wheel/key zoom; with none (camera mode) drag
 * pans exactly as slice 5 shipped. One conversion here — DOM event to
 * `EditorPointerEvent`, world point through `screenToWorld` — so no tool performs its own
 * pixel math (ADR-009).
 */
function editorPointerEvent(event: PointerEvent, at: ScreenPoint): EditorPointerEvent {
	return {
		worldPoint: screenToWorld(at, viewport.value, STAGE_PIXELS),
		screenPoint: at,
		// `PointerEvent.button` is `-1` on a `pointermove` — the spec's "no button changed
		// state" — so it is NOT a reading of what is currently held down. Only 1 and 2 are
		// mapped away from `primary`, which keeps a move during a primary drag reading as
		// the primary gesture it is; `buttons` is the bitmask a tool would need for the
		// held-down question, and nothing asks it yet.
		button: event.button === 1 ? 'auxiliary' : event.button === 2 ? 'secondary' : 'primary',
		modifiers: { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, alt: event.altKey },
		targetId: null,
	};
}

// Primary button only, in BOTH directions and in both modes: the middle button is
// paste-on-Linux and the right one is the context menu, and claiming either would take a
// gesture the host owns.
//
// Down and up take the SAME test on purpose. A mouse shares one `pointerId` across its
// buttons, so filtering `pointerdown` while forwarding every `pointerup` handed tools a
// release with no matching press — the impossible event grammar this project has already
// recorded once as a test-rig defect, here in production code — and `SelectTool`
// obligingly committed a half-finished move for it.
//
// What actually PREVENTS that is the tool's own `event.button !== 'primary'` guard, which
// is where a category invariant belongs: at the forbidden thing, so it holds for tools not
// yet written. This filter is the symmetry that keeps the grammar valid in the first place,
// and it is not independently checked — `tests/presentation/editor/zoneEditing.test.ts`
// pins the composite behaviour, and removing either half alone still passes.
function isPrimary(event: PointerEvent): boolean {
	return event.button === 0;
}

function onPointerDown(event: PointerEvent): void {
	if (!isPrimary(event)) return;
	const at = stagePoint(event);
	// Capture, so a drag that leaves the pane still ends when the button does — without it
	// the camera keeps panning after the pointer comes back, which reads as the view being
	// stuck to the cursor.
	(event.target as Element).setPointerCapture?.(event.pointerId);
	if (runtime.activeToolId.value !== null) {
		runtime.toolManager.pointerDown(editorPointerEvent(event, at));
		return;
	}
	editor.beginPan(at);
}

function onPointerMove(event: PointerEvent): void {
	const at = stagePoint(event);
	editor.setPointer(at);
	if (runtime.activeToolId.value !== null) {
		runtime.toolManager.pointerMove(editorPointerEvent(event, at));
		return;
	}
	editor.continuePan(at);
}

function onPointerUp(event: PointerEvent): void {
	if (runtime.activeToolId.value !== null) {
		if (isPrimary(event)) runtime.toolManager.pointerUp(editorPointerEvent(event, stagePoint(event)));
		return;
	}
	editor.endPan();
}

/**
 * The pointer was taken away rather than released — the browser claiming a touch gesture
 * for scrolling, the OS grabbing it on an alt-tab or a window drag. No `pointerup` will
 * ever arrive, so whatever the active tool is holding has to be abandoned here or it
 * outlives the gesture: `SelectTool` kept redrawing a translated preview with no button
 * held, and the user's NEXT click anywhere committed a move by the delta between the
 * abandoned start and that unrelated click. The camera already had its equivalent in
 * `onPointerLeave`; the tool path had none.
 */
function onPointerCancel(): void {
	runtime.toolManager.cancelGesture();
	editor.endPan();
	editor.setPointer(null);
}

function onPointerLeave(): void {
	editor.endPan();
	editor.setPointer(null);
}

/**
 * §85 asks for keyboard-accessible controls, and zoom is the one interaction this slice
 * adds — so it is reachable by key as well as by wheel. Anchored at the middle of the
 * stage, since there is no pointer involved in a keypress. `Escape` abandons the active
 * tool's in-flight gesture (`ToolManager.cancelGesture` is a safe no-op when there is
 * none).
 */
function onKeyDown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		runtime.toolManager.cancelGesture();
		return;
	}
	const factor = event.key === '+' || event.key === '=' ? KEY_ZOOM_STEP : event.key === '-' ? 1 / KEY_ZOOM_STEP : null;
	if (factor === null) return;
	event.preventDefault();
	editor.zoomByFactor(screenPoint(size.value.width / 2, size.value.height / 2), factor);
}

/**
 * The stage is sized from its container, never fixed: the Plan Editor fills its leaf, and
 * a leaf is resized by dragging a split, collapsing a sidebar or resizing the window —
 * none of which fires a `resize` on `window` in a way a pane can rely on.
 */
let observer: ResizeObserver | null = null;

onMounted(() => {
	const element = container.value;
	if (element === null) return;
	const measure = (): void => {
		size.value = { width: element.clientWidth, height: element.clientHeight };
	};
	measure();
	observer = new ResizeObserver(measure);
	observer.observe(element);
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});
</script>

<template>
	<div
		ref="container"
		class="rp-plan-canvas"
		role="application"
		tabindex="0"
		:aria-label="tr('editor.canvas')"
		@wheel="onWheel"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@pointercancel="onPointerCancel"
		@pointerleave="onPointerLeave"
		@keydown="onKeyDown"
	>
		<VStage :config="stageConfig">
			<BackgroundLayer
				:transform="transform"
				:visible="layerVisibility.background"
				@status="(status) => emit('backgroundStatus', status)"
			/>
			<EmptyLayer
				layer-id="architecture"
				:transform="transform"
				:visible="layerVisibility.architecture"
			/>
			<ZoneLayer
				:transform="transform"
				:tokens="props.tokens"
				:visible="layerVisibility.zone"
				:zoom="viewport.zoom"
			/>
			<EmptyLayer
				layer-id="construction"
				:transform="transform"
				:visible="layerVisibility.construction"
			/>
			<EmptyLayer
				layer-id="asset"
				:transform="transform"
				:visible="layerVisibility.asset"
			/>
			<EmptyLayer
				layer-id="annotation"
				:transform="transform"
				:visible="layerVisibility.annotation"
			/>
			<InteractionLayer
				:tokens="props.tokens"
			/>
		</VStage>
	</div>
</template>
