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
import { PanOverride } from './viewport/pan-override';
import { MIDDLE_MOUSE_BUTTON, PRIMARY_BUTTON_BIT, panButtonOf } from './pointerButtons';
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
 * Where the pointer physically is, in stage pixels — `null` once it leaves the pane.
 *
 * `EditorStore` keeps the WORLD point for the status bar's readout, which is a different
 * fact and cannot stand in for this one: the world point under a stationary pointer changes
 * whenever the camera does, and this is the half that does not. See `reissuePointerMove`.
 */
const lastStagePoint = ref<ScreenPoint | null>(null);

/**
 * The camera override (`viewport/pan-override.ts`): space held or the middle button, either
 * of which outranks the active tool WITHOUT going through `ToolManager` — so a tool
 * interrupted by a pan is never told anything happened and has nothing to lose. Per canvas,
 * because two split leaves each have their own camera and their own held keys.
 *
 * A plain object rather than a `ref`: the machine is not itself rendered, and what the
 * template needs from it is the cursor below, recomputed from the same events that drive it.
 */
/**
 * Pointers whose PRESS this canvas swallowed, held until that pointer ends.
 *
 * The swallow itself is decided by the phase — while a pan runs, the canvas belongs to the
 * camera — but the phase is gone by the time the swallowed pointer reports back. Finger A
 * space-pans, finger B presses and is swallowed, A releases and ends the pan, and B's
 * eventual `pointercancel` then found no pan running and was attributed to the active TOOL,
 * emptying a half-drawn polygon the tool never received a press for. Ownership has to outlive
 * the pan, because the pointer does.
 *
 * Consulted at BOTH ends, which is this file's own repeated lesson rather than a symmetry for
 * its own sake — a swallowed press owes a swallowed release. Measured: only the cancel path is
 * destructive today, because `cancelGesture()` empties a buffer unconditionally while a bare
 * release is absorbed by each tool's own no-gesture guard. Guarding one and not the other
 * would leave the next reader to discover which half was deliberate.
 *
 * Bounded by the number of pointers physically down, and cleared outright on focus loss —
 * a deactivated window owns none of them.
 */
const swallowedPointers = new Set<number>();

/**
 * WHICH pointer the active tool's in-flight gesture belongs to — the identity `ToolManager`
 * deliberately does not keep, held here because only this file needs it.
 *
 * Never cleared, and that is correct rather than an oversight: it is only ever read BESIDE
 * `toolManager.gestureInFlight`, which is the liveness half, and both are written by the same
 * call. A value left over from a finished gesture is unreachable, because the flag it is
 * consulted with is false until the next press sets them together again.
 */
let toolGesturePointer: number | null = null;

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
 * The modifier keys, as every DOM event that carries them spells them — a `PointerEvent`, a
 * `WheelEvent` and a `KeyboardEvent` alike, which is what lets a camera change re-issue a
 * pointer move with the modifier state that was actually held at the time.
 */
interface ModifierSource {
	readonly shiftKey: boolean;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly altKey: boolean;
}

function pointerEventAt(
	source: ModifierSource,
	at: ScreenPoint,
	button: EditorPointerEvent['button'],
): EditorPointerEvent {
	return {
		worldPoint: screenToWorld(at, viewport.value, STAGE_PIXELS),
		screenPoint: at,
		button,
		modifiers: { shift: source.shiftKey, ctrl: source.ctrlKey || source.metaKey, alt: source.altKey },
		targetId: null,
	};
}

function editorPointerEvent(event: PointerEvent, at: ScreenPoint): EditorPointerEvent {
	// `PointerEvent.button` is `-1` on a `pointermove` — the spec's "no button changed
	// state" — so it is NOT a reading of what is currently held down. Only 1 and 2 are
	// mapped away from `primary`, which keeps a move during a primary drag reading as
	// the primary gesture it is; `buttons` is the bitmask a tool would need for the
	// held-down question, and nothing asks it yet. `panButtonOf` is that mapping, shared
	// with the pan override so the two halves of one press cannot disagree about a button.
	//
	// The `?? 'primary'` is where `-1` lands, and it is spelled HERE rather than inside the
	// mapping because only this consumer wants it: a move during a primary drag must go on
	// reading as the primary gesture it is, while the override must DECLINE the same absence
	// rather than claim a pan for it.
	return pointerEventAt(event, at, panButtonOf(event) ?? 'primary');
}

