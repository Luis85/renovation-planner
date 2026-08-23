import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { Project } from '../../../domain/project/Project';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { ProjectRepository } from '../../../application/ports/ProjectRepository';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { VersionedStore } from './VersionedStore';

/**
 * Map-backed stand-in for `ProjectRepository`, permanently maintained (SDD §72's
 * contract suites run against both this and slice 4's Obsidian-backed implementation).
 * Every method returns `Result` even where nothing can fail here, because the PORT is
 * the contract — a narrower signature would let a command compile against this fake
 * while failing against the real one. The conditional-write machinery is `VersionedStore`'s.
 */
export class InMemoryProjectRepository implements ProjectRepository {
	private readonly store = new VersionedStore<Project>();

	poke(id: ProjectId): void {
		this.store.poke(id);
	}

	getById(id: ProjectId): Promise<Result<Loaded<Project> | null, PersistenceError>> {
		return Promise.resolve(ok(this.store.get(id)));
	}

	save(
		project: Project,
		expected: Expected,
	): Promise<Result<Loaded<Project>, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.save(project.id, project, expected, 'project'));
	}

	delete(
		id: ProjectId,
		expected: EntityVersion,
	): Promise<Result<void, PersistenceError | ValidationError>> {
		return Promise.resolve(this.store.remove(id, expected, 'project'));
	}

	listAll(): Promise<Result<Loaded<Project>[], PersistenceError>> {
		return Promise.resolve(ok(this.store.values()));
	}
}
