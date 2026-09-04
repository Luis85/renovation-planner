import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `styles/continue-row.css` — split out of `project-list.css` in Task 12 when that file
 * reached the 400-line cap exactly.
 *
 * jsdom resolves no CSS, so a class whose rule is one word off renders the base look with
 * every mounted test green. This asserts the sheet declares what `ContinueRow.vue` emits, and
 * pins the two declarations most likely to be "tidied" away by a later reader.
 *
 * It reads DECLARATIONS and never the cascade, and it measures no position: whether the row
 * actually wraps at 460px is settled by a capture and by nothing here.
 *
 * **COMMENTS STRIPPED, and today that is a PRECAUTION rather than a live instrument — which
 * is stated rather than borrowed from the sibling file's stronger claim.**
 * `projectListStyles.test.ts` strips because a mutation proved it had to: renaming
 * `.rp-project-row` out of every selector there left all five of its cases green, since its
 * comments still named the class. The same mutation was run here — renaming
 * `.rp-continue__resume` out of every selector in `continue-row.css` — and it reddens three
 * cases with the strip AND without it, because no comment in that sheet happens to name one of
 * the three classes asserted below. The one class it does name in prose alone is
 * `.rp-project-list__row`, which nothing here asserts.
 *
 * So the strip buys nothing at this commit and is kept anyway: the sheet is written to explain
 * itself, the very next paragraph added to it could name `.rp-continue__open`, and the cost is
 * one `replace`. What keeps that from being an untested claim is the case below that drives the
 * mechanism directly.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const sheet = readFileSync('styles/continue-row.css', 'utf8').replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

describe('continue-row.css', () => {
	/**
	 * The classes THIS sheet owns. `.rp-project-list__row` and `.rp-project-list__name` are
	 * deliberately absent: `ContinueRow` emits both, and `list-row.css` and `forms.css` declare
	 * them — the whole point of the row being "the same armature as every other row".
	 *
	 * `.rp-continue__plan` is absent too, and that is a finding rather than an omission: the
	 * component emits it and NO sheet declares it, so it renders as inherited text inside the
	 * name. That is the right picture today (the plan name is part of the name), so nothing is
	 * added for it — recorded here so the next reader does not add a rule looking for one.
	 */
	it('declares every class the row emits that this sheet owns', () => {
		for (const cls of ['rp-continue', 'rp-continue__resume', 'rp-continue__open']) {
			expect(new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet), `.${cls} is declared`).toBe(true);
		}
	});

	/**
	 * The instrument, before its results are trusted: a longer class must not answer for the
	 * shorter one it starts with, or `.rp-continue` would be satisfied by `.rp-continue__open`
	 * and the first entry above would prove nothing.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(new RegExp(String.raw`\.rp-continue(?![\w-])`, 'u').test('.rp-continue__open {')).toBe(false);
	});

	/**
	 * The strip, driven on a synthetic input rather than on this sheet — because on this sheet
	 * it currently changes nothing, as the header records. Driving it here is what makes
	 * "comments stripped" a checked property today rather than a sentence that becomes false the
	 * first time somebody replaces the `replace` with a no-op.
	 */
	it('reads a class named in prose as prose, not as a declaration', () => {
		expect('/* mentions .rp-continue__open here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * THE DECLARATION THE LINE BUDGET PUSHED OUT OF TASK 11, restored by the split that made
	 * room for it. Without it the two buttons are the only shrinkable items left on the row once
	 * the name has collapsed to its ellipsis, so `Continue` clips to a word that no longer says
	 * what the control does.
	 */
	it('refuses to shrink either action', () => {
		expect(bodyOf('.rp-continue__resume,\n.rp-continue__open')).toContain('flex-shrink: 0');
	});

	/**
	 * The ring is drawn OUTSIDE these two controls where the row's own is drawn inside it, and
	 * the asymmetry is deliberate — an inset control has room for an outward ring where an
	 * edge-to-edge row does not. Pinned because it reads as an inconsistency: a later reader
	 * "correcting" it to `-2px` would put the ring inside a small button, where it is hardest
	 * to see, and nothing else here would notice.
	 */
	it('draws the focus ring outside the inset controls', () => {
		const body = bodyOf('.rp-project-list__continue .rp-continue__resume:focus-visible,\n.rp-project-list__continue .rp-continue__open:focus-visible');

		expect(body).toContain('outline: 2px solid var(--interactive-accent)');
		expect(body).toContain('outline-offset: 2px');
		expect(body).not.toContain('outline-offset: -2px');
	});

	/**
	 * **THE TWO HALVES OF "the same armature as every other row", which was false for three
	 * tasks and which four captures showed.** Every other row is a `<button>` and inherits
	 * Obsidian's bare `button` rule; this row is a `<div>` and inherits none of it. Two of that
	 * rule's declarations are visible — `font-size: var(--font-ui-small)` and
	 * `white-space: nowrap` — and are NOT part of the button-ness `list-row.css` strips, so
	 * without them the Continue row drew at the interface's default size above a list of small
	 * ones. Asserted TOGETHER because either alone leaves the row a different shape, and each
	 * reads as an ordinary tidy-up to a reader who does not know the `<div>` is why.
	 *
	 * Both are RESTATEMENTS of a rule this row cannot inherit, which is the one case where a
	 * hard-coded agreement with somebody else's stylesheet is the honest answer: a `<div>` has
	 * nothing to inherit from and the sameness is the component's own stated contract.
	 */
	it('restates the two button declarations a div cannot inherit', () => {
		const body = bodyOf('.rp-project-list .rp-continue');

		expect(body).toContain('font-size: var(--font-ui-small)');
		expect(body).toContain('white-space: nowrap');
	});

	/**
	 * **THE OTHER HALF OF THE SAME FINDING, and it lives in the SHARED sheet rather than here.**
	 * `list-row.css` flattens a row `<button>`, and `border: none` does not touch the
	 * `box-shadow: var(--input-shadow)` Obsidian's `button:not(.clickable-icon)` sets — so every
	 * row on BOTH lists drew as an outlined box until the final review compared this `<div>`
	 * against them. Asserted from here because this file is where the sameness claim is made and
	 * because `list-row.css` has no test of its own; a build that re-adds the shadow makes this
	 * row and the rows below it different shapes again, which is the thing being pinned.
	 */
	it('flattens the shared row shadow, without which this div and every button row differ', () => {
		const shared = readFileSync('styles/list-row.css', 'utf8').replace(RULES_ONLY, '');

		expect(shared).toContain('box-shadow: none');
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('continue-row.css');
	});
});
