/**
 * @vitest-environment jsdom
 *
 * A window dragged between a 2× and a 1× monitor: Konva samples `devicePixelRatio` once per
 * module, so every layer keeps the backing store it was created with until something calls
 * `setPixelRatio`. Driven through `tests/helpers/canvas.ts`'s `matchMedia`, which is the one
 * fake every canvas mount already shares — it never fires `change` on its own, so each case
 * moves the monitor by writing `devicePixelRatio` and dispatching `change` on the list armed
 * last, exactly as a browser would deliver it.
 */
import Konva from 'konva';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { armedMediaQueries, installCanvas, installMatchMedia } from '../../../helpers/canvas';
import { followPixelRatio } from '../../../../src/presentation/editor/scene/followPixelRatio';

/** A stage of a known size on a host in `doc`, so a backing store is asserted in pixels. */
function stageOn(layers: number, doc: Document = document): Konva.Stage {
	installCanvas();
	const host = doc.createElement('div');
	doc.body.append(host);
	const stage = new Konva.Stage({ container: host, width: 100, height: 50 });
	for (let index = 0; index < layers; index += 1) stage.add(new Konva.Layer());
	return stage;
}

function setDevicePixelRatio(ratio: number): void {
	Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
}

/** What moving the window to another monitor delivers: the `change` of the list armed LAST. */
function monitorChanged(): void {
	armedMediaQueries().at(-1)?.dispatchEvent(new Event('change'));
}

describe('followPixelRatio', () => {
	afterEach(() => {
		// A COPY: `destroy()` splices the live registry, so iterating it skips every other stage.
		for (const stage of Konva.stages.slice()) {
			stage.container().remove();
			stage.destroy();
		}
		setDevicePixelRatio(1);
	});

	it('resizes every layer backing store to the new ratio and re-arms for the new value', () => {
		const stage = stageOn(2);
		const before = armedMediaQueries().length;
		const stop = followPixelRatio(stage);
		expect(armedMediaQueries().slice(before).map((list) => list.media)).toEqual(['(resolution: 1dppx)']);

		setDevicePixelRatio(2);
		monitorChanged();

		for (const layer of stage.getLayers()) {
			expect(layer.getCanvas().getPixelRatio()).toBe(2);
			expect(layer.getCanvas()._canvas.width).toBe(200);
		}
		expect(armedMediaQueries().at(-1)?.media).toBe('(resolution: 2dppx)');

		stop();
		setDevicePixelRatio(3);
		monitorChanged();
		expect(armedMediaQueries()).toHaveLength(before + 2);
		expect(stage.getLayers()[0].getCanvas().getPixelRatio()).toBe(2);
	});

	/**
	 * A leaf opened AFTER the move: Konva builds every new layer at the ratio it sampled at load
	 * (`Global.js`, `Konva.pixelRatio`), so the stage is stale before any `change` can fire.
	 */
	it('brings layers built at a stale cached ratio to the window’s current one when it starts', () => {
		setDevicePixelRatio(1);
		const stage = stageOn(2);
		setDevicePixelRatio(2);
		const draw = vi.spyOn(stage.getLayers()[0], 'batchDraw');

		followPixelRatio(stage);

		for (const layer of stage.getLayers()) {
			expect(layer.getCanvas().getPixelRatio()).toBe(2);
			expect(layer.getCanvas()._canvas.width).toBe(200);
		}
		expect(draw).toHaveBeenCalledOnce();
		expect(armedMediaQueries().at(-1)?.media).toBe('(resolution: 2dppx)');
	});

	/**
	 * An Obsidian pop-out leaf: the stage's container lives in another document with a window
	 * of its own, and THAT window's ratio is the monitor the pop-out is on. A REAL second
	 * document (an iframe's), per the fake rule; its window gets the same fake as the main one.
	 */
	it('reads the ratio of, and arms on, the window that owns the stage container', () => {
		const frame = document.createElement('iframe');
		document.body.append(frame);
		onTestFinished(() => frame.remove());
		const doc = frame.contentDocument as Document, win = frame.contentWindow as Window;
		installMatchMedia(win);
		const stage = stageOn(1, doc);
		Object.defineProperty(win, 'devicePixelRatio', { configurable: true, value: 2 });
		const popOut = vi.spyOn(win, 'matchMedia'), main = vi.spyOn(window, 'matchMedia');

		followPixelRatio(stage);

		expect(popOut).toHaveBeenCalledWith('(resolution: 2dppx)');
		expect(main).not.toHaveBeenCalled();
		expect(stage.getLayers()[0].getCanvas().getPixelRatio()).toBe(2);
	});

	it('does nothing when the ratio reported did not change', () => {
		const stage = stageOn(1);
		const draw = vi.spyOn(stage.getLayers()[0], 'batchDraw');
		followPixelRatio(stage);

		monitorChanged();

		expect(draw).not.toHaveBeenCalled();
	});
});
