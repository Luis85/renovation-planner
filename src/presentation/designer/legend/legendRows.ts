import { coincident } from '../../../core/geometry/operations';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { currentAnchorPreset, rectangularFootprint, type AnchorPreset } from '../../../domain/asset/referenceFrame';
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
	/** The label's interpolation, for the one row that carries a figure (`Clearance ({size} mm)`). */
	readonly params?: Readonly<Record<string, string>>;
}

const LEGEND_LABELS: Record<Exclude<LegendRowKind, 'placement'>, StringKey> = {
	clearance: 'designer.legend.clearance',
	footprint: 'designer.legend.footprint',
	details: 'designer.legend.details',
	facing: 'designer.legend.front-direction',
};

/** `null` from `currentAnchorPreset` is the segment's third, `Custom`, pressed state. */
const PLACEMENT_LABELS: Record<AnchorPreset | 'custom', StringKey> = {
	'back-centre': 'designer.legend.placement-point.back-centre',
	centre: 'designer.legend.placement-point.centre',
	custom: 'designer.legend.placement-point.custom',
};

/**
 * Which rows a design earns, in board order. `null` — no shape traced yet — earns none, which is
 * also every asset the empty-state overlay is drawn over (`selectAssetDesignerEmptyState`): a
 * shape is what that selector's `null` arm requires, so this list is empty whenever the overlay
 * replaces the canvas with onboarding copy, with no second gate needed. (The overlay is also
 * withheld while a tool is active, so the converse does not hold: a shapeless asset with a tool
 * armed draws neither.)
 *
 * Footprint, the placement point and the front direction are unconditional facts of any shape —
 * `AssetShape.anchor` and `.facing` are not nullable — so only Clearance and Details are asked.
 * Both ask the DESIGN, never the Parts panel's leaf-local `hidden` set (AD09): that set is an
 * editing aid that drops a graphic from one frame and reaches nothing the vault holds.
 *
 * **Two rows say something about THIS design (AD18-R17, board 01).** The placement point names
 * its preset through `currentAnchorPreset` — the SAME call `DesignerReferencePlacement` makes for
 * its segment's pressed state, so the two agree whenever no gesture is live. During an anchor or
 * footprint drag they do NOT: `DesignerLegend` hands this function the preview, as AD18-R11
 * requires, while the segment reads the committed shape, so the legend runs ahead until release.
 * The clearance names a figure only through {@link uniformSetback}.
 */
export function legendRows(shape: AssetShape | null): readonly LegendRow[] {
	if (shape === null) return [];
	const rows: LegendRow[] = [];
	if (shape.clearance !== null) {
		const setback = uniformSetback(shape, shape.clearance);
		rows.push(setback === null
			? { kind: 'clearance', label: LEGEND_LABELS.clearance }
			: { kind: 'clearance', label: 'designer.legend.clearance.uniform', params: { size: String(Math.round(setback)) } });
	}
	rows.push({ kind: 'footprint', label: LEGEND_LABELS.footprint });
	if (shape.details.length > 0) rows.push({ kind: 'details', label: LEGEND_LABELS.details });
	const preset = currentAnchorPreset(shape.footprint, shape.facing, shape.anchor);
	rows.push({ kind: 'placement', label: PLACEMENT_LABELS[preset ?? 'custom'] });
	rows.push({ kind: 'facing', label: LEGEND_LABELS.facing });
	return rows;
}

/**
 * How far the clearance stands off the footprint when it stands off by ONE amount on all four
 * sides, else `null`. AD18-R17: a single figure over an asymmetric boundary would be a false
 * measurement, and C07 refuses to infer four setbacks from an arbitrary polygon — so both outlines
 * must be axis-aligned rectangles (`rectangularFootprint`, the predicate the clearance helper
 * withholds its fields on), the clearance must be the footprint's box grown by the same amount
 * each way (within `coincident`'s tolerance, since the helper's sums are floating point) and that
 * amount must still read at least 1 mm once rounded as the label rounds it, and neither outline may
 * be PENDING, since a difference in sheet pixels is not a millimetre.
 *
 * Written here because nothing reads a setback BACK today: `DesignerClearanceHelper` generates a
 * boundary and, by its own docblock, never turns one into numbers. This reads one number, only
 * where one number is the whole truth, which is not the four-setback inference C07 forbids.
 */
function uniformSetback(shape: AssetShape, clearance: NonNullable<AssetShape['clearance']>): number | null {
	if (shape.footprintPending || shape.clearancePending) return null;
	const inner = rectangularFootprint(shape.footprint);
	const outer = rectangularFootprint(clearance);
	if (inner === null || outer === null) return null;
	const setback = inner.min.x - outer.min.x;
	const grownMin = { x: inner.min.x - setback, y: inner.min.y - setback };
	const grownMax = { x: inner.max.x + setback, y: inner.max.y + setback };
	return Math.round(setback) > 0 && coincident(grownMin, outer.min) && coincident(grownMax, outer.max) ? setback : null;
}
