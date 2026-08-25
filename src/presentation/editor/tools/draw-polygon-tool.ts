import { distance } from '../../../core/geometry/operations';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
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
 * How close to the first vertex a click must land to close the polygon, in world
 * millimetres. Generous relative to a pointer at usable zooms, small relative to rooms.
 */
const CLOSE_TOLERANCE_MM = 25;

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

	constructor(private readonly deps: DrawPolygonToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.buffer = [];
		this.clearPreview(context);
	}

	deactivate(): void {
		const context = this.context;
		this.buffer = [];
		if (context !== null) this.clearPreview(context);
		this.context = null;
	}

	pointerDown(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || event.button !== 'primary') return;
		const snapped = context.snapService.snapPoint(event.worldPoint, {});
		if (
			this.buffer.length >= 3 &&
			distance(snapped, this.buffer[0]) <= CLOSE_TOLERANCE_MM
		) {
			void this.closePolygon(context);
			return;
		}
		this.buffer.push(snapped);
		context.renderState.previewPolygon = [...this.buffer];
	}

	pointerMove(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.buffer.length === 0) return;
		// Rubber-band preview edge from the last vertex to the pointer — InteractionLayer
		// only, no domain state touched.
		context.renderState.previewPolygon = [...this.buffer, event.worldPoint];
	}

	pointerUp(): void {}

	cancel(): void {
		const context = this.context;
		this.buffer = [];
		if (context !== null) this.clearPreview(context); // no command dispatched
	}

	private clearPreview(context: EditorContext): void {
		context.renderState.previewPolygon = null;
	}

	private async closePolygon(context: EditorContext): Promise<void> {
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
	}
}
