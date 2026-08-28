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

/**
 * Whether the camera must hold still, because something is mid-gesture that moving it would
 * corrupt.
 *
 * `SelectTool` records where a drag STARTED in world coordinates and computes what to commit
 * from the release's world coordinate — both converted through the camera as it stands at
 * that moment. So a camera that moves between the two silently adds its own delta to the
 * geometry being committed: the zone lands somewhere the user never dragged it, with no error
 * anywhere. A running PAN is locked for a plainer reason and a different symptom: the camera
 * is already that gesture's, and `continuePan` recomputes absolutely from the viewport the
 * drag captured at its start — so a wheel that moved it is thrown away by the very next mouse
 * move, and the user sees a jump.
 *
 * **`editor.dragState` is in here because camera mode is the DEFAULT state**, and its drag is
 * represented by nothing else: no tool flag, and the override never claimed it. This predicate
 * and the override-start guard were briefly two expressions of one question sitting three
 * lines apart, and they drifted immediately — the third time in this file's review history
 * that a rule stated in one place was not followed by the next. They are one function now, so
 * there is nothing left to drift.
 *
 * **One rule for every camera door, including the ones this change did not add.** The wheel
 * ZOOM has been able to do this since slice 5, and the middle-button path already refused to
 * start a pan in this state — so the file was applying half of a rule it had already
 * discovered, which is the same shape as `isPrimary` being stated for three handlers and
 * missing from the fourth. Fixing only the doors a review happens to name is how a defect
 * class comes back wearing a different hat.
 *
 * The capability given up is "zoom while dragging", which a CAD editor might reasonably want.
 * It does not work today in any sense worth keeping, and making a live drag COMPENSATE for a
 * camera change is a change to the tool framework rather than to this file — that is the
 * follow-up, and refusing the move is the honest interim.
 */
