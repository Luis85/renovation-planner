import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import { extentOf } from '../../../core/geometry/operations';
import type { AssetShape } from '../../../domain/asset/AssetShape';

/** What the preset dialog's SVG draws: world millimetres in, a viewBox and closed paths out. */
export interface PresetPreview {
	readonly viewBox: string;
	readonly footprint: string;
	readonly details: readonly { readonly d: string; readonly dashed: boolean }[];
}

/** 2 mm of sagitta is invisible in a 160px preview of a metre-sized object. */
const PREVIEW_TOLERANCE_MM = 2;
const MARGIN_RATIO = 0.05;

const path = (outline: CurvedPolygon): string =>
	`M${polygonPolyline(outline, PREVIEW_TOLERANCE_MM).map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L')} Z`;

export function presetPreview(shape: AssetShape): PresetPreview {
	const { minX, minY, maxX, maxY } = extentOf(polygonPolyline(shape.footprint, PREVIEW_TOLERANCE_MM));
	const margin = Math.max(maxX - minX, maxY - minY) * MARGIN_RATIO;
	return {
		viewBox: `${minX - margin} ${minY - margin} ${maxX - minX + 2 * margin} ${maxY - minY + 2 * margin}`,
		footprint: path(shape.footprint),
		details: shape.details.map((detail) => ({ d: path(detail.outline), dashed: detail.line === 'dashed' })),
	};
}
