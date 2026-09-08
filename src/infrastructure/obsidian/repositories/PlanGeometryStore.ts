import { TFile, type FileManager, type Vault } from 'obsidian';
import type { MigrationError, PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { EntityVersion } from '../../../application/ports/versioning';
import { checkExpectedVersion, externalModification } from '../../../application/ports/versioning';
import { ensureFolder, fileStatAt, mappedMigrationFailure, persistenceError } from './noteIo';
import { parentOf } from './paths';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { PlanGeometrySchema, PlanGeometrySchemaV6 } from '../../persistence/dto/planGeometry';
import { validateSpatialGroups } from '../../../domain/spatial/SpatialGroup';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import { KeyedQueues } from './KeyedQueues';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import { observeSidecar } from './digest';
import { guardRenovationGeometry } from './renovationGeometryGuard';

/** Key order follows construction order, which the schema fixes — deterministic writes. */
function canonicalJson(dto: PlanGeometryDTO): string {
	return JSON.stringify(dto, null, '\t');
}

function writtenSchema(dto: Pick<PlanGeometryDTO, 'structure' | 'intended' | 'groups'>): 1 | 2 | 3 | 4 | 5 | 6 {
	if (dto.groups?.length) return 6;
	if ([dto.structure, dto.intended].some(structure => structure?.openings.some(opening => opening.swing !== undefined))) return 5;
	return dto.structure?.elements?.length || dto.intended?.elements?.length ? 4 : dto.intended ? 3 : dto.structure ? 2 : 1;
}

function validateSidecarContent(dto: PlanGeometryDTO): Result<void, ValidationError> {
	const zoneIds = dto.objects.map(object => object.id);
	for (const structure of [dto.structure, dto.intended]) {
		if (!structure) continue;
		const checked = validateStructure(structure, zoneIds);
		if (!checked.ok) return checked;
	}
	return validateSpatialGroups(dto.groups ?? [], { zoneIds, structure: dto.structure ?? EMPTY_STRUCTURE });
}

function schemaVersionOf(parsed: unknown): number {
	if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed) {
		const value: unknown = parsed['schemaVersion'];
		if (typeof value === 'number') return value;
	}
	return 0;
}

/** What a sidecar read can refuse with — the same vocabulary a note read carries. */
export type SidecarReadError = PersistenceError | ValidationError | MigrationError;

/** What a sidecar read hands back: the parsed document plus the version to write against. */
export interface SidecarSnapshot {
	readonly dto: PlanGeometryDTO;
	readonly version: EntityVersion;
	readonly file: TFile;
	readonly path: string;
}

/**
 * Geometry sidecar I/O (SDD §40, §42): shared by `ObsidianPlanRepository` (lifecycle:
 * create/delete the file) and `ObsidianZoneRepository` (content: upsert/remove one
 * entry). Every content change goes through `mutate` — a read-modify-write of one whole
 * file under that plan's own lock — because concurrent writers to one plan are a
 * lost-update hazard, not an ordering question. There is deliberately NO `write(planId,
 * dto)`: a bare setter is the lost update waiting for the first caller who reads the
 * signature and not the paragraph.
 *
 * The lock serializes at the STORE rather than at any caller so the guarantee holds for
 * every writer, including the vault-change pipeline and future spatial-object
 * repositories. Plans do not contend with each other.
 */
