import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * Transient-only visuals (SDD §19, design slice 6): hover, an in-progress preview
 * polygon, a marquee-select rectangle, and snap guides. None of these four fields is
 * ever persisted, and none of it is domain state — a Plan closed and reopened starts
 * every one of them fresh.
 *
 * **A plain class, not a slot on `EditorStore`** (`src/presentation/stores/EditorStore.ts`,
 * Pinia). That file already carries `hoveredObjectId` and `temporaryPolygon` refs, each
 * marked `// fallow-ignore-next-line unused-store-member` and commented as waiting for
 * this slice to give them a reader — this class deliberately does not become that reader,
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

	reset(): void {
		this.hoveredObjectId = null;
		this.previewPolygon = null;
		this.marquee = null;
		this.snapGuides = [];
	}
}
