import type { Point } from '../../../core/geometry/Point';
import { referencePoint, type ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';

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

/** The crop rectangle's centre in preview-screen coordinates; same transform `draw()` uses for points. */
export function referenceScreenCentre(view: ReferenceViewport, appearance: ReferenceAppearance): Point {
	const crop = appearance.crop, cropCentre = { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
	const point = referencePoint(cropCentre, appearance, view.scale);
	return { x: point.x + view.x, y: point.y + view.y };
}

/** The knob at `radius` from `centre`, in the direction of the image's rotated "up". */
export function rotationHandlePoint(centre: Point, rotation: number, radius: number): Point {
	const angle = rotation * Math.PI / 180;
	return { x: centre.x + radius * Math.sin(angle), y: centre.y - radius * Math.cos(angle) };
}

/** Degrees to [-180, 180]. */
function normalizeRotation(degrees: number): number {
	return ((degrees + 180) % 360 + 360) % 360 - 180;
}

/** New rotation from dragging the handle from `start` to `current` about `centre`, snapping to 15° when `snap`. */
export function dragRotation(startRotation: number, centre: Point, start: Point, current: Point, snap: boolean): number {
	const startVector = { x: start.x - centre.x, y: start.y - centre.y };
	const currentVector = { x: current.x - centre.x, y: current.y - centre.y };
	const epsilon = 1;
	if (Math.hypot(startVector.x, startVector.y) < epsilon || Math.hypot(currentVector.x, currentVector.y) < epsilon) return startRotation;
	const delta = (Math.atan2(currentVector.y, currentVector.x) - Math.atan2(startVector.y, startVector.x)) * 180 / Math.PI;
	const rotation = normalizeRotation(startRotation + delta);
	return snap ? Math.round(rotation / 15) * 15 : Math.round(rotation * 10) / 10;
}

/** `rotation` moved by `delta` degrees, wrapped into [-180, 180] and rounded to 0.1° so repeated nudges do not drift. */
export function nudgeRotation(rotation: number, delta: number): number {
	return Math.round(normalizeRotation(rotation + delta) * 10) / 10;
}
