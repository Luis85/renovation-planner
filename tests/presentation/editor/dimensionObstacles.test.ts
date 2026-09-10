/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { connectedObservers, installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { settle } from '../../helpers/editor';
import { useDimensionObstacles, type DimensionObstacleLayout } from '../../../src/presentation/editor/resize/useDimensionObstacles';
import type { Viewport } from '../../../src/presentation/editor/viewport/Viewport';
import type { BoundingBox } from '../../../src/core/geometry/BoundingBox';
import { installDimensionFrames, flushDimensionFrames, clearDimensionFrames, pendingDimensionFrames } from '../../helpers/dimensionFrames';

const cleanups: (() => void)[] = [];
beforeEach(() => { installResizeObserver(); installDimensionFrames(); });
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	clearDimensionFrames(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('shares the observer for native rotation obstacles and clears removed controls without frame loops', async () => {
	const camera: Viewport = { pan: { x: 0, y: 0 }, zoom: 1 }, revision = ref(0);
	const publish = vi.fn<(bounds: readonly BoundingBox[]) => void>(), before = connectedObservers();
	const wrapper = mount(defineComponent({ setup() {
		const root = ref<HTMLElement | null>(null);
		useDimensionObstacles(root, () => camera, () => undefined, { publish, invalidate: () => revision.value });
		return () => h('div', { class: 'renovation-plan-editor' }, [h('div', { ref: root }), h('div', { class: 'rp-primary-actions' })]);
	} }), { attachTo: document.body });
	let mounted = true; cleanups.push(() => { if (mounted) wrapper.unmount(); });
	const root = wrapper.element.firstElementChild as HTMLElement, actions = wrapper.get('.rp-primary-actions').element as HTMLElement;
	placeAt(root, 100, 50, 600, 400); placeAt(actions, 200, 60, 200, 44);
	await flushDimensionFrames();
	const bounds = [{ min: { x: 96, y: 6 }, max: { x: 304, y: 58 } }];
	// STAGE_PIXELS maps world units through the actual camera, not the page origin.
	expect(publish).toHaveBeenLastCalledWith(bounds); expect(connectedObservers()).toBe(before + 1);
	const calls = publish.mock.calls.length; revision.value++; await flushDimensionFrames();
	expect(publish).toHaveBeenCalledTimes(calls); expect(pendingDimensionFrames()).toHaveLength(0);
	actions.style.visibility = 'hidden'; revision.value++; await flushDimensionFrames(); expect(publish).toHaveBeenLastCalledWith([]);
	actions.style.visibility = ''; revision.value++; await flushDimensionFrames(); expect(publish).toHaveBeenLastCalledWith(bounds);
	actions.remove(); await settle(); await flushDimensionFrames(); expect(publish).toHaveBeenLastCalledWith([]);
	wrapper.unmount(); mounted = false; expect(connectedObservers()).toBe(before); expect(pendingDimensionFrames()).toHaveLength(0);
});

it('owns one dimension observer, coalesces layout, retains equal bounds and clears hidden/unmounted controls', async () => {
	const camera = ref<Viewport>({ pan: { x: 100, y: 200 }, zoom: 0.05 }), visible = ref(true), inline = ref(false);
	const publish = vi.fn<(layout: DimensionObstacleLayout) => void>(), before = connectedObservers();
	const wrapper = mount(defineComponent({ setup() {
		const root = ref<HTMLElement | null>(null);
		useDimensionObstacles(root, () => camera.value, publish);
		return () => h('div', { ref: root, 'data-pan': camera.value.pan.x }, visible.value ? [h('div', { class: 'rp-dimension-anchor' }, inline.value ? h('form') : h('button'))] : []);
	} }), { attachTo: document.body });
	let mounted = true;
	cleanups.push(() => { if (mounted) wrapper.unmount(); });
	const root = wrapper.element as HTMLElement;
	placeAt(root, 200, 50, 600, 900);
	placeAt(wrapper.get('.rp-dimension-anchor').element as HTMLElement, 310, 150, 42, 30);
	await flushDimensionFrames();
	expect(connectedObservers()).toBe(before + 1);
	expect(publish).toHaveBeenLastCalledWith({ bounds: [{ min: { x: 2220, y: 2120 }, max: { x: 3220, y: 2880 } }], viewport: { min: { x: 100, y: 200 }, max: { x: 12100, y: 18200 } } });
	const measured = publish.mock.calls[0][0];
	resizeTo(root, 600, 900); resizeTo(root, 600, 900); resizeTo(root, 600, 900);
	expect(pendingDimensionFrames()).toHaveLength(1); await flushDimensionFrames(); expect(publish).toHaveBeenCalledTimes(1);
	camera.value = { ...camera.value, pan: { x: 200, y: 200 } }; await flushDimensionFrames();
	expect(publish.mock.calls.at(-1)?.[0]).not.toBe(measured);
	expect(publish.mock.calls.at(-1)?.[0].bounds[0].min.x).toBe(2320);
	inline.value = true; await settle();
	const anchor = wrapper.get('.rp-dimension-anchor').element as HTMLElement;
	placeAt(anchor, 280, 140, 240, 300); resizeTo(anchor, 240, 300); await flushDimensionFrames();
	expect(connectedObservers()).toBe(before + 1);
	expect(publish.mock.calls.at(-1)?.[0].bounds[0].max.y).toBe(8080);
	visible.value = false; await flushDimensionFrames(); expect(publish.mock.calls.at(-1)?.[0].bounds).toEqual([]);
	const count = publish.mock.calls.length; resizeTo(anchor, 99, 99); await flushDimensionFrames(); expect(publish).toHaveBeenCalledTimes(count);
	visible.value = true; await settle();
	placeAt(wrapper.get('.rp-dimension-anchor').element as HTMLElement, 310, 150, 42, 30); await flushDimensionFrames();
	resizeTo(root, 600, 900); expect(pendingDimensionFrames()).toHaveLength(1);
	const queued = pendingDimensionFrames(); wrapper.unmount(); mounted = false;
	expect(pendingDimensionFrames()).toHaveLength(0); expect(connectedObservers()).toBe(before); expect(publish).toHaveBeenLastCalledWith({ bounds: [], viewport: null });
	const stopped = publish.mock.calls.length;
	for (const callback of queued) callback(200);
	resizeTo(root, 600, 900); await flushDimensionFrames(); expect(publish).toHaveBeenCalledTimes(stopped);
});