function gestureInFlight(): boolean {
	return runtime.toolManager.gestureInFlight || editor.dragState !== null;
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
	// A camera that moves mid-gesture corrupts what the gesture commits — see `gestureInFlight`.
	if (gestureInFlight()) return;
	// A HORIZONTAL wheel gesture pans, and there are two of them. Shift+wheel is the one
	// Obsidian's own Canvas documents, and on Windows and Linux Chrome performs the swap
	// itself so it arrives as `deltaX`. A trackpad's two-finger sideways swipe is the other,
	// and it arrives as `deltaX` with NO modifier at all — which is why the modifier cannot be
	// the whole test. Gated on `shiftKey` alone, that swipe fell through to the zoom branch,
	// which reads only `deltaY`; with `deltaY: 0` it did nothing whatsoever, while the comment
	// here claimed to handle it and `docs/tests/cases/Canvas Navigation.md` step 8 told a
	// tester to expect it.
	//
	// The LARGER axis decides, not "any horizontal delta at all": a trackpad emits a little
	// `deltaX` during a mostly-vertical swipe, and routing on its mere presence would turn
	// hand tremor into a mode switch.
	if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
		// The sign is inverted because a scroll "right" moves the VIEW right, which is the
		// content moving left.
		//
		// The DOMINANT axis, not merely a nonzero horizontal one. Shift held over a mostly
		// vertical trackpad swipe carries a tiny incidental `deltaX`, and preferring it panned
		// one pixel for a gesture made at full travel — which reads as the shortcut being
		// broken rather than as a scale being wrong. Picking the larger magnitude also covers
		// the browsers that swap the gesture into a dominant `deltaX` themselves.
		const amount = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
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

// Primary button only, in BOTH directions and in both modes — the filter for the TOOL and
// CAMERA-MODE paths, which is all it has ever been asked at.
//
// It used to justify itself by saying the middle button is paste-on-Linux and the right one
// the context menu, "and claiming either would take a gesture the host owns". Half of that
// is now false in this very file: the pan override CLAIMS the middle button, and
// `onPointerDown` asks it before reaching this filter for exactly that reason. X11's
// primary-selection paste is a TEXT INPUT gesture and a canvas is not one; Obsidian's own
// Canvas documents middle-drag as its pan. The right button stays unclaimed, and that half
// of the reason survives: it pans in Obsidian Canvas on Windows and not on macOS, because
// macOS fires `contextmenu` on mousedown where Windows fires it on mouseup.
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
	// The SAME predicate the camera lock reads: camera mode is not a tool, and a middle press
	// during a bare left-drag pan would otherwise claim a gesture whose button is still held.
	if (panOverride.pointerDown(panButtonOf(event), event.pointerId, { gestureInFlight: gestureInFlight() })) {
		// Chrome opens its autoscroll widget on a middle press otherwise, and the pane scrolls
		// under a space-held drag.
		event.preventDefault();
		(event.target as Element).setPointerCapture?.(event.pointerId);
		editor.beginPan(at, event.pointerId);
		syncPanPhase();
		return;
	}
	// A press arriving while a pan is ALREADY running belongs to nobody. The override declined
	// it — one gesture at a time — and forwarding it would let a tool start a gesture on a
	// world that is moving under the user: `DrawPolygonTool` places a vertex, `SelectTool`
	// begins a drag.
	//
	// Not a touch-only concern, which is the part worth stating: a mouse shares ONE
	// `pointerId` across all its buttons, so a plain left click during a middle-button pan
	// takes this same path. That is an everyday desktop input, not an exotic one.
	if (panOverride.phase === 'panning') {
		event.preventDefault();
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
	editor.beginPan(at, event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
	const at = stagePoint(event);
	editor.setPointer(at);
	// While a pan is running the canvas belongs to the CAMERA, and that is one rule rather
	// than two: the owning pointer drives it, and every other pointer is swallowed rather
	// than handed to the active tool. A tool interrupted by a pan hears nothing at all, which
	// is what leaves its half-drawn polygon intact.
	if (panOverride.phase === 'panning') {
		if (panOverride.owns(event.pointerId)) editor.continuePan(at, event.pointerId);
		return;
	}
	if (runtime.activeToolId.value !== null) {
		runtime.toolManager.pointerMove(editorPointerEvent(event, at));
		return;
	}
	// Camera mode's own drag — the DEFAULT state, and therefore where a second finger on a
	// tablet actually lands. The store refuses a move from a pointer that did not begin the
	// drag; this call site does not have to ask.
	editor.continuePan(at, event.pointerId);
}

function onPointerUp(event: PointerEvent): void {
	if (panOverride.pointerUp(panButtonOf(event), event.pointerId)) {
		editor.endPan(event.pointerId);
		syncPanPhase();
		return;
	}
	// The other end of the press swallowed in `onPointerDown`. Letting this through would hand
	// the active tool a release with no matching press — an event stream no device produces,
	// and the exact grammar defect `canvasPointerRouting.test.ts` already exists for.
	if (panOverride.phase === 'panning') return;
	if (runtime.activeToolId.value !== null) {
		if (isPrimary(event)) runtime.toolManager.pointerUp(editorPointerEvent(event, stagePoint(event)));
		return;
	}
	// `isPrimary` HERE too, which is this file's own down/up symmetry rule finally applied to
	// the camera-mode branch. A camera drag can only have begun on a primary press — the
	// filter above `beginPan` guarantees it — so a middle release reaching this line ends a
	// gesture it never started, and the left button is still holding it. Pointer identity
	// could not catch that: one mouse, one `pointerId`, two buttons.
	if (isPrimary(event)) editor.endPan(event.pointerId);
}

/**
 * The pointer was taken away rather than released — the browser claiming a touch gesture
 * for scrolling, the OS grabbing it on an alt-tab or a window drag. No `pointerup` will
 * ever arrive, so whatever the active tool is holding has to be abandoned here or it
 * outlives the gesture: `SelectTool` kept redrawing a translated preview with no button
 * held, and the user's NEXT click anywhere committed a move by the delta between the
 * abandoned start and that unrelated click. The camera already had its equivalent in
 * `onPointerLeave`; the tool path had none.
 *
 * **Which gesture was cancelled decides what is abandoned, and getting that wrong broke this
 * whole design's central claim.** Cancelling the ACTIVE TOOL unconditionally meant a user
 * mid-polygon who held space to pan and then alt-tabbed lost their vertices — the tool never
 * received the pan's press, so its buffer has nothing to do with the gesture the OS just took
 * away, and destroying it is exactly what routing the pan around `ToolManager` exists to
 * prevent. The last of the five pointer doors to take the ownership rule.
 */
function onPointerCancel(event: PointerEvent): void {
	if (panOverride.phase === 'panning') {
		// A foreign pointer's cancellation says nothing about the running pan.
		if (!panOverride.owns(event.pointerId)) return;
		// The PAN was cancelled, so only the pan is abandoned. `abandonGesture` rather than
		// `cancel`: the space bar has not been released, and a real release — or `onBlur`, if
		// the OS took the window along with the pointer — is what ends the armed state.
		panOverride.abandonGesture();
		syncPanPhase();
		editor.abandonPan();
		editor.setPointer(null);
		return;
	}
	// No pan was running, so this cancellation belongs to whatever the tool was doing.
	// `ToolManager` tracks no pointer identity of its own, so a tool gesture is cancelled on
	// any cancellation reaching here — widening that is its contract to change, not this
	// file's.
	runtime.toolManager.cancelGesture();
	editor.endPan(event.pointerId);
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
	editor.abandonPan();
}

function onPointerLeave(event: PointerEvent): void {
	// A pan is owned by ONE pointer, and `pointerleave` carries an identity this handler used
	// to discard — so a second touch or pen crossing the pane edge stopped a drag the owner's
	// finger was still making. A leave from anything but the owner says nothing about the
	// gesture, so it does nothing at all.
	if (panOverride.phase === 'panning' && !panOverride.owns(event.pointerId)) return;
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
	// `endPan` and not `abandonPan`: in camera mode the store owns the drag, and it refuses a
	// release from a pointer that did not begin it — the same rule, one layer down.
	editor.endPan(event.pointerId);
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

/**
 * Whether a key event is the CANVAS's own, rather than one bubbling up from something
 * focusable inside it.
 *
 * The empty states are overlays INSIDE this element (`<slot />` below), and
 * `planEditor.noZones` carries an action button — so its `keydown` reaches this handler by
 * bubbling. Every shortcut here calls `preventDefault()`, and on a `<button>` that suppresses
 * the native Space activation: the canvas's only keyboard-reachable control stopped working
 * under the standard gesture for pressing it, while the camera armed behind it.
 *
 * Tested against the container rather than by sniffing for interactive tag names: the rule is
 * "these shortcuts belong to the canvas when the canvas is what has focus", which stays true
 * for whatever the overlay slot holds next.
 */
function isCanvasKey(event: KeyboardEvent): boolean {
	return event.target === container.value;
}

function onKeyDown(event: KeyboardEvent): void {
	if (!isCanvasKey(event)) return;
	if (event.key === 'Escape') {
		// **The fourth door to take the rule the three pointer handlers already carry**: while
		// a pan is RUNNING the canvas belongs to the camera, and every other input is swallowed
		// rather than handed to the active tool. Escape was the one input still routed straight
		// past it, and it was the destructive one — `cancelGesture()` empties
		// `DrawPolygonTool`'s vertex buffer, so a user mid-polygon who held space to pan and hit
		// Escape lost the whole polygon while the pan carried on underneath. Measured: no zone
		// could be closed afterwards at all. Exactly the defect `pointercancel` was corrected
		// for, in the one door nobody re-read the argument against.
		//
		// SWALLOWED rather than routed to the pan, which is what the finding suggested. Ending
		// the pan here would leave the user's button still down with the override no longer
		// owning it, so the eventual release would reach the active tool as a release with no
		// matching press — the event-grammar defect this file has already recorded three times.
		// And it would buy nothing: a pan has no uncommitted state for Escape to undo, since
		// the camera does not rewind. The user releases the button and presses Escape, which is
		// the gesture they would make anyway.
		//
		// `panning`, never `armed`: space merely HELD is not a gesture, so Escape still reaches
		// the tool then — which is the case the camera lock deliberately carved this branch out
		// for and must keep working.
		if (panOverride.phase !== 'panning') runtime.toolManager.cancelGesture();
		return;
	}
	if (event.key === ' ') {
		// `preventDefault` comes FIRST, above the gesture lock, and that ordering is the whole
		// point: space is page-down in a scrollable leaf, a held key autorepeats at the OS rate,
		// and the gesture is DEFINED by holding it. Suppressing only the first keydown let every
		// repeat through for the length of the pan, scrolling the editor leaf out from under the
		// plan — which is what putting the lock above this branch quietly did.
		event.preventDefault();
		// **`spaceHeld` is a record of the PHYSICAL key, so nothing conditional may skip it.**
		// The camera lock used to sit here too, and that made the record disagree with the
		// hand: a space pressed DURING a tool drag or a middle-button pan was dropped, and no
		// second non-repeat keydown is ever coming for a key that is already down — so the user
		// released the other gesture still holding space over a machine that thought it was up,
		// and their next primary drag went to the tool instead of the camera.
		//
		// The refusal belongs at `PanOverride.pointerDown`, which is the one place a gesture is
		// actually CLAIMED, and it already refuses there — the same "one function nothing can
		// restate" this file reached for `gestureInFlight` itself. Arming moves no camera; it
		// only says what the keyboard is doing.
		//
		// `armSpace` is idempotent, so the repeat filter is belt and braces — it is here to
		// spare `syncPanPhase` an OS-rate call, not to hold the state together.
		if (event.repeat) return;
		panOverride.armSpace();
		syncPanPhase();
		return;
	}
	// Escape is handled ABOVE this, and deliberately: abandoning a gesture is exactly what a
	// user wants to be able to do while one is running, and it moves no camera.
	if (gestureInFlight()) return;
	if (fitShortcut(event)) return;
	const factor = event.key === '+' || event.key === '=' ? KEY_ZOOM_STEP : event.key === '-' ? 1 / KEY_ZOOM_STEP : null;
	if (factor === null) return;
	event.preventDefault();
	editor.zoomByFactor(screenPoint(size.value.width / 2, size.value.height / 2), factor);
}

function onKeyUp(event: KeyboardEvent): void {
	if (!isCanvasKey(event) || event.key !== ' ') return;
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

			**The `.stop` modifiers are the pointer half of `isCanvasKey`**, and they are
			expressed HERE rather than as a predicate at each handler on purpose. `keydown`
			could ask `event.target === container` because a key goes to whatever has focus;
			a press cannot, because its target is the Konva canvas the stage draws into and
			never this div. So the rule is structural instead: the overlay region is simply
			not part of the canvas's gesture surface, which stays true for whatever the slot
			holds next and cannot be forgotten at a sixth pointer door the way a predicate
			can.

			`planEditor.noZones` carries an action button, and `.rp-empty-state__action`
			re-enables `pointer-events` against the overlay's own `none` — so it is a real
			pointer target sitting over the stage, and its press bubbled here and started a
			camera pan under the user while they were merely clicking the button. The same
			class as the `keydown` defect one round earlier, left unfixed for pointers.

			Both ends, never one: a swallowed press owes a swallowed release, or the active
			tool gets a release with no matching press — the grammar defect this file has
			already recorded three times. A gesture that STARTED on the stage is unaffected,
			because `onPointerDown` captures the pointer, and a captured event retargets to
			the stage however far the drag wanders over this region.

			The modifiers stop propagation at the BUBBLE phase, so the overlay's own controls
			have already had the event: their handlers run untouched and only the canvas
			behind them is kept out of it.
		-->
		<div
			class="rp-plan-overlay"
			@pointerdown.stop
			@pointerup.stop
			@pointercancel.stop
		>
			<slot />
		</div>
	</div>
</template>
