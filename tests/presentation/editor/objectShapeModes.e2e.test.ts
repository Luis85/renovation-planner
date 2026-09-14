// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { tr } from '../../../src/presentation/i18n/strings';
import { spatialError } from '../../../src/domain/spatial/structureGeometry';
import type { Point } from '../../../src/core/geometry/Point';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup(tool: 'place-object' | 'draw-hatch' = 'place-object') {
	const rig = await structureEditor(true); mounted.push(rig);
	rig.runtime.setTool(tool);
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'item baseline');
	return { ...rig, task: rig.runtime.elementTask };
}
type Rig = Awaited<ReturnType<typeof setup>>;
async function drag(rig: Rig, from: Point, to: Point) {
	const tools = rig.runtime.toolManager;
	tools.pointerDown(pointerAt(from.x, from.y)); tools.pointerMove(pointerAt(to.x, to.y)); tools.pointerUp(pointerAt(to.x, to.y));
	await settle();
}
function key(rig: Rig, value: string) { const canvas = expectDefined(rig.canvasEl, 'canvas'); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
const RECTANGLE = [{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2000 }, { x: 1000, y: 2000 }];

it('starts an item as a rectangle drag and saves the dragged outline', async () => {
	const rig = await setup(), banner = rig.wrapper.get('.rp-task-banner');
	expect(banner.text()).toContain(tr('editor.element.banner.object-rectangle'));
	expect(rig.wrapper.get('.rp-element-task > p').text()).toBe(tr('editor.element.banner.object-rectangle'));
	expect(banner.get('[data-rp-object-shape="rectangle"]').attributes('aria-pressed')).toBe('true');
	expect(rig.wrapper.get<HTMLDetailsElement>('.rp-object-rectangle').element.open).toBe(true);
	expect(rig.wrapper.find('input[name="element-x"]').exists()).toBe(false);
	await drag(rig, { x: 3000, y: 2000 }, { x: 1000, y: 500 });
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	await banner.get('.rp-task-banner__finish').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved item');
	expect(expectDefined(rig.project.structure.elements?.[0], 'saved item')).toMatchObject({ kind: 'object', points: RECTANGLE });
});

it('draws a hatched area as one rectangle drag, the way a room is drawn, and saves the dragged outline', async () => {
	const rig = await setup('draw-hatch'), banner = rig.wrapper.get('.rp-task-banner');
	expect(banner.text()).toContain(tr('editor.drafting.banner.hatch-rectangle'));
	expect(banner.get('[data-rp-object-shape="rectangle"]').attributes('aria-pressed')).toBe('true');
	expect(rig.wrapper.get<HTMLDetailsElement>('.rp-object-rectangle').element.open).toBe(true);
	await drag(rig, { x: 3000, y: 2000 }, { x: 1000, y: 500 });
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	await banner.get('.rp-task-banner__finish').trigger('click');
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'saved hatch');
	expect(expectDefined(rig.project.structure.elements?.[0], 'saved hatch')).toMatchObject({ kind: 'hatch', points: RECTANGLE });
});

it('carries the outline across both switches, from the task bar and from details', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	await rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]').trigger('click');
	expect(rig.task.draft.shape).toBe('free');
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	expect(rig.wrapper.get('.rp-task-banner').text()).toContain(tr('editor.element.banner.object'));
	expect(rig.wrapper.get('.rp-element-task > p').text()).toBe(tr('editor.element.create-hint'));
	expect(rig.wrapper.find('input[name="element-x"]').exists()).toBe(true);
	expect(rig.wrapper.get<HTMLDetailsElement>('.rp-object-rectangle').element.open).toBe(false);
	expect(rig.wrapper.get('.rp-task-banner [data-rp-object-shape="rectangle"]').attributes('aria-pressed')).toBe('false');
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 2600)); await settle();
	expect(rig.task.draft.points).toHaveLength(5);
	await rig.wrapper.get('.rp-element-task [data-rp-object-shape="rectangle"]').trigger('click');
	expect(rig.task.draft.points).toEqual([{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2600 }, { x: 1000, y: 2600 }]);
	expect(rig.wrapper.get('.rp-element-task > p').text()).toBe(tr('editor.element.banner.object-rectangle'));
	expect(rig.wrapper.get<HTMLDetailsElement>('.rp-object-rectangle').element.open).toBe(true);
	expect(rig.wrapper.get('.rp-element-task [data-rp-object-shape="free"]').attributes('aria-pressed')).toBe('false');
});

