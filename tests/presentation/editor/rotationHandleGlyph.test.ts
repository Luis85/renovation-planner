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
import { rotationControlBounds } from '../../../src/presentation/editor/elements/rotationControl';

const mounted: VueWrapper[] = [];
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

it('keeps the native rotation icon screen-sized and moves feedback from its immutable handle and pivot', async () => {
	installCanvas();
	const geometry = { handle: { x: 100, y: 80 }, anchor: { x: 80, y: 90 }, pivot: { x: 50, y: 100 }, bounds: rotationControlBounds({ x: 100, y: 80 }, 80, 1), widthPx: 80, hostWall: false };
	const tokens = Object.fromEntries(Object.keys(THEME_TOKENS).map(key => [key, '#223344'])) as unknown as ThemeTokens;
	const host = defineComponent({
		components: { RotationHandleGlyph },
		props: { zoom: { type: Number, required: true }, angle: { type: Number as PropType<number | null>, default: null }, highlighted: Boolean },
		setup: () => ({ geometry, tokens }),
		template: '<v-stage :config="{width:600,height:600}"><v-layer :config="{scaleX:zoom,scaleY:zoom}"><RotationHandleGlyph :geometry="geometry" :tokens="tokens" :zoom="zoom" :angle="angle" :radius-px="14" :dragging="angle !== null" :highlighted="highlighted" :snap-degrees="angle !== null ? 15 : null" :obstacles="[]" :visible-bounds="{min:{x:0,y:0},max:{x:500,y:500}}" /></v-layer></v-stage>',
	});
	const wrapper = mount(host, { props: { zoom: 1 }, global: { plugins: [VueKonva] } }); mounted.push(wrapper);
	const stage = expectDefined(Konva.stages.at(-1), 'glyph stage');
	const handle = expectDefined(stage.findOne<Konva.Circle>('.rotation-handle-button'), 'visible rotation handle');
	const icon = expectDefined(stage.findOne<Konva.Group>('.rotation-handle-icon'), 'native icon');
	expect(stage.findOne<Konva.Text>('.rotation-control-label')?.text()).toBe('Rotate');
	expect(icon.find<Konva.Path>('Path').map(path => path.data())).toEqual(editorIconNodes['rotate-cw'].map(node => node.attributes.d));
	for (const zoom of [0.2, 1.7]) {
		await wrapper.setProps({ zoom });
		expect(handle.radius() * zoom).toBeCloseTo(14);
		expect(handle.position()).toEqual(geometry.handle);
		const buttonBounds = handle.getClientRect(), iconBounds = icon.getClientRect();
		expect(iconBounds.x).toBeGreaterThan(buttonBounds.x);
		expect(iconBounds.x + iconBounds.width).toBeLessThan(buttonBounds.x + buttonBounds.width);
	}
	await wrapper.setProps({ highlighted: true });
	expect(stage.findOne('.rotation-pivot')?.position()).toEqual(geometry.pivot);
	expect(stage.findOne<Konva.Text>('.rotation-help-label')?.text()).toBe('Drag to rotate');
	expect(stage.findOne<Konva.Text>('.rotation-instruction-label')?.text()).toBe('Click for a precise angle');
	await wrapper.setProps({ angle: 90 });
	expect(handle.x()).toBeCloseTo(70); expect(handle.y()).toBeCloseTo(150);
	expect(stage.findOne('.rotation-pivot')?.position()).toEqual(geometry.pivot);
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('+90°');
	expect(stage.findOne<Konva.Text>('.rotation-instruction-label')?.text()).toBe('Clockwise · 15° steps');
	await wrapper.setProps({ zoom: 1, angle: 0 });
	const angleSurface = expectDefined(stage.findOne<Konva.Rect>('.rotation-feedback-surface'), 'visible angle label').getClientRect();
	expect(angleSurface.x).toBeGreaterThanOrEqual(0);
	expect(angleSurface.x + angleSurface.width).toBeLessThanOrEqual(500);
	await wrapper.setProps({ angle: 32.48 });
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('+32.5°');
	await wrapper.setProps({ angle: -32.48 });
	expect(stage.findOne<Konva.Text>('.rotation-angle-label')?.text()).toBe('-32.5°');
	await wrapper.setProps({ angle: 90 });
	expect(handle.x()).toBeCloseTo(70); expect(handle.y()).toBeCloseTo(150);
	await wrapper.setProps({ angle: null, highlighted: false });
	expect(handle.position()).toEqual(geometry.handle);
	expect(stage.find('.rotation-pivot')).toHaveLength(0);
	expect(stage.find('.rotation-angle-label')).toHaveLength(0);
	expect(geometry.handle).toEqual({ x: 100, y: 80 });
	expect(geometry.pivot).toEqual({ x: 50, y: 100 });
});
