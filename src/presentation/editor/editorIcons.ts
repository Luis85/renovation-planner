import type { RenovationMode } from './renovation/renovationSession';

/** One vocabulary for overview navigation, linked records and contextual creation. */
export const EDITOR_MODE_ICONS: Readonly<Record<RenovationMode, string>> = {
	overview: 'layout-dashboard', existing: 'house', planned: 'pencil', work: 'hammer',
	materials: 'layers', costs: 'circle-dollar-sign', documents: 'file-text', photos: 'image', notes: 'sticky-note',
};
export const EDITOR_PERSPECTIVE_ICONS = { plan: 'grid-2x-2', renovate: 'paintbrush', review: 'clipboard-list' } as const;
