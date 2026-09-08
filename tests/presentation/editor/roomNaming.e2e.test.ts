// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rig, click, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { makeAsset, makeZone } from '../../helpers/entities';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { err, ok } from '../../../src/core/result/Result';
installObsidianDom();
beforeEach(() => { activateNotices(); });
type Rig = Awaited<ReturnType<typeof rig>>;
const FORM = '[data-rp-form="room-name"]';
async function read(r: Rig) { return expectFound(await r.zonesRepo.getById('zone-a' as never)); }
async function open(r: Rig, canvas = false): Promise<void> {
	if (canvas) click(expectDefined(r.harness.canvasEl, 'canvas'), 300, 250);
	else await r.harness.wrapper.get('.rp-room-list__row[data-rp-id="zone-a"]').trigger('click');
	await settle();
	const button = r.harness.wrapper.get('[data-rp-action="rename-room"]');
	(button.element as HTMLElement).focus(); await button.trigger('click');
	await settleUntil(() => r.harness.wrapper.find(FORM).exists(), 'name form');
}
async function type(r: Rig, name = '  Dining room  '): Promise<void> { await r.harness.wrapper.get('input[name="name"]').setValue(name); }
async function apply(r: Rig): Promise<void> { await r.harness.wrapper.get(FORM).trigger('submit'); await settle(); }
async function cancel(r: Rig): Promise<void> { await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await settle(); }

