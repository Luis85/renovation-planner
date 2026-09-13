import type Konva from 'konva';
import { ownerWindowOf } from '../../composables/use-owner-listener';

/**
 * Keeps every layer of `stage` drawing at the pixel ratio of the monitor the window is on.
 * Konva samples `devicePixelRatio` once per module and never again (`Canvas.js`,
 * `getDevicePixelRatio`), so without this a window dragged between a 2× and a 1× monitor draws
 * blurry or four times too large until the plugin reloads. Arms `matchMedia('(resolution:
 * <dpr>dppx)')` on the stage container's own window — a pop-out has one — and re-arms after
 * each change, since the query is for one value. Returns the disposer; call it on unmount.
 *
 * Takes the stage rather than a getter: vue-konva's `VStage` creates its `Konva.Stage` once in
 * `setup` and destroys it in its own `onBeforeUnmount`, after the caller's disposer has run, so
 * there is no moment at which a live listener could see a different or missing stage.
 */
export function followPixelRatio(stage: Konva.Stage): () => void {
	const win = ownerWindowOf(stage.container());
	let current = win.devicePixelRatio;
	const arm = (): MediaQueryList => {
		const list = win.matchMedia(`(resolution: ${current}dppx)`);
		list.addEventListener('change', onChange);
		return list;
	};
	let query = arm();
	function onChange(): void {
		const next = win.devicePixelRatio;
		if (next === current) return;
		current = next;
		for (const layer of stage.getLayers()) {
			layer.getCanvas().setPixelRatio(next);
			layer.batchDraw();
		}
		query.removeEventListener('change', onChange);
		query = arm();
	}
	return () => query.removeEventListener('change', onChange);
}
