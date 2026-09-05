/**
 * @vitest-environment jsdom
 *
 * The task banner's **Finish** against Obsidian's own disabled-button rule.
 *
 * Finish is `aria-disabled` rather than `:disabled` (design spec §5.2) so it stays focusable
 * and announced, which leaves the DISABLED LOOK to whatever rule wins the cascade.
 * `tests/harness/obsidian.css` declares `button[aria-disabled="true"] { cursor: not-allowed;
 * opacity: 0.7 }` at **(0,1,1)**, and `styles/editor-shell.css` styles the control as the
 * two-class compound `.rp-task-banner .rp-task-banner__finish` at **(0,2,0)** — which
 * outranks it. So the blocked button dimmed correctly (nothing here declares `opacity`) and
 * kept `cursor: pointer`, contradicting its own state, while the comment above that rule
 * asserted the opposite: "nothing is declared here for that state" is true of `opacity` and
 * was false of `cursor`. `.rp-new-room__create` states the disabled cursor explicitly, three
 * files away, for exactly this reason.
 *
 * **What this file can and cannot prove**, the same bound
 * `tests/presentation/dialogs/dangerButtonSpecificity.test.ts` states: jsdom resolves the
 * cascade but not `var()`. `cursor` is a plain keyword, so the value read back here IS the
 * one a browser would paint — which is exactly what a specificity regression changes.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const obsidianCss = readFileSync('tests/harness/obsidian.css', 'utf8');
const shellCss = readFileSync('styles/editor-shell.css', 'utf8');

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
	for (const css of [obsidianCss, shellCss]) {
		const style = document.createElement('style');
		style.textContent = css;
		document.head.appendChild(style);
	}
});

afterEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

describe('the task banner\'s Finish button', () => {
	it('shows a not-allowed cursor while it is aria-disabled, and a pointer while it is not', () => {
		const banner = document.createElement('div');
		banner.className = 'rp-task-banner';
		banner.innerHTML = `
			<button class="rp-task-banner__finish" aria-disabled="true">Create room</button>
			<button class="rp-task-banner__finish">Create room</button>
			<button class="rp-task-banner__cancel">Cancel</button>
		`;
		document.body.appendChild(banner);

		const [blocked, live] = [...banner.querySelectorAll('.rp-task-banner__finish')];
		if (blocked === undefined || live === undefined) throw new Error('expected both Finish buttons');

		// The regression: without a rule of our own at (0,2,1) this reads `pointer`, because
		// the plain two-class rule outranks Obsidian's `button[aria-disabled="true"]`.
		expect(window.getComputedStyle(blocked).cursor).toBe('not-allowed');
		// And the fix must not reach the button when it CAN act — the half a rule dropped on
		// the bare class would also change.
		expect(window.getComputedStyle(live).cursor).toBe('pointer');
	});
});
