import type { designerClearanceHelperEn } from '../en/designerClearanceHelper';

/** German for the clearance helper's `All sides` field, Advanced fold and Show clearance switch (AD18-R17). */
export const designerClearanceHelperDe: Record<keyof typeof designerClearanceHelperEn, string> = {
	'designer.clearance.show': 'Freiraum anzeigen',
	// "für alle Seiten", not "auf allen Seiten": the short label has to sit inside this sentence.
	'designer.clearance.all-sides': 'Freiraum für alle Seiten',
	'designer.clearance.all-sides.short': 'Alle Seiten',
	'designer.clearance.advanced': 'Erweitert',
};
