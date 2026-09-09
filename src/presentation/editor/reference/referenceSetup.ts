import type { Point } from '../../../core/geometry/Point';
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { referencePoint, referenceCorners, validReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { deriveCalibration, type Calibration } from '../../../domain/plan/Calibration';
import { parseMetres } from '../shell/formatLength';

export function prepareValid(appearance: ReferenceAppearance, width: number, height: number): boolean {
	return validReferenceAppearance(appearance) && appearance.crop.x + appearance.crop.width <= width
		&& appearance.crop.y + appearance.crop.height <= height;
}

export function setupMeasurement([a, b]: readonly [Point, Point], length: string, appearance: ReferenceAppearance,
	worldScale: number, previous: Calibration | null) {
	const parsed = parseMetres(length);
	if (!parsed.ok) return null;
	const scale = worldScale / (previous?.pixelsPerWorldUnit ?? 1);
	const measurement = { pointA: referencePoint(a, appearance, scale), pointB: referencePoint(b, appearance, scale), knownDistance: parsed.mm };
	const derived = deriveCalibration(measurement.pointA, measurement.pointB, parsed.mm, previous);
	return derived.ok ? { measurement, ...derived.value, millimetresPerSourcePixel: worldScale / derived.value.calibration.pixelsPerWorldUnit } : null;
}

/** Fit rotated crop bounds into the measured preview; source pixels remain the editing space. */
export function previewTransform(appearance: ReferenceAppearance, size = { width: 400, height: 220 }) {
	const corners = referenceCorners(appearance, 1);
	const minX = Math.min(...corners.map(p => p.x)), minY = Math.min(...corners.map(p => p.y));
	const width = Math.max(...corners.map(p => p.x)) - minX, height = Math.max(...corners.map(p => p.y)) - minY;
	const scale = Math.min(Math.max(1, size.width - 20) / width, Math.max(1, size.height - 20) / height);
	return { scale, x: (size.width - width * scale) / 2 - minX * scale, y: (size.height - height * scale) / 2 - minY * scale };
}
