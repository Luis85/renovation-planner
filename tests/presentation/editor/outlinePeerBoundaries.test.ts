// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { expectFound, expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { tr } from '../../../src/presentation/i18n/strings';

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const mounted: Rig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

async function setup() {
	const rig = await renovationEditor(true); mounted.push(rig);
	const before = expectFound(await rig.stack.zones.getById(rig.room.id));
	const entity = expectOk(before.entity.withGeometry({ points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 3500, y: 2300 }, { x: 1000, y: 4000 }, { x: 0, y: 2000 }] }));
	const original = expectOk(await rig.stack.zones.save(entity, before.version));
	await rig.runtime.refreshProjection(); rig.selection.select([rig.room.id]); await settle();
	const opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-outline"]');
	opener.element.focus(); opener.element.click();
	await settleUntil(() => rig.wrapper.find('[data-rp-form="outline-points"]').exists(), 'Outline dialog');
	const form = rig.wrapper.get('[data-rp-form="outline-points"]');
	const field = form.get<HTMLInputElement>('input[name="1.x"]');
	await field.setValue('5,5');
	return { ...rig, original, form, field };
}

async function apply(rig: Awaited<ReturnType<typeof setup>>) {
	rig.form.get<HTMLButtonElement>('button[type="submit"]').element.click(); await settle();
}

async function cancelAfterReflow(rig: Awaited<ReturnType<typeof setup>>) {
	resizeTo(rig.rootEl, 460, 800); await settle();
	expect(rig.field.element.value).toBe('5,5');
	rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click();
	await settleUntil(() => !rig.wrapper.find('[data-rp-form="outline-points"]').exists(), 'Outline cancel');
	expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-rail="details"]').element);
	expect(rig.runtime.renderState.previewPolygon).toBeNull();
}

it('shows the peer Room name after an outline conflict while retaining draft coordinates and the peer geometry', async () => {
	const rig = await setup();
	const peer = expectOk(await rig.stack.zones.save(expectOk(rig.original.entity.withName('Peer room')), rig.original.version));
	const bytes = [...rig.stack.vault.entries], save = vi.spyOn(rig.stack.zones, 'save');
	await apply(rig);
	await settleUntil(() => rig.form.text().includes(tr('editor.outline.latest', { name: 'Peer room' })), 'Current peer outline message');
	expect(rig.field.element.value).toBe('5,5');
	expect(rig.form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	expect(save).toHaveBeenCalledOnce();
	await apply(rig); expect(save).toHaveBeenCalledOnce();
	expect(expectFound(await rig.stack.zones.getById(rig.room.id))).toEqual({ entity: peer.entity, version: peer.version });
	expect(peer.relatedWrite).toBeDefined();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).version).toEqual(peer.relatedWrite?.after);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	await cancelAfterReflow(rig);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('keeps the draft and refuses to recreate a Room deleted between the command read and its conditional save', async () => {
	const rig = await setup(), originalSave = rig.stack.zones.save.bind(rig.stack.zones);
	let peerBytes: [string, string][] = [];
	// A real peer repository operation wins the read/write gap; the attempted save
	// still runs through the original repository and produces its own refusal.
	const save = vi.spyOn(rig.stack.zones, 'save').mockImplementationOnce(async (entity, expected) => {
		expectOk(await rig.stack.zones.delete(rig.room.id, rig.original.version));
		peerBytes = [...rig.stack.vault.entries];
		return originalSave(entity, expected);
	});
	await apply(rig);
	await settleUntil(() => rig.form.text().includes(tr('editor.area.unavailable')), 'Deleted Room message');
	expect(save).toHaveBeenCalledOnce();
	expect(peerBytes.length).toBeGreaterThan(0);
	expect(rig.field.element.value).toBe('5,5');
	expect(rig.form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await apply(rig); expect(save).toHaveBeenCalledOnce();
	expect(expectOk(await rig.stack.zones.getById(rig.room.id))).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(peerBytes);
	await cancelAfterReflow(rig);
	expect([...rig.stack.vault.entries]).toEqual(peerBytes);
});
