import type { AssetDetail } from '../../../domain/asset/AssetDetail';
import type { AssetGroup, AssetShape } from '../../../domain/asset/AssetShape';
import { partKey, type DesignerSelection } from '../selection/designerSelection';

/**
 * The Parts panel's list, derived from one validated shape (AD09).
 *
 * **Pure, and the whole of what decides ORDER.** A panel that builds its own rows in a template
 * hides the one property here that can be wrong invisibly: which row comes first. The component
 * renders what this answers and chooses nothing.
 *
 * **Nothing in this file is a second ordering authority** (C06). `details` stays the one canonical
 * draw order and groups stay editing metadata; all this does is READ that array from the other end
 * and mark which graphic belongs to which group.
 */

/**
 * One graphic. **`detail` is non-null here and that is the whole reason these rows are a union**: a
 * single interface with `detail: AssetDetail | null` made every reader ask a question the row model
 * had already answered, and each of those guards was an unreachable branch nothing could cover.
 *
 * The four arms write their shared fields out rather than extending a base interface. A base one is
 * what `npm run analyze` reports as a private type leaked through four exported signatures — and
 * exporting it to clear that would put a name in this module's surface that no caller can use, for
 * one shared line.
 */
export interface GraphicRow {
	readonly key: string;
	readonly kind: 'detail';
	readonly selection: DesignerSelection;
	readonly detail: AssetDetail;
	readonly groupId: string | null;
	readonly label: null;
}

/** A group's header: a disclosure over rows already in the list, selecting nothing until AD10 gives a group an action. */
export interface GroupRow {
	readonly key: string;
	readonly kind: 'group';
	readonly selection: null;
	readonly detail: null;
	/** Its OWN id, non-null — which is what lets the disclosure take a `string` and ask nothing. */
	readonly groupId: string;
	readonly label: string | null;
}

/** One of the shape's four special parts (C05), each selectable and none of them a graphic. */
export interface AttributeRow {
	readonly key: string;
	readonly kind: 'footprint' | 'clearance' | 'anchor' | 'facing';
	readonly selection: DesignerSelection;
	readonly detail: null;
	readonly groupId: null;
	readonly label: null;
}

/** The reference sheet: not a part of the shape at all, so it selects nothing and is drawn as text. */
export interface SheetRow {
	readonly key: 'reference';
	readonly kind: 'reference';
	readonly selection: null;
	readonly detail: null;
	readonly groupId: null;
	readonly label: null;
}

export type PartRow = GraphicRow | GroupRow | AttributeRow | SheetRow;

const special = (kind: AttributeRow['kind']): AttributeRow => ({ key: kind, kind, selection: { kind }, detail: null, groupId: null, label: null });

const REFERENCE: SheetRow = { key: 'reference', kind: 'reference', selection: null, detail: null, groupId: null, label: null };

/**
 * The graphic rows, TOPMOST FIRST, with each group's header at its topmost member.
 *
 * The reading direction is chosen rather than the array: `details` is bottom-up — `reorderDetail`'s
 * `forward` moves a graphic one LATER, where it draws over its neighbour, and `hitDesign` takes the
 * last match for the same reason — so listing it as stored would put the graphic the user sees on
 * top at the bottom of the panel and make Bring forward move its row down.
 *
 * A member keeps its own position, so a group holding the first and third graphics stays interleaved
 * with the second (C06's own words) instead of being gathered into a block the array has not got.
 */
function graphicRows(details: readonly AssetDetail[], groups: readonly AssetGroup[]): PartRow[] {
	const groupOf = new Map<string, AssetGroup>();
	for (const group of groups) for (const member of group.members) groupOf.set(member, group);
	const headed = new Set<string>();
	const rows: PartRow[] = [];
	for (const detail of details.toReversed()) {
		const group = groupOf.get(detail.id) ?? null;
		if (group !== null && !headed.has(group.id)) {
			headed.add(group.id);
			rows.push({ key: `group:${group.id}`, kind: 'group', selection: null, detail: null, groupId: group.id, label: group.label ?? null });
		}
		const selection: DesignerSelection = { kind: 'detail', id: detail.id };
		rows.push({ key: partKey(selection), kind: 'detail', selection, detail, groupId: group?.id ?? null, label: null });
	}
	return rows;
}

/**
 * Every row the panel draws: the graphics, then the object's own parts, then the reference sheet.
 *
 * Graphics come first because they are what the user is drawing and what the panel exists to find;
 * the footprint, the clearance, the anchor and the facing are the shape's four special parts (C05)
 * and sit together under them. The clearance row is drawn only where there is one, and the
 * reference row only where a sheet is picked — a row for a part that is not there would be a
 * control with nothing behind it.
 *
 * A shapeless asset has NO rows at all, which is the panel's empty state rather than a list of
 * placeholders.
 */
export function partRows(shape: AssetShape | null, options: { readonly hasReference: boolean }): PartRow[] {
	if (shape === null) return [];
	return [
		...graphicRows(shape.details, shape.groups ?? []),
		special('footprint'),
		...(shape.clearance === null ? [] : [special('clearance')]),
		special('anchor'),
		special('facing'),
		...(options.hasReference ? [REFERENCE] : []),
	];
}
