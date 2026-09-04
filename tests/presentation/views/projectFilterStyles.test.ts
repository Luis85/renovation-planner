import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `styles/project-filter.css` — split out of `project-list.css` in Task 12, the second region
 * that file's 400-line cap pushed out in one task.
 *
 * jsdom resolves no CSS, so a class whose rule is one word off renders the base look with every
 * mounted test green. This asserts the sheet declares what `ProjectFilter.vue` emits, and it
 * inherits `projectListStyles.test.ts`'s five names rather than letting them fall out of every
 * list at once — a name dropped from a list is a name nothing checks, which is exactly the
 * failure `harness-shot.test.ts`'s own fixed-shot list turned out to have.
 *
 * It reads DECLARATIONS and never the cascade, and it measures no position: whether the field's
 * edge and a row's text read as one armature is a question only a capture can answer, and that
 * question is recorded in the sheet's own comment rather than asserted here.
 *
 * **COMMENTS STRIPPED, and — as in `continueRowStyles.test.ts` — that is a PRECAUTION here
 * rather than a live instrument.** `projectListStyles.test.ts` strips because a mutation proved
 * it had to: renaming `.rp-project-row` out of every selector there left all five of its cases
 * green, since its comments still named the class. The same mutation was run on this sheet —
 * renaming `.rp-project-filter__count` out of every selector — and it reddens two cases with the
 * strip AND without it, because this sheet's prose describes the count without naming its class.
 *
 * The claim is written this way because the first draft of it asserted the opposite, twice
 * across two files, on no measurement at all. The strip is kept because the sheet is written to
 * explain itself and one added paragraph would make it live; what stops that from being an
 * untested sentence is the case below that drives the mechanism directly.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const sheet = readFileSync('styles/project-filter.css', 'utf8').replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

const declaresClass = (cls: string): boolean => new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet);

