import { describe, expect, it } from 'vitest';
import {
	alignDetails,
	distributeDetails,
	MAX_REPEAT_COPIES,
	moveDetails,
	repeatDetails,
	rotateDetails,
	scaleDetails,
	type AlignEdge,
	type ArrangeAxis,
} from '../../../src/domain/asset/arrangeDetails';
import { detailBox } from '../../../src/domain/asset/detailEdits';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { awkwardParts, graphicIds, grouped, requireDetail, threeBoxes, withCurvedPart, withPending } from '../../helpers/arrangeShapes';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Contract C06's composition half: align, distribute, transform a set and repeat. Every case reads
 * a part's CURVE-AWARE box through the same `detailBox` the operations use, so nothing here asserts
 * a corner point an arc reaches past.
 *
 * `threeBoxes` is x -50…50 / 200…400 / 680…720 and y -50…50 / 70…130 / -220…-180, chosen so no two
 * participants share an edge, a centre or a size.
 */

const ALL = ['detail-1', 'detail-2', 'detail-3'];

/** One part's curve-aware box on one shape — the measurement every assertion below is written in. */
const boxOf = (shape: AssetShape, id: string) => expectOk(detailBox(requireDetail(shape, id)));

const code = (result: ReturnType<typeof alignDetails>): string => expectErr(result).code;

describe('alignDetails to the selection bounds', () => {
	/** Every edge, against the box around the three: x -50…720, y -220…130. */
	const cases: ReadonlyArray<readonly [AlignEdge, (id: string, shape: AssetShape) => number, number]> = [
		['left', (id, shape) => boxOf(shape, id).min.x, -50],
		['right', (id, shape) => boxOf(shape, id).max.x, 720],
		['centre-x', (id, shape) => (boxOf(shape, id).min.x + boxOf(shape, id).max.x) / 2, 335],
		['top', (id, shape) => boxOf(shape, id).min.y, -220],
		['bottom', (id, shape) => boxOf(shape, id).max.y, 130],
		['centre-y', (id, shape) => (boxOf(shape, id).min.y + boxOf(shape, id).max.y) / 2, -45],
	];

	it.each(cases)('brings every %s edge onto the bounds', (edge, read, expected) => {
		const shape = expectOk(alignDetails(threeBoxes(), { ids: ALL, edge, reference: { kind: 'bounds' } }));
		for (const id of ALL) expect(read(id, shape)).toBeCloseTo(expected, 9);
	});

	it('moves along one axis only, so two alignments compose', () => {
		const before = threeBoxes();
		const after = expectOk(alignDetails(before, { ids: ALL, edge: 'left', reference: { kind: 'bounds' } }));
		for (const id of ALL) expect(boxOf(after, id).min.y).toBeCloseTo(boxOf(before, id).min.y, 9);
	});

	/**
	 * **The SAME OBJECT back, not an equal one** (contract C05). The first version of this case
	 * asserted `toEqual` and so asserted the defect as correct: an equal-but-fresh shape reaches
	 * `SetAssetShapeCommand`, whose `ALWAYS_CHANGED` compares nothing, and a second press of Align
	 * left costs a sidecar revision and an undo entry that appears to do nothing. Identity is what
	 * `DesignerArrangePanel.commit` compares to answer `editShape`'s `null`, so `toBe` is the
	 * assertion and `toEqual` is the one that cannot tell the two apart.
	 *
	 * It passes trivially against an operation that moves nothing; the six cases above are the
	 * other half, and they assert real movement.
	 */
	it('answers the very shape it was handed once every chosen edge already agrees', () => {
		const once = expectOk(alignDetails(threeBoxes(), { ids: ALL, edge: 'left', reference: { kind: 'bounds' } }));
		expect(expectOk(alignDetails(once, { ids: ALL, edge: 'left', reference: { kind: 'bounds' } }))).toBe(once);
	});

	it('leaves every graphic it was not given exactly where it was', () => {
		const before = threeBoxes();
		const after = expectOk(alignDetails(before, { ids: ['detail-1', 'detail-2'], edge: 'left', reference: { kind: 'bounds' } }));
		expect(requireDetail(after, 'detail-3')).toEqual(requireDetail(before, 'detail-3'));
	});

	it('reads a ROTATED part by its extents and not by its corners', () => {
		// `detail-4` is a 100 × 100 square turned 45°, so its box is the diamond's ~141.42 wide one
		// and its left edge is 300 − 50√2, not 250.
		const before = awkwardParts();
		const diamond = boxOf(before, 'detail-4');
		expect(diamond.min.x).toBeCloseTo(300 - 50 * Math.SQRT2, 9);
		const after = expectOk(alignDetails(before, { ids: ['detail-1', 'detail-4'], edge: 'left', reference: { kind: 'key', id: 'detail-4' } }));
		expect(boxOf(after, 'detail-1').min.x).toBeCloseTo(diamond.min.x, 9);
	});

	it('aligns an OPEN graphic of zero extent by the one coordinate it has', () => {
		// `detail-5` is a vertical line at x = 500: width 0, no interior, and a participant all the
		// same — these operations measure extents, never areas.
		const before = awkwardParts();
		expect(boxOf(before, 'detail-5').max.x - boxOf(before, 'detail-5').min.x).toBe(0);
		const after = expectOk(alignDetails(before, { ids: ['detail-1', 'detail-5'], edge: 'right', reference: { kind: 'key', id: 'detail-1' } }));
		expect(boxOf(after, 'detail-5').min.x).toBeCloseTo(50, 9);
		expect(requireDetail(after, 'detail-5').kind).toBe('open');
	});

	it('reads a CURVED part at the extent its arc reaches', () => {
		const before = withCurvedPart();
		const after = expectOk(alignDetails(before, { ids: ['detail-1', 'detail-4'], edge: 'left', reference: { kind: 'key', id: 'detail-1' } }));
		expect(boxOf(after, 'detail-4').min.x).toBeCloseTo(-50, 9);
		expect(boxOf(after, 'detail-4').max.x).toBeCloseTo(150, 9);
	});
});

