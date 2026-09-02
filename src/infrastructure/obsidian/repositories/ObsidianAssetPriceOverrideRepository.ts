import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetPriceOverride } from '../../../domain/asset-price/AssetPriceOverride';
import type { AssetPriceOverrideId } from '../../../domain/asset-price/AssetPriceOverrideId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { AssetId } from '../../../domain/asset/AssetId';
import {
	winningDuplicate,
	type AssetPriceOverrideRepository,
} from '../../../application/ports/AssetPriceOverrideRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { projectFolderOf, assetPricesFolderFor } from './paths';
import { KeyedQueues } from './KeyedQueues';
import type { NoteVaultDeps } from './NoteVaultDeps';
import {
	assetPriceFromPersistence,
	assetPriceToPersistence,
} from '../../persistence/mappers/assetPriceMapper';
import {
	readNoteBackedEntity,
	saveNoteBackedEntity,
	trashNoteBackedEntity,
	type NoteWriteSpec,
} from './noteEntityWrite';

/**
 * Filename is never identity (§83); the id alone keeps these notes findable and unambiguous —
 * the same rule and the same reason as `ObsidianRequirementRepository`'s. An override has no
 * name of its own: it is a relationship, not a thing with one, and `NoteWriteSpec.entryName`
 * is a pure function of the entity, so a friendlier name would need an `assetName` copied onto
 * the entity — drift, refused everywhere else here.
 */
function assetPriceFileName(override: AssetPriceOverride): string {
	return `${override.id}`;
}

/**
 * The note-backed half of the conditional-write contract, without a sidecar. It is
 * `ObsidianRequirementRepository` with a different mapper, and deliberately nothing more.
 *
 * **It holds no `ProjectRepository`**, because spec Decision 2 moved the currency rule to the
 * command: hydration constructs unconditionally, so the read needs nothing but the note.
 *
 * **A duplicated pair is a DIAGNOSTIC and last-writer-wins, never a refusal.** Ids are ULIDs,
 * so two notes for one (project, asset) is a state nothing structurally prevents, and these
 * are user-editable markdown files. Refusing to read a project's prices because a user
 * duplicated a note is worse than reading one of them and saying so — the same shape
 * `warnOnDuplicate` already uses for duplicate ids in the index.
 */
export class ObsidianAssetPriceOverrideRepository implements AssetPriceOverrideRepository {
	private readonly queues = new KeyedQueues();

	constructor(private readonly deps: NoteVaultDeps) {}

