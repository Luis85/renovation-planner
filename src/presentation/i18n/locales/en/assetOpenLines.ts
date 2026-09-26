/**
 * The asset designer's OPEN GRAPHIC vocabulary (AD11): the two new toolbar buttons, the one
 * sentence a selected line's inspector says about what its style controls can and cannot mean, the
 * tooltip its one remaining selection mode carries, and the refusals those controls can raise.
 * Spread into `en/editor.ts`.
 *
 * **The `asset.*` entries are error CODES, not labels** — `toUserMessage` looks a refusal up by its
 * code, so a key here whose name is a code is how a domain refusal gets a sentence instead of the
 * generic category one. `extent-not-scalable` is the one this card adds, and it is reachable only
 * on an open graphic: a closed one must enclose an area, so neither of its extents can be zero.
 * The other refusals a line's fields can answer — `asset.part-not-found`, `asset.invalid-detail`,
 * `asset.invalid-scale` — already have their sentences and are not repeated here.
 *
 * The rounded rectangle's Corner radius field (AD18-R16 Task 12) lives here too, beside the tool
 * that draws one: its label pair and its two refusals, both raised by `setCornerRadius`.
 */
export const assetOpenLinesEn = {
	'designer.toolbar.draw-line': 'Draw line',
	'designer.toolbar.draw-rounded-rect': 'Draw rounded rectangle',
	// Said where the consequence is: the Line control is drawn for an open graphic and keeps
	// working, but only half of what it means for a closed one applies. C12's rule about a control
	// that would otherwise appear to do nothing, and C10's rule that an open path is never filled.
	'designer.selection.open-graphic': 'A line has no inside, so solid and dashed set its pattern only — neither fills it.',
	// Transform is the only mode an open graphic is offered, so its tooltip names the gesture it
	// really has. `selectionHandles` draws no box and no rotate handle on a path, and saying that
	// only in a docblock leaves a user pressing a mode whose handles never appear.
	'designer.selection.mode.transform.open': 'A line has no resize or rotate handles: drag it to move it, or set its centre, size and rotation in the fields below',
	'asset.extent-not-scalable': 'This line is flat along that axis, so a size cannot stretch it there. Rotate it or move an end instead.',
	'designer.selection.corner-radius': 'Corner radius in millimetres',
	'designer.selection.corner-radius.short': 'Corner radius',
	'asset.corner-radius-out-of-range': 'A corner radius must be more than 0 and less than half the rectangle’s shorter side.',
	'asset.not-rounded-rectangle': 'This graphic is no longer a rounded rectangle, so it has no corner radius to set.',
} as const;
