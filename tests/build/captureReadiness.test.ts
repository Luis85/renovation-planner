import { describe, expect, it } from 'vitest';
import {
	describeFailure,
	readFailureKind,
	reportIfNoLongerDrawn,
	UNKNOWN_ENTRY,
	waitUntilReady,
} from '../../scripts/captureReadiness.mjs';

// Module scope, not inline: `unicorn/consistent-function-scoping` is right that a function
// capturing nothing from its call site should not be rebuilt on every invocation, and identity
// is the whole point here — it is asserted BACK against this same reference below.
const isX = (id: string): boolean => id === 'x';

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
		const errors: string[] = [];
		const page = {
			evaluate: () => {
				throw new Error('a fixed shot has no entry to re-check');
			},
		};

		await reportIfNoLongerDrawn(page, undefined, 'dark', errors, () => false);

		expect(errors).toEqual([]);
	});

	it('records nothing when the entry still holds after the screenshot', async () => {
		const errors: string[] = [];
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
		const errors: string[] = [];
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
		const seen: [unknown, unknown][] = [];
		const page = { evaluate: (fn: unknown, arg: unknown) => (seen.push([fn, arg]), true) };

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
		let seenTimeout: number | undefined;
		const page = {
			textContent: (selector: string, options?: { timeout?: number }) => {
				void selector;
				seenTimeout = options?.timeout;
				return Promise.reject(new Error('no card'));
			},
		};

		await describeFailure(page, 'Ghost', 'fallback');

		expect(seenTimeout).toBeTypeOf('number');
		expect(seenTimeout).toBeLessThan(30000);
	});
});

/**
 * A promise that never settles — the loser of every race below. Module scope because it
 * captures nothing per-call (`unicorn/consistent-function-scoping`), and the executor's body is
 * a statement rather than an expression so it returns nothing (`no-promise-executor-return`).
 */
const pending = (): Promise<never> => new Promise(() => {});

/**
 * The race the wait had to become. Driven with a fake `page` for the reason the header gives:
 * `waitForFunction`/`waitForSelector` are asked for promises and nothing here needs a DOM.
 *
 * The defect being closed: an entry that FAILS puts its card on screen at first paint, and the
 * old wait — the readiness predicate alone — then sat out Playwright's whole 30-second timeout
 * before anyone was told, twice, once per colour scheme. A minute of silence for something the
 * page said immediately, to the one actor who cannot look and check.
 */
describe('waitUntilReady', () => {
	it('waits on the fixed shot selector alone, and never looks for a failure card', async () => {
		const asked: string[] = [];
		const page = {
			waitForSelector: (selector: string) => (asked.push(selector), Promise.resolve()),
			waitForFunction: () => {
				throw new Error('a fixed shot has no entry to poll for');
			},
		};

		await waitUntilReady(page, '.renovation-planner-view', undefined, () => true);

		expect(asked).toEqual(['.renovation-planner-view']);
	});

	it('resolves as soon as the entry draws, without waiting out the failure-card selector', async () => {
		const page = { waitForFunction: () => Promise.resolve(true), waitForSelector: pending };

		await expect(waitUntilReady(page, '.ignored', 'prototype:ZonePanel', () => true)).resolves.toBeUndefined();
	});

	/**
	 * The half that saves the 30 seconds: the readiness predicate never resolves — a mistyped id
	 * never sets `data-entry` — and the failure card is what settles the wait instead. It throws
	 * rather than returning a flag, so `captureOne`'s existing catch does the reporting and there
	 * is only ever one place the message is built.
	 */
	it('rejects as soon as the failure card appears, rather than waiting the predicate out', async () => {
		const page = { waitForFunction: pending, waitForSelector: () => Promise.resolve({}) };

		await expect(waitUntilReady(page, '.ignored', 'prototype:Ghost', () => true)).rejects.toThrow('prototype:Ghost');
	});

	it('polls with the caller-supplied predicate and the entry id, not one of its own', async () => {
		const seen: unknown[] = [];
		const page = {
			waitForFunction: (fn: unknown, arg: unknown) => (seen.push([fn, arg]), Promise.resolve(true)),
			waitForSelector: pending,
		};

		await waitUntilReady(page, '.ignored', 'x', isX);

		expect(seen).toEqual([[isX, 'x']]);
	});
});

/**
 * Which failures make the SECOND colour scheme worth attempting. Only "the index has no such
 * entry" is scheme-independent by construction; anything an entry does while drawing can differ
 * between schemes, and looking at both is the whole point of taking two shots.
 *
 * This reads the page's OWN classification — `data-failure` on the failure card — rather than
 * searching the card's text, and the first case below is the defect that forced the change: a
 * real entry whose error or warning quotes `no entry named` was classified as missing by the
 * substring predicate this replaced, and silently lost its second colour scheme. The message is
 * prose an entry can imitate; the attribute is the page answering the question actually asked.
 *
 * Everything else fails OPEN, into attempting the other scheme, which is the direction that
 * cannot hide anything: a fixed shot, a page with no card, a card with no attribute, and a read
 * that rejects all answer `null`.
 */
describe('readFailureKind', () => {
	it('reads the kind the page declared, not the words in its message', async () => {
		const page = { getAttribute: () => Promise.resolve('unknown-entry') };

		await expect(readFailureKind(page, 'prototype:Ghost')).resolves.toBe(UNKNOWN_ENTRY);
	});

	it('does not claim an entry is missing when its own failure text merely says so', async () => {
		// The card text here is `component:X did not render cleanly: Error: no entry named Bob` —
		// a real entry, a real render defect, and a message the old substring predicate read as
		// "this entry does not exist". The attribute says `render`, which is what it is.
		const page = { getAttribute: () => Promise.resolve('render') };

		await expect(readFailureKind(page, 'component:X')).resolves.not.toBe(UNKNOWN_ENTRY);
	});

	it('answers null for a fixed shot, which has no entry to be unknown', async () => {
		const page = {
			getAttribute: () => {
				throw new Error('a fixed shot has no failure card to read');
			},
		};

		await expect(readFailureKind(page, undefined)).resolves.toBeNull();
	});

	it('answers null when the card read itself fails, rather than throwing', async () => {
		const page = { getAttribute: () => Promise.reject(new Error('Timeout 2000ms exceeded')) };

		await expect(readFailureKind(page, 'component:X')).resolves.toBeNull();
	});
});