describe('project-filter.css', () => {
	it('declares every class the filter line emits', () => {
		for (const cls of [
			'rp-project-filter',
			'rp-project-filter__label',
			'rp-project-filter__field',
			'rp-project-filter__input',
			'rp-project-filter__count',
			'rp-project-filter__announcement',
		]) {
			expect(declaresClass(cls), `.${cls} is declared as a class of its own`).toBe(true);
		}
	});

	/**
	 * The instrument, before its results are trusted: `.rp-project-filter` must not be answered
	 * for by `.rp-project-filter__count`, or the first entry above proves nothing about the one
	 * class every other selector here is built on.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(new RegExp(String.raw`\.rp-project-filter(?![\w-])`, 'u').test('.rp-project-filter__count {')).toBe(false);
	});

	/**
	 * The strip, driven on a synthetic input rather than on this sheet — because on this sheet it
	 * currently changes nothing, as the header records. Driving it here is what makes "comments
	 * stripped" a checked property today rather than a sentence that becomes false the first time
	 * somebody replaces the `replace` with a no-op.
	 */
	it('reads a class named in prose as prose, not as a declaration', () => {
		expect('/* mentions .rp-project-filter__count here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * VISUALLY HIDDEN, not hidden. The label and the live region must both reach assistive
	 * technology, and `display: none` (like the `hidden` attribute) takes an element out of the
	 * accessibility tree along with the picture — which would leave the input with no accessible
	 * name at all and the announcement unspoken, the two things this pair exists for.
	 *
	 * `bodyOf` reaches the shared rule through its SECOND selector, which is the whole body of
	 * the pair; the label alone would need the first.
	 */
	it('hides the label and the announcement from sight without hiding them from assistive technology', () => {
		const body = bodyOf('.rp-project-filter__announcement');

		expect(body).toContain('clip-path: inset(50%)');
		expect(body).not.toContain('display: none');
		expect(body).not.toContain('visibility: hidden');
	});

	/**
	 * THE COUNT IS WHAT THE LINE EXISTS TO STATE, so the INPUT is the half that gives way —
	 * the same division the row makes between its name and its status, and the reason a narrow
	 * leaf still shows `2 of 30` rather than clipping it.
	 *
	 * Both halves, because either alone is satisfiable by a build that has lost the division:
	 * an input that could not grow would leave the count adrift in the middle of the pane, and a
	 * count that could shrink is the thing being protected.
	 */
	it('lets the input take the slack and refuses to shrink the count', () => {
		expect(bodyOf('.rp-project-filter .rp-project-filter__input')).toContain('flex-grow: 1');
		expect(bodyOf('.rp-project-filter__count')).toContain('flex-shrink: 0');
	});

	/**
	 * ONE CONTROL, NOT A BOX BESIDE A NUMBER (Task D). §3's teletext raise is that at rest the
	 * field IS the pane's count line, and the first capture of this surface showed the opposite:
	 * a full-pane-width empty rectangle with `10 projects` floating outside it to the right.
	 *
	 * Asserted as a PAIR, in both directions, because either alone is satisfiable by the defect.
	 * A wrapper that gained a border while the input kept its own draws a box inside a box; an
	 * input stripped of its border with no wrapper to carry one draws a bare line of text where a
	 * field should be. `border: none` is read on the input's own rule rather than inferred from
	 * the wrapper having one.
	 */
	it('moves the border off the input onto the field that holds it and the count', () => {
		expect(bodyOf('.rp-project-filter__field')).toMatch(/border: var\(--input-border-width\) solid/u);
		expect(bodyOf('.rp-project-filter .rp-project-filter__input')).toContain('border: none');
	});

	/**
	 * THE FIELD IS PADDED INLINE ONLY, and `var(--input-padding)` is the tempting wrong answer:
	 * it reads as "what an input is padded by", so wearing it whole looks like faithfully
	 * reproducing the control that used to be here. Obsidian's text input already resolves to a
	 * 30px box from its own line box, so the block half stacks on a height that is already there
	 * — measured, the field came out 40px against the 30px input it replaced, a swell in the one
	 * region sitting directly under the pane's only heading.
	 *
	 * The refusal is what is asserted, because the positive alone (a `0` somewhere in a padding
	 * shorthand) is satisfied by several values that are not this decision.
	 */
	it('pads the field inline only, so it does not stack a second height on the input', () => {
		const body = bodyOf('.rp-project-filter__field');

		expect(body).toContain('padding: 0 var(--size-4-2)');
		expect(body).not.toContain('var(--input-padding)');
	});

	/**
	 * THE RING IS ON THE BOX THE USER SEES. Drawn on the border-less input instead, it is a
	 * rectangle inside a rectangle and the outer one — the thing that looks like the control —
	 * never lights up.
	 *
	 * `:focus-within`, because `:focus-visible` cannot be asked of an ancestor. Both halves: the
	 * wrapper must gain the ring AND the input must lose Obsidian's own focus box-shadow, which
	 * is stated at (0,2,1) and beats a single class silently.
	 */
	it('draws one focus ring, on the field, and suppresses the host ring inside it', () => {
		expect(bodyOf('.rp-project-filter__field:focus-within')).toContain('outline: 2px solid var(--interactive-accent)');
		// Reached through the pair's SECOND selector, which is the one that carries the body.
		expect(bodyOf('.rp-project-filter .rp-project-filter__input:focus-visible')).toContain('box-shadow: none');
	});

	/**
	 * THE SPECIFICITY, as a rule about the SELECTOR rather than about today's declarations.
	 * Obsidian's `input[type='text']` is (0,1,1) and sets border, background and padding; a bare
	 * `.rp-project-filter__input` is (0,1,0) and loses with no warning and no failing build, so
	 * every neutralising rule above would be dead text. `list-row.css` records the identical trap
	 * for `button:not(.clickable-icon)`.
	 */
	it('qualifies every input rule so it outranks the host default', () => {
		for (const selector of sheet.split('\n').filter((line) => line.includes('.rp-project-filter__input'))) {
			expect(selector.trim(), 'an input rule qualified enough to beat input[type=text]').toMatch(/^\.rp-project-filter \./u);
		}
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-filter.css');
	});
});
