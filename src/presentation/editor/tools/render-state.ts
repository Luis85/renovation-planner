import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * The polygon a drawing tool is part way through: the vertices the user has actually
 * PLACED, where the pointer is right now, and whether a click at that pointer would close
 * the shape.
 *
 * Its own field rather than a reuse of `previewPolygon`, for the reason `measurement` is
 * one too — the fields mean different things and the layer draws them differently. Two
 * concrete reasons here, and the second is the load-bearing one:
 *
 * - The placed vertices and the live cursor cannot share one array. Every placed vertex is
 *   drawn as a circle and the cursor is not, so a flat `[...buffer, pointer]` — which is
 *   what `previewPolygon` carried — leaves the layer unable to tell the user's clicks from
 *   where their mouse happens to be.
 * - `previewPolygon` has a SECOND writer. `SelectTool` puts the translated ghost of a
 *   dragged zone in it, so giving that field vertex circles and a close target would have
 *   changed a third tool's picture in the same edit, for no reason anybody asked for.
 */
export interface PolygonSketch {
	/** Placed by a click; every one of them is drawn. */
	readonly vertices: readonly Point[];
	/** The rubber band's loose end, `null` before the pointer has moved at all. */
	readonly cursor: Point | null;
	/**
	 * The pointer is within closing distance of the first vertex AND there are enough
	 * vertices for a close to be legal — i.e. a click right now closes the polygon. The TOOL
	 * decides this rather than the layer: the layer is `listening: false` by design (SDD
	 * §62), and the tolerance is the tool's own, converted through the current camera, so
	 * asking the layer to re-derive it would be a second answer to the same question.
	 */
	readonly closeArmed: boolean;
}

/**
 * Transient-only visuals (SDD §19, design slice 6): hover, an in-progress preview
 * polygon, a marquee-select rectangle, snap guides, the calibration segment, and the
 * polygon being sketched. None of these fields is ever persisted, and none of it is domain
 * state — a Plan closed and reopened starts every one of them fresh.
 *
 * **A plain class, not a slot on `EditorStore`** (`src/presentation/stores/EditorStore.ts`,
 * Pinia). That file already carries `hoveredObjectId` and `temporaryPolygon` refs, each
 * marked `// fallow-ignore-next-line unused-store-member` and commented as waiting for
 * a concrete tool to give them a reader — this class deliberately does not become that reader,
 * and those two slots are left exactly as they are. The reason: nothing in design slice 6
 * is wired into the composition root yet (no `ToolManager`, no concrete tool constructs an
 * `EditorContext`), so there is no seam at which `EditorStore` could actually own this
 * state today. Wiring these two homes for "hovered object id" together — by retiring
 * `EditorStore`'s slots, by having it delegate to an instance of this class, or some other
 * seam — is later work for whichever task first constructs a `ToolManager`/`EditorContext`
 * at the composition root, not this one.
 */
export class RenderState {
	hoveredObjectId: string | null = null;
	previewPolygon: readonly Point[] | null = null;
	marquee: BoundingBox | null = null;
	snapGuides: LineSegment[] = [];
	/**
	 * The two points a calibration is being measured between — its own field rather than a
	 * two-point `previewPolygon`, because the two mean different things and a walkthrough
	 * asked for exactly that distinction: a polygon preview says "you are drawing a zone",
	 * and `InteractionLayer` draws it dashed and closed. A calibration is a measurement, so
	 * `InteractionLayer` rules it like a measuring tape instead — solid and open, capped by a
	 * perpendicular bar at each end, ticked along its length (`layers/rulerGeometry.ts`).
	 * Reusing the polygon field would have shown the user the wrong verb at the one moment
	 * they said they could not tell what was happening.
	 */
	measurement: LineSegment | null = null;
	/** The in-progress polygon; see `PolygonSketch` for why it is not `previewPolygon`. */
	polygonSketch: PolygonSketch | null = null;

	reset(): void {
		this.hoveredObjectId = null;
		this.previewPolygon = null;
		this.marquee = null;
		this.snapGuides = [];
		this.measurement = null;
		this.polygonSketch = null;
	}
}
