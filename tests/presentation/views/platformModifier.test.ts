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

/** Every modifier defaults to unheld, so a case states only the ones it cares about. */
function modifiers(
	held: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }>,
): { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean } {
	return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...held };
}

describe('opensNote', () => {
	it('answers to Ctrl off macOS, and not to Cmd', () => {
		expect(opensNote(modifiers({ ctrlKey: true }))).toBe(true);
		expect(opensNote(modifiers({ metaKey: true }))).toBe(false);
	});

	it('answers to Cmd on macOS, and never to Ctrl — the platform’s own secondary-click gesture', () => {
		Platform.isMacOS = true;

		expect(opensNote(modifiers({ metaKey: true }))).toBe(true);
		expect(opensNote(modifiers({ ctrlKey: true }))).toBe(false);
	});

	/**
	 * §7: "a press carrying any OTHER modifier does neither thing" — a `Ctrl+Shift+click` or a
	 * `Mod+Shift+↵` must not open the note either. The first version of this predicate checked
	 * only the platform's own key and never asked about `Shift`/`Alt` at all, so both chords
	 * opened the note anyway; watched red against that version before this case existed.
	 */
	it('refuses the platform key chorded with Shift or Alt', () => {
		expect(opensNote(modifiers({ ctrlKey: true, shiftKey: true }))).toBe(false);
		expect(opensNote(modifiers({ ctrlKey: true, altKey: true }))).toBe(false);

		Platform.isMacOS = true;
		expect(opensNote(modifiers({ metaKey: true, shiftKey: true }))).toBe(false);
		expect(opensNote(modifiers({ metaKey: true, altKey: true }))).toBe(false);
	});

	/** The two keys together, on either platform — still "some other modifier", never a third meaning. */
	it('refuses both platform keys held at once', () => {
		expect(opensNote(modifiers({ ctrlKey: true, metaKey: true }))).toBe(false);

		Platform.isMacOS = true;
		expect(opensNote(modifiers({ ctrlKey: true, metaKey: true }))).toBe(false);
	});

	it('refuses no modifier at all', () => {
		expect(opensNote(modifiers({}))).toBe(false);
	});
});

describe('modifierLabel', () => {
	it('names Ctrl off macOS and ⌘ on it', () => {
		expect(modifierLabel()).toBe('Ctrl');

		Platform.isMacOS = true;

		expect(modifierLabel()).toBe('⌘');
	});
});
