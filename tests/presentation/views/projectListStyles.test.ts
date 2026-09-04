import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * jsdom resolves no CSS, so a class whose rule is one word off renders the base look with
 * every mounted test green — the defect this repository has already shipped once
 * (`rp-save-state-error` against an emitted `rp-save-state-save-error`). This asserts the sheet
 * declares what the template emits.
 *
 * It reads DECLARATIONS and never the cascade, and it measures no position: spacing, wrapping,
 * overflow and contrast are settled by a capture and by nothing here.
 *
 * **COMMENTS STRIPPED, and that is load-bearing rather than tidy.** This sheet documents its own
 * class names in prose — the narrow block's header explains why the `order` rules are scoped to
 * `.rp-project-row` — so a raw read counts a sentence ABOUT a rule as the rule. Measured, not
 * reasoned: with the raw text, renaming `.rp-project-row` out of every selector in the file left
 * all five cases green, because the comments still named it. `prototype-styles.test.ts` states
 * the same rule for the same reason, and this file did not follow it until a mutation said so.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const sheet = readFileSync('styles/project-list.css', 'utf8').replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

/**
 * A class declared as a class OF ITS OWN — the name not run on into a longer one.
 *
 * A bare `includes('.rp-project-row__tick')` is satisfied by `.rp-project-row__tick--reached`,
 * and `.rp-project-row` by any of the five `__` names beneath it, so a substring reading is a
 * no-op assertion for exactly the entries whose rules a later task is most likely to fold away.
 * `[\w-]` is the negative lookahead because both `_` and `-` continue a class name here.
 */
const declaresClass = (cls: string): boolean => new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet);

