import type { TFile } from 'obsidian';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { revisionConflict } from '../../../application/ports/versioning';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { planFromPersistence, planToPersistence } from '../../persistence/mappers/planMapper';
import {
	ensureFolder,
	findNoteIdInFolder,
	frontmatterOf,
	openNoteById,
	persistenceError,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { observeFrontmatter } from './digest';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import {
	fileNameFor,
	normalizeFolder,
	planNotePathFor,
	plansFolderFor,
	sidecarPathFor,
} from './paths';
import { KeyedQueues } from './KeyedQueues';
import { fileAt } from './NoteVaultDeps';
import type { NoteVaultDeps } from './NoteVaultDeps';
import type { PlanGeometryStore } from './PlanGeometryStore';

/**
 * The Obsidian-backed PlanRepository (SDD §36, §42). A Plan's state spans TWO files:
 * its note, and the geometry sidecar whose LIFECYCLE this repository owns (create on
 * insert, delete on delete; never `objects[]` content). The calibration FIELD of the
 * sidecar is Plan state too and travels with every save — that, not the note, is where
 * §38 puts it, so recalibration stays one write away from the geometry it rescales.
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
function parentOf(path: string): string {
	// slice(0, 0) when there is no slash — no branch needed for rootless paths.
	return path.slice(0, Math.max(path.lastIndexOf('/'), 0));
}

function calibrationToDto(calibration: Plan['calibration']): PlanGeometryDTO['calibration'] {
	if (!calibration) return null;
	return {
		pointA: { x: calibration.pointA.x, y: calibration.pointA.y },
		pointB: { x: calibration.pointB.x, y: calibration.pointB.y },
		knownDistance: calibration.knownDistance,
		pixelsPerWorldUnit: calibration.pixelsPerWorldUnit,
	};
}

export class ObsidianPlanRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly geometry: PlanGeometryStore,
	) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	async getById(id: PlanId): Promise<Result<Loaded<Plan> | null, PersistenceError>> {
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
		const entity = planFromPersistence(opened.migrated, sidecar.value.dto.calibration);
		if (!entity.ok) {
			return Promise.resolve(err(persistenceError('plan.frontmatter-invalid', entity.error.message)));
		}
		return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
	}

	save(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
		return this.queues.run(`plan-note:${plan.id}`, () => this.saveQueued(plan, expected));
	}

	private saveQueued(
		plan: Plan,
		expected: Expected,
	): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
		// Existence before writes — the fork the conditional-write comparison needs.
		const notesFolder = plansFolderFor(this.folder);
		const existing = findNoteIdInFolder(this.deps.vault, this.deps.metadataCache, notesFolder, plan.id);
		const currentVersion =
			existing ? versionOfFrontmatter(frontmatterOf(this.deps.metadataCache, existing)) : undefined;

		const conflict = checkExpectedVersion('plan', plan.id, currentVersion, expected);
		if (conflict) return Promise.resolve(err(conflict));

		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto: Record<string, unknown> = { ...planToPersistence(plan, nextRevision) };

		return existing ? this.updateExisting(plan, existing, dto, nextRevision) : this.insertNew(plan, dto, notesFolder);
	}

	/** Sidecar first, note second, delete-the-sidecar compensation on a failed note write. */
	private async insertNew(
		plan: Plan,
		dto: Record<string, unknown>,
		notesFolder: string,
	): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
		const sidecarPath = sidecarPathFor(this.folder, plan.id);
		const created = await this.geometry.create(plan.id, sidecarPath);
		if (!created.ok) {
			return err(persistenceError('plan.sidecar-create-failed', `Could not create the geometry sidecar for plan ${plan.id}.`, created.error));
		}

		const path = planNotePathFor(this.folder, fileNameFor(plan.name));
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
	 * The note only. An update never creates or deletes the sidecar — but it syncs the
	 * calibration field (Plan state) and upserts the index entry CARRYING
	 * `geometrySidecarPath` through: writing an entry without it would silently clear
	 * the mapping and break every Zone operation on a Plan whose only change was its title.
	 */
	private async updateExisting(
		plan: Plan,
		note: TFile,
		dto: Record<string, unknown>,
		nextRevision: number,
	): Promise<Result<Loaded<Plan>, PersistenceError | ValidationError>> {
		try {
			await writeOwnedFrontmatter(this.deps.fileManager, note, dto);
		} catch (cause) {
			return err(persistenceError('plan.write-failed', `Could not write the note for plan ${plan.id}.`, cause));
		}

		const synced = await this.syncCalibration(plan);
		if (!synced.ok) return synced;

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

	private async syncCalibration(plan: Plan): Promise<Result<void, PersistenceError | ValidationError>> {
		const current = await this.geometry.read(plan.id);
		if (!current.ok) {
			return err(persistenceError('plan.sidecar-unreadable', `The geometry sidecar for plan ${plan.id} could not be read.`, current.error));
		}
		const stored = JSON.stringify(current.value.dto.calibration);
		const wanted = JSON.stringify(calibrationToDto(plan.calibration));
		if (stored === wanted) return ok(undefined);

		const mutated = await this.geometry.mutate(plan.id, (dto) => ({
			...dto,
			calibration: calibrationToDto(plan.calibration),
		}));
		return mutated.ok ? ok(undefined) : mutated;
	}

	delete(id: PlanId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>> {
		return this.queues.run(`plan-note:${id}`, async () => {
			const file = this.locate(id);
			// A vanished or unindexed note refuses exactly like a stale expectation: there
			// is nothing at this id to delete.
			if (!file) return err(revisionConflict('plan', id));
			const conflict = checkExpectedVersion(
				'plan',
				id,
				versionOfFrontmatter(frontmatterOf(this.deps.metadataCache, file)),
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

			const removedSidecar = await this.geometry.delete(id);
			if (!removedSidecar.ok) {
				// Compensate: restore the note byte-for-byte so nothing was deleted.
				const restored = await this.restoreNote(file.path, noteText);
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

	async listByProject(projectId: ProjectId): Promise<Result<Loaded<Plan>[], PersistenceError>> {
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

	/**
	 * Byte-for-byte note restore inside the same queue section as the failed operation —
	 * outside it, the restore would race the next writer and undo THAT writer's work.
	 * Reached only after the note was successfully trashed, so this always CREATES.
	 */
	private async restoreNote(path: string, text: string): Promise<Result<void, PersistenceError>> {
		const parent = parentOf(path);
		try {
			await ensureFolder(this.deps.vault, parent);
			await this.deps.vault.create(path, text);
			return ok(undefined);
		} catch (cause) {
			return err(persistenceError('plan.restore-failed', `Could not restore plan note ${path}.`, cause));
		}
	}

	private locate(id: PlanId): TFile | null {
		return fileAt(this.deps.vault, this.deps.index.getPath(id));
	}
}
