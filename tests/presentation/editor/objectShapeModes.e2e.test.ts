// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { tr } from '../../../src/presentation/i18n/strings';
import type { Point } from '../../../src/core/geometry/Point';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function setup() {
	const rig = await structureEditor(true); mounted.push(rig);
	rig.runtime.setTool('place-object');
	await settleUntil(() => !rig.runtime.elementTask.draft.loading, 'item baseline');
	return { ...rig, task: rig.runtime.elementTask };
}
type Rig = Awaited<ReturnType<typeof setup>>;
async function drag(rig: Rig, from: Point, to: Point) {
	const tools = rig.runtime.toolManager;
	tools.pointerDown(pointerAt(from.x, from.y)); tools.pointerMove(pointerAt(to.x, to.y)); tools.pointerUp(pointerAt(to.x, to.y));
	await settle();
}
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
