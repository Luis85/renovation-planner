// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { rig } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
const mounted: Awaited<ReturnType<typeof rig>>[] = [];
afterEach(() => { for (const r of mounted.splice(0)) r.harness.unmount(); });
async function setup() {
	const r = await rig(); mounted.push(r);
	const before = expectFound(await r.zonesRepo.getById('zone-a' as never));
	const area = expectOk(await r.zonesRepo.save(expectOk(before.entity.withDetails('Area 1', 'Custom')), before.version));
	const runtime = runtimeOf(r.harness); await runtime.refreshProjection();
	useSelectionStore(r.harness.pinia).select([area.entity.id]); await settle();
	await r.harness.wrapper.get('[data-rp-action="area-details"]').trigger('click');
	await settleUntil(() => r.harness.wrapper.find('[data-rp-form="area-details"]').exists(), 'Area details form');
	return { ...r, runtime, area };
}
describe('Area details in the production Inspector', () => {
	it('commits name and type together and reverses both without moving the outline', async () => {
		const r = await setup();
		expect(r.harness.wrapper.find('option[value="Room"]').exists()).toBe(false);
		await r.harness.wrapper.get('input[name="name"]').setValue('Patio');
		await r.harness.wrapper.get('select[name="zoneType"]').setValue('Terrace');
		await r.harness.wrapper.get('[data-rp-form="area-details"]').trigger('submit');
		await settleUntil(() => !r.harness.wrapper.find('[data-rp-form="area-details"]').exists(), 'Saved Area details');
		const changed = expectFound(await r.zonesRepo.getById(r.area.entity.id)).entity;
		expect(changed).toMatchObject({ name: 'Patio', zoneType: 'Terrace', geometry: r.area.entity.geometry });
		expect(r.harness.wrapper.get('.rp-room-inspector .rp-editor-panel-title').text()).toBe('Patio');
		await r.runtime.undo(); expect(expectFound(await r.zonesRepo.getById(r.area.entity.id)).entity).toEqual(r.area.entity);
		expect(r.runtime.canUndo.value).toBe(false);
		await r.runtime.redo(); expect(expectFound(await r.zonesRepo.getById(r.area.entity.id)).entity).toEqual(changed);
	});
	it('retains invalid text and cancels without a write', async () => {
		const r = await setup();
		await r.harness.wrapper.get('input[name="name"]').setValue(' ');
		await r.harness.wrapper.get('[data-rp-form="area-details"]').trigger('submit'); await settle();
		expect(r.harness.wrapper.get('input[name="name"]').attributes('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(r.harness.wrapper.get('input[name="name"]').element);
		await r.harness.wrapper.get('[data-rp-action="cancel"]').trigger('click'); await settle();
		expect(expectFound(await r.zonesRepo.getById(r.area.entity.id))).toEqual(r.area);
	});
	it('refuses a peer edit and shows the latest metadata while retaining the draft', async () => {
		const r = await setup();
		await r.harness.wrapper.get('input[name="name"]').setValue('My patio');
		expectOk(await r.zonesRepo.save(expectOk(r.area.entity.withDetails('Peer garden', 'Garden')), r.area.version));
		await r.harness.wrapper.get('[data-rp-form="area-details"]').trigger('submit'); await settle();
		expect((r.harness.wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('My patio');
		expect(r.harness.wrapper.get('[data-rp-form="area-details"]').text()).toContain('Peer garden');
		expect(expectFound(await r.zonesRepo.getById(r.area.entity.id)).entity.name).toBe('Peer garden');
	});
});
