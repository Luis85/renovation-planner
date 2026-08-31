import { TFile, type FileManager, type Vault } from 'obsidian';
import { err, ok, type Result } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { EntityVersion } from '../../../application/ports/versioning';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { checkExpectedVersion } from './versionCheck';
import { ensureFolder, persistenceError } from './noteIo';
import { assetSidecarPathFor, parentOf } from './paths';
import type { AssetGeometryDTO } from '../../persistence/dto/assetGeometry';
import { AssetGeometrySchemaV1 } from '../../persistence/dto/assetGeometry';
import { KeyedQueues } from './KeyedQueues';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import { observeSidecar } from './digest';

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
	) {}

	read(assetId: AssetId): Promise<Result<AssetSidecarSnapshot, RepositoryError>> {
		return this.queues.run(`asset:${assetId}`, () => this.readUnlocked(assetId));
	}

	/**
	 * Asset-DELETE path only: removes the file, and an ABSENT file is still success — the
	 * ordinary state of an asset nobody has designed, which is the same sentence `read`
	 * answers with an empty document rather than a refusal.
	 *
	 * **No `pathHint`, and that is where the mirror of `PlanGeometryStore.delete` stops.**
	 * Both of its call sites pass one and their reasons are different, and BOTH are reasons
	 * about the INDEX: the plan-insert rollback has no mapping yet (it is upserted only on
	 * success), and the plan delete captures the path before trashing the note because the
	 * note's own delete event can clear the mapping mid-operation. `pathFor` DERIVES
	 * (see its docblock), so neither failure exists here — there is nothing to go stale
	 * between the caller's decision and this lookup. An optional parameter would be a
	 * second, unreachable answer to a question with one.
	 *
	 * Inside the asset's own queue, so a delete cannot interleave with the read-modify-write
	 * of a design gesture on the same asset.
	 *
	 * **What this makes UNRECOVERABLE, and it costs nothing today because the path does not
	 * exist.** `undoDeleteResolution` has exactly one caller
	 * (`reversible-delete-zone-command.ts`) — measured, not assumed — so no undo of an asset
	 * deletion exists to be made lossy. The day one does, restoring the note is no longer the
	 * inverse of deleting it: whoever writes it owes this file's CONTENT, snapshotted before
	 * the removal, the way `ReversibleDeleteZone` owes the geometry entry it takes out.
	 * Until then a deleted design is gone with the asset, which is what a delete means.
	 */
	delete(assetId: AssetId): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset:${assetId}`, async () => {
			const path = this.pathFor(assetId);
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return ok(undefined);
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
	 * Today it derives, because nothing else can answer: the Project Index maps a sidecar
	 * path onto a PLAN entry (`getGeometrySidecarPath` is typed `PlanId`), and both doors
	 * that populate that mapping — the full scan's `joinSidecars` and
	 * `VaultChangeAdapter.processSidecar` — skip any `.rpgeo` whose basename is not an
	 * indexed plan id. So an asset sidecar has no index mapping to consult.
	 *
	 * ADR-0014's Consequences nevertheless say resolution goes through the index "as it does
	 * for plan sidecars", inheriting ADR-011's rule. Closing that spans three modules the
	 * store does not own, so it is a task of its own — and this method is the seam it needs:
	 * an index lookup goes in FRONT of the derivation (`index.get… ?? derived`), which is
	 * ADR-011's own shape, "derivability is a repair path for a damaged index". Every read
	 * and every write resolves here and nowhere else, so that later change is one line
	 * rather than a rewrite of the read path.
	 */
	private pathFor(assetId: AssetId): string {
		return assetSidecarPathFor(this.libraryFolder, assetId);
	}

	/** MUST run inside the asset's queue — both callers here do. */
	private async readUnlocked(assetId: AssetId): Promise<Result<AssetSidecarSnapshot, RepositoryError>> {
		const path = this.pathFor(assetId);
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
		this.echo.mark(path, observeSidecar(text));
		return ok(undefined);
	}
}
