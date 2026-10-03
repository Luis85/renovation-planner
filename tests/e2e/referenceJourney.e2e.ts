import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type Konva from 'konva';
import { describe, expect } from 'vitest';
import { en, type StringKey } from '../../src/presentation/i18n/locales/en';
import { pdfFixture, TWO_PAGE_PDF } from '../helpers/backgroundFixtures';
import { test } from './fixture';
import { logEvidence } from './diagnostics';
import { setWindowSize } from './helpers';
import { readSidecar, saveLabel, sidecarPath, type StoredPoint } from './canvas';
import { EDITOR, openPlan, reloadPlugin, seedProjectWithPlan, seedSampleProject, textOf, type Ui } from './planner';
import { FIXTURE_PNG } from './recovery';
import { mobileEmulation, type NativeBrowser } from './session';

/**
 * BP-06 in the real host: the three starts on an empty floor (`FloorStart.vue`), and the reference
 * flow of `docs/tests/cases/Configure a reference plan.md` — prepare, set scale, review, finish —
 * for a PNG and for a PDF decoded by **Obsidian's own pdf.js** (`loadPdfJs()`; the suite's jsdom
 * cases run the `pdfjs-dist` devDependency instead). Then what the tracker's BP-06 row says still
 * needs a vault: ruling 43's page-out-of-range sentence, page 2 of a two-page PDF, the rescale that
 * waits for an acknowledgement (ADR-0020), and a real rename and move of the source through
 * `app.fileManager.renameFile`, which is what Obsidian's file explorer calls. The case's "Still open"
 * list names three more this file reaches: live source suggestions, the actual PDF worker, and a
 * plugin unload and reload.
 *
 * The rename and move are PINNED, not judged: the plan's `background-path` is a frontmatter string,
 * not a link, so Obsidian does not rewrite it, and the editor draws the missing-background warning.
 * That is BP-06's recorded "no handling for a renamed reference source"; the day a rename is
 * followed, those two cases turn red and should be rewritten to assert the new path.
 *
 * **Named screenshots are evidence** for the steps whose check is visual, written beside
 * `screenshot.png` in the case's `e2e-results/cases/` folder (CI keeps them 14 days):
 * `reference-floor-start`, `reference-png-drawn`, `reference-pdf-page-1`,
 * `reference-page-out-of-range`, `reference-pdf-page-2`, `reference-rescale-ack`,
 * `reference-source-renamed` and `reference-source-moved`.
 *
 * Fixtures: the e2e vault's PNG (3000 × 2000) and one-page A4 PDF, and a two-page PDF written into
 * the vault copy in-case from `pdfFixture(TWO_PAGE_PDF)`, so no new binary is committed. Copy is
 * read from the `en` locale module. Desktop only: creation and the editor are refused on the mobile
 * leg. Written from source and not yet run when committed: CI's E2E workflow is its first run.
 */
const desktop = mobileEmulation ? test.skip : test;

const PLAN = 'Ground floor';
const FIXTURE_PDF = 'editor-background-pdf-test.pdf';
const TWO_PAGES = 'two-pages.pdf';
const DIALOG = '.rp-dialog';
const FORM = '[data-rp-form="reference"]';
const START = '.rp-floor-start';
const START_DOOR = `${START} [data-rp-route="reference"]`;
const INSPECTOR_DOOR = '[data-rp-region="inspector"] [data-rp-action="reference"]';
/** Two points 200 source pixels apart and 2 m between them: 10 mm per source pixel for every source here. */
const MEASURE = { ax: '100', ay: '100', bx: '300', by: '100', length: '2' };
const SCALE_SUMMARY = en['editor.reference.scale-summary'].replace('{scale}', '10').replace('{length}', '2');
/**
 * `pdfRaster.ts` rasterises at 2 px per PDF point, rounding up: the vault's A4 page (MediaBox
 * 595.92 × 842.88) is 1192 × 1686 — measured with the suite's pdf.js 6.2.108 over the same bytes —
 * and `TWO_PAGE_PDF`'s page 2 (300 × 150 pt, red) is 600 × 300. Its rectangle's centre, PDF (50, 40)
 * with y bottom-up, is the raster's (100, 220).
 */
