import type { Opening, Structure, Wall } from './Structure';

/**
 * The sizes one edit can set across several walls, windows and doors at once. Position is
 * deliberately absent: a wall's endpoints and an opening's offset are per item, so a width
 * change keeps each opening's start where it was, as the single edit does.
 */
export const DIMENSION_FIELDS = {
	wall: ['thickness', 'height'],
	window: ['width', 'height', 'sill'],
	door: ['width', 'height', 'sill'],
} as const;
export type DimensionKind = keyof typeof DIMENSION_FIELDS;
export type DimensionField = (typeof DIMENSION_FIELDS)[DimensionKind][number];
export type DimensionChanges = Partial<Record<DimensionKind, Readonly<Partial<Record<DimensionField, number>>>>>;

/** Selected walls, windows and doors in structure order; rooms, elements and generic openings are not targets. */
export function dimensionTargets(structure: Structure, ids: readonly string[]): { readonly wall: readonly Wall[]; readonly window: readonly Opening[]; readonly door: readonly Opening[] } {
	const chosen = new Set(ids);
	const openings = (kind: Opening['kind']) => structure.openings.filter(opening => opening.kind === kind && chosen.has(opening.id));
	return { wall: structure.walls.filter(wall => chosen.has(wall.id)), window: openings('window'), door: openings('door') };
}

export function hasDimensionTargets(structure: Structure, ids: readonly string[]): boolean {
	return Object.values(dimensionTargets(structure, ids)).some(items => items.length > 0);
}

/** The value every item shares, or null when they differ or there are none. */
export function sharedDimension<K extends string>(items: readonly Readonly<Record<K, number>>[], field: K): number | null {
	const first = items[0]?.[field];
	return first !== undefined && items.every(item => item[field] === first) ? first : null;
}

function applied<T extends Wall | Opening>(item: T, kind: DimensionKind, changes: DimensionChanges): T {
	const change = changes[kind] ?? {};
	return { ...item, ...Object.fromEntries(DIMENSION_FIELDS[kind].flatMap(field => change[field] === undefined ? [] : [[field, change[field]]])) };
}

/** Applies only the entered fields to the selected items of each kind; validation stays the caller's. */
export function editDimensions(structure: Structure, ids: readonly string[], changes: DimensionChanges): Structure {
	const chosen = new Set(ids);
	return { ...structure,
		walls: structure.walls.map(wall => chosen.has(wall.id) ? applied(wall, 'wall', changes) : wall),
		openings: structure.openings.map(opening => chosen.has(opening.id) && opening.kind !== 'opening' ? applied(opening, opening.kind, changes) : opening),
	};
}
