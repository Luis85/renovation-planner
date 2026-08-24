import { TFile, type FileManager, type Vault } from 'obsidian';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { EntityVersion } from '../../../application/ports/versioning';
import { checkExpectedVersion } from './versionCheck';
import { persistenceError } from './noteIo';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { PlanGeometrySchemaV1 } from '../../persistence/dto/planGeometry';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import { KeyedQueues } from './KeyedQueues';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import { observeSidecar } from './digest';

/** Key order follows construction order, which the schema fixes — deterministic writes. */
function canonicalJson(dto: PlanGeometryDTO): string {
	return JSON.stringify(dto, null, '\t');
}

function schemaVersionOf(parsed: unknown): number {
	if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed) {
		const value: unknown = parsed['schemaVersion'];
		if (typeof value === 'number') return value;
	}
	return 0;
}

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
	 * Plan-delete path only: removes the file; absence of the file is still success.
	 * `pathHint` covers the plan-INSERT rollback, where the sidecar was just created but
	 * the index mapping does not exist yet (it is upserted only on success).
	 */
	delete(planId: PlanId, pathHint?: string): Promise<Result<void, PersistenceError>> {
		return this.queues.run(`plan:${planId}`, async () => {
			const path = this.index.getGeometrySidecarPath(planId) ?? pathHint;
			if (!path) return ok(undefined);
			const file = this.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return ok(undefined);
			try {
				await this.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('plan-geometry.delete-failed', `Could not delete sidecar ${path}.`, cause));
			}
			this.echo.forget(path);
			return ok(undefined);
		});
	}

	read(planId: PlanId): Promise<Result<SidecarSnapshot, PersistenceError | ValidationError>> {
		return this.queues.run(`plan:${planId}`, () => this.readUnlocked(planId));
	}

	mutate(
		planId: PlanId,
		change: (dto: PlanGeometryDTO) => PlanGeometryDTO,
		expected?: EntityVersion,
	): Promise<Result<{ version: EntityVersion }, PersistenceError | ValidationError>> {
		return this.queues.run(`plan:${planId}`, async () => {
			const current = await this.readUnlocked(planId);
			if (!current.ok) return current;

			const conflict = expected
				? checkExpectedVersion('plan-geometry', String(planId), current.value.version, expected)
				: null;
			if (conflict) return err(conflict);

			const nextDto = change(current.value.dto);
			const nextRevision = current.value.version.revision + 1;
			const written = { ...nextDto, revision: nextRevision };
			const text = canonicalJson(written);

			const writeResult = await this.writeText(current.value.file, current.value.path, text);
			if (!writeResult.ok) return writeResult;

			return ok({ version: { revision: nextRevision, observed: observeSidecar(text) } });
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
			await this.vault.create(path, document);
		} catch (cause) {
			return err(persistenceError('plan-geometry.create-failed', `Could not create sidecar ${path}.`, cause));
		}
		this.echo.mark(path, observeSidecar(document));
		return ok(undefined);
	}

	/** MUST run inside the plan's queue — every caller here does. */
	private async readUnlocked(
		planId: PlanId,
	): Promise<Result<SidecarSnapshot, PersistenceError | ValidationError>> {
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

		let migrated: unknown;
		try {
			migrated = this.migrations.migrateToLatest('plan-geometry', parsed, schemaVersionOf(parsed));
		} catch (cause) {
			return err(persistenceError('plan-geometry.migration-failed', `Migrating sidecar ${path} failed.`, cause));
		}

		const validated = PlanGeometrySchemaV1.safeParse(migrated);
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

		return ok({
			dto: validated.data,
			version: { revision: validated.data.revision, observed: observeSidecar(rawText) },
			file: abstractFile,
			path,
		});
	}

	private async writeText(file: TFile, path: string, text: string): Promise<Result<void, PersistenceError>> {
		try {
			await this.vault.modify(file, text);
		} catch (cause) {
			return err(persistenceError('plan-geometry.write-failed', `Could not write sidecar ${path}.`, cause));
		}
		this.echo.mark(path, observeSidecar(text));
		return ok(undefined);
	}
}
