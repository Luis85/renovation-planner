import { describe, expect, it } from 'vitest';
import { outlineCrosses, simpleAreaOutline } from '../../../../src/presentation/editor/add/simpleOutline';
import { acceptsElementPoints } from '../../../../src/presentation/editor/elements/elementDraft';
import { DrawPolygonTool } from '../../../../src/presentation/editor/tools/draw-polygon-tool';
import type { Point } from '../../../../src/core/geometry/Point';
import type { SpatialElementKind } from '../../../../src/domain/spatial/SpatialElement';
import { flushGesture as flush, pointerAt as at } from '../../../helpers/tool-context';
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
	])('accepts %s', (_name, points) => {
		expect(outlineCrosses(points)).toBe(false);
	});

	it.each([
		['straight bowtie', BOWTIE],
		['the L-29 corner drag', L29],
	])('refuses %s', (_name, points) => {
		expect(outlineCrosses(points)).toBe(true);
	});
});

/**
 * `areaOutline` FIRST, and the order is load-bearing: a collinear outline keeps the
 * `polygon-zero-area` code every door already raises for it, so the zero-area drag is not
 * closed as collateral under a self-intersection code.
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
	])('leaves $code to areaOutline', ({ points, code }) => {
		expect(simpleAreaOutline(points)).toMatchObject({ ok: false, error: { code } });
	});
});

/** DOOR 2 — the `validateOutline` option `registerEditorTools.ts` hands both drawing tools. */
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
