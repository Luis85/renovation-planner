// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rig, ZONE_A_DTO } from '../../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../../helpers/editor';
import { makeZone } from '../../../helpers/entities';
import { expectFound, expectOk, injectedPersistenceError } from '../../../helpers/domain';
import { err } from '../../../../src/core/result/Result';
import { installObsidianDom } from '../../../helpers/dom';
import { activateNotices } from '../../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import type { ZoneType } from '../../../../src/domain/zone/ZoneType';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';
installObsidianDom();
beforeEach(() => { activateNotices(); });
type Rig = Awaited<ReturnType<typeof rig>>;

const ZONE_A = 'zone-a' as ZoneId;
/** The rig's fixture zone re-saved with another type or geometry, before the editor mounts. */
function reshaped(zoneType: ZoneType = 'Room', geometry?: { points: readonly { x: number; y: number }[]; bulges?: readonly number[] }) {
	return async ({ zones }: { zones: Rig['zonesRepo'] }): Promise<void> => {
		const loaded = expectFound(await zones.getById(ZONE_A));
		expectOk(await zones.save(makeZone({ ...loaded.entity, zoneType, geometry: geometry ?? loaded.entity.geometry }), loaded.version));
	};
}
/** `editZoneOutline` resolves only once the dialog closes, so the opener is not awaited here. */
async function open(r: Rig): Promise<void> {
	useSelectionStore(r.harness.pinia).select([ZONE_A]);
	await settle();
	void runtimeOf(r.harness).zoneOutline.editZoneOutline(ZONE_A);
	await settle();
}
function form(r: Rig) { return r.harness.wrapper.get('[data-rp-form="outline-points"]'); }
function formOpen(r: Rig): boolean { return r.harness.wrapper.find('[data-rp-form="outline-points"]').exists(); }
async function read(r: Rig) { return expectFound(await r.zonesRepo.getById(ZONE_A)); }
async function apply(r: Rig): Promise<void> { await form(r).trigger('submit'); await settle(); }

