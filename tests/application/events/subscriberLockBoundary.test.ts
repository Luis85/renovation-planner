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
 * module that NAMES `ReferenceLocks`, `withLevel1` or `withLevel2` directly. It is blind to a
 * lock reached through an INJECTED collaborator — a handler handed a command that locks would
 * not name the lock itself — which is the likelier shape, and is why the mechanism case in
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
 * way for a different reason: rename `ReferenceLocks`, `withLevel1` or `withLevel2`, or edit
 * that pattern, and `offenders` becomes permanently `[]` — green forever, and again
 * indistinguishable from a clean tree. `the offender predicate can still recognise a lock`
 * is its positive control. One predicate serves both cases on purpose: a control asserting a
 * SECOND copy of the pattern would go on passing while the copy the rule uses rotted.
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
 * The judgement half, as ONE function so the rule below and its control below that cannot
 * disagree about what naming a lock means.
 */
const namesALock = (file: string): boolean =>
	/ReferenceLocks|withLevel1|withLevel2/.test(readFileSync(file, 'utf8'));

/**
 * A module that demonstrably drives these locks — it is the forward delete-resolution engine,
 * it opens a `LockSession`, and it is the very publisher whose locked region this whole rule
 * is about. If the predicate cannot recognise THIS file, it can recognise nothing.
 */
const KNOWN_LOCKING_MODULE = path.join('src', 'application', 'reference', 'deleteResolution.ts');

describe('subscriber modules and the reference locks', () => {
	it('finds the subscriber modules at all', () => {
		// A scan that reaches nothing looks exactly like a clean tree, so the instrument
		// asserts it found something before the rule below is worth anything.
		expect(registrars().length).toBeGreaterThan(5);
	});

	it('the offender predicate can still recognise a lock', () => {
		// The judgement half's own control. Without it, renaming the three identifiers — or
		// editing the pattern — leaves `offenders` permanently empty and the rule below green
		// forever over a tree nobody is checking. Both arms are load-bearing: the named module
		// proves the predicate matches the case it exists for, and the count proves it has not
		// been narrowed to match only that one.
		expect(namesALock(KNOWN_LOCKING_MODULE)).toBe(true);
		expect(sources('src').filter((file) => namesALock(file)).length).toBeGreaterThan(5);
	});

	it('no module registering a subscriber reaches ReferenceLocks', () => {
		expect(registrars().filter((file) => namesALock(file))).toEqual([]);
	});
});