describe('existing Room naming in the real editor', () => {
	it('preserves linked requirements and their quantity/cost through rename and Undo/Redo', async () => {
		const asset = makeAsset({ unit: 'm2' });
		const r = await rig(async ({ assets }) => { expectOk(await assets.save(asset, 'absent')); });
		const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle();
		expectOk(await runtime.commitField({ kind: 'assign', zoneId: 'zone-a' as never, assetId: asset.id }));
		const before = runtime.inspectorRequirements.value;
		expect(before).toHaveLength(1); await open(r); await type(r);
		expect(runtime.inspectorRequirements.value).toEqual(before);
		await apply(r); await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'renamed');
		expect(runtime.inspectorRequirements.value).toEqual(before);
		await runtime.undo(); expect(runtime.inspectorRequirements.value).toEqual(before);
		await runtime.redo(); expect(runtime.inspectorRequirements.value).toEqual(before); r.harness.unmount();
	});
	it.each([false, true])('selects via list/canvas (%s), commits once, refreshes all local projections and reverses', async canvas => {
		const r = await rig(); const before = await read(r), runtime = runtimeOf(r.harness);
		await open(r, canvas); expect(document.activeElement).toBe(r.harness.wrapper.get('input[name="name"]').element);
		await type(r); await r.harness.wrapper.get('input[name="name"]').trigger('blur');
		expect(await read(r)).toEqual(before); expect(runtime.canUndo.value).toBe(false);
		expect(runtime.inspectorDto.value).toMatchObject({ name: before.entity.name });
		await apply(r); await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'renamed');
		expect((await read(r)).entity).toEqual(expectOk(before.entity.withName('Dining room')));
		expect(runtime.inspectorDto.value).toMatchObject({ name: 'Dining room' });
		expect(useProjectStore(r.harness.pinia).zones.get('zone-a')?.name).toBe('Dining room');
		expect(r.harness.wrapper.get('.rp-room-list__row[data-rp-id="zone-a"]').text()).toContain('Dining room');
		expect(r.harness.stage?.find('Text').some(node => node.getAttr('text') === 'Dining room')).toBe(true);
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(document.activeElement).toBe(r.harness.wrapper.get('[data-rp-action="rename-room"]').element);
		await runtime.undo(); expect((await read(r)).entity).toEqual(before.entity); expect(runtime.canUndo.value).toBe(false);
		await runtime.redo(); expect((await read(r)).entity.name).toBe('Dining room'); r.harness.unmount();
	});
	it('refreshes the Inspector heading when a peer leaf renames the selected room', async () => {
		// The write is a PEER's: straight into the repository, never through this leaf's dispatcher,
		// so the post-command funnel never runs and `onPlanChanged` is the only door it arrives by.
		const r = await rig(); const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle();
		const before = await read(r); expect(runtime.inspectorDto.value).toMatchObject({ name: before.entity.name });
		expectOk(await r.zonesRepo.save(expectOk(before.entity.withName('Peer')), before.version));
		r.harness.changePlan();
		await settleUntil(() => useProjectStore(r.harness.pinia).zones.get('zone-a')?.name === 'Peer', 'projection renamed by peer');
		await settle();
		expect(runtime.inspectorDto.value).toMatchObject({ name: 'Peer' }); r.harness.unmount();
	});
	it('keeps blank input with a focused field error; unchanged/trim-equivalent names and Cancel write no history', async () => {
		const r = await rig(); const before = await read(r); await open(r);
		await apply(r); await type(r, `  ${before.entity.name}  `); await apply(r);
		expect(runtimeOf(r.harness).canUndo.value).toBe(false);
		await type(r, '   '); await apply(r);
		expect(r.harness.wrapper.text()).toContain('Enter a room name.');
		expect(document.activeElement).toBe(r.harness.wrapper.get('input[aria-invalid="true"]').element);
		expect(r.harness.wrapper.get('input[name="name"]').element).toHaveProperty('value', '   ');
		await type(r); expect(r.harness.wrapper.find('[aria-invalid="true"]').exists()).toBe(false);
		await cancel(r); expect(await read(r)).toEqual(before); r.harness.unmount();
	});
	it('keeps native editing and owns Escape without a canvas action', async () => {
		const r = await rig(); await open(r); await type(r);
		const input = r.harness.wrapper.get('input[name="name"]');
		for (const key of [' ', 'Delete', 'Backspace', 'ArrowLeft', 'Enter']) {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			input.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
		}
		for (const detail of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...detail });
			input.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
		}
		await input.trigger('keydown', { key: 'Escape' }); await settle();
		expect(r.harness.wrapper.find(FORM).exists()).toBe(false);
		expect(useSelectionStore(r.harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(runtimeOf(r.harness).activeToolId.value).toBe('select'); expect(runtimeOf(r.harness).canUndo.value).toBe(false);
		r.harness.unmount();
	});
	it.each([false, true])('retains a conflict draft and pauses Apply, including unavailable readback (%s)', async fail => {
		let failReadback = false;
		const r = await rig(undefined, { wrapQueries: queries => ({ ...queries, findZonesByPlan: id => failReadback ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id) }) });
		await open(r); await type(r); const before = await read(r);
		expectOk(await r.zonesRepo.save(expectOk(before.entity.withName('Peer')), before.version)); failReadback = fail;
		await apply(r); expect((await read(r)).entity.name).toBe('Peer');
		expect(r.harness.wrapper.get('input[name="name"]').element).toHaveProperty('value', '  Dining room  ');
		expect(r.harness.wrapper.text()).toContain(fail ? 'current room could not be read' : 'Latest saved name: Peer');
		expect(r.harness.wrapper.get(`${FORM} button`).attributes('aria-disabled')).toBe('true');
		await apply(r); expect(runtimeOf(r.harness).canUndo.value).toBe(false); await cancel(r); r.harness.unmount();
	});
	it('blocks duplicate/late submissions and busy cancellation without losing focus or input', async () => {
		const r = await rig(); await open(r); await type(r);
		const save = r.zonesRepo.save.bind(r.zonesRepo); let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		const spy = vi.spyOn(r.zonesRepo, 'save').mockImplementation(async (...args) => { await wait; return save(...args); });
		await apply(r); await apply(r); await cancel(r);
		await r.harness.wrapper.get('input[name="name"]').trigger('keydown', { key: 'Escape' }); await settle();
		await type(r, 'Too late'); expect(r.harness.wrapper.get('input[name="name"]').element).toHaveProperty('value', '  Dining room  ');
		expect(spy).toHaveBeenCalledTimes(1); expect(r.harness.wrapper.get('input[name="name"]').attributes('readonly')).toBeDefined();
		release(); await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'saved once'); r.harness.unmount();
	});
	it.each(['refusal', 'fault'] as const)('retains input after %s and retries only explicitly', async kind => {
		const r = await rig(); await open(r); await type(r);
		const spy = vi.spyOn(r.zonesRepo, 'save');
		if (kind === 'fault') spy.mockRejectedValueOnce(new Error('fault')); else spy.mockResolvedValueOnce(err(injectedPersistenceError()));
		await apply(r); expect(r.harness.wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(r.harness.wrapper.get('input[name="name"]').element).toHaveProperty('value', '  Dining room  ');
		useProjectStore(r.harness.pinia).stale = true; await apply(r); expect(spy).toHaveBeenCalledTimes(1);
		await runtimeOf(r.harness).refreshProjection(); await apply(r);
		await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'retry'); expect(spy).toHaveBeenCalledTimes(2); r.harness.unmount();
	});
	it('does not replay a confirmed write after readback fails', async () => {
		let fail = false;
		const r = await rig(undefined, { wrapQueries: queries => ({ ...queries, findZonesByPlan: id => fail ? Promise.resolve(err(injectedPersistenceError())) : queries.findZonesByPlan(id) }) });
		await open(r); await type(r); const spy = vi.spyOn(r.zonesRepo, 'save'); fail = true;
		await apply(r); await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'confirmed write');
		expect((await read(r)).entity.name).toBe('Dining room'); expect(useProjectStore(r.harness.pinia).stale).toBe(true);
		fail = false; await runtimeOf(r.harness).refreshProjection(); expect(spy).toHaveBeenCalledTimes(1); r.harness.unmount();
	});
	it('allows polygonal Rooms but offers no general Area metadata action', async () => {
		const r = await rig(async ({ zones }) => {
			const before = expectFound(await zones.getById('zone-a' as never));
			expectOk(await zones.save(makeZone({ ...before.entity, geometry: { points: ZONE_A_DTO.points.slice(0, 3) } }), before.version));
		});
		await open(r); await type(r); await apply(r); await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'polygon renamed');
		expect((await read(r)).entity.geometry.points).toHaveLength(3);
		const before = await read(r); expectOk(await r.zonesRepo.save(makeZone({ ...before.entity, zoneType: 'Custom' }), before.version));
		await runtimeOf(r.harness).refreshProjection(); expect(r.harness.wrapper.find('[data-rp-action="rename-room"]').exists()).toBe(false);
		await runtimeOf(r.harness).renameRoom('zone-a' as never); expect(r.harness.wrapper.find(FORM).exists()).toBe(false); r.harness.unmount();
	});
	it('refuses stale, saving and multiple entry', async () => {
		const r = await rig(); const runtime = runtimeOf(r.harness); const selection = useSelectionStore(r.harness.pinia);
		selection.select(['zone-a' as never, 'other' as never]); await runtime.renameRoom('zone-a' as never);
		selection.select(['zone-a' as never]); useProjectStore(r.harness.pinia).stale = true; await runtime.renameRoom('zone-a' as never);
		expect(runtime.renameRoomBlocked.value).toBe(true); useProjectStore(r.harness.pinia).stale = false;
		useSaveStateStore(r.harness.pinia).beginSaving(); await runtime.renameRoom('zone-a' as never);
		expect(r.harness.wrapper.find(FORM).exists()).toBe(false); r.harness.unmount();
	});
	it('retires delayed baseline reads when selection leaves and returns or the leaf closes', async () => {
		const r = await rig(); const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle();
		const baseline = await r.zonesRepo.getById('zone-a' as never); let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		const spy = vi.spyOn(r.zonesRepo, 'getById').mockImplementation(async () => { await wait; return baseline; });
		const pending = runtime.renameRoom('zone-a' as never); await runtime.renameRoom('zone-a' as never);
		expect(spy).toHaveBeenCalledTimes(1);
		const selection = useSelectionStore(r.harness.pinia); selection.clear(); selection.select(['zone-a' as never]);
		release(); await pending; await settle(); expect(r.harness.wrapper.find(FORM).exists()).toBe(false);
		const closing = runtime.renameRoom('zone-a' as never); r.harness.unmount(); await closing;
	});
	it.each(['missing', 'refusal', 'fault', 'different-plan'] as const)('does not open for a %s baseline', async kind => {
		const r = await rig(); const runtime = runtimeOf(r.harness); runtime.selectAndFrame('zone-a'); await settle(); const before = await read(r);
		const spy = vi.spyOn(r.zonesRepo, 'getById');
		if (kind === 'fault') spy.mockRejectedValueOnce(new Error('read failed'));
		else spy.mockResolvedValueOnce(kind === 'missing' ? ok(null) : kind === 'refusal' ? err(injectedPersistenceError()) : ok({ ...before, entity: makeZone({ ...before.entity, planId: 'different' as never }) }));
		await runtime.renameRoom('zone-a' as never); await settle(); expect(r.harness.wrapper.find(FORM).exists()).toBe(false);
		expect(runtime.renameRoomBlocked.value).toBe(false); r.harness.unmount();
	});
	it('a retired form cannot resolve its replacement after a late success', async () => {
		const r = await rig(); await open(r); await type(r); const save = r.zonesRepo.save.bind(r.zonesRepo);
		let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
		vi.spyOn(r.zonesRepo, 'save').mockImplementation(async (...args) => { await wait; return save(...args); });
		await apply(r); const dialogs = useDialogStore(r.harness.pinia); dialogs.resolve('cancel'); await settle();
		const replacement = dialogs.openDialog({ kind: 'confirm', title: 'Replacement', message: 'Still here' }); await settle();
		release(); await settleUntil(() => runtimeOf(r.harness).canUndo.value, 'late write');
		expect(dialogs.current).toMatchObject({ title: 'Replacement' }); dialogs.resolve('cancel'); await replacement; r.harness.unmount();
	});
});
