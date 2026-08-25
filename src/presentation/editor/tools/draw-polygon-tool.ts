import { distance } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import { screenPoint } from '../viewport/Viewport';
import type { CreateZoneInput } from '../../../application/commands/zone/CreateZone';
import type { ReversibleCreateZoneCommand } from '../../../application/commands/zone/reversible-create-zone-command';
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
	 * The new zone's display name — counted from what the editor has hydrated, until
	 * slice 15's creation dialogs ask instead.
	 */
	readonly nextZoneName: () => string;
	/**
	 * Where "the polygon could not close" reaches the user. The tool states the seam
	 * instead of reaching into a UI — the same shape `CalibrateTool`'s
	 * `KnownDistanceSupplier` takes for its prompt.
	 */
	readonly reportRejected: (error: { message: string }) => void;
}

/**
 * How close to the first vertex a click must land to close the polygon — in SCREEN
 * pixels, converted through the CURRENT camera on every click. A world-fixed tolerance
 * was the first version's defect: 25 mm is a 2.5 px target at the default zoom and goes
 * sub-pixel when zoomed out, making polygons nearly impossible to close exactly when the
 * plan is smallest on screen. Twelve pixels: a deliberate click lands, a vertex-placement
 * click does not stumble into it.
 */
const CLOSE_TOLERANCE_PX = 12;

/**
 * The polygon-drawing tool (design slice 8, SDD §57): click places vertices,
 * clicking near the first vertex of a ≥ 3 vertex buffer closes the shape into ONE
 * `ReversibleCreateZoneCommand`, `Escape` discards.
 *
 * Everything before `closePolygon` touches NO domain state: the buffer and the rubber-band
 * preview are transient (`RenderState.previewPolygon`, InteractionLayer only per SDD §19),
 * and `closePolygon()` is the only place the tool talks to the domain — through
 * `context.commandDispatcher` alone (SDD §58).
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

	constructor(private readonly deps: DrawPolygonToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.buffer = [];
		this.closing = false;
		this.clearPreview(context);
	}

	deactivate(): void {
		const context = this.context;
		this.buffer = [];
		this.closing = false;
		if (context !== null) this.clearPreview(context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary' || this.closing) return;
		const snapped = context.snapService.snapPoint(event.worldPoint, {});
		// Camera-scaled closing tolerance — see the constant's own comment. Measured
		// against the UNSNAPPED click so a grid snap cannot drag a near-miss into a close.
		const zero = context.viewport.screenToWorld(screenPoint(0, 0));
		const one = context.viewport.screenToWorld(screenPoint(1, 0));
		const closeToleranceWorld = CLOSE_TOLERANCE_PX * distance(zero, one);
		if (
			this.buffer.length >= 3 &&
			distance(event.worldPoint, this.buffer[0]) <= closeToleranceWorld
		) {
			this.closing = true;
			void this.closePolygon(context);
			return;
		}
		this.buffer.push(snapped);
		context.renderState.previewPolygon = [...this.buffer];
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.buffer.length === 0 || this.closing) return;
		// Rubber-band preview edge from the last vertex to the pointer — InteractionLayer
		// only, no domain state touched.
		context.renderState.previewPolygon = [...this.buffer, event.worldPoint];
	}

	pointerUp(): void {}

	cancel(): void {
		const context = this.context;
		this.buffer = [];
		this.closing = false;
		if (context !== null) this.clearPreview(context); // no command dispatched
	}

	private clearPreview(context: EditorContext): void {
		context.renderState.previewPolygon = null;
	}

	private async closePolygon(context: EditorContext): Promise<void> {
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
			if (!result.ok) {
				this.deps.reportRejected(result.error);
				return; // buffer intact here too
			}
			this.buffer = [];
			this.clearPreview(context);
			// Selecting what was just drawn is safe now: by the time the dispatch resolves, the
			// refresh decorator has re-hydrated the store, so the new zone renders and is a
			// valid hit-test candidate.
			const zoneId = command.createdZoneId;
			if (zoneId !== null) context.selection.select([zoneId]);
		} finally {
			// The window is over whichever way it resolved; the next click is a fresh gesture.
			this.closing = false;
		}
	}
}
