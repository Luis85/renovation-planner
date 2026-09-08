/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';
const mounted: { unmount(): void }[] = [];
afterEach(() => { mounted.splice(0).forEach(rig => rig.unmount()); });
async function setup() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id)), id = 'element-hidden';
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { id, kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] }), rig.runtime.structureTask.ledger)));
	return { ...rig, id, workspace: useWorkspaceStore(rig.pinia), editor: useEditorStore(rig.pinia) };
}
it('does not let a hidden Object win hover or Alt cycling over a visible Room', async () => {
	const rig = await setup(), tool = rig.runtime.toolManager;
	tool.pointerMove(pointerAt(1000, 750)); expect(rig.runtime.renderState.hoveredObjectId).toBe(rig.id);
	rig.workspace.toggleLayer('architecture'); await settle();
	tool.pointerMove(pointerAt(1000, 750)); expect(rig.runtime.renderState.hoveredObjectId).toBe(rig.room.id);
	const alt = { ...pointerAt(1000, 750), modifiers: { shift: false, ctrl: false, alt: true } };
	tool.pointerDown(alt); tool.pointerUp(alt); expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	rig.workspace.toggleLayer('zone'); await settle(); tool.pointerMove(pointerAt(1000, 750));
	expect(rig.runtime.renderState.hoveredObjectId).toBeNull();
	tool.pointerDown(alt); tool.pointerUp(alt); expect(rig.selection.selectedIds).toEqual([]);
});
it('marquee-selects only visible geometry while leaving hidden records persisted', async () => {
	const rig = await setup(), before = [...rig.stack.vault.entries], tool = rig.runtime.toolManager;
	rig.workspace.toggleLayer('architecture'); await settle();
	tool.pointerDown(pointerAt(-100, -100)); tool.pointerMove(pointerAt(2000, 2000)); tool.pointerUp(pointerAt(2000, 2000));
	expect(rig.selection.selectedIds).toEqual([rig.room.id]); expect(rig.project.structure.elements?.[0].id).toBe(rig.id);
	expect([...rig.stack.vault.entries]).toEqual(before);
});
it('uses visible sources for canvas context selection but retains direct sidebar access to hidden Objects', async () => {
	const rig = await setup(); rig.workspace.toggleLayer('architecture'); await settle();
	const at = worldToScreen({ x: 1000, y: 750 }, rig.editor.viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + at.x, clientY: box.top + at.y })); await settle();
	expect(rig.selection.selectedIds).toEqual([rig.room.id]);
	const first = rig.wrapper.get('[data-rp-context-action="fit"]'); await first.trigger('keydown', { key: 'Escape' });
	const row = rig.wrapper.get(`[data-rp-id="${rig.id}"]`), details = row.element.closest('details'); if (details) details.open = true;
	await row.trigger('contextmenu'); await settle();
	expect(rig.selection.selectedIds).toEqual([rig.id]); expect(rig.wrapper.find('[data-rp-context-action="rename"]').exists()).toBe(true);
	await rig.wrapper.get('[data-rp-context-action="fit"]').trigger('keydown', { key: 'Escape' });
	await row.trigger('click'); expect(rig.selection.selectedIds).toEqual([rig.id]);
});
