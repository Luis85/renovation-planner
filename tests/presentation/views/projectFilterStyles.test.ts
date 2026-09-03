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
		expect(bodyOf('.rp-project-filter__input')).toContain('flex-grow: 1');
		expect(bodyOf('.rp-project-filter__count')).toContain('flex-shrink: 0');
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-filter.css');
	});
});
