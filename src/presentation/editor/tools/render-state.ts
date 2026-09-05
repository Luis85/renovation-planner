import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * The polygon a drawing tool is part way through: the vertices the user has actually
 * PLACED, where the pointer is right now, and whether a click at that pointer would close
 * the shape.
 *
 * It records only what the USER has done — clicks, and where the pointer is. Whether a click
 * would CLOSE the shape is deliberately NOT here: that answer depends on the camera as well
 * as on the pointer, and the camera moves without the pointer moving (wheel and keyboard zoom
 * stay live while a tool is active), so a stored answer goes stale with nothing to re-run it.
 * `closeTarget.ts` is asked per render instead, by the layer and by the tool alike.
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
	/**
	 * Where the pointer physically is, `null` before it has moved at all. This is what the
	 * close target is judged against, because closing is about pointing AT the first vertex —
	 * a click there closes whatever the angle constraint is doing to the point it would
	 * otherwise place.
	 */
	readonly pointer: Point | null;
	/**
	 * Where a click would actually put the next vertex: the pointer, or — with Shift held —
	 * its projection onto the nearest whole angle from the last placed vertex. The rubber
	 * band's loose end, so the user sees where the vertex lands rather than where their hand
	 * is, and the two differ exactly when the constraint is doing something.
	 *
	 * Separate from `pointer` because they answer different questions, which is this field's
	 * whole history: it started as one `cursor`, and one value cannot be both the place a
	 * vertex will land and the place the close is judged from once Shift can move the first
	 * away from the second.
	 */
	readonly nextVertex: Point | null;
}

/**
 * Transient-only visuals (SDD §19, design slice 6): hover, an in-progress preview
 * polygon, a marquee-select rectangle, snap guides, the calibration segment, and the
 * polygon being sketched. None of these fields is ever persisted, and none of it is domain
 * state — a Plan closed and reopened starts every one of them fresh.
 *
 * **A plain class, not a slot on `EditorStore`** (`src/presentation/stores/EditorStore.ts`,
 * Pinia). That file already carries `hoveredObjectId` and `temporaryPolygon` refs — no
 * production reader yet, only `stores.test.ts`'s direct assert of the store's default shape —
 * this class deliberately does not become that reader, and those two slots are left exactly as
 * they are. The reason: nothing in design slice 6
 * is wired into the composition root yet (no `ToolManager`, no concrete tool constructs an
 * `EditorContext`), so there is no seam at which `EditorStore` could actually own this
 * state today. Wiring these two homes for "hovered object id" together — by retiring
 * `EditorStore`'s slots, by having it delegate to an instance of this class, or some other
 * seam — is later work for whichever task first constructs a `ToolManager`/`EditorContext`
 * at the composition root, not this one.
 */
export class RenderState {
	hoveredObjectId: string | null = null;
	/**
	 * WHAT the hovered target is, beside WHICH one it is (spec §6.2: a body promises a
	 * selection and a vertex handle promises a drag of that vertex, and the cursor has to say
	 * which). `resolveSelectionTarget` has always answered both halves; only the id used to
	 * survive the trip into render state, so the most precise target on the canvas was
	 * announced as an ordinary body hit.
	 *
	 * **A SECOND field rather than a richer `hoveredObjectId`** (R8, 2026-09-04): every reader
	 * of the id — the `InteractionLayer`'s outline, the retirement watcher, its tool tests —
	 * asks only "which id", and widening the field into an object would have moved all of them
	 * for one consumer's benefit. The price is that the two are written and cleared TOGETHER at
	 * every site, which is stated here because nothing in any gate can enforce it: an id with a
	 * stale kind beside it renders the wrong cursor over the right target.
	 */
	hoveredTargetKind: 'body' | 'handle' | null = null;
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
		this.hoveredTargetKind = null;
		this.previewPolygon = null;
		this.marquee = null;
		this.snapGuides = [];
		this.measurement = null;
		this.polygonSketch = null;
	}
}
