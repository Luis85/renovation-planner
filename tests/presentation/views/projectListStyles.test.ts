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
 */
const sheet = readFileSync('styles/project-list.css', 'utf8');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

describe('project-list.css', () => {
	it('declares every class the row emits', () => {
		for (const cls of [
			'rp-project-row__facts',
			'rp-project-row__status',
			'rp-project-row__ticks',
			'rp-project-row__tick',
			'rp-project-row__tick--reached',
		]) {
			expect(sheet).toContain(`.${cls}`);
		}
	});

	it('drops the strip inside a CONTAINER query, not a media query', () => {
		// The pane's width is the leaf's, not the window's. A media query asks the wrong
		// element, and it is a mistake that looks correct at 1280 and only at 1280.
		expect(sheet).toContain('@container rp-project-list');
		expect(sheet).not.toContain('@media');
	});

	/**
	 * THE STRIP'S TWO STATES, at the two Obsidian tokens the design spec §6 names.
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

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-list.css');
	});
});
