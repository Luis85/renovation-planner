import type { EntityId } from '../../core/identity/EntityId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { ProjectId } from '../../domain/project/ProjectId';

/**
 * The persisted discriminators, as they appear in frontmatter and in the sidecar's
 * sibling index entries. Declared beside the port that indexes by them; the frontmatter
 * schemas restate each one as a literal because Zod cannot import application types.
 *
 * The ARRAY is the declaration and the union is derived from it, rather than the two
 * being written out separately: both the index builder and the vault-change pipeline need
 * to ask "is this string one of ours?" at runtime, and each previously kept its own copy
 * of the list — three spellings of one vocabulary, with nothing to notice them drifting.
 * Same shape as `UNITS`/`Units` in the settings module.
 */
export const ENTITY_TYPES = ['renovation-project', 'renovation-plan', 'renovation-zone'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * The single answer to "where is entity X" (SDD §47): no code path ever rescans the
 * Vault to find one file. Pure derived data — rebuildable from Vault contents alone.
 *
 * The read side is what repositories resolve paths through and what the vault-change
 * pipeline consults; the write side is used by the repositories themselves (a successful
 * save upserts synchronously, §42) and by `ProjectIndexBuilder`.
 */
export interface ProjectIndex {
	getPath(id: EntityId<string>): string | undefined;
	/** ADR-011: a sidecar path is never derived at read time; this mapping is the only way. */
	getGeometrySidecarPath(planId: PlanId): string | undefined;
	getIdsByType(type: EntityType): EntityId<string>[];
	getIdsByProject(projectId: ProjectId): EntityId<string>[];
	/** Zones today; later spatial-object types extend the same mapping. */
	getSpatialObjectIdsByPlan(planId: PlanId): EntityId<string>[];

	upsert(entry: ProjectIndexEntry): void;
	remove(id: EntityId<string>): void;
	/** Full replace, after a scan. */
	rebuild(entries: readonly ProjectIndexEntry[]): void;
	/** Everything currently held — how a rebuild's result and an incremental run are compared. */
	entries(): readonly ProjectIndexEntry[];
}

export interface ProjectIndexEntry {
	id: EntityId<string>;
	type: EntityType;
	path: string;
	projectId?: ProjectId;
	planId?: PlanId;
	/**
	 * Plan entries only: this Plan's sidecar path. Set in the same upsert that records
	 * the note path — the writer has just created or resolved the file, so it is the only
	 * code that knows it. A Plan entry missing it is a broken index, not a Plan without
	 * geometry (the sidecar exists either way).
	 */
	geometrySidecarPath?: string;
}
