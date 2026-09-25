// @vitest-environment jsdom
/**
 * Choosing a PDF page other than page 1 through the real reference form, with the decode left
 * real: `loadBackground` is spied on and passes through, so pdf.js rasterises the page the form
 * named. The two pages of `TWO_PAGE_PDF` differ in size and colour, so which page was decoded is
 * read from the raster itself rather than from the argument `loadBackground` was asked for.
 *
 * The pdf.js here is the suite's `pdfjs-dist`, handed back by the obsidian mock's `loadPdfJs`;
 * production runs Obsidian's copy, which nothing in this file reaches.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installCanvas, backingCanvas } from '../../helpers/canvas';
import { mountPlanEditor, settle, settleUntil } from '../../helpers/editor';
import { harnessDeps, HARNESS_PLAN } from '../../harness/planEditor';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { expectDefined, expectFound } from '../../helpers/domain';
import { pdfFixture, TWO_PAGE_PDF } from '../../helpers/backgroundFixtures';
import * as backgrounds from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';

beforeEach(() => { installObsidianDom(); activateNotices(); });
const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const harness of mounted.splice(0)) harness.unmount(); });

const FORM = '[data-rp-form="reference"]';

async function rig() {
	installCanvas();
	const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN); await workspace.ready;
	// The workspace fetches `scan.pdf` from the committed one-page fixture; this serves the
	// synthetic two-page one instead.
	const bytes = pdfFixture(TWO_PAGE_PDF);
	workspace.deps.vault.readBinary = () => Promise.resolve(bytes.slice().buffer);
	const load = vi.spyOn(backgrounds, 'loadBackground');
	const mount = async () => {
		const harness = await mountPlanEditor({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands: workspace.deps.commands, vault: workspace.deps.vault });
		mounted.push(harness);
		return harness;
	};
	return { ...workspace, load, mount, harness: await mount() };
}
type Harness = Awaited<ReturnType<typeof mountPlanEditor>>;

/**
 * What the most recent non-null load decoded: its size, and the colour where page 2's rectangle
 * centre (PDF (50,40), y bottom-up) falls when the raster is read as page 2. A decoded page 1
 * answers 400×200 and blue there, so both halves tell the pages apart.
 */
async function lastDecoded(load: MockInstance<typeof backgrounds.loadBackground>) {
	const index = load.mock.calls.findLastIndex(([ref]) => ref !== null);
	const model = await expectDefined(load.mock.results[index], 'a background load').value as backgrounds.BackgroundRenderModel;
	if (model.kind !== 'raster') return model;
	const page2 = TWO_PAGE_PDF[1], scale = model.width / page2.width;
	const pixel = backingCanvas(model.image as HTMLCanvasElement)?.getContext('2d').getImageData(Math.round(50 * scale), Math.round((page2.height - 40) * scale), 1, 1).data;
	return { width: model.width, height: model.height, rgba: [...(pixel ?? [])] };
}

async function field(harness: Harness, name: string, value: string) { await harness.wrapper.get(`${FORM} input[name="${name}"]`).setValue(value); }
async function submit(harness: Harness) { await harness.wrapper.get(FORM).trigger('submit'); await settle(); }
async function choosePage(harness: Harness, page: string) {
	const button = expectDefined(harness.wrapper.findAll('[data-rp-action="reference"]')[0], 'reference action');
	await button.trigger('click'); await settleUntil(() => harness.wrapper.find(FORM).exists(), 'reference form');
	await field(harness, 'source', 'scan.pdf'); await settle(); await field(harness, 'page', page);
	await harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
}

