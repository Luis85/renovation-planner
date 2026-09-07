import { describe, expect, it, vi } from 'vitest';
import { arrowVector, finishShortcut, plainPress, type DraftFinishDoors, type FinishKeyPress } from '../../../../src/presentation/editor/surface/keyboard';

/**
 * Pure logic, no DOM: `arrowVector` takes only `{ key, shiftKey }`, so this is a node test
 * per `CLAUDE.md`'s Testing section rather than a jsdom one over a real `KeyboardEvent`.
 */
describe('arrowVector', () => {
	it.each([
		['ArrowLeft', false, { dx: -10, dy: 0 }],
		['ArrowRight', false, { dx: 10, dy: 0 }],
		['ArrowUp', false, { dx: 0, dy: -10 }],
		['ArrowDown', false, { dx: 0, dy: 10 }],
		['ArrowLeft', true, { dx: -100, dy: 0 }],
		['ArrowRight', true, { dx: 100, dy: 0 }],
		['ArrowUp', true, { dx: 0, dy: -100 }],
		['ArrowDown', true, { dx: 0, dy: 100 }],
	])('%s with shiftKey=%s -> %j', (key, shiftKey, expected) => {
		expect(arrowVector({ key, shiftKey })).toEqual(expected);
	});

	it('answers null for a key that is not an arrow', () => {
		expect(arrowVector({ key: 'a', shiftKey: false })).toBeNull();
	});
});

describe('plainPress', () => {
	const bare = { repeat: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false };
	it('is true for one deliberate press of the bare key', () => {
		expect(plainPress(bare)).toBe(true);
	});
	it.each(['repeat', 'ctrlKey', 'metaKey', 'altKey', 'isComposing'] as const)('is false with %s set', (flag) => {
		expect(plainPress({ ...bare, [flag]: true })).toBe(false);
	});
});

function doors(tool: DraftFinishDoors['tool']) {
	return { tool, finishArea: vi.fn<() => void>(), finishActiveTool: vi.fn<() => void>(), undoDraftPoint: vi.fn<() => void>() };
}
function press(key: string, extra: Partial<FinishKeyPress> = {}) {
	return { key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, preventDefault: vi.fn<() => void>(), ...extra };
}

describe('finishShortcut', () => {
	it('finishes an Area through the guarded door and a structure draft through the tool', () => {
		const area = doors('draw-area');
		expect(finishShortcut(press('Enter'), area)).toBe(true);
		expect(area.finishArea).toHaveBeenCalledOnce();
		expect(area.finishActiveTool).not.toHaveBeenCalled();
		for (const tool of ['draw-wall', 'place-door', 'place-window', 'place-opening'] as const) {
			const d = doors(tool);
			expect(finishShortcut(press('Enter'), d)).toBe(true);
			expect(d.finishActiveTool).toHaveBeenCalledOnce();
			expect(d.finishArea).not.toHaveBeenCalled();
		}
	});
	it('consumes a chorded or repeated Enter without finishing', () => {
		for (const extra of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
			const d = doors('draw-area'), event = press('Enter', extra);
			expect(finishShortcut(event, d)).toBe(true);
			expect(event.preventDefault).toHaveBeenCalledOnce();
			expect(d.finishArea).not.toHaveBeenCalled();
		}
	});
	it('takes a wall chain back one point on Backspace, once per press', () => {
		const d = doors('draw-wall');
		expect(finishShortcut(press('Backspace'), d)).toBe(true);
		expect(finishShortcut(press('Backspace', { repeat: true }), d)).toBe(true);
		expect(d.undoDraftPoint).toHaveBeenCalledOnce();
	});
	it('answers false, and prevents nothing, for every other key or tool', () => {
		for (const [key, tool] of [['Enter', null], ['Enter', 'select'], ['Enter', 'draw-polygon'], ['Backspace', 'draw-area'], ['a', 'draw-wall']] as const) {
			const d = doors(tool), event = press(key);
			expect(finishShortcut(event, d)).toBe(false);
			expect(event.preventDefault).not.toHaveBeenCalled();
		}
	});
});
