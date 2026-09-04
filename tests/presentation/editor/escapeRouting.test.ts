import { describe, expect, it, vi } from 'vitest';
import { routeEscape, type EscapeDeps } from '../../../src/presentation/editor/escapeRouting';
import type { ToolId } from '../../../src/presentation/editor/tools/editor-tool';

/**
 * Deliberately UNANNOTATED: an explicit `EscapeDeps & { cancelGesture: ReturnType<...>; ... }`
 * return type widens every `vi.fn()` field back to a bare call signature the moment the
 * trailing `...overrides` spread sits in the same object literal — a TypeScript object-spread
 * limitation, not a fact about this code. Left inferred, `vi.fn<() => void>()`'s own type
 * survives the spread and `expect(d.cancelGesture)…` still resolves every matcher.
 */
function deps(overrides: Partial<EscapeDeps> = {}) {
	return {
		panning: false,
		activeToolId: 'select' as ToolId | null,
		hasDraft: () => false,
		cancelGesture: vi.fn<() => void>(),
		setTool: vi.fn<(id: EscapeDeps['activeToolId']) => void>(),
		hasSelection: false,
		clearSelection: vi.fn<() => void>(),
		...overrides,
	};
}

describe('routeEscape — one precedence for the whole canvas', () => {
	it('a running pan swallows Escape and touches nothing', () => {
		const d = deps({ panning: true, activeToolId: 'draw-polygon', hasDraft: () => true, hasSelection: true });
		expect(routeEscape(d)).toBe('swallowed-pan');
		expect(d.cancelGesture).not.toHaveBeenCalled();
		expect(d.clearSelection).not.toHaveBeenCalled();
	});
	it('a drawing tool WITH a draft cancels the draft and stays active', () => {
		const d = deps({ activeToolId: 'draw-polygon', hasDraft: () => true });
		expect(routeEscape(d)).toBe('cancelled-draft');
		expect(d.cancelGesture).toHaveBeenCalledOnce();
		expect(d.setTool).not.toHaveBeenCalled();
	});
	it('a drawing tool WITHOUT a draft returns to Select through setTool alone — deactivation is the cancellation boundary', () => {
		const d = deps({ activeToolId: 'draw-polygon' });
		expect(routeEscape(d)).toBe('returned-to-select');
		expect(d.setTool).toHaveBeenCalledWith('select');
		// §6.3 as amended 2026-09-04 (R2): no second cancellation on this arm.
		expect(d.cancelGesture).not.toHaveBeenCalled();
	});
	it('Select with a selection clears it', () => {
		const d = deps({ hasSelection: true });
		expect(routeEscape(d)).toBe('cleared-selection');
		expect(d.clearSelection).toHaveBeenCalledOnce();
	});
	it('Select mid-drag cancels the drag before it would clear the selection', () => {
		const d = deps({ hasDraft: () => true, hasSelection: true });
		expect(routeEscape(d)).toBe('cancelled-draft');
		expect(d.clearSelection).not.toHaveBeenCalled();
	});
	it('Select with nothing selected does nothing', () => {
		expect(routeEscape(deps())).toBe('nothing');
	});
	it('camera mode (no tool) with a selection still clears it', () => {
		const d = deps({ activeToolId: null, hasSelection: true });
		expect(routeEscape(d)).toBe('cleared-selection');
	});
});
