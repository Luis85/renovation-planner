import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { resolveChromiumExecutable } from './chromium.mjs';

/**
 * One PNG per component specimen out of `docs/concepts/component-gallery.html`, each showing
 * that specimen twice — `theme-light` beside `theme-dark` — for embedding in the matching
 * note under `docs/components/`.
 *
 * WHY THE GALLERY RATHER THAN A PAGE PER COMPONENT. The gallery already carries one
 * `article.pg-specimen` per note, with the states each one owes. A second drawing of the
 * same component is a copy that can disagree, which is the shape this repository's inlined
 * icon sprite, its vendored app.css and its fake `ItemView` are each built to avoid.
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
 * NO DEV SERVER, which is the one way it differs from its sibling. The gallery is a static
 * file whose three stylesheets are relative, so it opens over `file://` directly. The icon
 * sprite being inlined in the page rather than linked is what makes that work, and it is
 * inlined for the same reason: `<use href="file.svg#id">` is blocked cross-origin, and every
 * `file://` document is its own origin.
 */

const GALLERY = path.join('docs', 'concepts', 'component-gallery.html');
const OUT_DIR = path.join('docs', 'concepts', 'shots');

/* Wide enough that `page.css`'s own `.pg-schemes` grid — `auto-fit, minmax(330px, 1fr)` —
   lays the pair out side by side at roughly 500px each, which is wider than the ~350px
   column the same specimen gets in the gallery's four-up grid. `auto-fit` collapses the
   empty third track it could otherwise fit here, which is the difference between it and
   `auto-fill` and the reason this number does not have to dodge a third column. */
const SHOT_WIDTH = 1040;
const VIEWPORT = { width: 1200, height: 900 };
const SCALE = 2;

/**
 * In-page: replace the gallery's own layout with one composite per specimen — a
 * `.pg-schemes` pair of `.pg-frame`s, light beside dark — reusing `page.css`'s existing
 * classes so this script introduces no styling of its own and cannot drift from the sheet
 * the mock is drawn with. Returns the slugs in document order.
 *
 * THE ID REWRITE is the part worth reading. Cloning a specimen duplicates every `id` inside
 * it, and the canvas-bearing specimens define an SVG `<pattern>` and paint with
 * `url(#that-id)`. Two copies in one document means both frames resolve to the FIRST, so the
 * dark half would silently render the light half's hatch — the gallery's own both-schemes
 * section dodges this by hand with `-l`/`-d` suffixes. So each clone's ids take a suffix, and
 * a reference is rewritten ONLY where its target lives inside that same clone:
 * `use href="#i-measure"` points at the document-level sprite and has to keep pointing there,
 * or every icon in both frames disappears.
 *
 * `globalThis.document` rather than the bare global: this function is stringified and run in
 * the browser, but it is LINTED as a Node module like everything else in `scripts/`.
 */
function composeInPage(width) {
	const doc = globalThis.document;
	// Every attribute in these specimens whose value can name an id. The ARIA ones and `for`
	// change no pixel; they are here because a duplicated id is wrong whether or not it shows.
	const REF_ATTRS = ['href', 'xlink:href', 'fill', 'stroke', 'clip-path', 'mask', 'filter', 'aria-describedby', 'aria-labelledby', 'aria-controls', 'for'];

	function slugOf(text) {
		return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	}

	/* `#id` covers both spellings that matter — a bare fragment (`href`) and one wrapped in
	   `url(...)` (`fill`, `mask`) — so one pass handles them. A value with no `#` at all is an
	   id-list attribute, where the ids are bare, whitespace-separated tokens. Either way the
	   `owned` set is what decides: a token the clone does not contain is left alone. */
	function remap(value, owned, suffix) {
		if (value.includes('#')) {
			return value.replace(/#([\w.:-]+)/g, (whole, id) => (owned.has(id) ? `#${id}${suffix}` : whole));
		}

		return value
			.split(/\s+/)
			.map((token) => (owned.has(token) ? token + suffix : token))
			.join(' ');
	}

	function suffixIds(root, suffix) {
		const owned = new Set([...root.querySelectorAll('[id]')].map((el) => el.id));

		if (owned.size === 0) return;

		for (const el of root.querySelectorAll('[id]')) el.id += suffix;

		for (const el of root.querySelectorAll('*')) {
			for (const attr of REF_ATTRS) {
				const value = el.getAttribute(attr);

				if (value !== null) el.setAttribute(attr, remap(value, owned, suffix));
			}
		}
	}

	function frameFor(specimen, theme) {
		const frame = doc.createElement('div');
		const label = doc.createElement('div');
		const copy = specimen.cloneNode(true);

		frame.className = `pg-frame ${theme}`;
		label.className = 'pg-frame-label';
		label.textContent = theme;
		suffixIds(copy, theme === 'theme-dark' ? '-csd' : '-csl');
		frame.append(label, copy);

		return frame;
	}

	const sprite = doc.querySelector('body > svg');
	const host = doc.createElement('div');
	const slugs = [];

	host.style.width = `${width}px`;

	for (const specimen of doc.querySelectorAll('article.pg-specimen')) {
		const shot = doc.createElement('div');
		const slug = slugOf(specimen.querySelector('h3').textContent);

		shot.className = 'pg-schemes';
		shot.dataset.shot = slug;
		shot.append(frameFor(specimen, 'theme-light'), frameFor(specimen, 'theme-dark'));
		host.append(shot);
		slugs.push(slug);
	}

	/* The originals were only clone sources. What survives is the sprite the clones' `use`
	   elements still resolve against, and the composites themselves — everything else would
	   otherwise paint behind the 18px gutter between the two frames, since an element
	   screenshot captures whatever pixels sit inside the box. A transparent ground is what
	   lets that gutter take the colour of whatever theme the vault renders the PNG in. */
	doc.body.replaceChildren(sprite, host);
	doc.documentElement.style.background = 'transparent';
	doc.body.style.background = 'transparent';

	return slugs;
}

/** One specimen's pair, by the attribute `composeInPage` tagged it with. Playwright captures
 * the whole element even where it is taller than the viewport, so nothing here scrolls. */
async function shoot(page, slug) {
	const file = path.join(OUT_DIR, `${slug}.png`);

	await page.locator(`[data-shot="${slug}"]`).screenshot({ path: file, omitBackground: true });
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

async function run() {
	const executablePath = resolveChromiumExecutable();

	mkdirSync(OUT_DIR, { recursive: true });

	const browser = await chromium.launch({ executablePath, headless: true });
	const errors = [];

	try {
		const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE });

		page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`);
		});

		await page.goto(pathToFileURL(path.resolve(GALLERY)).href, { waitUntil: 'load' });

		const slugs = await page.evaluate(composeInPage, SHOT_WIDTH);

		for (const slug of slugs) await shoot(page, slug);
		console.log(`\n${slugs.length} specimens shot into ${OUT_DIR}`);
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
