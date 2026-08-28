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
 * The consequence, stated rather than hidden: a burst of warnings or errors can fill every
 * visible slot and hold a later success back until one is dismissed. A persistent notice
 * existing to be NOT missed is the same property that lets it crowd out a transient one.
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
