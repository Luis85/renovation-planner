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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** The `t` range where `c + t·d` lies within [min, max]; empty (enter > exit) when it never does. */
function slab(c: number, d: number, min: number, max: number): [number, number] {
	if (d === 0) return c >= min && c <= max ? [-Infinity, Infinity] : [Infinity, -Infinity];
	const a = (min - c) / d, b = (max - c) / d;
	return [Math.min(a, b), Math.max(a, b)];
}

/**
 * Where the knob is drawn and hit: `rotationHandlePoint` when that is inside the canvas inset by `inset`,
 * else pulled along its direction line to the nearest in-canvas point, else (the line misses) clamped per axis.
 */
export function reachableHandlePoint(centre: Point, rotation: number, radius: number, size: { width: number; height: number }, inset: number): Point {
	const ideal = rotationHandlePoint(centre, rotation, radius), right = size.width - inset, bottom = size.height - inset;
	if (ideal.x >= inset && ideal.x <= right && ideal.y >= inset && ideal.y <= bottom) return ideal;
	const angle = rotation * Math.PI / 180, dx = Math.sin(angle), dy = -Math.cos(angle);
	const [xIn, xOut] = slab(centre.x, dx, inset, right), [yIn, yOut] = slab(centre.y, dy, inset, bottom);
	const enter = Math.max(0, xIn, yIn), exit = Math.min(xOut, yOut);
	if (enter > exit) return { x: clamp(ideal.x, inset, right), y: clamp(ideal.y, inset, bottom) };
	const t = clamp(radius, enter, exit);
	return { x: centre.x + t * dx, y: centre.y + t * dy };
}

/** Degrees to [-180, 180]. */
function normalizeRotation(degrees: number): number {
	return ((degrees + 180) % 360 + 360) % 360 - 180;
}

/**
 * New rotation from dragging the handle, snapping to 15° when `snap`. `start` and `current` are the
 * pointer's offsets from the image centre AT THAT MOMENT — each measured about its own centre, since
 * a rotation refits the preview and moves the centre mid-drag.
 */
export function dragRotation(startRotation: number, start: Point, current: Point, snap: boolean): number {
	const epsilon = 1;
	if (Math.hypot(start.x, start.y) < epsilon || Math.hypot(current.x, current.y) < epsilon) return startRotation;
	const delta = (Math.atan2(current.y, current.x) - Math.atan2(start.y, start.x)) * 180 / Math.PI;
	return snap ? Math.round(normalizeRotation(startRotation + delta) / 15) * 15 : nudgeRotation(startRotation, delta);
}

/** `rotation` moved by `delta` degrees, wrapped into [-180, 180] and rounded to 0.1° so repeated nudges do not drift. */
export function nudgeRotation(rotation: number, delta: number): number {
	return Math.round(normalizeRotation(rotation + delta) * 10) / 10;
}

/** An angle for display in `language`: at most one decimal, no grouping, with the degree sign. Rounded first, and `+ 0` turns a rounded `-0` into `0`. */
export function formatDegrees(degrees: number, language: string): string {
	return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1, useGrouping: false }).format(Math.round(degrees * 10) / 10 + 0)}°`;
}
