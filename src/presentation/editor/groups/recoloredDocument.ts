import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';
import type { ItemColor } from '../../../domain/spatial/ItemColor';
import type { Structure } from '../../../domain/spatial/Structure';

/** Set one colour, or physically remove it for Default, on the named items only. */
function painted<T extends { readonly id: string; readonly color?: ItemColor }>(items: readonly T[], ids: ReadonlySet<string>, color: ItemColor | undefined): T[] {
	return items.map(item => {
		if (!ids.has(item.id)) return item;
		const { color: previous, ...plain } = item;
		void previous;
		return (color === undefined ? plain : { ...plain, color }) as T;
	});
}
/**
 * The current plan with one colour on exactly `ids` — a wall's hosted opening only when it is named
 * itself — and the proposed (intended) structure untouched (plan colours design §3).
 */
export function recoloredDocument(document: PlanGeometryDocument, ids: readonly string[], color: ItemColor | undefined): PlanGeometryDocument {
	const targets = new Set(ids), structure: Structure | undefined = document.structure;
	return { ...document, objects: painted(document.objects, targets, color),
		...(structure ? { structure: { ...structure, walls: painted(structure.walls, targets, color), openings: painted(structure.openings, targets, color),
			...(structure.elements ? { elements: painted(structure.elements, targets, color) } : {}) } } : {}) };
}
