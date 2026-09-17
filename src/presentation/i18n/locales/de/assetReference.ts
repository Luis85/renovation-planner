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
	'designer.reference.pending.hint': 'Kalibriere eine bekannte Länge auf der Vorlage, um daraus Millimeter zu machen.',
	'designer.placement': 'Platzierung',
	'designer.placement.point': 'Platzierungspunkt',
	'designer.placement.centre': 'Mitte',
	'designer.placement.back-centre': 'Hintere Mitte',
	'designer.placement.custom': 'Eigener Punkt',
	'designer.placement.hint': 'Die hintere Mitte ist die Mitte der Seite gegenüber dem Frontpfeil.',
	'designer.placement.front': 'Frontrichtung',
	'designer.placement.front.right': 'Zur rechten Seite der Zeichnung',
	'designer.placement.front.down': 'Zum unteren Rand der Zeichnung',
	'designer.placement.front.left': 'Zur linken Seite der Zeichnung',
	'designer.placement.front.up': 'Zum oberen Rand der Zeichnung',
	'designer.placement.front.angle': '{degrees}° von der rechten Seite der Zeichnung',
	'designer.clearance': 'Freiraum',
	'designer.clearance.front': 'Davor',
	'designer.clearance.back': 'Dahinter',
	'designer.clearance.left': 'Links davon',
	'designer.clearance.right': 'Rechts davon',
	'designer.clearance.generate': 'Freiraum erzeugen',
	'designer.clearance.hint':
		'Diese vier Zahlen erzeugen eine neue Grenze. Es sind deine eigenen Vorgaben, kein Standard.',
	'designer.clearance.replaces': 'Das ersetzt die Grenze, die dieses Objekt bereits hat.',
	'designer.clearance.unsupported':
		'Ein vierseitiger Helfer braucht einen rechteckigen Umriss und eine Front entlang einer Achse. Zeichne stattdessen eine Grenze nach.',
};
