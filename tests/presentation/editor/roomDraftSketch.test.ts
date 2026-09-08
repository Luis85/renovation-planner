/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import Konva from 'konva';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { mountPlanEditorCanvas, runtimeOf, settle } from '../../helpers/editor';

describe('the room draft sketch', () => {
 it('shows a filled draft with four corner handles and editable measurements, then removes it on cancel', async () => {
  const harness = await mountPlanEditorCanvas(), runtime = runtimeOf(harness);
  runtime.setTool('draw-room'); await settle();
  expect(harness.stage.find('.room-draft')).toHaveLength(0);
  runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 }); await settle();
  const outline = harness.stage.findOne<Konva.Line>('.room-draft');
  expect(outline?.points()).toEqual([148, 148, 568, 148, 568, 528, 148, 528]);
  expect(harness.stage.find('.room-draft-corner')).toHaveLength(4);
  expect(harness.stage.findOne<Konva.Line>('.room-draft-fill')?.opacity()).toBe(0.08);
  expect(harness.wrapper.findAll('[data-rp-draft-dimension]').map(item => item.text())).toEqual(['4.2 m', '3.8 m']);
  await harness.wrapper.find('[data-rp-draft-dimension="width"]').trigger('click');
  expect(document.activeElement).toBe(harness.wrapper.find('.rp-new-room input[name="width"]').element);
  runtime.cancelActiveTask(); await settle();
  expect(harness.stage.find('.room-draft')).toHaveLength(0);
  expect(harness.wrapper.find('[data-rp-draft-dimension]').exists()).toBe(false);
  harness.unmount();
 });
 it('keeps the draft group beneath selection when a repeated room begins after selection settled', async () => {
  const harness = await mountPlanEditorCanvas(), runtime = runtimeOf(harness);
  useSelectionStore(harness.pinia).select(['zone-kitchen' as never]);
  runtime.setTool('draw-room'); await settle();
  runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 }); await settle();
  const layer = harness.stage.findOne<Konva.Layer>('.interaction');
  const order = layer?.getChildren().flatMap(node => node instanceof Konva.Group ? node.getChildren().map(child => child.name()) : [node.name()]) ?? [];
  expect(order).toContain('selection-outline');
  expect(order.indexOf('room-draft-corner')).toBeLessThan(order.indexOf('selection-outline'));
  harness.unmount();
 });
 it('opens the constrained Inspector before focusing the draft dimension field', async () => {
  const harness = await mountPlanEditorCanvas(), runtime = runtimeOf(harness), workspace = useWorkspaceStore(harness.pinia);
  runtime.setTool('draw-room'); runtime.roomDraft.setRect({ x: 1000, y: 1000, width: 4200, depth: 3800 });
  workspace.setLayoutMode('constrained'); await settle();
  expect(harness.wrapper.find('.rp-new-room').isVisible()).toBe(false);
  await harness.wrapper.find('[data-rp-draft-dimension="depth"]').trigger('click'); await settle();
  expect(workspace.overlay).toBe('inspector');
  expect(document.activeElement).toBe(harness.wrapper.find('.rp-new-room input[name="depth"]').element);
  harness.unmount();
 });
});
