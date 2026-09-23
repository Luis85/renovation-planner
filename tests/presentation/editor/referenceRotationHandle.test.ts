// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Point } from '../../../src/core/geometry/Point';
import ReferencePreview from '../../../src/presentation/editor/reference/ReferencePreview.vue';
import { previewTransform } from '../../../src/presentation/editor/reference/referenceSetup';
import { dragRotation, formatDegrees, referenceScreenCentre, rotationHandlePoint, zoomReference } from '../../../src/presentation/editor/reference/referenceViewport';
import { expectDefined } from '../../helpers/domain';
import { backingCanvas, installCanvas } from '../../helpers/canvas';
import { installResizeObserver, placeAt } from '../../helpers/layout';
import { tr } from '../../../src/presentation/i18n/strings';

const appearance = { crop: { x: 20, y: 30, width: 400, height: 200 }, rotation: 0, opacity: 1, visible: true, locked: true };
const centre = referenceScreenCentre(previewTransform(appearance), appearance), radius = 220 / 2 - 16;
const knob = rotationHandlePoint(centre, 0, radius);
let wrapper: VueWrapper | undefined;
beforeEach(() => { installCanvas(); installResizeObserver(); });
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.restoreAllMocks(); vi.useRealTimers(); });
function setup(rotatable: boolean) {
	const image = document.createElement('canvas'); image.width = 800; image.height = 600;
	wrapper = mount(ReferencePreview, { attachTo: document.body, props: { raster: { kind: 'raster', image, width: 800, height: 600, worldOrigin: { x: 0, y: 0 }, worldScale: 1 }, appearance, points: [null, null], measuring: false, rotatable } });
	const canvas = wrapper.get('canvas').element as HTMLCanvasElement;
	placeAt(canvas, 0, 0, 400, 220);
	return { w: wrapper, canvas };
}
function pointer(canvas: HTMLCanvasElement, type: string, at: Point, shiftKey = false): void {
	const event = new MouseEvent(type, { clientX: at.x, clientY: at.y, button: 0, shiftKey, bubbles: true });
	Object.defineProperty(event, 'pointerId', { value: 1 }); canvas.dispatchEvent(event);
}
const rotations = (w: VueWrapper) => (w.emitted<[number]>('rotation') ?? []).map(([degrees]) => degrees);

it('rotates by dragging the knob about the image centre, snapping with Shift, and draws guides only mid-drag', async () => {
	const { w, canvas } = setup(true);
	await nextTick();
	const backing = expectDefined(backingCanvas(canvas), 'preview backing canvas');
	backing.width = canvas.width; backing.height = canvas.height;
	const arc = vi.spyOn(backing.getContext('2d'), 'arc'), lineTo = vi.spyOn(backing.getContext('2d'), 'lineTo');
	expect(w.get('p').text()).toBe(tr('editor.reference.gestures-rotate'));
	pointer(canvas, 'pointermove', knob); await nextTick();
	expect(w.get('canvas').classes()).toContain('is-over-handle');
	pointer(canvas, 'pointermove', { x: 10, y: 10 }); await nextTick();
	expect(w.get('canvas').classes()).not.toContain('is-over-handle');
	pointer(canvas, 'pointerdown', { x: knob.x + 5, y: knob.y }); await nextTick();
	expect(w.get('canvas').classes()).toContain('is-rotating');
	expect(lineTo.mock.calls).toContainEqual([400, centre.y]);
	expect(lineTo.mock.calls).toContainEqual([centre.x, 220]);
	pointer(canvas, 'pointermove', { x: centre.x + radius, y: centre.y });
	pointer(canvas, 'pointermove', { x: centre.x + radius * Math.cos(-53 * Math.PI / 180), y: centre.y + radius * Math.sin(-53 * Math.PI / 180) }, true);
	expect(rotations(w)[0]).toBeCloseTo(90 - Math.atan2(5, radius) * 180 / Math.PI, 0);
	expect(rotations(w)[1]).toBe(30);
	pointer(canvas, 'pointerup', knob); await nextTick();
	expect(w.get('canvas').classes()).not.toContain('is-rotating');
	lineTo.mockClear(); arc.mockClear();
	await w.setProps({ appearance: { ...appearance, opacity: 0.5 } });
	expect(arc).toHaveBeenCalled(); expect(lineTo.mock.calls).not.toContainEqual([400, centre.y]);
	expect(w.emitted('point')).toBeUndefined();
});

