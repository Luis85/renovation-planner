import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The rule: a subscriber must never acquire a reference lock. `EventBus.publish` awaits its
 * handlers and publishing under a lock is the NORM here (13 publish source lines over 18
 * publish x locked-region pairs — see `ReferenceLocks`'s header), so a subscriber that
 * reaches for a lock the publishing sequence holds deadlocks unrecoverably: `waitForRelease`
 * fires only from `releaseAll`, which the publisher reaches only after `publish` returns.
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
 */
const sources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return sources(full);
		return entry.name.endsWith('.ts') ? [full] : [];
	});

const registrars = (): string[] =>
	sources('src').filter((file) => readFileSync(file, 'utf8').includes('.subscribe('));

describe('subscriber modules and the reference locks', () => {
	it('finds the subscriber modules at all', () => {
		// A scan that reaches nothing looks exactly like a clean tree, so the instrument
		// asserts it found something before the rule below is worth anything.
		expect(registrars().length).toBeGreaterThan(5);
	});

	it('no module registering a subscriber reaches ReferenceLocks', () => {
		const offenders = registrars().filter((file) =>
			/ReferenceLocks|withLevel1|withLevel2/.test(readFileSync(file, 'utf8')),
		);
		expect(offenders).toEqual([]);
	});
});
