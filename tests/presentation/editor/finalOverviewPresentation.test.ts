/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import { nextTick } from 'vue';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { structureEditor } from '../../helpers/structureEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { WALL_LOOP } from '../../helpers/structure';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { tr } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.documentElement.style.removeProperty('--interactive-accent');
});

it('shows actual per-Room change cues and preserves partial/stale summary behavior', async () => {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	const rooms = [];
	for (const name of ['Hall', 'Bathroom']) rooms.push(expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id,
		name, zoneType: 'Room', geometry: { points: [{ x: 6000, y: 0 }, { x: 9000, y: 0 }, { x: 9000, y: 2000 }, { x: 6000, y: 2000 }] } })).zone.entity);
	const value = { ...EMPTY_RENOVATION, subjects: [rig.room.id, rooms[0].id].map((roomId, index) => ({
		id: `finish-${index}`, roomId, targetId: roomId, kind: 'floor' as const, existing: null,
		planned: { change: 'add' as const, description: 'New room finish' } })) };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(expectOk(await rig.renovation.read(rig.plan.id)),
		{ renovation: value, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.changePlan(); rig.selection.clear(); await settle();
	const floor = rig.wrapper.get('.rp-floor-inspector');
	expect(floor.get('[data-rp-stat="planned-changes"]').text()).toBe('2');
	expect(floor.get('.rp-floor-inspector__guidance').text()).toBe(tr('editor.inspector.floor.guidance'));
	for (const id of [rig.room.id, rooms[0].id]) expect(floor.get(`[data-rp-id="${id}"] .rp-room-list__annotation`).text())
		.toBe(tr('renovation.summary.change-count', { count: '1' }));
	expect(floor.get(`[data-rp-id="${rooms[1].id}"] .rp-room-list__annotation`).text()).toBe(tr('renovation.summary.change-count', { count: '0' }));
	const bytes = [...rig.stack.vault.entries];
	rig.project.stale = true; await settle();
	expect(floor.get(`[data-rp-id="${rig.room.id}"] .rp-room-list__annotation`).text()).toBe(tr('editor.selection.unknown'));
	expect(floor.get('.rp-floor-planning-summary').text()).toContain(tr('renovation.summary.unavailable'));
	rig.project.stale = false; rig.project.unreadableZones = 1; await settle();
	expect(floor.get('[data-rp-stat="rooms"]').classes()).toContain('rp-floor-inspector__stat--partial');
	expect(floor.get(`[data-rp-id="${rooms[0].id}"] .rp-room-list__annotation`).text()).toBe(tr('editor.selection.unknown'));
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.project.unreadableZones = 0;
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !rig.runtime.structureTask.draft.loading, 'wall baseline');
	expect(rig.wrapper.find('.rp-floor-inspector__guidance').exists()).toBe(false);
	rig.runtime.returnToSelect(); await settle();
	expect(rig.wrapper.find('.rp-floor-inspector__guidance').exists()).toBe(true);
});