describe('project-list.css', () => {
	/**
	 * The classes THIS SHEET owns, which is narrower than "every class the row emits" and is the
	 * honest name: `ProjectRow` also emits `rp-project-list__row`, `__name`, `__status` and
	 * `__overlap`, and those are declared by `list-row.css`, `forms.css` and
	 * `project-list-overlap.css` — deliberately, since each carries a capture-found rule argued
	 * for where it lives. `projectListOverlap.test.ts` holds the last of them.
	 *
	 * `rp-project-row` itself is in the list: this sheet is its ONLY declarer, so nothing else
	 * would notice it being renamed. So is `rp-project-row__match`, which arrived with the
	 * filter line and which no other sheet touches.
	 *
	 * The five `rp-project-filter*` names LEFT this list in Task 12, when they left this sheet:
	 * `styles/project-filter.css` declares them now and `projectFilterStyles.test.ts` is what
	 * holds them. `rp-project-row` LEFT it in Task D for the same reason — the narrow block was
	 * that class's only bare declarer here, and `projectListNarrowStyles.test.ts` holds it now.
	 * Neither is merely dropped: a name removed from a list is a name nothing checks, which is
	 * the failure `harness-shot.test.ts`'s own fixed-shot list had.
	 *
	 * `rp-project-row__status-word` JOINED it in Task D. It is a span that exists for exactly one
	 * rule — the reserved `min-width` that makes the status words a column — so a build that kept
	 * the span and lost the rule would draw the pre-armature picture with every mounted case
	 * green.
	 *
	 * `.rp-view-notice` is deliberately NOT here even though `ProjectList` emits it since the
	 * filter line's task: `view.css` declares it, and it moved COMPONENT without moving sheet.
	 */
	it('declares every class the row emits that this sheet owns', () => {
		for (const cls of [
			'rp-project-row__facts',
			'rp-project-row__status',
			'rp-project-row__status-word',
			'rp-project-row__ticks',
			'rp-project-row__tick',
			'rp-project-row__tick--reached',
			'rp-project-row__match',
		]) {
			expect(declaresClass(cls), `.${cls} is declared as a class of its own`).toBe(true);
		}
	});

	/**
	 * The instrument, before its result is trusted — both halves, since either one silently turns
	 * every entry above into a pass that proves nothing.
	 *
	 * The lookahead: a longer class must not answer for the shorter one it starts with.
	 * The strip: a comment naming a class must not answer for a rule declaring it — the defect a
	 * mutation actually found here, and the one no assertion above could have shown, because a
	 * sheet that documents itself looks identical to one that declares itself.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(declaresClass('rp-project-row__tick')).toBe(true);
		expect(new RegExp(String.raw`\.rp-project-row__tick(?![\w-])`, 'u').test('.rp-project-row__tick--reached {')).toBe(false);
	});

	it('reads a class named in prose as prose, not as a declaration', () => {
		expect(sheet).not.toContain('Task 11');
		expect('/* mentions .rp-gone here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * THE STRIP'S TWO STATES, at the two Obsidian tokens the design spec §6 names.
	 *
	 * `--text-muted` was tried for the unreached cells in Task D and measured worse: it makes an
	 * unreached cell easy to see against the page and drops reached-against-unreached to 1.50:1
	 * in the dark scheme, which is the distinction the strip exists to carry. The sheet's own
	 * comment holds the whole table. This case is what stops that swap coming back as a tidy-up.
	 *
	 * The spec's own sentence also says `currentColor`, and the two halves cannot both hold —
	 * `currentColor` resolves to ONE inherited colour, so it draws the strip's shape and cannot
	 * draw a reached cell differently from an unreached one, which is the whole of what the
	 * strip is for. So this asserts the CONTRACT rather than the mechanism, and it asserts both
	 * ends: a build that gave the reached rule the same token as the base rule would satisfy
	 * "the sheet declares this class" while drawing a strip that says nothing.
	 *
	 * `styles-assemble.mjs` already fails the build on a literal colour, so this adds nothing
	 * about the themed-vault half and deliberately does not restate it: both a `var()` on an
	 * Obsidian token and `currentColor` clear that gate, which is why the gate is not what
	 * decides between them.
	 */
	it('draws a reached cell differently from an unreached one, at Obsidian tokens', () => {
		expect(bodyOf('.rp-project-row__tick')).toContain('background-color: var(--text-faint)');
		expect(bodyOf('.rp-project-row__tick--reached')).toContain('background-color: var(--text-normal)');
	});

	/**
	 * TEN CELLS THAT CAN BE COUNTED. The strip shipped at 3px cells with 1px gaps and the first
	 * picture of it read as one filled bar — a proportion, which is the one thing §6 argues a
	 * strip is NOT: it is a positional map of a ten-member enum, and a reader who cannot count
	 * the cells is not reading it.
	 *
	 * Asserted as a PAIR because the gap is half the mechanism: ten 4px cells at a 1px gap read
	 * very nearly as solid, so a build that widened the cell alone would satisfy a single-value
	 * assertion and draw the defect. Whether ten can actually be counted is a question only a
	 * capture answers — this pins the two numbers that capture was taken against.
	 */
	it('draws cells wide enough, and gapped enough, to be counted', () => {
		expect(bodyOf('.rp-project-row__tick')).toContain('width: 4px');
		expect(bodyOf('.rp-project-row__ticks')).toContain('gap: 2px');
	});

	/**
	 * THE COLUMN ARMATURE (design spec §3), which is the one raise this direction was given that
	 * shipped unmet: before Task D exactly one edge aligned across rows — the strip's right edge,
	 * and only because it is last in a right-packed cluster.
	 *
	 * All four declarations, because each alone leaves the defect. Without a `min-width` the slot
	 * is shrink-to-fit and there is no column at all; without `text-align: right` the reserved
	 * slack falls inside a column instead of between two, which for the status separates the word
	 * from the strip that is its own positional map.
	 *
	 * The UNITS are asserted, not the numbers. `ch` is the claim — the widths follow the font the
	 * host gives us, which is the same reason the container threshold is in `rem` — and the two
	 * integers are measurements recorded in the sheet's own prose, where a later locale can
	 * re-derive them rather than trust them.
	 *
	 * The facts reservation is read through its SCOPED selector, which is load-bearing: the
	 * Continue row reuses `.rp-project-row__facts` for its date, and an unqualified rule indented
	 * that date 22px from the leading edge on the narrow row's second line. Reading the bare
	 * selector here would go on passing against exactly that build.
	 */
	it('reserves both trailing slots in ch, and puts the slack between the columns', () => {
		const facts = bodyOf('.rp-project-row .rp-project-row__facts');
		const word = bodyOf('.rp-project-row__status-word');

		expect(facts).toMatch(/min-width: \d+ch/u);
		expect(facts).toContain('text-align: right');
		expect(word).toMatch(/min-width: \d+ch/u);
		expect(word).toContain('text-align: right');
	});

	/**
	 * Fix round 1's finding: `display: inline` on the shared `.rp-project-list__group-title`
	 * rule made its own `padding-block-end` a no-op for BOTH callers, under a comment claiming
	 * real space below the heading. The base rule is a plain block box now, and only the
	 * `<summary>` caller — the one that actually needs to sit on the disclosure triangle's own
	 * line — gets `inline`, with its own `padding-block-end` reset to `0` explicitly rather than
	 * left inherited and dead. Asserted as a PAIR: a build that put `inline` back on the base
	 * rule, or dropped the override's explicit reset, satisfies "declares the class" while
	 * reintroducing the exact defect this fixes.
	 */
	it('keeps the shared group-title block, so its bottom padding is real space', () => {
		const base = bodyOf('.rp-project-list__group-title');
		expect(base).not.toContain('display: inline');
		expect(base).toMatch(/padding:\s*0\s+var\(--size-4-2\)\s+var\(--size-2-2\)/);
	});

	it('sets the group title inline only inside the summary it shares the line with', () => {
		const summaryTitle = bodyOf('.rp-project-list__completed > summary .rp-project-list__group-title');
		expect(summaryTitle).toContain('display: inline');
		// Reset rather than inherited: an inline box cannot apply this anyway, so a left-over
		// non-zero value here would be exactly the dead declaration this fix removes elsewhere.
		expect(summaryTitle).toContain('padding-block-end: 0');
	});

	/**
	 * WEIGHT, NOT COLOUR, for the matched run — the house rule (*colour reinforces, it never
	 * carries*) applied to a highlight. Both halves: a rule that added a colour would still
	 * satisfy "declares this class" while making the highlight a channel a themed vault, a
	 * colour-blind reader or a monochrome display can lose.
	 *
	 * `styles-assemble.mjs` already fails the build on a literal colour, so this is not about
	 * the token — a `var(--text-accent)` here would clear that gate and still be the wrong
	 * design.
	 */
	it('marks the matched run by weight and gives it no colour of its own', () => {
		const body = bodyOf('.rp-project-row__match');

		expect(body).toContain('font-weight: var(--font-semibold)');
		expect(body).not.toContain('color');
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-list.css');
	});
});
