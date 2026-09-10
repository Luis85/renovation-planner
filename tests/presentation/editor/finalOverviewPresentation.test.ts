/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { structureEditor } from '../../helpers/structureEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
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
