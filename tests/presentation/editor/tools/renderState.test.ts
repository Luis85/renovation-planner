/**
 * `RenderState` (SDD §19, design slice 6): transient visuals only, never persisted —
 * hover, an in-progress preview polygon, a marquee rectangle, snap guides, the calibration
 * segment, and the polygon being sketched.
 */
import { describe, expect, it } from 'vitest';
import { RenderState } from '../../../../src/presentation/editor/tools/render-state';

describe('RenderState', () => {
	it('defaults every field to its empty value', () => {
		const state = new RenderState();

		expect(state.hoveredObjectId).toBeNull();
		expect(state.previewPolygon).toBeNull();
		expect(state.marquee).toBeNull();
		expect(state.snapGuides).toEqual([]);
		expect(state.measurement).toBeNull();
		expect(state.polygonSketch).toBeNull();
	});

	it('reset() clears every field back to its default', () => {
		const state = new RenderState();
		state.hoveredObjectId = 'zone-1';
		state.previewPolygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
		state.marquee = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
		state.snapGuides = [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }];
		state.measurement = { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } };
		state.polygonSketch = {
			vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
			cursor: { x: 4, y: 4 },
			closeArmed: true,
		};

		state.reset();

		expect(state.hoveredObjectId).toBeNull();
		expect(state.previewPolygon).toBeNull();
		expect(state.marquee).toBeNull();
		expect(state.snapGuides).toEqual([]);
		expect(state.measurement).toBeNull();
		expect(state.polygonSketch).toBeNull();
	});
});
