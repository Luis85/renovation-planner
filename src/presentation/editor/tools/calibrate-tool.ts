import type { AppError } from '../../../core/errors/AppError';
import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { CalibratePlanInput } from '../../../application/commands/plan/ReversibleCalibratePlan';
import type { CalibratePlanTransaction } from '../planEditorCommands';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';
import type { UndoableCommand } from './undoable-command';

/**
 * What asks the user for the known real-world distance once two points are placed,
 * answered in world millimetres like every length (ADR-009) — or `null` when the prompt
 * is dismissed.
 *
 * Slice 15 filled it: `runtime.ts` binds this to a `FormDialog` carrying
 * `KnownDistanceForm`. What it is NOT is the Inspector, which is what this comment said was
 * coming — "§59's Selection → Inspector pipeline has no Vue Inspector panel yet … and the
 * Inspector plugs in here". The panel exists now and is the wrong home anyway: a modal
 * question that blocks the gesture until it is answered is not a property editor. The seam
 * being a plain `Promise<number | null>` is what let the answer arrive from somewhere other
 * than the place that predicted it, and that is the argument for declaring one.
 */
export type KnownDistanceSupplier = (measuredWorldUnits: number) => Promise<number | null>;

export interface CalibrateToolDeps {
	readonly supplyKnownDistance: KnownDistanceSupplier;
	/**
	 * Whether this plan already has geometry a recalibration would rescale. The gate for
	 * warning the user is whether objects MOVE, not whether a calibration already exists:
	 * an uncalibrated plan with five zones drawn on it has just as much to lose as a
	 * calibrated one, and a calibrated plan with nothing on it has nothing.
	 */
	readonly hasSpatialObjects: () => boolean;
	/**
	 * Asks the user to confirm a rescale; `true` proceeds. Never called when
	 * `hasSpatialObjects` is false. A dismissal (Escape, an overlay click, a Cancel
	 * button) resolves `false` — there is no separate "dismissed" outcome for this
	 * caller to distinguish from an explicit decline. The supplier must never REJECT:
	 * `pointerUp` dispatches `complete()` with no `.catch`, so a rejection here would
	 * surface as an unhandled promise rejection rather than as a declined gesture.
	 */
	readonly confirmRecalibration: () => Promise<boolean>;
	/** Per gesture — the reversible command holds that one transaction's inverse state. */
	readonly createCommand: () => CalibratePlanTransaction;
	/**
	 * Where a refused calibration reaches the user — a revision conflict on the sidecar (a
	 * second leaf, a synced file, `plan-geometry.external-modification`) or a degenerate
	 * scale the form's own guard let through. `DrawPolygonTool` and `SelectTool` carry the
	 * identical seam for their own refused dispatches — and takes the same TYPE they do,
	 * an `AppError`, so the notice reporting it can resolve the user-facing copy from the
	 * error's `code`. Declared as `{ message: string }` for two slices, which is exactly
	 * what made this one gesture report a refusal in the log's own untranslated words.
	 */
	readonly reportRejected: (error: AppError) => void;
}

/**
 * The first concrete editor tool (design slice 7): a two-click pick over the background
 * of what the user knows to be a real-world length. Both points arrive as
 * `event.worldPoint` — already through `screenToWorld` before the event was raised — and
 * are never reconverted here; per ADR-009 no editor tool performs its own pixel math.
 *
 * **Shift constrains the second point** to a whole angle from the first, which is what makes
 * measuring a wall that runs along an axis a matter of pointing at it rather than of hitting
 * a pixel. See `constrained`.
 *
 * The command is dispatched through `EditorContext.commandDispatcher` only (SDD §58);
 * repositories and the event bus are invisible from here. `complete` gates a rescale on
 * `deps.confirmRecalibration()` (slice 15) before it ever asks for a distance — gated on
 * whether the plan has spatial objects at all, NOT on whether this is the first
 * calibration, so a fresh import with nothing drawn on it is never asked. This tool has
 * no idea that gate is a dialog: it calls a plain dependency and reacts to `true`/`false`.
 */
export class CalibrateTool implements EditorTool {
	readonly id: ToolId = 'calibrate';

