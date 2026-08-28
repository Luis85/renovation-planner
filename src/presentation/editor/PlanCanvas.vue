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
 * **That claim is now load-bearing rather than merely tidy**, which is what the pan OVERRIDE
 * added: space held or the middle button pans while ANY tool is active, and it does so
 * without going through `ToolManager` at all. Built as a tool it would have had to be
 * switched TO, and the switch lifecycle runs the outgoing tool's `deactivate()` — so holding
 * space halfway through a polygon would discard the vertices already placed, which is the
 * exact opposite of what the gesture is for. `viewport/pan-override.ts` holds the state
 * machine; the routing rules are `onPointerDown`/`onPointerMove`/`onPointerUp` below, and
 * `tests/presentation/editor/canvasNavigation.test.ts` is what would notice them merging.
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
import { PanOverride, type PanButton } from './viewport/pan-override';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import { boundsOfZones } from './viewport/zoneExtent';
import type { EditorPointerEvent, ToolId } from './tools/editor-tool';
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
const project = useProjectStore();
const selection = useSelectionStore();
const runtime = useEditorRuntime();
const { viewport } = storeToRefs(editor);
const { layerVisibility } = storeToRefs(workspace);

const container = ref<HTMLElement | null>(null);
const size = ref({ width: 0, height: 0 });

/**
 * The camera override (`viewport/pan-override.ts`): space held or the middle button, either
 * of which outranks the active tool WITHOUT going through `ToolManager` — so a tool
 * interrupted by a pan is never told anything happened and has nothing to lose. Per canvas,
 * because two split leaves each have their own camera and their own held keys.
 *
 * A plain object rather than a `ref`: the machine is not itself rendered, and what the
 * template needs from it is the cursor below, recomputed from the same events that drive it.
 */
const panOverride = new PanOverride();
/** The override's phase, mirrored reactively — the only thing the template reads off it. */
const panPhase = ref(panOverride.phase);

function syncPanPhase(): void {
	panPhase.value = panOverride.phase;
}

/**
 * Tools whose click places a point at an exact spot, and which therefore want a crosshair
 * rather than an arrow. A LIST rather than a `tool.cursor` member on `EditorTool`, because
 * the alternative widens the tool interface every implementation must satisfy for the sake
 * of a presentational detail two of them care about — and `ToolManager`'s own contract is
 * that the framework knows no tool by name, which this file is not part of.
 */
const PRECISE_TOOLS: readonly ToolId[] = ['draw-polygon', 'calibrate'];

/**
 * The ONE cursor class on the canvas, and the place the precedence between the camera and
 * the active tool is decided.
 *
 * Decided here rather than left to the cascade in `styles/editor.css` on purpose: as source
 * order it would be a correct rule that no gate reads, and a paste in the wrong place would
 * silently invert it. As a computed it is an ordinary assertion in the suite.
 *
 * The camera outranks the tool because the ROUTING does — space held during a draw pans,
 * so a crosshair there would be the only thing telling the user otherwise. `idle` maps to
 * no class at all rather than to an `-idle` one: the resting state is what the base rule
 * already describes, and a class that styles nothing is a selector waiting to be given a
 * meaning it was never designed for.
 */
const cursorClass = computed(() => {
	if (panPhase.value !== 'idle') return `rp-plan-canvas-${panPhase.value}`;
	const tool = runtime.activeToolId.value;
	return tool !== null && PRECISE_TOOLS.includes(tool) ? 'rp-plan-canvas-precise' : null;
});

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

/**
 * One wheel notch as SCREEN PIXELS, whatever unit the browser chose to report it in.
 *
 * `WheelEvent.deltaMode` says what the numbers mean — pixels (0), lines (1) or pages (2) —
 * and a line-mode notch reports `3`. Read as pixels that pans three of them, which looks
 * like a broken gesture rather than an absent one.
 *
 * **Where this actually bites, stated narrowly because the general claim would be wider than
 * the truth:** Obsidian is Electron and Chromium reports pixel mode, so the plugin is
 * unlikely ever to see anything else. `npm run harness` is the surface that can — it runs in
 * whatever browser a designer opens, and line mode is Firefox's historical default. Cheap
 * and tested beats resting the gesture on a host not changing its mind.
 *
 * The two constants are the conventional approximations rather than measurements: there is
 * no API for a line's height, and the browsers that report line mode use a comparable
 * figure. The ZOOM path deliberately does NOT go through here — its exponential sensitivity
 * was tuned against raw `deltaY` and shipped that way, and re-scaling it would change how
 * zoom feels for a case Obsidian does not produce.
 */
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;