/** Prepare, measure and finish over whatever the open form has loaded, until the form closes. */
async function commitMeasured(harness: Harness) {
	await submit(harness);
	for (const [key, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) await field(harness, key, value);
	await submit(harness); await submit(harness);
	await settleUntil(() => !harness.wrapper.find(FORM).exists(), 'committed');
}
/** The vault operations since `from` that change something — every one but a read. */
const writesSince = (r: Awaited<ReturnType<typeof rig>>, from: number) => r.stack.vault.operations.slice(from).filter(op => !op.startsWith('read:'));

const PAGE_2 = { width: 600, height: 300, rgba: [255, 0, 0, 255] };

/**
 * A04's error half, by whichever door `leave` takes: page 2 committed, page 3 refused, the form
 * left — and nothing written, the committed reference whole.
 */
async function leaveRefusedOverCommitted(leave: (r: Awaited<ReturnType<typeof rig>>) => Promise<void>) {
	const r = await rig(); await choosePage(r.harness, '2');
	// Waited for, not assumed: run alone, the first pdf.js decode outlasts `choosePage`'s settle
	// and the Continue press is refused while it loads.
	await settleUntil(() => r.harness.wrapper.find('.rp-reference-preview').exists(), 'the page-2 preview');
	// Both instruments see a write when there is one — the commit's own. `compose` is the
	// synchronous one: a write the form starts on its way out composes its command while the
	// leaving press runs. `writesSince` misses a write deferred past `settleUntil`'s last round.
	const compose = vi.spyOn(r.services, 'command'), committing = r.stack.vault.operations.length;
	await commitMeasured(r.harness);
	expect(compose).toHaveBeenCalled(); expect(writesSince(r, committing)).not.toEqual([]);
	const committed = expectFound(await r.stack.plans.getById(r.plan.id));
	expect(committed.entity.background).toMatchObject({ path: 'scan.pdf', kind: 'pdf', page: 2 });
	const geometry = await r.geometry.read(r.plan.id), from = r.stack.vault.operations.length; compose.mockClear();

	await choosePage(r.harness, '3');
	expect(await lastDecoded(r.load)).toEqual({ kind: 'unavailable', reason: 'unreadable' });
	expect(r.harness.wrapper.text()).toContain('Cannot read this image or PDF page');
	const decodes = r.load.mock.calls.length;
	await leave(r);
	await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'left');

	expect(compose).not.toHaveBeenCalled(); expect(writesSince(r, from)).toEqual([]);
	expect(await r.stack.plans.getById(r.plan.id)).toEqual({ ok: true, value: committed });
	expect(await r.geometry.read(r.plan.id)).toEqual(geometry);
	expect(r.load.mock.calls.slice(decodes)).toEqual([]);
}

describe('a PDF reference whose chosen page is not page 1', () => {
	it('decodes page 2 through the real form, commits page 2, and decodes page 2 again on reopening', async () => {
		const r = await rig(); await choosePage(r.harness, '2');
		expect(await lastDecoded(r.load)).toEqual(PAGE_2);

		await commitMeasured(r.harness);
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toMatchObject({ path: 'scan.pdf', kind: 'pdf', page: 2 });

		r.harness.unmount(); r.load.mockClear();
		await r.mount(); await settleUntil(() => r.load.mock.calls.some(([ref]) => ref !== null), 'the reopened editor loads its background');
		expect(await lastDecoded(r.load)).toEqual(PAGE_2);
	});

	it('refuses page 3 of a two-page PDF after page 2 drew, and leaves no preview behind', async () => {
		const r = await rig(); await choosePage(r.harness, '2');
		await settleUntil(() => r.harness.wrapper.find('.rp-reference-preview').exists(), 'the page-2 preview');
		await field(r.harness, 'page', '3'); await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
		expect(await lastDecoded(r.load)).toEqual({ kind: 'unavailable', reason: 'unreadable' });
		expect(r.harness.wrapper.text()).toContain('Cannot read this image or PDF page');
		expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(false);
	});

	// A04's error half: a refused page over a COMMITTED reference, left by the Cancel a user presses.
	it('leaves a committed page-2 reference unchanged when page 3 is refused and the form is cancelled', () =>
		leaveRefusedOverCommitted(r => {
			const cancel = r.harness.wrapper.get('[data-rp-action="cancel"]');
			expect(cancel.attributes('aria-disabled')).toBe('false');
			return cancel.trigger('click');
		}));

	// BP-06: the same, left by Escape. `DialogHost` focused the form's first control on opening and
	// nothing since moved it, so the press lands on the source field and bubbles to `.rp-dialog`.
	it('leaves a committed page-2 reference unchanged when page 3 is refused and the form is left by Escape', () =>
		leaveRefusedOverCommitted(async r => {
			const focused = r.harness.wrapper.get(`${FORM} input[name="source"]`).element;
			expect(document.activeElement).toBe(focused);
			focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
		}));

	// R-S18-12: the SAME source and page reloaded after a success, the reload failing. No
	// watcher fires for that, so only the failed-load branch's own `raster.value = null` clears it.
	it('drops the page-2 preview when reloading the same page fails', async () => {
		const r = await rig(); await choosePage(r.harness, '2');
		await settleUntil(() => r.harness.wrapper.find('.rp-reference-preview').exists(), 'the page-2 preview');
		r.deps.vault.readBinary = () => Promise.reject(new Error('the file went away mid-read'));
		await r.harness.wrapper.get('[data-rp-action="load-reference"]').trigger('click'); await settle();
		expect(await lastDecoded(r.load)).toEqual({ kind: 'unavailable', reason: 'unreadable' });
		expect(r.harness.wrapper.text()).toContain('Cannot read this image or PDF page');
		expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(false);
	});
});
