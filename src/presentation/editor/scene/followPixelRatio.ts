import type Konva from 'konva';
import { ownerWindowOf } from '../../composables/use-owner-listener';

/**
 * Brings every layer of `stage` to the pixel ratio of the monitor the window is on, now and
 * after each move. Konva samples `devicePixelRatio` once per module and never again
 * (`Canvas.js`, `getDevicePixelRatio`), so a layer is built at whatever the window reported at
 * plugin load: a window dragged between a 2× and a 1× monitor draws blurry or four times too
 * large until the plugin reloads, and a stage created AFTER the move is stale from its first
 * paint. So the start resizes any layer whose backing store disagrees with the window (and
 * redraws only those), then arms `matchMedia('(resolution: <dpr>dppx)')` on the stage
 * container's own window — a pop-out has one — re-arming after each change, since the query is
 * for one value. `Konva.pixelRatio` is deliberately not written: it is module-global, and a
 * pop-out on another monitor shares the module. Returns the disposer; call it on unmount.
 *
 * Takes the stage rather than a getter: vue-konva's `VStage` creates its `Konva.Stage` once in
 * `setup` and destroys it in its own `onBeforeUnmount`, after the caller's disposer has run, so
 * there is no moment at which a live listener could see a different or missing stage.
 */
export function followPixelRatio(stage: Konva.Stage): () => void {
	const win = ownerWindowOf(stage.container());
	let current = win.devicePixelRatio;
	let query!: MediaQueryList;
	/** Every layer to `current`, the ones Konva built at its cached ratio included, and the query armed for it. */
	function follow(): void {
		for (const layer of stage.getLayers()) {
			if (layer.getCanvas().getPixelRatio() === current) continue;
			layer.getCanvas().setPixelRatio(current);
			layer.batchDraw();
		}
		query = win.matchMedia(`(resolution: ${current}dppx)`);
		query.addEventListener('change', onChange);
	}
	function onChange(): void {
		const next = win.devicePixelRatio;
		if (next === current) return;
		current = next;
		query.removeEventListener('change', onChange);
		follow();
	}
	follow();
	return () => query.removeEventListener('change', onChange);
}
