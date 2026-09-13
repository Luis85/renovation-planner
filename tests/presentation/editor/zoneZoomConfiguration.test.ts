/**
 * @vitest-environment jsdom
 *
 * A wheel ZOOM did Vue work proportional to the number of rooms (`docs/tests/cases/Canvas
 * performance.md`, 2026-09-13: 7 → 21 → 37 ms at rooms 0/40/80, pan flat). Two things re-ran per
 * room: every caption's `1 / zoom` scale travelled through its vue-konva `config`, re-rendering the
 * room and re-applying three Text configs; and the room's automatic caption anchor (a centroid and
 * a containment test) was re-derived although it depends on the geometry alone.
 */
import type Konva from 'konva';
import { afterEach, expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, settle, type CanvasHarness } from '../../helpers/editor';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import ZoneShape from '../../../src/presentation/editor/layers/zone/ZoneShape.vue';
import { labelAnchor } from '../../../src/presentation/editor/layers/zone/ZoneRenderModel';
import type * as ZoneRenderModule from '../../../src/presentation/editor/layers/zone/ZoneRenderModel';

vi.mock('../../../src/presentation/editor/layers/zone/ZoneRenderModel', async (importOriginal) => {
	const real = await importOriginal<typeof ZoneRenderModule>();
	return { ...real, labelAnchor: vi.fn<typeof real.labelAnchor>(real.labelAnchor) };
});

let open: CanvasHarness | undefined;
afterEach(() => { open?.unmount(); open = undefined; });

function captions(stage: Konva.Stage): Konva.Text[] {
	return stage.findOne<Konva.Layer>('.zone')?.find<Konva.Text>('Text') ?? [];
}

async function zoomBy(rig: CanvasHarness, factor: number): Promise<number> {
	const editor = useEditorStore(rig.pinia);
	editor.viewport = { ...editor.viewport, zoom: editor.viewport.zoom * factor };
	await settle();
	return editor.viewport.zoom;
}

it('re-applies no room caption configuration on a zoom, and still draws every caption at 1 / zoom', async () => {
	// A Konva event bound as a listener on `<VLayer>` is one Vue warns about on every layer render.
	const warn = vi.spyOn(console, 'warn');
	const rig = await mountPlanEditorCanvas(); open = rig;
	const texts = rig.wrapper.findAllComponents(ZoneShape).flatMap(shape => shape.findAllComponents({ name: 'Text' }));
	expect(texts).toHaveLength(FIXTURE_ZONES.length * 3);
	const configs = texts.map(text => text.props('config'));

	const zoom = await zoomBy(rig, 2);

	for (const [index, text] of texts.entries()) expect(text.props('config')).toBe(configs[index]);
	expect(captions(rig.stage)).toHaveLength(FIXTURE_ZONES.length * 3);
	for (const caption of captions(rig.stage)) expect(caption.scale()).toEqual({ x: 1 / zoom, y: 1 / zoom });
	expect(warn.mock.calls.map(call => String(call[0])).filter(text => text.includes('Extraneous'))).toEqual([]);
	warn.mockRestore();
});

it('does not re-derive any room caption anchor on a zoom', async () => {
	const rig = await mountPlanEditorCanvas(); open = rig;
	vi.mocked(labelAnchor).mockClear();

	await zoomBy(rig, 2);

	expect(labelAnchor).not.toHaveBeenCalled();
});

it('draws the caption of a room added after mount at the current 1 / zoom', async () => {
	const zones = [...FIXTURE_ZONES];
	const rig = await mountPlanEditorCanvas({ zones }); open = rig;
	const zoom = await zoomBy(rig, 3);

	zones.push({ ...FIXTURE_ZONES[0], id: 'zone-added', name: 'Added', points: [{ x: 0, y: 4000 }, { x: 2000, y: 4000 }, { x: 2000, y: 6000 }, { x: 0, y: 6000 }] });
	rig.changePlan();
	await settle();

	const added = rig.stage.findOne<Konva.Group>('.zone-added')?.find<Konva.Text>('Text') ?? [];
	expect(added).toHaveLength(3);
	for (const caption of added) expect(caption.scale()).toEqual({ x: 1 / zoom, y: 1 / zoom });
});
