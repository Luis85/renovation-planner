// @vitest-environment jsdom
import type Konva from 'konva';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined } from '../../helpers/domain';
import type { Point } from '../../../src/core/geometry/Point';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';

const ACCENT = 'rgb(41, 84, 220)', LINE = 'rgb(1, 1, 1)';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
// jsdom defines no Obsidian CSS variable, so the accent and the plain line colour would both fall back to the same colour.
beforeEach(() => { document.documentElement.style.setProperty('--interactive-accent', ACCENT); document.documentElement.style.setProperty('--text-normal', LINE); });
afterEach(() => {
	for (const rig of mounted.splice(0)) rig.unmount();
	document.documentElement.style.removeProperty('--interactive-accent'); document.documentElement.style.removeProperty('--text-normal');
});
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function rightClick(rig: Rig, world: Point, altKey = false) {
	const at = worldToScreen(world, useEditorStore(rig.pinia).viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, altKey, clientX: box.left + at.x, clientY: box.top + at.y }));
	await settle();
}
const item = (rig: Rig, id: string) => rig.wrapper.get(`[data-rp-context-action="${id}"]`);
const menuIds = (rig: Rig) => rig.wrapper.findAll('[data-rp-context-action]').map(entry => entry.attributes('data-rp-context-action'));

it('adds a window and a door where a wall was right-clicked, each one undoable', async () => {
	const rig = await setup();
	await rightClick(rig, { x: 1000, y: 0 });
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect(menuIds(rig).slice(0, 5)).toEqual(['new-wall', 'add-door', 'add-window', 'add-opening', 'measure']);
	await item(rig, 'add-window').trigger('click');
	await settleUntil(() => rig.project.structure.openings.length === 1 && rig.runtime.activeToolId.value === 'select', 'window placed');
	const pane = rig.project.structure.openings[0];
	expect(pane).toMatchObject({ kind: 'window', hostId: 'wall-a', offset: 550, width: 900 });
	expect(rig.selection.selectedIds).toEqual([pane.id]);
	await rightClick(rig, { x: 3000, y: 0 }); await item(rig, 'add-door').trigger('click');
	await settleUntil(() => rig.project.structure.openings.length === 2 && rig.runtime.activeToolId.value === 'select', 'door placed');
	expect(rig.project.structure.openings[1]).toMatchObject({ kind: 'door', hostId: 'wall-a', offset: 2550 });
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.openings).toEqual([pane]);
	// A wall deleted between the menu opening and the click places nothing — never on some other wall.
	await rig.runtime.structureTask.placeAt('place-door', 'wall-gone', { x: 1000, y: 0 }); await settle();
	expect(rig.runtime.activeToolId.value).toBe('place-door'); expect(rig.project.structure.openings).toEqual([pane]);
});

it('draws a new wall from the right-clicked point and cuts the wall only when it is saved', async () => {
	const rig = await setup(), task = rig.runtime.structureTask;
	await rightClick(rig, { x: 2000, y: 0 }); await item(rig, 'new-wall').trigger('click');
	await settleUntil(() => task.draft.points.length === 1, 'wall started at the click');
	expect(rig.runtime.activeToolId.value).toBe('draw-wall');
	expect(task.draft.points[0].x).toBeCloseTo(2000, 0); expect(task.draft.points[0].y).toBe(0);
	expect(rig.project.structure.walls).toHaveLength(4);
	task.draft.text.length = '1.5'; task.draft.text.angle = '90'; expect(task.addNumeric()).toBe(true);
	await task.finish(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'connected wall saved');
	const walls = rig.project.structure.walls, cut = walls[0].end;
	expect(walls).toHaveLength(6); expect(cut.x).toBeCloseTo(2000, 0); expect(walls[1].start).toEqual(cut); expect(walls[5].start).toEqual(cut);
	await rig.runtime.undo(); await settle();
	expect(rig.project.structure.walls).toHaveLength(4); expect(rig.project.structure.walls[0].end).toEqual({ x: 4000, y: 0 });
});

it('greys New wall where the click lands inside an opening, and says why', async () => {
	const rig = await setup();
	await rightClick(rig, { x: 1000, y: 0 }); await item(rig, 'add-opening').trigger('click');
	await settleUntil(() => rig.project.structure.openings.length === 1 && rig.runtime.activeToolId.value === 'select', 'opening placed');
	// The opening is selected and sits over the wall there; Alt cycles past it to the wall beneath.
	await rightClick(rig, { x: 1000, y: 0 }, true);
	expect(rig.selection.selectedIds).toEqual(['wall-a']);
	expect(item(rig, 'new-wall').attributes('aria-disabled')).toBe('true');
	expect(item(rig, 'new-wall').attributes('title')).toBe('A new wall cannot start inside a door, window or opening. Choose a point beside it.');
});

it('measures from a right-clicked point and draws the measurement as a ruler', async () => {
	const rig = await setup(), task = rig.runtime.elementTask;
	await rightClick(rig, { x: 6000, y: 1000 });
	expect(rig.selection.selectedIds).toEqual([]);
	await item(rig, 'measure').trigger('click');
	await settleUntil(() => task.draft.points.length === 1, 'measurement started at the click');
	expect(rig.runtime.activeToolId.value).toBe('measure');
	expect(task.draft.points[0].x).toBeCloseTo(6000, 0); expect(task.draft.points[0].y).toBeCloseTo(1000, 0);
	expect(task.addPoint({ x: 8000, y: 1000 })).toBe(true); await settle();
	const layer = expectDefined(rig.stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	const marks = () => expectDefined(layer.findOne<Konva.Shape>('.element-measurement-marks'), 'ruler marks');
	const zoom = useEditorStore(rig.pinia).viewport.zoom;
	expect(marks().getAttr('marks').endBars).toHaveLength(2); expect(marks().scaleX()).toBeCloseTo(1 / zoom);
	// The bars and ticks follow the spine's colour: accent while drawing or selected, the plain line colour otherwise.
	const spine = () => expectDefined(marks().getParent()?.findOne<Konva.Line>('Line'), 'ruler spine');
	expect(marks().stroke()).toBe(ACCENT); expect(spine().stroke()).toBe(ACCENT); expect(spine().strokeWidth()).toBeCloseTo(2 / zoom);
	await task.finish(); await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'measurement saved');
	expect(marks().stroke()).toBe(ACCENT); expect(spine().strokeWidth()).toBeCloseTo(2 / zoom);
	rig.selection.clear(); await settle();
	expect(marks().stroke()).toBe(LINE); expect(spine().stroke()).toBe(LINE);
});
