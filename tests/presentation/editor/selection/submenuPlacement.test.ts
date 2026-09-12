import { expect, it } from 'vitest';
import { submenuPlacement } from '../../../../src/presentation/editor/selection/submenuPlacement';

const host = { left: 0, top: 0, width: 800, height: 600 }, size = { width: 160, height: 120 };
it('opens right of its parent item', () => {
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, size, host)).toEqual({ left: 282, top: 50 });
});
it('flips left where it would cross the editor edge, never past the left edge', () => {
	expect(submenuPlacement({ left: 600, top: 50, width: 180, height: 28 }, size, host)).toEqual({ left: 438, top: 50 });
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, { width: 700, height: 120 }, host).left).toBe(0);
});
it('stays inside the editor vertically', () => {
	expect(submenuPlacement({ left: 100, top: 560, width: 180, height: 28 }, size, host).top).toBe(480);
	expect(submenuPlacement({ left: 100, top: 50, width: 180, height: 28 }, size, { ...host, top: 100 }).top).toBe(100);
});
