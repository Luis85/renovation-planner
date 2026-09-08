// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Point } from '../../../src/core/geometry/Point';
import ReferencePrepare from '../../../src/presentation/editor/reference/ReferencePrepare.vue';
import ReferencePreview from '../../../src/presentation/editor/reference/ReferencePreview.vue';
import { previewTransform } from '../../../src/presentation/editor/reference/referenceSetup';
import { zoomReference } from '../../../src/presentation/editor/reference/referenceViewport';
import { referencePoint } from '../../../src/domain/plan/ReferenceAppearance';
import { installCanvas } from '../../helpers/canvas';
import { connectedObservers, installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';

const appearance = { crop: { x: 20, y: 30, width: 400, height: 200 }, rotation: 0, opacity: 1, visible: true, locked: true };
const points = [{ x: 100, y: 100 }, { x: 300, y: 100 }];
let wrapper: VueWrapper | undefined;
beforeEach(() => { installCanvas(); installResizeObserver(); });
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });
function setup() {
	const image = document.createElement('canvas'); image.width = 800; image.height = 600;
	const unsubscribe = vi.fn<() => void>(), subscribe = vi.fn<(listener: () => void) => () => void>(() => unsubscribe), observers = connectedObservers();
	wrapper = mount(ReferencePreview, { attachTo: document.body, props: { raster: { kind: 'raster', image, width: 800, height: 600, worldOrigin: { x: 0, y: 0 }, worldScale: 1 }, appearance, points, measuring: true, onThemeChange: subscribe } });
	const canvas = wrapper.get('canvas').element as HTMLCanvasElement;
	placeAt(canvas, 0, 0, 400, 220);
	return { w: wrapper, canvas, unsubscribe, observers };
}
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number, button = 0, id = 1): void {
	const event = new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true });
	Object.defineProperty(event, 'pointerId', { value: id }); canvas.dispatchEvent(event);
}

it('picks source pixels after zoom, suppresses a drag click, and fits without changing calibration points', async () => {
	const { w, canvas } = setup(), original = structuredClone(points);
	const fit = previewTransform(appearance), view = zoomReference(fit, { x: 200, y: 110 }, 1.25, fit.scale);
	await w.get('[data-rp-reference-view="zoom-in"]').trigger('click'); expect(w.get('output').text()).toBe('125%');
	const pixel = { x: 200, y: 120 }, position = referencePoint(pixel, appearance, view.scale);
	await w.get('canvas').trigger('click', { clientX: position.x + view.x, clientY: position.y + view.y });
	expect(w.emitted('point')?.[0]?.[0]).toEqual(pixel);
	await w.get('canvas').trigger('click', { clientX: -1, clientY: 110 }); expect(w.emitted('point')).toHaveLength(1);
	pointer(canvas, 'pointerdown', 150, 100); pointer(canvas, 'pointermove', 180, 140); pointer(canvas, 'pointerup', 180, 140);
	await w.get('canvas').trigger('click', { clientX: 180, clientY: 140 }); expect(w.emitted('point')).toHaveLength(1);
	await w.get('[data-rp-reference-view="fit"]').trigger('click'); expect(w.get('output').text()).toBe('100%');
	expect(points).toEqual(original);
});

it('supports keyboard navigation, measures resized CSS pixels and releases subscriptions', async () => {
	const { w, canvas, observers, unsubscribe } = setup();
	await w.get('canvas').trigger('keydown', { key: '+' }); expect(w.get('output').text()).toBe('125%');
	await w.get('canvas').trigger('keydown', { key: 'ArrowLeft' }); expect(w.emitted('point')).toBeUndefined();
	placeAt(canvas, 0, 0, 800, 500); resizeTo(canvas, 800, 500); await nextTick();
	await w.get('canvas').trigger('keydown', { key: 'f' }); expect(w.get('output').text()).toBe('100%');
	expect(canvas.width).toBe(800 * (window.devicePixelRatio || 1));
	await w.get('[data-rp-reference-view="pan"]').trigger('click');
	await w.get('canvas').trigger('click', { clientX: 200, clientY: 200 }); expect(w.emitted('point')).toBeUndefined();
	w.unmount(); wrapper = undefined;
	expect(connectedObservers()).toBe(observers); expect(unsubscribe).toHaveBeenCalledOnce();
});