function wheelPixels(amount: number, deltaMode: number): number {
	if (deltaMode === 1) return amount * WHEEL_LINE_PX;
	if (deltaMode === 2) return amount * WHEEL_PAGE_PX;
	return amount;
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
	if (event.shiftKey) {
		// Shift+wheel pans horizontally — Obsidian's own Canvas does it, and this is a plan
		// wider than its pane far more often than it is taller.
		//
		// `deltaX` FIRST, because the browser may already have done the conversion: Chrome on
		// Windows and Linux turns a shift+wheel into a horizontal delta itself, and a
		// trackpad's own sideways swipe arrives that way on every platform. Reading `deltaY`
		// alone would make this gesture a silent no-op exactly where the platform was trying
		// to help. The sign is inverted because a scroll "right" moves the VIEW right, which
		// is the content moving left.
		const amount = event.deltaX !== 0 ? event.deltaX : event.deltaY;
		editor.panByScreen(-wheelPixels(amount, event.deltaMode), 0);
		return;
	}
	editor.zoomAt(stagePoint(event), viewport.value.zoom * Math.exp(-event.deltaY * WHEEL_SENSITIVITY));
}

/**
 * Design slice 8's routing rule: with a TOOL active, primary-button pointer events go to
 * `ToolManager` and the camera keeps only wheel/key zoom; with none (camera mode) drag
 * pans exactly as slice 5 shipped. One conversion here — DOM event to
 * `EditorPointerEvent`, world point through `screenToWorld` — so no tool performs its own
 * pixel math (ADR-009).
 */
/**
 * Which button an event carries, as the ONE mapping both consumers read — the tool event
 * below and the pan override's own claim. It was spelled twice for a while, which is two
 * chances for `auxiliary` to mean different buttons in the two halves of one press.
 *
 * `PointerEvent.button` is `-1` on a `pointermove` — the spec's "no button changed state" —
 * so this is NOT a reading of what is currently held down. Only 1 and 2 are mapped away from
 * `primary`, which keeps a move during a primary drag reading as the primary gesture it is;
 * `buttons` is the bitmask the held-down question would need, and nothing asks it yet.
 */
function panButtonOf(event: PointerEvent): PanButton {
	return event.button === 1 ? 'auxiliary' : event.button === 2 ? 'secondary' : 'primary';
}

