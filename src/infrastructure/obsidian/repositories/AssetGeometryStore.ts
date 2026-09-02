import { TFile, type FileManager, type Vault } from 'obsidian';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { checkExpectedVersion } from '../../../application/ports/versioning';
import { ensureFolder, fileStatAt, persistenceError } from './noteIo';
import { assetSidecarPathFor, parentOf, usableAsFilename } from './paths';
import type { AssetGeometryDTO } from '../../persistence/dto/assetGeometry';
import { AssetGeometrySchemaV1 } from '../../persistence/dto/assetGeometry';
import { KeyedQueues } from './KeyedQueues';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import { observeSidecar } from './digest';

/**
 * `.rpgeo`, as the byte count `usableAsFilename`'s length rule needs. ASCII, so its byte count
 * is its character count — written as a literal rather than measured, since measuring it would
 * need the same `TextEncoder` that module keeps private for the reason its own header gives.
 */
const SIDECAR_EXTENSION_BYTES = '.rpgeo'.length;

/** Key order follows construction order, which the schema fixes — deterministic writes. */
function canonicalJson(dto: AssetGeometryDTO): string {
	return JSON.stringify(dto, null, '\t');
}

/** What the store hands back: the parsed document, the version to write against, its path. */
export interface AssetSidecarSnapshot {
	readonly dto: AssetGeometryDTO;
	readonly version: EntityVersion;
	readonly path: string;
}

/** The two fields a caller owns. Everything else in the document is this store's bookkeeping. */
export type AssetSidecarContent = Pick<AssetGeometryDTO, 'calibration' | 'shape'>;

/**
 * The version an asset with NO sidecar reads at, so that the write which follows such a
 * read is accepted rather than refused.
 *
 * Revision 0 and the token of an empty file: both halves are needed, because
 * `checkExpectedVersion` compares BOTH. An `undefined` current — the plan store's answer
 * for a sidecar it cannot resolve — would make every first write of every asset refuse its
 * own expectation, since the ordinary shape of a design command is read-then-write and the
 * read is what mints the expectation.
 */
const ABSENT_VERSION: EntityVersion = { revision: 0, observed: observeSidecar('') };

const emptyDocument = (assetId: AssetId): AssetGeometryDTO => ({
	schemaVersion: 1,
	assetId,
	revision: 0,
	unit: 'mm',
	calibration: null,
	shape: null,
});

/**
 * One asset's geometry sidecar (ADR-0014), read and written whole under that asset's own
 * lock — `PlanGeometryStore`'s shape with two deliberate differences, each stated here
 * because each is a place the mirror STOPS.
 *
 * **1. The path is DERIVED, not indexed.** A plan's sidecar lives in a project folder,
 * which is itself derived from a note the Project Index holds, so ADR-011 resolves it
 * through that mapping. An asset's lives under the `libraryFolder` SETTING, which no index
 * knows: there is no mapping to consult, so deriving is the only lookup rather than a
 * second one. The consequence is that a `libraryFolder` change MUST move `Geometry/` with
 * `Assets/`, inside the settings migration and before the new value is persisted — the
 * store resolves under the new folder the instant the setting lands, and an absent sidecar
 * reads as a shapeless asset rather than as an error, so a stale path loses every designed
 * shape SILENTLY. `migrateLibraryFolder` is where that is enforced.
 *
 * **2. An ABSENT sidecar is a successful read**, not `plan-geometry.missing`. A plan's
 * sidecar is created with the plan, so its absence is damage; an asset's is created by the
 * first design gesture, so `shape: null` at revision 0 is the ordinary starting state of
 * every asset ever created. There is correspondingly no `create` on this store: a write is
 * a create or a modify depending on what is there, decided inside the lock.
 *
 * **What is NOT mirrored, and what that costs.** The plan store runs `MigrationRunner`
 * before parsing, so a sidecar from a newer build refuses with the `Migration` category and
 * the sentence "this build is too old" rather than "your data is bad". This store does not,
 * because the runner is keyed by `DiagnosticEntityKind` and adding `asset-geometry` to that
 * closed union widens the diagnostics snapshot — a decision this task does not own. A
 * future-version sidecar is still REFUSED, by `schemaVersion: z.literal(1)`, and still
 * never loaded; only the category and the sentence are less precise. Pinned by the
 * 'refuses a sidecar written by a newer build' case rather than left as a claim here.
 */