	private context: EditorContext | null = null;
	private pointA: Point | null = null;
	/**
	 * The second point, buffered between the completing `pointerDown` and the `pointerUp`
	 * that actually starts `complete()` — see `pointerUp`'s comment for why the start is
	 * deferred. Both coordinates are captured at `pointerDown` time, exactly as before this
	 * deferral existed: a drag between the two events still calibrates against where the
	 * button went DOWN, not where it comes up, which is today's behaviour and stays that
	 * way. `cancel()` clears it, which is what makes a `pointercancel` (routed here through
	 * `EditorTool.cancel()`) or an intervening Escape leave a later, unmatched `pointerUp`
	 * with nothing to complete.
	 *
	 * The converse — that a buffered completion IS always consumed by its own gesture's
	 * release, rather than surviving to be picked up by the next click's `pointerUp` — is
	 * not this tool's doing: it rests on `PlanCanvas`'s `setPointerCapture` on the down
	 * event, which is what guarantees the matching `pointerup` (or a `pointercancel` if the
	 * capture is broken) reaches this element even when the release happens outside the
	 * pane. Without it a release outside `.rp-plan-canvas` fires neither — `onPointerLeave`
	 * calls no `cancelGesture()` — and this buffer would sit until an unrelated later click's
	 * release completed it. `SelectTool` already depends on the same capture; this tool had
	 * nothing that did until this buffer existed.
	 */
	private pendingCompletion: { readonly pointA: Point; readonly pointB: Point } | null = null;
	/**
	 * Bumped by every `cancel()`/`deactivate()`. `complete()` crosses TWO awaited prompts
	 * (the recalibration confirmation, then the distance), and the user can switch tools
	 * or plans while either sits open — the generation check after EACH await is what
	 * makes a late answer dead rather than a dispatch against whatever editor is active
	 * by then.
	 */
	private generation = 0;
	/**
	 * One gesture at a time. The prompt seam is a plain `Promise`, not a modal that
	 * swallows pointer events, so without this a third click starts a SECOND gesture while
	 * the first answer is still pending: four clicks, two prompts, two calibrations, the
	 * second derived against a scale the first has not landed yet. Ignoring the click is
	 * the answer rather than superseding the pending gesture — the user has already been
	 * asked a question about those two points, and `cancel()` is how they take it back.
	 */
	private prompting = false;

	constructor(private readonly deps: CalibrateToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
	}