describe('alignDetails to a key object', () => {
	/**
	 * **The key part does not move**, which is C06's own sentence and the acceptance criterion this
	 * whole reference option exists for. It passes trivially against an operation that moves nothing,
	 * so the second expectation — that the others DID move onto it — is half of the case, and both
	 * were watched failing against an implementation that took the union box whatever the reference
	 * said.
	 */
	it('leaves the reference exactly where it was and brings the others onto it', () => {
		const before = threeBoxes();
		const after = expectOk(alignDetails(before, { ids: ALL, edge: 'left', reference: { kind: 'key', id: 'detail-2' } }));
		expect(requireDetail(after, 'detail-2')).toEqual(requireDetail(before, 'detail-2'));
		expect(boxOf(after, 'detail-1').min.x).toBeCloseTo(200, 9);
		expect(boxOf(after, 'detail-3').min.x).toBeCloseTo(200, 9);
	});

	it('refuses a reference that is not one of the parts being aligned', () => {
		expect(code(alignDetails(threeBoxes(), { ids: ['detail-1', 'detail-2'], edge: 'left', reference: { kind: 'key', id: 'detail-3' } }))).toBe(
			'asset.key-part-not-selected',
		);
	});
});

describe('alignDetails refusals', () => {
	it('refuses fewer than two participants', () => {
		expect(code(alignDetails(threeBoxes(), { ids: ['detail-1'], edge: 'left', reference: { kind: 'bounds' } }))).toBe('asset.too-few-parts');
	});

	it('refuses a part the design has not got', () => {
		expect(code(alignDetails(threeBoxes(), { ids: ['detail-1', 'detail-9'], edge: 'left', reference: { kind: 'bounds' } }))).toBe('asset.part-not-found');
	});

	/**
	 * A LOCKED participant refuses the whole edit rather than being dropped from it: dropping would
	 * rearrange the others around a part the user can see is locked, and no half-aligned design is
	 * ever handed back (C06). A locked part that is not a participant is simply not written.
	 */
	it('refuses a locked participant, and moves nothing at all', () => {
		const before = threeBoxes();
		const refused = alignDetails(before, { ids: ALL, edge: 'left', reference: { kind: 'bounds' }, immovable: new Set(['detail-3']) });
		expect(expectErr(refused).code).toBe('asset.locked-part');
		const around = expectOk(alignDetails(before, { ids: ['detail-1', 'detail-2'], edge: 'left', reference: { kind: 'bounds' }, immovable: new Set(['detail-3']) }));
		expect(requireDetail(around, 'detail-3')).toEqual(requireDetail(before, 'detail-3'));
	});
});

