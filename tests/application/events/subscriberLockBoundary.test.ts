import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The rule: a subscriber must never acquire a reference lock. `EventBus.publish` awaits its
 * handlers and publishing under a lock is routine here rather than exceptional (the measured
 * breadth and its date live in `ReferenceLocks`'s header, and are deliberately not restated
 * here), so a subscriber that reaches for a lock the publishing sequence holds deadlocks
 * unrecoverably: `waitForRelease` fires only from `releaseAll`, which the publisher reaches
 * only after `publish` returns.
 *
 * **What this tripwire can and cannot see.** It reads module TEXT, so it catches a subscriber
 * module that NAMES the lock TYPE (`ReferenceLocks`), either convenience wrapper (`withLevel1`,
 * `withLevel2`) or either acquisition DOOR (`acquire(`, `beginSession(`). The doors are the
 * rule's own verb — "must never ACQUIRE" — and without them the LITERAL violation was the one
 * shape this instrument could not see: a registrar reaching a lock through a deps interface
 * declared elsewhere writes `deps.locks.acquire(...)` and need name nothing else. It is still
 * blind to a lock reached through a collaborator that locks INTERNALLY — a handler handed a
 * command whose own body takes the lock names none of the five — which is the likelier shape,
 * and is why the mechanism case in
 * `tests/application/reference/referenceLocks.test.ts` and the two engine pins
 * (`deleteResolutionAnnouncements.test.ts`, `undoDeleteResolution.test.ts`) are the backstop
 * rather than this. Stated rather than implied: an undocumented residue reads as ground
 * nobody walked.
 *
 * It is also blind to a registration spelled anything but `.subscribe(` — a bare
 * `subscribe(...)` reached off a destructured binding, or a wrapper under another name.
 *
 * **BOTH halves of this instrument are guarded, because it has two.** The discovery half is
 * the file scan, guarded by `finds the subscriber modules at all` — a scan reaching nothing
 * looks exactly like a clean tree. The JUDGEMENT half is `namesALock`, and it fails the same
 * way for a different reason: rename any of the five identifiers, or edit the patterns, and
 * `offenders` becomes permanently `[]` — green forever, and again indistinguishable from a
 * clean tree. `every arm of the offender predicate can still recognise a lock` is its positive
 * control, and it is PER ARM rather than per predicate. That correction closed a real hole
 * rather than tidying one: the arms match 20, 7 and 9 files under `src/` and both smaller sets
 * are SUBSETS of the first, so the single-anchor form passed all three of its assertions with
 * `withLevel1|withLevel2` deleted from the pattern outright — measured, not reasoned. One
 * predicate still serves the rule and its controls alike, because a control asserting a SECOND
 * copy of the pattern would go on passing while the copy the rule uses rotted.
 */
const sources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return sources(full);
		return entry.name.endsWith('.ts') ? [full] : [];
	});

const registrars = (): string[] =>
	sources('src').filter((file) => readFileSync(file, 'utf8').includes('.subscribe('));

/**
 * The judgement half's three arms, spelled ONCE so the rule below and the controls below that
 * cannot disagree about what naming a lock means.
 */
const LOCK_PATTERNS = {
	type: /ReferenceLocks/,
	helper: /withLevel1|withLevel2/,
	door: /acquire\(|beginSession\(/,
} as const;

/**
 * One anchor per arm, because the arms are NOT independently falsifiable through a shared one:
 * measured 2026-09-03, `type` matches 20 files under `src/`, `helper` 7 and `door` 9, and both
 * smaller sets are subsets of the first. Each anchor is a module that demonstrably drives these
 * locks through the arm it stands for — the forward delete-resolution engine, whose locked
 * region this whole rule is about; the asset-design shape writer, which locks through the
 * wrapper; and the price-override command, which takes the door directly and whose publish
 * reaches a live subscriber under the lock it is still holding. If an arm cannot recognise ITS
 * anchor, it can recognise nothing.
 *
 * Typed off `LOCK_PATTERNS`, so an arm added without an anchor and an anchor orphaned by a
 * deleted arm are each a BUILD error rather than a quietly weaker control.
 */
const ANCHORS: Record<keyof typeof LOCK_PATTERNS, string> = {
	type: path.join('src', 'application', 'reference', 'deleteResolution.ts'),
	helper: path.join('src', 'application', 'commands', 'asset', 'updateAssetShape.ts'),
	door: path.join('src', 'application', 'commands', 'asset-price', 'SetAssetPriceOverride.ts'),
};

const namesALock = (file: string): boolean => {
	const text = readFileSync(file, 'utf8');
	return Object.values(LOCK_PATTERNS).some((pattern) => pattern.test(text));
};

describe('subscriber modules and the reference locks', () => {
	it('finds the subscriber modules at all', () => {
		// A scan that reaches nothing looks exactly like a clean tree, so the instrument
		// asserts it found something before the rule below is worth anything.
		expect(registrars().length).toBeGreaterThan(5);
	});

	it('every arm of the offender predicate can still recognise a lock', () => {
		// The judgement half's own control, asked ONCE PER ARM. Asked of one anchor instead,
		// an arm that matches only files the anchor is not among can be deleted outright with
		// every assertion here still green — which is what the single-anchor form did.
		for (const arm of Object.keys(ANCHORS) as (keyof typeof LOCK_PATTERNS)[]) {
			const matched = LOCK_PATTERNS[arm].test(readFileSync(ANCHORS[arm], 'utf8'));
			expect(matched, `${arm} arm against ${ANCHORS[arm]}`).toBe(true);
		}
		// And the predicate as a whole has not been narrowed to match only its anchors.
		expect(sources('src').filter((file) => namesALock(file)).length).toBeGreaterThan(5);
	});

	it('no module registering a subscriber reaches ReferenceLocks', () => {
		expect(registrars().filter((file) => namesALock(file))).toEqual([]);
	});
});
