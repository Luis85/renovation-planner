import { expectDefined } from '../../../helpers/domain';
import { describe, expect, it } from 'vitest';
import { roomDimensions, dimensionProposal, dimensionTexts } from '../../../../src/presentation/editor/resize/roomDimensions';
const points = [{ x: -1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 3500 }, { x: -1000, y: 3500 }];
const box = { min: points[0], max: points[2] };
describe('bounded rectangular room dimensions', () => {
	it('recognizes either winding and any starting corner without reordering', () => {
		for (let i = 0; i < 4; i++) {
			for (const input of [points.slice(i).concat(points.slice(0, i)), points.slice(i).concat(points.slice(0, i)).toReversed()]) {
				expect(roomDimensions(input)).toEqual(box);
				const result = dimensionProposal(input, box, { width: '5,2', depth: '2' });
				expect(result.areaMm2).toBe(10_400_000);
				expect(result.polygon?.points).toEqual(input.map(p => ({ x: p.x === -1000 ? -1000 : 4200, y: p.y === 500 ? 500 : 2500 })));
			}
		}
	});
	it.each([
		[], points.slice(0, 3), [...points, points[0]],
		[{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
		[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
		[{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
		[points[0], points[2], points[1], points[3]],
		[points[0], points[1], points[0], points[3]],
		[{ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: Infinity, y: 2 }, { x: 0, y: 2 }],
	].map(input => [input]))('refuses unsupported outlines, never approximating them: %j', (input) => { expect(roomDimensions(input)).toBeNull(); });
	it.each(['', 'oops', '0', '-1', '0.0001', '1000.001', 'Infinity'])('rejects invalid size %s', (width) => {
		const result = dimensionProposal(points, box, { width, depth: '3' });
		expect(result.polygon).toBeNull(); expect(result.errors.width).not.toBeNull();
	});
	it('preserves exact untouched dimensions and rounds only the edited side', () => {
		const original = [{ x: 0.25, y: 0.5 }, { x: 3000.625, y: 0.5 }, { x: 3000.625, y: 2000.75 }, { x: 0.25, y: 2000.75 }];
		const bounds = expectDefined(roomDimensions(original), 'rectangle');
		expect(dimensionProposal(original, bounds, dimensionTexts(bounds)).polygon?.points).toEqual(original);
		const result = dimensionProposal(original, bounds, { ...dimensionTexts(bounds), depth: '1,2346' });
		expect(result.polygon?.points[2]).toEqual({ x: 3000.625, y: 1235.5 });
	});
	it('refuses dimensions collapsed by coordinate precision', () => {
		const original = [{ x: 1e20, y: 0 }, { x: 1e20 + 1e6, y: 0 }, { x: 1e20 + 1e6, y: 1e6 }, { x: 1e20, y: 1e6 }];
		expect(dimensionProposal(original, expectDefined(roomDimensions(original), 'rectangle'), { width: '0.001', depth: '1' }).polygon).toBeNull();
	});
	it('uses parsed millimetres directly instead of introducing transformer scale roundoff', () => {
		const original = [{ x: 0, y: 0 }, { x: 2900, y: 0 }, { x: 2900, y: 1900 }, { x: 0, y: 1900 }];
		const result = dimensionProposal(original, expectDefined(roomDimensions(original), 'rectangle'), { width: '0.001', depth: '0.001' });
		expect(result.polygon?.points[2]).toEqual({ x: 1, y: 1 }); expect(result.areaMm2).toBe(1);
	});

});
