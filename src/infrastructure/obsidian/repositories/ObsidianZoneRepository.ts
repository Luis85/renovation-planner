import { TFile } from 'obsidian';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import {
	zoneFromPersistence,
	zoneToGeometryEntry,
	zoneToPersistence,
} from '../../persistence/mappers/zoneMapper';
import { ZoneFrontmatterSchemaV1 } from '../../persistence/dto/zoneFrontmatter';
import { SpatialObjectGeometrySchemaV1 } from '../../persistence/dto/planGeometry';
import { parsePersisted } from '../../persistence/mappers/parse';
import {
	ensureFolder,
	cacheReading,
	frontmatterOf,
	openNoteById,
	persistenceError,
	restoreNoteText,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { observeFrontmatter } from './digest';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import { revisionConflict } from '../../../application/ports/versioning';
import { freshNotePath, projectFolderOf, zonesFolderFor } from './paths';
import { KeyedQueues } from './KeyedQueues';
import { fileAt } from './NoteVaultDeps';
import type { NoteVaultDeps } from './NoteVaultDeps';
import type { PlanGeometryStore } from './PlanGeometryStore';

/**
 * The Obsidian-backed ZoneRepository (SDD §42). A Zone's state spans TWO files — its
 * note and one entry in its plan's sidecar — and `save` treats both writes as ONE
 * logical transaction:
 *
 *   1. validate fully, before any I/O
 *   2. read the plan sidecar path and the note; snapshot the note's RAW TEXT (the exact
 *      compensation an UPDATE needs) and establish insert-vs-update here, before
 *      anything is written — never inferred afterwards, when the note exists either way
 *   2b. compare-and-swap: revision first, then the observed token
 *   3. write the note frontmatter (creating the note on insert)
 *   4. upsert the geometry entry into the sidecar (the store's per-plan lock)
 *   5. on a step-4 failure, compensate according to step 2: restore the snapshot for an
 *      update, DELETE the created note for an insert — restoring "nothing" would leave
 *      exactly the live-note-without-geometry orphan this sequence exists to prevent
 *   6. upsert the Project Index entry synchronously — never left to the debounced pipeline
 *
 * Steps 2–5 hold the per-ENTITY queue; the sidecar write takes the per-plan lock inside
 * that. They nest entity → plan everywhere: taking them in either order at different
 * call sites is the deadlock this states the ordering to avoid. The compensation runs
 * INSIDE the queue — outside it, a restore would race the next writer and undo THAT
 * writer's work.
 */
/**
 * "Give me this plan's geometry sidecar" — `PlanGeometryStore.read`'s own signature, named
 * so `loadOne` can take it as a parameter and `list` can pass a memoised one. Derived from
 * the method rather than restated, so a widening of its error channel reaches here.
 */
type SidecarReader = PlanGeometryStore['read'];

function validationFailure(message: string): ValidationError {
	return { category: 'Validation', code: 'zone.pre-write-invalid', message };
}

export class ObsidianZoneRepository {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly geometry: PlanGeometryStore,
	) {}

	getById(id: ZoneId): Promise<Result<Loaded<Zone> | null, RepositoryError>> {
		return this.loadOne(id, (planId) => this.geometry.read(planId));
	}

	/**
	 * One zone, with its plan's sidecar supplied rather than read — the seam that lets
	 * `list` read that document ONCE instead of once per zone.
	 *
	 * The sidecar is plan-grained: reading it is a vault read plus a JSON parse plus a
	 * migration plus a Zod validation of every spatial object in the plan. Loading N zones
	 * by calling `getById` N times therefore did N of those, so reflecting a single changed
	 * zone cost O(N) file reads and O(N²) point validations — and the editor's post-command
	 * refresh re-hydrates the whole plan after every drag release, drawn polygon, delete and
	 * Undo press.
	 */
	private async loadOne(
		id: ZoneId,
		readSidecar: SidecarReader,
	): Promise<Result<Loaded<Zone> | null, RepositoryError>> {
		const opened = openNoteById(this.deps, 'zone', id);
		if (opened.status === 'missing') return Promise.resolve(ok(null));
		if (opened.status === 'error') return Promise.resolve(err(opened.error));

		const parsed = parsePersisted(ZoneFrontmatterSchemaV1, opened.migrated, 'zone.frontmatter-invalid', 'Zone note');
		if (!parsed.ok) return Promise.resolve(err(persistenceError('zone.frontmatter-invalid', parsed.error.message)));

		// The sidecar half. A live note whose plan's sidecar cannot be read is a broken
		// state, not a missing zone.
		const planId = parsed.value.plan as PlanId;
		const sidecar = await readSidecar(planId);
		if (!sidecar.ok) {
			return Promise.resolve(
				err(persistenceError('zone.sidecar-unreadable', `The geometry sidecar for plan ${planId} could not be read.`, sidecar.error)),
			);
		}
		const entry = sidecar.value.dto.objects.find((object) => object.id === id);
		if (!entry) {
			return Promise.resolve(
				err(persistenceError('zone.geometry-entry-missing', `No geometry entry for zone ${id} in the sidecar of ${planId}.`)),
			);
		}

		const entity = zoneFromPersistence(opened.migrated, entry);
		if (!entity.ok) {
			return Promise.resolve(err(persistenceError('zone.entity-invalid', entity.error.message)));
		}
		return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
	}

	save(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, RepositoryError>> {
		return this.queues.run(`zone:${zone.id}`, () => this.saveQueued(zone, expected));
	}

	private async saveQueued(
		zone: Zone,
		expected: Expected,
	): Promise<Result<Loaded<Zone>, RepositoryError>> {
		// Step 2: existence and snapshots BEFORE any write.
		//
		// Through the INDEX, not a scan of the derived folder — the same lookup `getById`
		// and `delete` use. Slice 18 bounded discovery by what a note DECLARES rather than
		// by where it sits, so a zone note the user filed anywhere else is read, indexed and
		// deletable; a folder scan could not see it, `currentVersion` came back undefined,
		// and the save answered a permanent `zone.revision-conflict`. The project's folder
		// is resolved further down, on the INSERT path alone, because that is the only path
		// that has to choose where a note goes.
		const existing = this.locate(zone.id);
		const currentVersion =
			existing ? versionOfFrontmatter(frontmatterOf(this.deps, existing)) : undefined;

		let snapshotText: string | null = null;
		if (existing) {
			try {
				snapshotText = await this.deps.vault.read(existing);
			} catch (cause) {
				return err(persistenceError('zone.save-failed', `Could not read zone note ${existing.path}.`, cause));
			}
		}

		// Step 2b.
		const supersedes = cacheReading(this.deps, existing);

		const conflict = checkExpectedVersion('zone', zone.id, currentVersion, expected);
		if (conflict) return err(conflict);

		// Step 1's other half: lower through the mapper, then prove BOTH halves pass their
		// schemas before anything touches disk — a NaN vertex dies here, not half-written
		// into the sidecar as a null coordinate.
		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto: Record<string, unknown> = { ...zoneToPersistence(zone, nextRevision) };
		const geometryEntry = zoneToGeometryEntry(zone);
		const frontmatterOk = ZoneFrontmatterSchemaV1.safeParse(dto).success;
		const geometryOk = SpatialObjectGeometrySchemaV1.safeParse(geometryEntry).success;
		if (!frontmatterOk || !geometryOk) {
			return err(validationFailure('The zone failed pre-write validation.'));
		}

		// Step 3.
		let notePath: string;
		try {
			if (existing) {
				notePath = existing.path;
				await writeOwnedFrontmatter(this.deps.fileManager, existing, dto);
			} else {
				// The derived folder, for the INSERT alone. `undefined` is a refusal rather
				// than a fallback: writing to a defaulted path when the real one is unknown
				// is how a note lands in a parallel tree beside the user's work. An UPDATE
				// never reaches here — it writes where the note already is.
				const folder = projectFolderOf(this.deps.index, zone.projectId);
				if (folder === undefined) {
					return err(persistenceError('zone.project-folder-unresolved', `Could not resolve the folder of project ${zone.projectId} for zone ${zone.id}.`));
				}
				const notesFolder = zonesFolderFor(folder);
				notePath = freshNotePath(this.deps.vault, notesFolder, zone.name, zone.id);
				await ensureFolder(this.deps.vault, notesFolder);
				await this.deps.vault.create(notePath, serializeFrontmatter(dto));
			}
		} catch (cause) {
			return err(persistenceError('zone.write-failed', `Could not write the note for zone ${zone.id}.`, cause));
		}

		// Step 4.
		const mutated = await this.geometry.mutate(zone.planId, (sidecarDto) => ({
			...sidecarDto,
			objects: [...sidecarDto.objects.filter((object) => object.id !== zone.id), geometryEntry],
		}));

		// Step 5.
		if (!mutated.ok) {
			return this.compensateFailedSidecarWrite(zone.id, existing !== null, notePath, snapshotText ?? '', mutated.error);
		}

		// Step 6.
		this.deps.index.upsert({
			id: zone.id,
			type: 'renovation-zone',
			path: notePath,
			projectId: zone.projectId,
			planId: zone.planId,
		});
		this.deps.echo.markFrontmatter(notePath, dto, supersedes);

		return ok({ entity: zone, version: { revision: nextRevision, observed: observeFrontmatter(dto) } });
	}

	/**
	 * Step 5: compensate according to what step 2 recorded — restore the snapshot for an
	 * update, DELETE the created note for an insert — then fail honestly. Runs INSIDE the
	 * entity queue (its caller holds it), so a restore cannot race the next writer.
	 */
	private async compensateFailedSidecarWrite(
		zoneId: ZoneId,
		wasUpdate: boolean,
		notePath: string,
		snapshotText: string,
		cause: RepositoryError,
	): Promise<Result<Loaded<Zone>, RepositoryError>> {
		const compensated = wasUpdate
			? await restoreNoteText(this.deps.vault, 'zone', notePath, snapshotText)
			: await this.deleteCreatedNote(notePath);
		if (!compensated.ok) {
			this.deps.logger.error(wasUpdate ? 'zone.update-compensation-failed' : 'zone.insert-compensation-failed', {
				id: zoneId,
				cause: compensated.error,
			});
		}
		return err(
			persistenceError(
				wasUpdate ? 'zone.sidecar-update-failed' : 'zone.sidecar-insert-failed',
				`The geometry entry for zone ${zoneId} could not be written; the note was compensated.`,
				cause,
			),
		);
	}

	delete(id: ZoneId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`zone:${id}`, async () => {
			const file = this.locate(id);
			// A vanished or unindexed note refuses exactly like a stale expectation.
			if (!file) return err(revisionConflict('zone', id));
			const conflict = checkExpectedVersion(
				'zone',
				id,
				versionOfFrontmatter(frontmatterOf(this.deps, file)),
				expected,
			);
			if (conflict) return err(conflict);

			// Delete's mirror of step 2: the full restore snapshot before ANY deletion.
			let snapshotText: string;
			try {
				snapshotText = await this.deps.vault.read(file);
			} catch (cause) {
				return err(persistenceError('zone.delete-failed', `Could not read zone note ${file.path}.`, cause));
			}
			const cachedPlan = frontmatterOf(this.deps, file)['plan'] as PlanId | undefined;
			if (!cachedPlan) {
				// A note of ours always declares its plan (the schema demands it); a hand
				// edit that removed it leaves us unable to locate the geometry entry.
				return err(persistenceError('zone.delete-failed', `Zone note ${file.path} does not declare its plan.`));
			}

			// Note FIRST: removing the sidecar entry first could leave a LIVE zone note
			// with no geometry, the worse and more confusing failure mode. Trash, not
			// deletion — a user's system setting decides whether a delete is recoverable.
			try {
				await this.deps.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('zone.delete-failed', `Could not delete zone note ${file.path}.`, cause));
			}

			const mutated =
				await this.geometry.mutate(cachedPlan, (sidecarDto) => ({
					...sidecarDto,
					objects: sidecarDto.objects.filter((object) => object.id !== id),
				}));

			// Compensate so a failed delete leaves NOTHING deleted — a caller's failed
			// Result must never mean "gone, and no undo entry for it".
			if (!mutated.ok) {
				const restored = await restoreNoteText(this.deps.vault, 'zone', file.path, snapshotText);
				if (!restored.ok) {
					this.deps.logger.error('zone.delete-compensation-failed', { id, cause: restored.error });
				}
				return err(
					persistenceError('zone.sidecar-remove-failed', `The geometry entry for zone ${id} could not be removed; the note was restored.`, mutated.error),
				);
			}

			this.deps.index.remove(id);
			this.deps.echo.forget(file.path);
			return ok(undefined);
		});
	}

	listByPlan(planId: PlanId): Promise<Result<Loaded<Zone>[], RepositoryError>> {
		return this.list(this.deps.index.getSpatialObjectIdsByPlan(planId) as ZoneId[]);
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<Zone>[], RepositoryError>> {
		// One map per project holds every entity kind; zones carry the zone- prefix.
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => String(id).startsWith('zone-')) as ZoneId[];
		return this.list(ids);
	}

	/**
	 * Every zone in the list, with each plan's geometry sidecar read exactly once.
	 *
	 * The memo is scoped to ONE call and thrown away with it — this is not a cache, and
	 * making it one would be a correctness change: a repository that remembered a document
	 * across calls would serve a stale sidecar after any write, including its own. Within a
	 * single listing there is nothing to go stale against, because nothing writes.
	 *
	 * Keyed by plan, not fixed to one, because `list` takes ids rather than a plan and
	 * `findByProject` hands it zones from several.
	 */
	private async list(ids: readonly ZoneId[]): Promise<Result<Loaded<Zone>[], RepositoryError>> {
		const sidecars = new Map<PlanId, ReturnType<SidecarReader>>();
		const readOnce: SidecarReader = (planId) => {
			const pending = sidecars.get(planId) ?? this.geometry.read(planId);
			sidecars.set(planId, pending);
			return pending;
		};

		const loaded: Loaded<Zone>[] = [];
		for (const id of ids) {
			const one = await this.loadOne(id, readOnce);
			if (!one.ok) return one;
			if (one.value) loaded.push(one.value);
		}
		return Promise.resolve(ok(loaded));
	}


	private async deleteCreatedNote(path: string): Promise<Result<void, PersistenceError>> {
		const created = this.deps.vault.getAbstractFileByPath(path);
		if (!(created instanceof TFile)) return ok(undefined);
		try {
			await this.deps.fileManager.trashFile(created);
			this.deps.echo.forget(path);
			return ok(undefined);
		} catch (cause) {
			return err(persistenceError('zone.restore-failed', `Could not remove the just-created note ${path}.`, cause));
		}
	}

	private locate(id: ZoneId): TFile | null {
		return fileAt(this.deps.vault, this.deps.index.getPath(id));
	}
}
