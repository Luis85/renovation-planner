// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { defineComponent, type PropType } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import RotationHandleGlyph from '../../../src/presentation/editor/elements/RotationHandleGlyph.vue';
import { THEME_TOKENS, type ThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { installCanvas } from '../../helpers/canvas';
import { expectDefined } from '../../helpers/domain';
import { editorIconNodes } from '../../helpers/editorIconNodes';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

it('keeps the native rotation icon screen-sized and moves feedback from its immutable handle and pivot', async () => {
	installCanvas();
	const geometry = { handle: { x: 100, y: 80 }, anchor: { x: 80, y: 90 }, pivot: { x: 50, y: 100 } };
	const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, '#223344'])) as unknown as ThemeTokens;
	const host = defineComponent({
		components: { RotationHandleGlyph },
		props: { zoom: { type: Number, required: true }, angle: { type: Number as PropType<number | null>, default: null }, bounded: Boolean },
		setup: () => ({ geometry, tokens }),
		template: '<v-stage :config="{width:600,height:600}"><v-layer :config="{scaleX:zoom,scaleY:zoom}"><RotationHandleGlyph :geometry="geometry" :tokens="tokens" :zoom="zoom" :angle="angle" :radius-px="14" :visible-bounds="bounded ? {min:{x:0,y:0},max:{x:120,y:150}} : undefined" /></v-layer></v-stage>',
	});
	const wrapper = mount(host, { props: { zoom: 1 }, global: { plugins: [VueKonva] } }); mounted.push(wrapper);
	const stage = expectDefined(Konva.stages.at(-1), 'glyph stage');
	const handle = expectDefined(stage.findOne<Konva.Circle>('.rotation-handle-button'), 'visible rotation handle');
	const icon = expectDefined(stage.findOne<Konva.Group>('.rotation-handle-icon'), 'native icon');
	expect(icon.find<Konva.Path>('Path').map(path => path.data())).toEqual(editorIconNodes['rotate-cw'].map(node => node.attributes.d));
	for (const zoom of [0.2, 1.7]) {
		await wrapper.setProps({ zoom });
		expect(handle.radius() * zoom).toBeCloseTo(14);
		expect(handle.position()).toEqual(geometry.handle);
		const buttonBounds = handle.getClientRect(), iconBounds = icon.getClientRect();
		expect(iconBounds.x).toBeGreaterThan(buttonBounds.x);
		expect(iconBounds.x + iconBounds.width).toBeLessThan(buttonBounds.x + buttonBounds.width);
	}
	await wrapper.setProps({ angle: 90 });
	expect(handle.x()).toBeCloseTo(70); expect(handle.y()).toBeCloseTo(150);
	expect(stage.findOne('.rotation-pivot')?.position()).toEqual(geometry.pivot);
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('+90°');
	await wrapper.setProps({ zoom: 1, angle: 0, bounded: true });
	const angleSurface = expectDefined(stage.findOne<Konva.Rect>('.rotation-angle-surface'), 'visible angle label');
	expect(angleSurface.x()).toBe(60);
	expect(angleSurface.x() + angleSurface.width()).toBeLessThanOrEqual(120);
	await wrapper.setProps({ angle: 180 });
	expect(angleSurface.x()).toBe(4);
	await wrapper.setProps({ angle: 32.48 });
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('+32.5°');
	await wrapper.setProps({ angle: -32.48 });
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('-32.5°');
	await wrapper.setProps({ angle: 90 });
	expect(handle.x()).toBeCloseTo(70); expect(handle.y()).toBeCloseTo(150);
	await wrapper.setProps({ angle: null });
	expect(handle.position()).toEqual(geometry.handle);
	expect(stage.find('.rotation-pivot')).toHaveLength(0);
	expect(stage.find('.rotation-angle-label')).toHaveLength(0);
	expect(geometry).toEqual({ handle: { x: 100, y: 80 }, anchor: { x: 80, y: 90 }, pivot: { x: 50, y: 100 } });
});
