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
export const ENTITY_TYPES = [
	'renovation-project',
	'renovation-plan',
	'renovation-zone',
	'renovation-asset',
	'renovation-requirement',
	'renovation-asset-price',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Why a note this plugin owns is not in the index — decided where the exclusion is made and
 * carried from there, never reconstructed.
 *
 * `no-id` is a note of ours declaring no usable `id`; `duplicate-id` is a note whose id another
 * note already holds, which is a defect INVISIBLE from inside the note — open the loser and its
 * frontmatter looks entirely valid. A surface that can name the file and not say what is wrong
 * with it sends a user to stare at a correct-looking note, and neither reason is recoverable
 * from the descriptor's path afterwards: the first would need the frontmatter re-read and the
 * second would need every other note in the vault.
 */
export type ExclusionReason = 'no-id' | 'duplicate-id';

/**
 * A note this plugin owns that the index could not hold, as the index holds it instead.
 *
 * Keyed by PATH, which is the only stable identifier a note with no id has — and the one a
 * repair surface needs regardless, since opening the file is how a user fixes either defect.
 *
 * **The type is the EXCLUDED note's own, never that of whatever displaced it.** This index is
 * one global id namespace across projects, plans, zones, assets and requirements, so an asset
 * note and a project note declaring one id collide; filing the loser under the winner's type
 * puts an excluded asset into the repair list of the thing that displaced it. It is free at
 * both sides of a collision — `EntityRef.no-id` carries it for an arriving note, and an entry
 * already in the index carries its own — so nothing has to be re-read to get it right.
 */
export interface ExcludedNote {
	readonly path: string;
	readonly entityType: EntityType;
	readonly reason: ExclusionReason;
}

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
	getGeometrySidecarPath(entityId: EntityId<string>): string | undefined;
	getIdsByType(type: EntityType): EntityId<string>[];
	getIdsByProject(projectId: ProjectId): EntityId<string>[];
	/** Zones today; later spatial-object types extend the same mapping. */
	getSpatialObjectIdsByPlan(planId: PlanId): EntityId<string>[];

	/**
	 * The notes this index could not hold, in the order they were excluded.
	 *
	 * A second collection rather than a flag on `ProjectIndexEntry`, because an excluded note
	 * has no id to key an entry by: `no-id` says so in its name, and a `duplicate-id` loser
	 * shares its id with the winner, so an id-keyed home would hold at most one of them.
	 */
	listExclusions(): readonly ExcludedNote[];

	upsert(entry: ProjectIndexEntry): void;
	remove(id: EntityId<string>): void;
	/** Keyed by path, so re-excluding a note already excluded replaces its descriptor. */
	addExclusion(note: ExcludedNote): void;
	removeExclusion(path: string): void;
	/**
	 * Full replace, after a scan — BOTH collections, in one call.
	 *
	 * The exclusions are a required argument rather than a second method, because a rebuild
	 * that replaced the entries and left the descriptors is a surface reporting a collision
	 * the vault no longer has. One call cannot be half-remembered.
	 */
	rebuild(entries: readonly ProjectIndexEntry[], exclusions: readonly ExcludedNote[]): void;
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