const A4_RASTER = { width: 1192, height: 1686 };
const PAGE_2_PROBE = { x: 50 * 2, y: (TWO_PAGE_PDF[1].height - 40) * 2 };
const PAGE_2_DRAWN = [{ width: TWO_PAGE_PDF[1].width * 2, height: TWO_PAGE_PDF[1].height * 2, pixel: [255, 0, 0, 255] }];

const shot = (browser: NativeBrowser, directory: string, name: string) => browser.saveScreenshot(join(directory, `${name}.png`));
const editor = (browser: NativeBrowser) => browser.$(EDITOR);
const start = (browser: NativeBrowser) => editor(browser).$(START);
const form = (browser: NativeBrowser) => browser.$(FORM);
const dialogOpen = (browser: NativeBrowser) => browser.$(DIALOG).isExisting();
const alert = (browser: NativeBrowser) => textOf(form(browser).$('p[role="alert"]'));
const heading = (browser: NativeBrowser) => textOf(form(browser).$('h3'));
const stage = (step: number, key: StringKey) => `${String(step)} / 3 · ${en[key]}`;
const canvasFocused = (browser: NativeBrowser) => browser.execute(() => document.activeElement?.classList.contains('rp-plan-canvas') === true);

/** Every vault file with its mtime and size: a write anywhere in the vault changes this. */
const vaultFiles = (browser: NativeBrowser): Promise<string[]> =>
	browser.executeObsidian(({ app }) => app.vault.getFiles().map((file) => `${file.path} ${String(file.stat.mtime)} ${String(file.stat.size)}`).toSorted());

async function planNote(ui: Ui): Promise<Record<string, unknown>> {
	const plans = Object.values(await ui.notesOfType('renovation-plan'));
	expect(plans).toHaveLength(1);
	return plans[0];
}

/**
 * What the Plan Editor's background layer draws: each `Image` child's source size, and the colour
 * at `probe` when the source is a canvas (a rasterised PDF page). Read from the one stage inside the
 * editor leaf that carries a `background` layer, so the reference form's own preview stage is not it.
 */
const drawn = (browser: NativeBrowser, probe: { x: number; y: number } | null = null) =>
	browser.execute(
		(selector: string, at: { x: number; y: number } | null) => {
			const layers = ((window as unknown as { Konva?: typeof Konva }).Konva?.stages ?? [])
				.filter((candidate) => candidate.container().closest(selector) !== null)
				.map((candidate) => candidate.findOne<Konva.Layer>('.background'))
				.filter((layer): layer is Konva.Layer => layer !== undefined);
			if (layers.length !== 1) throw new Error(`Expected one Plan Editor background layer, found ${String(layers.length)}.`);
			return layers[0].getChildren((node) => node.getClassName() === 'Image').map((node) => {
				const source = (node as Konva.Image).image();
				if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight, pixel: null };
				if (!(source instanceof HTMLCanvasElement)) return { width: -1, height: -1, pixel: null };
				const pixel = at === null ? null : [...(source.getContext('2d')?.getImageData(at.x, at.y, 1, 1).data ?? [])];
				return { width: source.width, height: source.height, pixel };
			});
		},
		EDITOR,
		probe,
	);

/** A project and an empty plan through the real forms, its editor open in a 1280 × 1024 window with the floor start drawn. */
async function emptyPlan(browser: NativeBrowser, ui: Ui): Promise<void> {
	await setWindowSize(browser, 1280, 1024);
	await expect.poll(() => browser.execute(() => window.innerWidth)).toBeGreaterThanOrEqual(1270);
	await seedProjectWithPlan(ui);
	await openPlan(browser, ui, PLAN);
	await expect.poll(() => start(browser).isDisplayed()).toBe(true);
}

