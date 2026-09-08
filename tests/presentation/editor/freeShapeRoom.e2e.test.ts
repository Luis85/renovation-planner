// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { rig, PLAN_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { installObsidianDom } from '../../helpers/dom';
installObsidianDom();
beforeEach(() => { activateNotices(); });
type Rig = Awaited<ReturnType<typeof rig>>;
async function start(r: Rig): Promise<void> {
 await r.harness.wrapper.get('[data-rp-action="add"]').trigger('click');
 await r.harness.wrapper.get('[data-rp-entry="room"]').trigger('click');
 await r.harness.wrapper.get('[data-rp-action="free-shape-room"]').trigger('click');
 await settle();
 const details = r.harness.wrapper.get('.rp-area-corners details');
 (details.element as HTMLDetailsElement).open = true;
}
async function corner(r: Rig, x: string, y: string): Promise<void> {
 await r.harness.wrapper.get('input[name="x"]').setValue(x);
 await r.harness.wrapper.get('input[name="y"]').setValue(y);
 await r.harness.wrapper.get('[data-rp-corner="apply"]').trigger('click');
 await settle();
}
const rooms = async (r: Rig) => expectOk(await r.zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
describe('Free-shape Room through Add and the numeric outline', () => {
 it('creates a nonrectangular Room and restores its identity and outline through Undo/Redo', async () => {
  const r = await rig(); const runtime = runtimeOf(r.harness);
  try {
   await start(r);
   expect(runtime.activeToolId.value).toBe('draw-polygon');
   expect(document.activeElement).toBe(r.harness.wrapper.get('.rp-area-corners summary').element);
   expect(r.harness.wrapper.find('.rp-task-banner__repeat').exists()).toBe(false);
   for (const [x, y] of [['-1,5', '0'], ['4', '0'], ['4', '2'], ['2', '2'], ['2', '4'], ['-1.5', '4']]) await corner(r, x as string, y as string);
   expect(await rooms(r)).toHaveLength(1);
   const finish = r.harness.wrapper.get('.rp-task-banner__finish');
   (finish.element as HTMLElement).focus(); await finish.trigger('click');
   await settleUntil(() => runtime.activeToolId.value === 'select', 'free-shape Room creation');
   const created = (await rooms(r))[1]?.entity;
   if (!created) throw new Error('Expected a Room');
   expect(created.zoneType).toBe('Room'); expect(created.geometry.points).toHaveLength(6);
   expect(created.geometry.points[0]).toEqual({ x: -1500, y: 0 });
   expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual([created.id]);
   expect(document.activeElement).toBe(r.harness.canvasEl);
   await runtime.undo(); expect(await rooms(r)).toHaveLength(1);
   await runtime.redo(); expect((await rooms(r))[1]?.entity).toEqual(created);
  } finally { r.harness.unmount(); }
 });
 it('keeps a named rectangle as the initial free-shape outline and requires a name at every completion door', async () => {
  const r = await rig(); const runtime = runtimeOf(r.harness);
  try {
   await r.harness.wrapper.get('[data-rp-action="add"]').trigger('click');
   await r.harness.wrapper.get('[data-rp-entry="room"]').trigger('click');
   await r.harness.wrapper.get('.rp-new-room input[type="text"]').setValue('Dining room');
   runtime.roomDraft.setRect({ x: 20.25, y: 30.5, width: 4000, depth: 3000 });
   const rectangle = runtime.roomDraft.geometry;
   await r.harness.wrapper.get('[data-rp-action="free-shape-room"]').trigger('click'); await settle();
   expect(runtime.roomDraft.name).toBe('Dining room');
   expect(runtime.renderState.polygonSketch?.vertices).toEqual(rectangle?.points);
   await r.harness.wrapper.get('input[name="free-room-name"]').setValue('');
   runtime.toolManager.finishActiveTool(); await settle(); expect(await rooms(r)).toHaveLength(1);
   await r.harness.wrapper.get('input[name="free-room-name"]').setValue('Dining alcove');
   await r.harness.wrapper.get('.rp-task-banner__finish').trigger('click');
   await settleUntil(() => runtime.activeToolId.value === 'select', 'named free-shape Room');
   expect((await rooms(r))[1]?.entity.name).toBe('Dining alcove'); expect(runtime.roomDraft.name).toBe('');
   await start(r); runtime.setTool('draw-room'); await settle(); expect(runtime.roomDraft.name).toBe('Room 3');
  } finally { r.harness.unmount(); }
 });
 it('refuses pending corner text and a degenerate outline, and cancels without a write', async () => {
  const r = await rig(); const runtime = runtimeOf(r.harness);
  try {
   await start(r);
   for (const x of ['0', '2', '4']) await corner(r, x, '0');
   expect(runtime.canFinishArea.value).toBe(false);
   await corner(r, '4', '3'); expect(runtime.canFinishArea.value).toBe(true);
   await r.harness.wrapper.get('input[name="x"]').setValue('oops');
   expect(runtime.canFinishArea.value).toBe(false);
   await r.harness.wrapper.get('.rp-task-banner__finish').trigger('click');
   runtime.toolManager.finishActiveTool(); await settle();
   expect(await rooms(r)).toHaveLength(1);
   await r.harness.wrapper.get('.rp-task-banner__cancel').trigger('click'); await settle();
   expect(runtime.activeToolId.value).toBe('select');
   expect(runtime.renderState.polygonSketch).toBeNull(); expect(runtime.canUndo.value).toBe(false);
  } finally { r.harness.unmount(); }
 });
});
