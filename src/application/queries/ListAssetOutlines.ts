import { isErr } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetShape, Dimensions } from '../../domain/asset/AssetShape';
import { dimensionsOf } from '../../domain/asset/AssetShape';
import { detailIsClosed, detailPolyline } from '../../domain/asset/AssetDetail';
import type { Point } from '../../core/geometry/Point';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import type { Query } from './Query';
import type { AssetGeometrySidecar } from '../ports/AssetGeometrySidecar';

/**
 * The Asset library's mark (design "Asset library overview" §3.4; the 20px row mark, and since
 * AD18-R39 the Grid tile's mark with the asset's details beside its footprint), answered per asset
 * rather than as one shape, because a mark has FIVE states and this query can only settle
 * four of them — the other, *not yet read*, is what a caller sees before this query has
 * answered at all, so it is not a member of this union.
 *
 * `measured` and `unscaled` are the SAME outline, drawn differently: the proportions are
 * real in both, and the scale is real in only the first — `unscaled` comes from the
 * shape's own `footprintPending`, never from the absence of a calibration (an asset can be
 * calibrated and still have geometry captured before that calibration existed, per
 * `AssetShape`'s own per-attribute pending model).
 *
 * `none` is the ordinary state of an undesigned asset — an absent sidecar and a sidecar
 * with `shape: null` are the identical answer, both read successfully — and it must not be
 * confused with `refused`, which is a file that exists and could not be trusted: a damaged
 * sidecar (`asset-geometry.unreadable`/`corrupt`/`schema-invalid`/`asset-id-mismatch`), an
 * id that cannot name a file (`asset-geometry.unusable-id`), or a footprint whose extent
 * cannot be represented (`dimensions-overflow` — the same non-finite-span guard
 * `GetAssetDesign` already applies to a footprint and a clearance, met here because a mark
 * this surface cannot measure is exactly as untrustworthy as one it could not read).
 * Collapsing either into `none` would be the false absence §3.4's fifth state exists to
 * refuse.
 */
export type AssetOutline =
	| { readonly kind: 'measured'; readonly points: readonly Point[]; readonly extent: Dimensions; readonly details?: readonly OutlineDetail[] }
	| { readonly kind: 'unscaled'; readonly points: readonly Point[]; readonly extent: Dimensions; readonly details?: readonly OutlineDetail[] }
	| { readonly kind: 'none' }
	| { readonly kind: 'refused'; readonly code: string; readonly sidecarPath: string | undefined };

/**
 * One graphic of the asset's own drawing (AD18-R39), flattened in the footprint's own millimetres so
 * the mark places it with the footprint's fit. A Grid tile and the inspector's Shape preview draw
 * these; the 20px row mark does not (§3.4, "mush at 20px"). `details` is optional on the outline only
 * so a hand-built outline may omit it — every outline `outlineOf` answers carries it, `[]` included.
 */
export interface OutlineDetail {
	readonly points: readonly Point[];
	/** `false` for an open graphic, which is emitted without the SVG `Z` that would close it. */
	readonly closed: boolean;
	readonly dashed: boolean;
}

/**
 * A shape whose extent has already been measured, as the mark draws it — the batch's and the
 * inspector preview's one mapping, so a tile and its preview cannot disagree about what they draw.
 * Arcs flattened at 1 mm: the mark draws straight segments (symbols spec, Rendering).
 */
export function outlineOf(shape: AssetShape, extent: Dimensions): AssetOutline {
	return {
		kind: shape.footprintPending ? 'unscaled' : 'measured',
		points: polygonPolyline(shape.footprint),
		extent,
		details: shape.details.map((detail) => ({
			points: detailPolyline(detail),
			closed: detailIsClosed(detail),
			dashed: detail.line === 'dashed',
		})),
	};
}

export interface ListAssetOutlinesInput {
	readonly assetIds: readonly AssetId[];
}

/**
 * Read many assets' footprints in one call, settling **per entry** rather than as a whole
 * (§5.3, §3.4). One damaged sidecar answers `refused` for its own id and leaves every other
 * id in the batch to answer normally — never a `Result` over the whole map, which would
 * poison every row in a shelf for one bad file, and never a dropped entry, which would
 * silently read back as `none` (the false absence §3.4's fifth state exists to refuse). The
 * answered map always has exactly one entry per requested id.
 *
 * **Reads through the port and derives no path of its own.** `AssetGeometrySidecar` reaches
 * `AssetGeometryStore.pathFor`, which is index-first and derives only as a repair path — a
 * `.rpgeo` moved in the file explorer, or arriving elsewhere through sync, is still found.
 * A batch that derived its own path would reintroduce exactly the orphaned-sidecar defect
 * that method's own docblock records paying for.
 */
export class ListAssetOutlines
	implements Query<ListAssetOutlinesInput, ReadonlyMap<AssetId, AssetOutline>>
{
	constructor(private readonly geometry: AssetGeometrySidecar) {}

	async execute({ assetIds }: ListAssetOutlinesInput): Promise<ReadonlyMap<AssetId, AssetOutline>> {
		const settled = await Promise.all(
			assetIds.map(async (assetId): Promise<readonly [AssetId, AssetOutline]> => [
				assetId,
				await this.outlineFor(assetId),
			]),
		);
		return new Map(settled);
	}

	private async outlineFor(assetId: AssetId): Promise<AssetOutline> {
		const snapshot = await this.geometry.read(assetId);
		if (isErr(snapshot)) {
			return { kind: 'refused', code: snapshot.error.code, sidecarPath: snapshot.error.sidecarPath };
		}

		const shape = snapshot.value.document.shape;
		if (shape === null) return { kind: 'none' };

		// Guarded exactly as `GetAssetDesign` guards the same call: a finite vertex set can
		// have a non-finite span (a shoelace sum overflowing `Infinity`, or a bounding box
		// wide enough that `max.x - min.x` no longer is one), and a mark that cannot be
		// measured is not a mark this row can draw — `refused` names it rather than reporting
		// an extent that isn't real.
		const measured = dimensionsOf(shape.footprint);
		if (isErr(measured)) {
			return { kind: 'refused', code: measured.error.code, sidecarPath: undefined };
		}

		// The details ride the same parse the footprint already paid for (AD18-R39): no second read.
		return outlineOf(shape, measured.value);
	}
}
