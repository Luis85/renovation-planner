/**
 * The two `SnapService` entries that answer WITH their guides (smart alignment guides
 * increment, spec §3): `snapPointWithGuides` for one dragged point and `snapTranslation` for a
 * body move. Precedence is vertex, then edge, then x/y axis alignment decided independently —
 * pinned here with the case where the later stage is strictly nearer and still loses.
 */
import { describe, expect, it } from 'vitest';
import { SnapService } from '../../../../src/presentation/editor/snapping/snap-service';

const TOLERANCE = 10;
const service = () => new SnapService({ gridSpacingMm: 100, toleranceMm: TOLERANCE, angleStepRadians: Math.PI / 2 });
const disabled = () => new SnapService({ gridSpacingMm: 100, toleranceMm: TOLERANCE, angleStepRadians: Math.PI / 2 }, () => false);

describe('SnapService.snapPointWithGuides', () => {
	it('answers the input with no guides when nothing is within tolerance', () => {
		expect(service().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 50, y: 50 }], alignments: [{ x: 50, y: 50 }] }))
			.toEqual({ point: { x: 0, y: 0 }, guides: [] });
	});

	it('answers the input object ITSELF, not a copy, when no stage fires', () => {
		// `snapPoint` callers pin this with `toBe` (curvedPresentation, editorSnapPreference);
		// a `landed` object built unconditionally would turn every one of them red.
		const point = { x: 0, y: 0 };
		expect(service().snapPointWithGuides(point, { vertices: [{ x: 50, y: 50 }], alignments: [{ x: 50, y: 50 }] }).point).toBe(point);
	});

	it('a vertex within tolerance wins over a strictly nearer alignment, with one guide pointer → vertex', () => {
		const result = service().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 8, y: 0 }], alignments: [{ x: 1, y: 40 }] });
		expect(result.point).toEqual({ x: 8, y: 0 });
		expect(result.guides).toEqual([{ start: { x: 0, y: 0 }, end: { x: 8, y: 0 } }]);
	});

	it('an edge within tolerance wins over an alignment, with one guide pointer → projection', () => {
		const result = service().snapPointWithGuides({ x: 50, y: 6 }, { edges: [{ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }], alignments: [{ x: 49, y: 40 }] });
		expect(result.point).toEqual({ x: 50, y: 0 });
		expect(result.guides).toEqual([{ start: { x: 50, y: 6 }, end: { x: 50, y: 0 } }]);
	});

	it('aligns x and y independently and both may fire, one guide per axis from the landed point', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 204 }, { alignments: [{ x: 100, y: 500 }, { x: 900, y: 200 }] });
		expect(result.point).toEqual({ x: 100, y: 200 });
		expect(result.guides).toEqual([
			{ start: { x: 100, y: 200 }, end: { x: 100, y: 500 } },
			{ start: { x: 100, y: 200 }, end: { x: 900, y: 200 } },
		]);
	});

	it('aligns one axis and leaves the other where the pointer is', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 700 }, { alignments: [{ x: 100, y: 500 }] });
		expect(result.point).toEqual({ x: 100, y: 700 });
		expect(result.guides).toEqual([{ start: { x: 100, y: 700 }, end: { x: 100, y: 500 } }]);
	});

	it('aligns y alone the same way, the mirror of the case above', () => {
		const result = service().snapPointWithGuides({ x: 700, y: 203 }, { alignments: [{ x: 500, y: 200 }] });
		expect(result.point).toEqual({ x: 700, y: 200 });
		expect(result.guides).toEqual([{ start: { x: 700, y: 200 }, end: { x: 500, y: 200 } }]);
	});

	it('takes the NEAREST alignment on an axis, not the first', () => {
		const result = service().snapPointWithGuides({ x: 103, y: 0 }, { alignments: [{ x: 110, y: 1 }, { x: 100, y: 2 }] });
		expect(result.point.x).toBe(100);
		expect(result.guides[0]?.end).toEqual({ x: 100, y: 2 });
	});

	it('a disabled service answers the input with no guides even with a vertex under the pointer', () => {
		expect(disabled().snapPointWithGuides({ x: 0, y: 0 }, { vertices: [{ x: 0, y: 0 }], alignments: [{ x: 0, y: 0 }] }))
			.toEqual({ point: { x: 0, y: 0 }, guides: [] });
	});

	it('snapPoint is the point half of the same answer', () => {
		const candidates = { alignments: [{ x: 100, y: 500 }] };
		const s = service();
		expect(s.snapPoint({ x: 103, y: 0 }, candidates)).toEqual(s.snapPointWithGuides({ x: 103, y: 0 }, candidates).point);
	});
});

