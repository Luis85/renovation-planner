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