describe('distributeDetails', () => {
	/** Centres at 0, 300 and 700 in x; evenly spread puts the middle one on 350. */
	it('evens the CENTRES and leaves both endpoints untouched', () => {
		const before = threeBoxes();
		const after = expectOk(distributeDetails(before, { ids: ALL, axis: 'x', spacing: 'centres' }));
		expect((boxOf(after, 'detail-2').min.x + boxOf(after, 'detail-2').max.x) / 2).toBeCloseTo(350, 9);
		expect(requireDetail(after, 'detail-1')).toEqual(requireDetail(before, 'detail-1'));
		expect(requireDetail(after, 'detail-3')).toEqual(requireDetail(before, 'detail-3'));
	});

	/** Span 770, filled 100 + 200 + 40 = 340, so each of the two gaps is 215 and the middle starts at 265. */
	it('evens the GAPS and leaves both endpoints untouched', () => {
		const before = threeBoxes();
		const after = expectOk(distributeDetails(before, { ids: ALL, axis: 'x', spacing: 'gaps' }));
		expect(boxOf(after, 'detail-2').min.x).toBeCloseTo(265, 9);
		expect(boxOf(after, 'detail-2').max.x).toBeCloseTo(465, 9);
		expect(boxOf(after, 'detail-3').min.x - boxOf(after, 'detail-2').max.x).toBeCloseTo(215, 9);
		expect(requireDetail(after, 'detail-1')).toEqual(requireDetail(before, 'detail-1'));
		expect(requireDetail(after, 'detail-3')).toEqual(requireDetail(before, 'detail-3'));
	});

	it('answers a different arrangement for the two modes, so naming one is not decoration', () => {
		const shape = threeBoxes();
		const centres = expectOk(distributeDetails(shape, { ids: ALL, axis: 'x', spacing: 'centres' }));
		const gaps = expectOk(distributeDetails(shape, { ids: ALL, axis: 'x', spacing: 'gaps' }));
		expect(boxOf(centres, 'detail-2').min.x).not.toBeCloseTo(boxOf(gaps, 'detail-2').min.x, 6);
	});

	it('distributes down the other axis on the same rules', () => {
		// y centres are 0, 100 and -200, so ordered they are detail-3, detail-1, detail-2 and the
		// middle one — detail-1 — lands halfway between -200 and 100.
		const after = expectOk(distributeDetails(threeBoxes(), { ids: ALL, axis: 'y', spacing: 'centres' }));
		expect((boxOf(after, 'detail-1').min.y + boxOf(after, 'detail-1').max.y) / 2).toBeCloseTo(-50, 9);
	});

	/**
	 * Two participants whose centres are EQUAL order by the canonical draw order rather than by
	 * whichever the sort happened to visit first, so the same selection distributed twice lands
	 * the same way.
	 */
	it('breaks a tie by the canonical draw order', () => {
		const tied = threeBoxes();
		const moved = expectOk(moveDetails(tied, { ids: ['detail-3'], by: { dx: -700, dy: 0 } }));
		const first = expectOk(distributeDetails(moved, { ids: ALL, axis: 'x', spacing: 'centres' }));
		const again = expectOk(distributeDetails(moved, { ids: ALL, axis: 'x', spacing: 'centres' }));
		expect(again).toEqual(first);
	});

	it('handles a zero span by collapsing the interior onto the endpoints rather than refusing', () => {
		const stacked = expectOk(alignDetails(threeBoxes(), { ids: ALL, edge: 'centre-x', reference: { kind: 'bounds' } }));
		const after = expectOk(distributeDetails(stacked, { ids: ALL, axis: 'x', spacing: 'centres' }));
		for (const id of ALL) expect((boxOf(after, id).min.x + boxOf(after, id).max.x) / 2).toBeCloseTo(335, 9);
	});

	/** The same identity rule as the alignment above, at the second control that can repeat itself. */
	it('answers the very shape it was handed once the row is already even', () => {
		const once = expectOk(distributeDetails(threeBoxes(), { ids: ALL, axis: 'x', spacing: 'centres' }));
		expect(expectOk(distributeDetails(once, { ids: ALL, axis: 'x', spacing: 'centres' }))).toBe(once);
	});

	it('refuses fewer than three participants, which have no interior to distribute', () => {
		expect(code(distributeDetails(threeBoxes(), { ids: ['detail-1', 'detail-2'], axis: 'x', spacing: 'centres' }))).toBe('asset.too-few-parts');
	});

	it('refuses a locked participant', () => {
		expect(code(distributeDetails(threeBoxes(), { ids: ALL, axis: 'x', spacing: 'gaps', immovable: new Set(['detail-2']) }))).toBe('asset.locked-part');
	});
});

