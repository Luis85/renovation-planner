import { distance } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type {
	CalibratePlanInput,
	ReversibleCalibratePlanCommand,
} from '../../../application/commands/plan/ReversibleCalibratePlan';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';
import type { UndoableCommand } from './undoable-command';

/**
 * What asks the user for the known real-world distance once two points are placed,
 * answered in world millimetres like every length (ADR-009) — or `null` when the prompt
 * is dismissed. It exists because §59's Selection → Inspector pipeline has no Vue
 * Inspector panel yet: the tool states the seam it needs rather than reaching into a UI
 * that does not exist, and the Inspector (or slice 15's dialogs for the recalibration
 * confirmation this tool deliberately defers) plugs in here.
 */
export type KnownDistanceSupplier = (measuredWorldUnits: number) => Promise<number | null>;

export interface CalibrateToolDeps {
	readonly supplyKnownDistance: KnownDistanceSupplier;
	/** Per gesture — the reversible command holds that one transaction's inverse state. */
	readonly createCommand: () => ReversibleCalibratePlanCommand;
}

/**
 * The first concrete editor tool (design slice 7): a two-click pick over the background
 * of what the user knows to be a real-world length. Both points arrive as
 * `event.worldPoint` — already through `screenToWorld` before the event was raised — and
 * are never reconverted here; per ADR-009 no editor tool performs its own pixel math.
 *
 * The command is dispatched through `EditorContext.commandDispatcher` only (SDD §58);
 * repositories and the event bus are invisible from here. The recalibration-confirmation
 * dialog (slice 15's `ConfirmDialog`, gated on whether the plan has spatial objects at
 * all — NOT on whether this is the first calibration) is deferred with slice 15 itself;
 * until then every completed gesture dispatches directly, which is all of Increment 5.
 */
export class CalibrateTool implements EditorTool {
	readonly id: ToolId = 'calibrate';

	private context: EditorContext | null = null;
	private pointA: Point | null = null;
	/**
	 * Bumped by every `cancel()`/`deactivate()`. `complete()` crosses an awaited prompt,
	 * and the user can switch tools or plans while it sits open — the generation check
	 * after the await is what makes a late answer dead rather than a dispatch against
	 * whatever editor is active by then.
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
		// Deliberately fire-and-forget with NO catch: every EXPECTED refusal resolves
		// through the returned `Result` (derivation, revision conflict), so a rejection
		// here can only be an unexpected technical fault — and that stays loud as an
		// unhandled rejection instead of being silently swallowed. Surfacing the Result
		// itself is Inspector/slice-15 work; nothing renders feedback yet.
		void this.complete(context, pointA, event.worldPoint);
	}

	pointerMove(): void {
		// Live preview segment deferred until a rendering seam exists for tool overlays.
	}

	pointerUp(): void {}

	cancel(): void {
		this.generation += 1;
		this.pointA = null; // clears a pending first point; no command dispatched
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
			knownDistance = await this.deps.supplyKnownDistance(measured);
		} finally {
			// Only if this gesture is still the live one: a `cancel()` across the await
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
		await context.commandDispatcher.run(gesture);
	}
}