function editorPointerEvent(event: PointerEvent, at: ScreenPoint): EditorPointerEvent {
	return {
		worldPoint: screenToWorld(at, viewport.value, STAGE_PIXELS),
		screenPoint: at,
		button: panButtonOf(event),
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
	const at = stagePoint(event);
	// Asked BEFORE the primary filter, because the override's own button is the middle one —
	// which `isPrimary` rejects, and correctly so for every other purpose.
	if (panOverride.pointerDown(panButtonOf(event), { toolGestureInFlight: runtime.toolManager.gestureInFlight })) {
		// Chrome opens its autoscroll widget on a middle press otherwise, and the pane scrolls
		// under a space-held drag.
		event.preventDefault();
		(event.target as Element).setPointerCapture?.(event.pointerId);
		editor.beginPan(at);
		syncPanPhase();
		return;
	}
	if (!isPrimary(event)) return;
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
	// The override outranks the active tool: a tool interrupted by a pan hears nothing at
	// all, which is what leaves its half-drawn polygon intact.
	if (panOverride.phase === 'panning') {
		editor.continuePan(at);
		return;
	}
	if (runtime.activeToolId.value !== null) {
		runtime.toolManager.pointerMove(editorPointerEvent(event, at));
		return;
	}
	editor.continuePan(at);
}

function onPointerUp(event: PointerEvent): void {
	if (panOverride.pointerUp(panButtonOf(event))) {
		editor.endPan();
		syncPanPhase();
		return;
	}
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
	panOverride.cancel();
	syncPanPhase();
	editor.endPan();
	editor.setPointer(null);
}

/**
 * Focus left the canvas, and that is the ONLY notice a held space bar has ended: keys are
 * listened for on this element rather than on `document`, so that a plan editor in one split
 * leaf cannot swallow the space bar of a note being edited in another. A user who alt-tabs
 * mid-hold therefore releases the key somewhere this component will never hear, and without
 * this the canvas comes back armed forever — every later click panning instead of selecting.
 */
function onBlur(): void {
	panOverride.cancel();
	syncPanPhase();
	editor.endPan();
}

function onPointerLeave(): void {
	// The override is released too, not merely the store's drag. Ending one and not the other
	// leaves two values modelling one gesture and disagreeing about it.
	//
	// What that costs, MEASURED rather than reasoned, because the obvious answer is wrong: the
	// camera does not run away — `continuePan` no-ops without a drag state, so the view stays
	// put and looks fine. The damage is to the ROUTING. The next `pointerup` is consumed as
	// the end of a pan that is no longer happening, so the active tool gets a press it never
	// gets a release for, and the drag the user just made does not commit. Exactly one release
	// is swallowed — clearing it is what repairs the state — which is why the regression case
	// has to make that drag the very NEXT interaction or it passes against the defect.
	//
	// `pointerUp` rather than `cancel`: a held space bar has not been released, so this returns
	// to `armed` and the user's next press still pans.
	//
	// Pointer capture means this should not fire mid-drag at all; that is a reason for the
	// two to be consistent anyway rather than a reason to leave the gap.
	panOverride.abandonGesture();
	syncPanPhase();
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
/**
 * `Shift+1` frames the whole plan and `Shift+2` frames the selection — Obsidian's own Canvas
 * shortcuts, so a user who knows one already knows the other. Answers whether the key was
 * one of them, so the zoom-step branch is not also consulted for it.
 *
 * Matched on `event.code` — the PHYSICAL key — rather than on `event.key`, which is the
 * character the layout produces. Shift+2 gives `@` on a US keyboard, `"` on the German and
 * UK ones; a `key`-based match made this shortcut silently dead for those users, and this
 * plugin ships a German locale, so that is not an edge case here. It is also the worst
 * failure a shortcut can have — nothing happens and nothing says why.
 *
 * The `shiftKey` test stays BESIDE the code test rather than instead of it: `code` alone
 * would fire on a bare `1`, which a user presses for all sorts of reasons and which a future
 * tool hotkey would plausibly want.
 *
 * A fit with nothing to frame does NOTHING, which is why `boundsOfZones` and `fitTo` each
 * answer that way rather than defaulting: a jump to nowhere costs the user the view they
 * had and tells them nothing about why.
 */
function fitShortcut(event: KeyboardEvent): boolean {
	if (!event.shiftKey) return false;
	const all = event.code === 'Digit1';
	const selected = event.code === 'Digit2';
	if (!all && !selected) return false;
	event.preventDefault();
	const zones = [...project.zones.values()];
	const framed = all
		? zones
		: zones.filter((zone) => selection.selectedIds.some((id) => String(id) === zone.id));
	const bounds = boundsOfZones(framed);
	if (bounds !== null) editor.fitTo(bounds, size.value);
	return true;
}

function onKeyDown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		runtime.toolManager.cancelGesture();
		return;
	}
	if (event.key === ' ') {
		// `repeat` is filtered because a held key autorepeats at the OS rate and every one of
		// those is a keydown. `PanOverride.armSpace` is idempotent, so that filter is belt and
		// braces — the `preventDefault` is not: space is page-down in a scrollable leaf, and
		// without it the first pan scrolls the editor out of its own view.
		event.preventDefault();
		if (event.repeat) return;
		panOverride.armSpace();
		syncPanPhase();
		return;
	}
	if (fitShortcut(event)) return;
	const factor = event.key === '+' || event.key === '=' ? KEY_ZOOM_STEP : event.key === '-' ? 1 / KEY_ZOOM_STEP : null;
	if (factor === null) return;
	event.preventDefault();
	editor.zoomByFactor(screenPoint(size.value.width / 2, size.value.height / 2), factor);
}

function onKeyUp(event: KeyboardEvent): void {
	if (event.key !== ' ') return;
	// A pan already RUNNING is deliberately not ended here — see `PanOverride.disarmSpace`.
	panOverride.disarmSpace();
	syncPanPhase();
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
		:class="cursorClass"
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
		@keyup="onKeyUp"
		@blur="onBlur"
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
		<!--
			Whatever floats over the stage — design slice 14's empty state today. It is a
			SIBLING of `<VStage>` inside this div rather than a child of it: Konva owns
			everything inside the stage and would not render a DOM node there at all. The div
			is already `position: relative` (`styles/editor.css`), so an absolutely positioned
			overlay resolves against the canvas region and not against the shell — which is
			what keeps it off the layers panel and the inspector.
		-->
		<slot />
	</div>
</template>
