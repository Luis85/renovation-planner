import type { designerPlacementSourceEn } from '../en/designerPlacementSource';

/** German for the front-direction picker and the read-only Source & scale block (AD18-R17). */
export const designerPlacementSourceDe: Record<keyof typeof designerPlacementSourceEn, string> = {
	'designer.placement.front.option.up': 'Oben',
	'designer.placement.front.option.right': 'Rechts',
	'designer.placement.front.option.down': 'Unten',
	'designer.placement.front.option.left': 'Links',
	'designer.placement.front.option.custom': 'Eigene Richtung',
	'designer.source.title': 'Quelle und Maßstab',
	'designer.source': 'Quelle',
	'designer.source.typed': 'In Millimetern erfasst',
	'designer.source.traced': 'Auf der Zeichenfläche nachgezeichnet',
	'designer.source.dimensions-set': 'Maße festgelegt',
	'designer.source.dimensions-set.yes': 'Ja',
	'designer.source.dimensions-set.no': 'Noch nicht, ein Maßstab fehlt',
};
