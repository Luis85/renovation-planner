import { describe, expect, it } from 'vitest';
import type { Point } from '../../../../src/core/geometry/Point';
import { simpleAreaOutline } from '../../../../src/presentation/editor/add/simpleOutline';
import { outlineProposal as proposalWith, type CoordinateEdits } from '../../../../src/presentation/editor/resize/outlineProposal';
/** `accepts` is required (no shipped default); these cases drive it with the chord-only rule. */
const outlineProposal = (points: readonly Point[], edits: CoordinateEdits) =>
	proposalWith(points, edits, value => simpleAreaOutline(value).ok);
const points = [{ x: 1234.4, y: -765.4 }, { x: 4000, y: 0 }, { x: 3000, y: 2000 }, { x: 0, y: 3000 }];
describe('existing outline numeric coordinates', () => {
	it('preserves every untouched coordinate and applies explicitly retyped displayed precision', () => {
		expect(outlineProposal(points, []).polygon?.points).toEqual(points);
		const next = outlineProposal(points, [{ x: '1.234' }, { y: '0,5' }]);
		expect(next.polygon?.points).toEqual([{ x: 1234, y: -765.4 }, { x: 4000, y: 500 }, points[2], points[3]]);
		expect(points[0]).toEqual({ x: 1234.4, y: -765.4 });
	});
	it.each(['', 'bad', 'Infinity', '1e5', '999999999999999999'])('refuses invalid coordinate %s without a proposal', text => {
		const result = outlineProposal(points, [{ y: text }]);
		expect(result.polygon).toBeNull(); expect(result.errors.has('0.y')).toBe(true);
	});
	it('refuses a typed corner that would drag the outline across its own edge', () => {
		const room = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }];
		expect(outlineProposal(room, []).polygon?.points).toEqual(room);
		expect(outlineProposal(room, [{}, {}, {}, { x: '-0.5', y: '-0.4' }]).polygon).toBeNull();
	});
	it('refuses collapsed and underspecified outlines and permits signed absolute coordinates', () => {
		expect(outlineProposal(points, points.map(() => ({ y: '0' }))).polygon).toBeNull();
		expect(outlineProposal(points.slice(0, 2), []).polygon).toBeNull();
		expect(outlineProposal(points, [{ x: '-1,234' }]).polygon?.points[0].x).toBe(-1234);
	});
	it('refuses a call with no accepts rule at compile time', () => {
		// @ts-expect-error — `accepts` is required (review M-4): a default would hand a mount that forgot it the chord-only rule L-22 removed.
		const bare = () => proposalWith(points, []);
		expect(typeof bare).toBe('function');
	});
});
