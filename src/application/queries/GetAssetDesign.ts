import { err, isErr, ok, type Result } from '../../core/result/Result';
import type { GeometryError, ReferenceError } from '../../core/errors/AppError';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import { assetNotFound } from '../../domain/asset/Asset.errors';
import type { AssetShape, Dimensions } from '../../domain/asset/AssetShape';
import { dimensionsOf } from '../../domain/asset/AssetShape';
import type { Calibration } from '../../domain/plan/Calibration';
import type { Query } from './Query';
import type { AssetRepository } from '../ports/AssetRepository';
import type { AssetGeometrySidecar } from '../ports/AssetGeometrySidecar';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { EntityVersion, Loaded } from '../ports/versioning';

/**
 * The designer's read model for ONE asset: a flat, presentation-shaped DTO computed on
 * demand, never a `Loaded<Asset>` handle and never the entity itself — the shape
 * `GetZoneInspector` already takes for the plan editor's panel.
 *
 * It is the one place an asset's TWO resources are joined. `name` and `height` come from
 * the note (ADR-0014 keeps a height in frontmatter, where a reader with no plugin can see
 * it); `calibration` and `shape` come from the geometry sidecar. Nothing here is stored
 * twice, which is why `dimensions` is derived rather than read.
 */
export interface AssetDesignDto {
	readonly assetId: AssetId;
	readonly name: string;
	/** Millimetres, or `null` for an asset that says nothing about how tall it is. */
	readonly height: number | null;
	readonly calibration: Calibration | null;
	/** `null` is the ordinary starting state of a designed asset, not a failure to read one. */
	readonly shape: AssetShape | null;
	/** Null when there is no footprint to measure — never `{ width: 0, depth: 0 }`. */
	readonly dimensions: Dimensions | null;
	/**
	 * `shape.footprintPending` — a stored fact about the FOOTPRINT's own capture, and never
	 * a join. Reading it as "pending, or there is no calibration" would re-flag a measured
	 * outline the moment its background was replaced (Decision 5 clears the calibration and
	 * leaves the millimetres alone); reading it as "pending AND uncalibrated" would clear
	 * the warning over a trace nothing has converted, on a surface that merely carries a
	 * scale. One flag per coordinate group is what makes both wrong.
	 */
	readonly dimensionsUnscaled: boolean;
	/**
	 * TWO versions, named, because an asset is two resources with two independent revision
	 * counters — `SetAssetHeight` conditions on the note's and the five geometry commands on
	 * the sidecar's. One field called `version` would be a value half of its readers use
	 * against the wrong port: presented to the note it refuses as stale, presented to the
	 * sidecar it conditions a write on a number that never described it. That is the same
	 * fact the designer's two `WriteLedger`s exist for, met at the read side.
	 */
	readonly noteVersion: EntityVersion;
	readonly geometryVersion: EntityVersion;
}

/**
 * What this read can refuse with, spelled out rather than declared as `AppError`. A union
 * that cannot carry what its own body produces is a bug waiting for its first failure; a
 * union WIDER than the body is a caller narrowing on arms nothing raises. Three sources,
 * and each is reachable: either port (`RepositoryError`), an asset that is not there
 * (`ReferenceError`), and a footprint whose extent is not representable (`GeometryError`).
 */
export type AssetDesignError = RepositoryError | ReferenceError | GeometryError;

/**
 * Read one asset's whole design (Task A8).
 *
 * **A failed read and an absent asset stay two answers.** `isErr(x) || x.value === null` is
 * one branch that cannot say which happened, and this repository has shipped that collapse
 * three times — a vault fault reported to a user as "that entry is gone", about a note whose
 * bytes are sitting on disk. So the repository's own error propagates unchanged and only a
 * resolved `null` becomes `asset.not-found`, which is the spelling `SetAssetHeight` already
 * uses for the same question.
 *
 * **A refused SIDECAR propagates too, and for a sharper reason.** `ObsidianAssetGeometrySidecar`
 * runs `validateAssetShape` and `validateCalibration` over what it read and REFUSES rather
 * than repairing. Degrading that refusal into `shape: null` here would undo the refusal one
 * layer up: the surface would offer to draw a first outline over a file that already holds
 * one, and the unscaled warning that damaged shape may be owed would be unreachable. An
 * ABSENT sidecar is a different answer and the store already makes it one — a shapeless
 * asset, at revision 0, which is where every asset starts.
 *
 * **`dimensions` is DERIVED (§88)**, so a traced outline needs no typed numbers beside it and
 * the two can never disagree. A non-representable extent is REFUSED rather than reported as
 * `null`, because `null` here means "there is nothing to measure" and an overflow means "this
 * cannot be measured" — the same two answers this class keeps apart one paragraph above.
 */
export class GetAssetDesignQuery
	implements Query<AssetId, Result<AssetDesignDto, AssetDesignError>>
{
	constructor(
		private readonly assets: AssetRepository,
		private readonly geometry: AssetGeometrySidecar,
	) {}

	async execute(assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>> {
		const read = await this.assets.getById(assetId);
		if (isErr(read)) return read;
		if (read.value === null) return err(assetNotFound(assetId));
		// Explicitly annotated rather than left to inference, for the reason
		// `GetZoneInspector` states: fallow resolves a class member's cross-file usage from
		// an explicit type annotation, not from a bare property access.
		const loaded: Loaded<Asset> = read.value;
		const asset: Asset = loaded.entity;

		const snapshot = await this.geometry.read(assetId);
		if (isErr(snapshot)) return snapshot;
		const { document, version: geometryVersion } = snapshot.value;
		const shape = document.shape;

		let dimensions: Dimensions | null = null;
		if (shape !== null) {
			const measured = dimensionsOf(shape.footprint);
			if (isErr(measured)) return measured;
			dimensions = measured.value;
		}

		return ok({
			assetId: asset.id,
			name: asset.name,
			height: asset.height,
			calibration: document.calibration,
			shape,
			dimensions,
			dimensionsUnscaled: shape?.footprintPending ?? false,
			noteVersion: loaded.version,
			geometryVersion,
		});
	}
}
