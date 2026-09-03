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
 * the file scan — a scan reaching nothing looks exactly like a clean tree. The JUDGEMENT half
 * is `namesALock`, and it fails the same way for a different reason: rename any of the five
 * identifiers, or narrow the patterns, and `offenders` becomes permanently `[]` — green
 * forever, and again indistinguishable from a clean tree.
 *
 * **The judgement half's control is THREE questions, because one instrument cannot ask them
 * and each was measured against the mutation the others survive.**
 *
 * - SPECIMENS ask, per TOKEN, whether an arm still recognises the spelling it claims to. They
 *   are literal strings written HERE rather than modules found in the tree, which is exactly
 *   what makes them blinding-proof: an arm narrowed to match only its own anchor's incidental
 *   identifiers cannot match a specimen it never saw. That closes a residue this header used to
 *   merely DISCLOSE — that the alternatives inside an arm had no falsifier, so dropping
 *   `|withLevel2` or `|beginSession(` was silent. The old note said closing it meant "an anchor
 *   per token, five" and priced that as too much; it costs five string literals, because a
 *   specimen needs no real module behind it.
 * - ANCHORS ask the converse, and specimens cannot: a specimen is this test's OWN copy of the
 *   vocabulary, so it stays green while `src/` renames a verb out from under the rule. Each arm
 *   is therefore also asked of a module that demonstrably drives these locks through it — the
 *   forward delete-resolution engine, whose locked region this whole rule is about; the
 *   asset-design shape writer, which locks through the wrapper; and the price-override command,
 *   which takes the door directly and whose publish reaches a live subscriber under the lock it
 *   is still holding.
 * - And the ASSEMBLED predicate is bracketed, positively and negatively, because both of the
 *   above test `LOCK_PATTERNS` directly and would survive `namesALock` itself being broken —
 *   an `every` for a `some`, an `&& false`, an inverted return. It must match every anchor and
 *   it must not match the whole tree.
 *
 * The breadth control this replaces was a floor on how many files the predicate matched, and it
 * was nearly inert: the floor sat far enough below the union that all three arms could be
 * narrowed to recognise ZERO lock verbs with a literal violation planted in a registrar and
 * every assertion here still passing — reproduced before this was rewritten, not reasoned about.
 * A count with slack in it cannot tell a predicate that works from one that has been hollowed
 * out, because the slack is precisely where the hollowing hides.
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
 * One anchor per arm — a real module that drives these locks through the arm it stands for, so
 * a verb RENAMED in `src/` reddens here rather than leaving the rule matching a vocabulary
 * nothing uses any more. Both records below are typed off `LOCK_PATTERNS`, so an arm added
 * without one, and one orphaned by a deleted arm, are each a BUILD error rather than a quietly
 * weaker control.
 */
const ANCHORS: Record<keyof typeof LOCK_PATTERNS, string> = {
	type: path.join('src', 'application', 'reference', 'deleteResolution.ts'),
	helper: path.join('src', 'application', 'commands', 'asset', 'updateAssetShape.ts'),
	door: path.join('src', 'application', 'commands', 'asset-price', 'SetAssetPriceOverride.ts'),
};

/**
 * One specimen per TOKEN the arms claim to recognise, written as a literal here and NOT read
 * from the tree — which is what an arm narrowed to its anchor's incidental identifiers cannot
 * satisfy. Every alternative inside every arm appears exactly once, so dropping `|withLevel2`
 * or `|beginSession(` now reddens the token's own assertion instead of riding on a sibling.
 */
const LOCK_SPECIMENS: Record<keyof typeof LOCK_PATTERNS, readonly string[]> = {
	type: ['const locks: ReferenceLocks = createReferenceLocks();'],
	helper: ['await locks.withLevel1(id, run);', 'await locks.withLevel2(id, run);'],
	door: ['const held = await locks.acquire(2, id);', 'const session = locks.beginSession();'],
};

/**
 * The discovery half's control. Every `*ChangeSource.ts` module registers subscribers — that is
 * what a change source IS — so the set is derived from the tree rather than listed, and it is
 * the scan's own answer that has to contain all of it. A floor on the registrar COUNT was what
 * stood here, and a floor cannot tell four registrars silently dropping out of the scan from a
 * tree that has four fewer; this cannot be satisfied by any subset.
 */
const changeSources = (): string[] => sources('src').filter((file) => file.endsWith('ChangeSource.ts'));

const namesALock = (file: string): boolean => {
	const text = readFileSync(file, 'utf8');
	return Object.values(LOCK_PATTERNS).some((pattern) => pattern.test(text));
};

describe('subscriber modules and the reference locks', () => {
	it('finds the subscriber modules at all', () => {
		// A scan that reaches nothing looks exactly like a clean tree. Derived, not listed:
		// every change source registers subscribers, so the scan owes ALL of them.
		const expected = changeSources();
		expect(expected.length).toBeGreaterThan(0);
		expect(registrars()).toEqual(expect.arrayContaining(expected));
	});

	it('every TOKEN of the offender predicate can still recognise a lock', () => {
		// Blinding-proof: a specimen is written here, so an arm narrowed to its anchor's own
		// incidental identifiers matches nothing and fails at its own token.
		for (const arm of Object.keys(LOCK_SPECIMENS) as (keyof typeof LOCK_PATTERNS)[]) {
			for (const specimen of LOCK_SPECIMENS[arm]) {
				expect(LOCK_PATTERNS[arm].test(specimen), `${arm} arm against ${specimen}`).toBe(true);
			}
		}
	});

	it('every arm still recognises the vocabulary src actually uses', () => {
		// Rename-proof, which the specimens above cannot be: they are this test's own copy of
		// the vocabulary and stay green while src renames a verb out from under the rule.
		for (const arm of Object.keys(ANCHORS) as (keyof typeof LOCK_PATTERNS)[]) {
			const matched = LOCK_PATTERNS[arm].test(readFileSync(ANCHORS[arm], 'utf8'));
			expect(matched, `${arm} arm against ${ANCHORS[arm]}`).toBe(true);
		}
	});

	it('the assembled predicate matches every anchor and is not simply everything', () => {
		// Both controls above read LOCK_PATTERNS directly, so they survive namesALock itself
		// being broken — an `every` for a `some`, an `&& false`, an inverted return. This
		// brackets the predicate the rule below actually calls.
		const matched = sources('src').filter((file) => namesALock(file));
		expect(matched).toEqual(expect.arrayContaining(Object.values(ANCHORS)));
		expect(matched.length).toBeLessThan(sources('src').length);
	});

	it('no module registering a subscriber names a reference lock', () => {
		expect(registrars().filter((file) => namesALock(file))).toEqual([]);
	});
});
