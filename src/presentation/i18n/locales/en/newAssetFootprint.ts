/**
 * The New asset dialog's footprint copy — the two typed dimensions, the sentence naming what a
 * retry re-sends once the catalogue entry exists, and their outline counterpart (2026-09-13 item
 * modes spec §B), when the dialog is opened from a plan item instead of typed from blank. Split
 * out of `en.ts` for the same reason `en/mobile.ts` is: the New asset form's footprint keys keep
 * pushing `en.ts` past the 400-line `max-lines` cap, and the fix is the extraction rather than a
 * wider budget. `en.ts` spreads this object into its own (`...newAssetFootprintEn,`), so
 * `StringKey = keyof typeof en` stays exact.
 */
export const newAssetFootprintEn = {
	// The unit is named in the LABEL rather than left to a placeholder: every world
	// coordinate in this plugin is millimetres (ADR-009), and a bare `Width` invites metres.
	'form.new-asset.width': 'Width in millimetres (optional)',
	'form.new-asset.depth': 'Depth in millimetres (optional)',
	// Shown only after the catalogue entry has been written and the footprint has not. It
	// names the state rather than apologising for it: the asset exists, its details are no
	// longer this dialog's to change, and the dimensions are what a retry re-sends.
	'form.new-asset.already-created':
		'The asset is saved. Its details can be edited from the catalogue; only the dimensions below are still pending.',
	// Opened from a plan item (2026-09-13 item modes spec §B): its outline stands where the two dimension fields
	// would, and the retry sentence names the footprint rather than dimensions nobody typed.
	'form.new-asset.outline': 'Footprint: the item outline, {width} × {depth} mm',
	'form.new-asset.already-created-outline': 'The asset is saved. Its details can be edited from the catalogue; only its footprint is still pending.',
} as const;
