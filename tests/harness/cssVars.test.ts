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

const names = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map((m) => m[1]));

// The plugin's own partials, plus the harness's own chrome — the sheets that read.
const readers = [...readdirSync('styles').map((f) => `styles/${f}`), 'tests/harness/theme.css'];
// Everywhere a declaration may live: all three sheets the page links. The partials are in
// this set too — a plugin variable declared and read by the plugin's own sheet resolves on
// the page, and counting only the vendored sheets would fail that ordinary case falsely.
const declarers = ['tests/harness/obsidian.css', 'tests/harness/theme.css', ...readdirSync('styles').map((f) => `styles/${f}`)];

describe('the harness stylesheets', () => {
	const declared = new Set(declarers.flatMap((file) => [...names(read(file), DECLARE)]));

	// One case per reading file, so a failure names the file to open rather than a list.
	for (const file of readers) {
		it(`resolves every variable ${file} reads`, () => {
			const missing = [...names(read(file), USE)].filter((name) => !declared.has(name));

			expect(missing).toEqual([]);
		});
	}

	// The instrument itself, tested before its result is trusted: a regex that matched
	// nothing would make every case above pass by finding no reads at all.
	it('can see reads and declarations', () => {
		expect(names('a { color: var(--text-normal); }', USE)).toEqual(new Set(['--text-normal']));
		expect(names(':root { --text-normal: red; }', DECLARE)).toEqual(new Set(['--text-normal']));
		expect(declared.size).toBeGreaterThan(100);
	});
});
