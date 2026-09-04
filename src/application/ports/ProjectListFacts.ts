import type { ProjectId } from '../../domain/project/ProjectId';

/**
 * The two facts a project ROW needs that a `Project` entity does not carry, commissioned by
 * the Renovation Planner Home design spec §8.
 *
 * **Facts about the READ, never stored ones** — the same shape and the same reason as
 * `LibraryOverlaps`: a derived answer makes staleness, counting and retraction
 * unrepresentable rather than handled. Nothing here is written to a note, so there is no
 * migration owed and nothing to reconcile when a user moves a file in Obsidian's own
 * explorer.
 *
 * SYNCHRONOUS by construction, again like `LibraryOverlaps`. Both facts fall out of the
 * Project Index — SDD §47's single answer to "where is entity X", already in memory — plus a
 * `TFile.stat` read, which Obsidian answers synchronously off its own file map. There is no
 * read to await and therefore no second failure mode for a caller to have a policy about.
 *
 * **ONE method answering BOTH, and one call answering every project.** `ListProjects` already
 * argues the pairing it made with `overlapping`: two reads would need a policy for "the list
 * loaded but the counts did not", and an advisory number's failure mode is exactly the thing
 * nobody would think about again. Batched because the answer comes from one walk of the
 * index — a per-project door would be quadratic on a vault with many projects, for nothing.
 */
export interface ProjectRowFacts {
	/**
	 * How many plans this project has. It is the fact that makes a row say something beyond
	 * its own name, and the one that tells a stranger what a project even contains.
	 */
	readonly planCount: number;
	/**
	 * ISO 8601, the most recent modification time across EVERY note the index holds for this
	 * project — its own `Project.md` included, and its zones and requirements too, not only
	 * its plans, and each plan's geometry sidecar beside its note. The spec's Constraint 2
	 * hands this choice to the query and this is it: a project whose whole afternoon went into
	 * drawing zones or calibrating a plan must move to the top, and with `Project.md` alone it
	 * never would.
	 *
	 * `null` when the index holds no path for this project that the vault can still answer
	 * for. Not a refusal — the row still has a name, a status and a currency to draw.
	 */
	readonly lastWorked: string | null;
}

export interface ProjectListFacts {
	/**
	 * One entry per id ASKED ABOUT, never a sparse map: an absent entry and a zero count read
	 * identically at the site that renders them, so this port states the answer for every id
	 * rather than leaving one of them silently meaning "not asked". That is
	 * `ProjectSummaryDto.libraryOverlap`'s own required-not-optional rule, one layer down.
	 */
	factsFor(projectIds: readonly ProjectId[]): ReadonlyMap<string, ProjectRowFacts>;
}
