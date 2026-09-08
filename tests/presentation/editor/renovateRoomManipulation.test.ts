// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 await rig.runtime.renovation.perspective('renovate'); await settle(); return rig;
}
it('edits a Room corner in Renovate through one reversible geometry command', async () => {
 const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
 const points = expectDefined(rig.project.zones.get(rig.room.id), 'Room').points;
 // Excludes the rotation handle's own circle, which a selected room also draws here.
 expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle').filter(node => node.getParent()?.name() !== 'object-rotation-handle')).toHaveLength(points.length);
 const tool = rig.runtime.toolManager;
 tool.pointerDown(pointerAt(points[0].x, points[0].y)); tool.pointerMove(pointerAt(-200, -200)); await settle();
 expect(rig.runtime.renderState.previewPolygon?.[0]).toEqual({ x: -200, y: -200 });
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 tool.pointerUp(pointerAt(-200, -200));
 await settleUntil(() => rig.project.zones.get(rig.room.id)?.points[0].x === -200, 'Renovate Room corner saved');
 const saved = expectOk(await rig.geometry.read(rig.plan.id));
 expect(saved.document.structure).toEqual(before.document.structure);
 expect(saved.document.intended).toEqual(before.document.intended);
 expect(rig.selection.selectedIds).toEqual([rig.room.id]);
 expect(rig.session.perspective).toBe('renovate');
 await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 await rig.runtime.redo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(saved.document);
});
it('keeps Renovate primary Add keyboard reachable and closes it without clearing selection', async () => {
 const rig = await setup(), add = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="add"]');
 add.element.focus(); await add.trigger('click'); await settle();
 expect(rig.wrapper.find('[role="menu"]').exists()).toBe(true);
 await rig.wrapper.get('.rp-add-menu input[type="search"]').trigger('keydown', { key: 'Escape' }); await settle();
 expect(rig.wrapper.find('[role="menu"]').exists()).toBe(false);
 expect(document.activeElement).toBe(add.element); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
 await rig.runtime.renovation.perspective('review'); await settle();
 expect(rig.wrapper.find('[data-rp-action="add"]').exists()).toBe(false);
 expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle')).toHaveLength(0);
});
it('refuses Room drag previews while stale and after switching to Review', async () => {
 const rig = await setup(), bytes = [...rig.stack.vault.entries], tool = rig.runtime.toolManager;
 rig.project.stale = true;
 tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(-200, -200)); tool.pointerUp(pointerAt(-200, -200)); await settle();
 expect(rig.runtime.renderState.previewPolygon).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
 rig.project.stale = false; await rig.runtime.renovation.perspective('review'); await settle();
 tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(-200, -200)); tool.pointerUp(pointerAt(-200, -200)); await settle();
 expect(rig.runtime.renderState.previewPolygon).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('reviews a Renovate wall endpoint proposal before changing current geometry and preserves Room and intended state', async () => {
 const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
 const roomPoints = expectDefined(rig.project.zones.get(rig.room.id), 'Room').points;
 rig.selection.select(['wall-a' as never]); await settle();
 expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(2);
 const tool = rig.runtime.toolManager;
 tool.pointerDown(pointerAt(4000, 0)); tool.pointerMove(pointerAt(5000, 0));
 expect(rig.runtime.structureActions.preview.value?.walls[0].end.x).toBe(5000);
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 tool.pointerUp(pointerAt(5000, 0)); await settle();
 expect(rig.wrapper.get<HTMLInputElement>('.rp-dialog input[name="length"]').element.value).toBe('5');
 await rig.wrapper.get('.rp-dialog form').trigger('submit'); await settle();
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 await rig.wrapper.get('.rp-dialog form').trigger('submit');
 await settleUntil(() => rig.project.structure.walls[0].end.x === 5000, 'reviewed wall saved');
 expect(rig.project.structure.walls[1].start.x).toBe(5000);
 expect(rig.project.zones.get(rig.room.id)?.points).toEqual(roomPoints); expect(rig.project.intended).toEqual(before.document.intended);
 await rig.runtime.undo(); await settle(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 rig.project.stale = true; tool.pointerDown(pointerAt(4000, 0)); tool.pointerMove(pointerAt(5000, 0)); tool.pointerUp(pointerAt(5000, 0)); await settle();
 expect(rig.runtime.structureActions.preview.value).toBeNull(); expect(rig.dialogs.current).toBeNull();
 rig.project.stale = false; await rig.runtime.renovation.perspective('review'); await settle();
 expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(0);
 tool.pointerDown(pointerAt(4000, 0)); tool.pointerMove(pointerAt(5000, 0)); tool.pointerUp(pointerAt(5000, 0)); await settle();
 expect(rig.dialogs.current).toBeNull(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
});
