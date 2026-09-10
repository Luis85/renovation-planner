import type { Point } from '../../core/geometry/Point';
import type { Structure } from './Structure';
import { groupRoots } from './SpatialGroup';
import { arcExtrema } from '../../core/geometry/circularArc';
import { spatialElementFootprint } from './stairGeometry';

export interface GroupGeometryObject { readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }
export interface GroupGeometry { readonly objects: readonly GroupGeometryObject[]; readonly structure: Structure }
const coordinateKey = (point: Point): string => `${point.x},${point.y}`;

/** A rigid transform moves selected walls and the coincident ends of connected neighbours. */
export function transformGroupGeometry<T extends GroupGeometryObject>(objects: readonly T[], structure: Structure, ids: readonly string[], transform: (point: Point) => Point) {
	const members = new Set(groupRoots(ids, structure));
	const junctions = new Set(structure.walls.filter(wall => members.has(wall.id)).flatMap(wall => [coordinateKey(wall.start), coordinateKey(wall.end)]));
	const atJunction = (point: Point) => junctions.has(coordinateKey(point));
	return {
		objects: objects.map(object => members.has(object.id) ? { ...object, points: object.points.map(point => transform(point)) } : object),
		structure: {
			...structure,
			walls: structure.walls.map(wall => ({ ...wall,
				start: atJunction(wall.start) ? transform(wall.start) : wall.start,
				end: atJunction(wall.end) ? transform(wall.end) : wall.end,
			})),
			...(structure.elements ? { elements: structure.elements.map(element => members.has(element.id) ? { ...element, points: element.points.map(point => transform(point)) } : element) } : {}),
		},
	};
}
export function groupPoints(geometry: GroupGeometry, ids: readonly string[]): Point[] {
	const members = new Set(groupRoots(ids, geometry.structure));
	return [...geometry.objects.filter(item => members.has(item.id)).flatMap(item => item.bulges?.some(value => value !== 0)
		? item.points.flatMap((start, index) => arcExtrema({ start, end: item.points[(index + 1) % item.points.length], bulge: item.bulges?.[index] ?? 0 })) : item.points),
		...geometry.structure.walls.filter(item => members.has(item.id)).flatMap(item => arcExtrema({ start: item.start, end: item.end, bulge: item.bulge ?? 0 })),
		...geometry.structure.elements?.filter(item => members.has(item.id)).flatMap(item => spatialElementFootprint(item)) ?? []];
}
/** A frozen bounding-box centre is predictable for a heterogeneous selection. */
export function groupPivot(points: readonly Point[]): Point | null {
	if (!points.length) return null;
	const xs = points.map(point => point.x), ys = points.map(point => point.y);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}
