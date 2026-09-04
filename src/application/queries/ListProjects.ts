import { isErr, ok, type Result } from '../../core/result/Result';
import type { Project } from '../../domain/project/Project';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { LibraryOverlaps } from '../ports/LibraryOverlaps';
import type { ProjectListFacts, ProjectRowFacts } from '../ports/ProjectListFacts';
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
	/**
	 * The subset of `projects` whose derived folder overlaps the library folder (§83) — a
	 * state no command can refuse, since ADR-0013 derives that folder from where the
	 * project's own note sits and a user moves it by dragging in Obsidian's file explorer.
	 *
	 * Derived on every read and never recorded, which is what makes staleness, counting,
	 * retraction and session lifetime unrepresentable rather than handled: a user who drags
	 * the folder back is simply absent from the next answer.
	 *
	 * **The next answer, not the next moment.** The derivation reads the Project Index, and a
	 * folder moved in Obsidian's file explorer is not reported to that index — the vault
	 * listeners filter to `TFile`, as they have since slice 4 — so a row gains or loses the
	 * marker at the next index rebuild, at load or after a settings save, rather than as the
	 * drag lands. `IndexLibraryOverlaps`'s docblock carries the mechanism and why widening it
	 * belongs to the vault-change pipeline rather than to this query.
	 */
	readonly overlapping: readonly ProjectId[];
	/**
	 * The Home surface's two commissioned row facts (§8), one entry per project in `projects`.
	 *
	 * Answered in the SAME read as the list and the overlap markers, and for the identical
	 * reason `overlapping`'s own comment gives one field up: a second query would need a policy
	 * for "the list loaded but the counts did not", and the three facts travel together or fail
	 * together, leaving one failure mode to reason about instead of three.
	 */
	readonly facts: ReadonlyMap<string, ProjectRowFacts>;
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
	constructor(
		private readonly projects: ProjectRepository,
		private readonly overlaps: LibraryOverlaps,
		private readonly facts: ProjectListFacts,
	) {}

	async execute(): Promise<Result<ProjectListResult, RepositoryError>> {
		const listed = await this.projects.listAll();
		if (isErr(listed)) return listed;
		const projects = listed.value.loaded.map((loaded) => loaded.entity);
		return ok({
			projects,
			unreadable: listed.value.refused,
			// ONE query rather than two: a second would need a policy for "the list loaded
			// but the markers did not", and an advisory marker is exactly the thing whose
			// failure mode nobody would think about again. Answered here, the two facts
			// travel together or fail together, and there is one failure mode to reason about.
			overlapping: this.overlaps.overlapping(projects.map((project) => project.id)),
			// The same pairing, one port further: batched, so this is one walk of the index for
			// the whole list rather than a lookup per row.
			facts: this.facts.factsFor(projects.map((project) => project.id)),
		});
	}
}
