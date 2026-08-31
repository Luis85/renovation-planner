import type { RepositoryError } from './repositoryErrors';
import type { Result } from '../../core/result/Result';
import type { AssetShape } from '../../domain/asset/AssetShape';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Calibration } from '../../domain/plan/Calibration';
import type { EntityVersion } from './versioning';

/**
 * The whole editable content of ONE asset's geometry sidecar (ADR-0014), calibration
 * included — the plan sidecar's document with one `shape` where a plan holds many
 * `objects`, because an asset IS one object.
 *
 * Both fields are nullable and the states are ORDERED: an asset may carry a reference
 * background and the calibration measured off it before anybody has drawn an outline on
 * it, so `shape: null` is the ordinary starting state of a designed asset rather than a
 * failure to read one.
 *
 * `calibration` is the ASSET's own and never a plan's: an asset is designed against its
 * own reference image, so the scale that image was measured at belongs to the object
 * rather than to whichever plan the object is later placed on.
 *
 * The shape is the DOMAIN's `AssetShape`, with `Polygon`s and `Point`s, so a caller never
 * parses storage shape — the persisted `[x, y]` tuples are raised by the adapter below
 * the port, exactly as the plan sidecar raises its own.
 */
export interface AssetGeometryDocument {
	readonly calibration: Calibration | null;
	readonly shape: AssetShape | null;
}

export interface AssetGeometrySnapshot {
	readonly document: AssetGeometryDocument;
	readonly version: EntityVersion;
}

/**
 * Read/write access to ONE asset's geometry sidecar as a single document (SDD §40). The
 * write replaces the whole document and is conditional on `expected`, exactly like every
 * other port here — recalibrating an asset rewrites the calibration AND every rescaled
 * coordinate the shape holds (footprint, clearance and anchor alike) in ONE file
 * operation, which is why this is document-grained rather than per-attribute.
 *
 * `infrastructure/ObsidianAssetGeometrySidecar` adapts the concrete
 * `AssetGeometryStore`; schema, revision counter and lock stay below the port.
 *
 * `@expected-unused` rather than a `fallow-ignore`, because the two say different things:
 * this interface has no implementer yet — the store and the adapter are the increment
 * after this one — and the tag is what makes fallow report the ANNOTATION as stale the
 * moment something imports it, so the note is removed by the change that makes it wrong
 * rather than outliving its reason. An abstraction shipped ahead of its first use is a
 * finding this repository normally refuses; this one is declared early because the
 * document shape above is what the store is written against.
 *
 * @expected-unused
 */
export interface AssetGeometrySidecar {
	read(assetId: AssetId): Promise<Result<AssetGeometrySnapshot, RepositoryError>>;
	write(
		assetId: AssetId,
		document: AssetGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, RepositoryError>>;
}