/** Through `door`, until the form draws its first step. */
async function openForm(browser: NativeBrowser, door: string): Promise<void> {
	await editor(browser).$(door).click();
	await expect.poll(() => textOf(browser.$(DIALOG).$('.rp-dialog-title'))).toBe(en['editor.reference.title']);
	expect(await heading(browser)).toBe(stage(1, 'editor.reference.prepare'));
}

/** Step 1: the source chosen from the form's own vault list, a PDF page typed into its disclosure, then Load. */
async function load(browser: NativeBrowser, source: string, page?: number): Promise<void> {
	await form(browser).$(`[data-rp-reference-source="${source}"]`).click();
	if (page !== undefined) {
		const field = form(browser).$('input[name="page"]');
		if (!(await field.isDisplayed())) await form(browser).$('details:has(input[name="page"]) > summary').click();
		await field.setValue(String(page));
	}
	await form(browser).$('[data-rp-action="load-reference"]').click();
}

/** The preview a decoded source draws; a first PDF decode loads Obsidian's pdf.js, so it is given longer. */
async function previewDrawn(browser: NativeBrowser): Promise<void> {
	await expect.poll(() => form(browser).$('.rp-reference-preview').isExisting(), { timeout: 30_000 }).toBe(true);
}

const submit = (browser: NativeBrowser) => form(browser).$('button[type="submit"]').click();

/** Steps 2 and 3 over a loaded source: Continue, the typed endpoints and distance, Apply scale, and the review's summary. */
async function measure(browser: NativeBrowser): Promise<void> {
	await previewDrawn(browser);
	await submit(browser);
	await expect.poll(() => heading(browser)).toBe(stage(2, 'editor.reference.scale'));
	await form(browser).$('.rp-reference-measure details > summary').click();
	for (const [name, value] of Object.entries(MEASURE)) await form(browser).$(`input[name="${name}"]`).setValue(value);
	await submit(browser);
	await expect.poll(() => heading(browser)).toBe(stage(3, 'editor.reference.review'));
	expect(await textOf(form(browser).$('.rp-reference-review__summary p'))).toBe(SCALE_SUMMARY);
}

/** The whole flow on an empty plan from the floor start's Upload door, until Finish closes the dialog. */
async function configure(browser: NativeBrowser, source: string, page?: number): Promise<void> {
	await openForm(browser, START_DOOR);
	await load(browser, source, page);
	await measure(browser);
	await submit(browser);
	await expect.poll(() => dialogOpen(browser)).toBe(false);
}

/** The editor tab closed, the plugin disabled and enabled, and the plan reopened from the project view. */
async function reloadAndReopen(browser: NativeBrowser, page: ReturnType<NativeBrowser['getObsidianPage']>, ui: Ui): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		app.workspace.detachLeavesOfType('renovation-plan-editor');
	});
	await reloadPlugin(page);
	await openPlan(browser, ui, PLAN);
	expect(await ui.leafCount('renovation-plan-editor')).toBe(1);
}

