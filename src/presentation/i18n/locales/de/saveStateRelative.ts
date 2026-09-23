import type { saveStateRelativeEn } from '../en/saveStateRelative';

/** German for the save-state indicator's relative save time (AD18-R19) (AD18-R17). */
export const saveStateRelativeDe: Record<keyof typeof saveStateRelativeEn, string> = {
	'save-state.saved-just-now': 'Gerade gespeichert',
	'save-state.saved-minutes-ago': 'Vor {minutes} Min. gespeichert',
	'save-state.saved-at': 'Um {time} gespeichert',
};
