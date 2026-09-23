// @vitest-environment jsdom
/**
 * Choosing a PDF page other than page 1 through the real reference form, with the decode left
 * real: `loadBackground` is spied on and passes through, so pdf.js rasterises the page the form
 * named. The two pages of `TWO_PAGE_PDF` differ in size and colour, so each assertion reads
 * which page was decoded from the raster itself rather than from the argument it was asked for.
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
	// synthetic two-page one instead. Only a PDF load reaches `readBinary`.
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

const PAGE_2 = { width: 600, height: 300, rgba: [255, 0, 0, 255] };

describe('a PDF reference whose chosen page is not page 1', () => {
	it('decodes page 2 through the real form, commits page 2, and decodes page 2 again on reopening', async () => {
		const r = await rig(); await choosePage(r.harness, '2');
		expect(await lastDecoded(r.load)).toEqual(PAGE_2);

		await submit(r.harness);
		for (const [key, value] of Object.entries({ ax: '100', ay: '100', bx: '300', by: '100', length: '2' })) await field(r.harness, key, value);
		await submit(r.harness); await submit(r.harness);
		await settleUntil(() => !r.harness.wrapper.find(FORM).exists(), 'committed');
		expect(expectFound(await r.stack.plans.getById(r.plan.id)).entity.background).toMatchObject({ path: 'scan.pdf', kind: 'pdf', page: 2 });

		r.harness.unmount(); r.load.mockClear();
		await r.mount(); await settleUntil(() => r.load.mock.calls.some(([ref]) => ref !== null), 'the reopened editor loads its background');
		expect(await lastDecoded(r.load)).toEqual(PAGE_2);
	});

	it('refuses page 3 of a two-page PDF in the form, and draws no preview', async () => {
		const r = await rig(); await choosePage(r.harness, '3');
		expect(await lastDecoded(r.load)).toEqual({ kind: 'unavailable', reason: 'unreadable' });
		expect(r.harness.wrapper.text()).toContain('Cannot read this image or PDF page');
		expect(r.harness.wrapper.find('.rp-reference-preview').exists()).toBe(false);
	});
});
