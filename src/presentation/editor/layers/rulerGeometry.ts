import type { ScreenPoint } from '../viewport/Viewport';

/**
 * The calibration segment's ruler marks: the spine, a bar capping each end, and the ticks
 * along it — all in STAGE PIXELS, like everything else on the `InteractionLayer`.
 *
 * Pure geometry in its own module rather than arithmetic inside `InteractionLayer.vue`,
 * for the reason this project keeps stating about the canvas: jsdom draws nothing and lays
 * nothing out, so a component asserting a picture can assert almost nothing about it. A
 * function that answers coordinates can be asked whether a bar is perpendicular and whether
 * a tick run is bounded; whether the result READS as a ruler is a capture looked at by eye
 * (`npm run harness`), which no gate here performs.
 *
 * **Screen pixels, and deliberately not world millimetres.** The segment is drawn while the
 * user is establishing what the plan's scale IS — before this gesture completes the plan is
 * usually uncalibrated and its placeholder scale is 1 — so a tick spacing in millimetres
 * would be a measurement nobody has taken. These ticks are a visual metaphor saying "this is
 * a measurement you are taking", never a scale to count off, which is also why nothing here
 * labels one with a unit.
 */

/** Half the length of an end bar; it is centred on its endpoint, so the bar is twice this. */
export const RULER_END_BAR_HALF_PX = 7;
/** How far apart the ticks sit along the spine, before the cap below coarsens them. */
export const RULER_TICK_SPACING_PX = 8;
/** An ordinary tick's length, measured from the spine outward. */
export const RULER_MINOR_TICK_PX = 4;
/** Every `RULER_MAJOR_TICK_EVERY`-th tick, the way a rule marks its counting unit. */
export const RULER_MAJOR_TICK_PX = 7;
export const RULER_MAJOR_TICK_EVERY = 5;
/**
 * The most ticks a segment may produce. A plan zoomed in far enough makes a real wall
 * thousands of pixels long, and this layer re-renders on every pointer move — so the
 * spacing doubles until the run fits rather than the run being truncated half way along the
 * segment, which would look like a defect rather than like a coarser rule.
 */
export const RULER_MAX_TICKS = 48;

/**
 * Which way a zero-length segment points. The first click places `start === end` on purpose,
 * so the anchor is visible before the pointer has moved (`CalibrateTool.pointerDown`), and
 * there is no direction to take a normal from. Any fixed choice draws a legible mark; `NaN`
 * from dividing by a zero length would make the node unrenderable instead.
 */
const FALLBACK_DIRECTION = { x: 1, y: 0 } as const;

interface Vector {
	readonly x: number;
	readonly y: number;
}

/** A flat `[x1, y1, x2, y2]`, which is the shape a Konva `Line`'s `points` config wants. */
export type FlatSegment = readonly number[];

export interface RulerMarks {
	/** The measured segment itself, end to end. */
	readonly spine: FlatSegment;
	/** Exactly two, one centred on each endpoint, perpendicular to the spine. */
	readonly endBars: readonly FlatSegment[];
	/** Interior only — the ends belong to the bars — and all on one side of the spine. */
	readonly ticks: readonly FlatSegment[];
}

function bar(at: ScreenPoint, normal: Vector): FlatSegment {
	return [
		at.x - normal.x * RULER_END_BAR_HALF_PX,
		at.y - normal.y * RULER_END_BAR_HALF_PX,
		at.x + normal.x * RULER_END_BAR_HALF_PX,
		at.y + normal.y * RULER_END_BAR_HALF_PX,
	];
}

/**
 * The spacing this length can afford. Doubling keeps the ticks EVENLY spaced — a coarser
 * rule — where clamping the count would leave a gap at one end.
 */
function affordableSpacing(length: number): number {
	let spacing = RULER_TICK_SPACING_PX;
	while (length / spacing > RULER_MAX_TICKS) spacing *= 2;
	return spacing;
}

function ticksAlong(from: ScreenPoint, direction: Vector, normal: Vector, length: number): FlatSegment[] {
	const spacing = affordableSpacing(length);
	const ticks: FlatSegment[] = [];
	// From 1, and up to but not including the far end: a tick AT either end would sit under an
	// end bar, drawing a heavier mark saying the same thing twice. The bound is the strict
	// `< length` rather than a count of whole intervals, because those differ whenever the
	// length is not an exact multiple of the spacing — `Math.floor(35 / 8)` is 4, so a count
	// bound dropped the tick at 32 and left an 11 px gap before the end bar, and a 15 px
	// segment lost its only tick entirely. Reported by a review bot on the pull request.
	for (let index = 1; index * spacing < length; index += 1) {
		const along = index * spacing;
		const x = from.x + direction.x * along;
		const y = from.y + direction.y * along;
		const size = index % RULER_MAJOR_TICK_EVERY === 0 ? RULER_MAJOR_TICK_PX : RULER_MINOR_TICK_PX;
		// One side only (the `+normal` side), which is what makes the marks read as a rule
		// laid along the segment rather than as a fence built through it.
		ticks.push([x, y, x + normal.x * size, y + normal.y * size]);
	}
	return ticks;
}

export function rulerMarks(from: ScreenPoint, to: ScreenPoint): RulerMarks {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	const direction: Vector =
		length > 0 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : FALLBACK_DIRECTION;
	const normal: Vector = { x: -direction.y, y: direction.x };
	return {
		spine: [from.x, from.y, to.x, to.y],
		endBars: [bar(from, normal), bar(to, normal)],
		ticks: ticksAlong(from, direction, normal, length),
	};
}
