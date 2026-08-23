import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { resolveChromiumExecutable } from './chromium.mjs';

/**
 * One PNG per component specimen out of `docs/concepts/component-gallery.html`, each showing
 * that specimen twice — light beside dark — for embedding in the matching note under
 * `docs/components/`.
 *
 * WHY THE GALLERY RATHER THAN A PAGE PER COMPONENT. The gallery already carries one
 * `article.pg-specimen` per note, with the states each one owes. A second drawing of the
 * same component is a copy that can disagree, which is the shape this repository's inlined
 * icon sprite, its vendored app.css and its fake `ItemView` are each built to avoid.
 *
 * WHY TWO PASSES AND A CLASS ON `<body>`, which is the whole design of this file and was a
 * measurement rather than a preference. The first version built the pair in ONE pass, by
 * cloning each specimen into two nested frames carrying `.theme-light` and `.theme-dark` —
 * the shape the gallery's own last section uses. Both halves came out light. The reason is in
 * the vendored sheet: `--background-primary` is declared ONCE, as `var(--color-base-00)`, and
 * only the BASE variables are redeclared per theme. A custom property substitutes at the
 * element that DECLARES it, so `--background-primary` computes on `<body>` in the body's
 * scheme and inherits down already resolved; a nested `.theme-dark` changes `--color-base-00`
 * underneath it and nothing that derives from it. Measured, in the gallery itself: inside its
 * `.theme-dark` panel, `--color-base-00` is `#1C1C1C` while `--background-primary` is
 * `#ffffff`.
 *
 * So the scheme goes where Obsidian puts it and where the gallery's own toggle puts it — on
 * `<body>` — and each specimen is shot once per scheme. Two consequences, both good: nothing
 * is CLONED, so there is never a duplicate `id` to disambiguate (an SVG `<pattern>` copied
 * into a second frame would have had both frames painting from the first one's hatch), and
 * every capture is a scheme the same way a vault is a scheme.
 *
 * WHAT IS NOT CHECKED — and this sentence is the whole guarantee, so it is written before
 * anything that reads like one: nothing here pairs the notes against the specimens against
 * the PNGs. A note with no specimen, a specimen whose heading was renamed, an embed pointing
 * at a file that no longer exists, a PNG orphaned by a rename — this script reports none of
 * them. It shoots the specimens it finds and writes what it shot. Keeping the three sets in
 * step is a reader's job at review time, deliberately, and `docs/concepts/README.md` says so
 * in the same words.
 *
 * Like `harness-shot.mjs` it is outside `npm run check`: it draws, and asserts no
 * appearance. It exits non-zero only where that one does — the page itself fell over while
 * being looked at.
 *
 * NO DEV SERVER, the one way it differs from its sibling. The gallery is a static file whose
 * three stylesheets are relative, so it opens over `file://` directly. The icon sprite being
 * inlined in the page rather than linked is what makes that work, and it is inlined for the
 * same reason: `<use href="file.svg#id">` is blocked cross-origin, and every `file://`
 * document is its own origin.
 */

const GALLERY = path.join('docs', 'concepts', 'component-gallery.html');
const OUT_DIR = path.join('docs', 'concepts', 'shots');

/* The width each specimen is shot at — wider than the ~350px column the same specimen gets
   in the gallery's four-up grid, since here it has a note to itself. */
const COLUMN = 520;
const GAP = 18;
const THEMES = ['theme-light', 'theme-dark'];
const SPECIMEN_VIEWPORT = { width: COLUMN + 200, height: 900 };
const SPECIMEN_SCALE = 2;

/* The composite page renders the two captures at their NATURAL size and is captured at
   scale 1, so a device pixel of the specimen shot maps to a device pixel of the pair. At
   scale 2 it would resample an already-2x image to 4x the area — bigger, and blurrier. */
const PAIR_VIEWPORT = { width: (COLUMN + GAP) * 2 * SPECIMEN_SCALE, height: 1000 };

/**
 * In-page, once: take every specimen out of the gallery's grid and stack it in a
 * fixed-width column, each tagged with the slug its file is named by. Returns the slugs in
 * document order.
 *
 * The specimen is MOVED, not copied — see the header on why nothing here clones. What is
 * left in the body besides the column is the icon sprite, which every specimen's `<use>`
 * still resolves against.
 *
 * `globalThis.document` rather than the bare global: this function is stringified and run in
 * the browser, but it is LINTED as a Node module like everything else in `scripts/`.
 */