it('keeps a panned image centre in place as the parent echoes each dragged rotation', async () => {
	const { w, canvas } = setup(true);
	await w.get('canvas').trigger('keydown', { key: 'ArrowLeft' }); await w.get('canvas').trigger('keydown', { key: 'ArrowUp' });
	const panned = { x: centre.x + 32, y: centre.y + 32 }, tilt = 10 * Math.PI / 180;
	pointer(canvas, 'pointerdown', { x: panned.x, y: panned.y - radius });
	pointer(canvas, 'pointermove', { x: panned.x + radius * Math.sin(tilt), y: panned.y - radius * Math.cos(tilt) });
	const first = expectDefined(rotations(w)[0], 'first drag rotation'); expect(first).toBeCloseTo(10, 0);
	const turned = { ...appearance, rotation: first };
	await w.setProps({ appearance: turned });
	pointer(canvas, 'pointermove', { x: panned.x + radius, y: panned.y });
	expect(rotations(w)[1]).toBeCloseTo(90, 5);
	pointer(canvas, 'pointerup', { x: panned.x + radius, y: panned.y });
});

it('nudges with brackets typed through AltGr but keeps other shortcuts behind the modifier guard', async () => {
	const { w } = setup(true);
	await w.get('canvas').trigger('keydown', { key: ']', ctrlKey: true, altKey: true });
	const altGraph = new KeyboardEvent('keydown', { key: '[', bubbles: true, cancelable: true });
	Object.defineProperty(altGraph, 'getModifierState', { value: (key: string) => key === 'AltGraph' });
	Object.defineProperty(altGraph, 'ctrlKey', { value: true });
	w.get('canvas').element.dispatchEvent(altGraph);
	for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) await w.get('canvas').trigger('keydown', { key: ']', [modifier]: true });
	await w.get('canvas').trigger('keydown', { key: 'f', ctrlKey: true, altKey: true });
	expect(rotations(w)).toEqual([1, -1]); expect(w.get('output').text()).toBe('100%');
});

it('pans rather than rotates when the press misses the knob', async () => {
	const { w, canvas } = setup(true);
	pointer(canvas, 'pointerdown', { x: knob.x + 20, y: knob.y }); pointer(canvas, 'pointermove', { x: knob.x + 60, y: knob.y + 40 });
	await nextTick(); expect(w.get('canvas').classes()).toContain('is-panning');
	pointer(canvas, 'pointerup', { x: knob.x + 60, y: knob.y + 40 });
	expect(w.emitted('rotation')).toBeUndefined();
});

it('nudges rotation with the bracket keys, a tenth of a degree with Shift', async () => {
	const { w } = setup(true);
	await w.get('canvas').trigger('keydown', { key: ']' });
	await w.get('canvas').trigger('keydown', { key: '[' });
	await w.get('canvas').trigger('keydown', { key: '}', shiftKey: true });
	await w.get('canvas').trigger('keydown', { key: '{', shiftKey: true });
	expect(rotations(w)).toEqual([1, -1, 0.1, -0.1]);
});

it('draws no knob and rotates nothing when not rotatable', async () => {
	const { w, canvas } = setup(false);
	await nextTick();
	const backing = expectDefined(backingCanvas(canvas), 'preview backing canvas');
	const arc = vi.spyOn(backing.getContext('2d'), 'arc');
	await w.setProps({ appearance: { ...appearance, opacity: 0.5 } }); expect(arc).not.toHaveBeenCalled();
	expect(w.get('p').text()).toBe(tr('editor.reference.gestures'));
	pointer(canvas, 'pointermove', knob); await nextTick(); expect(w.get('canvas').classes()).not.toContain('is-over-handle');
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointermove', { x: centre.x + radius, y: centre.y });
	await nextTick(); expect(w.get('canvas').classes()).toContain('is-panning');
	pointer(canvas, 'pointerup', { x: centre.x + radius, y: centre.y });
	await w.get('canvas').trigger('keydown', { key: ']' });
	expect(w.emitted('rotation')).toBeUndefined();
});

it('ends a knob drag and clears the handle cursor when the preview stops being rotatable', async () => {
	const { w, canvas } = setup(true);
	pointer(canvas, 'pointermove', knob); pointer(canvas, 'pointerdown', knob); await nextTick();
	expect(w.get('canvas').classes()).toEqual(expect.arrayContaining(['is-over-handle', 'is-rotating']));
	await w.setProps({ rotatable: false });
	pointer(canvas, 'pointermove', { x: centre.x + radius, y: centre.y }); await nextTick();
	expect(w.emitted('rotation')).toBeUndefined();
	expect(w.get('canvas').classes()).not.toContain('is-over-handle'); expect(w.get('canvas').classes()).not.toContain('is-rotating');
});

