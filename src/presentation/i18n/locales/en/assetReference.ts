/**
 * The asset designer's REFERENCE, PLACEMENT and CLEARANCE vocabulary (AD12): what the spec
 * sheet and its scale are, which point a plan positions the object by, which way its front
 * points, and the four numbers a rectangular clearance helper generates a boundary from.
 *
 * Its own module for `assetArrange.ts`'s reason. Spread into `en/editor.ts`.
 *
 * **Every direction word is about the DRAWING and not about the object's own left and right**,
 * which are two different readings of the same arrow and the exact confusion C04 refuses to
 * let a mockup settle. `designer.placement.front.*` names where the front arrow points on the
 * sheet; `designer.clearance.left` and `.right` name the object's own sides, derived from that
 * arrow in `DesignerReferenceFrame.ts` and pinned there by a fixture.
 *
 * **One key per pending group rather than one key holding a list**, because a list assembled
 * in a component is a translated fragment concatenated with another — the thing `strings.ts`
 * refuses, and the reason a sentence per group is cheaper than it looks.
 *
 * **No key here certifies anything.** There is no "fits", no "compliant" and no "verified":
 * AD01 §3 defers the green fit badge permanently, and C07 says a clearance is an authored
 * planning boundary rather than a regulatory approval. The helper's own hint says the numbers
 * are the renovator's, which is the strongest claim this surface is allowed to make.
 */
export const assetReferenceEn = {
	'designer.reference': 'Reference',
	'designer.reference.sheet': 'Sheet',
	'designer.reference.sheet.none': 'None chosen',
	// A PDF's page is part of WHICH sheet this is, so it is in the sheet's own value rather than
	// a fourth row: an asset traced off page 4 of a catalogue is not traced off page 1 of it.
	'designer.reference.sheet.page': '{name}, page {page}',
	'designer.reference.scale': 'Scale',
	'designer.reference.scale.none': 'Not calibrated',
	'designer.reference.scale.set': 'Calibrated',
	// "Reference pixels" rather than "unscaled": it says WHICH space the numbers are in, which is
	// what tells the reader that calibrating is the step that converts them.
	'designer.reference.pending.footprint': 'The outline is still in reference pixels',
	'designer.reference.pending.clearance': 'The clearance is still in reference pixels',
	'designer.reference.pending.anchor': 'The placement point is still in reference pixels',
	'designer.reference.pending.graphics': 'Some graphics are still in reference pixels',
	'designer.reference.pending.hint': 'Calibrate a known length on the sheet to turn these into millimetres.',
	'designer.placement': 'Placement',
	'designer.placement.point': 'Placement point',
	'designer.placement.centre': 'Centre',
	'designer.placement.back-centre': 'Back centre',
	'designer.placement.custom': 'Custom',
	'designer.placement.hint': 'Back centre is the middle of the side opposite the front arrow.',
	'designer.placement.front': 'Front direction',
	'designer.placement.front.right': 'Toward the right of the drawing',
	'designer.placement.front.down': 'Toward the bottom of the drawing',
	'designer.placement.front.left': 'Toward the left of the drawing',
	'designer.placement.front.up': 'Toward the top of the drawing',
	'designer.placement.front.angle': '{degrees}° from the right of the drawing',
	'designer.clearance': 'Clearance',
	'designer.clearance.front': 'In front',
	'designer.clearance.back': 'Behind',
	'designer.clearance.left': 'To its left',
	'designer.clearance.right': 'To its right',
	'designer.clearance.generate': 'Generate clearance',
	'designer.clearance.hint': 'These four numbers generate a new boundary. They are your own allowances, not a standard.',
	'designer.clearance.replaces': 'This replaces the boundary this object already has.',
	'designer.clearance.unsupported':
		'A four-sided helper needs a rectangular outline and a front pointing along an axis. Trace a boundary instead.',
} as const;