it('shows the drawn rectangle as its position and size until typed over, and again after Discard', async () => {
	const rig = await setup(), summary = () => rig.wrapper.get('.rp-object-rectangle summary').text();
	const shown = () => (['x', 'y', 'width', 'depth'] as const).map(field => rig.wrapper.get<HTMLInputElement>(`input[name="object-${field}"]`).element.value);
	const action = (name: string) => rig.wrapper.get(`[data-rp-action="${name}-object-rectangle"]`).trigger('click').then(settle);
	expect(summary()).toBe(tr('editor.object.rectangle-mode'));
	expect(shown()).toEqual(['0', '0', '', '']);
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	expect(shown()).toEqual(['1', '0.5', '2', '1.5']);
	await rig.wrapper.get('input[name="object-width"]').setValue('2.5');
	expect(rig.task.draft.pendingInput).toBe(true); expect(shown()).toEqual(['1', '0.5', '2.5', '1.5']);
	await action('discard');
	expect(rig.task.draft.pendingInput).toBe(false); expect(shown()).toEqual(['1', '0.5', '2', '1.5']);
	await action('apply');
	expect(rig.task.draft.points).toEqual(RECTANGLE); expect(rig.wrapper.findAll('.rp-object-rectangle [aria-invalid="true"]')).toHaveLength(0);
	await rig.wrapper.get('input[name="object-width"]').setValue('2.5'); await action('apply');
	expect(rig.task.draft.points).toEqual([{ x: 1000, y: 500 }, { x: 3500, y: 500 }, { x: 3500, y: 2000 }, { x: 1000, y: 2000 }]);
	expect(rig.task.draft.pendingInput).toBe(false); expect(shown()).toEqual(['1', '0.5', '2.5', '1.5']);
	await rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]').trigger('click');
	expect(summary()).toBe(tr('editor.object.rectangle'));
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 2600)); await settle();
	expect(shown()).toEqual(['1', '0.5', '2.5', '2.1']);
});

it('leaves a free-form outline unboxed when Apply is pressed with nothing typed', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	await rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]').trigger('click');
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 2600)); await settle();
	const pentagon = rig.task.draft.points.map(point => ({ ...point }));
	expect(pentagon).toHaveLength(5);
	await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click'); await settle();
	expect(rig.task.draft.points).toEqual(pentagon);
});

it('names the missing size and focuses Width when Apply is pressed on an empty item draft', async () => {
	const rig = await setup();
	const width = () => rig.wrapper.get<HTMLInputElement>('input[name="object-width"]');
	const depth = () => rig.wrapper.get<HTMLInputElement>('input[name="object-depth"]');
	await rig.wrapper.get('[data-rp-action="apply-object-rectangle"]').trigger('click'); await settle();
	expect(rig.task.draft.points).toEqual([]);
	expect(width().attributes('aria-invalid')).toBe('true');
	expect(depth().attributes('aria-invalid')).toBe('true');
	expect(document.activeElement).toBe(width().element);
});

it('shows the same refusal for an untouched Enter in an empty item draft', async () => {
	const rig = await setup();
	await rig.wrapper.get('input[name="object-x"]').trigger('keydown', { key: 'Enter' }); await settle();
	expect(rig.task.draft.points).toEqual([]);
	expect(rig.wrapper.get('input[name="object-width"]').attributes('aria-invalid')).toBe('true');
});

it('clears the whole outline on canvas Backspace in rectangle mode, and elementTask.undoPoint() does the same', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	// The whole-outline clear routes through `setPoints`, which also clears a stale `draft.error`
	// (PR #182 review round 1, folded minor) — seeded here with the same value `finish()`'s own
	// validation refusal sets, without going through the write path.
	rig.task.draft.error = spatialError('element-invalid');
	key(rig, 'Backspace'); await settle();
	expect(rig.task.draft.points).toEqual([]);
	expect(rig.task.draft.error).toBeNull();
	expect(rig.runtime.toolManager.activeToolHasDraft()).toBe(false);

	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	// The "Undo point" button is hidden in rectangle mode (`ElementTaskForm.vue`'s `pointEntry`),
	// but `undoPoint()` itself carries the same whole-outline rule the canvas key reaches.
	rig.task.undoPoint();
	expect(rig.task.draft.points).toEqual([]);
});

it('still steps back one corner on canvas Backspace in free mode', async () => {
	const rig = await setup();
	await rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]').trigger('click');
	for (const point of [{ x: 1000, y: 500 }, { x: 3000, y: 500 }, { x: 3000, y: 2000 }]) { rig.runtime.toolManager.pointerDown(pointerAt(point.x, point.y)); rig.runtime.toolManager.pointerUp(pointerAt(point.x, point.y)); }
	await settle();
	expect(rig.task.draft.points).toHaveLength(3);
	// A free-form item's Backspace also routes through `setPoints` (`ElementTool.editCorner`'s -1/null
	// branch is keyed on the tool id, not the shape), so it clears a stale `draft.error` too — same as
	// rectangle mode's whole-outline clear above (PR #182 review round 1, folded minor).
	rig.task.draft.error = spatialError('element-invalid');
	key(rig, 'Backspace'); await settle();
	expect(rig.task.draft.points).toHaveLength(2);
	expect(rig.task.draft.error).toBeNull();
});

it('keeps its mode while typed rectangle input is pending, and a click leaves the drawn rectangle', async () => {
	const rig = await setup();
	await drag(rig, { x: 1000, y: 500 }, { x: 3000, y: 2000 });
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 1000)); rig.runtime.toolManager.pointerUp(pointerAt(2000, 1000)); await settle();
	expect(rig.task.draft.points).toEqual(RECTANGLE);
	await rig.wrapper.get('input[name="object-width"]').setValue('1');
	const free = () => rig.wrapper.get('.rp-task-banner [data-rp-object-shape="free"]');
	expect(free().attributes('aria-disabled')).toBe('true');
	await free().trigger('click');
	expect(rig.task.draft.shape).toBe('rectangle');
	await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click'); await settle();
	expect(free().attributes('aria-disabled')).toBe('false');
});
