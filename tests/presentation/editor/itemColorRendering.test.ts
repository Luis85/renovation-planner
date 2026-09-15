// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { defineComponent, type PropType } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import ElementShapes from '../../../src/presentation/editor/elements/ElementShapes.vue';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { postOutline } from '../../../src/domain/spatial/structuralElement';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { backingCanvas, installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined } from '../../helpers/domain';

// Distinct per-token strings, with one real background so a tint is computable.
const tokens = { ...Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, 'token-' + key])), canvasBackground: '#ffffff' } as unknown as ThemeTokens;
const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });
function draw(elements: readonly NamedSpatialElement[], selectedIds: readonly string[] = []) {
	installCanvas();
	// The hatch mark's tile ground goes through `patternTile`, which reads Obsidian's global
	// `createEl` (tests/helpers/dom.ts) — the brief's test omitted this, matching
	// tests/presentation/editor/structure/patternTile.test.ts's own setup instead.
	installObsidianDom();
	const host = defineComponent({
		components: { ElementShapes },
		props: { elements: { type: Array as PropType<readonly NamedSpatialElement[]>, required: true }, selectedIds: { type: Array as PropType<readonly string[]>, required: true } },
		setup: () => ({ tokens }),
		template: '<v-stage :config="{width:600,height:600}"><v-layer><ElementShapes :elements="elements" :selected-ids="selectedIds" :tokens="tokens" :zoom="1" /></v-layer></v-stage>',
	});
	mounted.push(mount(host, { props: { elements, selectedIds }, global: { plugins: [createPinia(), VueKonva] } }));
	return expectDefined(Konva.stages.at(-1), 'element stage');
}
const node = <T extends Konva.Node>(stage: Konva.Stage, selector: string): T => expectDefined(stage.findOne<T>(selector), selector);
const firstLine = (stage: Konva.Stage, group: string) => expectDefined(node<Konva.Group>(stage, group).findOne<Konva.Line>('Line'), group + ' line');
const line = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
const post = (color: 'green', loadBearing: boolean): NamedSpatialElement => ({ id: 'element-post', kind: 'post', name: 'Post', loadBearing, points: postOutline({ x: 1000, y: 1000 }, 140, 140), color });

it('tints closed fills and inks lines, keeping closed outlines on the theme token', () => {
	const stage = draw([
		{ id: 'element-item', kind: 'object', name: 'Item', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], color: 'blue' },
		{ id: 'element-path', kind: 'path', name: 'Path', points: line, color: '#3a7bd5' },
		{ id: 'element-stair', kind: 'stair', name: 'Stair', points: line, stair: { width: 900, treads: 12, direction: 'up' }, color: 'blue' },
		{ id: 'element-arrow', kind: 'arrow', name: 'Arrow', points: line, color: 'rose' },
	]);
	expect(firstLine(stage, '.element-object').fill()).toBe('rgb(206, 223, 241)');
	expect(firstLine(stage, '.element-object').stroke()).toBe(tokens.zoneStroke);
	expect(firstLine(stage, '.element-path').stroke()).toBe('#3a7bd5');
	expect(node<Konva.Line>(stage, '.stair-outline').fill()).toBe('rgb(206, 223, 241)');
	expect(node<Konva.Line>(stage, '.stair-outline').stroke()).toBe(tokens.zoneStroke);
	expect(node<Konva.Arrow>(stage, '.direction-arrow').stroke()).toBe('#ce6682');
});

it('inks structural and drafting marks, fills a load-bearing post in its ink, and grounds a hatch on its tint', () => {
	const stage = draw([
		post('green', true),
		{ id: 'element-beam', kind: 'beam', name: 'Beam', loadBearing: false, width: 160, points: line, color: 'amber' },
		{ id: 'element-text', kind: 'text', name: 'Note', points: [{ x: 200, y: 200 }], color: 'violet' },
		{ id: 'element-hatch', kind: 'hatch', name: 'Hatch', points: [{ x: 0, y: 2000 }, { x: 900, y: 2000 }, { x: 900, y: 2600 }], color: 'rose' },
	]);
	expect(node<Konva.Line>(stage, '.post-outline').fill()).toBe('#54976d');
	expect(node<Konva.Line>(stage, '.post-outline').stroke()).toBe('#54976d');
	expect(node<Konva.Line>(stage, '.beam-edge').stroke()).toBe('#d69b32');
	expect(node<Konva.Text>(stage, '.drafting-text').fill()).toBe('#956bc4');
	const hatch = node<Konva.Line>(stage, '.drafting-hatch');
	expect(hatch.stroke()).toBe(tokens.zoneStroke);
	// (6, 1) lies 3.5 px from both stone diagonals, so it is pure ground: rose tinted over white.
	expect([...(backingCanvas(hatch.fillPatternImage() as HTMLCanvasElement)?.getContext('2d').getImageData(6, 1, 1, 1).data ?? [])]).toEqual([241, 212, 220, 255]);
});

it('gives way to the accent while selected, and keeps fills', () => {
	const stage = draw([{ id: 'element-path', kind: 'path', name: 'Path', points: line, color: '#3a7bd5' }, post('green', false)], ['element-path', 'element-post']);
	expect(firstLine(stage, '.element-path').stroke()).toBe(tokens.accent);
	expect(node<Konva.Line>(stage, '.post-outline').stroke()).toBe(tokens.accent);
	expect(node<Konva.Line>(stage, '.post-outline').fill()).toBe('#ffffff');
});
