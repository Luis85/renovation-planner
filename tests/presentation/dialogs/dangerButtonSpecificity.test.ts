/**
 * @vitest-environment jsdom
 *
 * Defect 2 (design slice 15, task 13): in a real Chromium the recalibration confirmation's
 * danger button rendered with Obsidian's plain white `--interactive-normal`, not the red
 * `--background-modifier-error` `.rp-dialog-button-danger` asks for. The cause is
 * specificity, not source order: Obsidian's own `button:not(.clickable-icon)`
 * (`tests/harness/obsidian.css`) sets the SAME property at (0,1,1) — `:not()` contributes
 * its argument's specificity — which outranks a bare `.rp-dialog-button-danger` at (0,1,0).
 * `styles/dialogs.css` now qualifies it as `.rp-dialog .rp-dialog-button-danger`, (0,2,0).
 *
 * **What this file can and cannot prove.** jsdom does not resolve `var(--x)` to the colour
 * it names — `getComputedStyle(...).backgroundColor` on either button below reads back the
 * literal string `var(--background-modifier-error)` or `var(--interactive-normal)`, never a
 * resolved `rgb(...)`. So this file cannot verify the FINAL colour a browser paints, only
 * which of the two competing DECLARATIONS the cascade picked — which is exactly what a
 * specificity regression changes. Measured directly: reverting the selector in
 * `styles/dialogs.css` back to the bare `.rp-dialog-button-danger` makes the assertion below
 * fail with `var(--interactive-normal)`, the same value Obsidian's rule sets, which is the
 * shape the real Chromium defect took. The FINAL colour — that `--background-modifier-error`
 * really resolves to something other than `--interactive-normal` in a themed vault — is
 * unchecked here and remains a harness claim (this task's report).
 *
 * The specificity loss broke TWO declarations in the same rule, not one: `color` as well as
 * `background-color`. Both are pinned below, for the same reason `background-color` alone
 * would understate the regression.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const obsidianCss = readFileSync('tests/harness/obsidian.css', 'utf8');
const dialogsCss = readFileSync('styles/dialogs.css', 'utf8');

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = 'theme-light';
	const obsidianStyle = document.createElement('style');
	obsidianStyle.textContent = obsidianCss;
	document.head.appendChild(obsidianStyle);
	const dialogsStyle = document.createElement('style');
	dialogsStyle.textContent = dialogsCss;
	document.head.appendChild(dialogsStyle);
});

afterEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	document.body.className = '';
});

describe('the danger dialog button against Obsidian\'s own button rule', () => {
	it('wins the background-color declaration Obsidian\'s button:not(.clickable-icon) also sets', () => {
		const overlay = document.createElement('div');
		overlay.className = 'rp-dialog-overlay';
		overlay.innerHTML = `
			<div class="rp-dialog">
				<button class="rp-dialog-button">Cancel</button>
				<button class="rp-dialog-button rp-dialog-button-danger">Confirm</button>
			</div>
		`;
		document.body.appendChild(overlay);

		const plain = overlay.querySelector('.rp-dialog-button:not(.rp-dialog-button-danger)');
		const danger = overlay.querySelector('.rp-dialog-button-danger');
		if (plain === null || danger === null) throw new Error('expected both buttons to be found');

		const plainBackground = window.getComputedStyle(plain).backgroundColor;
		const dangerBackground = window.getComputedStyle(danger).backgroundColor;

		// Obsidian's rule is what a plain dialog button is left to — the assertion this
		// project's own `.rp-dialog-button` comment states is deliberately harmless.
		expect(plainBackground).toBe('var(--interactive-normal)');
		// The regression this test exists to catch: without `.rp-dialog` qualifying the
		// selector, the cascade picks Obsidian's `button:not(.clickable-icon)` instead and
		// this reads `var(--interactive-normal)` too — the exact value measured in the real
		// browser before the fix.
		expect(dangerBackground).toBe('var(--background-modifier-error)');
		expect(dangerBackground).not.toBe(plainBackground);

		// The same specificity loss took `color` down with it: Obsidian's
		// `button:not(.clickable-icon)` also sets `color: var(--text-color)` at (0,1,1),
		// which is what a bare `.rp-dialog-button-danger` (0,1,0) would have lost to just as
		// it lost the background — reverting the selector makes this read `var(--text-color)`
		// too.
		expect(window.getComputedStyle(danger).color).toBe('var(--text-on-accent)');
	});
});