it('pans rather than rotates from the knob while Pan mode is on or Space is held', async () => {
	const { w, canvas } = setup(true);
	await w.get('[data-rp-reference-view="pan"]').trigger('click');
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointermove', { x: centre.x + radius, y: centre.y });
	await nextTick(); expect(w.get('canvas').classes()).toContain('is-panning');
	pointer(canvas, 'pointerup', { x: centre.x + radius, y: centre.y });
	await w.get('[data-rp-reference-view="pan"]').trigger('click'); await w.get('canvas').trigger('keydown', { key: 'f' });
	await w.get('canvas').trigger('keydown', { key: ' ' });
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointermove', { x: centre.x + radius, y: centre.y });
	await nextTick(); expect(w.get('canvas').classes()).toContain('is-panning');
	pointer(canvas, 'pointerup', { x: centre.x + radius, y: centre.y });
	expect(w.emitted('rotation')).toBeUndefined();
});

it('keeps the zoom and the on-screen image centre through a rotation, and refits on a crop change', async () => {
	const { w, canvas } = setup(true);
	await w.get('[data-rp-reference-view="zoom-in"]').trigger('click'); await w.get('canvas').trigger('keydown', { key: 'ArrowLeft' });
	await w.get('canvas').trigger('keydown', { key: ']' });
	await nextTick();
	const backing = expectDefined(backingCanvas(canvas), 'preview backing canvas');
	backing.width = canvas.width; backing.height = canvas.height;
	const arc = vi.spyOn(backing.getContext('2d'), 'arc'), scale = vi.spyOn(backing.getContext('2d'), 'scale');
	const fit = previewTransform(appearance), zoomed = zoomReference(fit, { x: 200, y: 110 }, 1.25, fit.scale).scale;
	await w.setProps({ appearance: { ...appearance, rotation: expectDefined(rotations(w)[0], 'nudged rotation') } });
	expect(scale.mock.calls.at(-1)).toEqual([zoomed, zoomed]);
	expect(w.get('output').text()).toBe('125%');
	const expected = rotationHandlePoint({ x: centre.x + 32, y: centre.y }, 1, radius), drawn = expectDefined(arc.mock.calls.at(-1), 'knob drawn');
	expect(drawn[0]).toBeCloseTo(expected.x, 6); expect(drawn[1]).toBeCloseTo(expected.y, 6);
	await w.setProps({ appearance: { ...appearance, rotation: 1, crop: { ...appearance.crop, width: 300 } } });
	expect(w.get('output').text()).toBe('100%');
});

async function spied(canvas: HTMLCanvasElement) {
	await nextTick();
	const backing = expectDefined(backingCanvas(canvas), 'preview backing canvas');
	backing.width = canvas.width; backing.height = canvas.height;
	const context = backing.getContext('2d');
	return { arc: vi.spyOn(context, 'arc'), scale: vi.spyOn(context, 'scale'), stroke: vi.spyOn(context, 'stroke'), fillText: vi.spyOn(context, 'fillText'), fillRect: vi.spyOn(context, 'fillRect'), lineTo: vi.spyOn(context, 'lineTo') };
}
const quarter = { x: centre.x + radius, y: centre.y };

it('refits a rotation that arrives at fit and measures the drag about the centre the refit keeps', async () => {
	const { w, canvas } = setup(true);
	const { arc, scale } = await spied(canvas);
	const turned = { ...appearance, rotation: 45 }, fit = previewTransform(turned);
	await w.setProps({ appearance: turned });
	expect(scale.mock.calls.at(-1)).toEqual([fit.scale, fit.scale]); expect(w.get('output').text()).toBe('100%');
	const knob45 = rotationHandlePoint(centre, 45, radius), drawn = expectDefined(arc.mock.calls.at(-1), 'knob drawn');
	expect(drawn[0]).toBeCloseTo(knob45.x, 6); expect(drawn[1]).toBeCloseTo(knob45.y, 6);
	pointer(canvas, 'pointerdown', knob45); pointer(canvas, 'pointermove', rotationHandlePoint(centre, 60, radius));
	await w.setProps({ appearance: { ...appearance, rotation: expectDefined(rotations(w)[0], 'first drag rotation') } });
	pointer(canvas, 'pointermove', quarter); expect(rotations(w)[1]).toBeCloseTo(90, 5);
	pointer(canvas, 'pointerup', quarter);
});