describe('moving, rotating and scaling a set', () => {
	it('translates every participant and nothing else', () => {
		const before = threeBoxes();
		const after = expectOk(moveDetails(before, { ids: ['detail-1', 'detail-2'], by: { dx: 10, dy: -5 } }));
		expect(boxOf(after, 'detail-1').min.x).toBeCloseTo(-40, 9);
		expect(boxOf(after, 'detail-2').min.y).toBeCloseTo(65, 9);
		expect(requireDetail(after, 'detail-3')).toEqual(requireDetail(before, 'detail-3'));
	});

	it('answers the very shape it was handed for a move of zero', () => {
		const before = threeBoxes();
		expect(expectOk(moveDetails(before, { ids: ALL, by: { dx: 0, dy: 0 } }))).toBe(before);
	});

	it('refuses a locked participant on a move', () => {
		expect(code(moveDetails(threeBoxes(), { ids: ['detail-1'], by: { dx: 1, dy: 0 }, immovable: new Set(['detail-1']) }))).toBe('asset.locked-part');
	});

	it('rotates the set about the centre of their shared box, not about each part’s own', () => {
		// The shared box of detail-1 and detail-3 is x -50…720, y -220…50, so its centre is
		// (335, -85); a quarter turn takes detail-1's centre (0, 0) to (250, -420).
		const after = expectOk(rotateDetails(threeBoxes(), { ids: ['detail-1', 'detail-3'], radians: Math.PI / 2 }));
		const moved = boxOf(after, 'detail-1');
		expect((moved.min.x + moved.max.x) / 2).toBeCloseTo(250, 9);
		expect((moved.min.y + moved.max.y) / 2).toBeCloseTo(-420, 9);
	});

	it('scales the set proportionally about that same centre, keeping a circular arc circular', () => {
		const before = withCurvedPart();
		const after = expectOk(scaleDetails(before, { ids: ['detail-4'], factor: 2 }));
		const disc = boxOf(after, 'detail-4');
		expect(disc.max.x - disc.min.x).toBeCloseTo(400, 9);
		expect(disc.max.y - disc.min.y).toBeCloseTo(400, 9);
		// Scaling one part about its own box centre leaves that centre where it was.
		expect((disc.min.x + disc.max.x) / 2).toBeCloseTo(1000, 9);
		expect(requireDetail(after, 'detail-4').outline.bulges).toEqual(requireDetail(before, 'detail-4').outline.bulges);
	});

	it('refuses a non-positive or non-finite scale factor', () => {
		expect(code(scaleDetails(threeBoxes(), { ids: ALL, factor: 0 }))).toBe('asset.invalid-scale');
		expect(code(scaleDetails(threeBoxes(), { ids: ALL, factor: Number.NaN }))).toBe('asset.invalid-scale');
		// The NEGATIVE arm by name, although it shares a branch with zero. A negative factor is a
		// MIRROR (`shapeEdits.ts`: "Only a mirror flips a bulge's sign, which is why a non-positive
		// factor is refused"), and no asset can be mirrored anywhere in this product — so this is
		// the door where that category claim is checked rather than argued. Zero and NaN are
		// degenerate geometry; only this one is the operation that does not exist.
		expect(code(scaleDetails(threeBoxes(), { ids: ALL, factor: -1 }))).toBe('asset.invalid-scale');
	});

	it('refuses a non-finite rotation through the validator rather than through a guard of its own', () => {
		expect(code(rotateDetails(threeBoxes(), { ids: ALL, radians: Number.POSITIVE_INFINITY }))).toBe('asset.invalid-detail');
	});
});

