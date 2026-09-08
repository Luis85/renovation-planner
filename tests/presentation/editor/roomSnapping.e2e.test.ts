// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rig, pointer, PLAN_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
async function start(h: Awaited<ReturnType<typeof rig>>['harness']): Promise<void> {
 await h.wrapper.get('[data-rp-action="add"]').trigger('click'); await h.wrapper.get('[data-rp-entry="room"]').trigger('click');
}
describe('M03 snapping in the production editor', () => {
 it('uses the native View preference for the same Room preview and commit coordinates', async () => {
  const r = await rig(), h = r.harness, runtime = runtimeOf(h);
  try {
   await h.wrapper.get('[data-rp-view="snap"]').setValue(false);
   await start(h);
   pointer(h.canvasEl as HTMLElement, 'pointerdown', 201, 201);
   pointer(h.canvasEl as HTMLElement, 'pointerup', 485, 385); await settle();
   expect(runtime.roomDraft.rect).toEqual({ x: 1530, y: 1530, width: 2840, depth: 1840 });
   expect(h.stage?.find('.snap-target')).toHaveLength(0);
   await h.wrapper.get('.rp-new-room__create').trigger('click');
   await settleUntil(() => runtime.activeToolId.value === 'select', 'unsnapped Room creation');
   const created = expectDefined(expectOk(await r.zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded[1], 'new Room').entity;
   expect(created.geometry.points[0]).toEqual({ x: 1530, y: 1530 });
   await runtime.undo(); expect(expectOk(await r.zonesRepo.getById(created.id))).toBeNull();
  } finally { h.unmount(); }
 });
 it('draws a guide and announces a snap, then creates and restores the snapped outline through history', async () => {
  const r = await rig(), h = r.harness, runtime = runtimeOf(h);
  try {
   await start(h);
   pointer(h.canvasEl as HTMLElement, 'pointerdown', 201, 201);
   pointer(h.canvasEl as HTMLElement, 'pointermove', 485, 385); await settle();
   expect(runtime.roomDraft.rect).toEqual({ x: 1500, y: 1500, width: 2900, depth: 1900 });
   expect(h.stage?.find('.snap-target')).toHaveLength(1);
   expect(h.wrapper.get('.rp-task-banner').text()).toContain('Snapped to nearby geometry');
   pointer(h.canvasEl as HTMLElement, 'pointerup', 485, 385); await settle();
   await h.wrapper.get('.rp-new-room__create').trigger('click');
   await settleUntil(() => runtime.activeToolId.value === 'select', 'snapped Room creation');
   const created = expectDefined(expectOk(await r.zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded[1], 'new Room').entity;
   expect(created.geometry.points).toEqual([{ x: 1500, y: 1500 }, { x: 4400, y: 1500 }, { x: 4400, y: 3400 }, { x: 1500, y: 3400 }]);
   expect(h.stage?.find('.snap-target')).toHaveLength(0);
   await runtime.undo(); expect(expectOk(await r.zonesRepo.getById(created.id))).toBeNull();
   await runtime.redo(); expect(expectOk(await r.zonesRepo.getById(created.id))?.entity.geometry).toEqual(created.geometry);
  } finally { h.unmount(); }
 });
 it('retires the guide when an exact numeric dimension replaces the snapped preview', async () => {
  const r = await rig(), h = r.harness, runtime = runtimeOf(h);
  try {
   await start(h); pointer(h.canvasEl as HTMLElement, 'pointerdown', 201, 201); pointer(h.canvasEl as HTMLElement, 'pointerup', 485, 385); await settle();
   expect(h.stage?.find('.snap-target')).toHaveLength(1);
   const width = h.wrapper.get('input[name="width"]'); await width.setValue('4,5'); await width.trigger('keydown', { key: 'Enter' }); await settle();
   expect(runtime.roomDraft.rect?.width).toBe(4500); expect(h.stage?.find('.snap-target')).toHaveLength(0);
   expect(h.wrapper.get('.rp-task-banner').text()).not.toContain('Snapped to nearby geometry');
   await h.wrapper.get('.rp-task-banner__cancel').trigger('click'); await settle(); expect(runtime.canUndo.value).toBe(false);
  } finally { h.unmount(); }
 });
});
