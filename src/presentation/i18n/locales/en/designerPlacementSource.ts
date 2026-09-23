/**
 * Copy for the front-direction picker and the read-only Source & scale block (AD18-R17). Created empty by the integrator so that each task in the
 * second parity round owns one locale module and no two tasks edit the same file.
 *
 * **The four directions are the replaced sentence's own words, shortened to fit a dropdown.** That
 * sentence read "Toward the top of the drawing" (its keys were deleted with it), which is wider than
 * the Inspector rail leaves a select; the picker keeps the words (top, right, bottom, left of the
 * drawing) and drops the phrase around them. **No degree figure**
 * (AD18-R17, C04): board 01's `Top (0°)` is exactly the "up = 0 degrees" C04 refuses to copy.
 *
 * `Custom` is its own key rather than `designer.placement.custom`, whose German names a POINT.
 */
export const designerPlacementSourceEn = {
	'designer.placement.front.option.up': 'Top',
	'designer.placement.front.option.right': 'Right',
	'designer.placement.front.option.down': 'Bottom',
	'designer.placement.front.option.left': 'Left',
	'designer.placement.front.option.custom': 'Custom',
	'designer.source.title': 'Source & scale',
	'designer.source': 'Source',
	'designer.source.typed': 'Typed dimensions',
	'designer.source.traced': 'Traced on the canvas',
	'designer.source.dimensions-set': 'Dimensions set',
	'designer.source.dimensions-set.yes': 'Yes',
	'designer.source.dimensions-set.no': 'Not yet, awaiting a scale',
} as const;