describe('SnapService.snapTranslation', () => {
	const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
	const NONE = { correction: { dx: 0, dy: 0 }, guides: [] };

	it('answers zero with no guides when nothing is within tolerance, and for an empty moving set', () => {
		expect(service().snapTranslation(square, { vertices: [{ x: 500, y: 500 }], alignments: [{ x: 500, y: 500 }] })).toEqual(NONE);
		expect(service().snapTranslation([], { vertices: [{ x: 0, y: 0 }] })).toEqual(NONE);
	});

	it('a vertex pair within tolerance wins over a nearer axis alignment; correction is ONE vector', () => {
		// The square's (100, 100) corner is 8 from the candidate vertex (108, 100); an alignment at x=101 is nearer.
		const result = service().snapTranslation(square, { vertices: [{ x: 108, y: 100 }], alignments: [{ x: 101, y: 900 }] });
		expect(result.correction).toEqual({ dx: 8, dy: 0 });
		expect(result.guides).toEqual([{ start: { x: 100, y: 100 }, end: { x: 108, y: 100 } }]);
	});

	it('the NEAREST vertex pair decides when several are within tolerance', () => {
		const result = service().snapTranslation(square, { vertices: [{ x: 109, y: 0 }, { x: 0, y: 103 }] });
		expect(result.correction).toEqual({ dx: 0, dy: 3 });
	});

	it('an edge projection within tolerance wins over an axis alignment', () => {
		// The square's bottom edge projects onto the candidate edge y=-6, 6 away; an alignment at y=-1 is nearer.
		const result = service().snapTranslation(square, { edges: [{ start: { x: 0, y: -6 }, end: { x: 200, y: -6 } }], alignments: [{ x: 900, y: -1 }] });
		// Both (0, 0) and (100, 0) project at distance 6; the first in iteration order keeps the tie.
		expect(result.correction).toEqual({ dx: 0, dy: -6 });
		expect(result.guides).toEqual([{ start: { x: 0, y: 0 }, end: { x: 0, y: -6 } }]);
	});

	it('aligns the box centre on x and a vertex on y, independently, each guide from the corrected feature', () => {
		// centre (50, 50): alignment x=53 pulls it right by 3 (every vertex is 47+ away). y=104 is 4 from
		// the y=100 vertices; (100, 100) is the first of them in iteration order, so it is the feature.
		const result = service().snapTranslation(square, { alignments: [{ x: 53, y: 900 }, { x: 900, y: 104 }] });
		expect(result.correction).toEqual({ dx: 3, dy: 4 });
		expect(result.guides).toEqual([
			{ start: { x: 53, y: 54 }, end: { x: 53, y: 900 } },
			{ start: { x: 103, y: 104 }, end: { x: 900, y: 104 } },
		]);
	});

	it('an inner vertex is an x feature, so an L-shape aligns on its notch', () => {
		const lShape = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 100 }, { x: 0, y: 100 }];
		// The notch at x=60 is 2 from the alignment at 62; the centre (50) is 12 away, outside tolerance.
		const result = service().snapTranslation(lShape, { alignments: [{ x: 62, y: 900 }] });
		expect(result.correction).toEqual({ dx: 2, dy: 0 });
		expect(result.guides).toEqual([{ start: { x: 62, y: 40 }, end: { x: 62, y: 900 } }]);
	});

	it('a disabled service answers zero with no guides', () => {
		expect(disabled().snapTranslation(square, { vertices: [{ x: 0, y: 0 }] })).toEqual(NONE);
	});

	it('every no-snap answer carries its OWN guides array, so a caller pushing into one cannot corrupt the next', () => {
		// The drag tools hand `guides` straight to render state, which draw-room pushes into.
		const s = service();
		const first = s.snapTranslation([], { vertices: [{ x: 0, y: 0 }] });
		first.guides.push({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } });
		expect(s.snapTranslation([], { vertices: [{ x: 0, y: 0 }] }).guides).toEqual([]);
		expect(disabled().snapTranslation(square, {}).guides).not.toBe(disabled().snapTranslation(square, {}).guides);
	});
});