it.each(['wheel', 'drag', 'keys'])('keeps the zoom through a rotation once the view moved by %s, and refits again after F', async how => {
	const { w, canvas } = setup(true);
	const { scale } = await spied(canvas);
	if (how === 'wheel') canvas.dispatchEvent(new WheelEvent('wheel', { clientX: 200, clientY: 110, deltaY: -100, bubbles: true, cancelable: true }));
	else if (how === 'keys') await w.get('canvas').trigger('keydown', { key: 'ArrowLeft' });
	else { pointer(canvas, 'pointerdown', { x: 10, y: 10 }); pointer(canvas, 'pointermove', { x: 60, y: 40 }); pointer(canvas, 'pointerup', { x: 60, y: 40 }); }
	await nextTick();
	const before = expectDefined(scale.mock.calls.at(-1), 'moved scale');
	await w.setProps({ appearance: { ...appearance, rotation: 45 } });
	expect(scale.mock.calls.at(-1)).toEqual(before);
	await w.get('canvas').trigger('keydown', { key: 'f' });
	await w.setProps({ appearance: { ...appearance, rotation: 90 } });
	const fit = previewTransform({ ...appearance, rotation: 90 }).scale;
	expect(scale.mock.calls.at(-1)).toEqual([fit, fit]);
});

it('holds the zoom readout and limits to the last fit through a rotation', async () => {
	const { w } = setup(true);
	for (let index = 0; index < 20; index++) await w.get('[data-rp-reference-view="zoom-in"]').trigger('click');
	expect(w.get('output').text()).toBe('3200%');
	await w.setProps({ appearance: { ...appearance, rotation: 45 } }); expect(w.get('output').text()).toBe('3200%');
	await w.get('[data-rp-reference-view="zoom-in"]').trigger('click'); expect(w.get('output').text()).toBe('3200%');
	await w.get('canvas').trigger('keydown', { key: 'f' }); expect(w.get('output').text()).toBe('100%');
});

it('draws the knob outlined at rest and larger and filled while hovered or dragged', async () => {
	const { w, canvas } = setup(true);
	const { arc, stroke } = await spied(canvas);
	const radiusDrawn = () => expectDefined(arc.mock.calls.at(-1), 'knob drawn')[2];
	await w.setProps({ appearance: { ...appearance, opacity: 0.5 } });
	expect(radiusDrawn()).toBe(7);
	expect(expectDefined(stroke.mock.invocationCallOrder.at(-1), 'outline')).toBeGreaterThan(expectDefined(arc.mock.invocationCallOrder.at(-1), 'arc'));
	pointer(canvas, 'pointermove', knob); await nextTick(); expect(radiusDrawn()).toBe(9);
	expect(expectDefined(stroke.mock.invocationCallOrder.at(-1), 'stem')).toBeLessThan(expectDefined(arc.mock.invocationCallOrder.at(-1), 'arc'));
	pointer(canvas, 'pointermove', { x: 10, y: 10 }); await nextTick(); expect(radiusDrawn()).toBe(7);
	pointer(canvas, 'pointerdown', knob); await nextTick(); expect(radiusDrawn()).toBe(9);
	pointer(canvas, 'pointerup', knob); await nextTick(); expect(radiusDrawn()).toBe(7);
});

it('labels the angle beside the knob, inside the canvas, only while dragging or nudging', async () => {
	const { w, canvas } = setup(true);
	const { fillText, fillRect } = await spied(canvas);
	const angles = () => fillText.mock.calls.filter(([text]) => text.endsWith('°'));
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointermove', quarter);
	await w.setProps({ appearance: { ...appearance, rotation: 90 } });
	expect(angles().at(-1)?.[0]).toBe(formatDegrees(90, 'en'));
	pointer(canvas, 'pointerup', quarter); fillText.mockClear();
	await w.setProps({ appearance: { ...appearance, rotation: 90, opacity: 0.5 } }); expect(angles()).toEqual([]);
	for (let index = 0; index < 20; index++) await w.get('canvas').trigger('keydown', { key: 'ArrowLeft' });
	await w.get('canvas').trigger('keydown', { key: ']' }); await w.setProps({ appearance: { ...appearance, rotation: 91 } });
	const [text, x, y] = expectDefined(angles().at(-1), 'nudge label');
	const [left, top, width] = expectDefined(fillRect.mock.calls.at(-1), 'label box');
	expect(text).toBe('91°'); expect(x).toBeGreaterThan(left); expect(y).toBeGreaterThan(top); expect(left + width).toBeLessThanOrEqual(400); expect(top + 18).toBeLessThanOrEqual(220);
	await w.get('canvas').trigger('keydown', { key: '[' }); await w.get('canvas').trigger('blur'); fillText.mockClear();
	await w.setProps({ appearance: { ...appearance, rotation: 90 } }); expect(angles()).toEqual([]);
});

