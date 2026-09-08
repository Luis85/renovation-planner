import type { Point } from '../../core/geometry/Point';

/** Source raster pixels. Crop first, then rotate about the cropped top-left, then scale. */
export interface ReferenceAppearance {
	readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
	readonly rotation: number;
	readonly opacity: number;
	readonly visible: boolean;
	readonly locked: boolean;
}

export function validReferenceAppearance(value: ReferenceAppearance): boolean {
	const { crop, rotation, opacity } = value;
	return [crop.x, crop.y, crop.width, crop.height, rotation, opacity].every(number => Number.isFinite(number))
		&& crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0
		&& Number.isFinite(crop.x + crop.width) && Number.isFinite(crop.y + crop.height)
		&& rotation >= -180 && rotation <= 180 && opacity >= 0 && opacity <= 1
		&& typeof value.visible === 'boolean' && typeof value.locked === 'boolean';
}

/** The same transform as the reference image node; worldScale includes PDF raster density. */
export function referencePoint(point: Point, appearance: ReferenceAppearance, worldScale: number): Point {
	const angle = appearance.rotation * Math.PI / 180;
	const x = point.x - appearance.crop.x, y = point.y - appearance.crop.y;
	return { x: (x * Math.cos(angle) - y * Math.sin(angle)) * worldScale,
		y: (x * Math.sin(angle) + y * Math.cos(angle)) * worldScale };
}

/** Corners in the same world space used by the reference node and the existing fit command. */
export function referenceCorners(appearance: ReferenceAppearance, worldScale: number): readonly Point[] {
 return [{ x: 0, y: 0 }, { x: appearance.crop.width, y: 0 }, { x: 0, y: appearance.crop.height }, { x: appearance.crop.width, y: appearance.crop.height }]
  .map(point => referencePoint({ x: point.x + appearance.crop.x, y: point.y + appearance.crop.y }, appearance, worldScale));
}
