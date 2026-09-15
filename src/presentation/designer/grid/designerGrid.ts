import { boundingBoxOf } from '../../../core/geometry/operations';
import { unwrap } from '../../../core/result/Result';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SnapCandidates, SnapGrid } from '../../editor/snapping/snap-service';
import { designerSnapCandidates } from '../selection/snapCandidates';

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

/**
 * The runtime's own `snapCandidates` seam (asset designer snapping spec §4.3): `designerSnapCandidates`
 * over the design as it stands, plus the grid — only while `gridVisible` answers true. Moved out of
 * `runtime.ts`'s `buildRuntime`, beside the step function it composes with, because that closure pushed
 * `buildRuntime` past its own 100-line function budget; the spec's own §4.3 names this as the fallback
 * rather than moving the budget. Every accessor is read PER CALL, like `designerGrid` itself.
 */
export function designerCandidateSupply(
	design: () => AssetShape | null,
	gridVisible: () => boolean,
	worldPerScreenPixel: () => number,
): (exclude?: Iterable<string>) => SnapCandidates {
	return (exclude) => {
		const shape = design();
		const found = designerSnapCandidates(shape, exclude ?? []);
		return gridVisible() ? { ...found, grid: designerGrid(shape, worldPerScreenPixel()) } : found;
	};
}