it('announces the angle politely when a drag ends or a nudge lands, not on every move', async () => {
	const { w, canvas } = setup(true);
	const region = w.get('[aria-live="polite"]');
	expect(region.classes()).toContain('rp-visually-hidden'); expect(region.text()).toBe('');
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointermove', quarter); await nextTick();
	expect(region.text()).toBe('');
	pointer(canvas, 'pointerup', quarter); await nextTick();
	const dragged = expectDefined(rotations(w).at(-1), 'dragged rotation');
	expect(region.text()).toBe(tr('editor.reference.rotation-announce', { angle: formatDegrees(dragged, 'en') }));
	await w.get('canvas').trigger('keydown', { key: ']' });
	expect(region.text()).toBe(tr('editor.reference.rotation-announce', { angle: '1°' }));
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointerup', knob); await nextTick();
	expect(region.text()).toBe(tr('editor.reference.rotation-announce', { angle: '1°' }));
});

it('keeps a nudge label up briefly after the last nudge, whatever key is released, and drops it on a drag or unmount', async () => {
	vi.useFakeTimers();
	const { w, canvas } = setup(true);
	const { fillText } = await spied(canvas);
	const labelled = async () => { fillText.mockClear(); await w.setProps({ appearance: { ...appearance, opacity: Math.random() } }); return fillText.mock.calls.some(([text]) => text.endsWith('°')); };
	await w.get('canvas').trigger('keydown', { key: '[', ctrlKey: true, altKey: true });
	await w.get('canvas').trigger('keyup', { key: '8' });
	expect(await labelled()).toBe(true);
	vi.advanceTimersByTime(500); await w.get('canvas').trigger('keydown', { key: ']' });
	vi.advanceTimersByTime(500); expect(await labelled()).toBe(true);
	vi.advanceTimersByTime(300); expect(await labelled()).toBe(false);
	await w.get('canvas').trigger('keydown', { key: ']' });
	pointer(canvas, 'pointerdown', knob); pointer(canvas, 'pointerup', knob);
	expect(vi.getTimerCount()).toBe(0); expect(await labelled()).toBe(false);
	await w.get('canvas').trigger('keydown', { key: ']' }); expect(vi.getTimerCount()).toBe(1);
	w.unmount(); wrapper = undefined; expect(vi.getTimerCount()).toBe(0);
});

it('pulls the knob on-screen when the image centre is panned away, and drags it about the true centre', async () => {
	const { w, canvas } = setup(true);
	await w.setProps({ appearance: { ...appearance, rotation: 90 } });
	for (let index = 0; index < 4; index++) await w.get('canvas').trigger('keydown', { key: 'ArrowRight', shiftKey: true });
	const { arc, lineTo } = await spied(canvas);
	await w.setProps({ appearance: { ...appearance, rotation: 90, opacity: 0.5 } });
	const drawn = expectDefined(arc.mock.calls.at(-1), 'knob drawn'), off = { x: centre.x - 320, y: centre.y };
	expect(drawn[0]).toBeCloseTo(16, 6); expect(drawn[1]).toBeCloseTo(110, 6);
	pointer(canvas, 'pointerdown', { x: 16, y: 110 }); await nextTick();
	expect(w.get('canvas').classes()).toContain('is-rotating');
	expect(lineTo.mock.calls).toContainEqual([16, 220]); expect(lineTo.mock.calls).toContainEqual([400, off.y]); expect(lineTo.mock.calls).not.toContainEqual([0, 220]);
	pointer(canvas, 'pointermove', { x: 16, y: 150 });
	const turned = expectDefined(rotations(w)[0], 'dragged rotation');
	expect(turned).toBeGreaterThan(90);
	expect(turned).toBe(dragRotation(90, { x: 16 - off.x, y: 110 - off.y }, { x: 16 - off.x, y: 150 - off.y }, false));
	pointer(canvas, 'pointerup', { x: 16, y: 150 });
});
