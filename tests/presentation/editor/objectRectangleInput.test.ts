import { expect, it } from 'vitest';
import { emptyObjectRectangle, objectRectangleProposal } from '../../../src/presentation/editor/elements/objectRectangleInput';

it('builds an exact rectangle from signed positions and comma dimensions without repeating its closing point', () => {
	expect(objectRectangleProposal({ x: '-1', y: '0', width: '1,25', depth: '0,5' })).toEqual({
		points: [{ x: -1000, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 500 }, { x: -1000, y: 500 }],
		errors: { x: null, y: null, width: null, depth: null },
	});
	expect(emptyObjectRectangle()).toEqual({ x: '0', y: '0', width: '', depth: '' });
});
it.each(['x', 'y', 'width', 'depth'] as const)('retains a refusal for incomplete %s input', field => {
	const result = objectRectangleProposal({ x: '0', y: '0', width: '1', depth: '1', [field]: '-' });
	expect(result.points).toBeNull(); expect(result.errors[field]).toBe('not-a-number');
});
it.each(['0', '-1', '0.0001', '1001', 'Infinity'])('refuses an unusable side of %s metres', width => {
	expect(objectRectangleProposal({ x: '0', y: '0', width, depth: '1' }).points).toBeNull();
});
it.each(['x', 'y'] as const)('refuses a far %s corner that would overflow safe millimetres', axis => {
	const result = objectRectangleProposal({ x: '0', y: '0', width: '1', depth: '1', [axis]: '9007199254740' });
	expect(result.points).toBeNull(); expect(result.errors[axis]).toBe('too-large');
});
it('keeps millimetre-sized items representable', () => {
	expect(objectRectangleProposal({ x: '0', y: '0', width: '0.001', depth: '0.001' }).points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
});
