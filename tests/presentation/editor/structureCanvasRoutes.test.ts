// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { editWall } from '../../../src/domain/spatial/structureGeometry';
import { WALL_LOOP } from '../../helpers/structure';
import { pointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await structureEditor(); mounted.push(rig); return rig; }
function key(rig: Awaited<ReturnType<typeof setup>>, value: string) { const canvas = expectDefined(rig.canvasEl, 'canvas'); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
describe('inherited canvas keyboard and drag runtime routes', () => {
	it('uses canvas Backspace and Enter for wall and opening commits through actual repositories', async () => {
		const rig = await setup(), task = rig.runtime.structureTask;
		rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'wall baseline');
		rig.runtime.toolManager.pointerDown(pointerAt(0, 0)); rig.runtime.toolManager.pointerDown(pointerAt(4000, 0));
		rig.runtime.toolManager.pointerUp(pointerAt(4000, 0)); key(rig, 'Backspace'); await settle(); expect(task.draft.points).toHaveLength(1);
		rig.runtime.toolManager.pointerDown(pointerAt(4000, 0)); rig.runtime.toolManager.pointerUp(pointerAt(4000, 0)); key(rig, 'Enter'); await settleUntil(() => rig.project.structure.walls.length === 1, 'wall saved');
		rig.runtime.setTool('place-door'); await settleUntil(() => !task.draft.loading, 'opening baseline');
		task.draft.text.hostId = rig.project.structure.walls[0].id; task.draft.text.offset = '0.2'; key(rig, 'Enter'); await settleUntil(() => rig.project.structure.openings.length === 1, 'opening saved');
		expect(rig.project.structure.openings[0].hostId).toBe(rig.project.structure.walls[0].id);
	});
	it('hands a wall-end drag to the reviewed runtime form and commits only after confirmation', async () => {
		const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
		rig.selection.select(['wall-a' as never]); await settle();
		rig.runtime.toolManager.pointerDown(pointerAt(4000, 0)); rig.runtime.toolManager.pointerMove(pointerAt(5000, 0));
		expect(rig.runtime.structureActions.preview.value?.walls[0].end.x).toBe(5000);
		rig.runtime.toolManager.pointerUp(pointerAt(5000, 0)); await settle();
		expect(rig.project.structure.walls[0].end.x).toBe(4000);
		const form = rig.wrapper.get('.rp-dialog form'); await form.trigger('submit'); await form.trigger('submit'); await settle();
		expect(rig.project.structure.walls[0].end.x).toBe(5000); expect(rig.project.structure.walls[1].start.x).toBe(5000);
	});
	it('refuses a drag form based on a stale projection and refreshes the peer geometry', async () => {
		const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure: WALL_LOOP, ledger: rig.runtime.structureTask.ledger })));
		rig.selection.select(['wall-a' as never]); await settle();
		const read = expectOk(await rig.geometry.read(rig.plan.id));
		expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: editWall(WALL_LOOP, { ...WALL_LOOP.walls[0], end: { x: 4500, y: 0 } }) }, read.version));
		await rig.runtime.structureActions.edit('wall-a', { x: 5000, y: 0 }); await settle();
		expect(rig.dialogs.current).toBeNull(); expect(rig.project.structure.walls[0].end.x).toBe(4500);
	});

 it('adds an unrelated wall while a Room note is unreadable but its boundary remains in the sidecar', async () => {
  const rig = await setup();
  const room = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Unreadable later', zoneType: 'Room', geometry: { points: WALL_LOOP.walls.map(wall => wall.start) } })).zone.entity;
  const baseline = expectOk(await rig.geometry.read(rig.plan.id));
  const structure = { ...WALL_LOOP, boundaries: [{ roomId: room.id, wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
  expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.runtime.structureTask.ledger })));
  const path = expectDefined(rig.stack.index.getPath(room.id), 'Room note'); rig.stack.vault.entries.set(path, '---\nname: 12\n---\n');
  await rig.runtime.refreshProjection(); expect(rig.project.zones.has(room.id)).toBe(false);
  const task = rig.runtime.structureTask; rig.runtime.setTool('draw-wall'); await settleUntil(() => !task.draft.loading, 'baseline');
  rig.runtime.toolManager.pointerDown(pointerAt(6000, 0)); rig.runtime.toolManager.pointerDown(pointerAt(7000, 0)); rig.runtime.toolManager.pointerUp(pointerAt(7000, 0));
  key(rig, 'Enter'); await settleUntil(() => rig.project.structure.walls.length === 5, 'unrelated wall');
  expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.boundaries).toEqual(structure.boundaries);
 });
	it('restores Area coordinate focus when Escape removes the focused row', async () => {
		const rig = await setup(); rig.runtime.setTool('draw-area'); await settle();
		rig.runtime.toolManager.pointerDown(pointerAt(0, 0)); await settle();
		const edit = rig.wrapper.get<HTMLButtonElement>('[data-rp-corner="edit"]'); edit.element.focus();
		edit.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
		expect(rig.runtime.areaCorners.points.value).toHaveLength(0); expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-corner="apply"]').element);
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle(); expect(rig.runtime.activeToolId.value).toBe('select');
	});
});