export class PlanGeometryStore {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly vault: Vault,
		private readonly fileManager: FileManager,
		private readonly index: ProjectIndex,
		private readonly migrations: MigrationRunner,
		private readonly echo: EchoWindow,
	) {}

	/** Plan-insert path only: creates the file at the derived path with empty content. */
	create(planId: PlanId, path: string): Promise<Result<void, PersistenceError>> {
		return this.queues.run(`plan:${planId}`, () => this.createLocked(planId, path));
	}

	/**
	 * The plan half of `AssetGeometryStore.declaredAssetOf`, and it answers three ways for the
	 * same reason: somebody else's, mine, or unreadable. Only the first is a refusal — a
	 * corrupt or schema-invalid `.rpgeo` is garbage, and refusing to delete it would leave a
	 * plan whose geometry file can never be cleaned up. `null` also covers the plan-INSERT
	 * rollback, whose file has been created and not yet written.
	 */
	private async declaredPlanOf(file: TFile): Promise<string | null> {
		try {
			const parsed: unknown = JSON.parse(await this.vault.read(file));
			// Either version as it sits on disk — this asks what the file DECLARES, before any migration.
			const validated = PlanGeometrySchema.safeParse(parsed);
			return validated.success ? validated.data.planId : null;
		} catch {
			return null;
		}
	}

	/**
	 * Plan-delete path only: removes the file; absence of the file is still success.
	 * `pathHint` covers the plan-INSERT rollback, where the sidecar was just created but
	 * the index mapping does not exist yet (it is upserted only on success).
	 *
	 * **The declared plan is checked first**, which this door had no half of while `read` had
	 * compared the declared `planId` since it was written: it derived a path, found a file and
	 * trashed it. A copied or hand-renamed `.rpgeo`, or two plan ids differing only in case on
	 * a case-insensitive filesystem, then destroyed the other plan's zones silently, with
	 * nothing to restore from. `AssetGeometryStore.delete` carries the same guard and the same
	 * asymmetry.
	 */
	delete(planId: PlanId, pathHint?: string): Promise<Result<void, PersistenceError>> {
		return this.queues.run(`plan:${planId}`, async () => {
			const path = this.index.getGeometrySidecarPath(planId) ?? pathHint;
			if (!path) return ok(undefined);
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return ok(undefined);
			const claimed = await this.declaredPlanOf(file);
			if (claimed !== null && claimed !== planId) {
				return err(
					persistenceError(
						'plan-geometry.plan-id-mismatch',
						`Sidecar ${path} declares plan ${claimed}, not ${planId}. It was not deleted.`,
					),
				);
			}
			try {
				await this.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('plan-geometry.delete-failed', `Could not delete sidecar ${path}.`, cause));
			}
			this.echo.forget(path);
			return ok(undefined);
		});
	}

	read(planId: PlanId): Promise<Result<SidecarSnapshot, SidecarReadError>> {
		return this.queues.run(`plan:${planId}`, () => this.readUnlocked(planId));
	}

	mutate(
		planId: PlanId,
		change: (dto: PlanGeometryDTO) => PlanGeometryDTO,
		expected?: EntityVersion,
	): Promise<Result<{ version: EntityVersion; beforeVersion: EntityVersion }, SidecarReadError>> {
		return this.queues.run(`plan:${planId}`, async () => {
			const current = await this.readUnlocked(planId);
			if (!current.ok) return current;

			const conflict = expected
				? checkExpectedVersion('plan-geometry', String(planId), current.value.version, expected)
				: null;
			if (conflict) return err(conflict);

			const nextDto = change(current.value.dto);
			const groups = validateSpatialGroups(nextDto.groups ?? [], { zoneIds: nextDto.objects.map(object => object.id), structure: nextDto.structure ?? EMPTY_STRUCTURE });
			if (!groups.ok) return groups;
			if (nextDto.structure) {
				const valid = validateStructure(nextDto.structure, nextDto.objects.map(object => object.id));
				if (!valid.ok) return valid;
			}
			const links = await guardRenovationGeometry({ vault: this.vault, index: this.index }, planId, current.value.dto, nextDto);
			if (!links.ok) return links;
			const nextRevision = current.value.version.revision + 1;
			if (nextDto.intended) {
				const valid = validateStructure(nextDto.intended, nextDto.objects.map(object => object.id));
				if (!valid.ok) return valid;
			}
			const written = { ...nextDto, schemaVersion: writtenSchema(nextDto), revision: nextRevision };
			const text = canonicalJson(written);

			const writeResult = await this.writeText(current.value.file, current.value.path, text, current.value.version);
			if (!writeResult.ok) return writeResult;

			return ok({ beforeVersion: current.value.version, version: { revision: nextRevision, observed: observeSidecar(text) } });
		});
	}

	private async createLocked(planId: PlanId, path: string): Promise<Result<void, PersistenceError>> {
		const document = canonicalJson({
			schemaVersion: 1,
			planId,
			revision: 1,
			unit: 'mm',
			calibration: null,
			objects: [],
		});
		try {
			// The FOLDER first, and this is not belt-and-braces: `vault.create` refuses when
			// its parent does not exist, and `Geometry/` is a folder nothing else creates —
			// the project, plans and zones folders each get an `ensureFolder` from the
			// repository that writes into them, and ADR-011 puts the sidecars in a folder of
			// their own that no note ever lands in. So on a fresh vault this was the first
			// write of the first plan ever saved, and it failed with "the geometry sidecar
			// could not be created". Reported from a real vault; invisible here until
			// `FakeVault.create` started refusing a missing parent the way Obsidian does.
			await ensureFolder(this.vault, parentOf(path));
			await this.vault.create(path, document);
		} catch (cause) {
			return err(persistenceError('plan-geometry.create-failed', `Could not create sidecar ${path}.`, cause));
		}
		// The stat is read with NOTHING awaited since the write above, which is what makes it a
		// statement about the file we wrote rather than about whatever is there now.
		this.echo.mark(path, observeSidecar(document), fileStatAt(this.vault, path));
		return ok(undefined);
	}

	/** MUST run inside the plan's queue — every caller here does. */
	private async readUnlocked(
		planId: PlanId,
	): Promise<Result<SidecarSnapshot, SidecarReadError>> {
		const path = this.index.getGeometrySidecarPath(planId);
		if (!path) {
			return err(persistenceError('plan-geometry.path-unresolved', `No sidecar path is indexed for plan ${planId}.`));
		}
		const abstractFile = this.vault.getAbstractFileByPath(path);
		if (!(abstractFile instanceof TFile)) {
			return err(persistenceError('plan-geometry.missing', `Sidecar ${path} does not exist.`));
		}
		let rawText: string;
		try {
			rawText = await this.vault.read(abstractFile);
		} catch (cause) {
			return err(persistenceError('plan-geometry.unreadable', `Could not read sidecar ${path}.`, cause));
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawText);
		} catch (cause) {
			return err(persistenceError('plan-geometry.corrupt', `Sidecar ${path} is not valid JSON.`, cause));
		}

		// A PRESENT but non-numeric version is malformed data, not an old document —
		// the same distinction `migrateNote` draws for notes (SDD §87 rule 7).
		if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed && typeof (parsed as Record<string, unknown>)['schemaVersion'] !== 'number') {
			return err({
				category: 'Validation',
				code: 'plan-geometry.schema-version-malformed',
				message: `Sidecar ${path} carries a non-numeric schemaVersion.`,
			});
		}

		let migrated: unknown;
		try {
			migrated = this.migrations.migrateToLatest('plan-geometry', parsed, schemaVersionOf(parsed));
		} catch (cause) {
			// The same vocabulary a note read refuses with: a future `schemaVersion` keeps
			// the runner's Migration category, anything else stays Persistence.
			return err(mappedMigrationFailure('plan-geometry', cause));
		}

		const validated = PlanGeometrySchemaV6.safeParse(migrated);
		if (!validated.success) {
			return err({
				category: 'Validation',
				code: 'plan-geometry.schema-invalid',
				message: `Sidecar ${path} failed validation: ${validated.error.issues.map((i) => i.message).join('; ')}`,
			});
		}

		// The filename join happened in the builder; THIS comparison is where a mismatch —
		// a hand-renamed file or a hand-edited planId — surfaces, never silently preferred.
		if (validated.data.planId !== planId) {
			return err(persistenceError('plan-geometry.plan-id-mismatch', `Sidecar ${path} declares plan ${validated.data.planId}, not ${planId}.`));
		}
		const content = validateSidecarContent(validated.data);
		if (!content.ok) return content;

		return ok({
			dto: { ...validated.data, schemaVersion: writtenSchema(validated.data) },
			version: { revision: validated.data.revision, observed: observeSidecar(rawText) },
			file: abstractFile,
			path,
		});
	}

	private async writeText(file: TFile, path: string, text: string, expected: EntityVersion): Promise<Result<void, SidecarReadError>> {
		try {
			let conflict = false;
			await this.vault.process(file, live => {
				if (observeSidecar(live) !== expected.observed) { conflict = true; return live; }
				return text;
			});
			if (conflict) return err(externalModification('plan-geometry', path));
		} catch (cause) {
			return err(persistenceError('plan-geometry.write-failed', `Could not write sidecar ${path}.`, cause));
		}
		// Nothing awaited between the `modify` and this reading — see `createLocked`.
		this.echo.mark(path, observeSidecar(text), fileStatAt(this.vault, path));
		return ok(undefined);
	}
}
