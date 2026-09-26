/**
 * Copy for the save-state indicator's relative save time (AD18-R19) (AD18-R17). Created empty by the integrator so that each task in the
 * second parity round owns one locale module and no two tasks edit the same file.
 *
 * Whole phrases, one key each, so word order stays the translator's (`strings.ts`): German puts the
 * time first. `{time}` is the host language's own short clock time, never a fixed format.
 *
 * `save-state.saved-on-date` (AD18-R21) is a fifth tier: a save from an earlier CALENDAR day
 * (local time), once it is over an hour old, names the day rather than reading `Saved at HH:MM`
 * as though it happened today. `{date}` is `Intl.DateTimeFormat` with `{ month: 'short', day:
 * 'numeric' }` in the current language, the same way `{time}` is the current language's short
 * clock time.
 */
export const saveStateRelativeEn = {
	'save-state.saved-just-now': 'Saved just now',
	'save-state.saved-minutes-ago': 'Saved {minutes} min ago',
	'save-state.saved-at': 'Saved at {time}',
	'save-state.saved-on-date': 'Saved {date} at {time}',
} as const;
