import { reactive } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { backDepth, placementPoints } from '../../../domain/spatial/assetPlacement';
import { projectOntoWall, wallTangent, type Wall } from '../../../domain/spatial/Structure';

export interface AssetPlacementDraft {
	assetId: string; name: string; shape: AssetShape | null;
	preview: readonly [Point, Point] | null;
	text: { x: string; y: string };
	busy: boolean; error: AppError | null;
}

export function createAssetPlacementDraft(): AssetPlacementDraft {
	return reactive({ assetId: '', name: '', shape: null, preview: null, text: { x: '', y: '' }, busy: false, error: null });
}

/**
 * Where a pointer puts the asset. Within `tolerance` of a wall's face the placement faces away
 * from that wall and its footprint's back edge sits on the face; otherwise it stands where the
 * pointer is with the asset's own facing. `null` tolerance is snapping switched off.
 */
export function placementAt(point: Point, shape: AssetShape, walls: readonly Wall[], tolerance: number | null): readonly [Point, Point] {
	const hits = tolerance === null ? [] : walls.map(wall => ({ wall, ...projectOntoWall(wall, point) })).filter(hit => hit.distance <= hit.wall.thickness / 2 + tolerance);
	const hit = hits.reduce<(typeof hits)[number] | undefined>((best, candidate) => !best || candidate.distance < best.distance ? candidate : best, undefined);
	if (!hit) return placementPoints(point, shape.facing);
	const tangent = wallTangent(hit.wall, hit.offset), across = { x: tangent.y, y: -tangent.x };
	const side = Math.sign((point.x - hit.point.x) * across.x + (point.y - hit.point.y) * across.y) || 1;
	const normal = { x: across.x * side, y: across.y * side }, reach = hit.wall.thickness / 2 + backDepth(shape);
	return placementPoints({ x: hit.point.x + normal.x * reach, y: hit.point.y + normal.y * reach }, Math.atan2(normal.y, normal.x));
}