describe('BP-06: the three starts on an empty floor, in the real Obsidian host', () => {
	desktop('Add rooms starts the room task and its Cancel brings the start back; Upload opens the setup; Start empty leaves the canvas focused', async ({ native: { browser, ui, directory } }) => {
		await emptyPlan(browser, ui);
		expect(await textOf(start(browser).$('h2'))).toBe(en['editor.creation.set-up-floor'].replace('{name}', PLAN));
		const routes = await start(browser).$$('[data-rp-route]').map(async (button) => ({
			route: await button.getAttribute('data-rp-route'),
			title: await textOf(button.$('.rp-floor-start__title')),
		}));
		expect(routes).toEqual([
			{ route: 'rooms', title: en['editor.reference.rooms'] },
			{ route: 'reference', title: en['editor.reference.upload'] },
			{ route: 'empty', title: en['editor.reference.empty'] },
		]);
		await shot(browser, directory, 'reference-floor-start');

		await start(browser).$('[data-rp-route="rooms"]').click();
		await expect.poll(() => textOf(editor(browser).$('.rp-task-banner strong'))).toBe(en['editor.task.add-room.name']);
		expect(await editor(browser).$('[data-rp-region="inspector"] .rp-new-room').isExisting()).toBe(true);
		expect(await start(browser).isExisting()).toBe(false);
		await logEvidence(directory, 'focus-after-rooms', { canvas: await canvasFocused(browser) });
		// Empty States step 7's open question: a task left by its Cancel re-admits the panel.
		await editor(browser).$('.rp-task-banner__cancel').click();
		await expect.poll(() => start(browser).isDisplayed()).toBe(true);
		expect(await editor(browser).$('.rp-task-banner').isExisting()).toBe(false);

		await openForm(browser, START_DOOR);
		expect(await start(browser).isExisting()).toBe(false);
		await browser.$(DIALOG).$('[data-rp-action="cancel"]').click();
		await expect.poll(() => dialogOpen(browser)).toBe(false);
		await expect.poll(() => start(browser).isDisplayed()).toBe(true);

		await start(browser).$('[data-rp-route="empty"]').click();
		await expect.poll(() => start(browser).isExisting()).toBe(false);
		await expect.poll(() => canvasFocused(browser)).toBe(true);
		expect(await editor(browser).$('.rp-task-banner').isExisting()).toBe(false);
	});
});

