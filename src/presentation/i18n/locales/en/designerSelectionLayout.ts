/**
 * Copy for the selection inspector's paired rows, folds and corner-radius slider (AD18-R17). Created empty by the integrator so that each task in the
 * second parity round owns one locale module and no two tasks edit the same file.
 *
 * A PAIRED input's visible label is its own short one — `X` under the pair's name `Position` — so its
 * accessible name leads with it and then carries the whole sentence the field was named by before it was
 * paired (WCAG 2.5.3). `X position` rather than `Position X`: the sentence-case rule reads a capital
 * letter mid-sentence as an error (it lets `X` through only as a brand name), and first is where it may stand. The `.short` halves go through `labelInName.test.ts` like every compact row's.
 * `Width` and `Depth` need no key here: their existing names already contain their visible labels.
 */
export const designerSelectionLayoutEn = {
	'designer.selection.fields.position': 'Position',
	'designer.selection.fields.size': 'Size',
	'designer.selection.fields.centre-x': 'X position, horizontal centre in millimetres',
	'designer.selection.fields.centre-x.short': 'X',
	'designer.selection.fields.centre-y': 'Y position, vertical centre in millimetres',
	'designer.selection.fields.centre-y.short': 'Y',
	'designer.selection.fields.position-x': 'X position, horizontal position in millimetres',
	'designer.selection.fields.position-x.short': 'X',
	'designer.selection.fields.position-y': 'Y position, vertical position in millimetres',
	'designer.selection.fields.position-y.short': 'Y',
	'designer.selection.fields.corner-radius-slider': 'Corner radius slider',
	'designer.selection.fields.appearance': 'Appearance',
	'designer.selection.fields.order': 'Order',
} as const;
