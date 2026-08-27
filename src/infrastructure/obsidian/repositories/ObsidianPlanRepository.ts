import type { TFile } from 'obsidian';
import { err, ok, type Result } from '../../../core/result/Result';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { revisionConflict } from '../../../application/ports/versioning';
import { calibrationFromPersistence, planFromPersistence, planToPersistence } from '../../persistence/mappers/planMapper';
import {
	ensureFolder,
	findNoteIdInFolder,
	frontmatterOf,
	openNoteById,
	persistenceError,
	restoreNoteText,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { observeFrontmatter } from './digest';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import {
	freshNotePath,
	plansFolderFor,
	projectFolderOf,
	sidecarPathFor,
} from './paths';
import { KeyedQueues } from './KeyedQueues';
import { fileAt } from './NoteVaultDeps';
import type { NoteVaultDeps } from './NoteVaultDeps';
import type { PlanGeometryStore } from './PlanGeometryStore';

/**
 * The Obsidian-backed PlanRepository (SDD §36, §42). A Plan's state spans TWO files:
 * its note, and the geometry sidecar whose LIFECYCLE this repository owns (create on
 * insert, delete on delete) — never its CONTENT: not `objects[]`, and since design slice
 * 7 not `calibration` either.
 *
 * `Plan.calibration` is therefore READ-ONLY through this repository: `getById` merges the
 * sidecar's value into the entity, and `save` writes the note alone.
 * `ReversibleCalibratePlanCommand` is the only writer, through
 * `PlanGeometrySidecar` — because calibrating means rewriting the calibration AND every
 * rescaled coordinate as one conditional write, which a plan-note save cannot express.
 *
 * It used to sync the field on every save, and that was a LOST UPDATE with no gate able
 * to see it: calibration does not live in the note, so a calibration landing in the
 * sidecar does not move the note's revision — an entity read BEFORE one still passed
 * `checkExpectedVersion` afterwards, and a rename then wrote its stale calibration (or
 * `null`) back over the new one while the rescaled coordinates stayed. Two writers of one
 * field where only one of them has a version to check is the defect; removing the writer
 * that cannot check is the fix.
 *
 * The two-file lifecycle is compensated in both directions (§42):
 * - INSERT writes the sidecar FIRST: a Plan note without its sidecar is the worse
 *   failure (the Plan looks live but cannot hold geometry), while an orphan sidecar is
 *   inert, unreferenced by the index, and reclaimable. A failed note write deletes the
 *   sidecar just created.
 * - DELETE removes the note first, snapshotting BOTH files beforehand: a failed sidecar
 *   removal restores the note byte-for-byte, so a caller's failed `Result` never means
 *   "partly done".
 */
export class ObsidianPlanRepository {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly geometry: PlanGeometryStore,
	) {}

	async getById(id: PlanId): Promise<Result<Loaded<Plan> | null, RepositoryError>> {
		const opened = openNoteById(this.deps, 'plan', id);
		if (opened.status === 'missing') return Promise.resolve(ok(null));
		if (opened.status === 'error') return Promise.resolve(err(opened.error));

		// Calibration lives in the sidecar; the entity carries it merged in.
		const sidecar = await this.geometry.read(id);
		if (!sidecar.ok) {
			return Promise.resolve(
				err(persistenceError('plan.sidecar-unreadable', `The geometry sidecar for plan ${id} could not be read.`, sidecar.error)),
			);
		}
		// Through the mapper, never by handing the raw DTO across as if it were the domain
		// value. The two shapes are structurally identical today and `Point`'s brand is a
		// phantom field, so the direct pass type-checked — and would go on type-checking on
		// the day the sidecar schema diverges from the entity (tuple coordinates, a unit
		// field), silently loading a malformed calibration. It also aliased the Zod-parsed
		// object into the entity rather than copying it, which is the other thing the
		// mapper exists to prevent.
		const calibration = sidecar.value.dto.calibration;
		const entity = planFromPersistence(
			opened.migrated,
			calibration ? calibrationFromPersistence(calibration) : null,
		);
		if (!entity.ok) {
			// The code names the common case; the CAUSE is what actually refused, and the two
			// are not the same file. A hand-edited sidecar whose calibration breaks a rule
			// only `validateCalibration` can see (coincident points, a collapsed scale)
			// arrives here too, and reporting it as invalid frontmatter with the specific
			// failure discarded sends a reader to the wrong file.
			return Promise.resolve(err(persistenceError('plan.frontmatter-invalid', entity.error.message, entity.error)));
		}
		return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
	}

	save(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, RepositoryError>> {
		return this.queues.run(`plan-note:${plan.id}`, () => this.saveQueued(plan, expected));
	}

	private saveQueued(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, RepositoryError>> {
		const folder = projectFolderOf(this.deps.index, plan.projectId);
		if (folder === undefined) {
			return Promise.resolve(
				err(persistenceError('plan.project-folder-unresolved', `Could not resolve the folder of project ${plan.projectId} for plan ${plan.id}.`)),
			);
		}
		const notesFolder = plansFolderFor(folder);

		// Existence before writes — the fork the conditional-write comparison needs.
		const existing = findNoteIdInFolder(this.deps, this.deps.vault, notesFolder, plan.id);
		const currentVersion =
			existing ? versionOfFrontmatter(frontmatterOf(this.deps, existing)) : undefined;

		const conflict = checkExpectedVersion('plan', plan.id, currentVersion, expected);
		if (conflict) return Promise.resolve(err(conflict));

		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto: Record<string, unknown> = { ...planToPersistence(plan, nextRevision) };

		return existing
			? this.updateExisting(plan, existing, dto, nextRevision)
			: this.insertNew(plan, dto, notesFolder, folder);
	}

	/** Sidecar first, note second, delete-the-sidecar compensation on a failed note write. */
	private async insertNew(
		plan: Plan,
		dto: Record<string, unknown>,
		notesFolder: string,
		projectFolder: string,
	): Promise<Result<Loaded<Plan>, RepositoryError>> {
		const sidecarPath = sidecarPathFor(projectFolder, plan.id);
		const created = await this.geometry.create(plan.id, sidecarPath);
		if (!created.ok) {
			return err(persistenceError('plan.sidecar-create-failed', `Could not create the geometry sidecar for plan ${plan.id}.`, created.error));
		}

		const path = freshNotePath(this.deps.vault, notesFolder, plan.name, plan.id);
		try {
			await ensureFolder(this.deps.vault, notesFolder);
			await this.deps.vault.create(path, serializeFrontmatter(dto));
		} catch (cause) {
			// Compensate. An orphan sidecar would be inert, but leaving one behind makes
			// "the save failed" mean something it does not. The path is passed EXPLICITLY:
			// the index mapping is upserted only on success, so the store cannot resolve it.
			const undone = await this.geometry.delete(plan.id, sidecarPath);
			if (!undone.ok) {
				this.deps.logger.error('plan.insert-compensation-failed', { id: plan.id, cause: undone.error });
			}
			return err(persistenceError('plan.write-failed', `Could not create the note for plan ${plan.id}.`, cause));
		}

		this.deps.index.upsert({
			id: plan.id,
			type: 'renovation-plan',
			path,
			projectId: plan.projectId,
			geometrySidecarPath: sidecarPath,
		});
		this.deps.echo.markFrontmatter(path, dto);

		return ok({ entity: plan, version: { revision: 1, observed: observeFrontmatter(dto) } });
	}

	/**
	 * The note only — an update never creates, deletes or writes into the sidecar. It does
	 * upsert the index entry CARRYING `geometrySidecarPath` through: writing an entry
	 * without it would silently clear the mapping and break every Zone operation on a Plan
	 * whose only change was its title.
	 */
	private async updateExisting(
		plan: Plan,
		note: TFile,
		dto: Record<string, unknown>,
		nextRevision: number,
	): Promise<Result<Loaded<Plan>, RepositoryError>> {
		try {
			await writeOwnedFrontmatter(this.deps.fileManager, note, dto);
		} catch (cause) {
			return err(persistenceError('plan.write-failed', `Could not write the note for plan ${plan.id}.`, cause));
		}

		this.deps.index.upsert({
			id: plan.id,
			type: 'renovation-plan',
			path: note.path,
			projectId: plan.projectId,
			// Through-unchanged from what the index holds. Writers never derive a sidecar
			// path on UPDATE: if the mapping was lost, surfacing the break beats inventing
			// a location behind the index's back (ADR-011) — the rebuild is the repair.
			geometrySidecarPath: this.deps.index.getGeometrySidecarPath(plan.id),
		});
		this.deps.echo.markFrontmatter(note.path, dto);

		return ok({ entity: plan, version: { revision: nextRevision, observed: observeFrontmatter(dto) } });
	}

	delete(id: PlanId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`plan-note:${id}`, async () => {
			const file = this.locate(id);
			// A vanished or unindexed note refuses exactly like a stale expectation: there
			// is nothing at this id to delete.
			if (!file) return err(revisionConflict('plan', id));
			const conflict = checkExpectedVersion(
				'plan',
				id,
				versionOfFrontmatter(frontmatterOf(this.deps, file)),
				expected,
			);
			if (conflict) return err(conflict);

			// Snapshots BEFORE deleting anything: once both files are gone there is nothing
			// left to compensate with.
			let noteText: string;
			try {
				noteText = await this.deps.vault.read(file);
			} catch (cause) {
				return err(persistenceError('plan.delete-failed', `Could not read plan note ${file.path}.`, cause));
			}
			const sidecarFile = fileAt(this.deps.vault, this.deps.index.getGeometrySidecarPath(id));
			if (sidecarFile) {
				try {
					await this.deps.vault.read(sidecarFile);
				} catch (cause) {
					return err(persistenceError('plan.delete-failed', `Could not read the sidecar of plan ${id}.`, cause));
				}
			}

			try {
				await this.deps.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('plan.delete-failed', `Could not delete plan note ${file.path}.`, cause));
			}

			// The path is captured BEFORE the note is trashed: the note's own delete event
			// can clear the index mapping mid-operation, and the store must still find the
			// sidecar through the hint rather than reading absence as success.
			const removedSidecar = await this.geometry.delete(id, sidecarFile?.path);
			if (!removedSidecar.ok) {
				// Compensate: restore the note byte-for-byte so nothing was deleted.
				const restored = await restoreNoteText(this.deps.vault, 'plan', file.path, noteText);
				if (!restored.ok) {
					this.deps.logger.error('plan.delete-compensation-failed', { id, cause: restored.error });
				}
				return err(persistenceError('plan.delete-failed', `Could not remove the sidecar for plan ${id}.`, removedSidecar.error));
			}
			if (sidecarFile) this.deps.echo.forget(sidecarFile.path);

			this.deps.index.remove(id);
			this.deps.echo.forget(file.path);
			return ok(undefined);
		});
	}

	async listByProject(projectId: ProjectId): Promise<Result<Loaded<Plan>[], RepositoryError>> {
		const loaded: Loaded<Plan>[] = [];
		for (const id of this.deps.index.getIdsByProject(projectId)) {
			// One map per project holds every entity kind; plans carry the plan- prefix.
			if (!String(id).startsWith('plan-')) continue;
			const one = await this.getById(id as PlanId);
			if (!one.ok) return one;
			if (one.value) loaded.push(one.value);
		}
		return Promise.resolve(ok(loaded));
	}


	private locate(id: PlanId): TFile | null {
		return fileAt(this.deps.vault, this.deps.index.getPath(id));
	}
}