export class AssetGeometryStore {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly vault: Vault,
		private readonly fileManager: FileManager,
		private readonly libraryFolder: string,
		private readonly echo: EchoWindow,
		private readonly index: Pick<ProjectIndex, 'getGeometrySidecarPath'>,
	) {}

	read(assetId: AssetId): Promise<Result<AssetSidecarSnapshot, RepositoryError>> {
		return this.queues.run(`asset:${assetId}`, () => this.readUnlocked(assetId));
	}

	/**
	 * WHICH ASSET THIS FILE SAYS IT IS, or `null` when it will not say.
	 *
	 * `read` has compared the sidecar's declared `assetId` against the one asked for since it
	 * was written — a hand-renamed file, a copied `.rpgeo`, a hand-edited id — and `delete` had
	 * no such check at all: it derived a path, found a file and trashed it. On a
	 * case-insensitive filesystem `cabinet-1` and `Cabinet-1` name ONE file, so deleting either
	 * asset destroyed the other's design, silently, with nothing to restore from — this class's
	 * own header records that a deleted design is gone with its asset. Reported for the READ
	 * path; the delete was the half that could lose data.
	 *
	 * **`null` for anything that will not parse, and that asymmetry is the design.** A refusal
	 * belongs to a sidecar that positively declares somebody else; a corrupt or schema-invalid
	 * one is garbage, and refusing to delete it would leave an asset whose geometry file can
	 * never be cleaned up. So this asks one question and answers it three ways — someone else's,
	 * mine, or unreadable — and only the first is a refusal. Both halves have a case.
	 *
	 * It does NOT close the collision itself: two assets whose ids differ only in case still
	 * share one file, and the second is still undesignable. Closing that needs either the INDEX
	 * inside a path derivation (the same shape as ADR-0014's recorded residual) or a filename
	 * that is no longer the id — which `libraryGeometryIn` now depends on. Recorded in this
	 * increment's plan; what ships here is that the failure cannot be a silent deletion.
	 */
	private async declaredAssetOf(file: TFile): Promise<string | null> {
		try {
			const parsed: unknown = JSON.parse(await this.vault.read(file));
			const validated = AssetGeometrySchemaV1.safeParse(parsed);
			return validated.success ? validated.data.assetId : null;
		} catch {
			return null;
		}
	}

	/**
	 * Asset-DELETE path only: removes the file, and an ABSENT file is still success — the
	 * ordinary state of an asset nobody has designed, which is the same sentence `read`
	 * answers with an empty document rather than a refusal.
	 *
	 * **`pathHint`, and the mirror of `PlanGeometryStore.delete` reaches this far after all.**
	 * This docblock used to refuse one, on the argument that `pathFor` DERIVES so nothing can go
	 * stale between the caller's decision and this lookup. Making `pathFor` ask the index first
	 * falsified that argument in another file — the exact hazard the plan side names: the note's
	 * own delete event can clear the mapping mid-operation, and `trashNoteBackedEntity` runs
	 * `alsoRemove` only AFTER awaiting the trash. A lookup performed here then missed a MOVED
	 * sidecar, fell back to the derived path, found nothing and reported success, so the asset
	 * went and its geometry stayed. The caller captures the mapping before it trashes anything
	 * and passes it in; omitting it still derives, which is every caller that is not mid-delete.
	 *
	 * Inside the asset's own queue, so this removal cannot interleave with a single sidecar
	 * `read` or `write` on the same asset.
	 *
	 * **That sentence used to claim more, and the wider claim was false the day it was written.**
	 * It said a delete "cannot interleave with the read-modify-write of a design gesture", which
	 * `KeyedQueues` cannot deliver: the queue is entered at `read` and at `write` INDIVIDUALLY,
	 * so a caller that reads, decides and then writes has let go of it in between and this
	 * removal fits neatly into the gap. That is PR 43's fourth finding, and it is the shape this
	 * repository keeps re-finding — a rule stated in a docblock is a rule some door is not
	 * following, and the docblock is where to look first.
	 *
	 * What actually holds the wider claim is one layer up: `ReferenceLocks`'s level-1 lock on the
	 * asset, held by `runDeleteResolution` across `deleteEntity` and now by every sidecar writer
	 * across its own read and write. So the guarantee exists and this queue is not what provides
	 * it — and it holds only for a delete that TAKES that lock, which a raw call to
	 * `AssetRepository.delete` and a note removed in Obsidian's file explorer both do not.
	 * `ReferenceLocks.withLevel1` and `assetDesignLocking.test.ts` carry the whole account.
	 *
	 * **What this makes UNRECOVERABLE, and it costs nothing today because the path does not
	 * exist.** `undoDeleteResolution` has exactly one caller
	 * (`reversible-delete-zone-command.ts`) — measured, not assumed — so no undo of an asset
	 * deletion exists to be made lossy. The day one does, restoring the note is no longer the
	 * inverse of deleting it: whoever writes it owes this file's CONTENT, snapshotted before
	 * the removal, the way `ReversibleDeleteZone` owes the geometry entry it takes out.
	 * Until then a deleted design is gone with the asset, which is what a delete means.
	 */
	delete(assetId: AssetId, pathHint?: string): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset:${assetId}`, async () => {
			const resolved = pathHint === undefined ? this.pathFor(assetId) : ok(pathHint);
			// **An id this store cannot name a file for is an ABSENCE here, not a refusal**, and
			// delete is the only door where that is true. `read` and `write` keep refusing: a
			// caller asking to read or design such an asset is asking for something impossible,
			// and the coded refusal is the honest answer. But the same guard refuses every WRITE
			// for such an id, so no sidecar of ours can exist at a path this store declines to
			// name — and `ObsidianAssetRepository.delete` passes this in as `alsoRemove`, so a
			// refusal arrives AFTER the note is trashed and the sequence compensates by restoring
			// it. The asset became permanently undeletable, on every retry, over a file that
			// could never have been created.
			if (isErr(resolved)) return ok(undefined);
			const path = resolved.value;
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return ok(undefined);
			const claimed = await this.declaredAssetOf(file);
			if (claimed !== null && claimed !== assetId) {
				return err(
					persistenceError(
						'asset-geometry.asset-id-mismatch',
						`Sidecar ${path} declares asset ${claimed}, not ${assetId}. It was not deleted.`,
					),
				);
			}
			try {
				await this.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('asset-geometry.delete-failed', `Could not delete sidecar ${path}.`, cause));
			}
			this.echo.forget(path);
			return ok(undefined);
		});
	}

	/**
	 * Replaces the whole document, conditional on `expected`, at revision + 1.
	 *
	 * The read is INSIDE the queue and the comparison inseparable from the write, which is
	 * what makes this a compare-and-swap rather than the check-then-act a caller reading
	 * before calling would get. Two designer leaves on one asset are the case: both read
	 * revision N, one sets the anchor, the other the facing, and without the lock the later
	 * write restores the earlier attribute from its own stale snapshot with nothing
	 * reporting anything.
	 */
	write(
		assetId: AssetId,
		content: AssetSidecarContent,
		expected?: EntityVersion,
	): Promise<Result<{ version: EntityVersion }, RepositoryError>> {
		return this.queues.run(`asset:${assetId}`, async () => {
			const current = await this.readUnlocked(assetId);
			if (!current.ok) return current;

			const conflict = expected
				? checkExpectedVersion('asset-geometry', String(assetId), current.value.version, expected)
				: null;
			if (conflict) return err(conflict);

			const nextRevision = current.value.version.revision + 1;
			const text = canonicalJson({
				schemaVersion: 1,
				assetId,
				revision: nextRevision,
				unit: 'mm',
				calibration: content.calibration,
				shape: content.shape,
			});

			const written = await this.writeText(current.value.path, text);
			if (!written.ok) return written;

			return ok({ version: { revision: nextRevision, observed: observeSidecar(text) } });
		});
	}

	/**
	 * WHERE THIS ASSET'S SIDECAR IS — the one resolution site, so that it stays one.
	 *
	 * **The index, then the derivation** — ADR-0014's Consequences inheriting ADR-011's rule,
	 * "derivability is a repair path for a damaged index, not a second lookup mechanism for
	 * normal reads". Both doors that populate the mapping record an ASSET's now as well as a
	 * plan's: the full scan's `joinSidecars` and `VaultChangeAdapter.processSidecar`.
	 *
	 * It derived unconditionally for the whole of the first increment, which is the defect this
	 * replaced rather than a simplification: a `.rpgeo` a user moved in the file explorer, or
	 * that arrived elsewhere through sync, left the asset reading as SHAPELESS — an absent
	 * sidecar is the ordinary state of an undesigned asset, so nothing about that read looked
	 * wrong — and the next design write minted a second sidecar at the derived path beside the
	 * orphan. A plan already survived the same gesture.
	 *
	 * Every read and every write resolves HERE and nowhere else, which is what made the change
	 * one line rather than a rewrite of the read path.
	 */
	private pathFor(assetId: AssetId): Result<string, RepositoryError> {
		// The extension is passed in rather than assumed, because the LENGTH rule is about the
		// whole filename and this store is what knows the suffix it appends.
		if (!usableAsFilename(assetId, SIDECAR_EXTENSION_BYTES)) {
			return err(
				persistenceError(
					'asset-geometry.unusable-id',
					`An asset id names its sidecar file, and ${assetId} cannot be a filename.`,
				),
			);
		}
		// **The index FIRST, the derivation as the repair path** — ADR-011's own shape, which
		// ADR-0014 inherits and which this method's header reserved as one line. Until it was
		// one, a `.rpgeo` a user had moved in the file explorer or that arrived elsewhere
		// through sync left the asset reading as SHAPELESS — an absent sidecar is the ordinary
		// state of an undesigned asset, so nothing about that read looked wrong — and the next
		// design write minted a SECOND sidecar at the derived path beside the orphan.
		//
		// The derivation is not a fallback nobody reaches: it answers for every asset the index
		// has not joined a file to yet, which is every asset before the first scan and every one
		// on a build whose index predates this mapping.
		return ok(this.index.getGeometrySidecarPath(assetId) ?? assetSidecarPathFor(this.libraryFolder, assetId));
	}

	/** MUST run inside the asset's queue — both callers here do. */
	private async readUnlocked(assetId: AssetId): Promise<Result<AssetSidecarSnapshot, RepositoryError>> {
		const resolved = this.pathFor(assetId);
		if (isErr(resolved)) return resolved;
		const path = resolved.value;
		const file = this.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return ok({ dto: emptyDocument(assetId), version: ABSENT_VERSION, path });
		}

		let rawText: string;
		try {
			rawText = await this.vault.read(file);
		} catch (cause) {
			return err(persistenceError('asset-geometry.unreadable', `Could not read sidecar ${path}.`, cause));
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawText);
		} catch (cause) {
			return err(persistenceError('asset-geometry.corrupt', `Sidecar ${path} is not valid JSON.`, cause));
		}

		const validated = AssetGeometrySchemaV1.safeParse(parsed);
		if (!validated.success) {
			return err({
				category: 'Validation',
				code: 'asset-geometry.schema-invalid',
				message: `Sidecar ${path} failed validation: ${validated.error.issues.map((issue) => issue.message).join('; ')}`,
			});
		}

		// The filename join happened in `assetSidecarPathFor`; THIS comparison is where a
		// mismatch — a hand-renamed file, a copied `.rpgeo`, a hand-edited `assetId` —
		// surfaces, never silently preferred. Without it the designer loads one asset's
		// geometry under another asset's name and then EDITS it there, and the copy is the
		// ordinary way to reach it: duplicating a `.rpgeo` in the file explorer and renaming
		// it is what a user does to reuse a shape.
		if (validated.data.assetId !== assetId) {
			return err(
				persistenceError(
					'asset-geometry.asset-id-mismatch',
					`Sidecar ${path} declares asset ${validated.data.assetId}, not ${assetId}.`,
				),
			);
		}

		return ok({
			dto: validated.data,
			version: { revision: validated.data.revision, observed: observeSidecar(rawText) },
			path,
		});
	}

	/**
	 * Create or modify, decided by what is on disk INSIDE the lock rather than by what the
	 * caller read.
	 *
	 * The FOLDER first, and this is not belt-and-braces: `vault.create` refuses when its
	 * parent does not exist, and the library's `Geometry/` is a folder no note ever lands in
	 * — `ObsidianAssetRepository` creates `Assets/`, and nothing creates its sibling. On a
	 * fresh vault this is the first write of the first asset ever designed, which is exactly
	 * how the plan sidecar shipped without one and answered "the sidecar could not be
	 * created" on the first plan ever saved.
	 */
	private async writeText(path: string, text: string): Promise<Result<void, RepositoryError>> {
		const existing = this.vault.getAbstractFileByPath(path);
		try {
			if (existing instanceof TFile) {
				await this.vault.modify(existing, text);
			} else {
				await ensureFolder(this.vault, parentOf(path));
				await this.vault.create(path, text);
			}
		} catch (cause) {
			return err(persistenceError('asset-geometry.write-failed', `Could not write sidecar ${path}.`, cause));
		}
		// The stat is read with NOTHING awaited since the write in either arm above, which is
		// what makes it a statement about the file WE wrote — the rule `fileStatToken`'s docblock
		// states, and the one the zone repository broke by taking its reading after an await.
		this.echo.mark(path, observeSidecar(text), fileStatAt(this.vault, path));
		return ok(undefined);
	}
}
