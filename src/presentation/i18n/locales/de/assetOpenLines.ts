import type { assetOpenLinesEn } from '../en/assetOpenLines';

/**
 * German counterpart of `en/assetOpenLines.ts`.
 *
 * **The imperatives are du, matching `de/assetArrange.ts`** — the `asset.*` refusal family this
 * table's own refusal joins, where `locked-part` says *"Entsperre es"* and `overlapping-groups` says
 * *"Hebe diese zuerst auf"*. `de/editor.ts`'s wider vocabulary uses Sie, so the repository is split
 * and neither register is the house one; what a new string can be held to is the family it sits
 * beside, and `extent-not-scalable` shipped as the only Sie member of that family (AD11 review, F7).
 */
export const assetOpenLinesDe: Record<keyof typeof assetOpenLinesEn, string> = {
	'designer.toolbar.draw-line': 'Linie zeichnen',
	'designer.toolbar.draw-rounded-rect': 'Abgerundetes Rechteck zeichnen',
	'designer.selection.open-graphic': 'Eine Linie hat kein Inneres: Durchgezogen und gestrichelt bestimmen nur ihr Muster, keines füllt sie.',
	'designer.selection.mode.transform.open': 'Eine Linie hat keine Griffe zum Skalieren oder Drehen: Zieh sie, um sie zu verschieben, oder setze Mittelpunkt, Größe und Drehung in den Feldern darunter',
	'asset.extent-not-scalable': 'Diese Linie ist entlang dieser Achse flach, daher kann eine Größe sie dort nicht dehnen. Drehe sie oder verschiebe ein Ende.',
};
