import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';

/** Saved elements with their names, and any in-flight rotation or move preview in place of the saved one. */
export function withElementPreviews(elements: readonly SpatialElement[], names: ReadonlyMap<string, string>, rotation: { readonly id: string; readonly name: string; readonly points: readonly Point[] } | null, moved: NamedSpatialElement | null): NamedSpatialElement[] {
	return elements.map(element => rotation?.id === element.id ? { ...element, name: rotation.name, points: rotation.points }
		: moved?.id === element.id ? moved : { ...element, name: names.get(element.id) ?? element.id });
}
