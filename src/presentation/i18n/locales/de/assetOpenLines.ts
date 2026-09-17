import type { assetOpenLinesEn } from '../en/assetOpenLines';

/**
 * German counterpart of `en/assetOpenLines.ts`.
 *
 * **Sie throughout, like every other German table here.** This module briefly used du to match
 * `de/assetArrange.ts`, on the reading that the repository was split between registers and that a
 * new string should match the family it sits beside. That reading was wrong and the gate said so:
 * `strings.test.ts` asserts *no du-form imperative anywhere in `de.ts`* — there is a house register
 * and it is Sie. What made the mistake possible is that the neighbours being matched were violating
 * the same rule invisibly, because that test enumerates the du-forms it refuses and did not list
 * theirs. Seven strings across three of this wave's tables were converted together, and the verb
 * list was widened so that the next one is caught rather than copied.
 */
export const assetOpenLinesDe: Record<keyof typeof assetOpenLinesEn, string> = {
	'designer.toolbar.draw-line': 'Linie zeichnen',
	'designer.toolbar.draw-rounded-rect': 'Abgerundetes Rechteck zeichnen',
	'designer.selection.open-graphic': 'Eine Linie hat kein Inneres: Durchgezogen und gestrichelt bestimmen nur ihr Muster, keines füllt sie.',
	'designer.selection.mode.transform.open': 'Eine Linie hat keine Griffe zum Skalieren oder Drehen: Ziehen Sie sie, um sie zu verschieben, oder setzen Sie Mittelpunkt, Größe und Drehung in den Feldern darunter',
	'asset.extent-not-scalable': 'Diese Linie ist entlang dieser Achse flach, daher kann eine Größe sie dort nicht dehnen. Drehen Sie sie oder verschieben Sie ein Ende.',
};
