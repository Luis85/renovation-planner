import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { StringKey } from '../../i18n/locales/en';

/**
 * The canvas legend's rows (AD18-R16 Task 4, board 01): what each swatch stands for and, through
 * {@link legendRows}, which of them this DESIGN actually has.
 *
 * Board order rather than z-order or the Konva layer order `DesignerCanvas.vue` draws in: the
 * board reads Clearance, Footprint, Details, Placement point, Front direction, and this is the
 * one place that order is written down.
 */
export type LegendRowKind = 'clearance' | 'footprint' | 'details' | 'placement' | 'facing';

export interface LegendRow {
	readonly kind: LegendRowKind;
	readonly label: StringKey;
}

const LEGEND_LABELS: Record<LegendRowKind, StringKey> = {
	clearance: 'designer.legend.clearance',
	footprint: 'designer.legend.footprint',
	details: 'designer.legend.details',
	placement: 'designer.legend.placement-point',
	facing: 'designer.legend.front-direction',
};

/**
 * Which rows a design earns, in board order. `null` — no shape traced yet — earns none, which is
 * also every asset the empty-state overlay is drawn over (`selectAssetDesignerEmptyState`): a
 * shape is exactly what that selector's `null` arm requires, so this list is empty at precisely
 * the moment the overlay replaces the canvas with onboarding copy, with no second gate needed.
 *
 * Footprint, the placement point and the front direction are unconditional facts of any shape —
 * `AssetShape.anchor` and `.facing` are not nullable — so only Clearance and Details are asked:
 * "no Clearance row without a clearance, no Details row without details" (the brief's own words).
 * Both ask the DESIGN, never the Parts panel's leaf-local `hidden` set (AD09): that set is an
 * editing aid that drops a graphic from one frame and reaches nothing the vault holds, so a
 * legend explaining what the design's vocabulary MEANS keeps naming a part the user has merely
 * hidden from view for a moment.
 */
export function legendRows(shape: AssetShape | null): readonly LegendRow[] {
	if (shape === null) return [];
	const kinds: LegendRowKind[] = [];
	if (shape.clearance !== null) kinds.push('clearance');
	kinds.push('footprint');
	if (shape.details.length > 0) kinds.push('details');
	kinds.push('placement');
	kinds.push('facing');
	return kinds.map((kind) => ({ kind, label: LEGEND_LABELS[kind] }));
}
