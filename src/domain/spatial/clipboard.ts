import type { Point } from '../../core/geometry/Point';
import type { Structure } from './Structure';
import type { SpatialElement, SpatialElementMetadata } from './SpatialElement';
import type { SpatialGroup } from './SpatialGroup';
import { groupPivot, groupPoints } from './groupGeometry';

/** One Room or Area as copied: its outline and what names it, never anything linked to it. */
export interface ClipboardRoom {
	readonly key: string;
	readonly name: string;
	readonly zoneType: string;
	readonly points: readonly Point[];
	readonly bulges?: readonly number[];
}
export interface ClipboardStructure extends Structure { readonly elements: readonly SpatialElement[] }

/**
 * A copied selection, positioned relative to its own bounding-box centre. Room `key`s and every
 * id inside `structure`, `names` and `groups` are the SOURCE floor's, kept only so references
 * inside the clipboard stay wired; `placedStructure` re-mints every one of them.
 */
export interface SpatialClipboard {
	readonly rooms: readonly ClipboardRoom[];
	readonly structure: ClipboardStructure;
	readonly names: readonly SpatialElementMetadata[];
	readonly groups: readonly SpatialGroup[];
}
/** A whole floor in the clipboard's own shape, which is what a copy is taken from. */
export type ClipboardFloor = Omit<SpatialClipboard, 'structure'> & { readonly structure: Structure };
export type ClipboardIdPrefix = 'wall' | 'opening' | 'element' | 'group';
export interface PlacedStructure {
	readonly structure: ClipboardStructure;
	readonly names: readonly SpatialElementMetadata[];
	readonly groups: readonly SpatialGroup[];
}

const moved = (point: Point, by: Point): Point => ({ x: point.x + by.x, y: point.y + by.y });
function translated(clipboard: SpatialClipboard, by: Point): SpatialClipboard {
	const { structure } = clipboard;
	return {
		...clipboard,
		rooms: clipboard.rooms.map(room => ({ ...room, points: room.points.map(point => moved(point, by)) })),
		structure: {
			...structure,
			walls: structure.walls.map(item => ({ ...item, start: moved(item.start, by), end: moved(item.end, by) })),
			elements: structure.elements.map(item => ({ ...item, points: item.points.map(point => moved(point, by)) })),
		},
	};
}

/**
 * The selection and what it cannot exist without, as the grouping rules already say: a Room
 * brings its boundary walls, an opening brings its host wall, and a wall brings every opening
 * it hosts. A group comes only when every member does. Nothing copyable answers `null`.
 */
export function captureClipboard(floor: ClipboardFloor, selectedIds: readonly string[]): SpatialClipboard | null {
	const selected = new Set(selectedIds), { structure } = floor;
	const rooms = floor.rooms.filter(room => selected.has(room.key)), roomKeys = new Set(rooms.map(room => room.key));
	const boundaries = structure.boundaries.filter(boundary => roomKeys.has(boundary.roomId));
	const hosts = structure.openings.filter(opening => selected.has(opening.id)).map(opening => opening.hostId);
	const wallIds = new Set([...selectedIds, ...boundaries.flatMap(boundary => boundary.wallIds), ...hosts]);
	const walls = structure.walls.filter(item => wallIds.has(item.id));
	const elements = structure.elements?.filter(item => selected.has(item.id)) ?? [];
	const members = new Set([...roomKeys, ...walls.map(item => item.id), ...elements.map(item => item.id)]);
	const copied: SpatialClipboard = {
		rooms,
		structure: { walls, openings: structure.openings.filter(opening => members.has(opening.hostId)), boundaries, elements },
		names: floor.names.filter(name => members.has(name.id)),
		groups: floor.groups.filter(group => group.memberIds.every(id => members.has(id))),
	};
	const objects = rooms.map(room => ({ id: room.key, points: room.points, bulges: room.bulges }));
	const pivot = groupPivot(groupPoints({ objects, structure: copied.structure }, [...members]));
	return pivot ? translated(copied, { x: -pivot.x, y: -pivot.y }) : null;
}

/** The Rooms and Areas of a paste, in clipboard order, centred on `target`. */
export function placedRooms(clipboard: SpatialClipboard, target: Point): readonly ClipboardRoom[] {
	return translated(clipboard, target).rooms;
}

/**
 * Everything but the Rooms, centred on `target`, under fresh ids with every reference rewired.
 * `roomIds[i]` is the zone the i-th clipboard room became — those ids are minted by the zone
 * writes, not here.
 */
export function placedStructure(clipboard: SpatialClipboard, target: Point, roomIds: readonly string[], mintId: (prefix: ClipboardIdPrefix) => string): PlacedStructure {
	const { structure } = translated(clipboard, target);
	const ids = new Map(clipboard.rooms.map((room, index) => [room.key, roomIds[index]]));
	const mint = (source: string, prefix: ClipboardIdPrefix): string => { const next = mintId(prefix); ids.set(source, next); return next; };
	const walls = structure.walls.map(item => ({ ...item, id: mint(item.id, 'wall') }));
	const elements = structure.elements.map(item => ({ ...item, id: mint(item.id, 'element') }));
	// Every reference inside a captured clipboard names something the clipboard holds.
	const id = (source: string): string => ids.get(source) as string;
	return {
		structure: {
			walls,
			openings: structure.openings.map(opening => ({ ...opening, id: mintId('opening'), hostId: id(opening.hostId) })),
			boundaries: structure.boundaries.map(boundary => ({ roomId: id(boundary.roomId), wallIds: boundary.wallIds.map(id) })),
			elements,
		},
		names: clipboard.names.map(name => ({ id: id(name.id), name: name.name })),
		groups: clipboard.groups.map(group => ({ ...group, id: mintId('group'), memberIds: group.memberIds.map(id) })),
	};
}