describe('BP-06: a PNG and a PDF reference, through Obsidian’s own pdf.js', () => {
	desktop('a PNG offered by the vault list is prepared, measured and finished; the plan draws it, and again after a plugin reload', async ({ native: { browser, page, ui, directory } }) => {
		await emptyPlan(browser, ui);
		await openForm(browser, START_DOOR);
		// Live source suggestions: exactly the vault's PNG and PDF, from Obsidian's own file list.
		const offered = await form(browser).$$('[data-rp-reference-source]').map((button) => button.getAttribute('data-rp-reference-source'));
		expect(offered.toSorted()).toEqual([FIXTURE_PDF, FIXTURE_PNG].toSorted());
		await browser.$(DIALOG).$('[data-rp-action="cancel"]').click();
		await expect.poll(() => start(browser).isDisplayed()).toBe(true);

		await configure(browser, FIXTURE_PNG);
		expect(await planNote(ui)).toMatchObject({
			'background-path': FIXTURE_PNG,
			'background-kind': 'image',
			'background-page': null,
			'reference-appearance': { crop: { x: 0, y: 0, width: 3000, height: 2000 }, rotation: 0, opacity: 0.65, visible: true, locked: true },
		});
		const calibration = (JSON.parse(await readSidecar(browser, await sidecarPath(browser))) as { calibration: { pixelsPerWorldUnit: number } | null }).calibration;
		expect(calibration?.pixelsPerWorldUnit).toBeCloseTo(0.1);
		await expect.poll(() => drawn(browser)).toEqual([{ width: 3000, height: 2000, pixel: null }]);
		// A background and no rooms: no panel of any kind over the canvas.
		expect(await editor(browser).$('.rp-empty-state').isExisting()).toBe(false);
		await shot(browser, directory, 'reference-png-drawn');

		await reloadAndReopen(browser, page, ui);
		await expect.poll(() => drawn(browser)).toEqual([{ width: 3000, height: 2000, pixel: null }]);
	});

	desktop('page 1 of the vault’s A4 PDF is decoded by Obsidian’s pdf.js and drawn at 2 px per point', async ({ native: { browser, ui, directory } }) => {
		await emptyPlan(browser, ui);
		await configure(browser, FIXTURE_PDF);
		expect(await planNote(ui)).toMatchObject({ 'background-path': FIXTURE_PDF, 'background-kind': 'pdf', 'background-page': 1 });
		await expect.poll(() => drawn(browser)).toEqual([{ ...A4_RASTER, pixel: null }]);
		await shot(browser, directory, 'reference-pdf-page-1');
		// Which pdf.js did it: the host's, beside the suite's (`pdfRaster.ts`'s residual gap), recorded rather than compared.
		const host = await browser.executeObsidian(async ({ obsidian }) => String(((await obsidian.loadPdfJs()) as { version?: unknown }).version));
		const suite = (JSON.parse(await readFile('node_modules/pdfjs-dist/package.json', 'utf8')) as { version: string }).version;
		await logEvidence(directory, 'pdfjs', { host, suite });
		expect(host).toMatch(/^\d+\.\d+\.\d+$/u);
	});

	desktop('page 2 of a one-page PDF draws ruling 43’s sentence, Continue refuses, nothing is written, and page 1 then loads', async ({ native: { browser, ui, directory } }) => {
		await emptyPlan(browser, ui);
		const before = await vaultFiles(browser);
		expect(before.some((line) => line.startsWith(`${FIXTURE_PDF} `))).toBe(true);
		await openForm(browser, START_DOOR);
		await load(browser, FIXTURE_PDF, 2);
		await expect.poll(() => alert(browser), { timeout: 30_000 }).toBe(en['editor.reference.page-out-of-range'].replace('{page}', '2').replace('{count}', '1'));
		expect(await form(browser).$('.rp-reference-preview').isExisting()).toBe(false);
		await shot(browser, directory, 'reference-page-out-of-range');

		await submit(browser);
		await expect.poll(() => alert(browser)).toBe(en['editor.reference.invalid-prepare']);
		expect(await heading(browser)).toBe(stage(1, 'editor.reference.prepare'));

		// The positive control: the same form, the same file, page 1 — it decodes, and the refusal is gone.
		await load(browser, FIXTURE_PDF, 1);
		await previewDrawn(browser);
		expect(await form(browser).$('p[role="alert"]').isExisting()).toBe(false);
		await browser.$(DIALOG).$('[data-rp-action="cancel"]').click();
		await expect.poll(() => dialogOpen(browser)).toBe(false);
		expect(await vaultFiles(browser)).toEqual(before);
		expect((await planNote(ui))['background-path']).toBe('');
	});

	desktop('page 2 of a two-page PDF is decoded, committed and drawn, and drawn again after a plugin reload', async ({ native: { browser, page, ui, directory } }) => {
		await browser.executeObsidian(
			async ({ app }, path, base64) => {
				await app.vault.createBinary(path, Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer);
			},
			TWO_PAGES,
			Buffer.from(pdfFixture(TWO_PAGE_PDF)).toString('base64'),
		);
		await emptyPlan(browser, ui);
		await configure(browser, TWO_PAGES, 2);
		expect(await planNote(ui)).toMatchObject({ 'background-path': TWO_PAGES, 'background-kind': 'pdf', 'background-page': 2 });
		await expect.poll(() => drawn(browser, PAGE_2_PROBE)).toEqual(PAGE_2_DRAWN);
		await shot(browser, directory, 'reference-pdf-page-2');

		await reloadAndReopen(browser, page, ui);
		await expect.poll(() => drawn(browser, PAGE_2_PROBE)).toEqual(PAGE_2_DRAWN);
	});
});

