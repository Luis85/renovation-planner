import type { designerRulersEn } from '../en/designerRulers';

/**
 * German half of W17-B's one string. "Lineal" is the drawing instrument, and it is deliberately
 * not "Maßstab": `grep -rn "Maßstab" src/presentation/i18n/locales/de/` prints ten lines, every
 * one of them about a drawing's SCALE — `designer.trace.scale` and `designer.selection.unscaled`
 * among them — which is a different fact from the millimetre rule drawn along the canvas.
 */
export const designerRulersDe: Record<keyof typeof designerRulersEn, string> = {
	'designer.rulers': 'Lineale in {step}-mm-Schritten',
};
