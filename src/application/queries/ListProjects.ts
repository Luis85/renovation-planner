import { isErr, ok, type Result } from '../../core/result/Result';
import type { Project } from '../../domain/project/Project';
import type { ProjectRepository } from '../ports/ProjectRepository';
import type { RepositoryError } from '../ports/repositoryErrors';

/**
 * What the view needs in order to tell THREE situations apart, not two.
 *
 * `unreadable` is the query-side name for the port's `refused`: the port speaks of notes it
 * declined to load, and the view speaks of projects the user cannot see. Same number, and
 * the rename is deliberate rather than incidental — the two layers describe the same event
 * from the ends they own.
 */
export interface ProjectListResult {
	readonly projects: readonly Project[];
	readonly unreadable: number;
}

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
 * **Three outcomes, all distinct, and flattening any pair of them is a defect.** `isErr` is a
 * wholesale failure. `ok` with an empty list and `unreadable: 0` is "this vault legitimately
 * has no projects yet" and earns an empty state. `ok` with `unreadable > 0` is a vault holding
 * projects that could not be read — never an empty state, because onboarding copy telling the
 * user to create their first project would be both wrong and unactionable while five of theirs
 * sit unparseable on disk.
 */
export class ListProjects {
	constructor(private readonly projects: ProjectRepository) {}

	async execute(): Promise<Result<ProjectListResult, RepositoryError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;
		return ok({
			projects: listed.value.loaded.map((loaded) => loaded.entity),
			unreadable: listed.value.refused,
		});
	}
}
