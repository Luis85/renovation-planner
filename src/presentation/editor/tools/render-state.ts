import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * Transient-only visuals (SDD §19, design slice 6): hover, an in-progress preview
 * polygon, a marquee-select rectangle, snap guides, and the calibration segment. None of
 * these five fields is ever persisted, and none of it is domain state — a Plan closed and
 * reopened starts every one of them fresh.
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
	 * it renders solid with a marker at each end. Reusing the polygon field would have shown
	 * the user the wrong verb at the one moment they said they could not tell what was
	 * happening.
	 */
	measurement: LineSegment | null = null;

	reset(): void {
		this.hoveredObjectId = null;
		this.previewPolygon = null;
		this.marquee = null;
		this.snapGuides = [];
		this.measurement = null;
	}
}
