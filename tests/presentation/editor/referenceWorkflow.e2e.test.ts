import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import axe from 'axe-core';
import { runOptions } from '../../harness/axeOptions';
import ReferencePreview from '../../../src/presentation/editor/reference/ReferencePreview.vue';
import ReferencePrepare from '../../../src/presentation/editor/reference/ReferencePrepare.vue';
import { previewTransform } from '../../../src/presentation/editor/reference/referenceSetup';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { markUncompensated } from '../../../src/application/commands/DispatchOutcome';
import { installObsidianDom } from '../../helpers/dom';
import { resizeTo } from '../../helpers/layout';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defer } from '../../helpers/async';
import { mountPlanEditor, runtimeOf, settle, settleUntil } from '../../helpers/editor';
import { harnessDeps, HARNESS_PLAN } from '../../harness/planEditor';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { err } from '../../../src/core/result/Result';
import * as backgrounds from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { BackgroundRenderModel } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { makeZone } from '../../helpers/entities';
import { WALL_LOOP } from '../../helpers/structure';
import { installCanvas } from '../../helpers/canvas';

beforeEach(() => { installObsidianDom(); activateNotices(); });
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });
async function rig(worldScale = 1) {
	installCanvas();
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN); await workspace.ready;
	const image = document.createElement('canvas'); image.width = 800; image.height = 600;
	const raster = { kind: 'raster', image, width: 800, height: 600, worldOrigin: { x: 0, y: 0 }, worldScale } as const;
	const load = vi.spyOn(backgrounds, 'loadBackground').mockImplementation(source => Promise.resolve(source === null ? { kind: 'none' } : raster));
	const harness = await mountPlanEditor({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
	mounted.push(harness);
	return { ...workspace, harness, load, raster };
}
type Rig = Awaited<ReturnType<typeof rig>>;
const FORM = '[data-rp-form="reference"]';
async function open(r: Rig) {
	const button = expectDefined(r.harness.wrapper.findAll('[data-rp-action="reference"]')[0], 'reference action');
	(button.element as HTMLElement).focus(); await button.trigger('click');
	await settleUntil(() => r.harness.wrapper.find(FORM).exists(), 'reference form');
}
async function field(r: Rig, name: string, value: string) { await r.harness.wrapper.get(`${FORM} input[name="${name}"]`).setValue(value); }
async function submit(r: Rig) { await r.harness.wrapper.get(FORM).trigger('submit'); await settle(); }
async function prepare(r: Rig, source = 'scan.png') {
	await field(r, 'source', source); await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
}
async function measure(r: Rig) {
	await submit(r);
	for (const [key, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) await field(r, key, value);
	await submit(r);
}
async function cancel(r: Rig) { await r.harness.wrapper.get('.rp-dialog [data-rp-action="cancel"]').trigger('click'); await settle(); }

describe('M05 → M06 in the real editor with FakeVault repository commands', () => {
	it.each([
		{ region: 'layers', rail: 'layers', from: 1440, to: 460 },
		{ region: 'inspector', rail: 'details', from: 1440, to: 460 },
		{ region: 'layers', rail: 'layers', from: 460, to: 1440 },
		{ region: 'inspector', rail: 'details', from: 460, to: 1440 },
		{ region: 'layers', rail: 'layers', from: 1440, to: 300 },
		{ region: 'inspector', rail: 'details', from: 1440, to: 300 },
	])('returns Reference focus from $region after $from → $to reflow without applying the draft', async ({ region, rail, from, to }) => {
		const r = await rig(); resizeTo(r.harness.rootEl, from, 900); await settle();
		if (from === 460) r.harness.wrapper.get<HTMLButtonElement>(`[data-rp-rail="${rail}"]`).element.click();
		await settle();
		const opener = r.harness.wrapper.get<HTMLButtonElement>(`[data-rp-shell-region="${region}"] [data-rp-action="reference"]`).element;
		opener.focus(); opener.click(); await settleUntil(() => r.harness.wrapper.find(FORM).exists(), 'native Reference open');
		const source = r.harness.wrapper.get<HTMLInputElement>(`${FORM} input[name="source"]`);
		await source.setValue('retained-draft.png'); source.element.focus();
		const bytes = [...r.stack.vault.entries], run = vi.spyOn(runtimeOf(r.harness).dispatcher, 'run');
		resizeTo(r.harness.rootEl, to, 900); await settle();
		expect(source.element.value).toBe('retained-draft.png'); expect(document.activeElement).toBe(source.element);
		source.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
		expect(r.harness.wrapper.find(FORM).exists()).toBe(false);
		const target = to === 300 ? r.harness.wrapper.get('.rp-unsupported-width__action').element
			: to === 460 ? r.harness.wrapper.get(`[data-rp-rail="${rail}"]`).element : opener;
		expect(document.activeElement).toBe(target); expect(target.isConnected).toBe(true);
		expect(run).not.toHaveBeenCalled(); expect([...r.stack.vault.entries]).toEqual(bytes);
	});
	it('uses one geometry calibration snapshot and requests consent on a wall-only floor', async () => {
		const r = await rig();
		const before = expectOk(await r.geometry.read(r.plan.id));
		const document = { ...before.document, structure: WALL_LOOP, calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 200, y: 0 }, knownDistance: 200, pixelsPerWorldUnit: 0.5 } };
		expectOk(await r.geometry.write(r.plan.id, document, before.version));
		const baseline = expectOk(await r.services.read(r.plan.id));
		const stalePlan = expectOk(baseline.plan.entity.withCalibration({ pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 100, pixelsPerWorldUnit: 1 }));
		vi.spyOn(r.services, 'read').mockResolvedValueOnce({ ok: true, value: { ...baseline, plan: { ...baseline.plan, entity: stalePlan } } });
		await open(r); await prepare(r); await measure(r);
		await submit(r); expect(r.harness.wrapper.text()).toContain('Confirm the effect');
		await r.harness.wrapper.get('input[name="consent"]').setValue(true); await submit(r);
		expect(expectOk(await r.geometry.read(r.plan.id)).document.structure?.walls[0].end.x).toBe(20000);
		r.harness.unmount();
	});
	it('normalizes source paths for preview, dispatch and change invalidation', async () => {
		const r = await rig(); await open(r); await prepare(r, ' /scan.png ');
		expect(r.load).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'scan.png' }), expect.anything());
		r.harness.changeFile('scan.png'); await settle(); expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(false);
		await prepare(r, ' /scan.png '); await measure(r); await submit(r);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background?.path).toBe('scan.png');
		r.harness.unmount();
	});
	it('offers three query-derived starts, dismisses and hides onboarding during Room creation', async () => {
		const r = await rig(); const start = r.harness.wrapper.get('[data-rp-empty="floor-start"]');
		expect(start.text()).toContain('Add rooms'); expect(start.text()).toContain('Upload a floor plan'); expect(start.text()).toContain('Start empty');
		await expectDefined(start.findAll('button')[2], 'empty button').trigger('click'); expect(r.harness.wrapper.find('[data-rp-empty="floor-start"]').exists()).toBe(false); expect(document.activeElement).toBe(r.harness.canvasEl); r.harness.unmount();
		const q = await rig(); await expectDefined(q.harness.wrapper.get('[data-rp-empty="floor-start"]').findAll('button')[0], 'room button').trigger('click');
		expect(runtimeOf(q.harness).activeToolId.value).toBe('draw-room'); expect(q.harness.wrapper.find('[data-rp-empty="floor-start"]').exists()).toBe(false); expect(document.activeElement).toBe(q.harness.canvasEl); q.harness.unmount();
	});
	it.each([{ source: 'scan.png', worldScale: 1, page: undefined }, { source: 'scan.pdf', worldScale: 25.4 / 72 / 2, page: 1 }])('prepares, measures and commits $source, then Undo/Redo and reconfiguration preserve it', async ({ source, worldScale, page }) => {
		const r = await rig(worldScale); await open(r); const before = new Map(r.stack.vault.entries);
		await prepare(r, source); await field(r, 'crop-x', '20'); await field(r, 'crop-width', '700'); await field(r, 'rotation', '90');
		await measure(r); expect(new Map(r.stack.vault.entries)).toEqual(before);
		expect(r.harness.wrapper.text()).toContain('10 mm per source pixel'); await submit(r);
		await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'finished');
		const plan = expectFound(await r.stack.plans.getById(r.plan.id)).entity;
		expect(plan.background).toMatchObject({ path: source, appearance: { rotation: 90, visible: true, locked: true, crop: { x: 20, width: 700 } } });
		expect(plan.calibration?.pixelsPerWorldUnit).toBeCloseTo(worldScale / 10);
		expect(plan.background?.page).toBe(page);
		expect(document.activeElement).toBe(expectDefined(r.harness.wrapper.findAll('[data-rp-action="reference"]')[0], 'reference action').element);
		const runtime = runtimeOf(r.harness); await runtime.undo(); expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toBeNull();
		await runtime.redo(); expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toEqual(plan.background);
		await open(r); await settle(); expect(r.harness.wrapper.get('input[name="rotation"]').element).toHaveProperty('value', '90');
		await submit(r); expect(r.harness.wrapper.get('input[name="length"]').element).toHaveProperty('value', '2');
		await cancel(r); r.harness.unmount(); expect(r.harness.fileListeners()).toBe(0);
	});
	it('preserves the committed reference when replacement is cancelled, including page changes and another distance', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r); await submit(r);
		const before = new Map(r.stack.vault.entries); await open(r); await prepare(r, 'scan.pdf'); await field(r, 'page', '2');
		await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
		expect(r.load).toHaveBeenLastCalledWith({ path: 'scan.pdf', kind: 'pdf', page: 2 }, expect.anything());
		await measure(r); await r.harness.wrapper.get(`${FORM} [data-rp-reference-action="back"]`).trigger('click'); await settle();
		await r.harness.wrapper.get(`${FORM} [data-rp-reference-action="another-distance"]`).trigger('click');
		expect(r.harness.wrapper.get('input[name="length"]').element).toHaveProperty('value', '');
		expect(r.harness.wrapper.find('canvas.rp-reference-preview').exists()).toBe(true);
		await cancel(r); expect(new Map(r.stack.vault.entries)).toEqual(before); r.harness.unmount();
	});
	it('requires explicit acknowledgement before rescaling existing geometry', async () => {
		const r = await rig(); const zone = makeZone({ planId: r.plan.id, projectId: r.plan.projectId }); expectOk(await r.stack.zones.save(zone, 'absent'));
		await runtimeOf(r.harness).refreshProjection(); await open(r); await prepare(r); await measure(r); await submit(r);
		expect(r.harness.wrapper.text()).toContain('Confirm the effect');
		await r.harness.wrapper.get('input[name="consent"]').setValue(true); await submit(r);
		expect(expectFound(await r.stack.zones.getById(zone.id)).entity.geometry.points[0]?.x).toBe(expectDefined(zone.geometry.points[0], 'point').x * 10); r.harness.unmount();
	});
	it('retains invalid source, crop and scale input, and accepts corrections', async () => {
		const r = await rig(); await open(r); await prepare(r, 'bad.txt'); expect(r.harness.wrapper.text()).toContain('PNG, JPEG or PDF');
		await submit(r); expect(r.harness.wrapper.text()).toContain('positive crop');
		await prepare(r); await field(r, 'crop-width', '900'); await submit(r); expect(r.harness.wrapper.text()).toContain('positive crop');
		await field(r, 'crop-width', '800'); await submit(r); await submit(r); expect(r.harness.wrapper.text()).toContain('two different points');
		for (const [key, value] of Object.entries({ ax: '0', ay: '0', bx: '0', by: '0', length: '0' })) await field(r, key, value);
		await submit(r); expect(r.harness.wrapper.text()).toContain('two different points'); await field(r, 'bx', '900'); await field(r, 'length', '2'); await submit(r);
		expect(r.harness.wrapper.text()).toContain('two different points'); await cancel(r); r.harness.unmount();
	});
	it.each(['missing', 'unreadable'] as const)('offers retry after %s source and invalidates a changed source', async reason => {
		const r = await rig(); await open(r); r.load.mockResolvedValueOnce({ kind: 'unavailable', reason }); await prepare(r);
		expect(r.harness.wrapper.text()).toContain(reason === 'missing' ? 'missing' : 'Cannot read');
		await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle(); expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(true);
		r.harness.changeFile('other.png'); expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(true);
		r.harness.changeFile('scan.png'); await settle(); expect(r.harness.wrapper.text()).toContain('source changed');
		await cancel(r); r.harness.unmount();
	});
	it('owns native keys and preserves draft and focus while the shell changes width', async () => {
		const r = await rig(); await open(r); const source = r.harness.wrapper.get('input[name="source"]'); await source.setValue('draft.png');
		for (const key of ['Delete', 'Backspace', 'z', ' ']) await source.trigger('keydown', { key });
		resizeTo(r.harness.rootEl, 460, 700); await settle(); expect(source.element).toHaveProperty('value', 'draft.png');
		(source.element as HTMLElement).focus(); await source.trigger('keydown', { key: 'Enter', repeat: true });
		expect(r.harness.wrapper.find(FORM).exists()).toBe(true); await source.trigger('keydown', { key: 'Escape' }); await settle();
		expect(r.harness.wrapper.find(FORM).exists()).toBe(false); r.harness.unmount();
	});
	it('blocks duplicates and cancellation while saving, and retains the form on persistence refusal', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		let resolve!: (value: Awaited<ReturnType<Rig['geometry']['write']>>) => void;
		vi.spyOn(r.geometry, 'write').mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
		await r.harness.wrapper.get(FORM).trigger('submit'); await settle();
		const version = expectFound(await r.stack.plans.getById(r.plan.id)).version;
		await submit(r); await cancel(r); expect(r.harness.wrapper.find(FORM).exists()).toBe(true);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).version).toEqual(version);
		resolve(err(injectedPersistenceError())); await settle(); expect(r.harness.wrapper.find(FORM).exists()).toBe(true);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toBeNull(); await cancel(r); r.harness.unmount();
	});
	it('pauses on stale projection and version conflicts without discarding the draft', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		const store = useProjectStore(r.harness.pinia); store.stale = true; await submit(r); expect(r.harness.wrapper.find(FORM).exists()).toBe(true);
		store.stale = false;
		const baseline = expectFound(await r.stack.plans.getById(r.plan.id)); expectOk(await r.stack.plans.save(baseline.entity, baseline.version));
		await submit(r); expect(r.harness.wrapper.text()).toContain('paused');
		const before = new Map(r.stack.vault.entries); await submit(r); expect(new Map(r.stack.vault.entries)).toEqual(before); await cancel(r); r.harness.unmount();
	});
	it('ignores late loading responses after source change, cancellation and leaf disposal', async () => {
		const r = await rig(); await open(r); let resolve!: (value: BackgroundRenderModel) => void;
		r.load.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; })); await prepare(r); await field(r, 'source', 'scan.pdf'); resolve(r.raster); await settle();
		expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(false);
		r.load.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; })); await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click');
		await cancel(r); resolve(r.raster); await settle(); expect(useDialogStore(r.harness.pinia).current).toBeNull();
		await open(r); r.harness.unmount(); expect(r.harness.fileListeners()).toBe(0);
	});
	it.each([1280, 460])('keeps every setup step accessible at %i px', async width => {
		const r = await rig(); resizeTo(r.harness.rootEl, width, 700); await open(r);
		expect((await axe.run(r.harness.rootEl, runOptions)).violations).toEqual([]);
		await prepare(r); await submit(r); expect((await axe.run(r.harness.rootEl, runOptions)).violations).toEqual([]);
		for (const [key, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) await field(r, key, value);
		await submit(r); expect((await axe.run(r.harness.rootEl, runOptions)).violations).toEqual([]); await cancel(r); r.harness.unmount();
	});
	it('accepts pointer endpoints, persists hidden/unlocked appearance and seeds layer visibility on refresh', async () => {
		const r = await rig(); await open(r); await prepare(r); await submit(r);
		const canvas = r.harness.wrapper.get('.rp-reference-preview');
		vi.spyOn(canvas.element, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 220, width: 400, height: 220, toJSON: () => ({}) });
		const fit = previewTransform({ crop: { x: 0, y: 0, width: 800, height: 600 }, rotation: 0, opacity: 1, visible: true, locked: true });
		await canvas.trigger('click', { clientX: fit.x + 100 * fit.scale, clientY: fit.y + 100 * fit.scale });
		await canvas.trigger('click', { clientX: fit.x + 300 * fit.scale, clientY: fit.y + 100 * fit.scale });
		await canvas.trigger('click', { clientX: -40, clientY: -40 });
		expect(r.harness.wrapper.get('input[name="ax"]').element).toHaveProperty('value', '100');
		await field(r, 'length', '2'); await submit(r);
		await r.harness.wrapper.get('input[name="locked"]').setValue(false); await r.harness.wrapper.get('input[name="visible"]').setValue(false);
		expect(r.harness.wrapper.text()).toContain('Position changes'); await submit(r);
		expect(useWorkspaceStore(r.harness.pinia).layerVisibility.background).toBe(false);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background?.appearance).toMatchObject({ visible: false, locked: false }); r.harness.unmount();
	});
	it('ignores duplicate baseline opens and retires late reads when another tool takes ownership', async () => {
		const r = await rig(), original = r.services.read.bind(r.services); let resolve!: (value: Awaited<ReturnType<typeof original>>) => void;
		const read = vi.spyOn(r.services, 'read').mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; }));
		const runtime = runtimeOf(r.harness), opened = runtime.openReference(); await runtime.openReference(); expect(read).toHaveBeenCalledTimes(1);
		runtime.setTool('draw-polygon'); resolve(await original(r.plan.id)); await opened;
		expect(r.harness.wrapper.find(FORM).exists()).toBe(false);
		read.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; })); const pending = runtime.openReference(); r.harness.unmount();
		resolve(await original(r.plan.id)); await pending; expect(useDialogStore(r.harness.pinia).current).toBeNull();
	});
	it('reports baseline and source faults and releases their busy states for retry', async () => {
		const r = await rig(); vi.spyOn(r.services, 'read').mockResolvedValueOnce(err(injectedPersistenceError()));
		await runtimeOf(r.harness).openReference(); expect(runtimeOf(r.harness).referenceActive.value).toBe(false);
		vi.spyOn(r.services, 'read').mockRejectedValueOnce(new Error('read fault')); await runtimeOf(r.harness).openReference();
		await open(r); r.load.mockRejectedValueOnce(new Error('decode fault')); await prepare(r); expect(r.harness.wrapper.text()).toContain('Cannot read');
		await prepare(r); await cancel(r); r.harness.unmount();
	});
	it('announces uncompensated writes through the existing save-state recovery warning', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		vi.spyOn(r.services, 'command').mockReturnValue({ execute: () => Promise.resolve(err(markUncompensated(injectedPersistenceError()))), undo: () => Promise.resolve(err(injectedPersistenceError())) });
		await submit(r); expect(useSaveStateStore(r.harness.pinia).unrecoveredWrite).toBe(true); await cancel(r); r.harness.unmount();
	});
	it('finishes an already authorized transaction after leaf disposal without opening a retired dialog', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		const original = r.geometry.write.bind(r.geometry); let finish!: () => void;
		vi.spyOn(r.geometry, 'write').mockImplementationOnce((...args) => new Promise(_resolve => { finish = () => { void original(...args).then(_resolve); }; }));
		await r.harness.wrapper.get(FORM).trigger('submit'); await settle(); r.harness.unmount(); finish(); await settle();
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.calibration).not.toBeNull();
		expect(useDialogStore(r.harness.pinia).current).toBeNull(); expect(r.harness.fileListeners()).toBe(0);
	});

	it('offers supported vault sources and keeps source text under native keyboard ownership', async () => {
		const r = await rig(); Object.assign(r.deps.vault, { getFiles: () => [{ path: 'scan.png' }, { path: 'notes.md' }, { path: 'scan.pdf' }] });
		await open(r); expect(r.harness.wrapper.findAll('datalist option').map(o => o.attributes('value'))).toEqual(['scan.png', 'scan.pdf']);
		const source = r.harness.wrapper.get('input[name="source"]');
		for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...modifier }); source.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
		}
		await cancel(r); r.harness.unmount();
	});
	it('keeps paused controls focusable, refuses mutation keys and permits native Tab and Escape', async () => {
		const r = await rig(), store = useProjectStore(r.harness.pinia); store.stale = true;
		await r.harness.wrapper.get('.rp-floor-start .rp-empty-state__action').trigger('click'); expect(runtimeOf(r.harness).activeToolId.value).toBe('select');
		store.stale = false; await open(r); await prepare(r, 'scan.pdf'); await measure(r);
		const opacity = r.harness.wrapper.get('input[name="opacity"]'); await opacity.setValue('0.3');
		await r.harness.wrapper.get('input[name="locked"]').trigger('click'); await r.harness.wrapper.get('input[name="visible"]').trigger('click');
		expect(r.harness.wrapper.text()).toContain('Position changes');
		store.stale = true; await settle(); (opacity.element as HTMLElement).focus();
		for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); opacity.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
		}
		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); opacity.element.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
		const pointer = new MouseEvent('pointerdown', { bubbles: true, cancelable: true }); opacity.element.dispatchEvent(pointer); expect(pointer.defaultPrevented).toBe(true);
		const locked = r.harness.wrapper.get('input[name="locked"]'), before = (locked.element as HTMLInputElement).checked;
		await locked.trigger('click'); expect((locked.element as HTMLInputElement).checked).toBe(before); expect(locked.attributes('disabled')).toBeUndefined();
		await r.harness.wrapper.get(`${FORM} [data-rp-reference-action="back"]`).trigger('click'); expect(r.harness.wrapper.text()).toContain('Review reference');
		await cancel(r); r.harness.unmount();
	});
	it('refuses a second source load while decoding and preview clicks outside measurement mode', async () => {
		const r = await rig(); await open(r); let resolve!: (value: BackgroundRenderModel) => void;
		r.load.mockImplementationOnce(() => new Promise(_resolve => { resolve = _resolve; })); await prepare(r);
		const calls = r.load.mock.calls.length; await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); expect(r.load).toHaveBeenCalledTimes(calls);
		resolve(r.raster); await settle(); await r.harness.wrapper.get('.rp-reference-preview').trigger('click', { clientX: 0, clientY: 0 });
		await submit(r); expect(r.harness.wrapper.get('input[name="ax"]').element).toHaveProperty('value', ''); await cancel(r); r.harness.unmount();
	});
	it('retains the prepared draft after an unexpected dispatch fault and allows retry', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		vi.spyOn(r.services, 'command').mockImplementationOnce(() => { throw new Error('command fault'); });
		await submit(r); expect(r.harness.wrapper.text()).toContain('Reference setup failed');
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toBeNull();
		await submit(r); expect(r.harness.wrapper.find(FORM).exists()).toBe(false); r.harness.unmount();
	});
	it('refuses the last dispatch when another selection took ownership, and suppresses retired baseline faults', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		useSelectionStore(r.harness.pinia).select(['other' as never]); await submit(r);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toBeNull(); await cancel(r);
		let reject!: (cause: Error) => void; vi.spyOn(r.services, 'read').mockImplementationOnce(() => new Promise((_resolve, _reject) => { reject = _reject; }));
		const opened = runtimeOf(r.harness).openReference(); r.harness.unmount(); reject(new Error('retired')); await opened;
		expect(useDialogStore(r.harness.pinia).current).toBeNull();
	});

	it('withdraws the scale review after its source changes and refuses to persist an invalid preview', async () => {
		const r = await rig(); await open(r); await prepare(r); await measure(r);
		expect(r.harness.wrapper.text()).toContain('10 mm per source pixel');
		r.harness.changeFile('scan.png'); await settle();
		expect(r.harness.wrapper.text()).not.toContain('10 mm per source pixel');
		expect(r.harness.wrapper.text()).not.toContain('1 mm per source pixel');
		await submit(r); expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toBeNull(); await cancel(r); r.harness.unmount();
	});
	it('normalizes a vault-relative spelling once, so the canonical path invalidates the draft and is what persists', async () => {
		// Vault events carry `TFile.path`, the canonical spelling; the draft compared its raw text.
		const r = await rig(); await open(r); await prepare(r, '/scan.png');
		r.harness.changeFile('scan.png'); await settle(); expect(r.harness.wrapper.text()).toContain('source changed');
		await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
		await measure(r); await submit(r);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background?.path).toBe('scan.png');
		r.harness.unmount();
	});
	it('does not move focus to a disposed canvas after a start choice', async () => {
		const r = await rig(); const pending = r.harness.wrapper.get('.rp-floor-start button:last-child').trigger('click'); r.harness.unmount(); await pending;
		expect(document.activeElement).not.toBe(r.harness.canvasEl);
	});
	it('refuses a late preview point when the floor becomes stale before child props update', async () => {
		const r = await rig(); await open(r); await prepare(r); await submit(r);
		await field(r, 'ax', '100'); await field(r, 'ay', '100'); await field(r, 'bx', '300'); await field(r, 'by', '100');
		const before = [...r.stack.vault.entries], store = useProjectStore(r.harness.pinia), preview = r.harness.wrapper.getComponent(ReferencePreview);
		store.stale = true; preview.vm.$emit('point', { x: 500, y: 500 }); await settle();
		expect(r.harness.wrapper.get('[name="ax"]').element).toHaveProperty('value', '100');
		expect(r.harness.wrapper.get('[name="ay"]').element).toHaveProperty('value', '100');
		store.stale = false; await settle(); preview.vm.$emit('point', { x: 500, y: 500 }); await settle();
		expect(r.harness.wrapper.get('[name="ax"]').element).toHaveProperty('value', '500'); expect([...r.stack.vault.entries]).toEqual(before);
		await cancel(r);
	});
	it('does not focus a retired heading when the modal is disposed during a setup-step transition', async () => {
		const r = await rig(); await open(r); await prepare(r); const before = [...r.stack.vault.entries];
		const transition = r.harness.wrapper.get(FORM).trigger('submit'); r.harness.unmount(); await transition;
		expect(r.harness.fileListeners()).toBe(0); expect(r.harness.canvasEl?.isConnected).toBe(false);
		expect([...r.stack.vault.entries]).toEqual(before);
	});

	it('applies a crop replacement emitted directly by the source form, covering the model bridge', async () => {
		const r = await rig(); await open(r); await prepare(r);
		const prepareForm = r.harness.wrapper.getComponent(ReferencePrepare);
		prepareForm.vm.$emit('update:crop', { x: 5, y: 5, width: 750, height: 550 });
		await settle();
		expect(r.harness.wrapper.get('input[name="crop-x"]').element).toHaveProperty('value', '5');
		expect(r.harness.wrapper.get('input[name="crop-width"]').element).toHaveProperty('value', '750');
		await cancel(r); r.harness.unmount();
	});

});


it('does not recreate reference error UI when an in-flight final dispatch rejects after leaf disposal', async () => {
	const r = await rig(); await open(r); await prepare(r); await measure(r);
	const before = [...r.stack.vault.entries], pending = defer<void>();
	const run = vi.spyOn(runtimeOf(r.harness).dispatcher, 'run').mockImplementationOnce(async () => { await pending.promise; throw new Error('retired reference dispatch'); });
	await submit(r); expect(run).toHaveBeenCalledOnce();
	mounted.splice(mounted.indexOf(r.harness), 1); r.harness.unmount(); pending.resolve(); await settle();
	expect(r.harness.wrapper.element.isConnected).toBe(false); expect([...r.stack.vault.entries]).toEqual(before);
	expect(useDialogStore(r.harness.pinia).current).toBeNull();
});
