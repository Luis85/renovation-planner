// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { rig } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { resizeTo } from '../../helpers/layout';
const mounted: Awaited<ReturnType<typeof rig>>[] = [];
afterEach(() => { for (const r of mounted.splice(0)) r.harness.unmount(); });
async function setup() {
	const r = await rig(); mounted.push(r);
	const before = expectFound(await r.zonesRepo.getById('zone-a' as never));
	const entity = expectOk(before.entity.withGeometry({ points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 3500, y: 2300 }, { x: 1000, y: 4000 }, { x: 0, y: 2000 }] }));
	const original = expectOk(await r.zonesRepo.save(entity, before.version)), runtime = runtimeOf(r.harness);
	await runtime.refreshProjection(); useSelectionStore(r.harness.pinia).select([entity.id]); await settle();
	await r.harness.wrapper.get('[data-rp-action="edit-outline"]').trigger('click');
	await settleUntil(() => r.harness.wrapper.find('[data-rp-form="outline-points"]').exists(), 'Outline coordinates');
	return { ...r, original, runtime };
}
describe('numeric editing of irregular outlines in the real editor', () => {
	it('preserves draft and focus through reflow, previews without writes and uses one history step', async () => {
		const r = await setup(), field = r.harness.wrapper.get('input[name="1.x"]');
		await field.setValue('5,5'); (field.element as HTMLInputElement).focus();
		resizeTo(r.harness.rootEl, 460, 800); await settle();
		expect(document.activeElement).toBe(field.element); expect((field.element as HTMLInputElement).value).toBe('5,5');
		expect(expectFound(await r.zonesRepo.getById(r.original.entity.id))).toEqual(r.original);
		expect(r.runtime.renderState.previewPolygon?.[1]).toEqual({ x: 5500, y: 0 });
		await r.harness.wrapper.get('[data-rp-form="outline-points"]').trigger('submit');
		await settleUntil(() => !r.harness.wrapper.find('[data-rp-form="outline-points"]').exists(), 'Saved outline');
		const changed = expectFound(await r.zonesRepo.getById(r.original.entity.id)).entity;
		expect(changed.geometry.points[1]).toEqual({ x: 5500, y: 0 }); expect(changed.geometry.points).toHaveLength(5);
		expect(r.runtime.renderState.previewPolygon).toBeNull();
		await r.runtime.undo(); expect(expectFound(await r.zonesRepo.getById(r.original.entity.id)).entity).toEqual(r.original.entity);
		expect(r.runtime.canUndo.value).toBe(false);
		await r.runtime.redo(); expect(expectFound(await r.zonesRepo.getById(r.original.entity.id)).entity).toEqual(changed);
	});
	it('keeps invalid coordinates and cancels without changing geometry', async () => {
		const r = await setup(); await r.harness.wrapper.get('input[name="0.x"]').setValue('bad');
		await r.harness.wrapper.get('[data-rp-form="outline-points"]').trigger('submit'); await settle();
		expect(document.activeElement).toBe(r.harness.wrapper.get('input[name="0.x"]').element);
		expect(r.runtime.renderState.previewPolygon).toBeNull();
		await r.harness.wrapper.get('[data-rp-action="cancel"]').trigger('click'); await settle();
		expect(expectFound(await r.zonesRepo.getById(r.original.entity.id))).toEqual(r.original);
	});
});
