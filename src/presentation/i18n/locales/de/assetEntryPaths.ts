import type { assetEntryPathsEn } from '../en/assetEntryPaths';

/** German for the asset designer's creation vocabulary; the counterpart of `en/assetEntryPaths.ts`. */
export const assetEntryPathsDe: Record<keyof typeof assetEntryPathsEn, string> = {
	'designer.preset.search': 'Vorlagen durchsuchen',
	'designer.preset.no-matches': 'Keine Vorlage passt zu dieser Suche.',
	'designer.preset.editable': 'Eine Vorlage zeichnet ganz normale bearbeitbare Geometrie. Diese Werte werden nicht gespeichert, spätere Änderungen erfolgen an der Form selbst.',
};
