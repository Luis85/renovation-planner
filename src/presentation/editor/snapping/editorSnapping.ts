import { SnapService } from './snap-service';
import type { ToolId } from '../tools/editor-tool';

/**
 * The editor's snapping configuration and the ONE service both editing surfaces snap through
 * — the Plan Editor's tools and the asset designer's alike.
 *
 * It lived in `presentation/editor/runtime.ts` while the Plan Editor was the only surface with
 * tools. The asset designer's own runtime needs the SAME service composed with the SAME step
 * (design slice B5), and a second `new SnapService({...})` beside it would be a second answer
 * to what "constrained" means: two 15 degree steps that could drift into 15 and 22.5 with
 * nothing failing, because each surface's own tests would go on passing about its own number.
 *
 * Stateless (config-only), so one instance serves every leaf of every surface.
 */

/**
 * What the snap service currently buys: **nothing yet.** `SnapService.snapPoint` ranks the
 * candidate vertices and edges it is handed and never consults the grid, and every tool in
 * both surfaces passes an EMPTY candidate set — so `snapPoint` is provably the identity
 * function today and these two numbers reach no arithmetic. The service is wired at the seam it
 * will be used from, which is worth having; the grid it is configured with is not reachable
 * until a caller supplies candidates (the neighbouring zones' vertices and edges, plus
 * `snapToGrid`, which has no caller in `src/` at all).
 *
 * Said here because three comments in the tools used to describe grid snapping as something
 * that happens. The manual case had it right all along —
 * `docs/tests/cases/Zone Editing Walkthrough.md`: "SnapService is wired but this slice hands it
 * no candidate geometry, so nothing visibly snaps yet."
 */
const SNAP_GRID_MM = 100;
const SNAP_TOLERANCE_MM = 8;

/**
 * The Shift constraint's step, exported because a HARNESS standing in for this service must be
 * composed with the same number as the service itself. `tests/helpers/tool-context.ts` is the
 * one that does — it subclasses the real `SnapService` and reads this constant rather than a
 * `Math.PI / 12` copied beside it, so a fake cannot be constrained differently from the thing
 * it stands for. (`tests/helpers/designerRig.ts` needs no such stand-in: it mounts the real
 * designer, which composes `EDITOR_SNAP_SERVICE` below.)
 *
 * 15 degrees, researched rather than invented: CAD polar tracking's step is configurable with
 * 15 among its presets, which is finer than Figma's and Illustrator's 45 and is the right
 * granularity for a wall that runs at an angle.
 */
export const ANGLE_STEP_RADIANS = Math.PI / 12;

export const EDITOR_SNAP_SERVICE = new SnapService({
	gridSpacingMm: SNAP_GRID_MM,
	toleranceMm: SNAP_TOLERANCE_MM,
	angleStepRadians: ANGLE_STEP_RADIANS,
});

/**
 * Which tools take the Shift angle constraint, and therefore the ones whose hint is worth
 * showing in a status bar.
 *
 * A LIST rather than "any tool": Select constrains nothing, and camera mode has no tool at all,
 * so announcing it there would be advertising a key that does nothing. It is the one place the
 * constraint is mentioned to the user — a modifier is invisible, no control shows it and no
 * menu lists it, which is the standing cost of the convention every drawing tool in the field
 * uses, and this is the cheapest honest mitigation: present while the gesture it applies to is
 * available, gone the moment it is not.
 *
 * **ONE list across both surfaces**, though the two surfaces' ids are disjoint. Each status bar
 * asks about the tool ITS manager has active, so a designer id can never be the answer in the
 * Plan Editor and vice versa; what one list buys is that "does this tool constrain" has one
 * answer, so a tool that grows the constraint is advertised the moment it is added here rather
 * than in whichever of two lists its author happened to open.
 */
const CONSTRAINING_TOOLS: readonly ToolId[] = [
	'draw-polygon',
	'draw-area',
	'calibrate',
	'trace-footprint',
	'trace-clearance',
	'set-facing',
];

export function constrainsAngle(activeToolId: ToolId | null): boolean {
	return activeToolId !== null && CONSTRAINING_TOOLS.includes(activeToolId);
}
