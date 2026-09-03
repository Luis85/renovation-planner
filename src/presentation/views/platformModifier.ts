/**
 * THE PLATFORM MODIFIER, asked once for every door that needs it (design spec §7's Pointer
 * section and its `Mod+↵` keyboard row).
 *
 * `metaKey` on macOS and `ctrlKey` elsewhere is the host's own convention — accepting BOTH
 * keys on BOTH platforms would make a legend advertise `⌘` on macOS while `Ctrl` silently
 * worked too. That is not merely untidy there: **Ctrl-click IS macOS's own secondary-click
 * gesture**, so accepting it here would move a user reaching for a context menu into the
 * project instead.
 *
 * **`opensNote` answers "is the platform's own key held and NOTHING ELSE", not merely "is it
 * held".** §7 says a press carrying any OTHER modifier opens neither thing — a first version
 * checked only the platform key, which let `Ctrl+Shift+click` and `Mod+Shift+↵` open the note
 * anyway, since `Shift` was never asked about. The chord test belongs HERE rather than at each
 * of `ProjectRow`'s two call sites: both need the identical refusal, and a caller reaching for
 * `event.shiftKey`/`event.altKey` itself is the exact duplication this module exists to avoid.
 * A caller still refuses every modifier ON ITS OWN for the "neither" arm §7 also specifies —
 * this function only ever answers the POSITIVE question.
 *
 * A structural parameter (`{ metaKey, ctrlKey, altKey, shiftKey }`) rather than
 * `MouseEvent | KeyboardEvent`, so `ProjectRow`'s click and `Mod+↵` keydown doors share one
 * predicate without either importing the other's event type — and a native event already
 * carries all four, so neither call site changed when this widened.
 */
import { Platform } from 'obsidian';

export function opensNote(event: {
	readonly metaKey: boolean;
	readonly ctrlKey: boolean;
	readonly altKey: boolean;
	readonly shiftKey: boolean;
}): boolean {
	if (event.altKey || event.shiftKey) return false;
	return Platform.isMacOS ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/**
 * The key legend's own spelling of the platform modifier. Its only caller is Task 9's foot
 * line — this module exists for both doors together because both read the identical platform
 * flag and a caller reaching for `Platform` separately is the duplication this file exists to
 * avoid.
 */
export function modifierLabel(): string {
	return Platform.isMacOS ? '⌘' : 'Ctrl';
}
