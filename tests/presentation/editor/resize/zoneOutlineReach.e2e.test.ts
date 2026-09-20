// @vitest-environment jsdom
/**
 * BP-04 slice B: the two production doors onto the numeric outline editor, and the fact that both
 * reach the SAME one function (CLAUDE.md's "one action, every input"). Slice A/A2's own e2e
 * (`zoneOutline.e2e.test.ts`) opens that editor by CALLING `editZoneOutline`; nothing there — and
 * nothing anywhere, until this file — walked from a control a user can press to the opened dialog.
 * Each case therefore ends at the dialog or past it, never at "the entry exists".
 */
import { afterEach, expect, it } from 'vitest';
import { rig } from '../../../helpers/planEditorRig';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { runtimeOf, settle, settleUntil } from '../../../helpers/editor';
import { makeZone } from '../../../helpers/entities';
import { expectFound, expectOk } from '../../../helpers/domain';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';

const ZONE_A = 'zone-a' as ZoneId;
const GARDEN = 'zone-garden' as ZoneId;
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const item of mounted.splice(0)) item.unmount(); });

/** The editor with one zone selected: the rig's Room, or a Garden saved beside it — a `'room'`
 * record and an `'area'` one, which is the whole of what `SpatialInspectorActions` can receive. */
async function inspector(kind: 'room' | 'area') {
	const r = await rig(); mounted.push(r.harness);
	const base = expectFound(await r.zonesRepo.getById(ZONE_A));
	if (kind === 'area') expectOk(await r.zonesRepo.save(makeZone({ ...base.entity, id: GARDEN, name: 'Garden', zoneType: 'Garden' }), 'absent'));
	const id = kind === 'area' ? GARDEN : ZONE_A;
	await runtimeOf(r.harness).refreshProjection();
	useSelectionStore(r.harness.pinia).select([id]); await settle();
	return { ...r, id };
}
const outlineForm = (wrapper: { find(selector: string): { exists(): boolean } }) => wrapper.find('[data-rp-form="outline-points"]').exists();

it('reaches the outline editor from the Inspector on a Room and writes the typed corner', async () => {
	const r = await inspector('room');
	const opener = r.harness.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-outline"]');

	expect(opener.text()).toBe('Edit corners');
	expect(opener.attributes('aria-disabled')).toBe('false');
	opener.element.click();
	await settleUntil(() => outlineForm(r.harness.wrapper), 'the outline form from the Room Inspector');
	// The dialog is titled from the zone this button named, which is what proves the id travelled.
	expect(r.harness.wrapper.get('.rp-dialog').text()).toContain('Edit Kitchen');
	await r.harness.wrapper.get('[data-rp-form="outline-points"]').get('[name="0.x"]').setValue('2');
	await r.harness.wrapper.get('[data-rp-form="outline-points"]').trigger('submit');
	await settleUntil(() => !outlineForm(r.harness.wrapper), 'the saved outline');
	expect(expectFound(await r.zonesRepo.getById(ZONE_A)).entity.geometry.points[0]).toEqual({ x: 2000, y: 1500 });
});

it('reaches the same editor from the Inspector on an Area, and greys the button while writes pause', async () => {
	const r = await inspector('area');
	const opener = r.harness.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-outline"]');

	expect(opener.text()).toBe('Edit corners');
	opener.element.click();
	await settleUntil(() => outlineForm(r.harness.wrapper), 'the outline form from the Area Inspector');
	expect(r.harness.wrapper.get('.rp-dialog').text()).toContain('Edit Garden');
	await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await settle();
	expect(outlineForm(r.harness.wrapper)).toBe(false);
	useProjectStore(r.harness.pinia).stale = true; await settle();
	expect(r.harness.wrapper.get('[data-rp-action="edit-outline"]').attributes('aria-disabled')).toBe('true');
});

it('offers the menu entry on every zone type and opens the editor from it', async () => {
	const r = await renovationEditor(true); mounted.push(r);
	r.changePlan(); await settle();
	r.selection.select([r.room.id]); await settle();
	r.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	const entry = r.wrapper.get('[data-rp-context-action="edit-outline"]');

	expect(entry.text()).toContain('Edit corners');
	expect(entry.attributes('aria-disabled')).toBeUndefined();
	await entry.trigger('click');
	await settleUntil(() => r.wrapper.find('[data-rp-form="outline-points"]').exists(), 'the outline form from the context menu');
	expect(r.wrapper.get('.rp-dialog').text()).toContain('Edit Studio');
});

/**
 * The perspective ruling (slice B's STOP 2). Editing a corner is GEOMETRY, and
 * `renovateRoomManipulation.test.ts` already holds a DRAGGED corner to Plan only — so the typed
 * one is held the same way, by `edit-outline`'s membership of `GEOMETRY_ACTIONS`. Without that
 * membership the entry is live in Renovate and this case fails on the `aria-disabled` read: a
 * zone's `rename`/`delete` are NOT guarded there, so nothing else in the menu would have caught it.
 *
 * Review is a different mechanism and gets its own assertion rather than the same one: the menu
 * computed returns before `singleActions` there, so the entry does not exist at all. The INSPECTOR
 * door needs neither guard — `EntityInspector` routes both perspectives away from `RoomInspector`
 * — which is what the two `edit-outline` button reads below check, and why that component carries
 * no perspective code.
 */
it('greys the menu entry in Renovate, offers neither door in Review, and opens nothing from either', async () => {
	const r = await renovationEditor(true); mounted.push(r);
	r.changePlan(); await settle();
	r.selection.select([r.room.id]); await settle();
	await r.runtime.renovation.perspective('renovate'); await settle();
	expect(r.wrapper.find('[data-rp-action="edit-outline"]').exists()).toBe(false);
	r.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	const entry = r.wrapper.get('[data-rp-context-action="edit-outline"]');

	expect(entry.attributes('aria-disabled')).toBe('true');
	// The greying REASON, which is `guardGeometryActions`' own and not `reason(disabled)`'s
	// generic one: the entry names the perspective rather than blaming a tool or a stale floor.
	expect(entry.attributes('title')).toBe('Edit geometry in plan');
	await entry.trigger('click'); await settle();
	expect(r.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(false);

	await r.runtime.renovation.perspective('review'); await settle();
	r.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	expect(r.wrapper.find('[data-rp-context-action="edit-outline"]').exists()).toBe(false);
	expect(r.wrapper.find('[data-rp-action="edit-outline"]').exists()).toBe(false);
});
