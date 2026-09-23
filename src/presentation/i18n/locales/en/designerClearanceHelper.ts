/**
 * Copy for the clearance helper's `All sides` field, Advanced fold and Show clearance switch (AD18-R17).
 * One locale module per task in the second parity round, so no two tasks edit the same file.
 */
export const designerClearanceHelperEn = {
	'designer.clearance.show': 'Show clearance',
	// The compact row's short label and its accessible name: WCAG 2.5.3 needs the short one inside
	// the sentence, which `labelInName.test.ts` checks for every `.short` key in both locales.
	'designer.clearance.all-sides': 'Clearance on all sides',
	'designer.clearance.all-sides.short': 'All sides',
	'designer.clearance.advanced': 'Advanced',
} as const;
