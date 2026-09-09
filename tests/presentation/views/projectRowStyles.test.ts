import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { de } from '../../../src/presentation/i18n/locales/de';
import { PROJECT_STATUS_LABELS } from '../../../src/presentation/views/projectStatusLabels';

/**
 * `styles/project-row.css` — the P00/P06 row anatomy: the two glyph tracks, the shared column
 * armature, the status pill and the wide-width column heading strip.
 *
 * jsdom resolves no CSS and lays nothing out, so nothing here measures a width or a position:
 * whether the headings actually sit over their columns is settled by a capture. What this
 * asserts is that the sheet DECLARES the mechanism — a class whose rule is one word off renders
 * the base look with every mounted test green, which is the defect this repository has already
 * shipped once (`rp-save-state-error` against an emitted `rp-save-state-save-error`).
 *
 * **COMMENTS STRIPPED**, for the reason `projectListStyles.test.ts` measured rather than
 * assumed: this sheet documents its own class names in prose, so a raw read counts a sentence
 * ABOUT a rule as the rule.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const raw = readFileSync('styles/project-row.css', 'utf8');
const sheet = raw.replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

const declaresClass = (cls: string): boolean => new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet);

describe('project-row.css', () => {
	it('declares every class the P00 row anatomy emits', () => {
		for (const cls of [
			'rp-project-row__glyph',
			'rp-project-row__chevron',
			'rp-project-row__plans',
			'rp-project-row__currency',
			'rp-project-row__worked',
			'rp-project-row__pill',
			'rp-project-row__dot',
			'rp-project-list__columns',
			'rp-project-list__column',
		]) {
			expect(declaresClass(cls), `.${cls} is declared as a class of its own`).toBe(true);
		}
	});

	/**
	 * The instrument, before its results are trusted — both halves, since either one silently
	 * turns every entry above into a pass that proves nothing.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(new RegExp(String.raw`\.rp-project-row(?![\w-])`, 'u').test('.rp-project-row__pill {')).toBe(false);
	});

	it('reads a class named in prose as prose, not as a declaration', () => {
		expect('/* mentions .rp-gone here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * **ONE TRACK LIST, READ BY BOTH THE ROWS AND THE HEADING STRIP.** The whole point of the
	 * custom property is that the headings sit over the columns they name by construction rather
	 * than by two lists somebody keeps equal — so a build that spelled the tracks out twice
	 * would draw correctly on the day it landed and drift on the next edit, which no gate here
	 * could see. Both consumers are asserted to read the VARIABLE.
	 */
	it('shares one track list between the rows and the heading strip', () => {
		expect(bodyOf('.rp-project-list__group')).toContain('--rp-project-columns:');
		expect(bodyOf('.rp-project-list .rp-project-row')).toContain('grid-template-columns: var(--rp-project-columns)');
		expect(bodyOf('.rp-project-list__columns')).toContain('grid-template-columns: var(--rp-project-columns)');
	});

	/**
	 * **`rem` AND NOT `ch`, and this is a correctness requirement rather than a preference.**
	 * `var()` substitutes the TEXT of a value, so a `ch` track resolves against each consumer's
	 * OWN font size — and the two consumers have different ones: the heading strip inherits the
	 * pane's, while the row is a `<button>` wearing Obsidian's `--font-ui-small`. The headings
	 * would sit a few pixels off their columns, in a way only a capture could show.
	 *
	 * The two glyph tracks are asserted separately and for the opposite reason: they must NOT be
	 * `auto`, which sizes to content — and the strip has no glyph and no chevron, so its first
	 * and last tracks would collapse to zero and shift all five headings one column left.
	 * Measured off `home-whole` before the fix: `Project` rendered as `P…` above the house icon.
	 */
	it('states the shared tracks in rem, with the two glyph tracks fixed rather than auto', () => {
		const tracks = /--rp-project-columns:([^;]+);/u.exec(bodyOf('.rp-project-list__group'))?.[1] ?? '';

		expect(tracks).not.toMatch(/\dch/u);
		expect(tracks).toMatch(/rem/u);
		// First and last, which are the two the strip has no content for.
		expect(tracks.trim().startsWith('var(--icon-size')).toBe(true);
		expect(tracks.trim().endsWith('var(--icon-size, 18px)')).toBe(true);
	});

	/**
	 * **THE FIRST HEADING IS PLACED AND THE OTHER FOUR AUTO-PLACE.** Track 1 is the row's glyph
	 * and has no name, so without this the strip starts one column too far left — the defect
	 * above, met from the other side. `:first-child` rather than a modifier class, because the
	 * headings are drawn by a `v-for` over a key list and a per-item class is a second thing to
	 * keep in step with the order.
	 */
	it('starts the heading strip at the name’s own track', () => {
		expect(bodyOf('.rp-project-list__column:first-child')).toContain('grid-column: 2');
	});

	/**
	 * **EVERY ROW CHILD IS PLACED EXPLICITLY, and auto-placement is not an option here rather
	 * than not a preference.** Two children are `v-if`'d — the plan count on a project with none,
	 * and PRD §83's marker — so auto-placement slides the chevron out of its own track on exactly
	 * the rows those are absent from. Measured as a mutation: dropping these puts the chevron in
	 * the `Last worked` column on any project with zero plans.
	 *
	 * All seven, because a missing one is a silent single-column shift for a subset of rows.
	 */
	it('places every row child in its own track', () => {
		const placements = [
			['.rp-project-row__glyph', '1'],
			['.rp-project-row .rp-project-list__name', '2'],
			['.rp-project-row__plans', '3'],
			['.rp-project-row__currency', '4'],
			['.rp-project-row .rp-project-row__status', '5'],
			['.rp-project-row__worked', '6'],
			['.rp-project-row__chevron', '7'],
		] as const;

		// Compared as a whole so a failure names the child that lost its track, rather than
		// stopping at the first one.
		expect(placements.map(([selector, track]) => [selector, bodyOf(selector).includes(`grid-column: ${track}`)]))
			.toEqual(placements.map(([selector]) => [selector, true]));
	});

	/**
	 * **`height: auto` IS LOAD-BEARING AND ITS ABSENCE IS A DEFECT THIS SURFACE HAS SHIPPED
	 * TWICE.** A row is a `<button>` and Obsidian's own rule sets `height: var(--input-height)` —
	 * a FIXED 30px — so a row with more content OVERFLOWS rather than growing, and the §83 marker
	 * now takes a second grid line. It is needed at BOTH widths, not only at narrow where
	 * `project-list-narrow.css` already had it.
	 */
	it('releases the fixed button height so the row can grow', () => {
		expect(bodyOf('.rp-project-list .rp-project-row')).toContain('height: auto');
	});

	/**
	 * **THE §83 MARKER TAKES A GRID LINE OF ITS OWN.** It is `flex-shrink: 0` by its own sheet's
	 * deliberate rule — a truncated warning no longer says what it is about — so putting it in
	 * any data track would either widen that track for every row or clip the sentence. An
	 * implicit second row costs the marked row its own height and costs an unmarked one nothing.
	 */
	it('gives the overlap marker its own line rather than a data column', () => {
		const body = bodyOf('.rp-project-row .rp-project-list__overlap');

		expect(body).toContain('grid-column: 2 / -1');
		expect(body).toContain('grid-row: 2');
	});

	/**
	 * **THE PILL'S TINT IS NOT `--background-modifier-hover`, and that is measured rather than
	 * stylistic**: `list-row.css` gives the ROW that exact colour on `:hover`, so a hovered row
	 * would swallow its own pill. `--background-secondary` is also the token the Continue card
	 * wears, which is what keeps the surface's two tinted blocks on one tint.
	 */
	it('tints the pill with a token the row’s own hover cannot swallow', () => {
		const body = bodyOf('.rp-project-row__pill');

		expect(body).toContain('background-color: var(--background-secondary)');
		expect(body).not.toContain('--background-modifier-hover');
	});

	/**
	 * **ONE DOT COLOUR FOR EVERY STATUS.** A status-to-colour mapping is a mapping this design
	 * package does not define, and ten statuses would need ten tokens, each a claim about what
	 * that stage MEANS. The sheet declares exactly one background for the dot and no modifier
	 * rule beside it; `projectRow.test.ts` holds the other end, that the component emits no
	 * modifier class for one to key on.
	 */
	it('gives the dot one accent colour and no per-status rule', () => {
		expect(bodyOf('.rp-project-row__dot')).toContain('background-color: var(--text-accent)');
		expect(sheet).not.toMatch(/\.rp-project-row__dot--/u);
	});

	/**
	 * **THE ROW RULE SITS BETWEEN ROWS AND NEVER AROUND THEM.** A border on every row draws a box
	 * per project, which is the outlined-box composition `list-row.css` records stripping
	 * `box-shadow` to escape. `li + li` puts it on the join, so the first row has no line above
	 * it and the last none below.
	 */
	it('separates rows with a rule on the join, not a box around each', () => {
		expect(bodyOf('.rp-project-list > li + li')).toContain('border-top:');
		expect(sheet).not.toMatch(/^\.rp-project-list > li \{/mu);
	});

	/**
	 * **THE PREMISE UNDER THE STATUS TRACK, which lives only in prose and predicts its own
	 * failure.** That track is sized for the longest translated stage word across `en.ts` and
	 * `de.ts` — `Bestandsdokumentation` (AS_BUILT), measured AS A PILL — and the sheet's own
	 * comment, plus `project-list-narrow.css`'s threshold derivation which multiplies this track
	 * into the container query, both say so in sentences.
	 *
	 * **This case MOVED here from `projectListStyles.test.ts` with the track it is about**, and
	 * it is the one instrument standing between a German retranslation and a silently broken
	 * column: a label retranslated longer moves both the track and the 43rem threshold, and
	 * nothing else here would show it.
	 *
	 * **What it CANNOT do, said plainly.** It compares CHARACTER COUNTS to pick the winner, and
	 * the track is in `rem` — different numbers, and jsdom measures no text, so no test here can
	 * derive a width from a string. A NEW winner still needs a human to re-measure it in a
	 * browser; this case is what tells them to, which is the whole gap it closes.
	 *
	 * Guarded against matching nothing at both ends: ten labels must resolve, and the recorded
	 * line must parse. A regex that stops reaching either fails here rather than going quiet.
	 */
	it('sizes the status track from the longest stage word the locale tables actually hold', () => {
		const german = Object.values(PROJECT_STATUS_LABELS).map((key) => de[key]);

		expect(german.filter((label) => label !== undefined)).toHaveLength(german.length);

		const longest = german.reduce((winner, label) => ((label ?? '').length > (winner ?? '').length ? label : winner), '');
		// The sheet's own sentence: the word, and the width it was measured at as a PILL.
		const recorded = /`(\w+)` is measured AS A PILL \(([\d.]+)\)/u.exec(raw);
		// The track the sheet actually ships for the status, in rem, from the shared track list.
		const track = /--rp-project-columns:(?:[^;]*?\s)(\d+(?:\.\d+)?)rem 8rem/u.exec(sheet);

		expect(recorded, 'the sheet records which word the status track was sized from').not.toBeNull();
		expect(track, 'the shared track list states a rem width for the status column').not.toBeNull();
		expect(recorded?.[1], 'the recorded winner is still the longest German stage word').toBe(longest);
		// The derivation re-run: the recorded pill width must still fit the shipped track, at
		// the 16px root the sheet's own arithmetic is stated against. A track shrunk below the
		// figure it was sized from fails here.
		expect(Number.parseFloat(track?.[1] ?? 'NaN') * 16)
			.toBeGreaterThanOrEqual(Number.parseFloat(recorded?.[2] ?? 'NaN'));
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-row.css');
	});
});
