/**
 * The asset designer's marquee RULE (AD08's remainder, contract C05), driven as the pure function it
 * is: two corners and a shape in, a list of parts out. No pointer, no store, no canvas —
 * `designerSelectMarquee.test.ts` is where the gesture around it is driven.
 *
 * Every box here is built through `marqueeBox`, exactly as the tool builds it, so a case cannot
 * accidentally assert about a normalised rectangle the production path never produces.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { marqueeBox, marqueeMembers } from '../../../../src/presentation/designer/selection/marquee';
import { editableShape, openGraphic, shapeWithOpenGraphic, OPEN_POINTS } from '../../../helpers/assetShapes';

/**
 * `editableShape()`: `detail-1` is the straight rectangle x -400..0 by y -100..100, and `detail-2`
 * is a circle of radius 100 about (250, 0) stored as a four-point diamond with quarter bulges. The
 * footprint is x -500..500 by y -300..300 and the clearance reaches y 700, so both of them lie under
 * every box in this file — which is the point of the "graphics only" case.
 */
const SHAPE = editableShape();

/** The ids a marquee between two corners lands on, in the shape's own order. */
function swept(shape: AssetShape, a: Point, b: Point, options: { tolerance?: number; hidden?: Set<string> } = {}): string[] {
	const box = marqueeBox(a, b);
	const members = marqueeMembers(shape, box, {
		tolerance: options.tolerance ?? 1,
		...(options.hidden === undefined ? {} : { hidden: options.hidden }),
	});
	return members.map((member) => (member.kind === 'detail' ? member.id : member.kind));
}

const at = (x: number, y: number): Point => ({ x, y });

describe('the rectangle two corners describe', () => {
	it('is the same box whichever way the pointer travelled', () => {
		const normalised = { min: { x: -10, y: -20 }, max: { x: 30, y: 40 } };

		expect(marqueeBox(at(-10, -20), at(30, 40))).toEqual(normalised);
		expect(marqueeBox(at(30, 40), at(-10, -20))).toEqual(normalised);
		expect(marqueeBox(at(-10, 40), at(30, -20))).toEqual(normalised);
		expect(marqueeBox(at(30, -20), at(-10, 40))).toEqual(normalised);
	});
});

describe('which parts a marquee lands on', () => {
	/**
	 * C05's "one documented rule, never an accidental dependency on drag direction", asked of the
	 * MEMBERS rather than of the box alone: all four corner orders of one rectangle over one graphic
	 * answer the same list.
	 *
	 * **What it catches and what the case above catches are different**, measured rather than
	 * assumed: making `marqueeBox` return `{ min: a, max: b }` unnormalised turns the case above red
	 * and leaves THIS one green, because the slab test is symmetric in a box's two corners and
	 * answers the same for an inverted one. So normalisation is held by the case above, and this
	 * case is what would catch a future inclusion rule that read `min` and `max` directionally — an
	 * enclose-one-way, intersect-the-other rule being exactly the thing C05 forbids.
	 */
	it('selects the same parts left-to-right and right-to-left', () => {
		const corners: [Point, Point][] = [
			[at(-450, -120), at(-380, -80)],
			[at(-380, -80), at(-450, -120)],
			[at(-450, -80), at(-380, -120)],
			[at(-380, -120), at(-450, -80)],
		];

		for (const [from, to] of corners) expect(swept(SHAPE, from, to)).toEqual(['detail-1']);
	});

	it('includes a graphic the box merely CLIPS, rather than only ones it encloses', () => {
		// x -450..-380 by y -120..-80 covers the rectangle's top-left corner and nothing else of it.
		expect(swept(SHAPE, at(-450, -120), at(-380, -80))).toEqual(['detail-1']);
	});

	it('includes a closed graphic the box lies wholly inside', () => {
		expect(swept(SHAPE, at(-300, -50), at(-200, 50))).toEqual(['detail-1']);
	});

	it('takes every graphic it meets, overlapping ones included', () => {
		const overlapping = editableShape({
			details: [
				{ id: 'under', name: 'under', outline: { points: [at(-50, -50), at(50, -50), at(50, 50), at(-50, 50)] }, line: 'solid', pending: false },
				{ id: 'over', name: 'over', outline: { points: [at(-20, -20), at(80, -20), at(80, 80), at(-20, 80)] }, line: 'solid', pending: false },
			],
		});

		// A press has to choose one of two stacked graphics (`hitDesign`'s `findLast`); a sweep does not.
		expect(swept(overlapping, at(-10, -10), at(10, 10))).toEqual(['under', 'over']);
	});

	it('never selects the footprint, the clearance, the anchor or the facing', () => {
		// A box over everything there is. The footprint and the clearance are under it, and C05 keeps
		// them out of bulk composition — a rule that matters here rather than only in the store,
		// because the footprint encloses every graphic and would be in EVERY marquee ever drawn.
		expect(swept(SHAPE, at(-1000, -1000), at(1000, 1000))).toEqual(['detail-1', 'detail-2']);
	});

	it('answers nothing for a box over empty canvas', () => {
		expect(swept(SHAPE, at(600, 600), at(650, 650))).toEqual([]);
	});
});

