import type { newAssetFootprintEn } from '../en/newAssetFootprint';

/**
 * `newAssetFootprintEn`'s German twin, split out for the reason its English counterpart's own
 * header gives: keeping these keys in `de.ts` pushed it toward its 400-line `max-lines` cap.
 * `Record<keyof typeof newAssetFootprintEn, string>` rather than `Partial`: every key here
 * already has a German value, and a key added without one is a build error rather than a
 * silent English fallback — the same guarantee `de/object.ts` gives its own English twin.
 * `de.ts` spreads this object into its own (`...newAssetFootprintDe,`).
 */
export const newAssetFootprintDe: Record<keyof typeof newAssetFootprintEn, string> = {
	'form.new-asset.width': 'Breite in Millimetern (optional)',
	'form.new-asset.depth': 'Tiefe in Millimetern (optional)',
	'form.new-asset.already-created':
		'Das Objekt ist gespeichert. Seine Angaben lassen sich im Katalog bearbeiten; nur die Maße unten stehen noch aus.',
	'form.new-asset.outline': 'Grundfläche: der Umriss des Gegenstands, {width} × {depth} mm',
	'form.new-asset.already-created-outline': 'Das Objekt ist gespeichert. Seine Angaben lassen sich im Katalog bearbeiten; nur seine Grundfläche steht noch aus.',
};
