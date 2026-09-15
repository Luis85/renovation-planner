import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapGrid } from '../../editor/snapping/snap-service';

/** The steps a designer grid takes, in millimetres. `MIN_ZOOM`'s 100 mm per pixel still finds 5000. */
const STEPS_MM = [1, 5, 10, 50, 100, 500, 1000, 5000] as const;

/** The least screen distance between two grid lines; below it the grid reads as a tint, not as lines. */
const MIN_STEP_PX = 12;

/**
 * The designer's grid at a camera (asset designer snapping spec 2026-09-15, §2.4): the smallest step at least
 * `MIN_STEP_PX` wide on screen, counted from the committed footprint's box minimum — so an offset from the
 * footprint's edge is a whole number of steps — or from the world origin before there is a footprint. ONE
 * function for the drawn grid, the snapped grid and the status readout, so the three cannot disagree.
 */
export function designerGrid(shape: AssetShape | null, worldPerPixel: number): SnapGrid {
	const step = STEPS_MM.find((candidate) => candidate / worldPerPixel >= MIN_STEP_PX) ?? STEPS_MM[STEPS_MM.length - 1];
	return { step, origin: shape === null ? { x: 0, y: 0 } : unwrap(boundingBoxOf(shape.footprint)).min };
}
