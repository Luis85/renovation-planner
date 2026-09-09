import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `styles/project-list-narrow.css` — the Home surface's narrow composition, split out of
 * `project-list.css` in Task D when that file hit the 400-line cap for the third time.
 *
 * jsdom resolves no CSS and lays nothing out, so nothing here measures a width, a wrap or a
 * position: whether the row actually becomes two lines at 460px is settled by a capture. What
 * this asserts is that the sheet DECLARES the mechanism — a class whose rule is one word off
 * renders the base look with every mounted test green, which is the defect this repository has
 * already shipped once (`rp-save-state-error` against an emitted `rp-save-state-save-error`).
 *
 * It also inherits `.rp-project-row` from `projectListStyles.test.ts`'s list, which stopped
 * being declared in that sheet when this block left it. A name dropped from one list and added
 * to no other is a name nothing checks, which is the failure `harness-shot.test.ts`'s own
 * fixed-shot list turned out to have.
 *
 * **COMMENTS STRIPPED, and here that is a LIVE instrument rather than a precaution** — which is
 * measured rather than borrowed from the sibling files' weaker claim. This sheet's prose names
 * `.rp-project-row` in three separate paragraphs, so renaming that class out of every SELECTOR
 * in the file leaves the first case below GREEN when the strip is removed and turns it RED when
 * it is there. Both halves were run rather than reasoned: 4 of 11 cases red with the strip, 3 of
 * 11 without it, and the case that changes is the one this paragraph is about.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const sheet = readFileSync('styles/project-list-narrow.css', 'utf8').replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

const declaresClass = (cls: string): boolean => new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet);

