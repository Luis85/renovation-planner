// @vitest-environment jsdom
/**
 * A locked zone's group is translucent (ADR-0027), and its captions carry a fill AND a halo
 * stroke. Konva draws a translucent fill-and-stroke shape through the STAGE's buffer canvas, sized
 * to the stage, and Chromium refuses `drawImage` of a 0-size canvas — so a plan with a locked zone
 * threw on any draw while its stage measured 0, and the editor never opened again.
 */
import type Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, type CanvasHarness } from '../../helpers/editor';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';

let open: CanvasHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

it('draws a locked zone\'s captions straight onto the layer, never through the stage buffer', async () => {
	const zones = FIXTURE_ZONES.map(zone => ({ ...zone, locked: true as const }));
	open = await mountPlanEditorCanvas({ zones });
	const layer = open.stage.findOne<Konva.Layer>('.zone');
	if (layer === undefined) throw new Error('no zone layer');
	const drawImage = vi.spyOn(layer.getCanvas().getContext(), 'drawImage');

	open.stage.size({ width: 0, height: 0 });
	layer.draw();

	expect(layer.find<Konva.Text>('Text').map(text => text.getAbsoluteOpacity())).toContain(0.5);
	expect(drawImage).not.toHaveBeenCalled();
});
