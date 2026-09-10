import type { inputEn } from '../en/input';
export const inputDe: Record<keyof typeof inputEn, string> = {
	'editor.input.pan': 'Verschieben',
	'editor.input.context': 'Planaktionen',
	'editor.input.edit': 'Bearbeiten',
	'editor.input.rename': 'Umbenennen',
	'editor.input.rotate': 'Drehen',
	'editor.input.delete': 'Löschen',
	'editor.input.lock': '{name} sperren',
	'editor.input.unlock': '{name} entsperren',
	'editor.input.locked': 'Gesperrt',
	'editor.input.unavailable': 'Nicht verfügbar, solange ein anderes Werkzeug oder eine Bearbeitung aktiv ist.',
	'editor.input.parent-zone-missing': 'Der Raum, den dieser Plan detailliert, existiert nicht mehr',
};