describe('project-list-narrow.css', () => {
	/**
	 * The classes this sheet NARROWS. It owns none of them exclusively and that is the point —
	 * it is a STATE rather than a region, so every name here is declared somewhere else too and
	 * this file is what changes at width. `.rp-project-row` is in the list because this sheet is
	 * now its only bare declarer.
	 */
	it('addresses every class its narrow composition moves', () => {
		for (const cls of [
			'rp-project-list',
			'rp-project-list__group',
			'rp-project-list__columns',
			'rp-project-row',
			'rp-continue',
			'rp-continue__actions',
			'rp-project-list__name',
			'rp-project-row__glyph',
			'rp-project-row__chevron',
			'rp-project-row__plans',
			'rp-project-row__currency',
			'rp-project-row__worked',
			'rp-project-row__status',
			'rp-project-list__overlap',
		]) {
			expect(declaresClass(cls), `.${cls} is addressed as a class of its own`).toBe(true);
		}
	});

	/**
	 * The instrument, before its results are trusted — both halves, since either one silently
	 * turns every entry above into a pass that proves nothing.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(new RegExp(String.raw`\.rp-project-row(?![\w-])`, 'u').test('.rp-project-row__facts {')).toBe(false);
	});

	it('reads a class named in prose as prose, not as a declaration', () => {
		expect('/* mentions .rp-gone here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * A CONTAINER query, never a media query. The pane's width is the leaf's, not the window's;
	 * a media query asks the wrong element, and it is a mistake that looks correct at 1280 and
	 * only at 1280. Moved here from `projectListStyles.test.ts` with the block it is about.
	 */
	it('narrows inside a CONTAINER query, not a media query', () => {
		expect(sheet).toContain('@container rp-project-list');
		expect(sheet).not.toContain('@media');
	});

	/**
	 * BOTH halves of the container declaration, because a `container-name` without a
	 * `container-type` establishes no containment at all — the query would then match nothing
	 * and every row would stay on one line at every width, silently, with this file's other
	 * cases still green.
	 */
	/**
	 * BOTH CONTAINERS, and the second one is what makes P00's column heading strip narrow with
	 * the rows it heads. That strip is a SIBLING of the `<ul>` — it has to be, or it becomes an
	 * item in the list a screen reader counts — so it is outside the `<ul>`'s containment
	 * entirely and resolves against the group instead. Without the group declaration the strip
	 * would stay on screen at every width, drawing five headings over rows that are no longer
	 * columns, and every other case in this file would still be green.
	 */
	it('establishes the container it queries by name AND by type, on BOTH boxes', () => {
		const body = bodyOf('.rp-project-list,\n.rp-project-list__group');

		expect(body).toContain('container-type: inline-size');
		expect(body).toContain('container-name: rp-project-list');
	});

	/**
	 * The threshold is in `rem`. It has to follow the user's interface font size, because both
	 * halves of the sum it was derived from — the name's room and the trailing group's — move
	 * with it; a `px` threshold is one root size's answer frozen as a constant.
	 */
	it('states its threshold in rem, so it follows the interface font size', () => {
		expect(sheet).toMatch(/@container rp-project-list \(max-width: \d+rem\)/u);
	});

	/**
	 * THE DERIVATION MUST PRODUCE THE NUMBER BESIDE IT, which is the one property a recorded
	 * arithmetic has that a bare number does not — and the first version of this sheet did not
	 * have it. It wrote `32 + 2 × 314.5 = 661px → 42rem`, reading 32 as the row's padding plus
	 * BOTH its gaps, while the 314.5 already itemises the facts↔status gap: one 8px paid twice.
	 * The rule's real output is 653px → 41rem. The shipped 42rem was harmless in pixels and not
	 * harmless in the record, because a reader who does what the file asks — re-derive rather
	 * than trust — gets a different number and concludes the file is wrong. Found in review.
	 *
	 * Read off the RAW text on purpose: the derivation lives in a comment, which is exactly what
	 * every other case in this file strips, so this is the one question that has to ask the
	 * unstripped file. Watched failing against the 42rem pairing before being trusted.
	 */
	/**
	 * EVERY RECORDED SUM MUST EQUAL ITSELF, and this case exists because the narrower one below
	 * has a demonstrated blind spot rather than a theoretical one.
	 *
	 * That case pulls the threshold out of a line shaped `… = Npx → N.Nrem → Nrem`, so its regex
	 * requires TWO arrows — and one commit after it landed, the paragraph EXPLAINING it shipped
	 * `16 + 8 + 2 × 284.0 = 584px → 37rem`, which is 592 and carries one arrow. The identical
	 * defect class, reintroduced in the prose about the correction, one arrow short of the
	 * instrument built for it. Found in review.
	 *
	 * So this asks the question that does not depend on the shape of the line: any expression of
	 * numbers joined by `+` and `×` and followed by `= n` is evaluated, and `n` must be the real
	 * sum.
	 *
	 * **It would NOT have caught the original 42rem defect, and the review round that asked for
	 * this case said it would.** Measured rather than accepted: that line was
	 * `32 + 2 × 314.5 = 661px → 41.3rem → 42rem`, and 32 + 629 IS 661, and 661px IS 42rem once
	 * rounded up, and 42rem is what shipped. Every mechanical check here passes on it. Its error
	 * was in the MODEL — 32 was the wrong overhead, because it counted a gap the 314.5 already
	 * contained — and no arithmetic checker can see a wrong premise. So the two cases in this
	 * file cover a wrong SUM and a wrong TRANSCRIPTION between the derivation and the shipped
	 * rule; a wrong MODEL is caught by a reader re-deriving it from the layout, which is exactly
	 * how that one was caught. Written down because the alternative is a later reader trusting
	 * these two to cover a class they do not reach.
	 *
	 * **What it deliberately does NOT ask**: that every number in the sheet be derivable. A
	 * rounded figure, a measured one and an illustrative example are not arithmetic, and forcing
	 * them to balance would make the sheet's prose unwritable. An `=` with a sum on its left is
	 * the whole of the rule. Two lines here are correctly outside it and are the reason the rule
	 * is spelled this way: `→ 40.8rem → 41rem` is a ROUNDING rather than a sum, and `32 + 2 ×
	 * 314.5` is quoted with no result at all, being the erroneous version this file names.
	 *
	 * **Scoped to this sheet**, which is the one whose header is a derivation. Measured with this
	 * same pattern rather than assumed: it finds **0** in `project-list.css` and **0** in
	 * `project-filter.css`, and exactly the **2** below here. Extending the scan is one more path
	 * in an array on the day a sibling grows one.
	 *
	 * **THE FLOOR IS 2 AND IT WAS 3.** The third derivation this sheet used to record was the
	 * 16ch counter-example — the paragraph working through what shrinking the reserved status
	 * slot would do — and that reservation no longer exists: the P00 grid states the armature as
	 * tracks, so there is no `min-width` to shrink and no counter-example to record. The floor
	 * moved with the sheet rather than being left where it was, because a floor above what the
	 * file actually holds fails on every edit and a floor of zero is an instrument that reaches
	 * nothing and looks identical to a clean sheet.
	 */
	it('balances every arithmetic derivation it records', () => {
		const raw = readFileSync('styles/project-list-narrow.css', 'utf8');
		const term = String.raw`[\d.]+(?:px)?(?:\s*×\s*[\d.]+(?:px)?)*`;
		const sums = new RegExp(String.raw`(${term}(?:\s*\+\s*${term})+)\s*=\s*([\d.]+)`, 'gu');
		const found = [...raw.matchAll(sums)];

		// A widened pattern that matches nothing passes silently and is worse than no test at
		// all. Two derivations are recorded here today — the threshold itself, and the measured
		// counter-example showing what the OLD rule would now produce — so a pattern that stops
		// reaching them fails HERE rather than going quiet.
		expect(found.length, 'the scan reaches the derivations this sheet records').toBeGreaterThanOrEqual(2);

		for (const [, expression, stated] of found) {
			const sum = expression
				.split('+')
				.reduce((total, addend) => total + addend
					.split('×')
					.reduce((product, factor) => product * Number.parseFloat(factor), 1), 0);

			expect(sum, `${expression.replace(/\s+/gu, ' ').trim()} = ${stated}`).toBeCloseTo(Number.parseFloat(stated), 5);
		}
	});

	it('ends its recorded derivation on the threshold it actually ships', () => {
		const raw = readFileSync('styles/project-list-narrow.css', 'utf8');
		const shipped = /@container rp-project-list \(max-width: (\d+)rem\)/u.exec(raw)?.[1];
		const derived = /=\s*\d+px\s+→\s*[\d.]+rem\s+→\s*(\d+)rem/u.exec(raw)?.[1];

		expect(shipped, 'the container query states a whole-rem threshold').toBeDefined();
		expect(derived, 'the comment carries an arithmetic ending in a whole-rem answer').toBeDefined();
		expect(derived).toBe(shipped);
	});

	/**
	 * **THE CROSS-DOCUMENT PIN IS WITHDRAWN, and this paragraph is what is left of it.**
	 *
	 * It compared the shipped threshold against two sentences in
	 * `docs/user-experience/archive/renovation-planner-home-DESIGN-SPEC.md` — §6's derivation and
	 * §13's constraint 3 — and it was a good instrument for exactly as long as that document was
	 * the contract. It is now in `archive/`, and the contract is the design package's `P00` and
	 * `P06`, which state no rem number at all: P06 names 460px as a *reference* and 360px as a
	 * width to test, and neither is a threshold. So the archived spec still says `41rem`, which
	 * was correct for the row it described — a name, a facts slot, a reserved status word and a
	 * ten-cell strip — and is not a number this sheet is obliged to agree with any more.
	 *
	 * **What is LOST by withdrawing it is real and is stated rather than glossed**: the number
	 * now lives in exactly one place that a gate reads (this sheet, held by the two cases above),
	 * and if a future document states it again nothing will compare them. Restoring the pin is
	 * one regex against whichever document becomes normative.
	 *
	 * The case below is the surviving half — the sheet's own derivation against the sheet's own
	 * rule — and it was always the half that could catch a transcription error.
	 */

	/**
	 * P00'S COLUMN HEADING STRIP IS DROPPED (P06: "No forced five columns"). It is the one
	 * element on this surface whose whole reason for existing is the wide composition, so a
	 * build that kept it would draw five headings over three-line rows, and every mounted case
	 * asserting the strip EXISTS would still be green — jsdom resolves no container query.
	 */
	it('drops the column heading strip, which heads nothing once the rows stack', () => {
		expect(bodyOf('.rp-project-list__columns')).toContain('display: none');
	});

	/**
	 * THE ROW'S NARROW TRACKS. Four instead of seven, and both edge tracks are spanned rather
	 * than repeated per line: `grid-row: 1 / span 3` is what puts the leading glyph and the
	 * trailing chevron beside the WHOLE stack rather than beside its first line, which is the
	 * one thing a wrapped flex row could not do and the reason this composition is a grid at
	 * narrow at all.
	 */
	it('restacks the row into four tracks with the two glyphs spanning them', () => {
		expect(bodyOf('.rp-project-list .rp-project-row'))
			.toContain('grid-template-columns: auto max-content minmax(0, 1fr) auto');
		expect(bodyOf('.rp-project-row__glyph,\n\t.rp-project-row__chevron')).toContain('grid-row: 1 / span 3');
	});

	/**
	 * **44 CSS px, P06's stated touch-target goal**, and it is asserted on BOTH the rows and the
	 * completed disclosure because those are the two things a thumb has to hit. `list-row.css`
	 * floors a row at 24px (WCAG 2.5.8's minimum) and this raises it where the pointer is most
	 * likely to be a finger — so a build that dropped this rule would still clear the WCAG floor
	 * and would silently miss the design goal, which is exactly the kind of regression no other
	 * gate here can see.
	 */
	it('raises the hit target to P06’s 44px on the rows and the disclosure', () => {
		expect(bodyOf('.rp-project-list .rp-project-row,\n\t.rp-project-list__completed > summary'))
			.toContain('min-height: 44px');
	});

	/**
	 * **THE EMPTY-SLOT RULE AT NARROW, and it is one selector.** The plan count is `v-if`'d away
	 * on a project with none, so this adjacent-sibling rule matches exactly those rows and moves
	 * the currency into the track the count would have used. Without it `EUR` sits indented
	 * behind an empty column with no heading to explain the gap — the hole in the card the
	 * content rule forbids. Asserted as the SELECTOR rather than as a declaration, because the
	 * declaration alone (`grid-column: 2 / 4`) is what the name already carries.
	 */
	it('closes the empty plan-count column up rather than leaving a gap with no heading', () => {
		expect(bodyOf('.rp-project-row .rp-project-list__name + .rp-project-row__currency'))
			.toContain('grid-column: 2 / 4');
	});

	/**
	 * THE DATE IS DROPPED, and `display: none` is the whole of it — P06 says the date MAY be
	 * omitted and that a visually omitted date retains its value, which is one component at two
	 * widths rather than a second narrow component that never computes it.
	 */
	it('drops the last-worked column', () => {
		expect(bodyOf('.rp-project-row__worked')).toContain('display: none');
	});

	/**
	 * P06'S STACKED CARD ACTIONS. `flex-basis: 100%` is what drops the action group onto its own
	 * line — `flex-direction: column` alone would stack two buttons beside a collapsed name
	 * rather than under it — and `height: auto` is what lets the 44px floor bind at all, since
	 * Obsidian pins a `<button>` at `height: var(--input-height)` and a `min-height` under a
	 * fixed `height` is satisfied by 30px. All three, because any one missing draws a plausible
	 * card that misses the design.
	 */
	it('stacks the continue card’s two actions full width at P06’s hit height', () => {
		expect(bodyOf('.rp-project-list .rp-continue')).toContain('flex-wrap: wrap');

		const actions = bodyOf('.rp-project-list .rp-continue__actions');

		expect(actions).toContain('flex-basis: 100%');
		expect(actions).toContain('flex-direction: column');

		const buttons = bodyOf('.rp-project-list .rp-continue__resume,\n\t.rp-project-list .rp-continue__open');

		expect(buttons).toContain('height: auto');
		expect(buttons).toContain('min-height: 44px');
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-list-narrow.css');
	});
});
