import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { entryShots, resolveShots } from '../../scripts/entryShots.mjs';

/** The 8-character hex digest `entryShots` derives from an id, computed independently here so
 * the expected filename is not copied from the implementation's own output. */
const digestOf = (id: string): string => createHash('sha1').update(id).digest('hex').slice(0, 8);

/**
 * `entryShots` and `resolveShots`, driven directly rather than pinned as source text.
 *
 * Both are pure — no browser, no dev server, no filesystem — which is exactly what makes them
 * importable where the rest of `scripts/harness-shot.mjs` is not: that file runs its capture
 * at module scope the moment it is imported, so nothing in it besides these two functions can
 * be called from a test at all. Before this file existed, the filename contract (collision
 * avoidance, the 60-character cap, the sanitising regex) and the argv-to-shots wiring were
 * both asserted by reading the script's SOURCE TEXT and checking it still said the right
 * thing — which cannot see whether the code still DOES it. `harness-shot.test.ts` keeps the
 * source-text checks that are actually about wiring (which npm script, which devDependency,
 * which shared module); this file replaces the ones that were standing in for a behavioural
 * test only because nothing behavioural could be written yet.
 */
describe('entryShots', () => {
	it('keeps the query the URL the index reads, unsanitised, while the filename is sanitised', () => {
		const [dark, light] = entryShots('prototype:ZoneSummary');

		expect(dark.entry).toBe('prototype:ZoneSummary');
		expect(dark.query).toBe('?entry=prototype%3AZoneSummary');
		expect(light.query).toBe('?entry=prototype%3AZoneSummary&theme=light');
		// The filename may not carry `:` or `/` — both legal in the URL, both illegal in a
		// Windows filename, and Windows is one of the four `npm run check` legs. The FULL set
		// is covered by the dedicated case below; this one is the readable id example above it.
		expect(dark.name).not.toMatch(/[:/\\]/);
		expect(dark.name).toBe(`entry-prototype-ZoneSummary-${digestOf('prototype:ZoneSummary')}-dark`);
	});

	/**
	 * The set the sanitiser has to cover is `< > : " / \ | ? *` — every character Windows
	 * refuses in a filename — and the id itself is not what limits the check: `entryShots`
	 * sanitises with an ALLOWLIST (`replace(/[^a-zA-Z0-9]+/g, '-')`), which covers the whole
	 * set by construction. A previous version of this coverage drove only `:` and `/`, the two
	 * characters a URL-shaped id happens to carry; that passed just as readily against a
	 * DENYLIST sanitiser (`replace(/[:/]+/g, '-')`) that left `< > " | ? *` untouched, which
	 * would still be a leg-specific failure nobody reproduces locally. Driving every illegal
	 * character at once is what actually distinguishes the two implementations.
	 */
	it('strips every Windows-illegal filename character, not merely the two a URL-shaped id carries', () => {
		const illegal = '<>:"/\\|?*';
		const [dark] = entryShots(`a${illegal}b`);

		expect(dark.name).not.toMatch(/[<>:"/\\|?*]/);
	});

	it('gives two different ids two different filenames even when sanitising collapses them onto one string', () => {
		// The plan's own id test: `a-b/C` and `a/b-C` both sanitise to `a-b-C`. Two different
		// entries writing the same two PNGs, the second overwriting the first, is the exact
		// failure the digest exists to refuse.
		const [a] = entryShots('a-b/C');
		const [b] = entryShots('a/b-C');

		expect(a.name).not.toBe(b.name);
	});

	it('caps the human-readable part of the filename, since the digest is what keeps it unique', () => {
		const longId = `prototype:${'x'.repeat(500)}`;
		const [dark] = entryShots(longId);
		// `entry-` + up to 60 readable chars + `-` + an 8-char hex digest + `-dark`.
		const readablePart = dark.name.replace(/^entry-/, '').replace(/-[0-9a-f]{8}-dark$/, '');

		expect(readablePart.length).toBeLessThanOrEqual(60);
		expect(dark.name.length).toBeLessThanOrEqual('entry-'.length + 60 + 1 + 8 + '-dark'.length);
	});

	it('returns exactly the dark and light shots, both carrying the same entry', () => {
		const shots = entryShots('ZoneSummary');

		expect(shots).toHaveLength(2);
		expect(shots.map((shot) => shot.name.endsWith('-dark') || shot.name.endsWith('-light'))).toEqual([true, true]);
		expect(shots.every((shot) => shot.entry === 'ZoneSummary')).toBe(true);
	});
});

describe('resolveShots', () => {
	const FIXED = [{ name: 'dark', query: '', selector: '.renovation-planner-view' }];

	/**
	 * The mutation this exists to catch: `process.argv[2]` becoming `process.argv[3]` (or any
	 * other index) inside `run()`. Nothing else in this suite runs `harness-shot.mjs`'s `run()`
	 * — it launches a browser — so before `resolveShots` existed, that mutation left all
	 * existing cases green while `npm run harness-shot prototype:ZoneSummary` silently wrote
	 * the five fixed PNGs and exited 0. Driving this function with a real argv array is what
	 * makes the choice of index an assertion rather than a comment.
	 */
	it('reads the entry from argv[2] and turns it into the entry shots', () => {
		const argv = ['node', 'scripts/harness-shot.mjs', 'prototype:ZoneSummary'];

		expect(resolveShots(argv, FIXED)).toEqual(entryShots('prototype:ZoneSummary'));
	});

	it('falls back to the fixed shots only when no entry argument is present at all', () => {
		expect(resolveShots(['node', 'scripts/harness-shot.mjs'], FIXED)).toBe(FIXED);
	});

	/**
	 * `npm run harness-shot ""` is a mistake, not an absent argument. Truthiness alone cannot
	 * tell the two apart — `''` and `undefined` are both falsy — so a quoted empty string used
	 * to run the five fixed shots and exit 0 rather than reporting an unnamed entry.
	 */
	it('rejects a blank entry rather than silently falling back to the fixed shots', () => {
		expect(() => resolveShots(['node', 'scripts/harness-shot.mjs', ''], FIXED)).toThrow(/empty/);
		expect(() => resolveShots(['node', 'scripts/harness-shot.mjs', '   '], FIXED)).toThrow(/empty/);
	});
});
