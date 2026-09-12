// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { resizeTo } from '../../helpers/layout';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { pointerAt } from '../../helpers/tool-context';
async function start(r: Awaited<ReturnType<typeof renovationEditor>>, kind: 'path' | 'fence' | 'measurement' | 'arrow') {
	await r.wrapper.get('[data-rp-action="add"]').trigger('click'); await r.wrapper.get(`[data-rp-entry="${kind}"]`).trigger('click'); await settle();
	await settleUntil(() => !r.runtime.elementTask.draft.loading, 'element baseline');
}
async function point(r: Awaited<ReturnType<typeof renovationEditor>>, x: string, y: string) {
	await r.wrapper.get('input[name="element-x"]').setValue(x); await r.wrapper.get('input[name="element-y"]').setValue(y);
	await r.wrapper.get('.rp-element-task form').trigger('submit'); await settle();
}
describe('linear element production paths', () => {
	it.each(['path', 'fence', 'measurement', 'arrow'] as const)('creates/selects/edits/deletes %s with atomic label and geometry history', async kind => {
		const r = await renovationEditor(true); r.changePlan(); await settle();
		try {
			await start(r, kind); await r.wrapper.get('input[name="element-name"]').setValue('Garden route');
			await point(r, '-1,25', '2'); await point(r, '3,75', '2');
			await r.wrapper.get('[data-rp-action="finish-element"]').trigger('click'); await settleUntil(() => r.runtime.activeToolId.value === 'select', 'element save');
			const saved = expectDefined(r.project.structure.elements?.[0], 'saved element');
			expect(saved).toMatchObject({ kind, points: [{ x: -1250, y: 2000 }, { x: 3750, y: 2000 }] });
			expect(r.selection.selectedIds).toEqual([saved.id]); expect(r.wrapper.get('.rp-element-inspector').text()).toContain('Garden route');
			await r.wrapper.get('.rp-element-inspector .rp-inspector-actions > .rp-inspector-action[data-rp-action="edit-element"]').trigger('click'); await settle();
			await r.wrapper.get('[data-rp-form="outline-points"] input[name="name"]').setValue('Side route');
			await r.wrapper.get('[data-rp-form="outline-points"] input[name="1.x"]').setValue('4,75');
			await r.wrapper.get('[data-rp-form="outline-points"]').trigger('submit'); await settle();
			expect(r.project.plan?.spatialElements?.[0].name).toBe('Side route'); expect(r.project.structure.elements?.[0].points[1].x).toBe(4750);
			await r.runtime.undo(); await settle(); expect(r.project.plan?.spatialElements?.[0].name).toBe('Garden route');
			await r.wrapper.get('[data-rp-action="delete-element"]').trigger('click'); await settle(); r.dialogs.resolve('confirm'); await settle();
			expect(r.project.structure.elements ?? []).toHaveLength(0); await r.runtime.undo(); await settle();
			expect(r.project.structure.elements?.[0]).toEqual(saved); expect(r.project.plan?.spatialElements?.[0].name).toBe('Garden route');
			const read = expectOk(await r.geometry.read(r.plan.id)); expect(read.document.structure?.elements?.[0]).not.toHaveProperty('name');
		} finally { r.unmount(); }
	});
	it.each([['path', 3], ['fence', 3], ['measurement', 2]] as const)('drags a selected %s point, refuses a collapsed segment and restores it through Undo', async (kind, count) => {
		const r = await renovationEditor(true); r.changePlan(); await settle();
		try {
			const tools = r.runtime.toolManager, drawn = [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }].slice(0, count);
			await start(r, kind); await r.wrapper.get('input[name="element-name"]').setValue('Garden route');
			for (const at of drawn) { tools.pointerDown(pointerAt(at.x, at.y)); tools.pointerUp(pointerAt(at.x, at.y)); }
			await r.wrapper.get('[data-rp-action="finish-element"]').trigger('click'); await settleUntil(() => r.runtime.activeToolId.value === 'select', 'element save');
			const saved = expectDefined(r.project.structure.elements?.[0], 'saved element');
			expect(saved.points).toEqual(drawn); expect(r.stage.find('.element-vertex')).toHaveLength(count);
			tools.pointerDown(pointerAt(2500, 500)); tools.pointerMove(pointerAt(3000, 800)); tools.pointerUp(pointerAt(3000, 800));
			await settleUntil(() => !r.runtime.elementActions.active.value && r.project.structure.elements?.[0].points[1].x === 3000, 'point move');
			expect(r.project.structure.elements?.[0].points).toEqual(drawn.with(1, { x: 3000, y: 800 }));
			await r.runtime.undo(); await settle(); expect(r.project.structure.elements?.[0]).toEqual(saved);
			const before = [...r.stack.vault.entries], last = drawn[count - 1], previous = drawn[count - 2];
			tools.pointerDown(pointerAt(last.x, last.y)); tools.pointerMove(pointerAt(previous.x, previous.y)); tools.pointerUp(pointerAt(previous.x, previous.y)); await settle();
			expect(r.project.structure.elements?.[0]).toEqual(saved); expect([...r.stack.vault.entries]).toEqual(before);
			await r.runtime.renovation.perspective('review'); await settle(); expect(r.stage.find('.element-vertex')).toHaveLength(0);
		} finally { r.unmount(); }
	});
	it('blocks every finish route while numeric text is pending, preserves it through reflow, and cancels without writing', async () => {
		const r = await renovationEditor(true); r.changePlan(); await settle();
		try {
			const before = [...r.stack.vault.entries]; await start(r, 'path'); await point(r, '0', '0'); await point(r, '3', '0');
			await r.wrapper.get('input[name="element-x"]').setValue('-'); expect(r.runtime.elementTask.canFinish.value).toBe(false);
			resizeTo(r.rootEl, 480, 640); await settle();
			expect(r.runtime.elementTask.draft.text.x).toBe('-');
			resizeTo(r.rootEl, 1360, 900); await settle();
			expect((r.wrapper.get('input[name="element-x"]').element as HTMLInputElement).value).toBe('-');
			await r.runtime.elementTask.finish(); await settle(); expect(r.project.structure.elements ?? []).toHaveLength(0); expect(r.runtime.elementTask.draft.text.x).toBe('-');
			await r.runtime.cancelActiveTask(); await settle(); expect([...r.stack.vault.entries]).toEqual(before); expect(r.runtime.elementTask.draft.points).toEqual([]);
		} finally { r.unmount(); }
	});
});
