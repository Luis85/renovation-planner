/**
 * @vitest-environment jsdom
 *
 * `modifierLabel()` has no caller yet — the foot legend that reads it is Task 9's — but it
 * shares this module and its one mocked flag (`Platform.isMacOS`) with `opensNote()`, which
 * Task 8 does call. This repository's coverage floors leave no headroom for an untested
 * function, so both are pinned here rather than left for whichever task finally calls the
 * second one.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { modifierLabel, opensNote } from '../../../src/presentation/views/platformModifier';

afterEach(() => {
	// A module-level singleton shared by every case in THIS file (each test file gets its own
	// module registry, but not each test within one) — left flipped, a mac-only case would leak
	// into the non-mac default every other case here assumes.
	Platform.isMacOS = false;
});

describe('opensNote', () => {
	it('answers to Ctrl off macOS, and not to Cmd', () => {
		expect(opensNote({ ctrlKey: true, metaKey: false })).toBe(true);
		expect(opensNote({ ctrlKey: false, metaKey: true })).toBe(false);
	});

	it('answers to Cmd on macOS, and never to Ctrl — the platform’s own secondary-click gesture', () => {
		Platform.isMacOS = true;

		expect(opensNote({ ctrlKey: false, metaKey: true })).toBe(true);
		expect(opensNote({ ctrlKey: true, metaKey: false })).toBe(false);
	});
});

describe('modifierLabel', () => {
	it('names Ctrl off macOS and ⌘ on it', () => {
		expect(modifierLabel()).toBe('Ctrl');

		Platform.isMacOS = true;

		expect(modifierLabel()).toBe('⌘');
	});
});