function stackInPage(width) {
	const doc = globalThis.document;
	const sprite = doc.querySelector('body > svg');
	const column = doc.createElement('div');
	const slugs = [];

	column.style.width = `${width}px`;

	for (const specimen of doc.querySelectorAll('article.pg-specimen')) {
		// The specimen's own heading is the name, so a file is named by what the gallery calls
		// the component rather than by a list kept somewhere else that can disagree with it.
		const heading = specimen.querySelector('h3').textContent.trim().toLowerCase();

		specimen.dataset.shot = heading.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
		column.append(specimen);
		slugs.push(specimen.dataset.shot);
	}

	doc.body.replaceChildren(sprite, column);

	return slugs;
}

/** In-page: the scheme, set where Obsidian sets it and where the gallery's own toggle sets
 * it. `.pg` is kept because it is what undoes app.css's app-shell rules on this page. */
function setThemeInPage(theme) {
	globalThis.document.body.className = `pg ${theme}`;
}

/** In-page: the two captures side by side on a transparent ground, at their natural size.
 * Transparent so the gutter between them takes the colour of whatever theme the vault
 * renders the PNG in, rather than baking one of the two schemes into the seam. */
async function pairInPage({ light, dark, gap }) {
	const doc = globalThis.document;
	const row = doc.createElement('div');

	row.id = 'cs-pair';
	row.style.cssText = `display: flex; gap: ${gap}px; align-items: flex-start; width: max-content`;

	for (const src of [light, dark]) {
		const img = doc.createElement('img');

		img.src = src;
		img.style.cssText = 'display: block';
		row.append(img);
	}

	doc.body.replaceChildren(row);
	doc.documentElement.style.background = 'transparent';
	doc.body.style.background = 'transparent';

	// Screenshotting a row of images that have not decoded yet captures blank boxes.
	await Promise.all([...row.querySelectorAll('img')].map((img) => img.decode()));
}

/** Every specimen in one scheme, as PNG buffers rather than files: an intermediate per
 * scheme on disk would be 34 files nobody wants, for two the composite consumes. */
async function captureScheme(page, slugs, theme) {
	const shots = new Map();

	await page.evaluate(setThemeInPage, theme);

	for (const slug of slugs) shots.set(slug, await page.locator(`[data-shot="${slug}"]`).screenshot());

	return shots;
}

/** One component's PNG: its two captures composited, written under `OUT_DIR`. */
async function writePair(page, slug, captures) {
	const [light, dark] = THEMES.map((theme) => `data:image/png;base64,${captures.get(theme).get(slug).toString('base64')}`);
	const file = path.join(OUT_DIR, `${slug}.png`);

	await page.evaluate(pairInPage, { light, dark, gap: GAP });
	await page.locator('#cs-pair').screenshot({ path: file, omitBackground: true });
	console.log(`wrote ${file}`);
}

/** What every page complaint is told to the terminal, and the exit code that makes it mean
 * something — the same narrow claim `harness-shot.mjs` makes: not that the shots look right,
 * only that the page did not fall over while being drawn. */
function reportErrors(errors) {
	if (errors.length === 0) return;

	console.error('\nconcept-shots found page errors:\n');
	for (const line of errors) console.error(` - ${line}`);
	process.exitCode = 1;
}

/** Report a page's own complaints onto the shared list rather than throwing them: a console
 * error in the gallery should not cost the run its PNGs, only its exit code. */
function watchForErrors(page, errors) {
	page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`);
	});
}

async function run() {
	const executablePath = resolveChromiumExecutable();

	mkdirSync(OUT_DIR, { recursive: true });

	const browser = await chromium.launch({ executablePath, headless: true });
	const errors = [];

	try {
		const gallery = await browser.newPage({ viewport: SPECIMEN_VIEWPORT, deviceScaleFactor: SPECIMEN_SCALE });

		watchForErrors(gallery, errors);
		await gallery.goto(pathToFileURL(path.resolve(GALLERY)).href, { waitUntil: 'load' });

		const slugs = await gallery.evaluate(stackInPage, COLUMN);
		const captures = new Map();

		for (const theme of THEMES) captures.set(theme, await captureScheme(gallery, slugs, theme));

		// A second page, at scale 1, for the reason PAIR_VIEWPORT gives. It needs no
		// stylesheet — it holds two images and nothing else — so it never loads the gallery.
		const pairs = await browser.newPage({ viewport: PAIR_VIEWPORT, deviceScaleFactor: 1 });

		watchForErrors(pairs, errors);

		for (const slug of slugs) await writePair(pairs, slug, captures);
		console.log(`\n${slugs.length} specimens, ${THEMES.length} schemes each, into ${OUT_DIR}`);
	} finally {
		await browser.close();
	}

	reportErrors(errors);
}

try {
	await run();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
