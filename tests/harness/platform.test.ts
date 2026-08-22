/**
 * @vitest-environment jsdom
 *
 * Its own file, and that is the whole point of it.
 *
 * `applyPlatform` runs BEFORE `mountHarness`, so it may not use Obsidian's prototype
 * extensions — nothing has installed them yet. In the source project the same call was
 * written with `toggleClass`, which passed every test (each jsdom file installs the
 * extensions at module top) and threw on the real page, taking the whole mount with it.
 *
 * So this file imports NOTHING that installs them, and asserts the absence first. Anything
 * imported here that pulls in `mount.ts` silently turns this check back into the one that
 * could not see the defect.
 */
import { describe, expect, it } from 'vitest';
import { applyPlatform } from './theme';

describe('the platform classes, before the mount', () => {
	it('lands without the Obsidian DOM extensions', () => {
		// The premise, asserted rather than assumed: nothing in this file has installed them.
		expect((document.body as Partial<HTMLElement>).createEl).toBeUndefined();

		applyPlatform('?phone');

		expect(document.body.classList.contains('is-phone')).toBe(true);
		expect(document.body.classList.contains('is-mobile')).toBe(true);
	});
});
