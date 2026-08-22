import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every variable the page reads is DECLARED by one of the three sheets the page links —
 * Obsidian's app.css, the harness chrome, and the plugin's own assembled sheet (served as
 * `/styles.css` from `styles/`). This is what keeps "the harness draws with Obsidian's own
 * colours" from becoming a claim nobody checks: a `var(--size-4-3)` that resolves to
 * nothing draws a box with no padding, and a screenshot of it looks deliberate.
 *
 * The guarantee is narrower than "the page looks right", and the narrowness is the point:
 *
 * - It reads DECLARATIONS, not the cascade. A name declared in a block no page state
 *   reaches still counts as declared here.
 * - It ignores the scheme. A value declared under `.theme-dark` only would pass, and draw
 *   nothing under `?theme=light`. Checking that needs the source project's per-scheme
 *   reference walk (`test/helpers/cssVars.ts` in that repository), which is worth porting the day a
 *   partial reads a variable app.css declares in one scheme.
 * - A `var(--x, fallback)` is counted as a read of `--x` anyway: the fallback is a branch,
 *   not permission for the name to be missing.
 */

const read = (file: string) => readFileSync(file, 'utf8');

const USE = /var\(\s*(--[\w-]+)/g;
const DECLARE = /(--[\w-]+)\s*:/g;
const LINK = /<link rel="stylesheet" href="([^"]+)" \/>/g;

const names = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map((m) => m[1]));

/**
 * The sheets are DERIVED from the page, not listed here: index.html is the one
 * authoritative statement of what the browser loads, and a hand-kept copy would let a
 * fourth link (or a dropped one) leave this test verifying a different page than the one
 * served. `/styles.css` is the dev server's assembled answer, so it maps to the partials
 * on disk; `./x.css` is a static file beside the page.
 */
const linked = [...read('tests/harness/index.html').matchAll(LINK)].flatMap(([, href]) =>
	href === '/styles.css' ? readdirSync('styles').map((f) => `styles/${f}`) : [`tests/harness/${href.replace('./', '')}`],
);
// Each sheet read ONCE, shared by the declaration sweep and the per-file cases.
const sources = new Map(linked.map((file) => [file, read(file)]));

// The vendored app.css only DECLARES here: its own reads are Obsidian's self-consistency
// to answer for, not this plugin's, and asserting on them would fail on every reduction.
const readers = linked.filter((file) => file !== 'tests/harness/obsidian.css');

describe('the harness stylesheets', () => {
	const declared = new Set([...sources.values()].flatMap((text) => [...names(text, DECLARE)]));

	// One case per reading file, so a failure names the file to open rather than a list.
	for (const file of readers) {
		it(`resolves every variable ${file} reads`, () => {
			const missing = [...names(sources.get(file) ?? '', USE)].filter((name) => !declared.has(name));

			expect(missing).toEqual([]);
		});
	}

	// The instrument itself, tested before its result is trusted: a regex that matched
	// nothing would make every case above pass by finding no reads at all — including the
	// link scan, whose failure would empty every set at once.
	it('can see links, reads and declarations', () => {
		expect(names('a { color: var(--text-normal); }', USE)).toEqual(new Set(['--text-normal']));
		expect(names(':root { --text-normal: red; }', DECLARE)).toEqual(new Set(['--text-normal']));
		expect(sources.has('tests/harness/obsidian.css')).toBe(true);
		expect(sources.has('styles/index.css')).toBe(true);
		expect(declared.size).toBeGreaterThan(100);
	});
});
