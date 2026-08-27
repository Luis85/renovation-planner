import { ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { Project } from '../../../domain/project/Project';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { ProjectListing, ProjectRepository } from '../../../application/ports/ProjectRepository';
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

	/**
	 * `refused` is structurally 0 here, and that is not a stub standing in for real
	 * behaviour: this store holds already-valid entities in a Map, so there is no text to
	 * parse and nothing that can refuse. The non-zero arm belongs to the Obsidian
	 * implementation, where a note IS text, and is driven in
	 * `tests/infrastructure/obsidian/repositories/completion.test.ts`. The shared contract
	 * can only assert what both implementations are able to produce, which is why the
	 * refusal count is checked as zero there and as one only on the Obsidian side.
	 */
	listAll(): Promise<Result<ProjectListing, PersistenceError>> {
		return Promise.resolve(ok({ loaded: this.store.values(), refused: 0 }));
	}
}
