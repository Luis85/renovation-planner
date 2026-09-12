import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { NamedSpatialElement, SpatialElement } from '../../../domain/spatial/SpatialElement';

/** Saved elements with their names, any in-flight rotation or move preview in place of the saved one, and a dragged caption's offset. */
export function withElementPreviews(elements: readonly SpatialElement[], names: ReadonlyMap<string, string>, rotation: { readonly id: string; readonly name: string; readonly points: readonly Point[] } | null, moved: NamedSpatialElement | null, label: { readonly id: string; readonly offset: Vector } | null = null): NamedSpatialElement[] {
	return elements.map(element => {
		const shown = rotation?.id === element.id ? { ...element, name: rotation.name, points: rotation.points }
			: moved?.id === element.id ? moved : { ...element, name: names.get(element.id) ?? element.id };
		return label?.id === element.id ? { ...shown, labelOffset: label.offset } : shown;
	});
}
