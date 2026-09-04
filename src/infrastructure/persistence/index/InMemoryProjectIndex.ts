import type { EntityId } from '../../../core/identity/EntityId';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { ExcludedNote, ProjectIndex, ProjectIndexEntry, EntityType } from '../../../application/ports/ProjectIndex';

/**
 * The one Project Index implementation. A pair of Maps per lookup axis, maintained
 * only through `upsert`/`remove`/`rebuild`, so no accessor can drift from what the
 * writers recorded.
 */
export class InMemoryProjectIndex implements ProjectIndex {
	private readonly byId = new Map<string, ProjectIndexEntry>();
	private readonly idsByType = new Map<EntityType, Set<string>>();
	private readonly idsByProject = new Map<string, Set<string>>();
	private readonly spatialIdsByPlan = new Map<string, Set<string>>();
	/**
	 * The notes that could not be indexed, keyed by path — a `Map` rather than an array so that
	 * re-excluding a path replaces its descriptor instead of listing it twice, and so that
	 * `removeExclusion` needs no scan. Insertion order is what `listExclusions` hands back, and
	 * the vault-change pipeline's promotion rule depends on nothing about it: it re-derives scan
	 * order from the vault, because THAT is what a full rebuild would agree with.
	 */
	private readonly excludedByPath = new Map<string, ExcludedNote>();

	getPath(id: EntityId<string>): string | undefined {
		return this.byId.get(id)?.path;
	}

	getGeometrySidecarPath(entityId: EntityId<string>): string | undefined {
		return this.byId.get(entityId)?.geometrySidecarPath;
	}

	getIdsByType(type: EntityType): EntityId<string>[] {
		return [...(this.idsByType.get(type) ?? [])] as EntityId<string>[];
	}

	getIdsByProject(projectId: ProjectId): EntityId<string>[] {
		return [...(this.idsByProject.get(projectId) ?? [])] as EntityId<string>[];
	}

	getSpatialObjectIdsByPlan(planId: PlanId): EntityId<string>[] {
		return [...(this.spatialIdsByPlan.get(planId) ?? [])] as EntityId<string>[];
	}

	listExclusions(): readonly ExcludedNote[] {
		return [...this.excludedByPath.values()];
	}

	upsert(entry: ProjectIndexEntry): void {
		const previous = this.byId.get(entry.id);
		if (previous) this.unindex(previous);
		this.byId.set(entry.id, entry);
		this.index(entry);
	}

	remove(id: EntityId<string>): void {
		const entry = this.byId.get(id);
		if (!entry) return;
		this.byId.delete(id);
		this.unindex(entry);
	}

	addExclusion(note: ExcludedNote): void {
		this.excludedByPath.set(note.path, note);
	}

	removeExclusion(path: string): void {
		this.excludedByPath.delete(path);
	}

	rebuild(entries: readonly ProjectIndexEntry[], exclusions: readonly ExcludedNote[]): void {
		this.byId.clear();
		this.idsByType.clear();
		this.idsByProject.clear();
		this.spatialIdsByPlan.clear();
		this.excludedByPath.clear();
		for (const entry of entries) {
			this.byId.set(entry.id, entry);
			this.index(entry);
		}
		for (const note of exclusions) this.excludedByPath.set(note.path, note);
	}

	entries(): readonly ProjectIndexEntry[] {
		return [...this.byId.values()];
	}

	private index(entry: ProjectIndexEntry): void {
		this.addTo(this.idsByType, entry.type, entry.id);
		if (entry.projectId) this.addTo(this.idsByProject, entry.projectId, entry.id);
		if (entry.planId) this.addTo(this.spatialIdsByPlan, entry.planId, entry.id);
	}

	private unindex(entry: ProjectIndexEntry): void {
		this.idsByType.get(entry.type)?.delete(entry.id);
		if (entry.projectId) this.idsByProject.get(entry.projectId)?.delete(entry.id);
		if (entry.planId) this.spatialIdsByPlan.get(entry.planId)?.delete(entry.id);
	}

	private addTo(map: Map<string, Set<string>>, key: string, id: string): void {
		const set = map.get(key);
		if (set) {
			set.add(id);
		} else {
			map.set(key, new Set([id]));
		}
	}
}
