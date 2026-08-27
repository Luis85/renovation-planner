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
		// `&bare` on both: a capture asks the index to draw the stage and nothing else, since
		// the picker is a fixed-width sidebar that a narrow shot would otherwise spend a third
		// of its width on. `tests/harness/indexChrome.test.ts` drives the other end of it.
		expect(dark.query).toBe('?entry=prototype%3AZoneSummary&bare');
		expect(light.query).toBe('?entry=prototype%3AZoneSummary&theme=light&bare');
		// The filename may not carry `:` or `/` — both legal in the URL, both reserved in a
		// Windows filename, and Windows is one of the four `npm run check` legs. All nine
		// reserved characters are covered by the dedicated case below, which also states what
		// "reserved" leaves out; this one is the readable id example above it.
		expect(dark.name).not.toMatch(/[:/\\]/);
		expect(dark.name).toBe(`entry-prototype-ZoneSummary-${digestOf('prototype:ZoneSummary')}-dark`);
	});

	/**
	 * The set the sanitiser has to cover is `< > : " / \ | ? *` — the nine PRINTABLE characters
	 * Windows reserves in a filename, which is narrower than "every character Windows refuses"
	 * and is the honest sentence: Windows also rejects the control characters 0–31 and the
	 * reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`…). Both of those are covered by
	 * the allowlist BY CONSTRUCTION rather than by this case, and saying so costs a clause: only
	 * `[a-zA-Z0-9]` survives, so no control character can, and the result always carries
	 * `entry-` in front of it and `-<digest>-<scheme>` behind it, which no device name can equal.
	 * The nine are the ones a real id can plausibly carry and the ones a DENYLIST would get
	 * wrong, so they are the ones driven.
	 *
	 * The id itself is not what limits the check: `entryShots`
	 * sanitises with an ALLOWLIST (`replace(/[^a-zA-Z0-9]+/g, '-')`), which covers the whole
	 * set by construction. A previous version of this coverage drove only `:` and `/`, the two
	 * characters a URL-shaped id happens to carry; that passed just as readily against a
	 * DENYLIST sanitiser (`replace(/[:/]+/g, '-')`) that left `< > " | ? *` untouched, which
	 * would still be a leg-specific failure nobody reproduces locally. Driving every illegal
	 * character at once is what actually distinguishes the two implementations.
	 */
	it('strips every reserved Windows filename character, not merely the two a URL-shaped id carries', () => {
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
	 * the ten fixed PNGs and exited 0. Driving this function with a real argv array is what
	 * makes the choice of index an assertion rather than a comment.
	 */
	it('reads the entry from the first non-flag argument and turns it into the entry shots', () => {
		const argv = ['node', 'scripts/harness-shot.mjs', 'prototype:ZoneSummary'];

		expect(resolveShots(argv, FIXED)).toEqual(entryShots('prototype:ZoneSummary'));
	});

	it('falls back to the fixed shots only when no entry argument is present at all', () => {
		expect(resolveShots(['node', 'scripts/harness-shot.mjs'], FIXED)).toBe(FIXED);
	});

	/**
	 * `npm run harness-shot ""` is a mistake, not an absent argument. Truthiness alone cannot
	 * tell the two apart — `''` and `undefined` are both falsy — so a quoted empty string used
	 * to run the ten fixed shots and exit 0 rather than reporting an unnamed entry.
	 */
	it('rejects a blank entry rather than silently falling back to the fixed shots', () => {
		expect(() => resolveShots(['node', 'scripts/harness-shot.mjs', ''], FIXED)).toThrow(/empty/);
		expect(() => resolveShots(['node', 'scripts/harness-shot.mjs', '   '], FIXED)).toThrow(/empty/);
	});
});

/**
 * `--width`, which exists because the first real use of `harness-shot <id>` hit exactly the
 * defect the fixed 1280 cannot see: a mock that looked right wide had every name ellipsed to a
 * prefix at 460, with `npm run check` green for both. An Obsidian sidebar leaf is routinely
 * under 400px, so the single width this command offered was one the host often does not give.
 */
