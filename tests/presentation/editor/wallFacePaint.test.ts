// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type Konva from 'konva';
import WallPolygonPaint from '../../../src/presentation/editor/structure/WallPolygonPaint.vue';
import { expectDefined } from '../../helpers/domain';
import type { Point } from '../../../src/core/geometry/Point';

it('unions opposite windings without holes and drops empty/degenerate join wedges at large coordinates', () => {
	const polygon = [{ x: 999999800, y: 999999800 }, { x: 999999900, y: 999999800 }, { x: 999999900, y: 999999900 }, { x: 999999800, y: 999999900 }];
	const wrapper = shallowMount(WallPolygonPaint, { props: { polygons: [polygon, polygon.toReversed(), [], [polygon[0], polygon[0], polygon[1]]], color: 'white', edge: false, zoom: 1 },
		global: { stubs: { VShape: { name: 'VShape', props: ['config'], template: '<div />' } } } });
	const config = wrapper.getComponent({ name: 'VShape' }).props('config') as Konva.ShapeConfig;
	const paths: Point[][] = [], fill = vi.fn<(shape: Konva.Shape) => void>();
	const context = { beginPath: () => undefined, moveTo: (x: number, y: number) => paths.push([{ x, y }]), lineTo: (x: number, y: number) => paths[paths.length - 1].push({ x, y }), closePath: () => undefined, fillStrokeShape: fill };
	const shape = {} as Konva.Shape;
	expectDefined(config.sceneFunc, 'paint').call(shape, context as unknown as Konva.Context, shape);
	expect(paths).toEqual([polygon, polygon]);
	expect(fill).toHaveBeenCalledOnce(); expect(fill).toHaveBeenCalledWith(shape); expect(config.strokeEnabled).toBe(false);
	wrapper.unmount();
});
