import type { EditorContext } from '../tools/editor-context';
import type { useEditorStore } from '../../stores/EditorStore';
import { STAGE_PIXELS, screenToWorld, worldPerScreenPixel, worldToScreen } from './Viewport';

/**
 * The camera as an `EditorTool` sees it, bound to one leaf's live `EditorStore`.
 *
 * ONE function for both editing surfaces. It lived inside `presentation/editor/runtime.ts`
 * while the Plan Editor was the only surface with tools; design slice B5 gave the asset
 * designer its own tool framework, and its runtime needs exactly this object — so the second
 * copy would have been five byte-identical members in two files, which is the shape a change
 * to the camera seam gets applied to one of.
 *
 * It closes over the live viewport ref rather than snapshotting it, which is the binding
 * `editor-context.ts` describes for the composition root's side of this seam: every call reads
 * the camera as it stands, so a tool measuring a screen-sized tolerance mid-gesture measures it
 * against the zoom the user is actually looking at.
 *
 * **Camera MUTATION is unimplemented, not merely unused**, and that is true on both surfaces.
 * `EditorContext` declares `setPan`/`setZoom` as the path a `PanTool` would move the camera
 * through, and no such tool exists on either one — slice 5's camera is `EditorSurface`'s own,
 * outside the tool framework, and design slice B5 registered nothing that changes that. The
 * primitives are all in `EditorStore` (`beginPan`/`continuePan`/`endPan`/`zoomAt`), so the tool
 * that needs them binds them here in one edit; until then a caller gets silence, which is why
 * this says so rather than looking finished.
 */
export function editorViewportAdapter(
	editor: ReturnType<typeof useEditorStore>,
): EditorContext['viewport'] {
	return {
		worldToScreen: (point) => worldToScreen(point, editor.viewport, STAGE_PIXELS),
		screenToWorld: (point) => screenToWorld(point, editor.viewport, STAGE_PIXELS),
		worldPerScreenPixel: () => worldPerScreenPixel(editor.viewport, STAGE_PIXELS),
		setPan: () => undefined,
		setZoom: () => undefined,
	};
}