describe('resolveShots, on --width', () => {
	const fixed = [{ name: 'dark', query: '', selector: '.renovation-planner-view' }];
	const shotsFor = (...args: string[]) => resolveShots(['node', 'script', ...args], fixed);

	it.each([
		['after the entry', ['prototype:X', '--width=460']],
		['before it', ['--width=460', 'prototype:X']],
	])('takes the flag %s, since a flag is recognised by its shape and not its position', (_where, args) => {
		expect(shotsFor(...args).map((shot) => shot.width)).toEqual([460, 460]);
	});

	/**
	 * The width is in the FILENAME, and this is the case that matters most: without it a narrow
	 * capture overwrites the wide one of the same entry, which is the same silent collision the
	 * digest exists to prevent — two different pictures, one pair of files, no error.
	 */
	it('names the file after the width, so two widths of one entry are two pictures', () => {
		const wide = shotsFor('prototype:X').map((shot) => shot.name);
		const narrow = shotsFor('prototype:X', '--width=460').map((shot) => shot.name);

		expect(narrow).toEqual(wide.map((name) => name.replace(/-(dark|light)$/, '-w460-$1')));
		expect(new Set([...wide, ...narrow]).size).toBe(4);
	});

	// Absent from the name when absent from the command, so default filenames do not churn.
	it('leaves the filename and the width alone when the flag is not given', () => {
		expect(shotsFor('prototype:X').map((shot) => shot.width)).toEqual([undefined, undefined]);
		expect(shotsFor('prototype:X')[0].name).not.toContain('-w');
	});

	it.each([
		['a value that is not a number', '--width=wide', '--width takes a number of pixels'],
		['a width of zero', '--width=0', '--width must be between 1 and 4096'],
		['a width past the cap', '--width=99999', '--width must be between 1 and 4096'],
		// A typo'd flag taken as the entry name would be reported by the BROWSER, seconds
		// later, as "no entry named --wdith=460" — a message about the wrong thing.
		['a misspelt flag', '--wdith=460', 'unknown option --wdith=460'],
	])('refuses %s', (_what, flag, message) => {
		expect(() => shotsFor('prototype:X', flag)).toThrow(message);
	});

	/**
	 * A repeated flag, which is the same defect as a second entry and was NOT refused: the
	 * parse took `.at(-1)`, so `--width=460 --width=1280` captured 1280 and exited 0 with the
	 * 460 silently dropped. The comment beside it claimed every malformed invocation here is
	 * refused, so the file asserted the rule its own code broke.
	 */
	it('refuses a repeated width rather than serving the last one', () => {
		expect(() => shotsFor('prototype:X', '--width=460', '--width=1280')).toThrow(
			'one --width at a time; got 2: 460, 1280',
		);
	});

	/**
	 * Two entries is a mistake, not a request this command can serve. Taking the first and
	 * discarding the rest would write successful PNGs for A and exit 0 while B — asked for in the
	 * same breath — was never captured and never mentioned, which is the silent wrong-picture
	 * outcome every other refusal in this function exists to prevent.
	 */
	it('refuses a second entry rather than capturing the first and dropping it', () => {
		expect(() => shotsFor('prototype:A', 'prototype:B')).toThrow('one entry at a time; got 2');
	});

	// The flag must not be counted as one of them.
	it('still takes one entry when a flag sits beside it', () => {
		expect(shotsFor('prototype:A', '--width=460').map((shot) => shot.width)).toEqual([460, 460]);
	});

	// The fixed set carries its own viewports, `?phone` among them, so this command cannot mean
	// what it says and is refused rather than quietly ignored.
	it('refuses a width with no entry to apply it to', () => {
		expect(() => shotsFor('--width=460')).toThrow('--width applies to a named entry');
	});

	/**
	 * The mistake this repository's own README shipped with: `npm run harness-shot X
	 * --width=460` never reaches the script, because npm claims an unknown flag as its own
	 * config and exports it as `npm_config_width`. The capture then runs at the DEFAULT width,
	 * writes two PNGs and exits 0 — a wrong picture with no signal at all, which is the precise
	 * failure `--width` exists to prevent. Found by running the documented line.
	 */
	it('refuses the spelling npm eats, rather than capturing at the wrong width', () => {
		expect(() => resolveShots(['node', 'script', 'prototype:X'], fixed, { npm_config_width: '460' })).toThrow(
			'npm run harness-shot <id> -- --width=460',
		);
	});

	// Only when the flag is genuinely absent: the correct spelling sets both, since npm exports
	// its config either way, and reporting an error for a command that worked would be worse
	// than the silence this replaces.
	it('says nothing when the flag arrived properly, even with npm config set beside it', () => {
		const shots = resolveShots(['node', 'script', 'prototype:X', '--width=460'], fixed, { npm_config_width: '460' });

		expect(shots.map((shot) => shot.width)).toEqual([460, 460]);
	});
});
