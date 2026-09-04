import type { ProjectSummaryDto } from '../read-models/PlanDto';

/**
 * The Home surface's list order and its group split (design spec §8).
 *
 * **Here rather than in the query**, and the reason is a layer ban rather than taste: the
 * collation needs a language, `application/` may not resolve one, and `LANGUAGE_RESOLUTION_BAN`
 * refuses a second `getLanguage` call site anywhere in `src/`. The collator is a PARAMETER for
 * the same reason `t` takes a language — so a node test can ask this of German without a mock,
 * which is how the base-sensitivity case below is driven at all.
 *
 * **The order is frozen for the life of a mount, and that is a decision rather than an
 * omission.** `lastWorked` moves on every write to any owned note — the burst §8 says no
 * subscription should carry — so nothing here re-sorts on a timer or a zone save. It changes
 * when the view re-mounts (every navigation) or when one of `projectListChangeSource`'s events
 * fires a hydrate, and nowhere else. Re-sorting a list under a user's cursor because a
 * background leaf saved a zone is worse than a date a few minutes old.
 *
 * Module-private rather than exported: `isCompleted` below is the whole of what this task's
 * own callers (`ProjectList.vue`, its test) need, and `npm run analyze` refuses an export
 * with no consumer outside its own module — `tests/presentation/views/projectOrder.test.ts`
 * asks this set's two members through `isCompleted` rather than by name for that reason. A
 * later task that needs the raw set is free to export it once it has a real caller.
 */
const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['COMPLETE', 'AS_BUILT']);

/**
 * The two terminal lifecycle stages, which §5's region 5 collapses into their own group.
 *
 * An UNRECOGNISED status is not completed. `ProjectSummaryDto.status` is `string` so a note
 * this build cannot fully read still gets a row, and filing such a row into a collapsed group
 * would hide the one project whose state the user most needs to see.
 */
export function isCompleted(project: ProjectSummaryDto): boolean {
	return COMPLETED_STATUSES.has(project.status);
}

/**
 * One collator for the whole surface — the order below and the filter's own matching (Task 6)
 * ask the same question about two strings and must not answer it two ways.
 *
 * `sensitivity: 'base'` is what makes a German vault match `Küche` when the user types `kuche`,
 * and what makes `Ähre` collate before `Zimmer` rather than after every unaccented name.
 */
export function nameCollator(language: string): Intl.Collator {
	return new Intl.Collator(language, { sensitivity: 'base' });
}

/**
 * `lastWorked` descending, ties and nulls to name ascending. STABLE, so a re-hydrate never
 * reshuffles equal rows: `Array.prototype.toSorted` carries the same stability guarantee
 * `Array.prototype.sort` has had since ES2019, and returns a NEW array rather than sorting in
 * place — which is what is actually taken here, deliberately, because the caller's array is
 * the store's own.
 *
 * **`sortKeys` is what makes the order FROZEN, and without it the spec's own guarantee is
 * false.** §8 says "ordering must not change without a re-mount or one of those events", and
 * every hydrate recomputes `lastWorked` from live mtimes — so sorting on the DTO field directly
 * re-sorts the mounted rows whenever anything the project owns is written. Task 2 admits
 * `renovation-plan` to the entry filter for `planCount`, which makes a plan note MERELY MODIFIED
 * — edited in another leaf, or arriving through sync — a hydrate, and the row would move under
 * the user's cursor for a change that altered no count and no name.
 *
 * The caller therefore holds a per-mount `Map<projectId, lastWorked>`, captured the first time
 * each project is seen and never rewritten, and passes it here. A project absent from the map is
 * new to this mount and is inserted with its live value, so a created or synced project still
 * lands in its correct place; every project already on screen keeps the key it arrived with.
 *
 * **The map never EVICTS, and that is a stated consequence rather than an unexamined one.** A
 * project deleted and re-created under the same id within one mount is not "absent from the
 * map" — its id is still there, holding whatever `lastWorked` it carried before deletion — so
 * the re-created project inherits that frozen key rather than being treated as new. Consistent
 * with "captured on sight and never rewritten," and left as-is: the map's whole life is one
 * mount, this is the same id reappearing rather than session-spanning staleness, and evicting
 * on delete would need a delete EVENT this module has no subscription to receive.
 *
 * **Chosen over distinguishing structural plan changes from modifications**, which was the other
 * remedy on the table: `ProjectIndexEntryChangedPayload` carries `entityType` and nothing about
 * what happened to the entry, so that route needs a widened event before it can be written at
 * all — and it would still leave `lastWorked` re-sorting on a project-note modification, which is
 * the same defect through the arm that was never in question. Freezing the key closes both arms
 * and needs no new payload.
 */
export function orderProjects(
	projects: readonly ProjectSummaryDto[],
	collator: Intl.Collator,
	sortKeys: Map<string, string | null>,
): ProjectSummaryDto[] {
	// SEEDED BEFORE THE SORT, not lazily inside the comparator. `Array.prototype.toSorted`
	// (like `sort`) does not call a comparator at all for a list of one, so a vault with a
	// single project never captured its key — and the freeze then failed in the case it
	// exists for: that project's mtime moves during a later hydrate, a second project
	// arrives, and the FIRST comparison records the already-updated value as though it were
	// the mount's. Capturing on sight is the rule; a sort deciding which elements to look at
	// is not a schedule to hang it on.
	for (const project of projects) {
		if (!sortKeys.has(project.id)) sortKeys.set(project.id, project.lastWorked);
	}

	const keyOf = (project: ProjectSummaryDto): string | null => sortKeys.get(project.id) ?? null;
	return projects.toSorted((left, right) => {
		const leftKey = keyOf(left);
		const rightKey = keyOf(right);
		// A null is UNDATED, not "worked on at the epoch": it sorts to the tail rather than to
		// the head, and among nulls the name decides.
		if (leftKey !== rightKey) {
			if (leftKey === null) return 1;
			if (rightKey === null) return -1;
			// ISO 8601 in UTC sorts lexicographically, which is the whole reason the DTO carries
			// a string rather than a number: no parse, no timezone, no `Invalid Date`.
			return leftKey < rightKey ? 1 : -1;
		}
		return collator.compare(left.name, right.name);
	});
}
