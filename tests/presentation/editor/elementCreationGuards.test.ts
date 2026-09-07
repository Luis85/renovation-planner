// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { pointerAt } from '../../helpers/tool-context';
import { defer } from '../../helpers/async';
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
function key(rig: Awaited<ReturnType<typeof setup>>, value: string): void {
 const canvas = expectDefined(rig.canvasEl, 'canvas'); canvas.focus(); canvas.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
}
it('creates a measurement with canvas clicks and Enter, refusing duplicate and excess points without losing its draft', async () => {
 const rig = await setup(), task = rig.runtime.elementTask, tools = rig.runtime.toolManager;
 rig.runtime.setTool('measure'); await settleUntil(() => !task.draft.loading, 'measurement baseline');
 task.draft.name = 'Fence span';
 tools.pointerDown(pointerAt(500, 500)); tools.pointerUp(pointerAt(500, 500));
 tools.pointerDown(pointerAt(500, 500)); tools.pointerUp(pointerAt(500, 500)); expect(task.draft.points).toHaveLength(1);
 await task.finish(); expect(task.draft.error?.code).toContain('element-invalid'); expect(rig.project.structure.elements ?? []).toEqual([]);
 tools.pointerDown(pointerAt(3000, 500)); tools.pointerUp(pointerAt(3000, 500));
 tools.pointerDown(pointerAt(3000, 2500)); tools.pointerUp(pointerAt(3000, 2500)); expect(task.draft.points).toEqual([{ x: 500, y: 500 }, { x: 3000, y: 500 }]);
 key(rig, 'Backspace'); await settle(); expect(task.draft.points).toHaveLength(1);
 tools.pointerDown(pointerAt(3000, 500)); tools.pointerUp(pointerAt(3000, 500)); key(rig, 'Enter');
 await settleUntil(() => rig.project.structure.elements?.length === 1, 'measurement save');
 expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'measurement', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] });
 expect(rig.project.plan?.spatialElements?.[0].name).toBe('Fence span'); expect(rig.runtime.activeToolId.value).toBe('select');
});
it('refuses a stale creation baseline and never rebases that conflict through read-only retry', async () => {
 const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(before.document.structure, 'structure');
 const walls = structure.walls.map((wall, index) => index === 0 ? { ...wall, thickness: wall.thickness + 10 } : wall);
 expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure: { ...structure, walls } }, before.version));
 rig.runtime.setTool('draw-fence'); const task = rig.runtime.elementTask; await settleUntil(() => !task.draft.loading, 'stale baseline refusal');
 expect(task.draft.conflict).toBe(true); expect(task.canFinish.value).toBe(false); expect(rig.project.structure.walls).toEqual(walls);
 const bytes = [...rig.stack.vault.entries]; await task.retry(); await task.finish();
 expect(task.draft.conflict).toBe(true); expect([...rig.stack.vault.entries]).toEqual(bytes);
 await rig.runtime.cancelActiveTask(); await settle(); expect(rig.runtime.activeToolId.value).toBe('select');
});
it('completes an in-flight creation after leaf disposal without restoring closed draft state or stealing focus', async () => {
 const rig = await setup(), task = rig.runtime.elementTask;
 rig.runtime.setTool('draw-path'); await settleUntil(() => !task.draft.loading, 'path baseline');
 task.draft.name = 'Saved after close'; task.setPoints([{ x: 500, y: 500 }, { x: 3000, y: 500 }]);
 const gate = defer<void>(), write = rig.geometry.write.bind(rig.geometry);
 const writing = vi.spyOn(rig.geometry, 'write').mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
 const finish = task.finish(); await settleUntil(() => writing.mock.calls.length === 1, 'pending geometry write');
 expect(task.setPoints([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
 mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
 const otherLeaf = document.createElement('button'); document.body.append(otherLeaf); otherLeaf.focus();
 try {
  gate.resolve(); await finish; await settle();
  expect(document.activeElement).toBe(otherLeaf); expect(task.draft.points).toEqual([]);
  const saved = expectOk(await rig.renovation.read(rig.plan.id));
  expect(saved.plan.entity.spatialElements?.[0].name).toBe('Saved after close'); expect(saved.geometry.document.structure?.elements).toHaveLength(1);
 } finally { otherLeaf.remove(); }
});

it('retains a named creation draft when a peer changes geometry after the baseline was captured', async () => {
 const rig = await setup(), task = rig.runtime.elementTask;
 rig.runtime.setTool('draw-fence'); await settleUntil(() => !task.draft.loading, 'fence baseline');
 task.draft.name = 'My fence'; task.setPoints([{ x: 500, y: 500 }, { x: 3000, y: 500 }]);
 const read = expectOk(await rig.geometry.read(rig.plan.id)), structure = expectDefined(read.document.structure, 'structure');
 const walls = structure.walls.map((wall, index) => index === 0 ? { ...wall, thickness: wall.thickness + 10 } : wall);
 expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...structure, walls } }, read.version));
 await task.finish(); await settle();
 expect(task.draft.conflict).toBe(true); expect(task.draft.name).toBe('My fence'); expect(task.draft.points).toEqual([{ x: 500, y: 500 }, { x: 3000, y: 500 }]);
 expect(rig.project.structure.walls).toEqual(walls); expect(rig.project.structure.elements ?? []).toEqual([]);
 const bytes = [...rig.stack.vault.entries]; await task.retry(); await task.finish(); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps Object field Enter local and refuses canvas Finish or Undo point while rectangle text is pending', async () => {
 const rig = await setup(), task = rig.runtime.elementTask;
 rig.runtime.setTool('place-object'); await settleUntil(() => !task.draft.loading, 'Object baseline');
 await rig.wrapper.get('input[name="element-name"]').setValue('Cabinet');
 await rig.wrapper.get('.rp-object-rectangle summary').trigger('click');
 await rig.wrapper.get('input[name="object-width"]').setValue('1'); await rig.wrapper.get('input[name="object-depth"]').setValue('1');
 await rig.wrapper.get('input[name="object-width"]').trigger('keydown', { key: 'Enter' }); await settle();
 expect(task.draft.points).toHaveLength(4); expect(rig.project.structure.elements ?? []).toEqual([]);
 key(rig, 'Backspace'); await settle(); const points = task.draft.points.map(point => ({ ...point })); expect(points).toHaveLength(3);
 await rig.wrapper.get('input[name="object-width"]').setValue('-'); key(rig, 'Backspace'); key(rig, 'Enter'); await settle();
 expect(task.draft.pendingInput).toBe(true); expect(task.draft.points).toEqual(points); expect(rig.project.structure.elements ?? []).toEqual([]);
 await rig.wrapper.get('[data-rp-action="discard-object-rectangle"]').trigger('click'); await settle(); key(rig, 'Enter');
 await settleUntil(() => rig.project.structure.elements?.length === 1, 'Object canvas Finish');
 expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'object', points }); expect(rig.project.plan?.spatialElements?.[0].name).toBe('Cabinet');
});
