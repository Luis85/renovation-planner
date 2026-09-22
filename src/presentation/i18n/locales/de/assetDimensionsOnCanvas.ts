import type { assetDimensionsOnCanvasEn } from '../en/assetDimensionsOnCanvas';

/**
 * German half of W19-A's on-canvas dimensions.
 *
 * "Abstand" and not "Versatz" for an offset. `grep -rn "Versatz" src/presentation/i18n/locales/de/`
 * prints ONE line — this sentence — and no translated value anywhere; the first version of it
 * claimed the grep printed "nothing at all", which the act of writing it had already made false.
 * "Abstand" is already this table's word for an offset —
 * `editor.drafting.offset` is *"Abstand (m)"* and `editor.structure.offset` is *"Abstand vom
 * Wandanfang (m)"* — and a figure drawn on the canvas is the last place to introduce a second
 * word for one idea.
 *
 * The refusal addresses the user formally, as every neighbouring instruction in this table does
 * (`editor.drafting.offset-invalid`, `editor.reference.measure-help`).
 *
 * `designer.dimension.value` keeps the English order because it is a number with a unit after a
 * noun in both languages, and "mm" is the SI symbol rather than a translated word.
 */
export const assetDimensionsOnCanvasDe: Record<keyof typeof assetDimensionsOnCanvasEn, string> = {
	'designer.dimension.overall-width': 'Gesamtbreite',
	'designer.dimension.overall-depth': 'Gesamttiefe',
	'designer.dimension.width': 'Breite',
	'designer.dimension.depth': 'Tiefe',
	'designer.dimension.offset-left': 'Abstand zur linken Kante',
	'designer.dimension.offset-right': 'Abstand zur rechten Kante',
	'designer.dimension.offset-top': 'Abstand zur oberen Kante',
	'designer.dimension.offset-bottom': 'Abstand zur unteren Kante',
	'designer.dimension.value': '{name} {value} mm',
	'designer.dimension.edit': '{name} bearbeiten',
	'designer.dimension.unavailable': 'Geben Sie ein Maß in Millimetern ein.',
	'designer.view.all-dimensions': 'Alle Maße',
};
