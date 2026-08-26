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
 * is dismissed. It exists because §59's Selection → Inspector pipeline has no Vue
 * Inspector panel yet: the tool states the seam it needs rather than reaching into a UI
 * that does not exist, and the Inspector plugs in here.
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
	 * identical seam for their own refused dispatches.
	 */
	readonly reportRejected: (error: { message: string }) => void;
}

/**
 * The first concrete editor tool (design slice 7): a two-click pick over the background
 * of what the user knows to be a real-world length. Both points arrive as
 * `event.worldPoint` — already through `screenToWorld` before the event was raised — and
 * are never reconverted here; per ADR-009 no editor tool performs its own pixel math.
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
			return; // first point placed; wait for the second click
		}
		const pointA = this.pointA;
		this.pointA = null;
		// The second point is placed here, exactly as before — only the START of `complete()`
		// moves to `pointerUp`. See `pointerUp` for why.
		this.pendingCompletion = { pointA, pointB: event.worldPoint };
	}

	pointerMove(): void {
		// Live preview segment deferred until a rendering seam exists for tool overlays.
	}

	/**
	 * `complete()` starts HERE, not in `pointerDown` where the second point is placed.
	 * `complete()` may open a dialog (slice 15's recalibration confirmation), synchronously
	 * on this same call stack the first time it awaits nothing yet — and a `pointerdown`'s
	 * own default action runs AFTER this handler returns: Chromium moves focus to `<body>`
	 * on a mousedown whose target is not focusable, which the canvas is not. A dialog
	 * opened from inside `pointerdown` gets focus stolen out from under it by that default
	 * action; opening from `pointerup` instead means the browser's own focus-to-`<body>`
	 * move already happened by the time anything here runs, so the dialog's own focus
	 * lands last and stays.
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
		this.generation += 1;
		this.pointA = null; // clears a pending first point; no command dispatched
		this.pendingCompletion = null; // and a buffered second point awaiting its pointerUp
		this.prompting = false; // and releases a gesture whose prompt the bump just killed
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
			// claim on it.
			if (generation === this.generation) {
				this.prompting = false;
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