	deactivate(): void {
		this.cancel();
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null) {
			return; // an event that arrives before activate() belongs to no editor
		}
		if (event.button !== 'primary') {
			return; // only the primary button places calibration points
		}
		if (this.prompting) {
			return; // a gesture is awaiting its distance; see `prompting`
		}
		if (this.pointA === null) {
			this.pointA = event.worldPoint;
			// A zero-length segment, so the anchor's own marker is drawn before the pointer
			// has moved anywhere: the first click has to leave a trace, or the user cannot
			// tell it registered.
			context.renderState.measurement = { start: event.worldPoint, end: event.worldPoint };
			return; // first point placed; wait for the second click
		}
		const pointA = this.pointA;
		this.pointA = null;
		// The second point is placed here, exactly as before — only the START of `complete()`
		// moves to `pointerUp`. See `pointerUp` for why.
		const pointB = this.constrained(context, pointA, event);
		this.pendingCompletion = { pointA, pointB };
		// And the measured segment STAYS on screen from here through both dialogs: it is the
		// thing the user is being asked to put a length on, so it has to still be visible
		// while they answer. `complete()`'s `finally` is what takes it down.
		context.renderState.measurement = { start: pointA, end: pointB };
	}

	/**
	 * The measured point, pulled onto a whole angle from the anchor while Shift is held —
	 * the same `SnapService.snapDirection` the polygon tool takes, so "hold Shift for a
	 * straight line" means one thing in this editor rather than two.
	 *
	 * It matters more here than it does there: what is being measured is nearly always
	 * something a builder drew straight — a wall, a scale bar, a dimension line — so a
	 * calibration taken a degree off is a scale error carried by every area on the plan.
	 */
	private constrained(context: EditorContext, anchor: Point, event: EditorPointerEvent): Point {
		return event.modifiers.shift
			? context.snapService.snapDirection(anchor, event.worldPoint)
			: event.worldPoint;
	}

	/**
	 * The rubber band from the placed anchor to the pointer — `InteractionLayer` only, no
	 * domain state touched, the same seam `DrawPolygonTool` broadcasts its preview through.
	 *
	 * This method was empty, under a comment claiming a "live preview segment deferred until
	 * a rendering seam exists for tool overlays". That seam has existed since slice 8 wired
	 * `RenderState` into `runtime.ts` and `InteractionLayer` began drawing from it, so the
	 * comment outlived its own condition — and the cost was found by a human calibrating a
	 * plan in a vault and seeing nothing drawn at all.
	 *
	 * `prompting` is in the guard as well as `pointA === null`: once the second point is
	 * placed the segment is the MEASURED one, and a pointer that keeps moving while a dialog
	 * sits open must not drag its end around. `pointA` is already `null` by then, so this is
	 * belt and braces rather than the only thing holding it — kept because the two states
	 * mean different things and a later edit to either should not silently start animating a
	 * segment the user is being asked about.
	 */
	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.pointA === null || this.prompting) return;
		context.renderState.measurement = {
			start: this.pointA,
			end: this.constrained(context, this.pointA, event),
		};
	}

	/**
	 * `complete()` starts HERE, not in `pointerDown` where the second point is placed.
	 * `complete()` may open a dialog (slice 15's recalibration confirmation), synchronously
	 * on this same call stack the first time it awaits nothing yet — and a `pointerdown`'s
	 * own default action runs AFTER this handler returns: Chromium moves focus on a
	 * mousedown, to the nearest FOCUSABLE ANCESTOR of the target — measured in a real browser
	 * as `.rp-plan-canvas`, the `tabindex="0"` wrapper, since the Konva `<canvas>` under the
	 * pointer is not itself focusable. (This paragraph said `<body>` until that measurement
	 * was taken; the mechanism and the fix are unchanged, but the destination was wrong.) A
	 * dialog opened from inside `pointerdown` gets focus stolen out from under it by that
	 * default action; opening from `pointerup` instead means the browser's own focus move
	 * already happened by the time anything here runs, so the dialog's own focus lands last
	 * and stays.
	 *
	 * `pendingCompletion` is what makes this correct rather than merely deferred: it is set
	 * only by the SAME gesture's completing `pointerDown` and cleared by `cancel()`, so a
	 * `pointerUp` with no matching `pointerDown` (nothing buffered) or one that arrives
	 * after a `pointercancel`/Escape cancelled the gesture in between (buffer cleared) both
	 * no-op here — there is nothing to complete either way.
	 *
	 * The `event.button` guard is this method's own, not merely inherited from the canvas's
	 * routing: a mouse shares one `pointerId` across its buttons, so a stray secondary or
	 * auxiliary release while the primary button that placed the second point is still down
	 * must leave `pendingCompletion` buffered for the primary release that actually ends it,
	 * not consume it early.
	 */
	pointerUp(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		const context = this.context;
		const pending = this.pendingCompletion;
		this.pendingCompletion = null;
		if (context === null || pending === null) return;
		// Deliberately fire-and-forget with NO catch: every EXPECTED refusal resolves
		// through the returned `Result`, and `complete()` reports a refused one through
		// `deps.reportRejected` — the same seam `DrawPolygonTool` and `SelectTool` use for
		// their own refused dispatches. A rejection here can only be an unexpected
		// technical fault, which stays loud as an unhandled rejection instead of being
		// silently swallowed.
		void this.complete(context, pending.pointA, pending.pointB);
	}

	cancel(): void {
		const context = this.context;
		this.generation += 1;
		this.pointA = null; // clears a pending first point; no command dispatched
		this.pendingCompletion = null; // and a buffered second point awaiting its pointerUp
		this.prompting = false; // and releases a gesture whose prompt the bump just killed
		// And takes the segment off the canvas. `context` is read before the resets because
		// `deactivate()` calls this BEFORE clearing it — a cancel with no context has nothing
		// drawn to clear anyway.
		if (context !== null) this.clearMeasurement(context);
	}

	/**
	 * Undoes exactly the press that will never be released: the SECOND point goes, and the
	 * first — a complete click, down and up both — is put back where the user left it.
	 *
	 * **`pointA` has to be RESTORED rather than merely left alone, and the first version of
	 * this method got that wrong under a comment asserting the opposite.** Placing the second
	 * point MOVES the anchor: `pointerDown` reads `pointA`, nulls it, and carries the value
	 * inside `pendingCompletion`. So clearing the pending completion alone loses both points
	 * — measured, the next click placed a fresh first point and no calibration was taken at
	 * all — with the abandoned segment still drawn over whatever the user did next. A claim
	 * about which state survives is worth nothing until it is asked of the state machine that
	 * actually moves it.
	 *
	 * Dropping the buffered SECOND point rather than keeping it is the safer of the two, and
	 * the asymmetry is deliberate. If the release does arrive after all, the cost is one
	 * point the user re-picks. If it never does, a kept buffer sits until some unrelated later
	 * click's release completes it — and a calibration taken from a segment the user abandoned
	 * is a scale error that every area on the plan inherits, silently.
	 *
	 * The measurement is redrawn as the zero-length anchor marker, which is exactly what the
	 * first click leaves and therefore what the user was looking at while they chose where to
	 * put the second point. `generation` is NOT bumped and `prompting` is untouched: no prompt
	 * is open at this point in the gesture, and bumping would kill an unrelated in-flight one.
	 */
	abandonGesture(): void {
		const pending = this.pendingCompletion;
		if (pending === null) return; // between clicks: no press is in flight to interrupt
		this.pendingCompletion = null;
		this.pointA = pending.pointA;
		const context = this.context;
		if (context !== null) {
			context.renderState.measurement = { start: pending.pointA, end: pending.pointA };
		}
	}

	private clearMeasurement(context: EditorContext): void {
		context.renderState.measurement = null;
	}

	private async complete(
		context: EditorContext,
		pointA: Point,
		pointB: Point,
	): Promise<void> {
		// Coincident clicks make the scale undefined; refusing here keeps a meaningless
		// number from ever reaching the prompt or the derivation below it.
		const measured = distance(pointA, pointB);
		if (!(measured > 0)) {
			// Two clicks in the same place still drew an anchor marker; nothing is going to
			// be asked about it, so it comes off again here.
			this.clearMeasurement(context);
			return;
		}
		// The plan is bound BEFORE the prompt: whatever the user answers, the points were
		// picked on this plan and calibrate this plan.
		const planId = context.activePlan.id;
		const generation = this.generation;
		this.prompting = true;
		let knownDistance: number | null;
		try {
			// Asked BEFORE the distance, so a user who is going to decline is never made to
			// type a measurement first — and asked only when there is something to lose:
			// see `CalibrateToolDeps.hasSpatialObjects`.
			if (this.deps.hasSpatialObjects() && !(await this.deps.confirmRecalibration())) {
				return;
			}
			// The SAME re-check the distance prompt below gets, and for the same reason:
			// this method now crosses TWO awaits, and a `cancel()` across either one makes
			// every later line belong to a gesture that no longer exists.
			if (generation !== this.generation) {
				return;
			}
			knownDistance = await this.deps.supplyKnownDistance(measured);
		} finally {
			// Only if this gesture is still the live one: a `cancel()` across either await
			// already cleared the flag, and clearing it again would undo a new gesture's
			// claim on it. The segment goes with it — both dialogs are closed by now, on
			// every path out of the `try` including a decline, so what it was there to
			// explain is over. Clearing it unguarded would wipe the anchor a NEW gesture had
			// already drawn while this stale one was still unwinding.
			if (generation === this.generation) {
				this.prompting = false;
				this.clearMeasurement(context);
			}
		}
		if (generation !== this.generation) {
			return; // the gesture was cancelled while its prompt sat open
		}
		if (knownDistance === null || knownDistance <= 0 || !Number.isFinite(knownDistance)) {
			return;
		}
		const command = this.deps.createCommand();
		const input: CalibratePlanInput = {
			planId,
			pointA,
			pointB,
			knownDistance,
		};
		const gesture: UndoableCommand = {
			execute: () => command.execute(input),
			undo: () => command.undo(),
		};
		const result = await context.commandDispatcher.run(gesture);
		if (!result.ok) this.deps.reportRejected(result.error);
	}
}
