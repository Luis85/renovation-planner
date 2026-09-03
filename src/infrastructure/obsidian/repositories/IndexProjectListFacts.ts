import { TFile, type Vault } from 'obsidian';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { ProjectListFacts, ProjectRowFacts } from '../../../application/ports/ProjectListFacts';
import type { ProjectId } from '../../../domain/project/ProjectId';

/**
 * One method is all this needs, and a narrow surface is what lets a test stand in for it
 * without a fake thinner than the real thing — `BackgroundVault` states the identical rule
 * for the background pipeline.
 */
export type FactsVault = Pick<Vault, 'getAbstractFileByPath'>;

/**
 * Which project an index entry belongs to: its `projectId` for everything a project owns, and
 * its own id for the `Project.md` entry, which carries no `projectId` at all.
 *
 * `undefined` for an entry belonging to no project — an ASSET, since design slice 19 took the
 * project id off the catalogue entirely. That arm is ordinary rather than defensive, which is
 * why `indexProjectListFacts.test.ts` drives an asset entry through it with the newest mtime
 * in its fixture: an ownerless entry attributed to whichever project was being answered for
 * would date every row from the last time anybody edited the shared library.
 */
function ownerOf(entry: ProjectIndexEntry): string | undefined {
	return entry.type === 'renovation-project' ? entry.id : entry.projectId;
}

/**
 * One entry per id ASKED ABOUT, which is the port's own contract: an absent entry and a zero
 * count read identically at the site that renders them, so a project the walk found nothing
 * for is stated as `{ 0, null }` rather than left out to mean "not asked".
 */
function answerFor(
	wanted: ReadonlySet<string>,
	plans: ReadonlyMap<string, number>,
	newest: ReadonlyMap<string, number>,
): ReadonlyMap<string, ProjectRowFacts> {
	const answer = new Map<string, ProjectRowFacts>();
	for (const id of wanted) {
		const mtime = newest.get(id);
		answer.set(id, {
			planCount: plans.get(id) ?? 0,
			lastWorked: mtime === undefined ? null : new Date(mtime).toISOString(),
		});
	}
	return answer;
}

/**
 * The Home surface's two commissioned facts, derived from the Project Index and the vault's
 * own file stats — `IndexLibraryOverlaps`'s shape for the same kind of question, in the same
 * directory, for the same reason: it is built from what the index already holds, and deriving
 * it one layer up would put a second answer where there should be one.
 *
 * **One walk of `entries()` for every project asked about.** The alternative —
 * `getIdsByProject` per project, then `getPath` per id — is a walk per project and answers the
 * same numbers, so it would pass every behavioural case here while being quadratic on the
 * vault this surface exists to make navigable. `indexProjectListFacts.test.ts` counts the
 * walks for that reason.
 *
 * **A project's OWN note is grouped by id, not by `projectId`.** A project note carries no
 * `project:` frontmatter key, so `buildProjectIndexEntries` leaves its entry's `projectId`
 * undefined — measured. Grouping on that field alone would make a project with no plans report
 * `lastWorked: null` while its `Project.md` sat there with a perfectly good mtime.
 *
 * **Per read bounds the staleness to the INDEX, not to the vault** — `IndexLibraryOverlaps`
 * carries that mechanism in full, and it is the same one here: a note moved in Obsidian's file
 * explorer reaches the index through the vault-change pipeline, and a folder moved does not
 * reach it at all until the next rebuild.
 */
export class IndexProjectListFacts implements ProjectListFacts {
	constructor(
		private readonly index: ProjectIndex,
		private readonly vault: FactsVault,
	) {}

	factsFor(projectIds: readonly ProjectId[]): ReadonlyMap<string, ProjectRowFacts> {
		const wanted = new Set<string>(projectIds);
		const plans = new Map<string, number>();
		const newest = new Map<string, number>();

		for (const entry of this.index.entries()) {
			const owner = ownerOf(entry);
			if (owner === undefined || !wanted.has(owner)) continue;

			if (entry.type === 'renovation-plan') plans.set(owner, (plans.get(owner) ?? 0) + 1);
			this.observeTouched(newest, owner, entry);
		}

		return answerFor(wanted, plans, newest);
	}

	/**
	 * The newest modification time this entry can account for, kept against its owner.
	 *
	 * BOTH the note and its geometry sidecar. A calibration writes the `.rpgeo` and touches no
	 * note at all — `Plan.calibration` is read-only through the sidecar and never appears in
	 * frontmatter, so the plan note's revision does not move — and an afternoon spent
	 * calibrating is exactly the afternoon `lastWorked` exists to report. The path is on the
	 * index entry already, so this costs a second stat on the entries that have one and
	 * nothing on the entries that do not.
	 *
	 * Extracted from `factsFor` rather than nested inside it because `npm run analyze` refused
	 * the nesting: two loops and three conditions in one function breached its cognitive
	 * threshold at 21. The seam is a real one — this is "what did this entry touch", which is
	 * the question the sidecar comment above is entirely about.
	 */
	private observeTouched(newest: Map<string, number>, owner: string, entry: ProjectIndexEntry): void {
		for (const path of [entry.path, entry.geometrySidecarPath]) {
			if (path === undefined) continue;
			const mtime = this.mtimeOf(path);
			if (mtime !== null && mtime > (newest.get(owner) ?? -Infinity)) newest.set(owner, mtime);
		}
	}

	/**
	 * `null` rather than a fallback for a path the vault cannot answer for — an index entry
	 * whose file is gone is a fact about the index being ahead of the vault, and dating a row
	 * from a file that is not there is worse than not dating it.
	 *
	 * `instanceof TFile` and not a null check, the same narrowing every sibling in this
	 * directory states: `getAbstractFileByPath` answers a `TFolder` too, and a folder has no
	 * `stat` at all.
	 */
	private mtimeOf(path: string): number | null {
		const file = this.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file.stat.mtime : null;
	}
}
