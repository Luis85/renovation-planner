// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import type Konva from 'konva';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
 const rig = await renovationEditor(true); mounted.push(rig);
 await rig.runtime.renovation.perspective('renovate'); await settle(); return rig;
}
it('keeps a Room corner gesture selection-only in Renovate', async () => {
 const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)), history = rig.runtime.canUndo.value;
 expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle')).toHaveLength(0);
 const tool = rig.runtime.toolManager;
 tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(-200, -200)); await settle();
 expect(rig.runtime.renderState.previewPolygon).toBeNull();
 tool.pointerUp(pointerAt(-200, -200));
 await settle();
 expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 expect(rig.selection.selectedIds).toEqual([rig.room.id]);
 expect(rig.session.perspective).toBe('renovate');
 expect(rig.runtime.canUndo.value).toBe(history);
});
it('keeps Renovate work and Details actions keyboard reachable without exposing layout Add', async () => {
 const rig = await setup();
 expect(rig.wrapper.find('[data-rp-action="add"]').exists()).toBe(false);
 const work = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="add-work"]');
 work.element.focus(); expect(document.activeElement).toBe(work.element);
 const more = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="renovation-more"]');
 more.element.focus(); await more.trigger('click'); await settle();
 expect(rig.selection.selectedIds).toEqual([rig.room.id]);
 expect(rig.wrapper.get('[data-rp-region="inspector"]').element).toBe(document.activeElement);
 await rig.runtime.renovation.perspective('review'); await settle();
 expect(rig.wrapper.find('[data-rp-action="add-work"]').exists()).toBe(false);
 expect(rig.wrapper.find('[data-rp-action="renovation-more"]').exists()).toBe(false);
 expect(rig.stage.findOne<Konva.Layer>('.interaction')?.find('Circle')).toHaveLength(0);
 expect(rig.stage.findOne<Konva.Layer>('.interaction')?.findOne('.object-rotation-handle')).toBeUndefined();
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

it('keeps a wall endpoint gesture selection-only in Renovate', async () => {
 const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)), history = rig.runtime.canUndo.value;
 rig.selection.select(['wall-a' as never]); await settle();
 expect(rig.stage.findOne<Konva.Layer>('.architecture')?.find('Circle')).toHaveLength(0);
 const tool = rig.runtime.toolManager;
 tool.pointerDown(pointerAt(4000, 0)); tool.pointerMove(pointerAt(5000, 0));
 expect(rig.runtime.structureActions.preview.value).toBeNull();
 tool.pointerUp(pointerAt(5000, 0)); await settle();
 expect(rig.dialogs.current).toBeNull(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before.document);
 expect(rig.runtime.canUndo.value).toBe(history);
});
