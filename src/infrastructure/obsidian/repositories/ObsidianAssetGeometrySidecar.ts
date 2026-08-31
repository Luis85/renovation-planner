import { err, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { EntityVersion } from '../../../application/ports/versioning';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
	AssetGeometrySnapshot,
} from '../../../application/ports/AssetGeometrySidecar';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { validateAssetShape } from '../../../domain/asset/AssetShape';
import type { Calibration } from '../../../domain/plan/Calibration';
import { validateCalibration } from '../../../domain/plan/Calibration';
import type { AssetGeometryDTO } from '../../persistence/dto/assetGeometry';
import type { AssetGeometryStore, AssetSidecarContent } from './AssetGeometryStore';
import {
	calibrationFromPersistence,
	calibrationToPersistence,
} from '../../persistence/mappers/planMapper';

type StoredShape = NonNullable<AssetGeometryDTO['shape']>;
type StoredPolygon = StoredShape['footprint'];

const toTuples = (points: readonly { x: number; y: number }[]): [number, number][] =>
	points.map((point) => [point.x, point.y]);

const toPolygon = (stored: StoredPolygon): { points: { x: number; y: number }[] } => ({
	points: stored.points.map(([x, y]) => ({ x, y })),
});

/**
 * A stored shape raised to the domain's, and then RUN THROUGH the domain's own validator.
 *
 * The schema and the validator refuse different things and neither subsumes the other, so
 * the read owes both. `AssetShapeSchemaV1` counts vertices and types fields; it cannot see
 * that an anchor coordinate is `NaN` (JSON has no such literal, but `1e999` parses to
 * `Infinity` and `z.number()` accepts it), that a facing is non-finite, or that the
 * per-attribute pending flags are in a combination no command can produce. Every command
 * above this port assumes the shape it reads came through `createPolygon` and
 * `validateAssetShape`; a sidecar is a file a user can open and edit, so this is where that
 * assumption is made true rather than merely relied on.
 *
 * A REFUSAL and never a repair. Quietly clearing an incoherent pending flag would suppress
 * the unscaled warning over placeholder-space geometry, and quietly dropping a corrupt
 * shape would present a damaged file as an asset nobody has drawn yet.
 */
function shapeFromPersistence(stored: StoredShape): Result<AssetShape, RepositoryError> {
	return validateAssetShape({
		footprint: toPolygon(stored.footprint),
		footprintOrigin: stored.footprintOrigin,
		footprintPending: stored.footprintPending,
		clearancePending: stored.clearancePending,
		anchorPending: stored.anchorPending,
		clearance: stored.clearance === null ? null : toPolygon(stored.clearance),
		anchor: { x: stored.anchor.x, y: stored.anchor.y },
		facing: stored.facing,
	});
}

/**
 * A stored calibration raised to the domain's, and RUN THROUGH the domain's own validator —
 * the sentence `shapeFromPersistence` above states, applied to the field beside the one it
 * was written for. It was applied to the shape alone, and the calibration was mapped and
 * returned unasked.
 *
 * The schema cannot see any of what this refuses: coincident points are four well-typed
 * numbers, and so are a non-positive known distance and a collapsed scale. `SetAssetFootprint`
 * decides `footprintPending` from `document.calibration !== null`, so a degenerate calibration
 * is a non-null one that records a fresh trace as ALREADY SCALED while no usable scale exists.
 *
 * **Why here and not one layer up, which is where the plan's equivalent lives.** A plan's
 * calibration is validated at `Plan.withCalibration`, called while `ObsidianPlanRepository`
 * assembles the entity; an `AssetGeometryDocument` is handed to a command with no assembly
 * step in between, so this read is the only door there is.
 *
 * **The domain's own CODE, and a restamped CATEGORY.** Re-spelling these rules in an
 * `asset-geometry.*` vocabulary would be a second derivation of one rule, so the code passes
 * through exactly as `validateAssetShape`'s `asset.*` codes do. The category cannot:
 * `plan.degenerate-points` is a `CalculationError` and `RepositoryError` admits
 * `ValidationError`, and at a READ boundary all three refusals mean the same thing — the
 * stored document is invalid. Unconditional rather than branched on the incoming category,
 * because a branch here would have one arm no fixture reaches.
 *
 * A REFUSAL and never a repair, for the reason the shape half gives: nulling a corrupt
 * calibration would present a damaged file as an asset nobody has calibrated.
 */
function calibrationFromStored(
	stored: NonNullable<AssetGeometryDTO['calibration']>,
): Result<Calibration, RepositoryError> {
	const calibration = calibrationFromPersistence(stored);
	const checked = validateCalibration(calibration);
	if (!checked.ok) {
		return err({
			category: 'Validation',
			code: checked.error.code,
			message: checked.error.message,
		});
	}
	return ok(calibration);
}

const shapeToPersistence = (shape: AssetShape): StoredShape => ({
	footprint: { points: toTuples(shape.footprint.points) },
	footprintOrigin: shape.footprintOrigin,
	footprintPending: shape.footprintPending,
	clearancePending: shape.clearancePending,
	anchorPending: shape.anchorPending,
	clearance: shape.clearance === null ? null : { points: toTuples(shape.clearance.points) },
	anchor: { x: shape.anchor.x, y: shape.anchor.y },
	facing: shape.facing,
});

/**
 * The port's face over the concrete `AssetGeometryStore` (ADR-0014) — the plan sidecar's
 * adapter with one `shape` where a plan holds many `objects`. Storage shape — `[x, y]`
 * tuples, schema fields, revision bookkeeping — never crosses this boundary; application
 * code sees `Polygon`s, `Point`s and an `EntityVersion`.
 *
 * The write REPLACES calibration and shape together, which is exactly why the port is
 * document-grained: recalibrating an asset rewrites the calibration AND every rescaled
 * coordinate — footprint, clearance and anchor alike — in one file operation under that
 * asset's own lock.
 */
export class ObsidianAssetGeometrySidecar implements AssetGeometrySidecar {
	constructor(private readonly store: AssetGeometryStore) {}

	async read(assetId: AssetId): Promise<Result<AssetGeometrySnapshot, RepositoryError>> {
		const snapshot = await this.store.read(assetId);
		if (!snapshot.ok) return snapshot;

		const dto = snapshot.value.dto;
		let shape: AssetShape | null = null;
		if (dto.shape !== null) {
			const validated = shapeFromPersistence(dto.shape);
			if (!validated.ok) return err(validated.error);
			shape = validated.value;
		}
		let calibration: Calibration | null = null;
		if (dto.calibration) {
			const validated = calibrationFromStored(dto.calibration);
			if (!validated.ok) return err(validated.error);
			calibration = validated.value;
		}

		return ok({
			document: {
				calibration,
				shape,
			},
			version: snapshot.value.version,
		});
	}

	async write(
		assetId: AssetId,
		document: AssetGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, RepositoryError>> {
		const content: AssetSidecarContent = {
			calibration: document.calibration ? calibrationToPersistence(document.calibration) : null,
			shape: document.shape === null ? null : shapeToPersistence(document.shape),
		};
		const written = await this.store.write(assetId, content, expected);
		if (!written.ok) return err(written.error);
		return ok(written.value.version);
	}
}
