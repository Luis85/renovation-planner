import type { PlanKind } from '../../domain/plan/PlanKind';
import type { StringKey } from '../i18n/locales/en';
import type { RenovationMode } from './renovation/renovationSession';

/** One vocabulary for overview navigation, linked records and contextual creation. */
export const EDITOR_MODE_ICONS: Readonly<Record<RenovationMode, string>> = {
	overview: 'layout-dashboard', existing: 'house', planned: 'pencil', work: 'hammer',
	materials: 'layers', costs: 'circle-dollar-sign', documents: 'file-text', photos: 'image', notes: 'sticky-note',
};
export const EDITOR_PERSPECTIVE_ICONS = { plan: 'grid-2x-2', renovate: 'paintbrush', review: 'clipboard-list' } as const;

/** The Property tree's and the context bar's icon per plan kind (ADR-0029). The project row keeps `house`. */
export const PLAN_KIND_ICONS: Readonly<Record<PlanKind, string>> = {
	site: 'land-plot', building: 'building', floor: 'grid-2x-2', room: 'door-open',
};
/** The localised name of each kind — the tree's level label, the menu's and the form's option text. */
export const PLAN_KIND_LABELS: Readonly<Record<PlanKind, StringKey>> = {
	site: 'editor.shell.kind.site', building: 'editor.shell.kind.building', floor: 'editor.shell.kind.floor', room: 'editor.shell.kind.room',
};