/**
 * Tells the active tool where the pointer is now, after the CAMERA has moved under it.
 *
 * A tool's preview is a function of the last pointer event it saw, and it keeps that event's
 * WORLD point — so a camera change silently invalidates it: the pointer has not moved, but
 * the world position it is over has. The keyboard's `+`/`-` are the clearest case, anchoring
 * at the stage centre, and there the drifted point is not marginal: measured, a close target
 * five pixels from the pointer went on promising a close with the vertex forty-three pixels
 * away. A wheel zoom anchors at the pointer, so the world point under it is invariant and
 * this call is a no-op there — issued anyway, because "any camera change re-issues the move"
 * is a rule that holds for camera paths not yet written, while "the ones that need it" is a
 * list that goes stale.
 *
 * A synthetic event, but not a fictional one: every field is a true statement about where the
 * pointer is and what it is over, which is exactly what the next real `pointermove` would
 * say. Reported by a review bot on the pull request that drew the close target.
 */
function reissuePointerMove(source: ModifierSource): void {
	// **A synthetic move is still an input, and while a pan runs the canvas belongs to the
	// CAMERA.** Three pointer handlers keep the active tool out of a running pan; this
	// function is the one door that hands it something anyway, and `lastStagePoint` during a
	// pan is the PAN's own pointer — so a Shift press mid-pan sent a drawing tool a hover at
	// the panning cursor and its rubber band jumped there. The guard is HERE rather than at
	// the two Shift call sites because it is a property of re-issuing at all, and a third
	// caller would have to remember a rule it cannot see.
	//
	// What a caller CAN still do is destroy the state this reads before asking: `onBlur`
	// cancelled the pan first, so the phase was already clear by the time the re-issue got
	// here. The guard is in the right place and the ordering is the caller's — see `onBlur`.
	//
	// Nothing is deferred to the pan's end: a re-issue answers "the camera moved under a
	// stationary pointer", and a pan moves the pointer too, so the first real move after it
	// says the same thing truthfully. The camera doors that DO need it are refused during a
	// pan anyway — `onWheel` and `onKeyDown` both return on `gestureInFlight()`, which a
	// pan's own `dragState` satisfies.
	if (panOverride.phase === 'panning') return;
	const at = lastStagePoint.value;
	if (at === null || runtime.activeToolId.value === null) return;
	runtime.toolManager.pointerMove(pointerEventAt(source, at, 'primary'));
}

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
		// The world moved under a stationary pointer, so the active tool's preview is stale —
		// design slice 13's rule, which its own docblock said "holds for camera paths not yet
		// written". This is one of those paths.
		reissuePointerMove(event);
		return;
	}
	editor.zoomAt(stagePoint(event), viewport.value.zoom * Math.exp(-event.deltaY * WHEEL_SENSITIVITY));
	reissuePointerMove(event);
}

/**
 * Design slice 8's routing rule: with a TOOL active, primary-button pointer events go to
 * `ToolManager` and the camera keeps only wheel/key zoom; with none (camera mode) drag
 * pans exactly as slice 5 shipped. One conversion here — DOM event to
 * `EditorPointerEvent`, world point through `screenToWorld` — so no tool performs its own
 * pixel math (ADR-009).
 */

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

/**
 * **The one door EVERY middle press arrives at, which is why the autoscroll rule lives here
 * and nowhere else.** Chrome opens its autoscroll widget on a middle press and the pane then
 * scrolls under whatever gesture is running; `preventDefault()` on the mouse event is what
 * stops it.
 *
 * It was at `onPointerDown` for two rounds, and that door cannot see the case that matters.
 * Measured in a real Chromium rather than argued: with the primary button already held — a
 * tool drag, a camera-mode drag, a pan — a middle press fires **no `pointerdown` at all**.
 * Pointer Events reports it as a `pointermove` (`button=1`, `buttons=5`) while the
 * compatibility `mousedown` fires exactly as it always does, so the suppression sat on a
 * handler the press never reached and the autoscroll widget opened over the live drag.
 * Cancelling that `pointermove` does not help either: the compatibility mapping ties mouse-event
 * suppression to a cancelled `pointerdown`, and the `mousedown` was measured firing regardless.
 *
 * `mousedown`, by contrast, fires for a bare press (`buttons=4`) and a chorded one
 * (`buttons=5`) alike — one door, no bitmask, nothing for a later branch to remember. jsdom
 * synthesizes no compatibility events, so the suite can only drive this handler directly;
 * `docs/tests/cases/Canvas Navigation.md` step 13 is where a real mouse looks at it.
 *
 * Suppressing a default is still not CLAIMING a gesture — the two must not be merged, and
 * `canvasGestureOwnership.test.ts` holds both halves apart.
 */
