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
 * Everything a `RepositoryError` carries, plus the file the refusal is about (§3.5, "naming
 * the sidecar"). `BaseError.message` is developer English and has no structured path field,
 * so a builder could satisfy §8's *every visible string resolves through `t(...)`* or this
 * row's promise to name the file, and not both; adding a field to `BaseError` would be a
 * change to every error in the plugin for one row's benefit. So the path rides on THIS
 * port instead — the store has it at the moment it refuses, and `GetAssetDesign` passes it
 * through unchanged for an interpolated key to name.
 *
 * `undefined` for a refusal with no file to name — `asset-geometry.unusable-id` refuses
 * before any path is derived, so its absence is by construction rather than an omission.
 */
export type AssetGeometryError = RepositoryError & { readonly sidecarPath?: string };

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
 * It shipped one task ahead of its first implementer under fallow's expected-unused tag,
 * chosen over a `fallow-ignore` precisely so that fallow would report the ANNOTATION as
 * stale the moment something imported the interface. `ObsidianAssetGeometrySidecar` did, the
 * gate said so, and the tag is gone — removed by the change that made it wrong rather than
 * outliving its reason, which is the whole of what that mechanism was for.
 *
 * The tag's NAME is deliberately not written out above. Fallow matches it anywhere in the
 * docblock rather than only where it is applied, so a sentence describing the tag in prose
 * goes on being read as the tag itself and the suppression stays stale forever — measured,
 * by removing the tag and watching the gate go on reporting it.
 */
export interface AssetGeometrySidecar {
	read(assetId: AssetId): Promise<Result<AssetGeometrySnapshot, AssetGeometryError>>;
	write(
		assetId: AssetId,
		document: AssetGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, AssetGeometryError>>;
}
