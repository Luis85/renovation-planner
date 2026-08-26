// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { entryHasDrawn } from '../../scripts/captureReadiness.mjs';

/**
 * The readiness predicate `harness-shot.mjs` waits on, driven for the first time.
 *
 * It lived in `harness-shot.mjs`, which runs its capture at module scope and so cannot be
 * imported by a test at all — and the sibling suite had written it off as "DOM-shaped code with
 * nothing left to prove". It has exactly one thing to prove, and it was getting it wrong: the
 * check was `childNodes.length > 0`, and Vue renders a component whose root is `v-if="false"`
 * as a comment placeholder, so a stage holding nothing but `<!--v-if-->` counted as drawn.
 * That is a successful, empty PNG at exit 0 — the single worst thing this script can produce,
 * because the actor it exists for cannot see that the picture is blank.
 *
 * The cases below are both directions at once, which is the only way to tell the fix from an
 * over-correction: `firstElementChild` would refuse a text-rooted mock, and that is a real
 * template a person may write.
 */

const stage = (html: string, entry = 'prototype:X') => {
	document.body.innerHTML = `<main class="rp-harness-stage" data-entry="${entry}">${html}</main>`;
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('entryHasDrawn', () => {
	it.each([
		['an element', '<p>drawn</p>'],
		['a bare text root, which is a legitimate early mock', 'Coming soon'],
		['an element among placeholders', '<!--v-if--><section></section>'],
	])('accepts %s', (_what, html) => {
		stage(html);

		expect(entryHasDrawn('prototype:X')).toBe(true);
	});

	it.each([
		['a comment placeholder alone, which is how a v-if="false" root renders', '<!--v-if-->'],
		['nothing at all', ''],
		['whitespace, which draws nothing a person can see', '   \n\t '],
	])('refuses %s', (_what, html) => {
		stage(html);

		expect(entryHasDrawn('prototype:X')).toBe(false);
	});

	// The marker is the primary signal and the node check is the sanity check behind it; a
	// stage still showing the PREVIOUS entry must not satisfy either.
	it('refuses a stage that has drawn some other entry', () => {
		stage('<p>drawn</p>', 'prototype:Other');

		expect(entryHasDrawn('prototype:X')).toBe(false);
	});

	it('refuses a page with no stage at all', () => {
		expect(entryHasDrawn('prototype:X')).toBe(false);
	});
});