describe('the numeric outline editor over every zone type', () => {
	it.each(['Garden', 'Custom', 'Room'] as const)('opens on a %s zone and titles the dialog with its name', async zoneType => {
		const r = await rig(reshaped(zoneType));
		await open(r);
		expect(formOpen(r)).toBe(true);
		expect(r.harness.wrapper.find('.rp-dialog').text()).toContain('Edit Kitchen');
		expect(form(r).text()).toContain('Positions in metres from the plan origin');
		expect(form(r).findAll('fieldset')).toHaveLength(ZONE_A_DTO.points.length);
		r.harness.unmount();
	});

	it('rounds a retyped coordinate to whole millimetres from comma and from point, and passes an untouched sibling through unrounded', async () => {
		const original = [{ x: 1500, y: -765.4 }, { x: 4400, y: 1500 }, { x: 4400, y: 3400 }, { x: 1500, y: 3400 }];
		const r = await rig(reshaped('Garden', { points: original }));
		await open(r);
		await form(r).get('[name="0.x"]').setValue('1,2345');
		await form(r).get('[name="1.x"]').setValue('4.4006');
		await apply(r);
		const saved = (await read(r)).entity.geometry.points;
		expect(saved[0]).toEqual({ x: 1235, y: -765.4 });
		expect(saved[1]).toEqual({ x: 4401, y: 1500 });
		expect(saved.slice(2)).toEqual(original.slice(2));
		r.harness.unmount();
	});

	it('retains the original bulges by index when one corner moves', async () => {
		const points = [{ x: 1500, y: 1500 }, { x: 4400, y: 1500 }, { x: 4400, y: 3400 }, { x: 1500, y: 3400 }];
		const bulges = [0, 0.4, 0, 0];
		const r = await rig(reshaped('Garden', { points, bulges }));
		await open(r);
		await form(r).get('[name="2.x"]').setValue('4.5');
		await apply(r);
		const saved = (await read(r)).entity.geometry;
		expect(saved.points[2]).toEqual({ x: 4500, y: 3400 });
		expect(saved.bulges).toEqual(bulges);
		await runtimeOf(r.harness).undo();
		expect((await read(r)).entity.geometry).toEqual({ points, bulges });
		r.harness.unmount();
	});

	it('previews without writing, applies once, and reverses to the exact prior geometry', async () => {
		const r = await rig(reshaped('Terrace'));
		const runtime = runtimeOf(r.harness), before = await read(r);
		const dispatch = vi.spyOn(runtime.dispatcher, 'run');
		await open(r);
		await form(r).get('[name="2.y"]').setValue('4');
		expect(runtime.renderState.previewPolygon?.[2]).toEqual({ x: 4400, y: 4000 });
		expect((await read(r)).version).toEqual(before.version);
		expect(runtime.canUndo.value).toBe(false);
		await apply(r);
		await settleUntil(() => !r.harness.wrapper.find('[data-rp-form="outline-points"]').exists(), 'saved outline');
		expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 4400, y: 4000 });
		expect(runtime.renderState.previewPolygon).toBeNull();
		// BP-04's "one history entry", which the undo/redo pair below cannot see: two IDENTICAL
		// entries reverse to the same polygon, so the geometry reads would pass over either. One
		// DISPATCH, and one entry left on the stack after it — the second half is the one that
		// catches a command dispatched twice, since `toHaveBeenCalledTimes` alone would still
		// pass a single dispatch that pushed two.
		expect(dispatch).toHaveBeenCalledTimes(1);
		await runtime.undo();
		expect((await read(r)).entity.geometry).toEqual(before.entity.geometry);
		expect(runtime.canUndo.value).toBe(false);
		await runtime.redo();
		expect((await read(r)).entity.geometry.points[2]).toEqual({ x: 4400, y: 4000 });
		r.harness.unmount();
	});

	it('writes nothing for an unchanged submission or for a cancel', async () => {
		const r = await rig(reshaped('Garden'));
		const runtime = runtimeOf(r.harness), dispatch = vi.spyOn(runtime.dispatcher, 'run');
		await open(r);
		await apply(r);
		expect(dispatch).not.toHaveBeenCalled();
		expect(runtime.canUndo.value).toBe(false);
		await form(r).get('[name="0.x"]').setValue('9');
		await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await settle();
		expect(dispatch).not.toHaveBeenCalled();
		expect((await read(r)).entity.geometry.points).toEqual(ZONE_A_DTO.points);
		expect(runtime.renderState.previewPolygon).toBeNull();
		r.harness.unmount();
	});

	it('refuses a peer write against the form baseline and shows the current area', async () => {
		const r = await rig(reshaped('Garden'));
		await open(r);
		await form(r).get('[name="2.y"]').setValue('4');
		const before = await read(r);
		const changed = expectOk(before.entity.withGeometry({ points: ZONE_A_DTO.points.map(p => ({ ...p, y: p.y + 50 })) }));
		expectOk(await r.zonesRepo.save(changed, before.version));
		await apply(r);
		expect((await read(r)).entity.geometry).toEqual(changed.geometry);
		expect(formOpen(r)).toBe(true);
		expect(r.harness.wrapper.text()).toContain('Current area: Kitchen');
		expect(form(r).get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		r.harness.unmount();
	});

	it('says the area is unavailable when the conflicting current one cannot be read', async () => {
		let failReadback = false;
		const r = await rig(reshaped('Garden'), { wrapQueries: queries => ({ ...queries,
			findZonesByPlan: id => failReadback ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id),
		}) });
		await open(r);
		await form(r).get('[name="2.y"]').setValue('4');
		const before = await read(r);
		expectOk(await r.zonesRepo.save(before.entity, before.version));
		failReadback = true;
		await apply(r);
		expect(r.harness.wrapper.text()).toContain('The area is no longer available');
		expect(form(r).get<HTMLInputElement>('[name="2.y"]').element.value).toBe('4');
		r.harness.unmount();
	});

	it('refuses invalid, empty and out-of-range coordinates without dispatching', async () => {
		const r = await rig(reshaped('Garden'));
		const dispatch = vi.spyOn(runtimeOf(r.harness).dispatcher, 'run');
		await open(r);
		for (const text of ['bad', '', '1e400']) {
			await form(r).get('[name="0.x"]').setValue(text);
			await apply(r);
			expect(formOpen(r)).toBe(true);
			expect(form(r).find('[role="alert"]').exists()).toBe(true);
			expect(runtimeOf(r.harness).renderState.previewPolygon).toBeNull();
		}
		expect(dispatch).not.toHaveBeenCalled();
		expect((await read(r)).entity.geometry.points).toEqual(ZONE_A_DTO.points);
		r.harness.unmount();
	});

	/**
	 * BP-04's "choose a numbered corner", and its action 3's highlight. The list is one row per
	 * corner rather than a mode that HIDES the other fieldsets: every field stays reachable, and
	 * choosing a corner moves focus into it — which is what makes the keyboard path choose-then-
	 * type. The canvas half (what the highlighted handle actually looks like) is
	 * `interactionLayer.test.ts`'s and a capture's; this asserts the index that reaches it.
	 */
	it('numbers every corner, and choosing one focuses its field and marks it on the canvas', async () => {
		const r = await rig(reshaped('Garden'));
		const runtime = runtimeOf(r.harness);
		await open(r);
		const rows = form(r).findAll('[data-rp-corner-list] li');
		expect(rows).toHaveLength(ZONE_A_DTO.points.length);
		expect(rows[2].text()).toContain('Corner 3: X 4.4 m, Y 3.4 m');
		expect(runtime.renderState.highlightedVertex).toBeNull();
		// The list sits ABOVE the fieldsets, and `DialogHost` focuses `focusableWithin()[0]`, so
		// opening this dialog now lands on the chooser rather than on corner 1's X field. That is
		// the contract's own order — choose a corner, then enter its position — and it is asserted
		// rather than left as a side effect of where the markup went.
		expect(document.activeElement).toBe(rows[0].get('[data-rp-corner="choose"]').element);

		await rows[2].get('[data-rp-corner="choose"]').trigger('click');
		await settle();

		expect(runtime.renderState.highlightedVertex).toBe(2);
		expect(document.activeElement).toBe(form(r).get<HTMLInputElement>('[name="2.x"]').element);
		// The chooser's own region BY NAME. `[role="status"]` matched the first such element,
		// and this form has a second one above it — the `latest` line — so the assertion read
		// whichever the DOM ordered first the moment that sibling rendered.
		expect(form(r).get('[data-rp-corner-status]').text()).toContain('Corner 3');
		expect(rows[2].get('[data-rp-corner="choose"]').attributes('aria-pressed')).toBe('true');
		expect(rows[0].get('[data-rp-corner="choose"]').attributes('aria-pressed')).toBe('false');

		// A second choice replaces the first rather than accumulating.
		await rows[0].get('[data-rp-corner="choose"]').trigger('click');
		await settle();
		expect(runtime.renderState.highlightedVertex).toBe(0);
		expect(rows[2].get('[data-rp-corner="choose"]').attributes('aria-pressed')).toBe('false');
		r.harness.unmount();
	});

	it('leaves no mark on the canvas once the dialog closes', async () => {
		const r = await rig(reshaped('Garden'));
		const runtime = runtimeOf(r.harness);
		await open(r);
		await form(r).findAll('[data-rp-corner-list] li')[1].get('[data-rp-corner="choose"]').trigger('click');
		await settle();
		expect(runtime.renderState.highlightedVertex).toBe(1);

		await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click');
		await settle();

		expect(formOpen(r)).toBe(false);
		expect(runtime.renderState.highlightedVertex).toBeNull();
		r.harness.unmount();
	});

	it.each(['saving', 'unrecovered', 'wrong tool', 'multiple', 'none'] as const)('stays shut on %s', async reason => {
		const r = await rig(reshaped('Garden'));
		const runtime = runtimeOf(r.harness), selection = useSelectionStore(r.harness.pinia);
		selection.select([ZONE_A]); await settle();
		if (reason === 'saving') useSaveStateStore(r.harness.pinia).beginSaving();
		if (reason === 'unrecovered') useSaveStateStore(r.harness.pinia).markUnrecovered();
		if (reason === 'wrong tool') runtime.setTool('draw-area');
		if (reason === 'multiple') selection.select([ZONE_A, 'other' as ZoneId]);
		if (reason === 'none') selection.clear();
		await settle();
		// Not awaited, for the same reason `open` does not: a gate that stops working lets the
		// dialog open, and an awaited opener would then report a 5000ms timeout — the shape of
		// machine contention — instead of the assertion below.
		void runtime.zoneOutline.editZoneOutline(ZONE_A); await settle();
		expect(r.harness.wrapper.find('[data-rp-form="outline-points"]').exists()).toBe(false);
		expect(runtime.zoneOutline.zoneOutlineBlocked.value).toBe(reason === 'saving' || reason === 'unrecovered' || reason === 'wrong tool');
		r.harness.unmount();
	});
});
