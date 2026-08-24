import { describe, expect, it, vi } from 'vitest';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import type { EditorTool, EditorPointerEvent, ToolId } from '../../../../src/presentation/editor/tools/editor-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

/**
 * A fake `EditorTool` that records every lifecycle call it receives, in order, onto a
 * shared array — `id:method` per entry — so a test can assert the SEQUENCE
 * (`toEqual([...])`), not just per-method call counts. Counting alone cannot distinguish
 * `[cancel, deactivate, activate]` from `[activate, cancel, deactivate]`, and ordering is
 * exactly what DoD 1 requires.
 */
function fakeTool(id: ToolId, calls: string[]): EditorTool {
	return {
		id,
		activate: vi.fn<(context: EditorContext) => void>(() => {
			calls.push(`${id}:activate`);
		}),
		deactivate: vi.fn<() => void>(() => {
			calls.push(`${id}:deactivate`);
		}),
		pointerDown: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerDown`);
		}),
		pointerMove: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerMove`);
		}),
		pointerUp: vi.fn<(event: EditorPointerEvent) => void>(() => {
			calls.push(`${id}:pointerUp`);
		}),
		cancel: vi.fn<() => void>(() => {
			calls.push(`${id}:cancel`);
		}),
	};
}

function pointerEvent(): EditorPointerEvent {
	return {
		worldPoint: { x: 1, y: 2 },
		screenPoint: screenPoint(3, 4),
		button: 'primary',
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
}

/** Never read by `ToolManager` — only ever passed through, so identity is what matters. */
function fakeContext(): EditorContext {
	return {} as EditorContext;
}

describe('ToolManager', () => {
	it('registers a tool and activates it with a context from the factory', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const context = fakeContext();
		const manager = new ToolManager(() => context);

		manager.register(select);
		manager.setActiveTool('select');

		expect(calls).toEqual(['select:activate']);
		expect(select.activate).toHaveBeenCalledExactlyOnceWith(context);
		expect(manager.activeToolId).toBe('select');
	});

	it('calls the context factory fresh on every activation, not once at construction', () => {
		let factoryCalls = 0;
		const contexts: EditorContext[] = [];
		const manager = new ToolManager(() => {
			factoryCalls += 1;
			const context = fakeContext();
			contexts.push(context);
			return context;
		});
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		manager.register(select);
		manager.register(pan);

		expect(factoryCalls).toBe(0); // never called just for registering

		manager.setActiveTool('select');
		expect(factoryCalls).toBe(1);

		manager.setActiveTool('pan');
		expect(factoryCalls).toBe(2);
		expect(select.activate).toHaveBeenCalledExactlyOnceWith(contexts[0]);
		expect(pan.activate).toHaveBeenCalledExactlyOnceWith(contexts[1]);
	});

	it('switches tools with no gesture in flight: deactivate then activate, and cancel is never called', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:deactivate', 'pan:activate']);
		expect(select.cancel).not.toHaveBeenCalled();
		expect(select.deactivate).toHaveBeenCalledTimes(1);
		expect(pan.activate).toHaveBeenCalledTimes(1);
	});

	it('switches tools mid-gesture: cancel, then deactivate, then activate, in that order', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent()); // marks a gesture in flight
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:cancel', 'select:deactivate', 'pan:activate']);
		expect(select.cancel).toHaveBeenCalledTimes(1);
	});

	it('setting the already-active id is a no-op: no cancel, no deactivate, no re-activate', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		calls.length = 0;

		manager.setActiveTool('select');

		expect(calls).toEqual([]);
		expect(select.deactivate).not.toHaveBeenCalled();
		expect(select.cancel).not.toHaveBeenCalled();
		expect(select.activate).toHaveBeenCalledTimes(1); // only the first setActiveTool
	});

	it('setting the already-active id mid-gesture is still a no-op: no cancel', () => {
		// The no-op guard must run before the gesture-in-flight check, or a re-select while
		// dragging would spuriously cancel the very gesture the user did not switch away from.
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		calls.length = 0;

		manager.setActiveTool('select');

		expect(calls).toEqual([]);
		expect(select.cancel).not.toHaveBeenCalled();
	});

	it('throws for an unregistered tool id', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => manager.setActiveTool('select')).toThrow(/select/);
		expect(manager.activeToolId).toBeNull();
	});

	it('throws when a second tool registers for an id already taken', () => {
		const calls: string[] = [];
		const manager = new ToolManager(fakeContext);
		manager.register(fakeTool('select', calls));

		expect(() => manager.register(fakeTool('select', calls))).toThrow(/select/);
	});

	it('pointer events with no active tool are a no-op, not a throw', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => manager.pointerDown(pointerEvent())).not.toThrow();
		expect(() => manager.pointerMove(pointerEvent())).not.toThrow();
		expect(() => manager.pointerUp(pointerEvent())).not.toThrow();
		expect(manager.activeToolId).toBeNull();
	});

	it('forwards pointerDown/pointerMove/pointerUp to the active tool with the same event', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		const down = pointerEvent();
		const move = pointerEvent();
		const up = pointerEvent();

		manager.pointerDown(down);
		manager.pointerMove(move);
		manager.pointerUp(up);

		expect(select.pointerDown).toHaveBeenCalledExactlyOnceWith(down);
		expect(select.pointerMove).toHaveBeenCalledExactlyOnceWith(move);
		expect(select.pointerUp).toHaveBeenCalledExactlyOnceWith(up);
	});

	it('pointerUp clears the in-flight gesture, so a later switch does not cancel', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		manager.pointerUp(pointerEvent());
		calls.length = 0;

		manager.setActiveTool('pan');

		expect(calls).toEqual(['select:deactivate', 'pan:activate']); // no cancel
	});

	it('cancelGesture(), e.g. on Escape, cancels the active tool once and clears the in-flight flag', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const pan = fakeTool('pan', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.register(pan);
		manager.setActiveTool('select');
		manager.pointerDown(pointerEvent());
		calls.length = 0;

		manager.cancelGesture();

		expect(calls).toEqual(['select:cancel']);
		expect(select.cancel).toHaveBeenCalledTimes(1);

		// The flag is cleared: a switch right after must not cancel a second time.
		calls.length = 0;
		manager.setActiveTool('pan');
		expect(calls).toEqual(['select:deactivate', 'pan:activate']);
	});

	it('cancelGesture() with no gesture in flight does nothing', () => {
		const calls: string[] = [];
		const select = fakeTool('select', calls);
		const manager = new ToolManager(fakeContext);
		manager.register(select);
		manager.setActiveTool('select');
		calls.length = 0;

		manager.cancelGesture();

		expect(calls).toEqual([]);
		expect(select.cancel).not.toHaveBeenCalled();
	});

	it('cancelGesture() with no active tool at all does nothing and does not throw', () => {
		const manager = new ToolManager(fakeContext);

		expect(() => {
			manager.cancelGesture();
		}).not.toThrow();
	});
});
