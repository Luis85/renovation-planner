import type { EntityId } from '../../../core/identity/EntityId';
import type { Point } from '../../../core/geometry/Point';
import { alongWall, wallTangent, type Opening, type Structure, type Wall } from '../../../domain/spatial/Structure';
import { openingSwing } from '../../../domain/spatial/openingSwing';
import { wallSideExtents, wallSideNormal } from '../../../domain/spatial/wallSides';
import { OPENING_CHEVRON_GAP_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';

/**
 * Where a selected opening's handles are — the ONE answer, reached through `selectedOpeningHandles`
 * below by both `OpeningHandles.vue`, the component that draws them, and `openingHandleDoors`,
 * which `resolveSelectionTarget` through `SelectTool` hit-tests against: `selectedOpeningHandles(`
 * has exactly those two callers in `src/` today. Two resolutions here would be two places for what
 * lights up under the pointer and what the canvas draws to disagree; `openingHandlesComponent.test.ts`'s
 * "draws exactly what a press would act on, grip by grip" is the check, not this sentence.
 *
 * World coordinates, not screen: the caller converts. `worldPerPixel` is taken only to decide which
 * marks are far enough apart to be worth drawing, which is the one question that depends on zoom.
 */
export type OpeningGrip = 'width-start' | 'step-back' | 'move' | 'step-forward' | 'width-end' | 'side-left' | 'side-right';
export interface OpeningHandle { readonly grip: OpeningGrip; readonly point: Point }

/** Adjacent marks closer than this in screen pixels are a pile of overlapping targets, not five handles. */
const MIN_SEPARATION_PX = VERTEX_GRAB_RADIUS_PX * 2;

const CENTRE_LINE: readonly { readonly grip: OpeningGrip; readonly fraction: number }[] = [
	{ grip: 'width-start', fraction: 0 },
	{ grip: 'step-back', fraction: 0.25 },
	{ grip: 'move', fraction: 0.5 },
	{ grip: 'step-forward', fraction: 0.75 },
	{ grip: 'width-end', fraction: 1 },
];
const EDGES: readonly OpeningGrip[] = ['width-start', 'move', 'width-end'];

/**
 * The chevrons are NOT subject to the crowding rule above: they sit off the centre-line, so they
 * cannot collide with marks on it however narrow the opening gets. They are absent for
 * `kind: 'opening'`, which has no leaf to put anywhere.
 *
 * `wallSideNormal(tangent, 'a')` is the same vector `openingSymbol` multiplies by `+1` for a `left`
 * swing, so side `a` IS the left face. Asking the domain for it rather than restating the
 * arithmetic here is what stops the chevron and the leaf drifting onto opposite faces.
 */
function chevrons(opening: Opening, host: Wall, worldPerPixel: number): readonly OpeningHandle[] {
	if (openingSwing(opening) === null) return [];
	const middle = opening.offset + opening.width / 2;
	const at = alongWall(host, middle), tangent = wallTangent(host, middle);
	const sides = wallSideExtents(host), gap = OPENING_CHEVRON_GAP_PX * worldPerPixel;
	return ([['side-left', 'a'], ['side-right', 'b']] as const).map(([grip, side]) => {
		const normal = wallSideNormal(tangent, side), reach = sides[side] + gap;
		return { grip, point: { x: at.x + normal.x * reach, y: at.y + normal.y * reach } };
	});
}

export function openingHandles(opening: Opening, host: Wall, worldPerPixel: number): readonly OpeningHandle[] {
	const minimum = MIN_SEPARATION_PX * worldPerPixel;
	const marks = opening.width / 4 >= minimum ? CENTRE_LINE
		: opening.width >= minimum ? CENTRE_LINE.filter(mark => EDGES.includes(mark.grip))
		: CENTRE_LINE.filter(mark => mark.grip === 'move');
	return [
		...marks.map(mark => ({ grip: mark.grip, point: alongWall(host, opening.offset + mark.fraction * opening.width) })),
		...chevrons(opening, host, worldPerPixel),
	];
}

/**
 * The single selected opening's handles — `null` for anything but exactly one opening with a
 * host still in the structure. The ONE place that resolution happens: `openingHandleDoors`'
 * door and `OpeningHandles.vue` both call this rather than each walking `structure.openings`/
 * `structure.walls` by hand, which is what keeps what lights up under the pointer and what the
 * canvas draws from ever being able to disagree.
 */
export function selectedOpeningHandles(
	structure: Structure,
	selectedIds: readonly EntityId<string>[],
	worldPerPixel: number,
): { readonly id: string; readonly handles: readonly OpeningHandle[] } | null {
	if (selectedIds.length !== 1) return null;
	const opening = structure.openings.find(item => item.id === String(selectedIds[0]));
	const host = opening && structure.walls.find(wall => wall.id === opening.hostId);
	return opening && host ? { id: opening.id, handles: openingHandles(opening, host, worldPerPixel) } : null;
}
