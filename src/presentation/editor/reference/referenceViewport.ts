import type { Point } from '../../../core/geometry/Point';
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';

export interface ReferenceViewport { readonly x: number; readonly y: number; readonly scale: number }

/** Zoom leaves the source pixel under the pointer fixed; it changes no calibration values. */
export function zoomReference(view: ReferenceViewport, anchor: Point, factor: number, fitScale: number): ReferenceViewport {
	if (!Number.isFinite(factor) || factor <= 0) return view;
	const scale = Math.max(fitScale / 4, Math.min(fitScale * 32, view.scale * factor));
	if (scale === view.scale) return view;
	const ratio = scale / view.scale;
	return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

/** Inverse of the display crop/rotation/viewport, returning original raster pixel coordinates. */
export function referenceSourcePoint(screen: Point, view: ReferenceViewport, appearance: ReferenceAppearance): Point | null {
	const x = (screen.x - view.x) / view.scale, y = (screen.y - view.y) / view.scale;
	const angle = -appearance.rotation * Math.PI / 180, crop = appearance.crop;
	const point = { x: x * Math.cos(angle) - y * Math.sin(angle) + crop.x, y: x * Math.sin(angle) + y * Math.cos(angle) + crop.y };
	const epsilon = 1e-7;
	if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < crop.x - epsilon || point.x > crop.x + crop.width + epsilon || point.y < crop.y - epsilon || point.y > crop.y + crop.height + epsilon) return null;
	return { x: Math.max(crop.x, Math.min(crop.x + crop.width, point.x)), y: Math.max(crop.y, Math.min(crop.y + crop.height, point.y)) };
}
