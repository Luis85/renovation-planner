// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { makeZone } from '../../helpers/entities';
import { rig } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { expectFound, expectOk } from '../../helpers/domain';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { resizeTo } from '../../helpers/layout';
const mounted: Awaited<ReturnType<typeof rig>>[] = [];
afterEach(() => { for (const r of mounted.splice(0)) r.harness.unmount(); });
async function setup() {
	const r = await rig(); mounted.push(r);
	const before = expectFound(await r.zonesRepo.getById('zone-a' as never));
	const area = expectOk(await r.zonesRepo.save(makeZone({ ...before.entity, id: 'zone-area' as never, name: 'Area 1', zoneType: 'Custom' }), 'absent'));
	const runtime = runtimeOf(r.harness); await runtime.refreshProjection();
	useSelectionStore(r.harness.pinia).select([area.entity.id]); await settle();
	const opener = r.harness.wrapper.get('[data-rp-action="area-details"]').element as HTMLButtonElement;
	opener.focus(); opener.click();
	await settleUntil(() => r.harness.wrapper.find('[data-rp-form="area-details"]').exists(), 'Area details form');
	return { ...r, runtime, area, opener };
}
describe('Area details in the production Inspector', () => {
	it('keeps its native draft and opener through reflow and returns to the visible Details rail on cancel', async () => {
		const r = await setup(), field = r.harness.wrapper.get('input[name="name"]');
		await field.setValue('Draft patio'); (field.element as HTMLInputElement).focus();
		resizeTo(r.harness.rootEl, 460, 800); await settle();
		expect(r.harness.wrapper.get('input[name="name"]').element).toBe(field.element);
		expect(document.activeElement).toBe(field.element);
		expect(r.harness.wrapper.get('[data-rp-action="area-details"]').element).toBe(r.opener);
		await r.harness.wrapper.get('[data-rp-action="cancel"]').trigger('click'); await settle();
		expect(document.activeElement).toBe(r.harness.wrapper.get('[data-rp-rail="details"]').element);
		expect(expectFound(await r.zonesRepo.getById(r.area.entity.id))).toEqual(r.area);
	});
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
	it('keeps the Area type control focusable and refuses changes while writes pause', async () => {
		const r = await setup(), project = useProjectStore(r.harness.pinia);
		const field = r.harness.wrapper.get('select[name="zoneType"]'); (field.element as HTMLSelectElement).focus();
		project.stale = true; await settle();
		expect(field.attributes('aria-disabled')).toBe('true'); expect((field.element as HTMLSelectElement).disabled).toBe(false);
		await field.setValue('Garden'); expect((field.element as HTMLSelectElement).value).toBe('Custom');
		expect(document.activeElement).toBe(field.element); expect(expectFound(await r.zonesRepo.getById(r.area.entity.id))).toEqual(r.area);
		project.stale = false; await settle(); await field.setValue('Garden');
		expect((field.element as HTMLSelectElement).value).toBe('Garden');
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