	/**
	 * PRIVATE, and not on the port: `hydrate` walks the index by id and this is how it
	 * reads one. No caller above `infrastructure/` asks a price override for its id — see the
	 * port's own header for why that is a decision rather than an omission.
	 */
	private readById(id: AssetPriceOverrideId): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		return readNoteBackedEntity(
			this.deps,
			'asset-price',
			id,
			assetPriceFromPersistence,
			'asset-price.entity-invalid',
		);
	}

	async getForPair(
		projectId: ProjectId,
		assetId: AssetId,
	): Promise<Result<Loaded<AssetPriceOverride> | null, RepositoryError>> {
		const listed = await this.listByProject(projectId);
		if (isErr(listed)) return listed;
		const matches = listed.value.filter((o) => o.entity.assetId === assetId);
		if (matches.length > 1) {
			// Last-writer-wins, and SAY SO. Not a refusal: see the class header.
			this.deps.logger.warn('asset-price.duplicate-pair', {
				projectId,
				assetId,
				count: matches.length,
			});
		}
		// The shared rule, not `matches[matches.length - 1]`: that would be `getIdsByType`
		// order, which is a fact about the index rather than about which note is newest.
		return ok(winningDuplicate(matches));
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.loadedInProject(projectId, (o) => o.projectId === projectId);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.loadedEverywhere((o) => o.assetId === assetId);
	}

	save(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>> {
		return this.queues.run(`asset-price:${override.id}`, () => this.saveQueued(override, expected));
	}

	private saveQueued(
		override: AssetPriceOverride,
		expected: Expected,
	): Promise<Result<Loaded<AssetPriceOverride>, RepositoryError>> {
		// Resolved per save (ADR-0013) and consumed only on the INSERT path — an UPDATE writes
		// where the note already sits and needs no folder at all.
		const folder = projectFolderOf(this.deps.index, override.projectId);
		const spec: NoteWriteSpec<AssetPriceOverride> = {
			kind: 'asset-price',
			indexType: 'renovation-asset-price',
			notesFolder: folder === undefined ? undefined : assetPricesFolderFor(folder),
			projectId: (entity) => entity.projectId,
			entryName: assetPriceFileName,
			toPersistence: assetPriceToPersistence,
			preWriteValid: (dto) => assetPriceFromPersistence({ ...dto }).ok,
			validationCode: 'asset-price.pre-write-invalid',
			writeFailedCode: 'asset-price.write-failed',
		};
		return saveNoteBackedEntity(this.deps, spec, override, expected);
	}

	delete(id: AssetPriceOverrideId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset-price:${id}`, () =>
			// `expected` before the spec, and the code inside it: the delete signature grew a
			// `NoteDeleteSpec` on the asset-designer branch so a kind with a SECOND file can
			// compensate. A price override has no second file, so it passes the code alone.
			trashNoteBackedEntity(this.deps, 'asset-price', id, expected, {
				deleteFailedCode: 'asset-price.delete-failed',
			}),
		);
	}

	/**
	 * **Narrow by the INDEX before hydrating, because a read error is contagious.** Every
	 * caller here refuses on the first unreadable note, so hydrating the whole vault's price
	 * notes to answer a question about one project means a single malformed note — in a
	 * project the caller has never heard of — fails `getForPair` for every pair, and with it
	 * every assign and every recalculation. These notes are USER-EDITABLE by design; one of
	 * them being broken must not disable pricing everywhere.
	 *
	 * `ProjectIndex` already answers both halves without reading a note:
	 * `getIdsByType('renovation-asset-price')` and `getIdsByProject(projectId)`, intersected.
	 * No new port method.
	 *
	 * **Skipping an unreadable note in scope is REFUSED**, and the asymmetry is the point: a
	 * skipped override prices its requirement at the catalogue default and says nothing, which
	 * is a wrong figure presented as a right one — the failure this whole increment exists to
	 * end. Out of scope it cannot affect the answer, so it is not read; in scope it might BE
	 * the answer, so the refusal stands.
	 *
	 * **`listByAsset` cannot be narrowed** — the index has no asset axis — so it still hydrates
	 * every price note and still refuses on the first bad one. Its two callers (the cascade's
	 * skip test and the delete cleanup) both REPORT a failed list rather than proceeding, so
	 * the coupling is loud there rather than silent. Written down instead of hidden, because a
	 * per-asset index axis is a change to `ProjectIndexEntry` that every consumer inherits.
	 */
	private loadedInProject(
		projectId: ProjectId,
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const byType = new Set(this.deps.index.getIdsByType('renovation-asset-price'));
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => byType.has(id)) as AssetPriceOverrideId[];
		return this.hydrate(ids, predicate);
	}

	/** The unnarrowable one; see `loadedInProject` for why it is separate rather than a flag. */
	private loadedEverywhere(
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		return this.hydrate(this.deps.index.getIdsByType('renovation-asset-price') as AssetPriceOverrideId[], predicate);
	}

	private async hydrate(
		ids: readonly AssetPriceOverrideId[],
		predicate: (o: AssetPriceOverride) => boolean,
	): Promise<Result<Loaded<AssetPriceOverride>[], RepositoryError>> {
		const loaded: Loaded<AssetPriceOverride>[] = [];
		for (const id of ids) {
			const found = await this.readById(id);
			if (isErr(found)) return found;
			if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