describe('repeatDetails', () => {
	it('adds count copies, appended in order, stepped by the CENTRE distance', () => {
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 3, axis: 'x', spacing: 150, mode: 'centres' }));
		expect(graphicIds(after)).toEqual(['detail-1', 'detail-2', 'detail-3', 'detail-4', 'detail-5', 'detail-6']);
		expect(boxOf(after, 'detail-4').min.x).toBeCloseTo(100, 9);
		expect(boxOf(after, 'detail-5').min.x).toBeCloseTo(250, 9);
		expect(boxOf(after, 'detail-6').min.x).toBeCloseTo(400, 9);
	});

	it('steps by the selection’s own extent plus the GAP when that is what spacing means', () => {
		// detail-1 is 100 wide, so a 20 mm gap steps 120 and the first copy starts 20 past its right edge.
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 2, axis: 'x', spacing: 20, mode: 'gaps' }));
		expect(boxOf(after, 'detail-4').min.x).toBeCloseTo(70, 9);
		expect(boxOf(after, 'detail-5').min.x).toBeCloseTo(190, 9);
	});

	it('repeats several graphics as a block, measured by their shared extent', () => {
		// detail-1 and detail-2 span x -50…400, so a zero gap puts the first copy of detail-1 at 400.
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1', 'detail-2'], count: 1, axis: 'x', spacing: 0, mode: 'gaps' }));
		expect(boxOf(after, 'detail-4').min.x).toBeCloseTo(400, 9);
		expect(boxOf(after, 'detail-5').min.x).toBeCloseTo(650, 9);
	});

	it('steps down the other axis', () => {
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 1, axis: 'y', spacing: 200, mode: 'centres' }));
		expect(boxOf(after, 'detail-4').min.y).toBeCloseTo(150, 9);
		expect(boxOf(after, 'detail-4').min.x).toBeCloseTo(-50, 9);
	});

	/**
	 * Ids are never RECYCLED: `detail-2` is deleted, and the copies still start above the highest
	 * suffix the shape ever carried rather than at the first free number.
	 */
	it('assigns ids above the highest suffix, never reusing one a delete freed', () => {
		const gapped = threeBoxes({ details: threeBoxes().details.filter((detail) => detail.id !== 'detail-2') });
		const after = expectOk(repeatDetails(gapped, { ids: ['detail-1'], count: 2, axis: 'x', spacing: 10, mode: 'centres' }));
		expect(graphicIds(after)).toEqual(['detail-1', 'detail-3', 'detail-4', 'detail-5']);
	});

	it('gives each copy of a group its own new group over the copies, keeping the label', () => {
		const before = grouped(['detail-1', 'detail-2'], { label: 'legs' });
		const after = expectOk(repeatDetails(before, { ids: ['detail-1', 'detail-2'], count: 2, axis: 'x', spacing: 1000, mode: 'centres' }));
		expect(after.groups).toEqual([
			{ id: 'group-1', label: 'legs', members: ['detail-1', 'detail-2'] },
			{ id: 'group-2', label: 'legs', members: ['detail-4', 'detail-5'] },
			{ id: 'group-3', label: 'legs', members: ['detail-6', 'detail-7'] },
		]);
	});

	it('copies only the members it was given, so a partly selected group copies partly', () => {
		const before = grouped(['detail-1', 'detail-2']);
		const after = expectOk(repeatDetails(before, { ids: ['detail-2'], count: 1, axis: 'x', spacing: 1000, mode: 'centres' }));
		expect(after.groups?.at(-1)).toEqual({ id: 'group-2', members: ['detail-4'] });
	});

	it('makes no group at all where no participant was in one', () => {
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 1, axis: 'x', spacing: 10, mode: 'centres' }));
		expect(after.groups).toEqual([]);
	});

	it('keeps an OPEN graphic open when it repeats it', () => {
		const after = expectOk(repeatDetails(awkwardParts(), { ids: ['detail-5'], count: 1, axis: 'x', spacing: 50, mode: 'centres' }));
		expect(requireDetail(after, 'detail-6').kind).toBe('open');
		expect(boxOf(after, 'detail-6').min.x).toBeCloseTo(550, 9);
	});

	it.each([0, -1, 1.5, MAX_REPEAT_COPIES + 1, Number.NaN])('refuses a count of %s', (count) => {
		expect(code(repeatDetails(threeBoxes(), { ids: ['detail-1'], count, axis: 'x', spacing: 10, mode: 'centres' }))).toBe(
			'asset.repeat-count-out-of-range',
		);
	});

	it('accepts the limit itself', () => {
		const after = expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: MAX_REPEAT_COPIES, axis: 'x', spacing: 10, mode: 'centres' }));
		expect(after.details).toHaveLength(3 + MAX_REPEAT_COPIES);
	});

	it('refuses a non-finite spacing', () => {
		expect(code(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 1, axis: 'x', spacing: Number.NaN, mode: 'centres' }))).toBe(
			'asset.repeat-spacing-invalid',
		);
	});

	it('refuses a part the design has not got, and writes nothing', () => {
		expect(code(repeatDetails(threeBoxes(), { ids: ['detail-9'], count: 1, axis: 'x', spacing: 10, mode: 'centres' }))).toBe('asset.part-not-found');
	});
});