it('bounds reference source choices without hiding matches beyond the first page', async () => {
	wrapper = mount(ReferencePrepare, { props: { sources: Array.from({ length: 2000 }, (_, index) => `Plans/${index}.png`), path: '', page: 1, rotation: 0, crop: appearance.crop, pdf: false, paused: false, loading: false, hasRaster: false } });
	expect(wrapper.findAll('datalist option')).toHaveLength(20);
	await wrapper.setProps({ path: 'Plans/1999' });
	expect(wrapper.findAll('datalist option').map(option => option.attributes('value'))).toEqual(['Plans/1999.png']);
});


it('preserves navigation intent through Space release, middle drag and pointer cancellation', async () => {
	const { w, canvas } = setup(), captures = new Set<number>();
	const release = vi.fn<(id: number) => void>(id => { captures.delete(id); });
	Object.defineProperties(canvas, {
		setPointerCapture: { value: (id: number) => { captures.add(id); }, configurable: true },
		hasPointerCapture: { value: (id: number) => captures.has(id), configurable: true },
		releasePointerCapture: { value: release, configurable: true },
	});
	await w.get('canvas').trigger('keydown', { key: ' ' });
	pointer(canvas, 'pointerdown', 180, 100);
	await w.get('canvas').trigger('keyup', { key: ' ' });
	pointer(canvas, 'pointerup', 180, 100);
	await w.get('canvas').trigger('click', { clientX: 180, clientY: 100 });
	expect(w.emitted('point')).toBeUndefined();
	pointer(canvas, 'pointerdown', 180, 100, 1); pointer(canvas, 'pointermove', 200, 120, 1);
	pointer(canvas, 'pointerup', 200, 120, 1, 2); expect(captures.has(1)).toBe(true);
	pointer(canvas, 'pointerup', 200, 120, 1); expect(captures.size).toBe(0);
	pointer(canvas, 'pointerdown', 180, 100); pointer(canvas, 'pointermove', 200, 130);
	await w.get('canvas').trigger('pointercancel'); await nextTick();
	expect(w.get('canvas').classes()).not.toContain('is-panning');
	expect(captures.size).toBe(0); expect(release).toHaveBeenCalledTimes(3);
	await w.get('canvas').trigger('click', { clientX: 200, clientY: 130 }); expect(w.emitted('point')).toBeUndefined();
});

it('uses arrow navigation without stealing modified shortcuts or the dialog Escape', async () => {
	const { w, canvas } = setup(), fit = previewTransform(appearance), point = { x: 200, y: 120 };
	const drawn = referencePoint(point, appearance, fit.scale), client = { clientX: drawn.x + fit.x, clientY: drawn.y + fit.y };
	for (const [key, x, y] of [['ArrowLeft', point.x - 32 / fit.scale, point.y], ['ArrowRight', point.x, point.y], ['ArrowUp', point.x, point.y - 32 / fit.scale], ['ArrowDown', point.x, point.y]] as const) {
		await w.get('canvas').trigger('keydown', { key }); await w.get('canvas').trigger('click', client);
		const picked = w.emitted<[Point]>('point')?.at(-1)?.[0];
		expect(picked?.x).toBeCloseTo(x); expect(picked?.y).toBeCloseTo(y);
	}
	await w.get('canvas').trigger('keydown', { key: '=' }); expect(w.get('output').text()).toBe('125%');
	await w.get('canvas').trigger('keydown', { key: 'f', ctrlKey: true }); expect(w.get('output').text()).toBe('125%');
	await w.get('canvas').trigger('keydown', { key: '-' }); expect(w.get('output').text()).toBe('100%');
	const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); canvas.dispatchEvent(escape);
	expect(escape.defaultPrevented).toBe(false);
});