describe('curved and rotated geometry', () => {
	/**
	 * The box x 150..190 by y -110..-70 meets the circle's lower-left BULGE and nothing else: its
	 * min corner (150, -110) is 148.7 mm from the centre, so it is outside the circle — which rules
	 * out the containment clause — and 210 mm by the diamond's own metric, so it is outside the
	 * stored four-point polygon too. Only the flattened ARC can answer for it.
	 */
	it('finds a graphic by its arc, beyond the chord between the points that are stored', () => {
		expect(swept(SHAPE, at(150, -110), at(190, -70))).toEqual(['detail-2']);
	});

	/**
	 * Rotated geometry, which is where an axis-aligned-bounds rule would be wrong rather than
	 * merely approximate: a 45-degree square's bounding box has four corners its body never
	 * reaches.
	 */
	it('declines a box in a rotated graphic\'s empty bounding-box corner, and takes one on its body', () => {
		const rotated = editableShape({
			details: [{ id: 'rot', name: 'rot', outline: { points: [at(200, 0), at(0, 200), at(-200, 0), at(0, -200)] }, line: 'solid', pending: false }],
		});

		expect(swept(rotated, at(150, 150), at(190, 190))).toEqual([]);
		expect(swept(rotated, at(90, 90), at(130, 130))).toEqual(['rot']);
		expect(swept(rotated, at(-10, -10), at(10, 10))).toEqual(['rot']);
	});

	/**
	 * An OPEN graphic is its stroke and has no interior, exactly as `hitTest.ts` treats a press on
	 * one. `OPEN_POINTS` is an L whose ends imply a triangle; a box inside that triangle is not
	 * inside anything the user drew. (`detail-1` really does cover that point, which is why the
	 * assertion names the list rather than emptiness.)
	 */
	it('takes an open graphic by its stroke and never by the area its ends imply', () => {
		const shape = shapeWithOpenGraphic();

		expect(swept(shape, at(-160, -210), at(-140, -190))).toEqual(['detail-3']);
		expect(swept(shape, at(-120, -60), at(-100, -40))).toEqual(['detail-1']);
	});

	it('finds an open graphic by its own arc', () => {
		// The same L, its first segment bulged: the arc reaches y = -274 while the chord it replaces
		// is the straight y = -200, so a box around y = -280 meets the graphic and no chord of it.
		const shape = editableShape({ details: [openGraphic('curved', OPEN_POINTS, [0.5, 0])] });

		expect(swept(shape, at(-190, -290), at(-150, -270))).toEqual(['curved']);
		expect(swept(shape, at(-190, -250), at(-150, -230))).toEqual([]);
	});
});

describe('what the Parts panel has hidden', () => {
	it('is never a member, because it is not on screen for the user to have swept', () => {
		expect(swept(SHAPE, at(-1000, -1000), at(1000, 1000), { hidden: new Set(['detail-1']) })).toEqual(['detail-2']);
	});

	it('is nothing at all when no hidden set is given', () => {
		expect(swept(SHAPE, at(-1000, -1000), at(1000, 1000))).toEqual(['detail-1', 'detail-2']);
	});
});
