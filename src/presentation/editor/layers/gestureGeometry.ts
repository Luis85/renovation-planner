import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';
import { closesPolygon } from '../closeTarget';
import type { PolygonSketch } from '../tools/render-state';
import type { ScreenPoint } from '../viewport/Viewport';
import { rulerMarks, type RulerMarks } from './rulerGeometry';

/**
 * The gesture pictures both surfaces draw, as ARITHMETIC rather than as a component.
 *
 * `InteractionLayer.vue` drew a polygon sketch and a calibration tape from `RenderState` and
 * was bound to the plan editor's runtime, project store and selection store, so the asset
 * designer could not mount it — and for a whole increment the designer drew nothing while a
 * gesture was in progress: `DrawPolygonTool` closes only on a click within twelve screen pixels
 * of the FIRST vertex, and that vertex was drawn nowhere, so a user traced against an invisible
 * target. Found by an adversarial review. What the two surfaces share is exactly this file:
 * the projection of a sketch and a measurement into screen space, and the close-target rule
 * asked of the projected pointer. Each surface keeps its own template, because the plan
 * editor's also draws a selection and a translated ghost that the designer has no subject for.
 */
export type ToScreen = (point: Point) => ScreenPoint;

export interface SketchScreenGeometry {
	/** Every PLACED vertex, projected; one circle each, the first drawn as the close target. */
	readonly vertices: readonly ScreenPoint[];
	/** The placed vertices plus the loose next one, flattened for a `VLine`; `null` under two points. */
	readonly outlineFlat: readonly number[] | null;
	/** Whether a click where the pointer IS would close the shape — asked of the pointer, never of `nextVertex`. */
	readonly closeArmed: boolean;
}

export function sketchScreenGeometry(sketch: PolygonSketch | null, toScreen: ToScreen): SketchScreenGeometry | null {
	if (sketch === null) return null;
	const vertices = sketch.vertices.map(toScreen);
	const loose = sketch.nextVertex === null ? [] : [toScreen(sketch.nextVertex)];
	const points = [...vertices, ...loose];
	const outlineFlat = points.length < 2 ? null : points.flatMap((at) => [at.x, at.y]);
	const first = vertices.at(0);
	const closeArmed =
		sketch.pointer !== null && first !== undefined && closesPolygon(vertices.length, toScreen(sketch.pointer), first);
	return { vertices, outlineFlat, closeArmed };
}

export function measurementScreenMarks(segment: LineSegment | null, toScreen: ToScreen): RulerMarks | null {
	return segment === null ? null : rulerMarks(toScreen(segment.start), toScreen(segment.end));
}
