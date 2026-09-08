import type { curvesEn } from '../en/curves';
export const curvesDe: Record<keyof typeof curvesEn, string> = {
	'editor.curves.action': 'Kurven bearbeiten',
	'editor.curves.instruction': 'Ziehe einen nummerierten Biegegriff oder gib in Details Biegetiefe oder Radius ein.',
	'editor.curves.precision': 'Biegetiefe und Radius',
	'editor.curves.edge': 'Kante {n} · {length} m',
	'editor.curves.depth': 'Biegetiefe (m)',
	'editor.curves.radius': 'Radius (m)',
	'editor.curves.direction': 'In Richtung des Kantenpfeils: Positive Tiefe biegt nach links, negative nach rechts. Null macht die Kante gerade.',
	'editor.curves.limit': 'Eine Biegung darf höchstens einen Halbkreis bilden. Der Radius muss mindestens die Hälfte des Abstands zwischen den Ecken betragen.',
	'editor.curves.straighten': 'Diese Kante begradigen',
	'editor.curves.save': 'Kurven übernehmen',
	'editor.curves.invalid': 'Diese Kurve kreuzt eine andere Begrenzung oder die Öffnungen passen nicht mehr auf die Wand. Passe die Biegung vor dem Übernehmen an.',
	'editor.curves.conflict': 'Die Quelle wurde geändert. Brich ab und öffne Kurven bearbeiten erneut, um die aktuelle Geometrie zu verwenden.',
	'editor.curves.wall-note': 'Öffnungen folgen der gebogenen Wand entlang ihrer Länge. Verbundene Räume behalten ihre eigenen Umrisse.',
};
