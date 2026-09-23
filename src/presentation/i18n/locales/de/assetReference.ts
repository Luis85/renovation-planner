import type { assetReferenceEn } from '../en/assetReference';

/**
 * German counterpart of `en/assetReference.ts`. The `Record<keyof …>` is what makes a key added
 * in English and forgotten here a BUILD failure rather than a silent fallback to the English
 * sentence.
 *
 * "Referenzpixel" is the German for the English "reference pixels" and is used for the same
 * reason: it names the space the numbers are in, so the calibration step reads as the thing
 * that converts them.
 */
export const assetReferenceDe: Record<keyof typeof assetReferenceEn, string> = {
	'designer.reference': 'Referenz',
	'designer.reference.sheet': 'Vorlage',
	'designer.reference.sheet.none': 'Keine gewählt',
	'designer.reference.sheet.page': '{name}, Seite {page}',
	'designer.reference.scale': 'Maßstab',
	'designer.reference.scale.none': 'Nicht kalibriert',
	'designer.reference.scale.set': 'Kalibriert',
	'designer.reference.pending.footprint': 'Der Umriss liegt noch in Referenzpixeln vor',
	'designer.reference.pending.clearance': 'Der Freiraum liegt noch in Referenzpixeln vor',
	'designer.reference.pending.anchor': 'Der Platzierungspunkt liegt noch in Referenzpixeln vor',
	'designer.reference.pending.graphics': 'Einige Grafiken liegen noch in Referenzpixeln vor',
	'designer.reference.pending.hint': 'Kalibrieren Sie eine bekannte Länge auf der Vorlage, um daraus Millimeter zu machen.',
	'designer.placement': 'Platzierung',
	'designer.placement.point': 'Platzierungspunkt',
	'designer.placement.centre': 'Mitte',
	'designer.placement.back-centre': 'Hintere Mitte',
	'designer.placement.custom': 'Eigener Punkt',
	'designer.placement.hint': 'Die hintere Mitte ist die Mitte der Seite gegenüber dem Frontpfeil.',
	'designer.placement.front': 'Frontrichtung',
	'designer.clearance': 'Freiraum',
	// "Direkt vorne"/"Direkt hinten" rather than "Davor"/"Dahinter": WCAG 2.5.3 needs the
	// visible short label ("Vorne"/"Hinten") inside this sentence, and the contracted forms
	// do not contain them.
	'designer.clearance.front': 'Direkt vorne',
	'designer.clearance.back': 'Direkt hinten',
	'designer.clearance.left': 'Links davon',
	'designer.clearance.right': 'Rechts davon',
	'designer.clearance.front.short': 'Vorne',
	'designer.clearance.back.short': 'Hinten',
	'designer.clearance.left.short': 'Links',
	'designer.clearance.right.short': 'Rechts',
	'designer.clearance.generate': 'Freiraum erzeugen',
	'designer.clearance.hint':
		'Diese vier Zahlen erzeugen eine neue Grenze. Es sind Ihre eigenen Vorgaben, kein Standard.',
	'designer.clearance.replaces': 'Das ersetzt die Grenze, die dieses Objekt bereits hat.',
	'designer.clearance.unsupported':
		'Ein vierseitiger Helfer braucht einen rechteckigen Umriss und eine Front entlang einer Achse. Zeichnen Sie stattdessen eine Grenze nach.',
};
