// @vitest-environment jsdom
/**
 * Spec §9's "Rendering (jsdom): load-bearing versus not for both kinds; beam drawn dashed at
 * `width`" had no test asserting it directly (final review finding F3): nothing read the Konva
 * attributes `StructuralShape.vue` actually produces. Mounted standalone rather than through the
 * whole plan editor, like `rotationHandleGlyph.test.ts` — this file owns one shape's own drawing,
 * not where it sits among the rest of the layer (`structureLayerPasses.test.ts` owns that).
 */
import { afterEach, expect, it } from 'vitest';
import { defineComponent, type PropType } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import StructuralShape from '../../../src/presentation/editor/elements/StructuralShape.vue';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { installCanvas } from '../../helpers/canvas';
import { expectDefined } from '../../helpers/domain';

// Distinct per-token strings, never a literal colour, so a fill/stroke assertion below proves it
// reads a PARTICULAR token rather than merely reads *some* string.
const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, 'token-' + key])) as unknown as ThemeTokens;

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

function mountShape(element: SpatialElement) {
	installCanvas();
	const host = defineComponent({
		components: { StructuralShape },
		props: { element: { type: Object as PropType<SpatialElement>, required: true } },
		setup: () => ({ tokens, zoom: 1 }),
		template: '<v-stage :config="{width:600,height:600}"><v-layer><StructuralShape :element="element" :selected="false" :tokens="tokens" :zoom="zoom" /></v-layer></v-stage>',
	});
	const wrapper = mount(host, { props: { element }, global: { plugins: [VueKonva] } }); mounted.push(wrapper);
	return expectDefined(Konva.stages.at(-1), 'structural shape stage');
}

it('fills a load-bearing post with its stroke token and outlines a non-load-bearing one, both heavier than a beam’s edge when not selected', () => {
	const centre = { x: 1000, y: 1000 };
	const loadBearing: SpatialElement = { id: 'element-post-a', kind: 'post', loadBearing: true, points: postOutline(centre, 140, 140) };
	const notLoadBearing: SpatialElement = { ...loadBearing, loadBearing: false };
	const bearingStage = mountShape(loadBearing);
	const bearingOutline = expectDefined(bearingStage.findOne<Konva.Line>('.post-outline'), 'load-bearing post outline');
	expect(bearingOutline.fill()).toBe(tokens.zoneStroke);
	expect(bearingOutline.stroke()).toBe(tokens.zoneStroke);
	expect(bearingOutline.strokeWidth()).toBeCloseTo(2);
	const bearingDiagonal = expectDefined(bearingStage.findOne<Konva.Line>('.post-diagonal'), 'load-bearing post diagonal');
	expect(bearingDiagonal.stroke()).toBe(tokens.canvasBackground);

	const freeStage = mountShape(notLoadBearing);
	const freeOutline = expectDefined(freeStage.findOne<Konva.Line>('.post-outline'), 'free post outline');
	expect(freeOutline.fill()).toBe(tokens.canvasBackground);
	expect(freeOutline.stroke()).toBe(tokens.zoneStroke);
	expect(freeOutline.strokeWidth()).toBeCloseTo(1);
	const freeDiagonal = expectDefined(freeStage.findOne<Konva.Line>('.post-diagonal'), 'free post diagonal');
	expect(freeDiagonal.stroke()).toBe(tokens.zoneStroke);
});

it('draws a beam as two dashed edges width apart, heavier when load-bearing', () => {
	const width = 160;
	const loadBearing: SpatialElement = { id: 'element-beam-a', kind: 'beam', loadBearing: true, width, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] };
	const notLoadBearing: SpatialElement = { ...loadBearing, loadBearing: false };

	const bearingStage = mountShape(loadBearing);
	const bearingEdges = bearingStage.find<Konva.Line>('.beam-edge');
	expect(bearingEdges).toHaveLength(2);
	for (const edge of bearingEdges) {
		expect(edge.stroke()).toBe(tokens.zoneStroke);
		expect(edge.strokeWidth()).toBeCloseTo(2);
		expect(edge.dash()).toEqual([8, 6]);
	}
	// The axis runs along x, so the perpendicular gap between the two edges is the y-difference of any matching point pair.
	expect(Math.abs(bearingEdges[0].points()[1] - bearingEdges[1].points()[1])).toBeCloseTo(width);

	const freeStage = mountShape(notLoadBearing);
	const freeEdges = freeStage.find<Konva.Line>('.beam-edge');
	expect(freeEdges).toHaveLength(2);
	for (const edge of freeEdges) {
		expect(edge.strokeWidth()).toBeCloseTo(1);
		expect(edge.dash()).toEqual([8, 6]);
	}
});
