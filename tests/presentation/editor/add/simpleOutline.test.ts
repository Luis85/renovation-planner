import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { crossingFreeOutline, outlineCrosses, simpleAreaOutline } from '../../../../src/presentation/editor/add/simpleOutline';
import { acceptsElementPoints } from '../../../../src/presentation/editor/elements/elementDraft';
import { DrawPolygonTool } from '../../../../src/presentation/editor/tools/draw-polygon-tool';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { Point } from '../../../../src/core/geometry/Point';
import type { Polygon } from '../../../../src/core/geometry/Polygon';
import { createCurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { ok } from '../../../../src/core/result/Result';
import type { SpatialElementKind } from '../../../../src/domain/spatial/SpatialElement';
import { flushGesture as flush, pointerAt as at, toolContext } from '../../../helpers/tool-context';
import { harness, stubCommand } from '../../../helpers/drawPolygonHarness';

const p = (x: number, y: number): Point => ({ x, y });
/** The L-29 gesture: a 4 m x 3 m room whose first corner was dragged across the opposite edge. */
const L29 = [p(0, 0), p(4000, 0), p(4000, 3000), p(-500, -400)];
const RECTANGLE = [p(0, 0), p(4000, 0), p(4000, 3000), p(0, 3000)];
const BOWTIE = [p(0, 0), p(100, 0), p(0, 100), p(50, 100)];

/**
 * The acceptance table the slice was briefed against, driven through the real predicate. Every
 * "accept" row is a degenerate contact a real edit produces and none of them makes the shoelace
 * sum lie; the two refusals are the outlines whose signed area is the DIFFERENCE of two lobes.
 */
describe('outlineCrosses', () => {
	it.each([
		['honest 4 m x 3 m rectangle', RECTANGLE],
		['triangle', [p(0, 0), p(4000, 0), p(0, 3000)]],
		['L-shape', [p(0, 0), p(4000, 0), p(4000, 1000), p(1000, 1000), p(1000, 3000), p(0, 3000)]],
		['concave arrowhead', [p(0, 0), p(4000, 1500), p(0, 3000), p(1200, 1500)]],
		['rectangle with a redundant collinear midpoint', [p(0, 0), p(2000, 0), p(4000, 0), p(4000, 3000), p(0, 3000)]],
		['collinear zero-area triple', [p(0, 0), p(1000, 0), p(2000, 0)]],
		['duplicated consecutive vertex', [p(0, 0), p(4000, 0), p(4000, 0), p(0, 3000)]],
		['repeated closing point', [p(0, 0), p(4000, 0), p(4000, 3000), p(0, 3000), p(0, 0)]],
		['pinched rectangle', [p(0, 0), p(2000, 2000), p(4000, 0), p(4000, 4000), p(2000, 2000), p(0, 4000)]],
		['doubled-back spike', [p(0, 0), p(4000, 0), p(0, 0), p(0, 3000)]],
		// Beyond the briefed table, and the reason the rule is INTERIOR-to-both rather than
		// "not at a shared corner": a corner landing exactly on a non-adjacent edge touches it
		// at that edge's interior but at its OWN endpoint, and encloses its area honestly.
		['corner dragged onto a non-adjacent edge', [p(0, 0), p(4000, 0), p(4000, 3000), p(2000, 0)]],
		// The TOLERANCE, which every other fixture here is too tidy to see. Measured: edges 0
		// and 1 are ADJACENT and share the corner (4000,500), and `circularEdgeIntersections`
		// answers (4000, 500.0000000000001) for them — 1.14e-13 mm off that corner on both
		// edges, against an epsilon of 1e-7. Force the epsilon to 0 (or spell `> 0`) and both
		// `interior` checks pass, so an honest plan is refused. Until this row that was held
		// only by one assertion in `resize/outlineProposal.test.ts`, about typed precision.
		['an honest outline whose corner arithmetic does not land exactly', [p(1234, -765.4), p(4000, 500), p(3000, 2000), p(0, 3000)]],
	])('accepts %s', (_name, points) => {
		expect(outlineCrosses(points)).toBe(false);
	});

	it.each([
		['straight bowtie', BOWTIE],
		['the L-29 corner drag', L29],
	])('refuses %s', (_name, points) => {
		expect(outlineCrosses(points)).toBe(true);
	});

	/**
	 * The compensation the docblock claims, DRIVEN — it was asserted with no curved fixture
	 * anywhere in the slice. Two opposed semicircles each rise 500 mm into an 800 mm gap, so
	 * the arcs cross while the chords are an ordinary rectangle: this predicate accepts it and
	 * `createCurvedPolygon` refuses it. The instrument discriminates rather than always
	 * refusing — measured at 1200 mm, where the same bulges clear each other and core answers
	 * `ok`. What is driven is CORE, not a door: no door here hands a curved outline to
	 * `preservePointCurves` and then to `createCurvedPolygon` in one case, so the route
	 * between the two remains reasoning rather than a measurement.
	 */
	it('judges chords, and core refuses the arcs it cannot see', () => {
		const points = [p(0, 0), p(1000, 0), p(1000, 800), p(0, 800)];
		expect(outlineCrosses(points)).toBe(false);
		expect(createCurvedPolygon({ points, bulges: [-1, 0, -1, 0] }))
			.toMatchObject({ ok: false, error: { code: 'curve-self-intersection' } });
	});
});

/**
 * `createPolygon` and the crossing rule, and no area rule at all — the composition door 1's
 * vertex arm takes so that L-23 stays open there.
 */
describe('crossingFreeOutline', () => {
	it('accepts a zero-area outline and refuses a crossing one', () => {
		expect(crossingFreeOutline([p(0, 0), p(1000, 0), p(2000, 0)])).toMatchObject({ ok: true });
		expect(crossingFreeOutline(L29)).toMatchObject({ ok: false, error: { category: 'Geometry', code: 'polygon-self-intersection' } });
	});
	// `simpleAreaOutline` used to be the only caller of `createPolygon` here, so this arm was
	// reached through `areaOutline`. It is this function's own now.
	it('returns createPolygon\'s refusal before it looks for a crossing', () => {
		expect(crossingFreeOutline([p(0, 0), p(1000, 0)])).toMatchObject({ ok: false, error: { code: 'polygon-too-few-points' } });
	});
});

/**
 * `areaOutline` FIRST — and the collinear row below CANNOT see that, which is why the last row
 * exists. `outlineCrosses` accepts every collinear outline by construction, so a merely
 * collinear one keeps `polygon-zero-area` under either order. The order is observable on
 * exactly one family: an outline that is zero-area AND self-crossing, which reports
 * `polygon-zero-area` here and `polygon-self-intersection` with the two steps swapped.
 */
describe('simpleAreaOutline', () => {
	it('passes an honest outline through unchanged', () => {
		expect(simpleAreaOutline(RECTANGLE)).toEqual({ ok: true, value: { points: RECTANGLE } });
	});
	it('refuses a crossing outline under its own code', () => {
		expect(simpleAreaOutline(L29)).toMatchObject({ ok: false, error: { category: 'Geometry', code: 'polygon-self-intersection' } });
	});
	it.each([
		{ points: [p(0, 0), p(1000, 0)], code: 'polygon-too-few-points' },
		{ points: [p(0, 0), p(1000, 0), p(2000, 0)], code: 'polygon-zero-area' },
		// The ONE fixture the ordering is observable on: the fourth corner sits on the line
		// `4y = 3x - 12000`, where the shoelace sum vanishes, and the edge back to it crosses
		// the first edge at (2000, 0). Both rules refuse it; the order decides under which code.
		{ points: [p(0, 0), p(4000, 0), p(4000, 3000), p(0, -3000)], code: 'polygon-zero-area' },
	])('leaves $code to areaOutline', ({ points, code }) => {
		expect(simpleAreaOutline(points)).toMatchObject({ ok: false, error: { code } });
	});
});

/**
 * DOOR 2's TOOL half: a `DrawPolygonTool` honours whatever `validateOutline` it is given —
 * which this case HANDS it, so it says nothing about the registration. That
 * `registerEditorTools.ts` gives both polygon entries `simpleAreaOutline` is pinned by
 * `tests/presentation/editor/polygonOutlineWiring.test.ts`, through the real mounted editor;
 * reverting both entries used to leave 52 files and 847 tests green.
 */
describe('a drawing gesture that closes into a bowtie', () => {
	it('is refused before a command exists and keeps the buffer', async () => {
		const h = harness();
		const tool = new DrawPolygonTool({
			id: 'draw-polygon',
			validateOutline: simpleAreaOutline,
			completion: { commandFor: geometry => { h.completions.push(geometry); return stubCommand(); } },
			reportRejected: error => h.rejections.push(error.code),
			reportInvalidInput: error => h.rejections.push(error.code),
			onCompleted: () => undefined,
		});
		tool.activate(h.context);
		for (const point of BOWTIE) tool.pointerDown(at(point.x, point.y));
		tool.pointerDown(at(0, 0)); // closes on the first vertex
		await flush();

		expect(h.rejections).toEqual(['polygon-self-intersection']);
		expect(h.completions).toEqual([]);
		expect(h.dispatched).toEqual([]);
		expect(h.context.renderState.polygonSketch?.vertices).toEqual(BOWTIE);
	});
});

/**
 * DOOR 1 — `SelectTool.commit`, which is the gesture L-29 reproduces, driven through the real
 * tool with real pointer events.
 *
 * `commit` chooses its validator on the gesture KIND because its one call site is reached by
 * both: a vertex drag reshapes the outline and is judged, a body drag is a rigid translation
 * (`translate` by one delta, then ONE `snapTranslation` correction added to every point) and so
 * can neither create nor remove a crossing. The body case below is the regression that gating
 * it anyway would cause — a user whose vault already holds a bowtie unable to MOVE it.
 */
const TRIANGLE = [p(0, 0), p(4000, 0), p(0, 3000)];
function selectHarness(points: readonly Point[]): { tool: SelectTool; gestures: Polygon[]; invalid: string[] } {
	setActivePinia(createPinia());
	const { context, rejections } = toolContext({ worldPerScreenPixel: 1, commandDispatcher: { run: () => Promise.resolve(ok('wrote')) } });
	const gestures: Polygon[] = [];
	const invalid: string[] = [];
	const tool = new SelectTool({
		spatialObjects: () => [{ id: 'zone-a', points }],
		createMoveGesture: (_id, forward) => { gestures.push(forward); return { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }; },
		reportRejected: error => rejections.push(error.code),
		reportInvalidInput: error => invalid.push(error.code),
	});
	tool.activate(context);
	return { tool, gestures, invalid };
}
/** Click the body to select, then grab `from` and release at `to`; drains the detached dispatch. */
async function drag(tool: SelectTool, inside: Point, from: Point, to: Point): Promise<void> {
	tool.pointerDown(at(inside.x, inside.y));
	tool.pointerUp(at(inside.x, inside.y));
	tool.pointerDown(at(from.x, from.y));
	tool.pointerMove(at(to.x, to.y));
	tool.pointerUp(at(to.x, to.y));
	await flush();
}

describe('SelectTool.commit', () => {
	it('refuses the L-29 corner drag across the opposite edge', async () => {
		const h = selectHarness(RECTANGLE);
		await drag(h.tool, p(1000, 1000), p(0, 3000), p(-500, -400));
		expect({ gestures: h.gestures.length, invalid: h.invalid }).toEqual({ gestures: 0, invalid: ['polygon-self-intersection'] });
	});

	// L-23 — the zero-area vertex drag — is a policy question this slice does not answer, so
	// door 1 composes `createPolygon` with the crossing rule and NOT `simpleAreaOutline`, which
	// would refuse this under `polygon-zero-area`. The triangle is the fixture that can see it,
	// and the rectangle row is not: RECTANGLE's fourth corner landing on the diagonal keeps the
	// area, so only the triangle row discriminates the two validators.
	//
	// It is NOT that a rectangle cannot reach zero area — an earlier version of this comment
	// said so and it is false. With three corners fixed the shoelace is LINEAR in the fourth
	// and vanishes along `4y = 3x - 12000`; every landing on that line is self-crossing except
	// `(4000,0)`, where the corner coincides with an existing one. So RECTANGLE could have
	// discriminated too, at that single degenerate point. The triangle is the cleaner fixture,
	// not the only possible one.
	it.each([
		['a corner onto the diagonal, keeping the area', RECTANGLE, p(1000, 1000), p(0, 3000), p(2000, 1500)],
		['a corner onto the opposite edge, collapsing the area to zero', TRIANGLE, p(500, 500), p(0, 3000), p(2000, 0)],
	])('dispatches a vertex drag that moves %s', async (_name, points, inside, from, to) => {
		const h = selectHarness(points);
		await drag(h.tool, inside, from, to);
		expect({ gestures: h.gestures.length, invalid: h.invalid, last: h.gestures.at(-1)?.points })
			.toEqual({ gestures: 1, invalid: [], last: [...points.slice(0, -1), to] });
	});

	it('dispatches a BODY drag of a zone that already crosses', async () => {
		const h = selectHarness(L29);
		await drag(h.tool, p(3000, 1500), p(3000, 1500), p(3400, 1900));
		expect({ gestures: h.gestures.length, invalid: h.invalid }).toEqual({ gestures: 1, invalid: [] });
	});
});

/**
 * DOOR 4 — the invariant `acceptsElementPoints`'s own docblock already claimed while nothing
 * held it. Every outline kind is driven, because the docblock named two of the three.
 */
const element = (kind: SpatialElementKind) => ({ id: 'element-1', kind, points: [], ...(kind === 'post' ? { loadBearing: true } : {}) });
describe('acceptsElementPoints on an outline kind', () => {
	it.each(['object', 'post', 'hatch'] as const)('refuses a %s outline that crosses itself', kind => {
		expect(acceptsElementPoints(element(kind), RECTANGLE)).toBe(true);
		expect(acceptsElementPoints(element(kind), L29)).toBe(false);
	});
	it('still accepts a path whose segments cross, which is not an outline', () => {
		expect(acceptsElementPoints(element('path'), L29)).toBe(true);
	});
});
