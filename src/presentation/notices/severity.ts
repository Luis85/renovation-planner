import type { StringKey } from '../i18n/locales/en';

/**
 * What a notice is ABOUT, which decides how long it stays and how urgently a screen reader
 * announces it. Four members, from design slice 13.
 */
export type NoticeSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * How long each severity stays before dismissing itself; `null` means it stays until
 * dismissed. The SDD names no numbers, so these are this slice's own tunable defaults.
 *
 * `warning` is grouped with `error` rather than with the auto-dismissing pair, on the
 * reasoning that a warning exists to flag something the user may need to register — and
 * auto-hiding it risks exactly the failure mode a warning exists to prevent.
 *
 * The consequence, stated rather than hidden: nothing expires the two persistent severities,
 * so three of them fill every visible slot and hold EVERYTHING behind them — the queue keeps
 * a held notice and promotes it, but not until a user dismisses one. A persistent notice
 * existing to be NOT missed is the same property that lets it crowd out a transient one.
 *
 * **Design slice 17 took the remedy this paragraph names below, for the ERROR case only.**
 * `queue.ts`'s `promote` now lets a held `error` take a slot from a visible `warning` —
 * newest first, the demoted one kept and re-promoted rather than dropped, and never an error
 * evicting another error. What is written below as "revisiting it means…" is therefore done;
 * what remains true is everything else in this paragraph, for every pairing that is not
 * error-behind-warning. A `success` or `info` behind three warnings still waits.
 *
 * **Name the victim honestly: it is a later ERROR, not only a later success.** An earlier
 * draft of this paragraph said "hold a later success back", which reads as a nuisance and is
 * the least costly case. Three warnings are one command and one background cascade away —
 * `background.unsupported` from `planEditorCommands.ts` plus `cascade.aborted` and
 * `cascade.stale-marker-failed` from the composition root are three distinct sentences, none
 * of which dedups into another and none of which expires — and with those three up, every
 * `notifyError` is queued invisibly. It is not LOST (the queue holds it, counts its repeats
 * and promotes it into the first freed slot), and it still announces: `notify.ts` writes into
 * a live region on `render`, which only runs when the notice is shown, so a screen-reader user
 * hears nothing either. The cap is what makes a persistent tier survivable and this is what it
 * costs; revisiting it means giving `error` priority over a held `warning` rather than raising
 * `MAX_VISIBLE_NOTICES`, which only moves the number at which this starts.
 *
 * That last sentence is no longer a prediction — slice 17 implemented exactly it, and the
 * choice is worth keeping recorded because it was made here, before the need arrived, and
 * turned out to be the right one when the need did. The price it does carry: a user can now
 * see a warning leave the screen without having dismissed it. The queue keeps it, so the
 * failure mode is confusion rather than loss.
 */
export const AUTO_DISMISS_MS: Readonly<Record<NoticeSeverity, number | null>> = {
	success: 4000,
	info: 6000,
	warning: null,
	error: null,
};

/**
 * The translated word that rides beside the colour. SDD §85 forbids status carried by colour
 * alone, and this — rather than an icon — is how that rule is kept: this plugin has never
 * called `setIcon`, and a text label satisfies the rule on its own.
 *
 * **It does not satisfy `docs/components/Toast.md`, which asks for more than SDD §85 does**:
 * "each variant owes a mark as well as a colour". An earlier version of this docblock read as
 * though the word closed everything the mark could have, and it closed the SDD rule only. The
 * mark is `.rp-notice-mark` in `styles/notices.css`, built beside this word in `notify.ts`,
 * `aria-hidden` and text-free so the word is still the whole accessible name — and still no
 * `setIcon`, which was always the reason for preferring a word over an icon and remains true
 * of a CSS-drawn glyph.
 */
export const SEVERITY_LABEL_KEYS: Readonly<Record<NoticeSeverity, StringKey>> = {
	success: 'notice.severity.success',
	info: 'notice.severity.info',
	warning: 'notice.severity.warning',
	error: 'notice.severity.error',
};

/**
 * How many notices are on screen at once. Enough to follow a multi-step operation without
 * the stack covering meaningful canvas; anything further waits and is promoted into a freed
 * slot rather than dropped.
 */
export const MAX_VISIBLE_NOTICES = 3;
