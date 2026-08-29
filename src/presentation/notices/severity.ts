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
 */
export const AUTO_DISMISS_MS: Readonly<Record<NoticeSeverity, number | null>> = {
	success: 4000,
	info: 6000,
	warning: null,
	error: null,
};

/**
 * The translated word that rides beside the colour. SDD §85 forbids status carried by
 * colour alone, and this — rather than an icon — is how that rule is kept: this plugin has
 * never called `setIcon`, and a text label satisfies the rule on its own.
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
