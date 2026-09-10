import type { EditorRuntime } from '../../src/presentation/editor/runtime';
import type { useEditorStore } from '../../src/presentation/stores/EditorStore';
import type { Point } from '../../src/core/geometry/Point';
import { STAGE_PIXELS, worldToScreen } from '../../src/presentation/editor/viewport/Viewport';
import { pointerAt } from './tool-context';
import { settle } from './editor';

/** Runtime tests explicitly establish the new pointer-hover precondition before taking a handle. */
export async function hoverRotation(runtime: EditorRuntime, editor: ReturnType<typeof useEditorStore>, point: Point): Promise<void> {
	editor.setPointer(worldToScreen(point, editor.viewport, STAGE_PIXELS));
	runtime.toolManager.pointerMove(pointerAt(point.x, point.y));
	await settle();
}
