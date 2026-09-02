import type { EntityId } from '../../core/identity/EntityId';
import type { PlanId } from '../../domain/plan/PlanId';
import type { AssetId } from '../../domain/asset/AssetId';
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
export const ENTITY_TYPES = [
	'renovation-project',
	'renovation-plan',
	'renovation-zone',
	'renovation-asset',
	'renovation-requirement',
] as const;
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
	/**
	 * ADR-011 for a plan and ADR-0014 for an asset: where that entity's `.rpgeo` actually sits.
	 *
	 * A PLAN's is never derived at read time — this mapping is the only way. An ASSET's has a
	 * derivable home under `<libraryFolder>/Geometry/`, so there the derivation survives as the
	 * repair path for an index that has not seen the file yet; `AssetGeometryStore.pathFor` is
	 * `this ?? derived`, which is ADR-011's own shape.
	 */
	getGeometrySidecarPath(entityId: PlanId | AssetId): string | undefined;
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
	 * Plan and ASSET entries: where that entity's `.rpgeo` sits.
	 *
	 * For a Plan it is set in the same upsert that records the note path — the writer has just
	 * created or resolved the file, so it is the only code that knows it — and a Plan entry
	 * missing it is a broken index rather than a Plan without geometry, the sidecar existing
	 * either way. For an ASSET it is written only by the two sidecar doors (the full scan's
	 * join and the vault-change pipeline), and its ABSENCE is ordinary: an asset nobody has
	 * designed has no sidecar, and one whose file the index has not reached yet resolves
	 * through the derivation instead.
	 */
	geometrySidecarPath?: string;
}
