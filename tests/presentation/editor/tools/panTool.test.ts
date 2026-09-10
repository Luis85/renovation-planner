import { describe, expect, it } from 'vitest';
import { PanTool } from '../../../../src/presentation/editor/tools/pan-tool';
import { ToolManager } from '../../../../src/presentation/editor/tools/tool-manager';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';

function pointerEvent(): EditorPointerEvent {
	return {
		worldPoint: { x: 5, y: 9 },
		screenPoint: screenPoint(10, 20),
		button: 'primary',
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
}

/** Never read by `ToolManager` or `PanTool` — only ever passed through. */
function fakeContext(): EditorContext {
	return {} as EditorContext;
}

/**
 * `PanTool` is `'pan'`'s registration in `ToolManager` (design slice 6's §57 roster), but its
 * own `pointerDown`/`pointerMove`/`pointerUp`/`cancel`/`abandonGesture` are deliberately inert —
 * the file's own docblock says the existing surface camera owns pointer capture and pan state
 * and this class only names its mode. `EditorSurface.vue`'s pointer routing goes further than
 * that: every one of its three pointer doors excludes `activeToolId === 'pan'` from the
 * tool-forwarding branch (`if (activeToolId.value !== null && activeToolId.value !== 'pan')`)
 * and drives `EditorStore.beginPan`/`continuePan`/`endPan` — the surface camera — directly, so a
 * real drag with the Pan tool selected never reaches these five methods through that surface.
 * `ToolManager` is `PanTool`'s only real caller in `src/` (the one `registerEditorTools` call
 * site, from `runtime.ts`), so driving it through `ToolManager`'s own public pointer/gesture
 * doors — exactly as `tool-manager.test.ts` drives every other `EditorTool` — is what exercises
 * the real implementation through its actual integration point rather than invoking its methods
 * directly off the instance. What that exercise proves is the behaviour the class promises: a
 * full down/move/up leaves no draft (`hasDraft()` stays `false`, matching "Panning does not
 * accumulate a domain draft"), and cancelling mid-gesture — deliberately (`cancel()`, Escape) or
 * as an interruption (`abandonGesture()`, a blur) — is exactly as inert. Camera movement itself
 * belongs to `EditorSurface.vue`'s own pan path, asserted where that path lives, not here.
 */
describe('PanTool', () => {
	function armed(): { manager: ToolManager; pan: PanTool } {
		const pan = new PanTool();
		const manager = new ToolManager(fakeContext);
		manager.register(pan);
		manager.setActiveTool('pan');
		return { manager, pan };
	}

	it('activates with no draft and stays free of one across a full down/move/up gesture', () => {
		const { manager, pan } = armed();
		expect(pan.hasDraft()).toBe(false);

		manager.pointerDown(pointerEvent());
		expect(manager.gestureInFlight).toBe(true);
		expect(pan.hasDraft()).toBe(false);

		manager.pointerMove(pointerEvent());
		expect(pan.hasDraft()).toBe(false);

		manager.pointerUp(pointerEvent());
		expect(manager.gestureInFlight).toBe(false);
		expect(pan.hasDraft()).toBe(false);
	});

	it('cancel() (Escape) reaches Pan while it is active and leaves no draft behind', () => {
		const { manager, pan } = armed();
		manager.pointerDown(pointerEvent());

		manager.cancelGesture();

		expect(manager.gestureInFlight).toBe(false);
		expect(pan.hasDraft()).toBe(false);
	});

	it('abandonGesture() reaches Pan on an interrupted gesture and leaves no draft behind', () => {
		const { manager, pan } = armed();
		manager.pointerDown(pointerEvent());

		manager.cancelInterruptedGesture();

		expect(manager.gestureInFlight).toBe(false);
		expect(pan.hasDraft()).toBe(false);
	});
});
