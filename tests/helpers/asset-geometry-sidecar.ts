import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
	AssetGeometrySnapshot,
} from '../../src/application/ports/AssetGeometrySidecar';
import type { RepositoryError } from '../../src/application/ports/repositoryErrors';
import type { EntityVersion } from '../../src/application/ports/versioning';
import { externalModification, revisionConflict } from '../../src/application/ports/versioning';
import { err, ok, type Result } from '../../src/core/result/Result';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { observationToken } from './domain';

/**
 * An HONEST in-memory `AssetGeometrySidecar` — the asset half of what
 * `InMemoryPlanGeometrySidecar` is for a plan, and NOT a copy of it: the two ports differ in
 * the one behaviour a fake is most likely to get wrong.
 *
 * **An absent sidecar READS as a valid empty document, it does not refuse.** That is the
 * port's stated design — "a shapeless asset, not an error" — and it is what
 * `AssetGeometryStore.readUnlocked` really does: no file gives `emptyDocument(assetId)` at
 * `ABSENT_VERSION`, `{ revision: 0 }`. The plan sidecar's fake answers an error for an
 * unseeded plan, which is right THERE and would be harsher than the real thing here — and
 * harsher in the one direction that matters, since creating an asset and immediately writing
 * its first footprint is precisely the sequence that reads a sidecar nothing has written yet.
 * Copying the sibling would have made design slice A10's whole creation sequence unreachable
 * in memory while every line of it looked correct.
 *
 * **The version contract is ENFORCED rather than decorated**, which is the other half of not
 * being kinder than the real thing: a stale `expected` revision conflicts and a matching
 * revision with a moved digest reports an external modification, exactly as
 * `AssetGeometryStore` does. Neither arm has a caller yet — design slice A10 writes a first
 * footprint and nothing races it — and they are kept because they are the PORT's contract
 * rather than a test affordance. The sibling's `seed`/`peek`/`poke`/`scratch` are deliberately
 * NOT copied across for the opposite reason: they are affordances, and no test here asks for
 * one. Add each back with the case that needs it.
 */
export class InMemoryAssetGeometrySidecar implements AssetGeometrySidecar {
	private readonly assets = new Map<
		string,
		{ document: AssetGeometryDocument; version: EntityVersion }
	>();

	private digest(document: AssetGeometryDocument): ReturnType<typeof observationToken> {
		return JSON.stringify(document) as never;
	}

	/** The empty document an asset nobody has drawn on reads as, at the absent revision. */
	private absent(): { document: AssetGeometryDocument; version: EntityVersion } {
		const document: AssetGeometryDocument = { calibration: null, shape: null };
		return { document, version: { revision: 0, observed: this.digest(document) } };
	}

	read(assetId: AssetId): Promise<Result<AssetGeometrySnapshot, RepositoryError>> {
		const entry = this.assets.get(assetId) ?? this.absent();
		return Promise.resolve(
			ok({ document: structuredClone(entry.document), version: entry.version }),
		);
	}

	write(
		assetId: AssetId,
		document: AssetGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, RepositoryError>> {
		const current = this.assets.get(assetId) ?? this.absent();
		if (expected) {
			if (expected.revision !== current.version.revision) {
				return Promise.resolve(err(revisionConflict('asset-geometry', assetId)));
			}
			if (expected.observed !== current.version.observed) {
				return Promise.resolve(err(externalModification('asset-geometry', assetId)));
			}
		}
		const version: EntityVersion = {
			revision: current.version.revision + 1,
			observed: this.digest(document),
		};
		this.assets.set(assetId, { document: structuredClone(document), version });
		return Promise.resolve(ok(version));
	}
}