function onMouseDown(event: MouseEvent): void {
	if (event.button === MIDDLE_MOUSE_BUTTON) event.preventDefault();
}

function onPointerDown(event: PointerEvent): void {
	const at = stagePoint(event);
	// The middle button's browser default is suppressed at `onMouseDown` and not here — see the
	// account there for why this door cannot hold that rule at all.
	//
	// Asked BEFORE the primary filter, because the override's own button is the middle one —
	// which `isPrimary` rejects, and correctly so for every other purpose.
	// The SAME predicate the camera lock reads: camera mode is not a tool, and a middle press
	// during a bare left-drag pan would otherwise claim a gesture whose button is still held.
	const claimable = panButtonOf(event);
	if (
		claimable !== null
		&& panOverride.pointerDown(claimable, event.pointerId, { gestureInFlight: gestureInFlight() })
	) {
		// The PRIMARY half of the claim — a space-held left press — so the browser starts no
		// text selection or native drag under a pan.
		//
		// **Narrowed to that button on purpose.** Preventing a middle `pointerdown` suppresses
		// its compatibility `mousedown` outright (measured: with the pointer event cancelled,
		// no `mousedown` is dispatched at all), which would leave `onMouseDown` unreached for
		// exactly the presses this branch claims — and "the one door every middle press
		// arrives at" would be false for a third of them while still reading as true.
		if (claimable === 'primary') event.preventDefault();
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
	// A TOUCH or pen concern, and only that: a second finger has its own `pointerId` and so
	// fires its own press. A mouse cannot reach this line at all while a pan is running, since
	// one pointer shares every button and a chorded press arrives as a `pointermove` — which
	// `onPointerMove` swallows a few lines below. This comment claimed the opposite for
	// several rounds and the cases under it drove a stream no mouse produces.
	if (panOverride.phase === 'panning') {
		event.preventDefault();
		swallowedPointers.add(event.pointerId);
		return;
	}
	// A press from a SECOND POINTER while a tool gesture is running belongs to nobody either,
	// and this was the one door with no ownership rule at all. The override refuses a press
	// while another gesture runs, and `EditorStore.beginPan` keeps the drag it already has —
	// the tool branch below simply reassigned `toolGesturePointer` and forwarded the press, so
	// a second finger landing mid-drag handed `SelectTool` a gesture at ITS coordinates and the
	// owner stopped being recognised as the owner. Measured: a zone dragged 1000 world units
	// committed 6000.
	//
	// TOUCH and pen only, like the pan case above and for the same reason — a mouse shares one
	// `pointerId` across every button, so it cannot deliver a second press mid-drag at all.
	//
	// `gestureInFlight` rather than "a tool is active": a multi-click tool sits BETWEEN clicks
	// with nothing in flight, and two fingers placing vertices in turn is a legitimate way to
	// draw a polygon. Swallowed rather than ignored, because a swallowed press owes a
	// swallowed release.
	if (runtime.toolManager.gestureInFlight && toolGesturePointer !== event.pointerId) {
		event.preventDefault();
		swallowedPointers.add(event.pointerId);
		return;
	}
	if (!isPrimary(event)) return;
	// Capture, so a drag that leaves the pane still ends when the button does — without it
	// the camera keeps panning after the pointer comes back, which reads as the view being
	// stuck to the cursor.
	(event.target as Element).setPointerCapture?.(event.pointerId);
	if (runtime.activeToolId.value !== null) {
		toolGesturePointer = event.pointerId;
		runtime.toolManager.pointerDown(editorPointerEvent(event, at));
		return;
	}
	editor.beginPan(at, event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
	const at = stagePoint(event);
	lastStagePoint.value = at;
	editor.setPointer(at);
	// While a pan is running the canvas belongs to the CAMERA, and that is one rule rather
	// than two: the owning pointer drives it, and every other pointer is swallowed rather
	// than handed to the active tool. A tool interrupted by a pan hears nothing at all, which
	// is what leaves its half-drawn polygon intact.
	if (panOverride.phase === 'panning') {
		if (!panOverride.owns(event.pointerId)) return;
		// **A move is where a chorded release arrives**, so the owner's own move is asked
		// whether its button is still held before it is allowed to drive the camera. Pointer
		// Events fires `pointerup` only when the LAST button comes up, so middle-drag, press
		// primary, release middle, release primary sends exactly one release and it names the
		// primary button — nothing the override can match, and the canvas stayed `panning`
		// for the rest of the session.
		if (panOverride.pointerMove(event.pointerId, event.buttons)) {
			editor.endPan(event.pointerId);
			syncPanPhase();
			return;
		}
		editor.continuePan(at, event.pointerId);
		return;
	}
	if (runtime.activeToolId.value !== null) {
		// **The third path the chord grammar reaches, and the only one where the cost is a lost
		// edit rather than a stuck camera.** A tool drag is primary by construction, and every
		// tool refuses a release that is not — rightly, since a middle release must not commit
		// a drag. So with a second button held the eventual `pointerup` names that button, the
		// tool declines it, and the gesture outlives the hand: `SelectTool`'s move is never
		// committed and the zone snaps back with no error anywhere.
		//
		// The release is spelled at the point the button actually came up, which is what this
		// move reports — a translation of the DOM event like every other one this file makes,
		// not a synthetic gesture.
		//
		// **A running gesture belongs to its pointer, and EVERY other pointer is nothing to the
		// tool** — asked once, above both of the things this branch does, rather than as a
		// clause inside one of them.
		//
		// It guarded the synthetic release alone at first, and that is where the rule was
		// discovered: `buttons` describes the pointer that SENT the move and nothing else, so a
		// pen over the canvas, or a finger resting and lifted, reports `buttons: 0` while the
		// mouse holding the drag is still down — and `SelectTool` committed the move at the
		// pen's coordinates (measured: the zone landed at 7500, 3500, nowhere the user dragged
		// it). What that fix left open is the plain move one line below: the same foreign event
		// went on reaching `pointerMove`, so the ghost the user is STEERING BY jumped to
		// wherever the pen was. One rule at the top of the branch closes both, and neither can
		// be forgotten separately.
		//
		// Only while a gesture is in FLIGHT. A hover with nothing running is how a drawing
		// tool's rubber band follows the pointer at all, and a second pointer is welcome to it.
		if (runtime.toolManager.gestureInFlight && toolGesturePointer !== event.pointerId) return;
		if (runtime.toolManager.gestureInFlight && (event.buttons & PRIMARY_BUTTON_BIT) === 0) {
			runtime.toolManager.pointerUp(pointerEventAt(event, at, 'primary'));
			return;
		}
		runtime.toolManager.pointerMove(editorPointerEvent(event, at));
		return;
	}
	// Camera mode's own drag — the DEFAULT state, and therefore where a second finger on a
	// tablet actually lands. The store refuses a move from a pointer that did not begin the
	// drag; this call site does not have to ask.
	//
	// **The same chorded release, in the half that is more reachable rather than less.** A
	// camera-mode drag can only have begun on the primary button, so its owner's bit is 1:
	// press the middle button mid-drag, release the primary, and the drag's own button is up
	// while the only `pointerup` still to come will name the middle one. `endPan` refuses a
	// pointer that began no drag, so the ordinary hover — no buttons, no drag — costs nothing
	// here.
	if ((event.buttons & PRIMARY_BUTTON_BIT) === 0) {
		editor.endPan(event.pointerId);
		return;
	}
	editor.continuePan(at, event.pointerId);
}

function onPointerUp(event: PointerEvent): void {
	// The OWNER's release is tested first. That ordering was written as a guard — a mouse
	// shares one `pointerId` across every button, so a primary press swallowed during a
	// middle-button pan would record the pan owner's own id — and under the real event grammar
	// the collision it guards has no producer: a chorded press fires no `pointerdown`, so
	// nothing reaches `swallowedPointers` under an id that already owns a pan. Kept because
	// owner-first is the order that reads correctly, not because it is holding anything up.
	const released = panButtonOf(event);
	if (released !== null && panOverride.pointerUp(released, event.pointerId)) {
		editor.endPan(event.pointerId);
		syncPanPhase();
		return;
	}
	// A pointer whose press was swallowed owes its release swallowed too, whether or not the
	// pan that swallowed it is still running — see `swallowedPointers`. Below the owner's own
	// release, never above it.
	if (swallowedPointers.delete(event.pointerId)) return;
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
	// The OWNER first here too, and with the same standing as in `onPointerUp`: written for a
	// swallowed press sharing the pan owner's id, which the real chord grammar cannot produce.
	if (panOverride.phase === 'panning') {
		// A foreign pointer's cancellation says nothing about the running pan — but if this
		// canvas swallowed that pointer's press, its cancellation is spent here rather than
		// reaching the tool.
		if (!panOverride.owns(event.pointerId)) {
			swallowedPointers.delete(event.pointerId);
			return;
		}
		// The PAN was cancelled, so only the pan is abandoned. `abandonGesture` rather than
		// `cancel`: the space bar has not been released, and a real release — or `onBlur`, if
		// the OS took the window along with the pointer — is what ends the armed state.
		panOverride.abandonGesture();
		syncPanPhase();
		editor.abandonPan();
		editor.setPointer(null);
		// Nothing can have been swallowed under the owner's own id — a chorded press fires no
		// `pointerdown` — so this is housekeeping rather than a repair, and it costs a set
		// lookup to keep "a pointer that ends leaves no entry" true of every id without
		// exception.
		swallowedPointers.delete(event.pointerId);
		return;
	}
	// The destructive half: `cancelGesture()` empties a tool's buffer outright, so a swallowed
	// pointer's cancellation reaching it costs the user a half-drawn polygon.
	if (swallowedPointers.delete(event.pointerId)) return;
	// No pan was running, so this cancellation belongs to whatever the tool was doing.
	// `ToolManager` tracks no pointer identity of its own, so a tool gesture is abandoned on
	// any cancellation reaching here — widening that is its contract to change, not this
	// file's.
	//
	// `cancelInterruptedGesture` and NOT `cancelGesture`, which is the same distinction
	// `onBlur` draws and for the same reason: a cancellation is the OS TAKING the pointer,
	// never the user asking for their work back, so it may abandon only what the missing
	// release would have completed. `cancel()` here emptied a drawing tool's whole buffer —
	// so a user mid-polygon who was interrupted during a single click lost every vertex
	// placed before it, and the two doors DOUBLED for one interruption: an Alt+Tab mid-press
	// fires `blur`, which abandons the gesture and keeps the vertices, and the
	// `pointercancel` that may follow then destroyed exactly what the blur had preserved.
	// Being gated on `gestureInFlight` is what makes the pair idempotent: whichever door
	// arrives second finds nothing in flight and does nothing.
	runtime.toolManager.cancelInterruptedGesture();
	editor.endPan(event.pointerId);
	lastStagePoint.value = null;
	editor.setPointer(null);
}

/**
 * Nothing is held any more — the state to assume when the modifier keys can no longer be
 * observed. See `onBlur`.
 */
const NO_MODIFIERS: ModifierSource = {
	shiftKey: false,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
};

/**
 * Focus left the canvas, and TWO independent things follow from it — both kept, because they
 * answer different questions about a keyboard this element can no longer hear.
 *
 * The held SPACE BAR is dropped: keys are listened for on this element rather than on
 * `document`, so that a plan editor in one split leaf cannot swallow the space bar of a note
 * being edited in another. A user who alt-tabs mid-hold releases the key somewhere this
 * component will never hear, and without this the canvas comes back armed forever — every
 * later click panning instead of selecting.
 *
 * And the tool is told nothing is held (`reissuePointerMove(NO_MODIFIERS)`), which is design
 * slice 13's own reason, unchanged: a Shift released in another application would otherwise
 * leave the preview constrained for ever, while the next click carries the real
 * `shiftKey: false` and places the vertex somewhere the rubber band was not.
 *
 * **A THIRD thing follows and this handler answered for none of it for two slices**: a tool
 * gesture in flight is interrupted here too. An Alt+Tab mid-drag delivers no `pointerup` —
 * the user releases the button in another application — so `gestureInFlight` stayed true and
 * `cameraIsLocked()` refused every wheel and both fit shortcuts for the rest of the session,
 * while `SelectTool` kept a translated preview whose delta the next click anywhere
 * committed. The same damage `onPointerCancel` was corrected for, at the one door with no
 * pointer to name. `cancelInterruptedGesture` rather than `cancelGesture` because a
 * multi-click tool sits BETWEEN clicks with nothing in flight, and a window losing focus
 * says nothing about a buffer the user is still filling.
 *
 * **The ORDER of those three is load-bearing, and the first version of this handler had it
 * backwards at both ends.** The re-issue goes FIRST, so that it is a statement about the
 * gesture as it still was, and the interruption is the last word on it:
 *
 * - It ran after `cancelInterruptedGesture()`, which had just RESTORED `CalibrateTool`'s
 *   first point and redrawn its zero-length anchor — and then replayed the remembered
 *   position of the interrupted second point straight back into `pointerMove`, redrawing
 *   the abandoned segment over the anchor. Not a cosmetic difference: that render is
 *   identical to the one `pointerDown` leaves for a second point that really was placed, so
 *   the user came back to the picture meaning "measured, awaiting the distance" over a tool
 *   that had thrown the measurement away, with no dialog coming.
 * - And it ran after `panOverride.cancel()`, which is how the one door built to keep a
 *   synthetic move out of a running pan walked around its own guard: `reissuePointerMove`
 *   returns early while `phase === 'panning'`, and cancelling first had already made that
 *   false — so a blur mid-pan handed a drawing tool a hover at the PAN's pointer and its
 *   rubber band jumped there. Reported by a review bot on this pull request, which named
 *   the calibration half; the camera half was the same replay one line up.
 *
 * Nothing is lost by re-issuing first. Each tool's `pointerMove` is a preview, so a tool
 * whose gesture is then abandoned has that preview cleared by the abandonment anyway, and a
 * tool with nothing in flight — the polygon buffer slice 13 added this call for — keeps the
 * unconstrained preview the re-issue just drew.
 */
function onBlur(): void {
	reissuePointerMove(NO_MODIFIERS);
	swallowedPointers.clear();
	panOverride.cancel();
	syncPanPhase();
	editor.abandonPan();
	runtime.toolManager.cancelInterruptedGesture();
}

function onPointerLeave(event: PointerEvent): void {
	// A pan is owned by ONE pointer, and `pointerleave` carries an identity this handler used
	// to discard — so a second touch or pen crossing the pane edge stopped a drag the owner's
	// finger was still making. A leave from anything but the owner says nothing about the
	// gesture, so it does nothing at all — `lastStagePoint` included, since the owner's
	// pointer is still in the pane and its remembered position is still true.
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
	// Pointer capture means this should not fire mid-drag at all; that is a reason for the
	// two to be consistent anyway rather than a reason to leave the gap.
	panOverride.abandonGesture();
	syncPanPhase();
	// `endPan` and not `abandonPan`: in camera mode the store owns the drag, and it refuses a
	// release from a pointer that did not begin it — the same rule, one layer down.
	editor.endPan(event.pointerId);
	// Both halves go together: a camera change with the pointer outside the pane has no
	// pointer to re-issue a move for, and a remembered position would be a claim about where
	// a pointer that is somewhere else entirely is.
	lastStagePoint.value = null;
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
	if (bounds === null) return true;
	editor.fitTo(bounds, size.value);
	// A fit moves the camera further than any other door here — the pointer can end up over a
	// completely different part of the plan — so the re-issue matters most at exactly this one.
	reissuePointerMove(event);
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

/**
 * `+`/`-`, anchored at the middle of the stage since a keypress involves no pointer (§85 asks
 * for the one interaction slice 5 added to be reachable by key).
 *
 * Split out of `onKeyDown` alongside `fitShortcut` when merging design slice 13's Shift
 * branch into this branch's own took that handler past the complexity budget. The two
 * shortcuts now read the same way, which is the better shape regardless of what forced it.
 */
function zoomShortcut(event: KeyboardEvent): void {
	const factor = event.key === '+' || event.key === '=' ? KEY_ZOOM_STEP : event.key === '-' ? 1 / KEY_ZOOM_STEP : null;
	if (factor === null) return;
	event.preventDefault();
	editor.zoomByFactor(screenPoint(size.value.width / 2, size.value.height / 2), factor);
	reissuePointerMove(event);
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
		//
		// **`event.repeat` because ONE PRESS IS ONE PRESS.** A phase test alone reads each
		// autorepeat as a fresh decision, so a user holding Escape as the pan ended had the
		// keydown swallowed and then the OS's next repeat of that same press — arriving a few
		// tens of milliseconds later, with the phase no longer `panning` — reach
		// `cancelGesture()` and clear the polygon anyway. Whether the buffer survived came down
		// to whether the button was released before the next repeat, which is a race and not a
		// rule.
		//
		// Filtering every repeat rather than tracking THIS press through its keyup, which is
		// the same thing with no state to keep: a repeat is never new intent, and `cancel()` is
		// idempotent, so the two differ only for repeats of a press that already cancelled —
		// where the second call clears an empty buffer. Escape means cancel once. The space
		// branch above filters repeats for its own reasons and this is the same sentence.
		if (!event.repeat && panOverride.phase !== 'panning') runtime.toolManager.cancelGesture();
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
	// Shift is the angle constraint, and it has to bite the moment it goes down rather than
	// on the next pointer move: a user holds it to make the line they are ALREADY drawing
	// straight, and a preview that only answers once the hand twitches reads as a dead key.
	// The same re-issue serves its release, where the constraint has to let go just as
	// promptly. `event.shiftKey` is true on the press and false on the release, so the tool
	// reads the state rather than the transition — which is also what makes this work under
	// Sticky Keys, where the modifier latches and no key is physically held at all.
	//
	// ABOVE the camera lock, and deliberately, for the same reason Escape is: it moves no
	// camera, and a user holds Shift precisely while a gesture is in flight — gating it there
	// would make the constraint dead exactly when it is wanted.
	if (event.key === 'Shift') {
		reissuePointerMove(event);
		return;
	}
	// Escape is handled ABOVE this, and deliberately: abandoning a gesture is exactly what a
	// user wants to be able to do while one is running, and it moves no camera.
	if (gestureInFlight()) return;
	if (fitShortcut(event)) return;
	zoomShortcut(event);
}


/**
 * The two keys whose RELEASE means something here, and nothing else: a handler that acted on
 * every keyup would fire once per keystroke of whatever the user typed with the canvas
 * focused. Every other key either does its work on the press (Escape, the zoom pair) or means
 * nothing to this element at all.
 *
 * Shift is the angle constraint letting go, and it re-issues the move so the preview
 * unconstrains as promptly as it constrained. Space is the pan disarming — and a pan already
 * RUNNING is deliberately not ended by it, for the reason `PanOverride.disarmSpace` gives.
 *
 * `isCanvasKey` guards the space branch alone. Shift is a MODIFIER: it reaches this element
 * while the empty state's action button has focus too, and the tool's preview should still
 * unconstrain — where a space release there belongs to the button, not to the camera.
 */
function onKeyUp(event: KeyboardEvent): void {
	if (event.key === 'Shift') {
		reissuePointerMove(event);
		return;
	}
	if (!isCanvasKey(event) || event.key !== ' ') return;
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
	// The same cleanup at the WINDOW, because `@blur` on the container covers focus moving
	// within the document and is not guaranteed to cover the APPLICATION losing focus:
	// Chromium can deactivate a window while leaving the focused element focused, and Obsidian
	// is Electron. The space keyup then happens in whatever the user alt-tabbed to, so this
	// canvas never hears it and stays armed forever — the exact defect `onBlur` exists to
	// prevent, reached by the exact gesture its own comment names.
	//
	// Registering both rather than choosing: they are cheap, `onBlur` is idempotent, and no
	// gate here can settle which one Electron delivers — jsdom models no window activation and
	// a headless browser has no OS window to deactivate. `docs/tests/cases/Canvas Navigation.md`
	// step 11 is where that is actually looked at, and it passes either way now.
	//
	// A window listener is safe where a window KEY listener would not be: this one reacts to
	// the application losing focus rather than competing for a keystroke, so two Plan Editor
	// leaves both cleaning up is correct — neither has a held space bar once the window is
	// deactivated.
	window.addEventListener('blur', onBlur);
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
	// A window listener outlives its element unless something removes it, and a closed leaf
	// still reacting to every window blur would reach into a disposed Pinia store.
	window.removeEventListener('blur', onBlur);
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
		@mousedown="onMouseDown"
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
