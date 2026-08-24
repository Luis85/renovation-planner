/**
 * Transformer result normalization: convert Konva's scaleX/scaleY multipliers
 * to world millimetre geometry (SDD §60).
 */
import { describe, it, expect } from 'vitest';
import {
	normalizeTransformerResult,
	type TransformerTransform,
} from '../../../../src/presentation/editor/selection/normalize-transform';
import type { BoundingBox } from '../../../../src/core/geometry/BoundingBox';

describe('normalizeTransformerResult', () => {
	it('anchor case: 2x scale on X only', () => {
		const transform: TransformerTransform = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 1 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(0);
		expect(result.min.y).toBe(0);
		expect(result.max.x).toBe(2000);
		expect(result.max.y).toBe(500);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});

	it('identity transform reproduces base dimensions', () => {
		const transform: TransformerTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(0);
		expect(result.min.y).toBe(0);
		expect(result.max.x).toBe(1000);
		expect(result.max.y).toBe(500);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});

	it('fractional scales round-trip', () => {
		const transform: TransformerTransform = { x: 0, y: 0, rotation: 0, scaleX: 0.5, scaleY: 0.75 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 100, y: 200 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(0);
		expect(result.min.y).toBe(0);
		expect(result.max.x).toBe(50);
		expect(result.max.y).toBe(150);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});

	it('translation moves the min corner', () => {
		const transform: TransformerTransform = { x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 500, y: 300 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(100);
		expect(result.min.y).toBe(200);
		expect(result.max.x).toBe(600);
		expect(result.max.y).toBe(500);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});

	it('combined scale and translation', () => {
		const transform: TransformerTransform = { x: 50, y: 75, rotation: 0, scaleX: 2, scaleY: 2 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 100, y: 150 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(50);
		expect(result.min.y).toBe(75);
		expect(result.max.x).toBe(250);
		expect(result.max.y).toBe(375);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});

	it('rotation is ignored (axis-aligned output)', () => {
		const transform: TransformerTransform = { x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 };
		const baseGeometry: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };

		const result = normalizeTransformerResult(transform, baseGeometry);

		expect(result.min.x).toBe(0);
		expect(result.min.y).toBe(0);
		expect(result.max.x).toBe(100);
		expect(result.max.y).toBe(100);
		expect(!('scaleX' in result) && !('scaleY' in result)).toBe(true);
	});
});
