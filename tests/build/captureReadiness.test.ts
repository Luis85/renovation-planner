import { describe, expect, it } from 'vitest';
import { describeFailure, reportIfNoLongerDrawn } from '../../scripts/captureReadiness.mjs';

// Module scope, not inline: `unicorn/consistent-function-scoping` is right that a function
// capturing nothing from its call site should not be rebuilt on every invocation, and identity
// is the whole point here — it is asserted BACK against this same reference below.
const isX = (id) => id === 'x';

/**
 * `reportIfNoLongerDrawn` and `describeFailure`, driven directly with a fake `page` rather than
 * pinned as source text.
 *
 * This is the check the post-screenshot re-check shipped without, in the fix round that added
 * it: ten other invariants of `harness-shot.mjs` are pinned in `harness-shot.test.ts`, and this
 * one had nothing, because `reportIfNoLongerDrawn` used to be defined at that file's own module
 * scope — which runs a real capture at import time, so nothing in it could be called from a
 * test without a live Playwright browser. Both functions here need only `page.textContent` and
 * a caller-supplied predicate run through `page.evaluate`, so a plain object standing in for
 * `page` is enough to call the real functions and see what they actually do, the same shape
 * `entryShots.test.ts` uses for the filename contract.
 *
 * A fake `page` here is deliberately UNKIND compared to a real one: `evaluate` in these tests
 * never actually runs `hasDrawn` against a DOM, it is handed the boolean the scenario wants —
 * because the predicate itself (`entryHasDrawn`) is DOM-shaped code with nothing left to prove
 * once `reportIfNoLongerDrawn` correctly calls whatever it is given and reacts to the answer.
 */
describe('reportIfNoLongerDrawn', () => {
	it('does nothing for a fixed shot, and never asks the page at all', async () => {
		const errors = [];
		const page = {
			evaluate: () => {
				throw new Error('a fixed shot has no entry to re-check');
			},
		};

		await reportIfNoLongerDrawn(page, undefined, 'dark', errors, () => false);

		expect(errors).toEqual([]);
	});

	it('records nothing when the entry still holds after the screenshot', async () => {
		const errors = [];
		const page = { evaluate: () => true };

		await reportIfNoLongerDrawn(page, 'prototype:ZoneSummary', 'entry-…-dark', errors, () => true);

		expect(errors).toEqual([]);
	});

	/**
	 * The exact race this function exists to catch: the wait resolved true, and by the time this
	 * runs — right after `page.screenshot()` — the same predicate now answers false. This is the
	 * scenario a live browser produced against `LateWarnDemo.vue` in fix round 1 (a component
	 * flipped onto a missing required prop right after the entry was first observed drawn); here
	 * it is reproduced with no browser at all, by handing `evaluate` the same false the real page
	 * would have given at that moment.
	 */
	it('records the real failure text when the entry no longer holds', async () => {
		const errors = [];
		const page = {
			evaluate: () => false,
			// A real `page.textContent` always returns a Promise; a fake that returned the
			// string directly would be kinder than Playwright and hide `describeFailure`'s own
			// `.catch()` reaching for a method a bare string does not have.
			textContent: () => Promise.resolve('Missing required prop: "mustHave"'),
		};

		await reportIfNoLongerDrawn(page, 'component:LateWarnDemo', 'entry-component-LateWarnDemo-dark', errors, () => false);

		expect(errors).toEqual([
			'[entry-component-LateWarnDemo-dark] captured a failure card, not the entry: ' +
				'component:LateWarnDemo: Missing required prop: "mustHave"',
		]);
	});

	it('passes the caller-supplied predicate to page.evaluate, not one of its own', async () => {
		const seen = [];
		const page = { evaluate: (fn, arg) => (seen.push([fn, arg]), true) };

		await reportIfNoLongerDrawn(page, 'x', 'dark', [], isX);

		expect(seen).toEqual([[isX, 'x']]);
	});
});

describe('describeFailure', () => {
	it('returns the fallback unchanged for a fixed shot, never reading the page', async () => {
		const page = {
			textContent: () => {
				throw new Error('a fixed shot has no failure card to read');
			},
		};

		await expect(describeFailure(page, undefined, 'Timeout 30000ms exceeded')).resolves.toBe(
			'Timeout 30000ms exceeded',
		);
	});

	it('prefixes the card text with the entry id when the card is present', async () => {
		const page = { textContent: () => Promise.resolve('no entry named NoSuchEntry') };

		await expect(describeFailure(page, 'NoSuchEntry', 'Timeout 30000ms exceeded')).resolves.toBe(
			'NoSuchEntry: no entry named NoSuchEntry',
		);
	});

	it('falls back when the card read itself fails, rather than throwing', async () => {
		const page = {
			textContent: () => Promise.reject(new Error('Timeout 2000ms exceeded')),
		};

		await expect(describeFailure(page, 'NoSuchEntry', 'the wait rejected')).resolves.toBe('the wait rejected');
	});

	it('gives a named fallback when there is no card and no caller fallback either', async () => {
		const page = { textContent: () => Promise.reject(new Error('no card')) };

		await expect(describeFailure(page, 'Ghost', undefined)).resolves.toBe(
			'Ghost rendered nothing and left no failure text to explain why',
		);
	});

	/**
	 * Minor 1: the read must not wait Playwright's 30-second default for a card that a
	 * genuinely absent-without-a-card failure will never produce.
	 */
	it('reads the failure card with a short explicit timeout, not Playwright default 30s', async () => {
		let seenTimeout;
		const page = {
			textContent: (selector, options) => {
				seenTimeout = options?.timeout;
				return Promise.reject(new Error('no card'));
			},
		};

		await describeFailure(page, 'Ghost', 'fallback');

		expect(seenTimeout).toBeTypeOf('number');
		expect(seenTimeout).toBeLessThan(30000);
	});
});
