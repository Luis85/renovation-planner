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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { armedMediaQueries, installCanvas } from '../../../helpers/canvas';
import { followPixelRatio } from '../../../../src/presentation/editor/scene/followPixelRatio';

/** A stage of a known size on a host in the document, so a backing store is asserted in pixels. */
function stageOn(layers: number): Konva.Stage {
	installCanvas();
	const host = document.createElement('div');
	document.body.append(host);
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
	 * A leaf opened AFTER the move: Konva builds every new layer at the ratio it cached at load
	 * (`Canvas.js`, `getDevicePixelRatio`), so the stage is stale before any `change` can fire.
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

	it('does nothing when the ratio reported did not change', () => {
		const stage = stageOn(1);
		const draw = vi.spyOn(stage.getLayers()[0], 'batchDraw');
		followPixelRatio(stage);

		monitorChanged();

		expect(draw).not.toHaveBeenCalled();
	});
});
