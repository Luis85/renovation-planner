import type { designerAddEn } from '../en/designerAdd';

/**
 * German half of W11-A's table. Created empty beside the English one; see that file's header.
 *
 * The four tile keys added in the Task 3 fix round reuse the same short nouns the toolbar's own
 * German copy already carries inside its longer verb phrase — `assetSymbols.ts`'s
 * `'Rechteck zeichnen'` and `'Kreis zeichnen'`, `assetOpenLines.ts`'s `'Linie zeichnen'` and
 * `'Abgerundetes Rechteck zeichnen'` — so the label-in-name containment the English keys carry
 * holds here too rather than being an English-only property.
 */
export const designerAddDe: Record<keyof typeof designerAddEn, string> = {
	'designer.add': 'Hinzufügen',
	'designer.add.tile-rect': 'Rechteck',
	'designer.add.tile-rounded-rect': 'Abgerundetes Rechteck',
	'designer.add.tile-circle': 'Kreis',
	'designer.add.tile-line': 'Linie',
};