describe('the axes a caller may name', () => {
	it.each<ArrangeAxis>(['x', 'y'])('repeats along %s', (axis) => {
		expect(expectOk(repeatDetails(threeBoxes(), { ids: ['detail-1'], count: 1, axis, spacing: 10, mode: 'gaps' })).details).toHaveLength(4);
	});
});

describe('a selection mixing background pixels with millimetres (ruling AD10-R1)', () => {
	/**
	 * Every operation the ruling binds, driven through the ONE funnel it names: `participants`.
	 * `moveDetails` is in the table because it used to call `resolveParticipants` directly — it needs
	 * no boxes — which left the move-by fields taking a mixed selection through the back door while
	 * the other four refused it.
	 *
	 * Not in the table, deliberately: grouping (`groupEdits.test.ts` asserts it stays allowed, since a
	 * group carries no coordinates) and `moveGroupToEnd`, which takes a group id rather than a
	 * selection and reorders an array rather than writing a coordinate.
	 */
	const spatial: ReadonlyArray<readonly [string, (shape: AssetShape, ids: readonly string[]) => ReturnType<typeof alignDetails>]> = [
		['align', (shape, ids) => alignDetails(shape, { ids, edge: 'left', reference: { kind: 'bounds' } })],
		['distribute', (shape, ids) => distributeDetails(shape, { ids, axis: 'x', spacing: 'centres' })],
		['move', (shape, ids) => moveDetails(shape, { ids, by: { dx: 10, dy: 0 } })],
		['rotate', (shape, ids) => rotateDetails(shape, { ids, radians: 1 })],
		['scale', (shape, ids) => scaleDetails(shape, { ids, factor: 2 })],
		['repeat', (shape, ids) => repeatDetails(shape, { ids, count: 1, axis: 'x', spacing: 10, mode: 'centres' })],
	];

	it.each(spatial)('refuses %s across the two spaces, rather than laundering pixels into millimetres', (_name, run) => {
		expect(code(run(withPending(['detail-3']), ALL))).toBe('asset.mixed-coordinate-spaces');
	});

	/**
	 * **The refusal is about MIXING, never about being unscaled**, which the ruling says in as many
	 * words. Without this half a check that refused every pending graphic would pass the six above.
	 */
	it.each(spatial)('arranges an ALL-pending selection on %s, which shares one coordinate space', (_name, run) => {
		expect(run(withPending(ALL), ALL).ok).toBe(true);
	});
});
