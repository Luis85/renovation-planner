import type { Point } from '../../core/geometry/Point';
import type { Vector } from '../../core/geometry/Vector';
import { stairPlanGeometry, type StairOptions } from './stairGeometry';

/** Generic floor facts; richer asset specializations are independent of these identities. */
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement' | 'stair' | 'arrow' | 'asset' | 'post' | 'beam'
	| 'dimension' | 'section' | 'view' | 'hatch' | 'text' | 'boundary' | 'grid';
export interface SpatialElement {
	readonly id: string;
	readonly kind: SpatialElementKind;
	/** Object and post outlines close implicitly; linear elements keep ordered open points; an asset is `[anchor, facingPoint]`; a beam is its two-point axis. */
	readonly points: readonly Point[];
	readonly stair?: StairOptions;
	/** Only an `'asset'` placement carries one, and it always does; its outline is derived from that asset. */
	readonly assetId?: string;
	/** A dragged name tag's offset from its automatic position, world mm (ADR-0029); absent while automatic. */
	readonly labelOffset?: Vector;
	/** A beam's width across its axis, world mm. Only a `'beam'` carries one, and it always does. */
	readonly width?: number;
	/** Whether a post or beam carries load. Only `'post'` and `'beam'` carry one, and both always do. */
	readonly loadBearing?: boolean;
	/** A dimension chain's signed distance from its first-to-last line to its dimension line, world mm. Only a `'dimension'` carries one, and it always does. */
	readonly offset?: number;
	/** Which side a section line looks at. Only a `'section'` carries one, and it always does. */
	readonly flipped?: boolean;
}
export interface SpatialElementMetadata { readonly id: string; readonly name: string }
export type NamedSpatialElement = SpatialElement & SpatialElementMetadata;
export function validElementMetadataLinks(metadata: readonly SpatialElementMetadata[] = [], groups: readonly (readonly SpatialElement[] | undefined)[]): boolean {
	const ids = new Set(groups.flatMap(group => group?.map(item => item.id) ?? []));
	return metadata.length === ids.size && new Set(metadata.map(item => item.id)).size === ids.size && metadata.every(item => ids.has(item.id));
}
function metadataContent(items: readonly SpatialElementMetadata[]) {
	return items.toSorted((left, right) => left.id.localeCompare(right.id, 'en')).map(item => [item.id, item.name]);
}
export function sameElementMetadata(a: readonly SpatialElementMetadata[] = [], b: readonly SpatialElementMetadata[] = []): boolean {
	return JSON.stringify(metadataContent(a)) === JSON.stringify(metadataContent(b));
}
const SPATIAL_ELEMENT_KINDS: readonly SpatialElementKind[] = ['object', 'path', 'fence', 'measurement', 'stair', 'arrow', 'asset', 'post', 'beam', 'dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid'];
const DRAFTING_KINDS: readonly string[] = ['dimension', 'section', 'view', 'hatch', 'text', 'boundary', 'grid'];

/** Drafting marks: drawn on the plan, never renovation targets or quantity sources (plan drafting tools design §3). */
export function draftingKind(kind: string | undefined): boolean { return kind !== undefined && DRAFTING_KINDS.includes(kind); }
/** Kinds stored as exactly one point. */
export function pointKind(kind: string | undefined): boolean { return kind === 'text' || kind === 'grid'; }
/** Kinds whose stored `points` are themselves a closed outline. */
export function outlineKind(kind: string | undefined): boolean { return kind === 'object' || kind === 'post' || kind === 'hatch'; }
/** Kinds drawn and hit through an outline derived from their points: a stair's centreline, an asset's placement, a beam's axis. */
export function derivedFootprintKind(kind: string | undefined): boolean { return kind === 'stair' || kind === 'asset' || kind === 'beam'; }
/** Every element kind the canvas treats as a closed shape. */
export function closedFootprintKind(kind: string | undefined): boolean { return outlineKind(kind) || derivedFootprintKind(kind); }

/**
 * `loadBearing` belongs to a post or a beam and to nothing else; `width` belongs to a beam, which is exactly two points.
 * A post is exactly four corners — `postSection`/`resizedPost` and `StructuralShape.vue` all require a 4th point.
 */
function validStructuralFields(element: SpatialElement): boolean {
	if ((element.kind === 'post' || element.kind === 'beam') !== (typeof element.loadBearing === 'boolean')) return false;
	if (element.kind === 'post') return element.width === undefined && element.points.length === 4;
	if (element.kind !== 'beam') return element.width === undefined;
	return element.width !== undefined && Number.isFinite(element.width) && element.width > 0 && element.width <= 1e6 && element.points.length === 2;
}

/** `offset` belongs to a dimension chain and `flipped` to a section line; the one-point and two-point kinds hold exactly that many. */
function validDraftingFields(element: SpatialElement): boolean {
	if ((element.kind === 'dimension') !== (element.offset !== undefined)) return false;
	if ((element.kind === 'section') !== (typeof element.flipped === 'boolean')) return false;
	if (element.offset !== undefined && !(Number.isFinite(element.offset) && Math.abs(element.offset) <= 1e6)) return false;
	if (pointKind(element.kind)) return element.points.length === 1;
	if (element.kind === 'section' || element.kind === 'view') return element.points.length === 2;
	const first = element.points[0], last = element.points.at(-1);
	return element.kind !== 'dimension' || (!!first && !!last && (first.x !== last.x || first.y !== last.y));
}

/** Derived world-millimetre length, never a second stored measurement authority. */
export function elementLength(element: SpatialElement): number {
	return element.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - element.points[index].x, point.y - element.points[index].y), 0);
}

export function validSpatialElement(element: SpatialElement): boolean {
	if (!element.id.startsWith('element-') || !SPATIAL_ELEMENT_KINDS.includes(element.kind)) return false;
	if (!element.points.every(point => [point.x, point.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9))) return false;
	if ((element.kind === 'asset') !== (element.assetId !== undefined)) return false;
	if (!validStructuralFields(element)) return false;
	if (!validDraftingFields(element)) return false;
	if (element.kind === 'stair') return element.stair !== undefined && stairPlanGeometry(element.points, element.stair) !== null;
	if (element.stair !== undefined) return false;
	return validPointCount(element);
}

/** An asset is an anchor and a distinct facing point, an outline three corners or more, a measurement two points, a point kind one; any other line two or more distinct in a row. */
function validPointCount(element: SpatialElement): boolean {
	if (element.kind === 'asset') return !!element.assetId && element.points.length === 2 && Math.hypot(element.points[1].x - element.points[0].x, element.points[1].y - element.points[0].y) > 0;
	if (outlineKind(element.kind)) return element.points.length >= 3;
	if (element.kind === 'measurement' && element.points.length !== 2) return false;
	if (pointKind(element.kind)) return true;
	return element.points.length >= 2 && element.points.slice(1).every((point, index) => Math.hypot(point.x - element.points[index].x, point.y - element.points[index].y) > 0);
}
