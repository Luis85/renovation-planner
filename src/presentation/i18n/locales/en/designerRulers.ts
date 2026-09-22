/**
 * The canvas rulers' copy — card W17-B, the asset designer snapping spec's increment 3 (AD18-R9).
 *
 * **ONE string, and the ruler's own numbers are deliberately not among them.** A labelled tick is
 * an integer the template renders directly, the way `DesignerToolbar.vue`'s zoom readout renders its percent;
 * what needs a table is the ACCESSIBLE NAME of the pair, because the ticks sit inside a
 * `role="img"` and a screen reader is told the scale rather than read a list of loose integers.
 *
 * The unit is spelled out, as `designer.status.grid` spells it beside the same number, and the
 * claim is safe for the same reason: `DesignerRulers.vue` draws nothing over a design whose
 * `dimensionsUnscaled` is set, so "mm" is never put on a coordinate that is not a measurement.
 */
export const designerRulersEn = {
	'designer.rulers': 'Rulers in {step} mm steps',
} as const;
