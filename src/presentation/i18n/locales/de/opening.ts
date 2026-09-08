import type { openingEn } from '../en/opening';
export const openingDe: Record<keyof typeof openingEn, string> = {
	'editor.opening.symbol': 'Öffnungssymbol',
	'editor.opening.hinge': 'Scharnierposition',
	'editor.opening.start': 'Anfang der Öffnung',
	'editor.opening.end': 'Ende der Öffnung',
	'editor.opening.side': 'Öffnungsseite',
	'editor.opening.left': 'Links von der Wand',
	'editor.opening.right': 'Rechts von der Wand',
	'editor.opening.angle': 'Öffnungswinkel (0–180°)',
	'editor.opening.direction-help': 'Anfang, Ende, links und rechts beziehen sich auf die Richtung vom Wandanfang zum Wandende.',
	'editor.structure.error.opening-swing': 'Scharnier, Öffnungsseite und einen Winkel zwischen 0 und 180 Grad wählen.',
};
