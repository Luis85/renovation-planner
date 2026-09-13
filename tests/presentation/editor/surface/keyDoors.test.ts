/**
 * @vitest-environment jsdom
 *
 * The canvas's key doors driven through the interface `canvasKeyDoors` takes, with the surface
 * they used to reach through `EditorSurface.vue`'s own closure faked one member at a time.
 *
 * What the doors DECIDE — arming, Escape's precedence, the nudge's repeat filter, which key
 * frames what — is asserted by the suites that mount the surface (`canvasKeyboardGestures`,
 * `keyboardNudge`, `canvasNavigation`, `emptyStateOverlay`), and nothing here restates them.
 * This file asks only that each door reaches the member of the surface it was extracted
 * against — the one defect a move can ADD, and one a mount suite would report as a behaviour
 * rather than as a wire. jsdom rather than node, because `isCanvasKey` reads `event.target`,
 * which only a dispatched event carries.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { canvasKeyDoors, type KeyDoorSurface } from '../../../../src/presentation/editor/surface/keyDoors';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

type Editor = KeyDoorSurface['editor'];
type Tools = KeyDoorSurface['toolManager'];
type Host = KeyDoorSurface['host'];

const BOUNDS = { min: { x: 0, y: 0 }, max: { x: 100, y: 50 } };

/** A container with one focusable child, so a key can arrive from the canvas or from inside it. */
function surface() {
	const container = document.createElement('div');
	const child = document.createElement('button');
	container.append(child);
	const deps: KeyDoorSurface = {
		container: ref(container),
		size: ref({ width: 600, height: 400 }),
		activeToolId: ref(null),
		editor: { dragState: null, fitTo: vi.fn<Editor['fitTo']>(), zoomByFactor: vi.fn<Editor['zoomByFactor']>() },
		toolManager: {
			finishActiveTool: vi.fn<Tools['finishActiveTool']>(),
			editActiveCorner: vi.fn<Tools['editActiveCorner']>(() => true),
			activeToolHasDraft: vi.fn<Tools['activeToolHasDraft']>(() => false),
			cancelGesture: vi.fn<Tools['cancelGesture']>(),
		},
		panOverride: { phase: 'idle', armSpace: vi.fn<() => void>(), disarmSpace: vi.fn<() => void>() },
		syncPanPhase: vi.fn<() => void>(),
		reissuePointerMove: vi.fn<KeyDoorSurface['reissuePointerMove']>(),
		gestureInFlight: vi.fn<() => boolean>(() => false),
		host: {
			framedBounds: vi.fn<Host['framedBounds']>(() => null),
			setTool: vi.fn<Host['setTool']>(),
			hasSelection: vi.fn<Host['hasSelection']>(() => false),
			clearSelection: vi.fn<Host['clearSelection']>(),
			nudgeSelection: vi.fn<Host['nudgeSelection']>(async () => {}),
			finishArea: vi.fn<Host['finishArea']>(),
		},
	};
	const doors = canvasKeyDoors(deps);
	container.addEventListener('keydown', doors.onKeyDown);
	container.addEventListener('keyup', doors.onKeyUp);
	return { deps, container, child };
}

function key(target: HTMLElement, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

describe('canvasKeyDoors', () => {
	it('zooms a +/- press at the stage centre and re-issues the move, for the canvas alone', () => {
		const { deps, container, child } = surface();
		const plus = key(container, 'keydown', { key: '+' });
		expect(deps.editor.zoomByFactor).toHaveBeenCalledWith(screenPoint(300, 200), 1.2);
		expect(deps.reissuePointerMove).toHaveBeenCalledWith(plus);
		expect(plus.defaultPrevented).toBe(true);
		key(container, 'keydown', { key: '-' });
		expect(deps.editor.zoomByFactor).toHaveBeenLastCalledWith(screenPoint(300, 200), 1 / 1.2);
		// Bubbling up from something focusable inside the canvas is not the canvas's own key.
		const bubbled = key(child, 'keydown', { key: '+' });
		expect(deps.editor.zoomByFactor).toHaveBeenCalledTimes(2);
		expect(bubbled.defaultPrevented).toBe(false);
	});

	it('frames what the host answers, with the measured size, and moves nothing for null', () => {
		const { deps, container } = surface();
		key(container, 'keydown', { key: 'f' });
		expect(deps.host.framedBounds).toHaveBeenCalledWith(true);
		expect(deps.editor.fitTo).not.toHaveBeenCalled();
		vi.mocked(deps.host.framedBounds).mockReturnValue(BOUNDS);
		const selection = key(container, 'keydown', { key: '"', code: 'Digit2', shiftKey: true });
		expect(deps.host.framedBounds).toHaveBeenLastCalledWith(false);
		expect(deps.editor.fitTo).toHaveBeenCalledWith(BOUNDS, { width: 600, height: 400 });
		expect(deps.reissuePointerMove).toHaveBeenLastCalledWith(selection);
	});

	it('re-issues a Shift release from anywhere, and disarms space only from the canvas', () => {
		const { deps, container, child } = surface();
		const shift = key(child, 'keyup', { key: 'Shift' });
		expect(deps.reissuePointerMove).toHaveBeenCalledWith(shift);
		key(child, 'keyup', { key: ' ' });
		expect(deps.panOverride.disarmSpace).not.toHaveBeenCalled();
		key(container, 'keyup', { key: ' ' });
		expect(deps.panOverride.disarmSpace).toHaveBeenCalledOnce();
		expect(deps.syncPanPhase).toHaveBeenCalledOnce();
	});
});