it('keeps the closed wall draft visibly distinct, screen-sized and uncommitted until Finish', async () => {
	document.documentElement.style.setProperty('--interactive-accent', 'rgb(41, 84, 220)');
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const task = rig.runtime.structureTask, stage = expectDefined(rig.stage, 'stage');
	expect(rig.wrapper.find('.rp-floor-inspector__guidance').exists()).toBe(false);
	expect(rig.wrapper.get('.rp-floor-setup').text()).toContain(tr('editor.creation.nothing-added'));
	const bytes = [...rig.stack.vault.entries];
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	expect(rig.wrapper.find('.rp-floor-inspector__guidance').exists()).toBe(false);
	expect(task.addNumeric()).toBe(true);
	for (const [length, angle] of [['4', '0'], ['3', '90'], ['4', '180']]) {
		task.draft.text.length = length; task.draft.text.angle = angle; expect(task.addNumeric()).toBe(true);
	}
	task.closeLoop(); await settle();
	const outline = expectDefined(stage.findOne<Konva.Line>('.wall-draft-outline'), 'draft outline');
	const architecture = expectDefined(stage.findOne<Konva.Layer>('.architecture'), 'architecture layer');
	const wall = expectDefined(architecture.find<Konva.Line>('Line').find(node => node !== outline), 'wall body');
	expect(outline.stroke()).not.toBe(wall.stroke());
	expect(outline.points()).toEqual(task.draft.points.flatMap(point => [point.x, point.y]));
	expect(stage.find('.wall-draft-corner')).toHaveLength(4);
	const editor = useEditorStore(rig.pinia);
	editor.viewport = { pan: { x: -100, y: -400 }, zoom: 0.1 }; await settle();
	for (const label of stage.find<Konva.Text>('.wall-draft-length')) {
		const box = expectDefined(label.getParent(), 'caption group').getClientRect();
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(editor.stageSize.width);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(editor.stageSize.height);
	}
	editor.viewport = { ...editor.viewport, zoom: editor.viewport.zoom * 2 }; await settle();
	expect(outline.strokeWidth() * editor.viewport.zoom).toBeCloseTo(2);
	for (const corner of stage.find<Konva.Rect>('.wall-draft-corner')) expect(corner.width() * corner.getAbsoluteScale().x).toBeCloseTo(10);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.runtime.returnToSelect(); await settle();
	expect(stage.find('.wall-draft-outline')).toHaveLength(0); expect(stage.find('.wall-draft-corner')).toHaveLength(0);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('names the wall a chain would join, and where, in the form status line', async () => {
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	await settle();
	const task = rig.runtime.structureTask;
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	const tools = rig.runtime.toolManager;
	tools.pointerDown(pointerAt(2000, 1500)); await settle();
	tools.pointerMove(pointerAt(2003, 4)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.joins-perpendicular', { n: '1', m: '2' }));
	tools.pointerMove(pointerAt(1200, 4)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.joins', { n: '1', m: '1.2' }));
	tools.pointerMove(pointerAt(1200, 800)); await settle();
	expect(rig.wrapper.get('.rp-structure-task').text()).toContain(tr('editor.structure.unsnapped'));
});

it('marks each cut a wall chain would make and previews the host already cut', async () => {
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	await settle();
	const task = rig.runtime.structureTask, stage = expectDefined(rig.stage, 'stage');
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	const tools = rig.runtime.toolManager;
	expect(stage.find('.wall-draft-cut')).toHaveLength(0);
	expect(stage.find('.wall-body')).toHaveLength(1); // WALL_LOOP is one closed run.
	// Hovering a body: one pending mark, across the wall (vertical on the horizontal wall-a), thickness + 16 px long.
	tools.pointerMove(pointerAt(1000, 3)); await settle();
	const editor = useEditorStore(rig.pinia), zoom = editor.viewport.zoom;
	const pending = stage.find<Konva.Line>('.wall-draft-cut');
	expect(pending).toHaveLength(1);
	const [x1, y1, x2, y2] = pending[0].points();
	expect(x1).toBeCloseTo(1000); expect(x2).toBeCloseTo(1000);
	expect(Math.abs(y2 - y1)).toBeCloseTo(150 + 16 / zoom);
	// Clicking there starts the chain: the start mark stays while the cursor leaves the wall.
	tools.pointerDown(pointerAt(1000, 3)); tools.pointerMove(pointerAt(1000, 1500)); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(1);
	// Placing a free point then hovering wall-c: start mark + pending mark, and the preview's wall-a is two halves.
	tools.pointerDown(pointerAt(1000, 1500)); tools.pointerMove(pointerAt(1000, 2996)); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(2);
	// Three walls now meet at (1000, 0) — the two halves and the draft — so `wallPasses` no longer chains the loop into one run: the host is drawn cut.
	expect(stage.find('.wall-body').length).toBeGreaterThan(1);
	rig.runtime.returnToSelect(); await settle();
	expect(stage.find('.wall-draft-cut')).toHaveLength(0);
});

it('marks an end cut on a half the start cut made, a wall only the drawn floor holds', async () => {
	const rig = await structureEditor(); cleanups.push(rig.unmount);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
	await settle();
	const task = rig.runtime.structureTask, stage = expectDefined(rig.stage, 'stage'), tools = rig.runtime.toolManager;
	rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
	// A U from wall-a at 1 m back onto wall-a at 2.5 m: the end lands on the half the start cut made, whose id no committed wall has.
	for (const [x, y] of [[1000, 3], [1000, 1500], [2500, 1500], [2500, 3]]) tools.pointerDown(pointerAt(x, y));
	const end = expectDefined(task.draft.joins.end, 'end join');
	expect(WALL_LOOP.walls.some(wall => wall.id === end.wallId)).toBe(false);
	await nextTick(); // The render queued by the click, ahead of the save that click also started.
	expect(stage.find<Konva.Line>('.wall-draft-cut').map(line => line.points()[0])).toEqual([1000, 2500]);
	await settleUntil(() => rig.runtime.activeToolId.value === 'select', 'chain saved');
});
