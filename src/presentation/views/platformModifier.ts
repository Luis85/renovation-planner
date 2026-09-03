/**
 * THE PLATFORM MODIFIER, asked once for every door that needs it (design spec §7's Pointer
 * section and its `Mod+↵` keyboard row).
 *
 * `metaKey` on macOS and `ctrlKey` elsewhere is the host's own convention — accepting BOTH
 * keys on BOTH platforms would make a legend advertise `⌘` on macOS while `Ctrl` silently
 * worked too. That is not merely untidy there: **Ctrl-click IS macOS's own secondary-click
 * gesture**, so accepting it here would move a user reaching for a context menu into the
 * project instead. A caller refuses every OTHER modifier itself — this module answers only
 * "is the platform's own key held", never "is nothing else held".
 *
 * A structural parameter (`{ metaKey, ctrlKey }`) rather than `MouseEvent | KeyboardEvent`, so
 * `ProjectRow`'s click and `Mod+↵` keydown doors share one predicate without either importing
 * the other's event type.
 */
import { Platform } from 'obsidian';

export function opensNote(event: { readonly metaKey: boolean; readonly ctrlKey: boolean }): boolean {
	return Platform.isMacOS ? event.metaKey : event.ctrlKey;
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
