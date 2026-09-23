import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * THE CREATION TASK BAR HAS ONE PLACEMENT, and this is the check under that sentence in
 * `styles/editor-task-bar.css`. Before its rules were gathered there, five partials styled
 * `.rp-task-banner` and one of them moved only the structure tools' bar to the bottom edge, so
 * Add → Room and Add → Wall drew the same control on opposite edges of the canvas. jsdom lays
 * nothing out and no case in the suite can see WHERE the bar draws, so the rule is held at the
 * forbidden thing instead: no other partial may name the bar, and the bar may not name a `top`.
 *
 * `.rp-task-banner__repeat` is the one exception, and it is a control INSIDE the bar that
 * `editor-area.css` owns beside the Area corner editor, not a rule about the bar itself.
 * Comments are stripped first, because several partials cite the bar's selectors in prose.
 */
const STYLES = 'styles';
const HOME = 'editor-task-bar.css';
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const partials = readdirSync(STYLES).filter((name) => name.endsWith('.css'));

describe('the creation task bar placement', () => {
	it('is styled by its own partial and by no other', () => {
		const foreign = partials
			.filter((name) => name !== HOME)
			.filter((name) => /\.rp-task-banner(?!__repeat)/.test(withoutComments(readFileSync(`${STYLES}/${name}`, 'utf8'))));

		expect(foreign).toEqual([]);
		expect(partials).toContain(HOME);
	});

	it('docks every task at the measured bottom clearance, never at a top edge', () => {
		const css = withoutComments(readFileSync(`${STYLES}/${HOME}`, 'utf8'));

		expect(css).not.toMatch(/(^|[\s;{])top\s*:/);
		expect(css).toMatch(/bottom:\s*var\(--rp-taskbar-clearance/);
	});
});
