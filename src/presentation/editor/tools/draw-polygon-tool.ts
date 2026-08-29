import { coincident } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import type { AppError } from '../../../core/errors/AppError';
import type { CreateZoneInput } from '../../../application/commands/zone/CreateZone';
import type { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
import { closesPolygon } from '../closeTarget';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

/**
 * What closes the polygon on the tool's behalf. A factory rather than an instance: one
 * reversible command holds that ONE creation's snapshot and undo state, exactly like
 * `CalibrateToolDeps.createCommand` for slice 7's calibration.
 */
export interface DrawPolygonToolDeps {
	readonly createCommand: (input: CreateZoneInput) => ReversibleCreateZoneCommand;
	/**
	 * The new zone's display name — counted from what the editor has hydrated, until slice
	 * 16's creation forms ask instead. Not slice 15, which shipped the dialog framework such
	 * a form is mounted in and no form that names a zone.
	 */
	readonly nextZoneName: () => string;
	/**
	 * Where "the polygon could not close" reaches the user. The tool states the seam
	 * instead of reaching into a UI — the same shape `CalibrateTool`'s
	 * `KnownDistanceSupplier` takes for its prompt.
	 */
	readonly reportRejected: (error: AppError) => void;
}

/**
 * The polygon-drawing tool (design slice 8, SDD §57): click places vertices,
 * clicking near the first vertex of a ≥ 3 vertex buffer closes the shape into ONE
 * `ReversibleCreateZoneCommand`, `Escape` discards.
 *
 * Everything before `closePolygon` touches NO domain state: the buffer and the picture of it
 * are transient (`RenderState.polygonSketch`, InteractionLayer only per SDD §19), and
 * `closePolygon()` is the only place the tool talks to the domain — through
 * `context.commandDispatcher` alone (SDD §58).
 *
 * **Shift constrains the next vertex to a whole angle** from the last placed one, through
 * `SnapService.snapDirection` — the service that already owns the angle step. The first
 * vertex is never constrained: there is no previous point to be straight relative to. The
 * constraint moves where a vertex LANDS and deliberately not what CLOSES the shape, which is
 * still judged on the raw pointer; see `canClose`.
 *
 * **The close target's mark and the close CLICK ask the same question.** `InteractionLayer`
 * draws the first vertex differently while a click would close the shape; both it and
 * `canClose()` below call `closesPolygon` (`../closeTarget.ts`), so neither can answer
 * differently from the other. The layer hears no pointer events of its own — it is
 * `listening: false` (SDD §62) — but it does hold the camera and the projected points, which
 * is all that predicate needs.
 *
 * **A rejected close keeps the buffer.** Whether `createPolygon` refuses (fewer than 3
 * usable points after validation, non-finite coordinate) or the dispatched command fails,
 * the in-progress vertices stay: a rejection never discards the user's work — they can
 * keep placing points or cancel deliberately.
 */
export class DrawPolygonTool implements EditorTool {
	readonly id: ToolId = 'draw-polygon';

	private context: EditorContext | null = null;
	private buffer: Point[] = [];
	/**
	 * A close is in flight. `closePolygon` crosses an awaited dispatch with the buffer
	 * deliberately intact (a rejection must keep the user's work), so a second click near
	 * the first vertex during that window would otherwise run the whole close again
	 * against the SAME buffer — two zones, two history entries, one shape.
	 */
	private closing = false;
	/**
	 * Which gesture the tool is currently on. Bumped by everything that abandons the
	 * current one — `activate`, `deactivate` and `cancel` — so the continuation after
	 * `closePolygon`'s awaited dispatch can tell whether the buffer, the sketch and the
	 * selection it is about to touch are still its own.
	 *
	 * Without it, Escape during an in-flight close (which clears `closing`, so further
	 * clicks are accepted) let the user start a new polygon whose vertices the LATE
	 * success then wiped, selecting the zone they had cancelled out of. `CalibrateTool`
	 * has carried this counter since slice 7 for the identical window.
	 */
	private generation = 0;

	constructor(private readonly deps: DrawPolygonToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.buffer = [];
		this.closing = false;
		this.generation += 1;
		this.clearSketch(context);
	}

	deactivate(): void {
		const context = this.context;
		this.buffer = [];
		this.closing = false;
		this.generation += 1;
		if (context !== null) this.clearSketch(context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary' || this.closing) return;
		const landing = this.landingPoint(context, event);
		if (this.canClose(context, event.worldPoint)) {
			this.closing = true;
			// The shape is settled and on its way to being written: a rubber band still tracking
			// the pointer describes a gesture that is over, so it comes down here rather than
			// surviving the dispatch — and a REFUSED close then leaves a clean picture of the
			// buffer it kept.
			this.publishSketch(context, null, null);
			void this.closePolygon(context);
			return;
		}
		// A repeated point is never a vertex. `Polygon` states it — the last→first edge is
		// implicit, "never a repeated closing point" — and a duplicate would give the shape
		// a zero-length edge that area, centroid and hit-testing all divide through. It is
		// reachable precisely because the close test above measures the RAW click while the
		// buffer takes the SNAPPED one: a snap that pulls a near-miss exactly onto an
		// existing vertex fails the close test and would otherwise be pushed as a twin.
		//
		// `coincident`, not `===`: the landing point has been through trigonometry whenever
		// Shift is held, and retracing along a 45 degree ray answers `(0, -1.42e-14)` for a
		// point that is exactly the origin. An exact-equality guard waves that through, and
		// `createPolygon` accepts the sliver it makes — it validates the count and the
		// finiteness of the coordinates, both of which a zero-length edge satisfies.
		if (this.buffer.some((point) => coincident(point, landing))) return;
		this.buffer.push(landing);
		// The pointer is recorded (it is genuinely there, and a third vertex placed within reach
		// of the first should light the close target up at once rather than waiting for a
		// twitch), but there is no loose end yet: a rubber band from the new vertex to itself is
		// a stub of a line drawn out of a click that has just landed.
		this.publishSketch(context, event.worldPoint, null);
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.buffer.length === 0 || this.closing) return;
		// Rubber-band edge from the last vertex to where a click would land — InteractionLayer
		// only, no domain state touched. Whether a click here would CLOSE the shape is not
		// recorded: the layer asks `closesPolygon` per render, so a zoom under a still pointer
		// cannot leave a stale promise on screen.
		this.publishSketch(context, event.worldPoint, this.landingPoint(context, event));
	}

	pointerUp(): void {}

	cancel(): void {
		const context = this.context;
		this.buffer = [];
		this.closing = false;
		this.generation += 1;
		if (context !== null) this.clearSketch(context); // no command dispatched
	}

	/**
	 * **A documented no-op, which is the whole point of this method existing separately.**
	 * This tool places its vertex on `pointerdown` and holds nothing that the matching
	 * `pointerup` would complete — so an interruption between the two has nothing to abandon,
	 * and the buffer it would otherwise reach is the user's accumulated polygon rather than
	 * transient state. Routing focus loss through `cancel()` destroyed every vertex placed
	 * before the click that happened to be in flight.
	 *
	 * `closing` is deliberately untouched: it guards the re-entrancy of an in-flight close and
	 * its staleness is already handled by `generation`, which only a real cancellation bumps.
	 */
	abandonGesture(): void {
		// Nothing is transient here: see above.
	}

	/**
	 * Whether a click at `worldPoint` closes the polygon, asked of `closesPolygon` — the same
	 * predicate `InteractionLayer` asks to decide whether to promise a close, so what the
	 * user sees and what the click does cannot disagree.
	 *
	 * Both points go through the camera first, because the rule is stated in screen pixels: a
	 * closing target is a pointing affordance, and a world-fixed one is a 2.5 px target at the
	 * default zoom that goes sub-pixel when zoomed out.
	 *
	 * Measured against the UNSNAPPED point, so a snap cannot drag a near-miss into a close.
	 */
	private canClose(context: EditorContext, worldPoint: Point): boolean {
		const first = this.buffer.at(0);
		if (first === undefined) return false;
		return closesPolygon(
			this.buffer.length,
			context.viewport.worldToScreen(worldPoint),
			context.viewport.worldToScreen(first),
		);
	}

	/**
	 * Where a click right now would put a vertex: the pointer, pulled onto a whole angle from
	 * the LAST placed vertex while Shift is held, then through the ordinary snap.
	 *
	 * One function for the preview and for the placement, which is the contract `SnapService`
	 * states about itself — the previewed point can never drift from the committed one,
	 * because they are the same call.
	 *
	 * An empty buffer has no anchor and is returned unconstrained: the first click of a
	 * polygon has nothing to be straight relative to, and constraining it against some
	 * invented origin would move a point the user placed deliberately.
	 *
	 * Order: constrain, THEN snap. Unobservable today — both tools hand `snapPoint` an empty
	 * candidate set, so it is the identity — and written this way round deliberately, because
	 * a vertex or edge within tolerance is a real feature of the drawing while a constrained
	 * ray is a straight-edge the user is holding against it. That is the precedence CAD gives
	 * object snap over polar tracking.
	 */
	private landingPoint(context: EditorContext, event: EditorPointerEvent): Point {
		const anchor = this.buffer.at(-1);
		const constrained = event.modifiers.shift && anchor !== undefined
			? context.snapService.snapDirection(anchor, event.worldPoint)
			: event.worldPoint;
		return context.snapService.snapPoint(constrained, {});
	}

	/**
	 * The one write of the in-progress picture. A whole new object each time rather than a
	 * mutation: the field is read through a `reactive()` proxy, and one assignment is one
	 * re-render of the layer.
	 *
	 * It carries no "is the target armed" flag on purpose — see `closeTarget.ts`: the camera
	 * can move without the pointer moving, so an answer stored at `pointermove` time is one
	 * the next zoom makes false while nothing re-runs this.
	 */
	private publishSketch(context: EditorContext, pointer: Point | null, nextVertex: Point | null): void {
		context.renderState.polygonSketch = { vertices: [...this.buffer], pointer, nextVertex };
	}

	private clearSketch(context: EditorContext): void {
		context.renderState.polygonSketch = null;
	}

	private async closePolygon(context: EditorContext): Promise<void> {
		const generation = this.generation;
		try {
			const polygonResult = createPolygon(this.buffer);
			if (!polygonResult.ok) {
				this.deps.reportRejected(polygonResult.error);
				return; // buffer intact — keep the user's in-progress work
			}
			const geometry: Polygon = polygonResult.value;
			const command = this.deps.createCommand({
				planId: context.activePlan.id,
				name: this.deps.nextZoneName(),
				zoneType: 'Room',
				geometry,
			});
			const result = await context.commandDispatcher.run(command);
			// The gesture this close belonged to may be over: Escape, a tool switch or a
			// re-activation happened while the dispatch was in flight. The write landed
			// either way — the refresh decorator puts it on the canvas — but the buffer,
			// the preview and the selection now belong to somebody else and must be left
			// exactly as they are.
			if (generation !== this.generation) return;
			if (!result.ok) {
				this.deps.reportRejected(result.error);
				return; // buffer intact here too
			}
			this.buffer = [];
			this.clearSketch(context);
			// Selecting what was just drawn is safe now: by the time the dispatch resolves, the
			// refresh decorator has re-hydrated the store, so the new zone renders and is a
			// valid hit-test candidate.
			const zoneId = command.createdZoneId;
			if (zoneId !== null) context.selection.select([zoneId]);
		} finally {
			// The window is over whichever way it resolved; the next click is a fresh gesture.
			// Only for the gesture that opened it — a `cancel()` mid-flight has already
			// cleared the flag and started a new one, whose state this must not touch.
			if (generation === this.generation) this.closing = false;
		}
	}
}
