/**
 * Copy for the save-state indicator's relative save time (AD18-R19) (AD18-R17). Created empty by the integrator so that each task in the
 * second parity round owns one locale module and no two tasks edit the same file.
 *
 * Whole phrases, one key each, so word order stays the translator's (`strings.ts`): German puts the
 * time first. `{time}` is the host language's own short clock time, never a fixed format.
 */
export const saveStateRelativeEn = {
	'save-state.saved-just-now': 'Saved just now',
	'save-state.saved-minutes-ago': 'Saved {minutes} min ago',
	'save-state.saved-at': 'Saved at {time}',
} as const;