describe('BP-06: rescaling existing rooms, and the source renamed or moved', () => {
	desktop('a scale that rescales the sample rooms is refused until acknowledged, then rescales every room by 10', async ({ native: { browser, ui, directory } }) => {
		await setWindowSize(browser, 1280, 1024);
		await seedSampleProject(browser, ui);
		expect(await editor(browser).$('.rp-editor-shell').getAttribute('data-layout')).toBe('full');
		await expect.poll(() => saveLabel(browser)).toEqual({ state: 'rp-save-state-saved', text: en['save-state.saved'] });
		const path = await sidecarPath(browser);
		const outlines = async () => Object.fromEntries((JSON.parse(await readSidecar(browser, path)) as { objects: { id: string; points: StoredPoint[] }[] }).objects.map((object) => [object.id, object.points]));
		const original = await outlines();
		expect(Object.keys(original)).toHaveLength(5);
		const before = await vaultFiles(browser);

		expect(await textOf(editor(browser).$(INSPECTOR_DOOR))).toBe(en['editor.reference.upload']);
		await openForm(browser, INSPECTOR_DOOR);
		await load(browser, FIXTURE_PNG);
		await measure(browser);
		const impact = form(browser).$('.rp-reference-rescale-impact');
		expect({ heading: await textOf(impact.$('h4')), text: await textOf(impact.$('p')) }).toEqual({
			heading: en['editor.reference.rescale-impact'],
			text: en['editor.reference.rescale'].replace('{factor}', '10'),
		});
		await submit(browser);
		await expect.poll(() => alert(browser)).toBe(en['editor.reference.consent']);
		expect(await dialogOpen(browser)).toBe(true);
		expect(await vaultFiles(browser)).toEqual(before);
		await shot(browser, directory, 'reference-rescale-ack');

		// Recorded, not asserted: at 1280 x 1024 the click below is intercepted by the sticky footer and only
		// WebdriverIO's scroll-and-retry lands it. A product layout question for the owner, not a test fix.
		await logEvidence(
			directory,
			'consent-vs-footer',
			await browser.execute(() => {
				const [consent, footer] = ['.rp-dialog input[name="consent"]', '.rp-dialog .rp-dialog-footer'].map((selector) => {
					const { top, bottom, left, right } = (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
					return { top, bottom, left, right };
				});
				return { consent, footer, viewport: window.innerHeight };
			}),
		);
		await form(browser).$('input[name="consent"]').click();
		await submit(browser);
		await expect.poll(() => dialogOpen(browser)).toBe(false);
		const scaled = Object.fromEntries(Object.entries(original).map(([id, points]) => [id, points.map(([x, y]) => [x * 10, y * 10])]));
		await expect.poll(() => outlines()).toEqual(scaled);
		await expect.poll(() => saveLabel(browser)).toEqual({ state: 'rp-save-state-saved', text: en['save-state.saved'] });
		expect(await vaultFiles(browser)).not.toEqual(before);
	});

	desktop.for([
		{ name: 'renamed', target: 'renamed-floor-plan.png' },
		{ name: 'moved', target: `References/${FIXTURE_PNG}` },
	])('the source $name through Obsidian’s file manager: the plan keeps the old path and the editor says the file is missing', async ({ name, target }, { native: { browser, ui, directory } }) => {
		await emptyPlan(browser, ui);
		await configure(browser, FIXTURE_PNG);
		await expect.poll(() => drawn(browser)).toEqual([{ width: 3000, height: 2000, pixel: null }]);
		const warning = editor(browser).$('[data-rp-warning="background-missing"]');
		// The instrument sees the strip: drawn and with no background warning in it before the rename.
		expect(await editor(browser).$('.rp-warning-strip').isExisting()).toBe(true);
		expect(await editor(browser).$$('[data-rp-warning^="background-"]')).toHaveLength(0);

		const moved = await browser.executeObsidian(
			async ({ app }, from, to) => {
				const file = app.vault.getFileByPath(from);
				if (file === null) throw new Error(`${from} is not in the vault.`);
				const folder = to.includes('/') ? to.slice(0, to.lastIndexOf('/')) : '';
				if (folder !== '' && app.vault.getFolderByPath(folder) === null) await app.vault.createFolder(folder);
				await app.fileManager.renameFile(file, to);
				return { from: app.vault.getFileByPath(from) !== null, to: app.vault.getFileByPath(to) !== null };
			},
			FIXTURE_PNG,
			target,
		);
		expect(moved).toEqual({ from: false, to: true });

		await expect.poll(() => warning.isExisting()).toBe(true);
		expect({ severity: await warning.getAttribute('data-rp-severity'), text: await textOf(warning) }).toEqual({
			severity: 'warning',
			text: `${en['editor.warning.severity.warning']} ${en['editor.background-missing']}`,
		});
		await expect.poll(() => drawn(browser)).toEqual([]);
		expect((await planNote(ui))['background-path']).toBe(FIXTURE_PNG);
		await shot(browser, directory, `reference-source-${name}`);
	});
});
