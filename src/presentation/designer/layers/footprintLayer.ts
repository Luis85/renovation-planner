import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';

/**
 * The asset's footprint — the outline of record (design slice B4).
 *
 * It is the only stored geometry an asset really has: typing dimensions writes a rectangle
 * into it, tracing replaces it, and `dimensions` is always its bounding box (§88). Everything
 * else the designer draws is measured against it.
 *
 * **Solid, and that is the vocabulary rather than a default.** The plan editor already means
 * "provisional" by a dashed outline and "committed" by a solid one (`ZoneRenderModel`'s
 * `statusAppearance`), so the footprint is solid and `clearanceLayer.ts` is dashed. A second
 * distinction invented here for the same question is a second vocabulary a user has to learn.
 *
 * `OutlineConfig` and `flatPoints` are declared here and imported by the clearance rather than
 * spelled twice: the two ARE one shape drawn two ways, and two copies of the type would be free
 * to disagree about which fields an outline carries.
 */
export interface OutlineConfig {
	/** Konva's flat `[x, y, x, y, …]`, in world millimetres — the layer carries the camera. */
	readonly points: number[];
	readonly closed: true;
	readonly stroke: string;
	readonly strokeWidth: number;
	/**
	 * SCREEN pixels, always. A stroke that scaled with the layer would thicken with every zoom
	 * until the outline swallowed the shape it describes — the same reason `ZoneShape` sets it.
	 */
	readonly strokeScaleEnabled: false;
	readonly listening: false;
	readonly perfectDrawEnabled: false;
	/** Present on the clearance and ABSENT on the footprint; see the module comment. */
	readonly dash?: number[];
}

/**
 * Konva's `points` is a FLAT array, not a list of points: hand it `Point[]` and it warns
 * `"points" attribute has non numeric element [object Object]` per vertex and draws nothing.
 * The packing happens here rather than in the domain, which keeps `Polygon` the domain's shape.
 */
export function flatPoints(points: readonly Point[]): number[] {
	return points.flatMap((point) => [point.x, point.y]);
}

const FOOTPRINT_STROKE_PX = 1.5;

/**
 * `null` for an asset with no shape, which is the ordinary starting state of a designed asset
 * and never a failure to read one (`AssetDesignDto.shape`). Nothing is drawn for it — the
 * background layer is what remains, and the no-shape empty state overlays the canvas.
 */
export function footprintOutline(shape: AssetShape | null, tokens: ThemeTokens): OutlineConfig | null {
	if (shape === null) return null;
	return {
		points: flatPoints(shape.footprint.points),
		closed: true,
		stroke: tokens.zoneStroke,
		strokeWidth: FOOTPRINT_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
	};
}
