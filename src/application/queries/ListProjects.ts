import { isErr, ok, type Result } from '../../core/result/Result';
import type { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RepositoryError } from '../ports/repositoryErrors';

/**
 * Every project in the vault — the Renovation Project view's first read (design slice 14).
 *
 * A thin wrapper over `listAll()`, which slice 3 declared on the port and slice 4 implemented
 * ahead of any consumer, precisely so adding one is a query file rather than a port change.
 * Named `List*` per SDD §80, the same shape `ListAssets` follows.
 *
 * It hands back DOMAIN ENTITIES, not a DTO. `application/` may not name `presentation/`, and a
 * type belongs with the code that produces it — so the mapping to `ProjectSummaryDto` happens
 * in the read-model bundle the view is handed, beside every other `to*Dto`.
 *
 * The `Result` is passed through unflattened. `ok([])` and `isErr` are different facts: the
 * first is "this vault legitimately has no projects yet" and earns an empty state, the second
 * is a real problem that must never be rendered as one.
 */
export class ListProjects {
	constructor(private readonly projects: ProjectRepository) {}

	async execute(): Promise<Result<Project[], RepositoryError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;
		return ok(listed.value.loaded.map((loaded) => loaded.entity));
	}
}
