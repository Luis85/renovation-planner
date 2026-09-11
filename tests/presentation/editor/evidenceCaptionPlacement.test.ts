/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { EMPTY_DEPTH, type Evidence } from '../../../src/domain/renovation/PlanningDepth';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

async function withPins(distant = false) {
	const rig = await renovationEditor(true); mounted.push(rig);
	const base = { roomId: rig.room.id, targetId: rig.room.id, workId: '', recordId: '', path: 'scan.png', subpath: '', type: 'photo' as const, phase: 'before' as const };
	const evidence: Evidence[] = [
		{ ...base, id: 'center-photo', description: 'Center survey', pin: distant ? { x: 0.05, y: 0.05 } : { x: 0.5, y: 0.5 } },
		{ ...base, id: 'unplaced-photo', description: 'Unplaced survey', pin: null },
		{ ...base, id: 'upper-photo', description: 'Upper survey', pin: { x: 0.5, y: distant ? 0.95 : 0.4 } },
	];
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, { renovation: { subjects: [], work: [], decisions: [], depth: { ...EMPTY_DEPTH, evidence } }, intended: undefined }, rig.runtime.structureTask.ledger)));
	rig.runtime.renovation.focus(rig.room.id, 'photos'); await settle();
	const stage = expectDefined(rig.stage, 'native canvas');
	const group = expectDefined(stage.findOne<Konva.Group>('.zone')?.findOne<Konva.Group>('.' + rig.room.id), 'Room render group');
	return { ...rig, stage, group, evidence };
}

function expectClearCaptions(group: Konva.Group, stage: Konva.Stage): void {
	const captions = group.find<Konva.Text>('Text');
	expect(captions).toHaveLength(2);
	for (const caption of captions) {
		const text = caption.getClientRect();
		for (const pin of stage.find<Konva.Group>('.evidence-pin')) {
			const target = expectDefined(pin.findOne<Konva.Shape>('.evidence-pin-target'), 'pin hit target').getClientRect();
			expect(text.x + text.width <= target.x || target.x + target.width <= text.x || text.y + text.height <= target.y || target.y + target.height <= text.y).toBe(true);
		}
	}
}

it('keeps every Room caption clear of centered photos through pan and zoom without moving pins or geometry', async () => {
	const rig = await withPins(), editor = useEditorStore(rig.pinia);
	const pins = rig.stage.find<Konva.Group>('.evidence-pin'), positions = pins.map(pin => pin.position());
	const lines = rig.group.find<Konva.Line>('Line'), points = lines.map(line => line.points());
	const bytes = [...rig.stack.vault.entries], geometry = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(pins.map(pin => pin.findOne<Konva.Text>('Text')?.text())).toEqual(['1', '3']);
	expect(positions).toEqual([{ x: 2000, y: 1500 }, { x: 2000, y: 1200 }]);
	expectClearCaptions(rig.group, rig.stage);
	const camera = { ...editor.viewport }; editor.panByScreen(31, -17); await settle();
	expect(editor.viewport).not.toEqual(camera); expectClearCaptions(rig.group, rig.stage);
	rig.stage.container().dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true })); await settle();
	expect(editor.viewport.zoom).not.toBe(camera.zoom); expectClearCaptions(rig.group, rig.stage);
	expect(rig.stage.find<Konva.Group>('.evidence-pin')).toEqual(pins);
	expect(pins.map(pin => pin.position())).toEqual(positions);
	for (const [index, line] of lines.entries()) expect(line.points()).toBe(points[index]);
	pins[0].fire('click'); await settle(); expect(rig.session.focusedId).toBe('center-photo');
	expect(pins[0].position()).toEqual(positions[0]);
	pins[1].fire('tap'); await settle(); expect(rig.session.focusedId).toBe('upper-photo');
	expect(pins[1].position()).toEqual(positions[1]);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(geometry);
});

it('restores centered captions when pins are filtered, hidden or outside the evidence perspective', async () => {
	const rig = await withPins(), workspace = useWorkspaceStore(rig.pinia);
	const caption = expectDefined(rig.group.findOne<Konva.Text>('Text'), 'Room caption');
	const displaced = caption.y();
	rig.session.evidencePhase = 'after'; await settle();
	expect(rig.stage.find('.evidence-pin')).toHaveLength(0); expect(caption.y()).toBe(1500);
	rig.session.evidencePhase = ''; await settle(); expect(caption.y()).toBe(displaced);
	rig.session.visible = false; await settle(); expect(caption.y()).toBe(1500);
	rig.session.visible = true; await settle(); expect(caption.y()).toBe(displaced);
	workspace.toggleLayer('annotation'); await settle(); expect(caption.y()).toBe(1500);
	workspace.toggleLayer('annotation'); await settle(); expect(caption.y()).toBe(displaced);
	await rig.runtime.renovation.perspective('plan'); await settle(); expect(caption.y()).toBe(1500);
});

it('keeps the caption centered when visible photo pins do not intersect its text', async () => {
	const rig = await withPins(true);
	expect(expectDefined(rig.group.findOne<Konva.Text>('Text'), 'Room caption').y()).toBe(1500);
	expectClearCaptions(rig.group, rig.stage);
});

it('keeps a new Room centered when opening Documents before any evidence has been recorded', async () => {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.runtime.renovation.focus(rig.room.id, 'documents'); await settle();
	expect(rig.stage.find('.evidence-pin')).toHaveLength(0);
	const label = expectDefined(rig.stage.findOne<Konva.Layer>('.zone')?.findOne<Konva.Text>('Text'), 'Room caption');
	expect(label.y()).toBe(1500);
});
