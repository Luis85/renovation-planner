import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import {
	winningDuplicate,
	type AssetPriceOverrideRepository,
} from '../../../application/ports/AssetPriceOverrideRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * See InMemoryProjectRepository for the contract this implements and why `poke` exists.
 *
 * `getForPair` resolves a duplicated pair through `winningDuplicate` (the highest id), which is
 * the same last-writer-wins the note-backed repository lands on — the fake must not be kinder
 * than the real thing. It raises no diagnostic, because it has no logger and cannot acquire one
 * without every test that constructs it growing an argument; the duplicate DIAGNOSTIC is
 * asserted against the Obsidian repository, where the duplicate can actually exist as two notes.
 */
export class InMemoryAssetPriceOverrideRepository implements AssetPriceOverrideRepository {
	private readonly store = new VersionedStore<AssetPriceOverride>();

	poke(id: AssetPriceOverrideId): void {
		this.store.poke(id);
	}

	getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, PersistenceError>> {
		// `winningDuplicate`, never `.find(...)`: `VersionedStore.values()` preserves insertion
		// order, so `find` answers the OLDEST match where the note-backed repository answers the
		// newest. A fake that resolves a different override than production is a fake that makes
		// every test about duplicates evidence for the wrong program.
		const matches = this.store
			.values()
			.filter((o) => o.entity.projectId === projectId && o.entity.assetId === assetId);
		return Promise.resolve(ok(winningDuplicate(matches)));
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((o) => o.entity.projectId === projectId)));
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values().filter((o) => o.entity.assetId === assetId)));
	}

	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(override.id, override, expected, 'asset-price'));
	}

	delete(
		id: AssetPriceOverrideId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'asset-price'));
	}
}
