# Renovation Planner Home (the projects list) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the list state of `RenovationProjectView` as the launcher its design spec
locks — a filtered result list of project rows carrying a plan count, a lifecycle tick strip
and a last-worked order, with a `Continue` affordance, a keyboard model, and a foot line that
becomes the single home for `New asset`.

**Architecture:** Two DTO fields are commissioned first, through a new synchronous
`ProjectListFacts` port derived from the Project Index and the vault's own `TFile.stat` — the
shape `LibraryOverlaps` already established for a fact-about-the-read. Their invalidation is
widened at `createProjectListChangeSource` and nowhere else. Only then is the row built, and
only then the list around it. `ProjectList.vue` stays the component the view hands a
`readonly ProjectSummaryDto[]` and gets an id back from: the emit-don't-dispatch division is
untouched, and every new affordance emits too.

**Tech Stack:** TypeScript, Vue 3 (`<script setup>`, no `<style>` blocks), Pinia, Vitest +
jsdom + `@vue/test-utils`, Obsidian 1.13.0 API, CSS partials under `styles/` assembled by
`scripts/styles-assemble.mjs`.

**Spec:** [`docs/user-experience/renovation-planner-home-DESIGN-SPEC.md`](../../user-experience/renovation-planner-home-DESIGN-SPEC.md)

## Decisions this plan locks that the spec left open (§14)

The spec's section 14 leaves three decisions open. All three were put to the user and are
settled here; a task that contradicts one of these is wrong, not a judgement call.

1. **`New project` is a REGISTERED COMMAND**, not a pane-local key handler — `addCommand` in
   `src/plugin/`, so Obsidian owns the binding, the user can rebind it, and it appears in the
   palette. Task 9 builds it, with **no default hotkey**: declaring one would claim `Mod+N` on
   every install over whatever the user already had there.

   **The key legend therefore does not name it**, which is a consequence of that choice rather
   than a second decision. With no default binding, a legend reading `{mod}N new project` would
   advertise a key that does nothing until the user goes and binds it; and reading back what
   they *did* bind is not available, because Obsidian's hotkey registry is internal and this
   plugin may not reach the global `app`. The legend names the two pane-local accelerators that
   are true on a fresh install, and the command is discoverable in the palette, which is where
   §14 says the stranger looks. This narrows the spec's §7 legend and §12's
   `view.project.keys`; Task 13 amends both.
2. **`Continue` stores `{ projectId, planId }` and restores by navigating THIS leaf** — it
   never reclaims a leaf by identity, so section 14's "restoring into a leaf Obsidian has
   already restored differently" cannot arise: there is no leaf id stored to be wrong about.
   Surviving a restart follows for free. Tasks 10 and 11 build it.
3. **The filter matches the project NAME only.** Not the status word. The count stays
   unambiguous about what matched.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the
spec and from `CLAUDE.md`.

- **`npm run check` is the definition of done** — build + lint (oxlint then ESLint) +
  coverage-thresholded tests + fallow. All four, before every commit.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches) and the headroom is
  roughly ONE covered unit on branches and on functions. Plan the test with the code. An
  unreachable guard is not free — do not add one.
- **No `<style>` block in any `.vue` file, ever.** `vue/no-restricted-block` fails one. Rules go
  in a `styles/` partial imported from `styles/index.css`, under the 400-line cap.
- **No colour literal at any nesting depth**, a bare colour word included. Every colour is an
  Obsidian `var(--…)`. `scripts/styles-assemble.mjs` fails the build on one.
- **Every rule that competes with Obsidian's `button:not(.clickable-icon)` is written with a
  descendant selector.** That rule is (0,1,1) and sets `background-color`, `color` and
  `box-shadow`; a single class is (0,1,0) and loses silently.
  `tests/build/buttonSpecificity.test.ts` refuses the loss.
- **`New project` is NOT a filled accent button.** `--text-on-accent` over
  `--interactive-accent` measures **3.43:1** in Obsidian's light default, under AA for text.
  The accent appears only on focus rings, where WCAG 1.4.11's 3:1 non-text bar applies.
- **Focus rings are stated per control**, `2px solid var(--interactive-accent)`. Obsidian's
  global `:focus { outline: none }` reaches every control and its own `:focus-visible` shadow
  measures 2.29:1 dark and 1.88:1 light — both under 3:1. Offset is **positive on inset
  controls and negative on edge-to-edge rows**.
- **No status carried by colour**, at any breakpoint, including the one where the tick strip is
  dropped.
- **No cross-project number, anywhere.** No combined budget, no portfolio total, no
  "4 projects, €61,000 planned".
- **No field renders a number the read model cannot supply.** Budget and progress render
  nothing until a query supplies them. Do not approximate either.
- **Every user-facing string resolves through `t`/`tr`.** `en.ts` is the complete table and
  derives `StringKey`; `de.ts` is partial and falls back per key.
  `tests/presentation/i18n/strings.test.ts` requires a key's German translation to name the
  same `{holes}` as its English one.
- **`t` has no plural machinery.** A count that can be one gets TWO keys and the component
  picks by `count === 1`.
- **Layer bans are lint.** `presentation/` may not import `infrastructure/` or `plugin/`;
  `application/` may not name `presentation/`; `core`/`domain`/`application` may not name
  `vue`, `pinia`, `konva` or `obsidian`. Nothing writes to the vault outside `infrastructure/`.
- **`max-lines` is 400 for `src/**`** (blanks and comments skipped), `max-lines-per-function`
  100.
- **A view type and a command id are DATA.** Renaming one orphans a user's hotkey or a
  persisted workspace layout.
- **A docblock saying "the only place X" gets a `grep` in the SAME edit**, and the sentence is
  written from what the grep printed.
- **Commit messages end with:**
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
  ```

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/application/ports/ProjectListFacts.ts` | The port: per-read facts a project ROW needs that a `Project` entity does not carry — plan count and last-worked. Synchronous, batch, index-derived. |
| `src/infrastructure/obsidian/repositories/IndexProjectListFacts.ts` | That port over `ProjectIndex` + the vault's `getAbstractFileByPath`. ONE pass over `index.entries()` answers both facts for every requested project. |
| `src/presentation/views/projectStatusStage.ts` | `ProjectStatus` → its 0-based position in the lifecycle arc, or `null` for a value this build does not recognise. |
| `src/presentation/views/projectOrder.ts` | The list's order: `lastWorked` descending, ties and nulls to name ascending through one `Intl.Collator`. Pure. |
| `src/presentation/views/projectFilter.ts` | Name matching (substring, base sensitivity) and the matched-run split the highlight renders from. Pure. |
| `src/presentation/views/ProjectRow.vue` | One project as a row: name, facts, status word + tick strip, §83 marker. Emits `open`. |
| `src/presentation/views/ProjectFilter.vue` | The filter line: input, visually-hidden label, and the count that is the pane's state line. |
| `src/presentation/views/ContinueRow.vue` | The resolved continue context as a row in the same armature, carrying two actions. |
| `src/presentation/views/continueContext.ts` | The presentation-side shape of a continue context and its parse-or-absent rule. |
| `src/plugin/continueContextStore.ts` | The plugin-local FILE beside `data.json` holding it. Not `settingsFrom`, which drops undeclared keys. |
| `src/prototypes/StatusTicks.vue` | All ten lifecycle stages side by side — the only place stages other than one are ever drawn, so a capture can settle that they read. |
| `styles/project-list.css` | Every rule this surface adds: the filter line, the groups, the facts slot, the tick strip, the foot line, and the narrow container query. |
| `docs/tests/cases/Find and resume a project.md` | What only a live vault verifies: contrast, the focus ring, the 24px floor, `Mod+↵`, and whether Continue restores what it claims. |

**Modified**

| File | Change |
|---|---|
| `src/presentation/read-models/PlanDto.ts` | `ProjectSummaryDto` gains `planCount: number` and `lastWorked: string \| null`, both REQUIRED; `toProjectSummaryDto` gains the parameter that supplies them. |
| `src/application/queries/ListProjects.ts` | Takes the new port; `ProjectListResult` gains `facts`. |
| `src/presentation/read-models/renovationProjectQueries.ts` | Maps `facts` onto the two DTO fields at both doors that mint a `ProjectSummaryDto`. |
| `src/application/events/projectListChangeSource.ts` | `PlanCreated` on the category list; `renovation-plan` admitted beside `renovation-project` in the entry filter. |
| `src/presentation/views/ProjectList.vue` | Becomes the whole list state: header, filter, Continue group, `Projects`, `Completed`, the no-match block, the foot line. |
| `src/presentation/views/ViewRoot.vue` | Drops `.rp-view-aside`; passes the continue context and the new emits through. |
| `src/presentation/views/RenovationProjectContext.ts` | `RenovationProjectDeps` gains `continueContext` and `rememberContinue`. |
| `src/plugin/composition-root.ts`, `src/plugin/repositoryComposition.ts` | Compose `IndexProjectListFacts`; hand the continue store's two doors down. |
| `src/plugin/RenovationPlannerPlugin.ts` | Registers the `new-project` command; owns the continue store instance. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | The fifteen new keys. |
| `styles/index.css` | Imports `./project-list.css` directly after `./forms.css`. |
| `tests/harness/page.ts`, `tests/harness/fixture.ts` | Fixture projects gain the two fields and a continue context, so the harness can draw every state. |
| `CLAUDE.md` | The surface's new account, per this repository's own habit. |

**Ordering rationale.** Phase A (tasks 1–2) ships the read model with nothing rendering it, so
the row is never built against placeholders it then has to be rebuilt around — the spec's own
build order item 3. Phase C builds the row before the list around it. Continue is last of the
behaviour phases because it is the only region needing new persistence, and every other region
is complete without it.

---

## Task 1: The two commissioned facts, end to end

The spec commissions `planCount` and `lastWorked` (§8). Both are facts about the READ that
produced them — exactly like `libraryOverlap` — so both follow `LibraryOverlaps`: a synchronous
batch port answered from the Project Index, composed in `plugin/`, required rather than optional
on the DTO.

**One port with one method, not two ports.** Both facts fall out of a single pass over
`index.entries()`, and `ListProjects`'s own comment argues the case for the pairing it already
made with `overlapping`: two reads would need a policy for "the list loaded but the counts did
not", and one of them is exactly the failure nobody would think about again.

**`lastWorked` is the max mtime across every note the index holds for that project**, not
`Project.md` alone — the spec's Constraint 2 hands this decision to the query and this is it. A
project whose whole Saturday was spent drawing zones must move; with `Project.md` alone it never
would. The cost is bounded because the walk is over `entries()` ONCE for the whole answer, so it
is O(total notes) per read rather than O(projects × notes).

**Files:**
- Create: `src/application/ports/ProjectListFacts.ts`
- Create: `src/infrastructure/obsidian/repositories/IndexProjectListFacts.ts`
- Modify: `src/application/queries/ListProjects.ts`
- Modify: `src/presentation/read-models/PlanDto.ts`
- Modify: `src/presentation/read-models/renovationProjectQueries.ts`
- Modify: `src/plugin/repositoryComposition.ts`
- Test: `tests/infrastructure/persistence/indexProjectListFacts.test.ts`
- Test: `tests/application/queries/listProjects.test.ts` (existing — extend)
- Test: `tests/presentation/read-models/renovationProjectQueries.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `ProjectIndex` (`entries()`, `getPath`), `Pick<Vault, 'getAbstractFileByPath'>`,
  `ProjectId`.
- Produces:
  - `interface ProjectRowFacts { readonly planCount: number; readonly lastWorked: string | null }`
  - `interface ProjectListFacts { factsFor(projectIds: readonly ProjectId[]): ReadonlyMap<string, ProjectRowFacts> }`
  - `ProjectListResult.facts: ReadonlyMap<string, ProjectRowFacts>`
  - `ProjectSummaryDto.planCount: number`, `ProjectSummaryDto.lastWorked: string | null`
  - `toProjectSummaryDto(project, libraryOverlap, facts: ProjectRowFacts)`

- [ ] **Step 1: Write the failing port test**

Create `tests/infrastructure/persistence/indexProjectListFacts.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { IndexProjectListFacts } from '../../../src/infrastructure/obsidian/repositories/IndexProjectListFacts';
import type { ProjectIndexEntry } from '../../../src/application/ports/ProjectIndex';
import type { ProjectId } from '../../../src/domain/project/ProjectId';

const P1 = 'project-1' as ProjectId;
const P2 = 'project-2' as ProjectId;

/**
 * A project note carries no `project:` frontmatter key, so `buildProjectIndexEntries` leaves
 * its own entry's `projectId` UNDEFINED — measured, not assumed. An implementation that
 * grouped on `projectId` alone would therefore never see a project's own `Project.md`, which
 * is the one note whose mtime a project with no plans has.
 */
const ENTRIES = [
	{ id: P1, type: 'renovation-project', path: 'R/One/Project.md' },
	{ id: 'plan-a', type: 'renovation-plan', path: 'R/One/Plan/a.md', projectId: P1 },
	{ id: 'plan-b', type: 'renovation-plan', path: 'R/One/Plan/b.md', projectId: P1 },
	{ id: 'zone-a', type: 'renovation-zone', path: 'R/One/Zone/a.md', projectId: P1 },
	{ id: P2, type: 'renovation-project', path: 'R/Two/Project.md' },
] as ProjectIndexEntry[];

const MTIMES: Record<string, number> = {
	'R/One/Project.md': 1_000,
	'R/One/Plan/a.md': 2_000,
	'R/One/Plan/b.md': 3_000,
	// The most recent note in project One is a ZONE, not its Project.md and not a plan.
	'R/One/Zone/a.md': 9_000,
	'R/Two/Project.md': 5_000,
};

function facts(paths: Record<string, number> = MTIMES): IndexProjectListFacts {
	const index = {
		entries: () => ENTRIES,
	} as unknown as Parameters<typeof IndexProjectListFacts.prototype.constructor>[0];
	const vault = {
		getAbstractFileByPath: (path: string) =>
			path in paths ? { stat: { mtime: paths[path] } } : null,
	};
	return new IndexProjectListFacts(index, vault as never);
}

describe('IndexProjectListFacts', () => {
	it('counts only plan entries, and only that project’s', () => {
		const answer = facts().factsFor([P1, P2]);

		expect(answer.get(P1)?.planCount).toBe(2);
		expect(answer.get(P2)?.planCount).toBe(0);
	});

	it('takes lastWorked from the most recent note of ANY type the project owns', () => {
		const answer = facts().factsFor([P1]);

		expect(answer.get(P1)?.lastWorked).toBe(new Date(9_000).toISOString());
	});

	it('includes the project’s own note, whose entry carries no projectId', () => {
		// P2 owns nothing but its Project.md. Grouping on `projectId` alone answers null here.
		const answer = facts().factsFor([P2]);

		expect(answer.get(P2)?.lastWorked).toBe(new Date(5_000).toISOString());
	});

	it('answers an entry for every id asked about, including one the index cannot place', () => {
		const answer = facts().factsFor([P1, 'project-gone' as ProjectId]);

		// Never `undefined` at a `.get`: the caller maps a required DTO field off this, and an
		// absent entry and a zero count read identically at the site that renders them.
		expect(answer.get('project-gone')).toEqual({ planCount: 0, lastWorked: null });
	});

	it('reads lastWorked as null when the vault has no file at an indexed path', () => {
		// An index entry whose file is gone is not a reason to refuse the whole row: the
		// project still has a name, a status and a currency to draw.
		const answer = facts({ 'R/One/Plan/a.md': 2_000 }).factsFor([P1]);

		expect(answer.get(P1)).toEqual({ planCount: 2, lastWorked: new Date(2_000).toISOString() });
	});

	it('walks the index once regardless of how many projects are asked about', () => {
		let walks = 0;
		const index = {
			entries: () => {
				walks += 1;
				return ENTRIES;
			},
		};
		const vault = { getAbstractFileByPath: (path: string) => ({ stat: { mtime: MTIMES[path] ?? 0 } }) };

		new IndexProjectListFacts(index as never, vault as never).factsFor([P1, P2]);

		// The whole reason this is a BATCH port rather than a per-row lookup. A per-project
		// walk passes every case above and is quadratic on a vault with many projects.
		expect(walks).toBe(1);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/infrastructure/persistence/indexProjectListFacts.test.ts`
Expected: FAIL — `Failed to resolve import ".../IndexProjectListFacts"`.

- [ ] **Step 3: Write the port**

Create `src/application/ports/ProjectListFacts.ts`:

```typescript
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
	 * How many plans this project has. Renders as `2 plans`; it is the fact that makes a row
	 * say something beyond its own name, and the one that tells a stranger what a project
	 * even contains.
	 */
	readonly planCount: number;
	/**
	 * ISO 8601, the most recent modification time across EVERY note the index holds for this
	 * project — its own `Project.md` included, and its zones and requirements too, not only
	 * its plans. The spec's Constraint 2 hands this choice to the query and this is it: a
	 * project whose whole afternoon went into drawing zones must move to the top, and with
	 * `Project.md` alone it never would.
	 *
	 * `null` when the index holds no path for this project that the vault can still answer
	 * for. Not a refusal — the row still has a name, a status and a currency to draw, and
	 * `projectOrder` sorts a null to the name-ascending tail rather than to the top.
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
```

- [ ] **Step 4: Write the implementation**

Create `src/infrastructure/obsidian/repositories/IndexProjectListFacts.ts`:

```typescript
import type { Vault } from 'obsidian';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { ProjectListFacts, ProjectRowFacts } from '../../../application/ports/ProjectListFacts';
import type { ProjectId } from '../../../domain/project/ProjectId';

/**
 * The Home surface's two commissioned facts, derived from the Project Index and the vault's
 * own file stats — `IndexLibraryOverlaps`'s shape for the same kind of question, in the same
 * directory, for the same reason: it is built from what the index already holds, and deriving
 * it one layer up would put a second answer where there should be one.
 *
 * **`FactsVault` is a `Pick`, not the whole `Vault`.** One method is all this needs, and a
 * narrow surface is what lets a test stand in for it without a fake thinner than the real
 * thing — `BackgroundVault` states the identical rule for the background pipeline.
 *
 * **One walk of `entries()` for every project asked about.** The alternative — `getIdsByProject`
 * per project, then `getPath` per id — is a walk per project and answers the same numbers, so
 * it would pass every behavioural case here while being quadratic on the vault this surface
 * exists to make navigable. `indexProjectListFacts.test.ts` counts the walks for that reason.
 *
 * **A project's OWN note is grouped by id, not by `projectId`.** A project note carries no
 * `project:` frontmatter key, so `buildProjectIndexEntries` leaves its entry's `projectId`
 * undefined — measured. Grouping on that field alone would make a project with no plans report
 * `lastWorked: null` while its `Project.md` sat there with a perfectly good mtime.
 */
export type FactsVault = Pick<Vault, 'getAbstractFileByPath'>;

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
			if (owner === null || !wanted.has(owner)) continue;

			if (entry.type === 'renovation-plan') plans.set(owner, (plans.get(owner) ?? 0) + 1);

			const mtime = this.mtimeOf(entry.path);
			if (mtime !== null && mtime > (newest.get(owner) ?? -Infinity)) newest.set(owner, mtime);
		}

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
	 * `null` rather than a fallback for a path the vault cannot answer for — an index entry
	 * whose file is gone is a fact about the index being ahead of the vault, and dating a row
	 * from a file that is not there is worse than not dating it.
	 */
	private mtimeOf(path: string): number | null {
		const file = this.vault.getAbstractFileByPath(path);
		// A `TFolder` has no `stat`, and `getAbstractFileByPath` answers either. Reading the
		// property rather than `instanceof TFile` keeps this testable without constructing one
		// of Obsidian's own classes — the fake would have to be an instance, which is a fake
		// thinner than the real thing in the one direction that matters here.
		const mtime = (file as { stat?: { mtime?: number } } | null)?.stat?.mtime;
		return typeof mtime === 'number' ? mtime : null;
	}
}

/**
 * Which project an index entry belongs to: its `projectId` for everything a project owns, and
 * its own id for the `Project.md` entry, which carries no `projectId` at all.
 */
function ownerOf(entry: ProjectIndexEntry): string | null {
	if (entry.type === 'renovation-project') return entry.id;
	return entry.projectId ?? null;
}
```

- [ ] **Step 5: Run the port test to verify it passes**

Run: `npx vitest run tests/infrastructure/persistence/indexProjectListFacts.test.ts`
Expected: PASS, 6 cases.

- [ ] **Step 6: Widen `ListProjects` and its result**

In `src/application/queries/ListProjects.ts`, add the import, the field and the constructor
argument:

```typescript
import type { ProjectListFacts, ProjectRowFacts } from '../ports/ProjectListFacts';
```

Add to `ProjectListResult`, after `overlapping`:

```typescript
	/**
	 * The Home surface's two commissioned row facts, one entry per project in `projects`.
	 *
	 * Answered in the SAME read as the list and the overlap markers, and for the identical
	 * reason `overlapping`'s own comment gives: a second query would need a policy for "the
	 * list loaded but the counts did not", and the three facts travel together or fail
	 * together, leaving one failure mode to reason about instead of three.
	 */
	readonly facts: ReadonlyMap<string, ProjectRowFacts>;
```

Add the constructor parameter and the result member:

```typescript
	constructor(
		private readonly projects: ProjectRepository,
		private readonly overlaps: LibraryOverlaps,
		private readonly facts: ProjectListFacts,
	) {}
```

```typescript
			return ok({
				projects,
				unreadable: listed.value.refused,
				overlapping: this.overlaps.overlapping(projects.map((project) => project.id)),
				facts: this.facts.factsFor(projects.map((project) => project.id)),
			});
```

- [ ] **Step 7: Widen the DTO**

In `src/presentation/read-models/PlanDto.ts`, add to `ProjectSummaryDto` after `libraryOverlap`:

```typescript
	/**
	 * How many plans this project has (Home spec §8). REQUIRED rather than optional, for the
	 * reason `libraryOverlap` states one field up: an absent field and a zero read identically
	 * at the site that renders them, so every producer of a summary states the answer.
	 */
	readonly planCount: number;
	/**
	 * ISO 8601, the most recent modification time across the project's own notes, or `null`
	 * when the vault could answer for none of them. It ORDERS the list (`projectOrder.ts`) and
	 * it is what `Continue` dates itself by.
	 *
	 * An ABSOLUTE date at the render, never a relative one: a relative time needs a live
	 * ticker and makes every test time-dependent, and `Last opened yesterday` is a wireframe's
	 * nicety rather than a requirement.
	 */
	readonly lastWorked: string | null;
```

Find `toProjectSummaryDto` and widen it. It currently takes `(project, libraryOverlap)`:

```typescript
export function toProjectSummaryDto(
	project: Project,
	libraryOverlap: boolean,
	facts: ProjectRowFacts,
): ProjectSummaryDto {
	return {
		id: project.id,
		name: project.name,
		status: project.status,
		currency: project.currency,
		libraryOverlap,
		planCount: facts.planCount,
		lastWorked: facts.lastWorked,
	};
}
```

with `import type { ProjectRowFacts } from '../../application/ports/ProjectListFacts';` added.

**A required third parameter, not an optional one.** Every existing call site becomes a build
error until somebody decides what to pass — which is what found the second door below. An
optional parameter would have compiled at both and left one of them silently answering `0`
about a project it never counted.

- [ ] **Step 8: Run the build to see every call site the compiler names**

Run: `npm run build`
Expected: FAIL, naming `createRenovationProjectQueries`'s two `toProjectSummaryDto` calls and
`ListProjects`'s construction in `repositoryComposition.ts`. Read the list — it is the
authoritative set of places this field has to be decided.

- [ ] **Step 9: Map the facts at both query doors**

In `src/presentation/read-models/renovationProjectQueries.ts`, add the import:

```typescript
import type { ProjectListFacts, ProjectRowFacts } from '../../application/ports/ProjectListFacts';
```

Add a module-level constant and use it at both doors:

```typescript
/**
 * What a project the facts port did not answer for gets. It cannot happen through
 * `listProjects` — the port answers one entry per id asked about — and it CAN through
 * `getProject`, which asks the port for one id that the index may not place.
 *
 * Zero and null rather than a refusal: the detail state draws neither field today, and a row
 * with an unknown plan count still has a name, a status and a currency worth drawing.
 */
const NO_FACTS: ProjectRowFacts = { planCount: 0, lastWorked: null };
```

In `listProjects`, replace the mapping:

```typescript
				return ok({
					projects: found.value.projects.map((project) =>
						toProjectSummaryDto(
							project,
							overlapping.has(project.id),
							found.value.facts.get(project.id) ?? NO_FACTS,
						),
					),
					unreadable: found.value.unreadable,
				});
```

Add `facts: ProjectListFacts` as a fifth parameter of `createRenovationProjectQueries`, and in
`getProject` replace the final return:

```typescript
				const [overlapping] = overlaps.overlapping([found.value.entity.id]);
				// ASKED rather than fabricated, exactly as `libraryOverlap` is one line up and
				// for the same reason that comment gives: this door answers the same DTO type,
				// so hard-coding `0` here would be a statement about a project this function
				// never counted — a lie that is safe today only because the detail state draws
				// neither field, and a defect with no failing test in front of it the day it does.
				const facts = this.facts.factsFor([found.value.entity.id]).get(found.value.entity.id);
				return ok(toProjectSummaryDto(found.value.entity, overlapping !== undefined, facts ?? NO_FACTS));
```

(Written as a plain `facts.factsFor(...)` — the bundle is a closure over parameters, not a
class, so there is no `this`. Use the parameter name directly.)

- [ ] **Step 10: Compose the port**

In `src/plugin/repositoryComposition.ts`, add the import and the member:

```typescript
import { IndexProjectListFacts } from '../infrastructure/obsidian/repositories/IndexProjectListFacts';
```

Beside the `overlaps:` line in the same returned object:

```typescript
		// The Home surface's two commissioned row facts, composed here beside `overlaps` for
		// the reason that line gives: this is the bundle built from `deps.index`, and the vault
		// is already in scope. A `Pick` of it travels, not the whole `Vault`.
		listFacts: new IndexProjectListFacts(deps.index, deps.vault),
```

Then follow the compiler: `ListProjects` is constructed with a third argument, and
`createRenovationProjectQueries` is called with a fifth in `composition-root.ts`
(`persistence.listFacts`). Read `repositoryComposition.ts`'s own `deps` shape first — if it
carries no `vault`, thread the one `composeGuarded` already receives rather than adding a
parameter to a function already at `max-params`.

- [ ] **Step 11: Extend the two existing query tests**

Add to `tests/application/queries/listProjects.test.ts`:

```typescript
	it('answers the row facts for exactly the projects it listed', async () => {
		const facts = {
			factsFor: (ids: readonly ProjectId[]) =>
				new Map(ids.map((id) => [id, { planCount: 2, lastWorked: '2026-08-14T00:00:00.000Z' }])),
		};

		const result = await new ListProjects(repository, overlaps, facts).execute();

		expectOk(result);
		// The pairing this query already makes with `overlapping`: one read, one failure mode.
		expect(result.value.facts.get(result.value.projects[0].id)?.planCount).toBe(2);
	});
```

Add to `tests/presentation/read-models/renovationProjectQueries.test.ts`:

```typescript
	it('carries planCount and lastWorked onto every summary', async () => {
		const services = createRenovationProjectQueries(listProjects, getProject, listPlans, overlaps, {
			factsFor: (ids) =>
				new Map(ids.map((id) => [id, { planCount: 3, lastWorked: '2026-08-14T00:00:00.000Z' }])),
		});

		const result = await services.listProjects();

		expectOk(result);
		expect(result.value.projects[0].planCount).toBe(3);
		expect(result.value.projects[0].lastWorked).toBe('2026-08-14T00:00:00.000Z');
	});

	it('asks the facts port at the single-project door too', async () => {
		// A hard-coded `{ planCount: 0, lastWorked: null }` here passes every case that only
		// reads the LIST, which is why this asserts on the door that would have kept the lie.
		let asked: readonly string[] = [];
		const services = createRenovationProjectQueries(listProjects, getProject, listPlans, overlaps, {
			factsFor: (ids) => {
				asked = ids;
				return new Map(ids.map((id) => [id, { planCount: 7, lastWorked: null }]));
			},
		});

		const result = await services.getProject('project-1');

		expectOk(result);
		expect(asked).toEqual(['project-1']);
		expect(result.value?.planCount).toBe(7);
	});
```

- [ ] **Step 12: Fix every other broken fixture the compiler names**

Run: `npm run build`

Every test fixture that spells a `ProjectSummaryDto` literal now fails for the two missing
fields. Add `planCount: 0, lastWorked: null` to each unless the case is about ordering or the
facts slot. This is a wide, mechanical edit; `tests/harness/fixture.ts` is one of them and Task
12 gives it real values.

- [ ] **Step 13: Run the full gate**

Run: `npm run check`
Expected: PASS. If branches or functions coverage fails, read `coverage-final.json` for the
three changed `src/` files rather than the summary line — at this repository's headroom one
uncovered arm fails the gate outright and one in a slack metric hides completely.

- [ ] **Step 14: Commit**

```bash
git add src/application/ports/ProjectListFacts.ts \
  src/infrastructure/obsidian/repositories/IndexProjectListFacts.ts \
  src/application/queries/ListProjects.ts \
  src/presentation/read-models/PlanDto.ts \
  src/presentation/read-models/renovationProjectQueries.ts \
  src/plugin/ tests/
git commit -m "$(cat <<'EOF'
Commission planCount and lastWorked on the project summary

Both are facts about the read that produced them, answered in one walk of
the Project Index beside the overlap markers rather than by a second query
with its own failure mode. Required rather than optional on the DTO, so the
compiler named both doors that mint a summary instead of one of them
silently answering zero.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 2: Invalidate the plan count

The spec §8 commissions the fields' FRESHNESS along with the fields: `createProjectListChangeSource`
today hears `ProjectIndexRebuilt` and `ProjectCreated`, and admits `ProjectIndexEntryChanged`
only where the entry is a `renovation-project` — so a plan created in another leaf, or arriving
through sync, reaches the index and not this list, and `planCount` goes stale in ordinary use.

**The spec asks for `PlanDeleted` and there is no such event.** `grep -rn "PlanDeleted" src/`
prints nothing, and `src/application/commands/plan/` holds no delete command — so there is no
producer to subscribe to, and adding the name would be a subscription to something nothing
raises. The deletion case is covered by the OTHER arm instead: `VaultChangeAdapter` announces
`ProjectIndexEntryChanged` on `index.remove` as well as on upsert (its `announce` call sits
directly after the removal), so admitting `renovation-plan` in the entry filter carries created,
modified and deleted plan notes alike. That is written into the module rather than left as a
sentence here.

**The filter is not widened past `plan`.** That module's own docblock records why it exists —
"a synced plan or a burst of zone notes would make this view re-read every project note in the
vault, once per note" — and a project has a handful of plans created one at a time, which is
nothing like the zone burst. Zones, assets and requirements stay excluded.

**`lastWorked` gets no subscription of its own**, and that is the spec's ruling rather than an
omission: it moves on every write to any owned note, which is precisely the burst no
subscription should carry. It re-reads and re-orders when this view re-mounts (every
navigation) or when one of the events above already fires a hydrate.

**Files:**
- Modify: `src/application/events/projectListChangeSource.ts`
- Test: `tests/application/events/projectListChangeSource.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `EventBus`, `ProjectIndexEntryChangedPayload`, `PlanCreated`.
- Produces: no signature change — `createProjectListChangeSource(events)` still answers
  `(listener) => dispose`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/application/events/projectListChangeSource.test.ts`:

```typescript
	it('re-reads when a plan is created anywhere', async () => {
		const bus = createEventBus();
		let calls = 0;
		createProjectListChangeSource(bus)(() => {
			calls += 1;
		});

		await bus.publish(planCreated({ planId: 'plan-1' as PlanId, projectId: 'p1' as ProjectId }));

		// `planCount` is a commissioned field, so a plan created in a background leaf that
		// never reaches this list is a number the row states and does not have.
		expect(calls).toBe(1);
	});

	it('re-reads when a PLAN entry changes, which is how a DELETED plan arrives', async () => {
		const bus = createEventBus();
		let calls = 0;
		createProjectListChangeSource(bus)(() => {
			calls += 1;
		});

		// `VaultChangeAdapter.announce` fires on `index.remove` as well as on upsert, so this
		// one event carries created, modified and deleted plan notes alike. There is no
		// `PlanDeleted` in the tree to subscribe to instead — measured, not assumed.
		await bus.publish(projectIndexEntryChanged({ entityId: 'plan-1', entityType: 'renovation-plan' }));

		expect(calls).toBe(1);
	});

	it('still ignores a zone entry, which is the burst this filter exists for', async () => {
		const bus = createEventBus();
		let calls = 0;
		createProjectListChangeSource(bus)(() => {
			calls += 1;
		});

		await bus.publish(projectIndexEntryChanged({ entityId: 'zone-1', entityType: 'renovation-zone' }));

		// Widening past `plan` to make some later number work is what this case refuses.
		expect(calls).toBe(0);
	});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/application/events/projectListChangeSource.test.ts`
Expected: FAIL on the first two (`expected 0 to be 1`); the third passes already, which is
correct — it pins what must NOT change.

- [ ] **Step 3: Widen the two lists**

In `src/application/events/projectListChangeSource.ts`, change the two constants and extend the
docblocks:

```typescript
const PROJECT_LIST_CHANGE_EVENTS = ['ProjectIndexRebuilt', 'ProjectCreated', 'PlanCreated'] as const;
```

Above it, add to the existing docblock:

```
 * **`PlanCreated` is here because the Home spec commissioned a plan COUNT.** A field the
 * surface never re-reads is a field that lies, and until this name was added a plan created in
 * a background leaf reached the index and not this list — the row went on stating a number it
 * no longer had. The spec also names `PlanDeleted`; there is no such event in this tree and no
 * delete command to raise one, so the deletion case is carried by the entry arm below rather
 * than by a subscription to something nothing publishes.
```

Change the entry filter's admitted types:

```typescript
/**
 * … (existing paragraphs unchanged) …
 *
 * **`renovation-plan` is admitted beside `renovation-project`, and that is what carries a
 * DELETED plan.** `VaultChangeAdapter.announce` runs on `index.remove` as well as on upsert —
 * its call sits directly after the removal, reading the entry's `type` before dropping it — so
 * this one event covers a plan note created by hand, modified, copied in, arriving through
 * sync, or deleted. It is bounded on purpose: a project has a handful of plans and a user
 * creates them one at a time, which is nothing like the zone burst this filter was written
 * against.
 *
 * **Do not widen past `renovation-plan`.** Zones, assets and requirements stay excluded, and a
 * later number that needs one of them needs a different mechanism rather than a wider filter
 * here — `projectListChangeSource.test.ts` pins the zone case for exactly that reason.
 */
const PROJECT_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;
const LIST_ENTITY_TYPES = new Set(['renovation-project', 'renovation-plan']);
```

And the guard:

```typescript
			...PROJECT_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					const changed = changedEntityTypeOf(event);
					if (changed !== null && LIST_ENTITY_TYPES.has(changed)) listener();
				}),
			),
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/application/events/projectListChangeSource.test.ts`
Expected: PASS, including the zone case.

- [ ] **Step 5: Mutation-check the narrowing**

Temporarily add `'renovation-zone'` to `LIST_ENTITY_TYPES` and re-run.
Expected: the zone case goes RED. Revert.

This is the measurement this repository asks for when a fix is a REFUSAL: the suite tends to
cover the thing refused and not the thing still allowed, so write the widened mutation and run
it.

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/application/events/projectListChangeSource.ts tests/application/events/
git commit -m "$(cat <<'EOF'
Invalidate the project list when a plan changes

planCount is commissioned, so its freshness is too. PlanCreated joins the
category list and renovation-plan is admitted in the entry filter, which is
what carries a deleted plan note: there is no PlanDeleted event in this tree
and no command to raise one, and VaultChangeAdapter announces on remove.

Not widened past plan. The zone case is pinned so that stays true.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 3: The vocabulary — sixteen locale keys and the lifecycle stage

Every string this surface adds, in both locales, plus the one pure function the tick strip is
drawn from. Doing it as one task rather than per component is deliberate: `de.ts` is the file
this repository has already shipped three defects into by editing it a few keys at a time, and
`strings.test.ts` checks a key's German translation names the same `{holes}` as its English one
— a per-component drip is how a hole goes missing in one language only.

**Sixteen, not the spec's fifteen.** The sixteenth is `command.new-project`, which the locked
decision on `Mod+N` requires: registering a real command means `addCommand`'s `name` is a
user-facing string, and `I18N_LITERAL_BAN` refuses a literal at exactly that position.

**Two keys per count**, per the spec §12 and the global constraint: `t` has no plural
machinery, English and German are both two-form languages, and the component picks by
`count === 1`. A third locale forces a real plural mechanism; that arrival is a decision, not a
discovery, and the note saying so goes beside the keys.

**Files:**
- Create: `src/presentation/views/projectStatusStage.ts`
- Modify: `src/presentation/i18n/locales/en.ts`
- Modify: `src/presentation/i18n/locales/de.ts`
- Test: `tests/presentation/views/projectStatusStage.test.ts`

**Interfaces:**
- Consumes: `PROJECT_STATUSES`, `isProjectStatus` from `domain/project/ProjectStatus`.
- Produces:
  - `projectStatusStage(status: string): number | null` — the 0-based position in the arc.
  - `PROJECT_STATUS_STAGE_COUNT: number` — ten, derived from `PROJECT_STATUSES.length`.
  - The sixteen `StringKey`s listed below.

- [ ] **Step 1: Write the failing stage test**

Create `tests/presentation/views/projectStatusStage.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
	PROJECT_STATUS_STAGE_COUNT,
	projectStatusStage,
} from '../../../src/presentation/views/projectStatusStage';
import { PROJECT_STATUSES } from '../../../src/domain/project/ProjectStatus';

describe('projectStatusStage', () => {
	it('places every lifecycle member at its own position in the arc', () => {
		// Derived from the enum rather than transcribed: a table copied out of the domain
		// would agree with a reordering of it, which is the one change this must notice.
		expect(PROJECT_STATUSES.map(projectStatusStage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('reports the strip’s own length from the enum', () => {
		expect(PROJECT_STATUS_STAGE_COUNT).toBe(PROJECT_STATUSES.length);
	});

	it('answers null for a status this build does not recognise', () => {
		// `ProjectSummaryDto.status` is `string`, and a project note this build cannot make
		// sense of still gets a row. It gets the raw word and NO strip — a strip drawn at
		// stage 0 would be a claim about a lifecycle position nobody established.
		expect(projectStatusStage('PLANNING')).toBeNull();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectStatusStage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the stage function**

Create `src/presentation/views/projectStatusStage.ts`:

```typescript
import { isProjectStatus, PROJECT_STATUSES } from '../../domain/project/ProjectStatus';

/**
 * How many cells the lifecycle tick strip draws — the arc's own length, read from the enum
 * rather than written as `10`.
 *
 * A literal here is a second declaration of a fact the domain already owns, and the direction
 * it fails in is silent: a status added to `PROJECT_STATUSES` would render a strip one cell
 * short of the stage it is trying to show, with every test green.
 */
export const PROJECT_STATUS_STAGE_COUNT = PROJECT_STATUSES.length;

/**
 * Where this status sits in the Renovation Lifecycle (PRD §35), 0-based — or `null` for a
 * value this build does not recognise.
 *
 * The Home spec §6 is why this exists: `ProjectStatus` has ten members and they are an ARC,
 * not a flat category, so a badge throws away the one fact a renovator actually wants. The
 * strip is the arc drawn; this is the only thing that says where on it a project is.
 *
 * `null` rather than `0` for an unrecognised value, and the difference is a claim rather than
 * a convenience: `ProjectSummaryDto.status` is typed `string` precisely so a note this build
 * cannot fully read still gets a row (`statusLabel` states the same rule for the word), and a
 * strip drawn at stage 0 would tell the user that project is at IDEA. It renders no strip at
 * all instead, which is the honest picture and is also what the narrow composition already
 * looks like, so nothing new has to be designed for it.
 */
export function projectStatusStage(status: string): number | null {
	if (!isProjectStatus(status)) return null;
	return PROJECT_STATUSES.indexOf(status);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/presentation/views/projectStatusStage.test.ts`
Expected: PASS, 3 cases.

- [ ] **Step 5: Add the English keys**

In `src/presentation/i18n/locales/en.ts`, add `'command.new-project': 'New project'` beside the
other `command.*` entries, and add this block beside the existing `view.project.*` entries:

```typescript
	// The Home surface's launcher vocabulary (design spec §12). `{count}`, `{shown}`,
	// `{total}`, `{query}` and `{mod}` are `t`'s interpolation holes; an unmatched one is left
	// standing as `{name}` rather than blanked, because a visible hole is a bug report and an
	// empty string is a silent one.
	'view.project.filter.label': 'Filter projects',
	// TWO keys for one count, and the same again for plans below. `t` has no plural machinery;
	// English and German are both two-form languages, so this is complete for the current
	// locales and it is the point at which a THIRD locale forces a real plural mechanism.
	// Recorded here so that arrival is a decision rather than a discovery.
	'view.project.count-one': '1 project',
	'view.project.count-many': '{count} projects',
	'view.project.filter.matches': '{shown} of {total}',
	'view.project.filter.none': 'No project matches “{query}”.',
	'view.project.filter.clear': 'Clear filter',
	'view.project.create-named': 'New project named “{query}”',
	'view.project.group.continue': 'Continue',
	'view.project.group.projects': 'Projects',
	'view.project.group.completed': 'Completed ({count})',
	'view.project.continue.resume': 'Continue',
	'view.project.continue.open': 'Open',
	'view.project.plans-one': '1 plan',
	'view.project.plans-many': '{count} plans',
	// `{mod}` is resolved at the CALL SITE — `⌘` on macOS, `Ctrl` elsewhere — never baked into
	// a locale string, because it is a fact about the machine and not about the language.
	//
	// **It names only the two PANE-LOCAL accelerators, and `Mod+N` is deliberately absent.**
	// The design spec's §7 table wrote a third clause, and it cannot be honest: `New project`
	// is a registered command with NO default hotkey (declaring one would claim `Mod+N` on
	// every install over whatever the user already had), so a legend promising `{mod}N` would
	// advertise a key that does nothing until the user goes and binds it. Reading what they
	// actually bound is not available either — Obsidian's hotkey registry is internal and this
	// plugin may not reach the global `app` — so the honest legend is the one whose every
	// clause is true on a fresh install. The command is discoverable where a registered command
	// is discoverable: the palette.
	'view.project.keys': '↵ open · {mod}↵ open note',
```

**Sentence case.** `obsidianmd/ui/sentence-case-locale-module` fails the build on a capitalised
word mid-sentence, which is why the legend reads `open` and `open note` rather than `Open`. Run
lint before assuming a phrasing survives.

- [ ] **Step 6: Add the German keys**

In `src/presentation/i18n/locales/de.ts`, add the matching entries:

```typescript
	'command.new-project': 'Neues Projekt',
	'view.project.filter.label': 'Projekte filtern',
	'view.project.count-one': '1 Projekt',
	'view.project.count-many': '{count} Projekte',
	'view.project.filter.matches': '{shown} von {total}',
	'view.project.filter.none': 'Kein Projekt passt zu „{query}“.',
	'view.project.filter.clear': 'Filter zurücksetzen',
	'view.project.create-named': 'Neues Projekt namens „{query}“',
	'view.project.group.continue': 'Weitermachen',
	'view.project.group.projects': 'Projekte',
	'view.project.group.completed': 'Abgeschlossen ({count})',
	'view.project.continue.resume': 'Weitermachen',
	'view.project.continue.open': 'Öffnen',
	'view.project.plans-one': '1 Plan',
	'view.project.plans-many': '{count} Pläne',
	'view.project.keys': '↵ öffnen · {mod}↵ Notiz öffnen',
```

**Read `de.ts`'s own header before adding a word.** This file has shipped three defects —
`Material` where the German UI says `Objekt`, a garbled `Tresnornder`, and `Das Tresor` against
`Der Tresor` at another key — and `strings.test.ts` pins exactly two terms, not the language.
German noun capitalization is deliberately outside the sentence-case rule, so `Neues Projekt`
and `Projekte filtern` are both correct as written. Every `{hole}` above matches its English
key's, which is the one thing that file's test does check per key.

- [ ] **Step 7: Run the locale gate**

Run: `npx vitest run tests/presentation/i18n/`
Expected: PASS — including the per-key interpolation-hole comparison.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/projectStatusStage.ts src/presentation/i18n/locales/ tests/presentation/
git commit -m "$(cat <<'EOF'
Add the Home surface's vocabulary and its lifecycle stage

Sixteen keys in both locales, every count as a pair because t has no plural
machinery, and every {hole} matching across the two. The stage function
derives its cell count from PROJECT_STATUSES rather than writing ten, and
answers null for a status this build cannot place rather than drawing a
strip at stage zero.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 4: The row

The spec §6's anatomy, as its own component. `ProjectList.vue` renders `ProjectRow` from here
on and nothing else knows what a row is made of.

**Why a component rather than markup inside the list.** The list grows four regions in the
tasks below, and a row that lives inside it would be edited by every one of them. It is also
what makes the row reachable by the harness index standalone — but see step 8: it takes a
required prop, so the harness reaches it through the real view, not bare.

**Reading order and flex behaviour, one sentence each, from §6:** the NAME takes all slack
(`flex-grow: 1; min-width: 0`), truncates with an ellipsis and carries the full name in
`title` — it is the half that gives way, which is already the shipped rule. FACTS are muted,
smaller, `flex-shrink: 0`. STATUS is a word plus a mark, `flex-shrink: 0`, never truncated.
The §83 WARNING sits after the status at full weight and never shrinks.

**The strip is `aria-hidden` and the word is the accessible name.** The word is already the
second channel a11y depends on, so the strip is an ENHANCEMENT — which is what makes dropping
it at narrow lossless rather than a downgrade.

**Files:**
- Create: `src/presentation/views/ProjectRow.vue`
- Create: `styles/project-list.css`
- Create: `src/prototypes/StatusTicks.vue`
- Modify: `styles/index.css`
- Modify: `src/presentation/views/ProjectList.vue`
- Test: `tests/presentation/views/projectRow.test.ts`
- Test: `tests/presentation/views/projectListStyles.test.ts`

**Interfaces:**
- Consumes: `ProjectSummaryDto`, `statusLabel`, `projectStatusStage`,
  `PROJECT_STATUS_STAGE_COUNT`, `tr`.
- Produces: `ProjectRow` with props `{ project: ProjectSummaryDto }` and emit
  `{ open: [projectId: string] }`; CSS classes `.rp-project-row`, `.rp-project-row__facts`,
  `.rp-project-row__status`, `.rp-project-row__ticks`, `.rp-project-row__tick`,
  `.rp-project-row__tick--reached`.

- [ ] **Step 1: Write the failing row test**

Create `tests/presentation/views/projectRow.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectRow from '../../../src/presentation/views/ProjectRow.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECT: ProjectSummaryDto = {
	id: 'p1',
	name: 'House Renovation 2026',
	status: 'DESIGN',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 2,
	lastWorked: '2026-08-14T00:00:00.000Z',
};

function row(overrides: Partial<ProjectSummaryDto> = {}) {
	return mount(ProjectRow, { props: { project: { ...PROJECT, ...overrides } } });
}

describe('ProjectRow', () => {
	it('names the project and carries the full name in title, so a truncated one is readable', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-project-list__name').text()).toBe('House Renovation 2026');
		expect(wrapper.find('.rp-project-list__name').attributes('title')).toBe('House Renovation 2026');
	});

	it('states the plan count and the currency in the facts slot', () => {
		expect(row().find('.rp-project-row__facts').text()).toContain('2 plans');
		expect(row().find('.rp-project-row__facts').text()).toContain('EUR');
	});

	it('picks the singular plan key at one, because t has no plural machinery', () => {
		expect(row({ planCount: 1 }).find('.rp-project-row__facts').text()).toContain('1 plan');
	});

	it('renders nothing at all for a slot with nothing in it', () => {
		// The governing content rule: the row must look complete today, not like a card with
		// holes. No dash, no em-dash, no skeleton, no "not yet calculated".
		const text = row({ planCount: 0 }).find('.rp-project-row__facts').text();

		expect(text).not.toContain('0 plans');
		expect(text).not.toContain('—');
	});

	it('draws the status word and marks the cells up to its stage', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-project-row__status').text()).toContain('Design');
		expect(wrapper.findAll('.rp-project-row__tick')).toHaveLength(10);
		// DESIGN is stage 2, so three cells are reached — up to AND INCLUDING the current one.
		expect(wrapper.findAll('.rp-project-row__tick--reached')).toHaveLength(3);
	});

	it('hides the strip from assistive technology, leaving the word as the whole name', () => {
		expect(row().find('.rp-project-row__ticks').attributes('aria-hidden')).toBe('true');
		expect(row().find('.rp-project-row__ticks').text()).toBe('');
	});

	it('draws no strip for a status this build cannot place', () => {
		// A strip at stage 0 would say IDEA about a project nobody established a stage for.
		const wrapper = row({ status: 'PLANNING' });

		expect(wrapper.find('.rp-project-row__status').text()).toContain('PLANNING');
		expect(wrapper.find('.rp-project-row__ticks').exists()).toBe(false);
	});

	it('keeps the §83 marker after the status', () => {
		const wrapper = row({ libraryOverlap: true });
		const html = wrapper.html();

		expect(wrapper.find('.rp-project-list__overlap').exists()).toBe(true);
		expect(html.indexOf('rp-project-list__status')).toBeLessThan(html.indexOf('rp-project-list__overlap'));
	});

	it('emits open with its own id', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['p1']]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectRow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the row**

Create `src/presentation/views/ProjectRow.vue`:

```vue
<script setup lang="ts">
/**
 * One project as a list row — the Home design spec §6's anatomy, extracted out of
 * `ProjectList.vue` because the list around it grows four regions and a row living inside it
 * would be edited by every one of them.
 *
 * **It keeps `ProjectList`'s class names for the name, the status and the §83 marker.** Those
 * three have shipped rules in `forms.css` and `project-list-overlap.css` that were each found
 * by a capture and are each argued for where they live; renaming them would be re-litigating
 * three settled layout findings inside a change about composition. What is NEW here gets
 * `rp-project-row__*` — the facts slot and the tick strip — so the two vintages are legible.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, `ProjectList` re-emits it and the
 * VIEW decides what that means. That is design slice 16's division, unchanged.
 */
import { computed } from 'vue';
import type { ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { PROJECT_STATUS_STAGE_COUNT, projectStatusStage } from './projectStatusStage';
import { tr } from '../i18n/strings';

const props = defineProps<{ project: ProjectSummaryDto }>();
defineEmits<{ open: [projectId: string] }>();

/**
 * The facts slot's content, in the order §8 specifies, with EMPTY ENTRIES ABSENT rather than
 * blank.
 *
 * The governing rule from the confirmed brief: the row must look complete today, not like a
 * card with holes. A slot with nothing in it renders nothing — no dash, no `—`, no skeleton,
 * no "not yet calculated" — and its neighbours close up. A project with no plans therefore
 * shows its currency alone, not `0 plans · EUR`.
 *
 * **Budget and progress are RESERVED and render nothing.** §8 specifies this slot to receive
 * them, in that order, when and only when a query supplies them — and no query derives either
 * from real requirements and real costs yet. A builder may not approximate either, and may not
 * add a third fact here without amending the spec.
 */
const facts = computed(() => {
	const entries: string[] = [];
	if (props.project.planCount > 0) {
		entries.push(
			props.project.planCount === 1
				? tr('view.project.plans-one')
				: tr('view.project.plans-many', { count: String(props.project.planCount) }),
		);
	}
	entries.push(props.project.currency);
	return entries.join(' · ');
});

/**
 * The lifecycle arc as ten cells, or `null` for a status this build cannot place — in which
 * case no strip is drawn at all and the translated word stands alone, which is exactly the
 * composition the narrow row already uses, so nothing extra had to be designed for it.
 *
 * `reached` is inclusive of the current stage: a project at DESIGN has three of ten cells
 * filled, not two, because the stage it is AT is one it has reached.
 */
const ticks = computed(() => {
	const stage = projectStatusStage(props.project.status);
	if (stage === null) return null;
	return Array.from({ length: PROJECT_STATUS_STAGE_COUNT }, (_, cell) => cell <= stage);
});
</script>

<template>
	<button
		type="button"
		class="rp-project-list__row rp-project-row"
		@click="$emit('open', project.id)"
	>
		<!-- The half that gives way. `title` is what makes a truncated name readable at all,
		     and it is the shipped rule `forms.css` records finding at 460px. -->
		<span
			class="rp-project-list__name"
			:title="project.name"
		>{{ project.name }}</span>
		<span class="rp-project-row__facts">{{ facts }}</span>
		<span class="rp-project-list__status rp-project-row__status">
			{{ statusLabel(project.status) }}
			<!-- `aria-hidden` and text-free, so the WORD above stays the whole accessible name.
			     The strip is an enhancement over a channel that is already complete, which is
			     what makes dropping it at narrow lossless rather than a downgrade. -->
			<span
				v-if="ticks !== null"
				class="rp-project-row__ticks"
				aria-hidden="true"
			>
				<span
					v-for="(reached, cell) in ticks"
					:key="cell"
					class="rp-project-row__tick"
					:class="{ 'rp-project-row__tick--reached': reached }"
				/>
			</span>
		</span>
		<!-- PRD §83's marker, unchanged from design slice 19: a CSS-drawn triangle on the
		     class's `::before` and a translated sentence as the element's own text, so the row
		     says what is wrong to a reader who cannot see the colour and to one who cannot see
		     the glyph alike. It sits AFTER the status and never shrinks. -->
		<span
			v-if="project.libraryOverlap"
			class="rp-project-list__overlap"
		>{{ tr('view.project.library-overlap') }}</span>
	</button>
</template>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/presentation/views/projectRow.test.ts`
Expected: PASS, 9 cases.

- [ ] **Step 5: Write the stylesheet partial**

Create `styles/project-list.css`. This partial is where every rule the Home surface adds lives;
the existing project-list rules stay in `forms.css`, which is imported before this file, so a
rule here can override one there at equal specificity.

```css
/*
 * The Renovation Planner Home — the launcher's own rules.
 *
 * The rows' SHARED properties are in `list-row.css` and the shipped name/status/header rules
 * are in `forms.css`, both imported before this file. Nothing here restates one of those: each
 * was found by a capture and is argued for where it lives, and a second declaration of a
 * settled layout finding is how one becomes two that disagree.
 *
 * Every colour is an Obsidian variable, at every nesting depth — `scripts/styles-assemble.mjs`
 * fails the build on a literal, a bare colour word included.
 */

/*
 * THE FACTS SLOT. `flex-shrink: 0` because the NAME is the half that gives way, which
 * `forms.css` records finding at 460px: a flex item's `min-width` is `auto`, so anything that
 * CAN shrink is what loses, and the row's trailing facts are the ones a user is reading it for.
 */
.rp-project-row__facts {
	flex-shrink: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

/*
 * THE STATUS, and the strip beside it. The word and the strip are one flex line so the strip
 * sits with the word it describes rather than at the row's own edge, where a §83 marker would
 * come between them.
 */
.rp-project-row__status {
	display: flex;
	align-items: center;
	gap: var(--size-2-2);
}

.rp-project-row__ticks {
	display: flex;
	gap: 1px;
}

/*
 * TEN CELLS, drawn from `currentColor` so no colour literal enters this sheet and a themed
 * vault keeps its theme. No hue at any cell: the status WORD beside them is the second channel,
 * and PRD's accessibility section and SDD §85 both refuse a status carried by colour.
 *
 * A reached cell and an unreached one differ in OPACITY of the same colour rather than in two
 * colours, which is what keeps `currentColor` sufficient — the strip is `aria-hidden`, so the
 * distinction is doing decorative work over a channel that is already complete.
 */
.rp-project-row__tick {
	width: 3px;
	height: var(--size-2-3);
	border-radius: 1px;
	background-color: currentColor;
	opacity: 0.25;
}

.rp-project-row__tick--reached {
	opacity: 1;
}

/*
 * THE NARROW ROW — a CONTAINER query, never a media query, and that is a measured finding of
 * this project rather than a preference: the pane's width is the leaf's, not the window's, so a
 * media query asks the wrong element. `?phone` does not substitute for it either — that is a
 * body class answering what the plugin does when it believes it is on a phone.
 *
 * The threshold comes from a capture at 460px with the GERMAN status words in place:
 * `Bestandsaufnahme` is 16 characters against `Survey`'s 6, and a threshold validated only in
 * English is not validated. 34rem is the starting value; Task 12 is where it is confirmed or
 * moved, and moving it is expected rather than a failure.
 */
.rp-project-list {
	container-type: inline-size;
	container-name: rp-project-list;
}

@container rp-project-list (max-width: 34rem) {
	.rp-project-list .rp-project-row {
		flex-wrap: wrap;
	}

	/* The name takes the whole first line; the facts and the status share the second. */
	.rp-project-list .rp-project-list__name {
		flex-basis: 100%;
	}

	/*
	 * THE STRIP IS DROPPED, and nothing is lost: the translated word alone is complete and
	 * conformant, and a ten-cell strip in a 460px row is exactly the ceremony this direction's
	 * own recorded risk warns about.
	 */
	.rp-project-list .rp-project-row__ticks {
		display: none;
	}
}
```

- [ ] **Step 6: Import the partial**

In `styles/index.css`, add directly after the `forms.css` line:

```css
/*
 * AFTER `forms.css`, which is load-bearing: that file holds the shipped `.rp-project-list__*`
 * rules, and the Home surface's own partial must be able to override one at equal specificity.
 * Before `project-list-overlap.css`, which declares only `.rp-project-list__overlap` and is
 * untouched by anything here.
 */
@import "./project-list.css";
```

- [ ] **Step 7: Write the stylesheet's own test**

jsdom resolves no CSS, so a class whose rule is one word off renders the base look with every
test green — the defect this repository has already shipped once
(`rp-save-state-error` against an emitted `rp-save-state-save-error`). This asserts the sheet
declares what the template emits.

Create `tests/presentation/views/projectListStyles.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sheet = readFileSync('styles/project-list.css', 'utf8');

describe('project-list.css', () => {
	it('declares every class the row emits', () => {
		for (const cls of [
			'rp-project-row__facts',
			'rp-project-row__status',
			'rp-project-row__ticks',
			'rp-project-row__tick',
			'rp-project-row__tick--reached',
		]) {
			expect(sheet).toContain(`.${cls}`);
		}
	});

	it('drops the strip inside a CONTAINER query, not a media query', () => {
		// The pane's width is the leaf's, not the window's. A media query asks the wrong
		// element, and it is a mistake that looks correct at 1280 and only at 1280.
		expect(sheet).toContain('@container rp-project-list');
		expect(sheet).not.toContain('@media');
	});

	it('states the strip’s colour as currentColor and no literal', () => {
		// `styles-assemble.mjs` already fails the build on a literal; this pins the POSITIVE —
		// that the cells inherit, so a themed vault keeps its theme.
		expect(sheet).toContain('background-color: currentColor');
	});
});
```

- [ ] **Step 8: Draw all ten stages for a capture**

`IndexPage.vue` renders `<component :is>` BARE, so a harness entry taking a required prop
photographs the harness's own failure card — the lesson `ProjectDetail` already cost. A
prototype is the established answer (`SaveStateMarks.vue` does exactly this for the four save
marks, which are unreachable through the store).

Create `src/prototypes/StatusTicks.vue`:

```vue
<!--
	Every lifecycle stage's strip, side by side, because nine of the ten cannot be seen in the
	harness any other way.

	`ProjectRow` takes a required `project` prop, so a bare mount of it in the index draws the
	failure card rather than a row; and a real row shows ONE stage, which says nothing about the
	claim that matters here — that ten cells at 3px with a 1px gap can be counted by eye at a
	glance, and that a reached cell reads as reached. jsdom resolves no CSS, so the suite can
	assert a rule EXISTS and never that two rules look different.

	This duplicates the component's markup, which is a cost and not an oversight — the same
	trade `SaveStateMarks.vue` states. The duplication is two class names deep and both are
	declared by the shipped stylesheet, the one home that ships, so a renamed class breaks the
	picture rather than silently drawing the wrong thing.
-->
<script setup lang="ts">
import { PROJECT_STATUSES } from '../domain/project/ProjectStatus';
import { PROJECT_STATUS_STAGE_COUNT } from '../presentation/views/projectStatusStage';

const cells = Array.from({ length: PROJECT_STATUS_STAGE_COUNT }, (_, cell) => cell);
</script>

<template>
	<ul class="rp-project-list">
		<li
			v-for="(status, stage) in PROJECT_STATUSES"
			:key="status"
		>
			<div class="rp-project-list__row rp-project-row">
				<span class="rp-project-list__name">{{ status }}</span>
				<span class="rp-project-row__facts">2 plans · EUR</span>
				<span class="rp-project-list__status rp-project-row__status">
					<span
						class="rp-project-row__ticks"
						aria-hidden="true"
					>
						<span
							v-for="cell in cells"
							:key="cell"
							class="rp-project-row__tick"
							:class="{ 'rp-project-row__tick--reached': cell <= stage }"
						/>
					</span>
				</span>
			</div>
		</li>
	</ul>
</template>
```

**No `<style scoped>` block here.** Every class it uses is declared by the shipped sheet, which
is what `tests/build/prototype-styles.test.ts` requires — it refuses a class NEITHER home
declares. A prototype importing from `src/domain/` is legal; a prototype being imported by
anything is not, and a per-layer `no-restricted-imports` ban plus
`tests/build/prototypes-not-bundled.test.ts` hold that.

- [ ] **Step 9: Point `ProjectList` at the row**

In `src/presentation/views/ProjectList.vue`, replace the `<li>` body with `<ProjectRow>` and
re-emit:

```vue
		<li
			v-for="project in projects"
			:key="project.id"
		>
			<ProjectRow
				:project="project"
				@open="(id) => $emit('open', id)"
			/>
		</li>
```

with `import ProjectRow from './ProjectRow.vue';` added. The header and the two buttons stay
exactly as they are for now — Task 9 is what moves `New asset` to the foot line, and doing it
here would mix a composition change into an extraction.

- [ ] **Step 10: Run the existing list tests**

Run: `npx vitest run tests/presentation/views/projectList.test.ts tests/presentation/views/projectListOverlap.test.ts`
Expected: PASS unchanged. Both address `.rp-project-list__row`, `.rp-project-list__name`,
`.rp-project-list__status` and `.rp-project-list__overlap`, every one of which the row still
emits — which is the whole reason those class names were kept.

If either fails on the facts slot's text appearing in `wrapper.text()`, widen the assertion
rather than removing the fact: the row genuinely says more than it did.

- [ ] **Step 11: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/ProjectRow.vue src/presentation/views/ProjectList.vue \
  src/prototypes/StatusTicks.vue styles/project-list.css styles/index.css tests/presentation/views/
git commit -m "$(cat <<'EOF'
Draw a project row with its facts and its lifecycle stage

The status is a word plus a ten-cell tick strip rather than a badge: the
lifecycle is an arc and a badge throws away how far along a project is. No
hue, aria-hidden on the strip, and the strip is dropped at narrow — so the
translated word is always the complete second channel.

An empty facts entry renders nothing rather than a dash. Narrow is a
container query on the pane's own width; a media query asks the window.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 5: Order, and the two groups

§8's ordering and §5's regions 4 and 5. `lastWorked` descending; ties and nulls fall back to
name ascending through the same `Intl.Collator`; `COMPLETE` and `AS_BUILT` move to a collapsed
`<details>` group at the foot with their count in the summary.

**Where the sort lives, and why not in the query.** It needs an `Intl.Collator` seeded from
Obsidian's own `getLanguage()`, and `application/` may not resolve a language — `t` is pure for
exactly that reason and `LANGUAGE_RESOLUTION_BAN` refuses a second `getLanguage` call site. So
the order is presentation's, in a pure module a node test can drive per locale without a mock.

**The order is frozen for the life of the mount, and that is what NOT building looks like.**
§8: `lastWorked` moves on every write to any owned note, which is precisely the burst no
subscription should carry, and re-sorting a list under a user's cursor because a background leaf
saved a zone is worse than a date a few minutes old. So there is no `lastWorked` subscription
and no re-sort timer — the order changes when this view re-mounts (every navigation) or when a
hydrate already fires from Task 2's events, and nowhere else.

**Files:**
- Create: `src/presentation/views/projectOrder.ts`
- Modify: `src/presentation/views/ProjectList.vue`
- Test: `tests/presentation/views/projectOrder.test.ts`
- Test: `tests/presentation/views/projectListGroups.test.ts`

**Interfaces:**
- Consumes: `ProjectSummaryDto`, `currentLanguage`.
- Produces:
  - `COMPLETED_STATUSES: ReadonlySet<string>` — `{'COMPLETE', 'AS_BUILT'}`.
  - `isCompleted(project: ProjectSummaryDto): boolean`
  - `orderProjects(projects: readonly ProjectSummaryDto[], collator: Intl.Collator): ProjectSummaryDto[]`
  - `nameCollator(language: string): Intl.Collator` — `sensitivity: 'base'`, reused by Task 6.

- [ ] **Step 1: Write the failing order test**

Create `tests/presentation/views/projectOrder.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
	isCompleted,
	nameCollator,
	orderProjects,
} from '../../../src/presentation/views/projectOrder';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(over: Partial<ProjectSummaryDto>): ProjectSummaryDto {
	return {
		id: over.name ?? 'x',
		name: 'x',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const collator = nameCollator('en');

describe('orderProjects', () => {
	it('puts the most recently worked project first', () => {
		const ordered = orderProjects(
			[
				project({ name: 'Older', lastWorked: '2026-01-01T00:00:00.000Z' }),
				project({ name: 'Newer', lastWorked: '2026-08-01T00:00:00.000Z' }),
			],
			collator,
		);

		expect(ordered.map((p) => p.name)).toEqual(['Newer', 'Older']);
	});

	it('falls back to name ascending on a tie', () => {
		const same = '2026-08-01T00:00:00.000Z';
		const ordered = orderProjects(
			[project({ name: 'Bathroom', lastWorked: same }), project({ name: 'Attic', lastWorked: same })],
			collator,
		);

		expect(ordered.map((p) => p.name)).toEqual(['Attic', 'Bathroom']);
	});

	it('sorts a null lastWorked to the tail, by name', () => {
		// A project the vault could answer for no note of is not "worked on at the epoch" and
		// must not lead the list; it is simply undated.
		const ordered = orderProjects(
			[
				project({ name: 'Zed', lastWorked: null }),
				project({ name: 'Attic', lastWorked: null }),
				project({ name: 'Dated', lastWorked: '2020-01-01T00:00:00.000Z' }),
			],
			collator,
		);

		expect(ordered.map((p) => p.name)).toEqual(['Dated', 'Attic', 'Zed']);
	});

	it('is stable, so a re-hydrate never reshuffles equal rows', () => {
		const equal = [project({ name: 'Same', id: 'a' }), project({ name: 'Same', id: 'b' })];

		expect(orderProjects(equal, collator).map((p) => p.id)).toEqual(['a', 'b']);
		expect(orderProjects(orderProjects(equal, collator), collator).map((p) => p.id)).toEqual(['a', 'b']);
	});

	it('does not mutate its input', () => {
		// The store hands it `projects.value`, a readonly array by declaration and a live Pinia
		// ref underneath. An in-place `.sort()` would reorder the store from a computed.
		const input = [project({ name: 'B' }), project({ name: 'A' })];
		orderProjects(input, collator);

		expect(input.map((p) => p.name)).toEqual(['B', 'A']);
	});

	it('collates by the given language’s rules', () => {
		const ordered = orderProjects(
			[project({ name: 'Zimmer' }), project({ name: 'Ähre' })],
			nameCollator('de'),
		);

		// Base sensitivity: `Ä` collates with `A`, so it leads. A raw `<` comparison on the
		// code units puts every accented name after `Z`.
		expect(ordered.map((p) => p.name)).toEqual(['Ähre', 'Zimmer']);
	});
});

describe('isCompleted', () => {
	it('names exactly the two terminal stages', () => {
		expect(isCompleted(project({ status: 'COMPLETE' }))).toBe(true);
		expect(isCompleted(project({ status: 'AS_BUILT' }))).toBe(true);
		expect(isCompleted(project({ status: 'INSPECTION' }))).toBe(false);
		// A status this build cannot place is not completed — it is unknown, and an unknown
		// project hidden in a collapsed group is a project the user cannot find.
		expect(isCompleted(project({ status: 'PLANNING' }))).toBe(false);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectOrder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the order module**

Create `src/presentation/views/projectOrder.ts`:

```typescript
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
 */
export const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['COMPLETE', 'AS_BUILT']);

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
 * reshuffles equal rows: `Array.prototype.sort` is required to be stable since ES2019, and a
 * copy is taken because the caller's array is the store's own.
 */
export function orderProjects(
	projects: readonly ProjectSummaryDto[],
	collator: Intl.Collator,
): ProjectSummaryDto[] {
	return [...projects].sort((left, right) => {
		// A null is UNDATED, not "worked on at the epoch": it sorts to the tail rather than to
		// the head, and among nulls the name decides.
		if (left.lastWorked !== right.lastWorked) {
			if (left.lastWorked === null) return 1;
			if (right.lastWorked === null) return -1;
			// ISO 8601 in UTC sorts lexicographically, which is the whole reason the DTO carries
			// a string rather than a number: no parse, no timezone, no `Invalid Date`.
			return left.lastWorked < right.lastWorked ? 1 : -1;
		}
		return collator.compare(left.name, right.name);
	});
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/presentation/views/projectOrder.test.ts`
Expected: PASS, 7 cases.

- [ ] **Step 5: Write the failing group test**

Create `tests/presentation/views/projectListGroups.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(over: Partial<ProjectSummaryDto>): ProjectSummaryDto {
	return {
		id: over.name ?? 'x',
		name: 'x',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const MIXED = [
	project({ name: 'Attic', status: 'COMPLETE' }),
	project({ name: 'Kitchen', status: 'DESIGN', lastWorked: '2026-08-01T00:00:00.000Z' }),
	project({ name: 'Cellar', status: 'AS_BUILT' }),
	project({ name: 'Bathroom', status: 'IDEA', lastWorked: '2026-08-14T00:00:00.000Z' }),
];

describe('ProjectList groups', () => {
	it('draws active projects most recently worked first', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });
		const names = wrapper
			.findAll('.rp-project-list__group--projects .rp-project-list__name')
			.map((el) => el.text());

		expect(names).toEqual(['Bathroom', 'Kitchen']);
	});

	it('files the two terminal stages into a collapsed group with its count', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });
		const details = wrapper.find('.rp-project-list__completed');

		// A native `<details>`/`<summary>`, so disclosure state is announced by the HOST rather
		// than reimplemented with ARIA — and it is collapsed by default.
		expect(details.element.tagName).toBe('DETAILS');
		expect(details.attributes('open')).toBeUndefined();
		expect(details.find('summary').text()).toContain('Completed (2)');
		// §11 asks for an `<h3>` per group heading. Without one this group is absent from
		// assistive-technology heading navigation while its two siblings are listed — the one
		// group whose contents are hidden by default being also the one nobody can navigate to.
		expect(details.find('summary h3').exists()).toBe(true);
	});

	it('omits a group entirely when it holds nothing', () => {
		const wrapper = mount(ProjectList, { props: { projects: [project({ name: 'Only' })] } });

		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(false);
	});

	it('omits the Projects group when every project is completed', () => {
		const wrapper = mount(ProjectList, {
			props: { projects: [project({ name: 'Done', status: 'COMPLETE' })] },
		});

		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
		expect(wrapper.find('.rp-project-list__completed').exists()).toBe(true);
	});

	it('titles each group at h3, the level the detail state already uses', () => {
		const wrapper = mount(ProjectList, { props: { projects: MIXED } });

		// Heading order is what the accessibility scan checks, and the pane's own `<h2>` is the
		// only title it has — the leaf's own header is hidden for this view type.
		expect(wrapper.find('.rp-project-list__title').element.tagName).toBe('H2');
		expect(wrapper.find('.rp-project-list__group--projects h3').exists()).toBe(true);
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectListGroups.test.ts`
Expected: FAIL — no `.rp-project-list__group--projects` in the DOM.

- [ ] **Step 7: Build the groups**

In `src/presentation/views/ProjectList.vue`, add to the script:

```typescript
import { computed } from 'vue';
import { isCompleted, nameCollator, orderProjects } from './projectOrder';
import { currentLanguage } from '../i18n/strings';

/**
 * ONE collator for this mount, built once rather than per comparison: `Intl.Collator`'s
 * construction is the expensive half and its `compare` is the cheap one, and a sort over
 * thirty rows would otherwise build thirty of them.
 *
 * Not reactive on the language, deliberately. `currentLanguage()` reads Obsidian's own setting
 * and this view remounts per navigation, so a language changed mid-session is picked up at the
 * next open — the same bound every other `tr` call on this surface has.
 */
const collator = nameCollator(currentLanguage());

const ordered = computed(() => orderProjects(props.projects, collator));
const active = computed(() => ordered.value.filter((project) => !isCompleted(project)));
const completed = computed(() => ordered.value.filter(isCompleted));
```

changing `defineProps` to `const props = defineProps<{ projects: readonly ProjectSummaryDto[] }>();`.

Replace the single `<ul>` with the two groups:

```vue
		<section
			v-if="active.length > 0"
			class="rp-project-list__group rp-project-list__group--projects"
		>
			<h3 class="rp-project-list__group-title">
				{{ tr('view.project.group.projects') }}
			</h3>
			<ul class="rp-project-list">
				<li
					v-for="project in active"
					:key="project.id"
				>
					<ProjectRow
						:project="project"
						@open="(id) => $emit('open', id)"
					/>
				</li>
			</ul>
		</section>
		<!--
			A native `<details>`/`<summary>`, so the disclosure state is announced by the HOST
			rather than reimplemented with ARIA — and its expanded state is deliberately NOT
			persisted: it resets on remount, which is every navigation, exactly like the filter's
			own query.
		-->
		<details
			v-if="completed.length > 0"
			class="rp-project-list__completed"
			@toggle="completedOpen = ($event.target as HTMLDetailsElement).open"
		>
			<!--
				An `<h3>` INSIDE the `<summary>`, which is what keeps both contracts: §11 asks for
				an `<h3>` per group heading and this group had only a `<summary>`, so it vanished
				from assistive-technology heading navigation while `Projects` and `Continue` were
				both listed — the one group whose contents are hidden by default being also the
				one a user could not navigate to. `<summary>` takes flow content, so the native
				disclosure and its announcement are untouched.
			-->
			<summary>
				<h3 class="rp-project-list__group-title">
					{{ tr('view.project.group.completed', { count: String(completed.length) }) }}
				</h3>
			</summary>
			<ul class="rp-project-list">
				<li
					v-for="project in completed"
					:key="project.id"
				>
					<ProjectRow
						:project="project"
						@open="(id) => $emit('open', id)"
					/>
				</li>
			</ul>
		</details>
```

- [ ] **Step 8: Add the group rules**

Append to `styles/project-list.css`:

```css
/*
 * ONE SPACING RHYTHM, on Obsidian's own `--size-*` scale, with MORE SPACE ABOVE a group heading
 * than below it — so a heading reads as belonging to what follows rather than floating between
 * two lists.
 */
.rp-project-list__group {
	margin-block-start: var(--size-4-4);
}

.rp-project-list__group-title {
	margin: 0;
	padding: 0 var(--size-4-2) var(--size-2-2);
	/* An `<h3>` inside a `<summary>` is a block child of a list-item-styled box; `display:
	   inline` keeps it on the disclosure triangle's own line rather than dropping below it. */
	display: inline;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-semibold);
}

.rp-project-list__completed {
	margin-block-start: var(--size-4-4);
}

/* The disclosure triangle is the host's own; the summary is given the row's hit height so it
   clears WCAG 2.5.8's 24px floor like everything else on this surface. */
.rp-project-list__completed > summary {
	min-height: var(--size-4-6);
	cursor: pointer;
}

.rp-project-list__completed > summary:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}
```

- [ ] **Step 9: Run the group tests and the existing list tests**

Run: `npx vitest run tests/presentation/views/projectList`
Expected: PASS. `projectList.test.ts`'s existing "renders one row per project" case still finds
two `.rp-project-list__row` elements, because both fixtures are active-stage.

- [ ] **Step 10: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/projectOrder.ts src/presentation/views/ProjectList.vue \
  styles/project-list.css tests/presentation/views/
git commit -m "$(cat <<'EOF'
Order the project list and split off the completed group

lastWorked descending, ties and nulls to name ascending through one
Intl.Collator at base sensitivity — so a German vault collates Ähre with A.
In presentation because the collation needs a language and application may
not resolve one.

The order is frozen for the life of the mount by design: lastWorked moves on
every write to any owned note, and re-sorting under a user's cursor because a
background leaf saved a zone is worse than a date a few minutes old.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 6: The filter line

§7's filter and §5's region 2. A single input across the pane, quiet at rest, with the count at
its trailing edge — and the count IS the pane's state line, which is the discipline the declined
teletext candidate donated: a launcher whose field says nothing when empty is furniture.

**Name only.** The locked decision on §14: not the status word. `2 of 4` stays unambiguous
about what matched.

**Weight, not colour, for the matched run.** `var(--font-semibold)` on the matched substring —
the house rule (*colour reinforces, it never carries*) applied to a highlight, and a second
channel by construction.

**No autofocus.** A pane that steals the caret on open hijacks the user's typing. Task 8 gives
the launcher its keyboard entry instead.

**Files:**
- Create: `src/presentation/views/projectFilter.ts`
- Create: `src/presentation/views/ProjectFilter.vue`
- Modify: `src/presentation/views/ProjectList.vue`
- Modify: `styles/project-list.css`
- Modify: `src/presentation/views/ProjectRow.vue`
- Test: `tests/presentation/views/projectFilter.test.ts`
- Test: `tests/presentation/views/projectFilterLine.test.ts`

**Interfaces:**
- Consumes: `nameCollator` from Task 5, `ProjectSummaryDto`, `tr`.
- Produces:
  - `matchesQuery(name: string, query: string, collator: Intl.Collator): boolean`
  - `splitMatch(name: string, query: string, collator: Intl.Collator): readonly { text: string; matched: boolean }[]`
  - `ProjectFilter` with props `{ query: string; shown: number; total: number }` and emit
    `{ 'update:query': [value: string]; cancel: [] }`.
  - `ProjectRow` gains an optional `query?: string` prop driving the highlight.

- [ ] **Step 1: Write the failing matcher test**

Create `tests/presentation/views/projectFilter.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { matchesQuery, splitMatch } from '../../../src/presentation/views/projectFilter';
import { nameCollator } from '../../../src/presentation/views/projectOrder';

const en = nameCollator('en');
const de = nameCollator('de');

describe('matchesQuery', () => {
	it('matches a substring anywhere in the name', () => {
		expect(matchesQuery('House Renovation 2026', 'renov', en)).toBe(true);
		expect(matchesQuery('House Renovation 2026', 'cellar', en)).toBe(false);
	});

	it('ignores case', () => {
		expect(matchesQuery('Kitchen', 'KITCHEN', en)).toBe(true);
	});

	it('ignores diacritics, which is the whole reason a collator is used', () => {
		// A German vault must match `Küche` when the user types `kuche`. A `toLowerCase`
		// comparison answers false here, which is why this is not one.
		expect(matchesQuery('Küche', 'kuche', de)).toBe(true);
		expect(matchesQuery('Ähre', 'ahre', de)).toBe(true);
	});

	it('matches a LIGATURE, where one code unit equals three', () => {
		// The measurement that killed the ratio bound: `compare('ﬃ', 'ffi')` is 0 in both
		// locales, so a 1-unit window has to be tried against a 6-unit query. Any `minWidth`
		// derived from the query's length never tries it.
		expect(matchesQuery('Oﬃce', 'office', en)).toBe(true);
		expect(matchesQuery('Oﬃce', 'ffi', en)).toBe(true);
	});

	it('matches the other single-unit ligatures the collator equates', () => {
		// Measured, all 0 under base sensitivity: æ/ae, œ/oe, ﬁ/fi, ﬂ/fl, ﬀ/ff.
		expect(matchesQuery('Æther', 'aether', de)).toBe(true);
		expect(matchesQuery('Œuvre', 'oeuvre', de)).toBe(true);
	});

	it('matches an expansion that makes the query LONGER than the name', () => {
		// Measured, not assumed: base sensitivity treats `ß` and `ss` as equal, so a 6-unit
		// name is matched by a 7-unit query. A window sized from the query — and the
		// `needle.length > name.length` early return that came with it — rejected exactly this,
		// so a user typing the ordinary ASCII spelling of a street name found nothing.
		expect(matchesQuery('Straße', 'strasse', de)).toBe(true);
		expect(matchesQuery('Hauptstraße 12', 'hauptstrasse', de)).toBe(true);
	});

	it('matches the same expansion from the other side', () => {
		expect(matchesQuery('Strasse', 'straße', de)).toBe(true);
	});

	it('still refuses a query that is genuinely absent, however long', () => {
		// The widened band must not turn into "matches anything": the guard against that is
		// that the collator, not the width, decides.
		expect(matchesQuery('Küche', 'badezimmer', de)).toBe(false);
		expect(matchesQuery('Straße', 'strosse', de)).toBe(false);
	});

	it('matches everything on an empty query', () => {
		// At rest the filter excludes nothing, so the count reads the vault's own total.
		expect(matchesQuery('Anything', '', en)).toBe(true);
		expect(matchesQuery('Anything', '   ', en)).toBe(true);
	});
});

describe('splitMatch', () => {
	it('returns one unmatched run for an empty query', () => {
		expect(splitMatch('Kitchen', '', en)).toEqual([{ text: 'Kitchen', matched: false }]);
	});

	it('splits around the matched run, preserving the NAME’s own characters', () => {
		// `Küche` must render with its umlaut even though the query that found it had none —
		// the highlight is a fact about where the match is, never a replacement for the text.
		expect(splitMatch('Küche', 'kuche', de)).toEqual([{ text: 'Küche', matched: true }]);
	});

	it('highlights the MATCHED SPAN, not the query’s length', () => {
		// `Straße` is six units and the query that found it is seven. Slicing by the query's
		// length would run past the end of the name — and on a longer name it would swallow a
		// character that did not match.
		expect(splitMatch('Straße 12', 'strasse', de)).toEqual([
			{ text: 'Straße', matched: true },
			{ text: ' 12', matched: false },
		]);
	});

	it('keeps the text either side of a mid-name match', () => {
		expect(splitMatch('House Renovation', 'reno', en)).toEqual([
			{ text: 'House ', matched: false },
			{ text: 'Reno', matched: true },
			{ text: 'vation', matched: false },
		]);
	});

	it('returns one unmatched run when nothing matches', () => {
		expect(splitMatch('Kitchen', 'zzz', en)).toEqual([{ text: 'Kitchen', matched: false }]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectFilter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the matcher**

Create `src/presentation/views/projectFilter.ts`:

```typescript
/**
 * The Home surface's filter: name matching and the runs a highlight is drawn from
 * (design spec §7).
 *
 * **Name only.** The spec's §14 left "should the filter also match the status word" open and it
 * is settled as no: typing `design` finding every project in the Design stage is useful and it
 * makes `2 of 4` ambiguous about which field matched. Revisit when a vault has enough projects
 * for stage filtering to be the faster path.
 *
 * **A COLLATOR rather than `toLowerCase`**, and the difference is the requirement rather than a
 * refinement: a German vault must match `Küche` when the user types `kuche`, and
 * `'küche'.includes('kuche')` is false. `Intl.Collator` at `sensitivity: 'base'` treats a base
 * letter, its case variants and its accented forms as equal — which is also what orders the
 * list, so one instrument answers both and they cannot disagree about two strings.
 *
 * The collator is a PARAMETER for the reason `projectOrder`'s is: the language may not be
 * resolved here, and a node test drives German directly.
 */

/** Whether `query` occurs anywhere in `name`. An empty or blank query matches everything. */
export function matchesQuery(name: string, query: string, collator: Intl.Collator): boolean {
	return findMatch(name, query, collator) !== null;
}

/**
 * `name`, split into runs, with the matched one flagged — never a pre-rendered string.
 *
 * The runs carry the NAME's own characters rather than the query's: a `Küche` found by typing
 * `kuche` still renders with its umlaut, because the highlight is a statement about WHERE the
 * match is and not a replacement for the text. Returning runs rather than HTML is also what
 * keeps this free of any markup a template would then have to trust.
 */
export function splitMatch(
	name: string,
	query: string,
	collator: Intl.Collator,
): readonly { text: string; matched: boolean }[] {
	const found = query.trim().length === 0 ? null : findMatch(name, query, collator);
	if (found === null) return [{ text: name, matched: false }];

	const runs = [];
	if (found.at > 0) runs.push({ text: name.slice(0, found.at), matched: false });
	// The MATCHED SPAN, never the query's length — the two differ whenever the collation
	// expanded something (`Straße` matched by `Strasse` is a 6-unit span found by a 7-unit
	// query), and slicing by the query's length would highlight past the run that matched.
	runs.push({ text: name.slice(found.at, found.at + found.width), matched: true });
	if (found.at + found.width < name.length) {
		runs.push({ text: name.slice(found.at + found.width), matched: false });
	}
	return runs;
}

/**
 * The earliest, shortest span of `name` the collator considers equal to `query`, or `null`.
 *
 * A window walk rather than `String.prototype.includes`, because `includes` compares code units
 * and the whole point here is that it must not. The alternative — normalizing both sides with
 * `normalize('NFD')` and stripping combining marks — hard-codes one script's idea of what an
 * accent is, and the collator is already the thing this repository resolves per language.
 *
 * **The window's WIDTH VARIES, and that is not a refinement — it is the difference between
 * working and not working in German.** Base sensitivity treats `ß` and `ss` as equal, so a
 * 6-unit name is matched by a 7-unit query: measured in node, not assumed —
 * `new Intl.Collator('de', { sensitivity: 'base' }).compare('Straße', 'Strasse')` is `0`, and
 * the `'en'` collator answers `0` too. A window sized from the query, and the
 * `needle.length > name.length` early return that came with it, rejected exactly that — so a
 * user typing the ordinary ASCII spelling of a street name found nothing. That is the failure
 * the collator was chosen to prevent, arriving through the search that uses it.
 *
 * **There is NO ratio bound, and an earlier draft asserting one was measurably wrong.** That
 * draft ran widths from half the query's length to twice it, "which covers every expansion
 * `Intl` exposes for the locales this plugin ships" — generalised from a single measurement of
 * `ä`/`ae`, which is not even a ligature. Measured properly, in `de` and `en` alike:
 *
 * ```
 * compare('ﬃ', 'ffi')  // 0   — ONE code unit equals THREE
 * compare('æ', 'ae')   // 0   — and so do ﬁ/fi, ﬂ/fl, ﬀ/ff, œ/oe
 * compare('ä', 'ae')   // -1  — the one pair the old bound was derived from
 * ```
 *
 * So `Oﬃce` typed as `office` needs a 1-unit window against a 6-unit query, which `minWidth`
 * of 3 never tried. **A bound derived from one example is a bound derived from nothing**, and
 * the honest algorithm searches every width the name can offer.
 *
 * **TWO PASSES, so removing the bound does not make this a scan.** The first tries the
 * no-expansion width at every position — the overwhelmingly common case, and O(name.length).
 * Only when that finds nothing does the second walk every other width, which is O(name.length²)
 * and runs on the rare query that needs it. Measured intent, to be confirmed in Task 12 against
 * the 30-row fixture: a single-pass walk of all widths is roughly `name.length²/2` collator
 * comparisons per row per keystroke, which at thirty rows is where a keystroke starts to be
 * felt.
 *
 * **What the two-pass order costs, stated rather than hidden:** the first pass wins even when
 * an expansion match starts EARLIER in the name, so the highlight can land on the later of two
 * genuine matches. It is cosmetic — both are real matches and the row is shown either way — and
 * the alternative is paying the quadratic pass on every keystroke to place a highlight.
 */
function findMatch(
	name: string,
	query: string,
	collator: Intl.Collator,
): { at: number; width: number } | null {
	const needle = query.trim();
	if (needle.length === 0) return { at: 0, width: 0 };

	const equals = (at: number, width: number): boolean =>
		collator.compare(name.slice(at, at + width), needle) === 0;

	// Pass 1: no expansion. Case and diacritics still differ, which is why it is the collator
	// answering rather than `includes`.
	for (let at = 0; at + needle.length <= name.length; at += 1) {
		if (equals(at, needle.length)) return { at, width: needle.length };
	}

	// Pass 2: every other width, shortest first at each position.
	for (let at = 0; at < name.length; at += 1) {
		for (let width = 1; at + width <= name.length; width += 1) {
			if (width !== needle.length && equals(at, width)) return { at, width };
		}
	}
	return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/presentation/views/projectFilter.test.ts`
Expected: PASS, 8 cases.

- [ ] **Step 5: Write the failing filter-line test**

Create `tests/presentation/views/projectFilterLine.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectFilter from '../../../src/presentation/views/ProjectFilter.vue';

function line(props: { query?: string; shown?: number; total?: number } = {}) {
	return mount(ProjectFilter, {
		props: { query: '', shown: 4, total: 4, ...props },
	});
}

describe('ProjectFilter', () => {
	it('states the vault’s own count at rest', () => {
		// The teletext discipline: at rest the field IS the pane's count line. A launcher whose
		// field says nothing when empty is furniture, and two projects is exactly the vault
		// size that risk was recorded against.
		expect(line().find('.rp-project-filter__count').text()).toBe('4 projects');
	});

	it('picks the singular count key at one', () => {
		expect(line({ shown: 1, total: 1 }).find('.rp-project-filter__count').text()).toBe('1 project');
	});

	it('turns the count into a ratio while filtering', () => {
		expect(line({ query: 'ki', shown: 2, total: 4 }).find('.rp-project-filter__count').text()).toBe(
			'2 of 4',
		);
	});

	it('announces politely through a region separate from the visible count', () => {
		const wrapper = line();

		expect(wrapper.find('.rp-project-filter__announcement').attributes('role')).toBe('status');
		// The visible count is NOT the live region: two elements announcing one number makes a
		// screen reader say it twice.
		expect(wrapper.find('.rp-project-filter__count').attributes('aria-hidden')).toBe('true');
	});

	it('updates the VISIBLE count immediately, without waiting for the debounce', async () => {
		// The count is the pane's state line — §3's teletext discipline and the whole reason the
		// filter is not furniture. Rows filter immediately, so a debounced visible count would
		// read `4 projects` above two rows, indefinitely while the user keeps typing.
		vi.useFakeTimers();
		const wrapper = line();

		await wrapper.setProps({ query: 'ki', shown: 2, total: 4 });

		expect(wrapper.find('.rp-project-filter__count').text()).toBe('2 of 4');
		expect(wrapper.find('.rp-project-filter__announcement').text()).toBe('4 projects');
		vi.useRealTimers();
	});

	it('gives the input a real accessible name through a label, not a placeholder', () => {
		const wrapper = line();
		const input = wrapper.find('input');
		const label = wrapper.find('label');

		// A placeholder is not a label and does not become one.
		expect(label.text()).toBe('Filter projects');
		expect(label.attributes('for')).toBe(input.attributes('id'));
	});

	it('does not steal the caret on mount', () => {
		// No autofocus: a pane that takes focus on open hijacks whatever the user was typing.
		expect(line().find('input').attributes('autofocus')).toBeUndefined();
		expect(document.activeElement?.tagName).not.toBe('INPUT');
	});

	it('emits every keystroke', async () => {
		const wrapper = line();

		await wrapper.find('input').setValue('kit');

		expect(wrapper.emitted('update:query')).toEqual([['kit']]);
	});

	it('emits cancel on Escape, and never clears the field itself', async () => {
		// The list owns what Escape MEANS — clear a query, or hand focus back to the first row
		// when there is none — because only it knows whether there is a row to hand focus to.
		const wrapper = line({ query: 'kit' });

		await wrapper.find('input').trigger('keydown', { key: 'Escape' });

		expect(wrapper.emitted('cancel')).toHaveLength(1);
		expect(wrapper.emitted('update:query')).toBeUndefined();
	});

	it('debounces the announcement so a five-character query announces once', async () => {
		vi.useFakeTimers();
		const wrapper = line();

		for (const value of ['c', 'ce', 'cel', 'cell', 'cella']) {
			await wrapper.setProps({ query: value, shown: 1, total: 4 });
		}
		const announced = wrapper.find('.rp-project-filter__announcement').text();
		vi.advanceTimersByTime(1000);
		await wrapper.vm.$nextTick();

		// Before the debounce settles the live region still holds the PREVIOUS text, so a
		// screen reader is not read five ratios for one word. The VISIBLE count moved on the
		// first keystroke and is already correct — that is the case above.
		expect(announced).toBe('4 projects');
		expect(wrapper.find('.rp-project-filter__announcement').text()).toBe('1 of 4');
		vi.useRealTimers();
	});
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectFilterLine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the filter line**

Create `src/presentation/views/ProjectFilter.vue`:

```vue
<script setup lang="ts">
/**
 * The Home surface's filter line (design spec §7) — an input across the pane, quiet at rest,
 * with the count at its trailing edge.
 *
 * **The count is the pane's STATE LINE, not decoration**, which is the discipline the declined
 * teletext candidate donated to this direction: `4 projects` at rest and `2 of 4` while
 * filtering, so the field has a job at every vault size. The direction's own recorded risk was
 * that two projects turn a search field into furniture; this is the answer to it.
 *
 * **It owns no state.** The query is the LIST's, handed down and emitted back — so Escape's
 * meaning, the no-match block and the row highlighting all read one value. A field holding its
 * own draft would be a second answer to what is being filtered.
 *
 * **Escape EMITS rather than clearing**, because what Escape means depends on state this
 * component cannot see: with a query it clears and focus stays; with none it hands focus to the
 * first row, and only the list knows whether there is one.
 */
import { onBeforeUnmount, ref, useId, watch } from 'vue';
import { tr } from '../i18n/strings';

const props = defineProps<{ query: string; shown: number; total: number }>();
defineEmits<{ 'update:query': [value: string]; cancel: [] }>();

/**
 * `useId` rather than a hard-coded id, and `app.config.idPrefix` is set at BOTH `createApp`
 * sites (`app-id-prefix.ts`) so two Vue apps' ids cannot collide — the mechanism design slice
 * 16's `FieldError` established.
 */
const inputId = useId();

/**
 * What the LIVE REGION currently holds, which lags the visible count by one debounce.
 *
 * A `role="status"` re-read on every keystroke reads a five-character query five times, each
 * announcement interrupting the last — the field becomes unusable with a screen reader on
 * exactly the gesture it exists for.
 *
 * **This is the ANNOUNCEMENT only, and the visible count is not it.** An earlier version
 * rendered this string as the count itself, which made the pane's own state line wrong for
 * 400ms after every keystroke — and indefinitely while the user keeps typing, since each
 * keystroke restarts the timer. The rows filter immediately, so the line could read
 * `4 projects` above two rows: the count is *the state* (§3's teletext discipline, the whole
 * reason the filter is not furniture), and a state line that lags the state it reports is the
 * one thing it must not be. Only the spoken version settles.
 */
const announced = ref(countText());
let pending: ReturnType<typeof setTimeout> | undefined;

function countText(): string {
	if (props.query.trim().length === 0) {
		return props.total === 1
			? tr('view.project.count-one')
			: tr('view.project.count-many', { count: String(props.total) });
	}
	return tr('view.project.filter.matches', {
		shown: String(props.shown),
		total: String(props.total),
	});
}

watch(
	() => [props.query, props.shown, props.total],
	() => {
		clearTimeout(pending);
		pending = setTimeout(() => {
			announced.value = countText();
		}, 400);
	},
);

// A timer outliving its component is a leak with behaviour attached — this view remounts per
// navigation, so one is created and abandoned on every one of them.
onBeforeUnmount(() => {
	clearTimeout(pending);
});
</script>

<template>
	<div class="rp-project-filter">
		<!-- A visually-hidden real `<label>`. A placeholder is not a label and does not
		     become one; the input carries no placeholder at all, so nothing reads as a
		     value that is not one. -->
		<label
			class="rp-project-filter__label"
			:for="inputId"
		>{{ tr('view.project.filter.label') }}</label>
		<input
			:id="inputId"
			class="rp-project-filter__input"
			type="text"
			:value="query"
			@input="$emit('update:query', ($event.target as HTMLInputElement).value)"
			@keydown.esc.stop="$emit('cancel')"
		>
		<!--
			THE VISIBLE COUNT, immediate. `aria-hidden` because the live region below carries the
			same fact for assistive technology, and two elements announcing one number is how a
			screen reader ends up saying it twice.
		-->
		<span
			class="rp-project-filter__count"
			aria-hidden="true"
		>{{ countText() }}</span>
		<!--
			THE ANNOUNCEMENT, debounced and visually hidden. Separate from the line above because
			the two have different timing requirements and one element cannot have both: the
			state line must be immediate to be a state line, and the announcement must settle or
			a five-character query interrupts itself five times.
		-->
		<span
			class="rp-project-filter__announcement"
			role="status"
		>{{ announced }}</span>
	</div>
</template>
```

- [ ] **Step 8: Add the filter's rules**

Append to `styles/project-list.css`:

```css
.rp-project-filter {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	padding: 0 var(--size-4-2) var(--size-2-2);
}

/*
 * VISUALLY HIDDEN, not `display: none` and not `hidden` — the label and the announcement must
 * reach assistive technology, and both of those take an element out of the accessibility tree
 * along with the picture. The announcement is hidden because the count beside it is already on
 * screen saying the same thing.
 */
.rp-project-filter__label,
.rp-project-filter__announcement {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

/* Quiet at rest: the host's own input chrome, taking the pane's slack so the count sits at the
   trailing edge whatever the pane's width. */
.rp-project-filter__input {
	flex-grow: 1;
	min-width: 0;
}

.rp-project-filter__input:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

.rp-project-filter__count {
	flex-shrink: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-variant-numeric: tabular-nums;
}

/*
 * WEIGHT, NOT COLOUR, for the matched run — the house rule (*colour reinforces, it never
 * carries*) applied to a highlight, and a second channel by construction rather than by a
 * contrast measurement somebody has to take.
 */
.rp-project-row__match {
	font-weight: var(--font-semibold);
}
```

- [ ] **Step 9: Highlight the matched run in the row**

In `src/presentation/views/ProjectRow.vue`, add an optional prop and the runs, then replace the
name span's content:

```typescript
const props = defineProps<{ project: ProjectSummaryDto; query?: string }>();
```

```typescript
/**
 * The name, split around the matched run. `query` is OPTIONAL because two callers draw a row
 * with no filter above it — the Continue group and the harness's own prototype — and defaulting
 * to no match is the honest answer for both rather than a flag each has to remember to pass.
 */
const runs = computed(() =>
	splitMatch(props.project.name, props.query ?? '', nameCollator(currentLanguage())),
);
```

```vue
		<span
			class="rp-project-list__name"
			:title="project.name"
		><span
			v-for="(run, at) in runs"
			:key="at"
			:class="{ 'rp-project-row__match': run.matched }"
		>{{ run.text }}</span></span>
```

The `<span>`s are written without whitespace between them deliberately: Vue's default
`whitespace: 'condense'` removes whitespace between two elements only when it contains a
newline, and a name split into runs must not gain or lose a character. This is the
`ZonePanelprototype` defect read from the other side.

Add a test to `tests/presentation/views/projectRow.test.ts`:

```typescript
	it('marks the matched run by weight, keeping the name’s own characters', () => {
		const wrapper = mount(ProjectRow, {
			props: { project: { ...PROJECT, name: 'Küche' }, query: 'kuche' },
		});

		expect(wrapper.find('.rp-project-row__match').text()).toBe('Küche');
		expect(wrapper.find('.rp-project-list__name').text()).toBe('Küche');
	});

	it('renders the whole name as one unmarked run with no query', () => {
		expect(row().findAll('.rp-project-row__match')).toHaveLength(0);
		expect(row().find('.rp-project-list__name').text()).toBe('House Renovation 2026');
	});
```

- [ ] **Step 10: Wire the filter into the list**

In `src/presentation/views/ProjectList.vue`:

```typescript
import ProjectFilter from './ProjectFilter.vue';
import { matchesQuery } from './projectFilter';

/**
 * NOT PERSISTED, per §7 — it resets on remount, which is every navigation. A query surviving a
 * round trip into a project would have the pane come back showing a filtered vault the user has
 * no memory of typing.
 */
const query = ref('');

const matching = computed(() =>
	ordered.value.filter((project) => matchesQuery(project.name, query.value, collator)),
);
```

and change `active`/`completed` to filter `matching` rather than `ordered`. Render the filter
above the groups **under `v-if="projects.length > 0"`**, passing `:shown="matching.length"` and
`:total="projects.length"`, with `@update:query="query = $event"`; leave `@cancel` unhandled until
Task 8, which is where Escape's two meanings are built.

**The guard is the spec's region 2 condition ("at least one project loaded"), and it is
load-bearing rather than defensive.** `selectRenovationProjectEmptyState` answers `null` on
`unreadable > 0` before it looks at the length, so a vault whose every project note is unreadable
renders `ProjectList` with `projects=[]` — the state §9's own row describes. Unguarded, the filter
then states `0 projects` about a vault that demonstrably holds projects this build could not read,
which is the notice beside it being contradicted by the line above it. The group headings are
already guarded (`v-if="active.length > 0"` / `completed.length > 0`), so the filter is the only
region in this task that could draw over an empty list; that was checked rather than assumed.

Pass `:query="query"` to every `ProjectRow`.

- [ ] **Step 11: Run everything and commit**

Run: `npm run check`

```bash
git add src/presentation/views/projectFilter.ts src/presentation/views/ProjectFilter.vue \
  src/presentation/views/ProjectRow.vue src/presentation/views/ProjectList.vue \
  styles/project-list.css tests/presentation/views/
git commit -m "$(cat <<'EOF'
Filter the project list by name, with the count as the state line

At rest the field is the pane's count; typing turns it into a ratio. Matching
goes through the same base-sensitivity collator that orders the list, so a
German vault matches Küche when the user types kuche — which a toLowerCase
comparison does not.

The matched run is marked by weight, never colour. The announcement is
debounced so a five-character query is read once; the rows themselves filter
immediately and do not animate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 7: Filtered to nothing — the signature interaction

§3's signature interaction and §9's `Filtered to nothing` row. When the filter excludes every
project, the last thing in the list region is a create action carrying the typed text —
`New project named "Cellar conversion"` — which opens `NewProjectForm` with the name pre-filled.

**This is the direction earning its form.** A dead end becomes the fastest path to the thing the
user was looking for and did not have; it is what a launcher is *for*, and no other dealt
structure could have produced it. Build it as specified, not as a bare "no results" line.

**Two actions, both ordinary tab stops:** `Clear filter` and the create action. §7 says they
replace the two list stops in the tab sequence, which they do by simply being the only things
there.

**Files:**
- Modify: `src/presentation/views/ProjectList.vue`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `src/presentation/views/NewProjectForm.vue`
- Modify: `styles/project-list.css`
- Test: `tests/presentation/views/projectListNoMatch.test.ts`
- Test: `tests/presentation/views/newProjectForm.test.ts` (existing — extend)
- Test: `tests/presentation/views/viewRootCreateProject.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `ProjectFilter`'s query, `matchesQuery`.
- Produces:
  - `ProjectList` emit widens: `create: [initialName: string]` — the empty string from the
    header button, the typed query from the no-match action.
  - `NewProjectForm` gains prop `initialName?: string`.
  - `ViewRoot.onCreateProject(initialName = '')`.

- [ ] **Step 1: Write the failing no-match test**

Create `tests/presentation/views/projectListNoMatch.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECTS: ProjectSummaryDto[] = [
	{
		id: 'p1',
		name: 'Kitchen',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 1,
		lastWorked: null,
	},
];

async function filteredToNothing() {
	const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });
	await wrapper.find('.rp-project-filter__input').setValue('Cellar conversion');
	return wrapper;
}

describe('ProjectList filtered to nothing', () => {
	it('says so, naming the query', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__no-match').text()).toContain(
			'No project matches “Cellar conversion”.',
		);
	});

	it('draws no group at all rather than an empty one', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__group--projects').exists()).toBe(false);
		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(0);
	});

	it('is NEVER the empty state', async () => {
		const wrapper = await filteredToNothing();

		// `renovationProject.noProjects` says "create your first project" and this vault has
		// one. The empty state is a claim about the VAULT; this is a claim about the QUERY.
		expect(wrapper.find('.rp-empty-state').exists()).toBe(false);
	});

	it('offers to become the project the query names', async () => {
		const wrapper = await filteredToNothing();

		expect(wrapper.find('.rp-project-list__create-named').text()).toBe(
			'New project named “Cellar conversion”',
		);
	});

	it('emits create carrying the typed text, so the form opens pre-filled', async () => {
		const wrapper = await filteredToNothing();

		await wrapper.find('.rp-project-list__create-named').trigger('click');

		// The signature interaction: the dead end becomes the fastest path to the thing the
		// user was looking for and did not have.
		expect(wrapper.emitted('create')).toEqual([['Cellar conversion']]);
	});

	it('clears the filter and restores every row', async () => {
		const wrapper = await filteredToNothing();

		await wrapper.find('.rp-project-list__clear-filter').trigger('click');

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(1);
		expect(wrapper.find('.rp-project-list__no-match').exists()).toBe(false);
	});

	it('emits an empty name from the header button, which opens an empty form', async () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.find('.rp-project-list__create').trigger('click');

		expect(wrapper.emitted('create')).toEqual([['']]);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectListNoMatch.test.ts`
Expected: FAIL — no `.rp-project-list__no-match` in the DOM.

- [ ] **Step 3: Build the no-match block**

In `src/presentation/views/ProjectList.vue`, widen the emit and add the block after the two
groups:

```typescript
defineEmits<{ open: [projectId: string]; create: [initialName: string]; createAsset: [] }>();
```

```vue
		<!--
			THE SIGNATURE INTERACTION (design spec §3). A query that matches nothing offers to
			become a project: the dead end is turned into the fastest path to the thing the user
			was looking for and did not have. It is what a launcher is FOR, and it is why this
			block carries an action rather than only a sentence.

			Never the empty state. `renovationProject.noProjects` is a claim about the VAULT and
			this is a claim about the QUERY — a vault with fifty projects can be here.
		-->
		<div
			v-if="query.trim().length > 0 && matching.length === 0"
			class="rp-project-list__no-match"
		>
			<p class="rp-project-list__no-match-line">
				{{ tr('view.project.filter.none', { query: query.trim() }) }}
			</p>
			<button
				type="button"
				class="rp-project-list__clear-filter"
				@click="query = ''"
			>
				{{ tr('view.project.filter.clear') }}
			</button>
			<button
				type="button"
				class="rp-project-list__create-named"
				@click="$emit('create', query.trim())"
			>
				{{ tr('view.project.create-named', { query: query.trim() }) }}
			</button>
		</div>
```

Change the header button to `@click="$emit('create', '')"`.

- [ ] **Step 4: Add its rules**

Append to `styles/project-list.css`:

```css
/*
 * The no-match block sits where the rows would have been, so the eye lands on it rather than
 * hunting: same horizontal padding as a row, the actions stacked under the sentence rather than
 * beside it, because `New project named "…"` carries the user's own typing and is as long as
 * whatever they typed.
 */
.rp-project-list__no-match {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--size-2-2);
	padding: var(--size-4-2);
}

.rp-project-list__no-match-line {
	margin: 0;
	color: var(--text-muted);
}

.rp-project-list__no-match .rp-project-list__create-named,
.rp-project-list__no-match .rp-project-list__clear-filter {
	/* The name the user typed can be long, so this wraps rather than pushing the pane wide. */
	max-width: 100%;
	white-space: normal;
	text-align: left;
}

.rp-project-list__no-match .rp-project-list__create-named:focus-visible,
.rp-project-list__no-match .rp-project-list__clear-filter:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}
```

- [ ] **Step 5: Run the no-match test**

Run: `npx vitest run tests/presentation/views/projectListNoMatch.test.ts`
Expected: PASS, 7 cases.

- [ ] **Step 6: Pre-fill the form**

In `src/presentation/views/NewProjectForm.vue`, add the prop and use it. `INITIAL` is a
module-level constant shared by every mount, so it must not be mutated — build the form's own
initial from it:

```typescript
const props = defineProps<{
	// … existing members unchanged …
	/**
	 * The name to open with, from the Home surface's signature interaction: a query that
	 * matched nothing offers to become a project, and the form arrives carrying what the user
	 * typed. Empty from every other caller.
	 *
	 * Optional rather than required, so the two existing call sites and every existing test
	 * mount are unchanged — which the compiler enforces rather than a sweep.
	 */
	initialName?: string;
}>();
```

```typescript
const form = useFormCommit<CreateProjectInput, { project: Loaded<Project> }>({
	// A fresh object per mount, never `INITIAL` itself: that constant is module-level and
	// shared by every mount of this form, and `useFormCommit` holds its argument as the value a
	// cancel resyncs to.
	initial: { ...INITIAL, name: props.initialName ?? '' },
	dispatch: props.dispatch,
	errorMap: NEW_PROJECT_ERRORS,
	toUserMessage: trError,
	logger: props.logger,
});
```

Add to `tests/presentation/views/newProjectForm.test.ts`:

```typescript
	it('opens with the name it was given, and that name is submitted', async () => {
		const wrapper = mountForm({ initialName: 'Cellar conversion' });

		expect((wrapper.find('#new-project-name').element as HTMLInputElement).value).toBe(
			'Cellar conversion',
		);
	});

	it('opens empty when given no name', () => {
		expect((mountForm().find('#new-project-name').element as HTMLInputElement).value).toBe('');
	});
```

(Adjust the selector to whatever `newProjectForm.test.ts` already uses to reach the name input —
that file's existing cases name it.)

- [ ] **Step 7: Thread it through the view**

In `src/presentation/views/ViewRoot.vue`:

```typescript
async function onCreateProject(initialName = ''): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-project.title'),
		component: NewProjectForm,
		props: {
			dispatch: (input: CreateProjectInput) => context.commands.createProject.execute(input),
			busy: newProjectBusy,
			logger: context.commands.logger,
			// The Home surface's signature interaction. `EmptyState`'s `@action` emits nothing,
			// so the default carries that caller unchanged.
			initialName,
		},
		busy: newProjectBusy,
	});
	if (result === 'cancel') return;
	await hydrate();
}
```

The `<ProjectList>` binding becomes `@create="onCreateProject"`, which passes the emitted name
straight through. The `<EmptyState>` binding stays `@action="onCreateProject"` — that event
carries no payload, so the parameter takes its default.

Add to `tests/presentation/views/viewRootCreateProject.test.ts`:

```typescript
	it('opens the form pre-filled when the list asks for a named project', async () => {
		const wrapper = await mountView({ projects: [PROJECT] });

		await wrapper.find('.rp-project-filter__input').setValue('Cellar conversion');
		await wrapper.find('.rp-project-list__create-named').trigger('click');

		expect(dialogs.current?.props.initialName).toBe('Cellar conversion');
	});

	it('opens it empty from the empty state, whose action carries no payload', async () => {
		const wrapper = await mountView({ projects: [] });

		await wrapper.find('.rp-empty-state__action').trigger('click');

		// `EmptyState` emits `action` with nothing. Without the parameter's default this is
		// `undefined`, and the form's name field opens holding the string "undefined".
		expect(dialogs.current?.props.initialName).toBe('');
	});
```

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/ProjectList.vue src/presentation/views/ViewRoot.vue \
  src/presentation/views/NewProjectForm.vue styles/project-list.css tests/presentation/views/
git commit -m "$(cat <<'EOF'
Offer to become the project a query did not find

The signature interaction: when the filter excludes every row, the last thing
in the list region is a create action carrying the typed text, opening the
form pre-filled. Never the empty state — that is a claim about the vault and
this is a claim about the query.

The form's initial is built fresh per mount rather than mutating the shared
module-level constant.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 8: The keyboard model

§7's table and its roving-`tabindex` ruling, which is the part of the spec a builder is most
likely to get wrong — an earlier draft of the spec itself did, and its own text records the
correction.

**Roving `tabindex` applies to the row lists and to NOTHING ELSE.** Its purpose is to bound an
*unbounded* set — a vault of thirty projects must not cost thirty tabs to walk past — and
everything else on this surface is a small bounded set with no such problem.

**Every visible control is reachable by Tab alone.** The arrows and `Mod+N` are ACCELERATORS
over that sequence, never a substitute for part of it: a control reachable only by a shortcut
fails `PRODUCT.md`'s full-keyboard-support requirement, which the spec binds itself to.

The tab sequence, in DOM order: `New project` → the filter → `Continue` → `Open` → the
`Projects` list *(one stop)* → the `Completed` `<summary>` → the `Completed` list when expanded
*(one stop)* → `New asset`. In the filtered-to-nothing state the two list stops are replaced by
`Clear filter` and `New project named "…"`, which are ordinary stops.

**Rows stay ordinary `<button>`s.** `role="listbox"` was considered and refused: a listbox
option may not contain its own controls, and the row's facts and warning are content a listbox
would flatten into one string.

**Files:**
- Create: `src/presentation/views/useRovingFocus.ts`
- Modify: `src/presentation/views/ProjectList.vue`
- Modify: `src/presentation/views/ProjectRow.vue`
- Test: `tests/presentation/views/projectListKeyboard.test.ts`

**Interfaces:**
- Consumes: `ProjectRow`'s root button.
- Produces:
  - `useRovingFocus(container: Ref<HTMLElement | null>, selector: string)` returning
    `{ activeIndex: Ref<number>; onKeydown(event: KeyboardEvent): boolean; syncFromFocus(event: FocusEvent): void; clamp(length: number): void; focusFirst(): void }`
    — `onKeydown` answers whether it CONSUMED the key, and `syncFromFocus` is what keeps the
    index pointing at the row that actually has focus rather than the last one an arrow moved to.
  - `ProjectRow` gains prop `tabbable?: boolean` (default `true`), driving `tabindex`.

- [ ] **Step 1: Write the failing keyboard test**

Create `tests/presentation/views/projectListKeyboard.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

function project(name: string, over: Partial<ProjectSummaryDto> = {}): ProjectSummaryDto {
	return {
		id: name,
		name,
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
		...over,
	};
}

const THREE = [project('Attic'), project('Bathroom'), project('Cellar')];

// `attachTo: document.body` because every case here reads `document.activeElement`, and a
// detached tree cannot hold focus at all — a case asserting a focus move against one passes or
// fails for reasons that have nothing to do with the code.
function list(projects = THREE) {
	return mount(ProjectList, { props: { projects }, attachTo: document.body });
}

describe('ProjectList keyboard', () => {
	it('costs ONE tab stop for a list of any length', () => {
		const rows = list().findAll('.rp-project-list__row');

		// Roving: exactly one row is tabbable and the rest are reachable by arrow. Thirty
		// projects must not cost thirty tabs to walk past — that is what roving is FOR, and it
		// is applied to the row lists and to nothing else on this surface.
		expect(rows.filter((row) => row.attributes('tabindex') !== '-1')).toHaveLength(1);
		expect(rows[0].attributes('tabindex')).toBe('0');
	});

	it('moves focus down and up through the rows', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');

		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		expect(document.activeElement).toBe(rows[1].element);

		await rows[1].trigger('keydown', { key: 'ArrowUp' });
		expect(document.activeElement).toBe(rows[0].element);
	});

	it('stops at the ends rather than wrapping', async () => {
		// A wrap makes ArrowUp at the top jump to the bottom of a thirty-row list, which reads
		// as the pane having scrolled somewhere the user did not ask to go.
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');

		await rows[0].trigger('keydown', { key: 'ArrowUp' });

		expect(document.activeElement).toBe(rows[0].element);
	});

	it('opens the focused project on Enter', async () => {
		const wrapper = list();

		await wrapper.findAll('.rp-project-list__row')[1].trigger('keydown', { key: 'Enter' });

		// A `<button>` activates on Enter natively; this asserts the row is one, so nothing
		// reimplements activation and nothing has to.
		expect(wrapper.emitted('open')).toEqual([['Bathroom']]);
	});

	it('seeds the filter from a printable character typed at the list', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');

		await rows[0].trigger('keydown', { key: 'c' });

		const input = wrapper.find('.rp-project-filter__input');
		expect(document.activeElement).toBe(input.element);
		// SEEDS it, rather than only focusing: a user typing `cellar` at the list must not lose
		// the `c`. That is the launcher's keyboard entry, and it is why no autofocus is needed.
		expect((input.element as HTMLInputElement).value).toBe('c');
	});

	it('ignores a modified keystroke, which belongs to the host', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');

		await rows[0].trigger('keydown', { key: 'p', ctrlKey: true });

		// Ctrl+P is Obsidian's command palette. Seeding the filter from it would swallow every
		// host shortcut a user presses while a row has focus.
		expect(document.activeElement).toBe(rows[0].element);
	});

	it('leaves Space to the button it was pressed on', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');

		await rows[0].trigger('keydown', { key: ' ' });

		// `' '.length === 1`, so Space passes a bare printable-character test — and a row is a
		// `<button>`, whose native activation is Enter AND Space. Seeding from it would either
		// suppress that activation or do both at once: open the project and leave a space in
		// the field. Nothing is lost, because a query never usefully begins with a space.
		expect(document.activeElement).toBe(rows[0].element);
		expect((wrapper.find('.rp-project-filter__input').element as HTMLInputElement).value).toBe('');
	});

	it('enters the results with ArrowDown from the filter', async () => {
		// §7's table says the arrows work from `filter or list`. Bound to the list alone, a
		// keyboard user reaches the field and cannot get out of it into the rows.
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(wrapper.findAll('.rp-project-list__row')[0].element);
	});

	it('enters an EXPANDED Completed group when there are no active rows', async () => {
		// A vault whose projects are all finished, or a query matching only completed ones.
		// Returning whenever `active` is empty leaves those visible results unreachable by
		// keyboard — the only way in, for that vault, is this fall-through.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })] },
			attachTo: document.body,
		});
		await wrapper.find('.rp-project-list__completed > summary').trigger('click');
		const input = wrapper.find('.rp-project-filter__input');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(
			wrapper.findAll('.rp-project-list__completed .rp-project-list__row')[0].element,
		);
	});

	it('hands Escape to an expanded Completed group when there are no active rows', async () => {
		// The sibling of the ArrowDown case above, and the one the first fix missed: Escape in
		// an already-empty filter asked `active` alone, so on a vault of only completed
		// projects the arrows worked and Escape did nothing.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })] },
			attachTo: document.body,
		});
		await wrapper.find('.rp-project-list__completed > summary').trigger('click');
		const input = wrapper.find('.rp-project-filter__input');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(
			wrapper.findAll('.rp-project-list__completed .rp-project-list__row')[0].element,
		);
	});

	it('does NOT enter a collapsed Completed group', async () => {
		// Moving focus onto a row the user cannot see is worse than not moving. The summary is
		// an ordinary tab stop and opening it is the gesture that makes those rows reachable.
		const wrapper = mount(ProjectList, {
			props: { projects: [project('Attic', { status: 'COMPLETE' })] },
			attachTo: document.body,
		});
		const input = wrapper.find('.rp-project-filter__input');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'ArrowDown' });

		expect(document.activeElement).toBe(input.element);
	});

	it('costs ONE tab stop for the Completed list too', async () => {
		const wrapper = mount(ProjectList, {
			props: {
				projects: [
					project('Attic', { status: 'COMPLETE' }),
					project('Bathroom', { status: 'COMPLETE' }),
					project('Cellar', { status: 'AS_BUILT' }),
				],
			},
			attachTo: document.body,
		});
		await wrapper.find('.rp-project-list__completed > summary').trigger('click');

		const rows = wrapper.findAll('.rp-project-list__completed .rp-project-list__row');

		// Its own controller, not the Projects one. Without it every completed project keeps
		// `tabindex="0"` — the exact cost roving exists to remove, in the group most likely to
		// be long, and the group §7's sequence names as one stop.
		expect(rows.filter((row) => row.attributes('tabindex') !== '-1')).toHaveLength(1);
	});

	it('clamps each group against ITS OWN rows, not the filter’s total', async () => {
		// One active row and two completed rows match while the active cursor sits at 2:
		// clamping against `matching.length` (3) does nothing, and the sole active row is left
		// at `tabindex="-1"` — so Tab skips the Projects group entirely, silently.
		const wrapper = mount(ProjectList, {
			props: {
				projects: [
					project('Match one'),
					project('Match two', { status: 'COMPLETE' }),
					project('Match three', { status: 'AS_BUILT' }),
					project('Other'),
					project('Another'),
				],
			},
			attachTo: document.body,
		});
		const rows = wrapper.findAll('.rp-project-list__group--projects .rp-project-list__row');
		await rows[0].trigger('focus');
		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		await rows[1].trigger('keydown', { key: 'ArrowDown' });

		await wrapper.find('.rp-project-filter__input').setValue('Match');

		const active = wrapper.findAll('.rp-project-list__group--projects .rp-project-list__row');
		expect(active).toHaveLength(1);
		expect(active[0].attributes('tabindex')).toBe('0');
	});

	it('clears a query on Escape and keeps the caret in the field', async () => {
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		await input.setValue('cel');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'Escape' });

		expect((input.element as HTMLInputElement).value).toBe('');
		expect(document.activeElement).toBe(input.element);
	});

	it('hands focus to the first row on Escape in an empty field', async () => {
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		await input.trigger('focus');

		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(wrapper.findAll('.rp-project-list__row')[0].element);
	});

	it('survives Escape with an empty field and no rows to hand focus to', async () => {
		// Filtered to nothing: the two list stops are replaced by two ordinary actions, so
		// there is no row. Nothing must throw and the caret must stay put.
		const wrapper = list();
		const input = wrapper.find('.rp-project-filter__input');
		await input.setValue('zzz');
		await input.trigger('keydown', { key: 'Escape' });
		await input.trigger('keydown', { key: 'Escape' });

		expect(document.activeElement).toBe(input.element);
	});

	it('keeps the active row in range when the filter shortens the list', async () => {
		const wrapper = list();
		const rows = wrapper.findAll('.rp-project-list__row');
		await rows[0].trigger('focus');
		await rows[0].trigger('keydown', { key: 'ArrowDown' });
		await rows[1].trigger('keydown', { key: 'ArrowDown' });

		await wrapper.find('.rp-project-filter__input').setValue('Attic');

		// Index 2 does not exist any more. Without a clamp the roving group has NO tabbable
		// member and the list becomes unreachable by Tab — silently, for the rest of the mount.
		const left = wrapper.findAll('.rp-project-list__row');
		expect(left).toHaveLength(1);
		expect(left[0].attributes('tabindex')).toBe('0');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectListKeyboard.test.ts`
Expected: FAIL on the first case — every row is tabbable.

- [ ] **Step 3: Write the roving composable**

Create `src/presentation/views/useRovingFocus.ts`:

```typescript
import { ref, type Ref } from 'vue';

/**
 * One tab stop for a list of any length, with the arrows moving inside it (design spec §7).
 *
 * **Roving exists to bound an UNBOUNDED set, and that is the whole of when to reach for it.** A
 * vault of thirty projects must not cost thirty tabs to walk past; every other control on this
 * surface is a small bounded set with no such problem, so none of them is in a roving group.
 * The spec's own earlier draft got this wrong in the other direction — "three tab stops, not
 * thirty" left four independent actions off the sequence entirely, while the same document
 * promised a visible focus indicator at every stop.
 *
 * **The rows stay ordinary `<button>`s.** A `role="listbox"` was considered and refused: a
 * listbox option may not contain its own controls, and the row's facts and warning are content
 * a listbox would flatten into one string. Roving `tabindex` over buttons gets the same
 * navigation with none of that cost — and Enter activation stays the browser's own.
 *
 * `onKeydown` answers whether it CONSUMED the key, so a caller can fall through to its own
 * handling for everything else — the printable-character seeding, in this surface's case —
 * rather than this module having to know about it.
 */
/**
 * Exported by NAME rather than left as a `ReturnType<typeof useRovingFocus>` at the call sites:
 * `ProjectList` passes a controller as a parameter (two groups, one handler), and an exported
 * signature naming a type its own module does not export is the `private-type-leak` `fallow`
 * reports as an `error` here.
 */
export interface RovingFocus {
	activeIndex: Ref<number>;
	onKeydown: (event: KeyboardEvent) => boolean;
	syncFromFocus: (event: FocusEvent) => void;
	clamp: (length: number) => void;
	focusFirst: () => void;
}

export function useRovingFocus(container: Ref<HTMLElement | null>, selector: string): RovingFocus {
	const activeIndex = ref(0);

	function members(): HTMLElement[] {
		const root = container.value;
		return root === null ? [] : Array.from(root.querySelectorAll<HTMLElement>(selector));
	}

	function focusAt(index: number): void {
		const all = members();
		// CLAMPED rather than wrapped. ArrowUp at the top of a thirty-row list jumping to the
		// bottom reads as the pane having scrolled somewhere the user did not ask to go.
		const next = Math.max(0, Math.min(index, all.length - 1));
		activeIndex.value = next;
		all[next]?.focus();
	}

	return {
		activeIndex,

		/**
		 * **The index follows the FOCUS, and without this it followed only its own arrows.**
		 * `activeIndex` was written by `focusAt` and `clamp` alone, so a row focused any other
		 * way — a click, a Tab into the middle of the list, a programmatic focus — left it
		 * pointing at the previously active row. Two things broke together: an arrow then moved
		 * relative to that stale row (click row 3 with the index at 0, press ArrowDown, land on
		 * row 2), and the `tabindex="0"` stayed on row 1, so the clicked row was `-1` and
		 * shift-tabbing back into the list returned to the wrong place.
		 *
		 * ONE listener on the CONTAINER (`@focusin`), not one per row: `focusin` bubbles, a
		 * per-row binding is a list that goes stale at the next row kind, and this one call site
		 * covers every path focus can arrive by — the arrows included, where it is a harmless
		 * write of the value `focusAt` just set.
		 */
		syncFromFocus(event: FocusEvent): void {
			const index = members().indexOf(event.target as HTMLElement);
			if (index !== -1) activeIndex.value = index;
		},

		onKeydown(event: KeyboardEvent): boolean {
			// A modified arrow belongs to the host — Obsidian binds several — so only the bare
			// key moves focus here.
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
			if (event.key === 'ArrowDown') {
				focusAt(activeIndex.value + 1);
				return true;
			}
			if (event.key === 'ArrowUp') {
				focusAt(activeIndex.value - 1);
				return true;
			}
			return false;
		},

		/**
		 * Keep the active index inside a list that just got shorter — the filter is what makes
		 * this necessary, and the failure without it is silent and total: an index past the end
		 * leaves the group with NO member carrying `tabindex="0"`, so the whole list stops being
		 * reachable by Tab for the rest of the mount, with nothing on screen to say why.
		 */
		clamp(length: number): void {
			if (activeIndex.value > length - 1) activeIndex.value = Math.max(0, length - 1);
		},

		focusFirst(): void {
			focusAt(0);
		},
	};
}
```

- [ ] **Step 4: Make the row's tabbability a prop**

In `src/presentation/views/ProjectRow.vue`, add to the props and to the button:

```typescript
	/**
	 * Whether this row is the roving group's one tab stop. `true` by default so a row drawn
	 * OUTSIDE a roving group — the Continue row, the harness prototype — is an ordinary
	 * control, which is what §7 requires of it.
	 */
	tabbable?: boolean;
```

```vue
		:tabindex="(tabbable ?? true) ? 0 : -1"
```

- [ ] **Step 5: Wire the list's keyboard**

In `src/presentation/views/ProjectList.vue`:

```typescript
import { useRovingFocus } from './useRovingFocus';

/**
 * ONE CONTROLLER PER ROW LIST, because §7's sequence names both of them as one stop each.
 *
 * `Completed` having its own is not symmetry for its own sake: without it every completed
 * project keeps `ProjectRow`'s default `tabindex="0"`, so a vault with twenty finished projects
 * costs twenty tabs to walk past — the exact cost roving exists to remove, reintroduced in the
 * group most likely to be long.
 */
const activeList = ref<HTMLElement | null>(null);
const completedList = ref<HTMLElement | null>(null);
const activeRoving = useRovingFocus(activeList, '.rp-project-list__row');
const completedRoving = useRovingFocus(completedList, '.rp-project-list__row');

/**
 * Whether the `Completed` disclosure is open, tracked from the element's own `toggle` event
 * rather than held as the source of truth: the `<details>` stays native (§11 — the host
 * announces the state), so this FOLLOWS it and never drives it.
 *
 * It exists for one question — may the filter's arrows enter that group — and nothing else
 * reads it. A `v-if` on the rows would be the wrong mechanism: the group's expanded state is
 * deliberately not persisted, and collapsing it must not unmount rows the roving controller has
 * an index into.
 */
const completedOpen = ref(false);

/**
 * EACH GROUP CLAMPS AGAINST ITS OWN ROWS, never against the filter's total match count.
 *
 * The two differ the moment a query matches a completed project and not an active one: with one
 * active row and two completed matches, a cursor at index 2 clamped against `matching.length`
 * (3) does not move, and the sole active row is left at `tabindex="-1"` — so Tab skips the
 * `Projects` group for the rest of the mount, silently, with nothing on screen to say why.
 */
watch(active, (rows) => activeRoving.clamp(rows.length));
watch(completed, (rows) => completedRoving.clamp(rows.length));

/**
 * The launcher's keyboard ENTRY, and the reason no autofocus is needed: a printable character
 * typed at the list moves focus to the filter and SEEDS it with that character.
 *
 * Seeds rather than only focusing — a user typing `cellar` must not lose the `c`. A modified
 * keystroke is left alone: `Ctrl+P` is Obsidian's command palette, and swallowing it here would
 * take every host shortcut a user presses while a row has focus.
 */
function onListKeydown(event: KeyboardEvent, roving: RovingFocus): void {
	if (roving.onKeydown(event)) {
		event.preventDefault();
		return;
	}
	// `Space` is CARVED OUT, and it is the one exclusion that matters. `' '.length === 1`, so a
	// bare printable test admits it — and a row is a `<button>`, whose native activation is
	// Enter AND Space. Seeding from it would either suppress that activation or do both at
	// once: open the project and leave a space in the field. Nothing is lost: a query never
	// usefully begins with a space.
	if (event.key === ' ') return;
	if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
	event.preventDefault();
	query.value = event.key;
	void nextTick(() => {
		filterInput.value?.focus();
	});
}

/**
 * The arrows work from the FILTER as well as from a list — §7's table says `filter or list`,
 * and bound to the lists alone a keyboard user reaches the field and cannot get out of it into
 * the results.
 *
 * **It enters whichever group actually has visible rows**, `Projects` first: that is what the
 * user is almost always filtering toward. Falling through to `Completed` is not symmetry — it
 * is the only way into a vault whose projects are all finished, or into a query that matches
 * only completed ones, and a first version that returned whenever `active` was empty left
 * exactly those results unreachable by keyboard.
 *
 * **Only while `Completed` is EXPANDED**, which is why its disclosure state is tracked at all:
 * arrowing into rows the user cannot see would move focus somewhere invisible, which is worse
 * than not moving. Collapsed, the `<summary>` is an ordinary tab stop and opening it is the
 * gesture that makes those rows reachable — so nothing is lost.
 */
function onFilterKeydown(event: KeyboardEvent): void {
	if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
	if (focusFirstRow()) event.preventDefault();
}

/**
 * Move focus to the first row the user can actually reach, and say whether there was one.
 *
 * **A FUNCTION rather than the same two branches written twice**, because it was written twice
 * and the second copy was wrong. `onFilterKeydown` gained the `Completed` fall-through and
 * `onFilterCancel` — three lines below it, asking the identical question for Escape — kept
 * `active.value.length > 0` alone, so on a vault of only completed projects the arrows entered
 * the group and Escape did nothing. A partial fix that reads exactly like a complete one, in
 * the sibling door, which is this repository's oldest recorded shape.
 *
 * `Projects` first, then `Completed` only while it is EXPANDED: focus must not move to a row
 * the user cannot see. `false` means there is nowhere to go — an empty vault, or a query
 * filtered to nothing — and both callers leave the caret where it is.
 */
function focusFirstRow(): boolean {
	if (active.value.length > 0) {
		activeRoving.focusFirst();
		return true;
	}
	if (completedOpen.value && completed.value.length > 0) {
		completedRoving.focusFirst();
		return true;
	}
	return false;
}

/**
 * Escape's TWO meanings, which is why `ProjectFilter` emits rather than deciding: with a query
 * it clears and the caret stays; with none it hands focus to the first row — and when there is
 * no row to hand it to (filtered to nothing, or an empty vault) it does nothing at all rather
 * than dropping focus to `<body>`.
 */
function onFilterCancel(): void {
	if (query.value.length > 0) {
		query.value = '';
		return;
	}
	// The SAME question the arrows ask, asked through the same function — see `focusFirstRow`
	// for why this is not two branches written out twice.
	focusFirstRow();
}
```

with `const filterInput = ref<HTMLInputElement | null>(null);`, `ProjectFilter` exposing its
input through `defineExpose({ focus })` or a `ref` forwarded via its root — whichever the
existing house style uses; a `defineExpose({ focus: () => input.value?.focus() })` on
`ProjectFilter` is the smaller surface and is what the test's `document.activeElement`
assertion reads.

Bind, on the `Projects` group's `<ul>`: `ref="activeList"`,
`@keydown="(e) => onListKeydown(e, activeRoving)"`, `@focusin="activeRoving.syncFromFocus"`, and
`:tabbable="index === activeRoving.activeIndex.value"` on each row in it. The same four on the
`Completed` group's `<ul>` with `completedList` and `completedRoving`.

**`@focusin` and not `@focus`**: `focus` does not bubble, so a handler on the `<ul>` would never
hear a row take it, and the binding would read as present while doing nothing. It goes on the
same element as `@keydown` for the same reason that one does — the container is what both the
arrows and the focus are about, and a per-row binding is a list that goes stale. On the filter:
`@cancel="onFilterCancel"` and `@keydown="onFilterKeydown"` — which means `ProjectFilter` must
re-emit its input's `keydown` beside the `cancel` it already emits, since the arrows are the
list's business and Escape's two meanings are too.

Export the composable's return type from `useRovingFocus.ts` as
`export interface RovingFocus { … }` so `onListKeydown`'s second parameter can name it — a
`ReturnType<typeof useRovingFocus>` at the call site would be the private-type-leak `fallow`
reports as an `error`.

- [ ] **Step 5a: The open-note accelerators, keyboard and pointer**

§7 gives a row a SECOND destination — the project's own note — reached three ways: `Mod+↵` from
the keyboard, and middle-click or modifier-click from the pointer. They are one destination and
belong in one task; the foot legend and the manual case both claim they exist.

`ProjectRow` gains an emit and three handlers:

```typescript
defineEmits<{ open: [projectId: string]; openNote: [projectId: string] }>();
```

```vue
		@click="onClick"
		@auxclick="onAuxClick"
		@keydown="onKeydown"
```

```typescript
/**
 * A modifier-click opens the NOTE, a plain click NAVIGATES. `metaKey` on macOS and `ctrlKey`
 * elsewhere is the host's own convention for "open this somewhere else", and Obsidian uses it
 * throughout its file explorer.
 */
function onClick(event: MouseEvent): void {
	if (event.metaKey || event.ctrlKey) {
		event.preventDefault();
		emit('openNote', props.project.id);
		return;
	}
	emit('open', props.project.id);
}

/**
 * The MIDDLE button, which fires `auxclick` rather than `click` — a `click` handler testing
 * `event.button === 1` never runs, because the middle button does not produce one.
 *
 * `event.button === 1` is still tested, because `auxclick` fires for the secondary button too
 * and the right button belongs to the context menu.
 */
function onAuxClick(event: MouseEvent): void {
	if (event.button !== 1) return;
	// Chrome opens its autoscroll widget on a middle press otherwise — the same rule the plan
	// editor's canvas states for its own middle button.
	event.preventDefault();
	emit('openNote', props.project.id);
}

/**
 * `Mod+↵` opens the note; a bare `↵` is the button's own native activation and is deliberately
 * NOT handled here — intercepting it would reimplement what the element already does.
 */
function onKeydown(event: KeyboardEvent): void {
	if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
	event.preventDefault();
	emit('openNote', props.project.id);
}
```

`ProjectList` re-emits `openNote` beside `open` from every row, including the Continue row's
`Open`. `ViewRoot` binds it to the door that already exists:

```typescript
/**
 * The project's own NOTE — the only thing on this surface that still opens one, and the reason
 * `RenovationProjectDeps.openProject` exists: `presentation/` may not reach Obsidian's vault and
 * a `ProjectSummaryDto` carries no path.
 *
 * `'missing'` means the row pointed at a project the vault no longer holds, so the list it was
 * drawn from is stale and gets re-read — `ProjectDetailState` states the identical rule for its
 * own `Open note`. `'failed'` buys no re-read: the fault door has already reported it and
 * nothing about the list is known to be wrong.
 */
async function onOpenNote(id: string): Promise<void> {
	if ((await context.openProject(id)) === 'missing') await hydrate();
}
```

Cases in `projectListKeyboard.test.ts` and `projectRow.test.ts`:

```typescript
	it('opens the note on Mod+Enter, and navigates on a bare Enter', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('keydown', { key: 'Enter', ctrlKey: true });
		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
		// A bare Enter is the button's own native activation — reaching `click`, not this
		// handler — so nothing here must emit for it.
		expect(wrapper.emitted('open')).toBeUndefined();
	});

	it('opens the note on a middle click, which fires auxclick and never click', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('auxclick', { button: 1 });

		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
	});

	it('ignores the secondary button, which belongs to the context menu', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('auxclick', { button: 2 });

		expect(wrapper.emitted('openNote')).toBeUndefined();
	});

	it('opens the note on a modifier click and navigates on a plain one', async () => {
		const wrapper = row();

		await wrapper.find('.rp-project-list__row').trigger('click', { ctrlKey: true });
		await wrapper.find('.rp-project-list__row').trigger('click');

		expect(wrapper.emitted('openNote')).toEqual([['p1']]);
		expect(wrapper.emitted('open')).toEqual([['p1']]);
	});
```

Plus one in `viewRootOpenProject.test.ts` asserting a `'missing'` outcome re-hydrates and a
`'failed'` one does not — watched failing with the `=== 'missing'` test inverted, because both
arms otherwise look alike from outside.

- [ ] **Step 6: Run the keyboard test**

Run: `npx vitest run tests/presentation/views/projectListKeyboard.test.ts tests/presentation/views/projectRow.test.ts`
Expected: PASS.

- [ ] **Step 7: Mutation-check the three guards**

Change `watch(active, …)` to `watch(matching, (rows) => activeRoving.clamp(rows.length))`.
Expected: the own-rows clamp case goes RED — the sole active row is left at `tabindex="-1"`.
This is the mutation that matters most, because it is the version the plan shipped first and
every other case in the file passes against it.

Restore it, then delete the `event.key === ' '` carve-out.
Expected: the Space case goes RED.

Restore it, then delete the `event.key.length !== 1` guard.
Expected: the modified-keystroke case goes RED.

Both are the measurement this repository asks for when a fix is a REFUSAL or a GUARD: the suite
covers the thing refused, not the thing still allowed.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/useRovingFocus.ts src/presentation/views/ProjectList.vue \
  src/presentation/views/ProjectRow.vue src/presentation/views/ProjectFilter.vue tests/presentation/views/
git commit -m "$(cat <<'EOF'
Give the launcher its keyboard, without an autofocus

Roving tabindex on the row lists and nothing else: it bounds an unbounded
set, and every other control here is a small bounded one that stays an
ordinary tab stop. Rows remain buttons — a listbox option may not contain its
own controls, and this row has facts and a warning.

A printable character at the list seeds the filter with it, which is the
keyboard entry a pane that must not steal the caret needs. Escape means two
things and the list decides which, because only it knows whether there is a
row to hand focus back to.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 9: The foot line, and `New project` as a real command

§5's region 7 and the locked `Mod+N` decision. The foot line carries the key legend at the
leading edge and `New asset` at the trailing edge, both quiet, and it is present in **both** the
empty state and the populated state.

**This removes today's duplication.** `ProjectList`'s header `New asset` button and `ViewRoot`'s
`.rp-view-aside` are two independently-decided homes for one action; they become one. Its exit
condition is recorded: it leaves this surface when Epic 6's catalogue surface exists, which is
where a creation action for a vault-wide catalogue entry belongs.

**Region 1 is absent from the empty state**, which is a ruling rather than an omission: the
empty state's own action already IS `New project`, so a header carrying a second one puts two
identical actions on a pane that has exactly one thing to do. The vault-holds-at-least-one
condition on regions 1 and 2 is what states this.

**`Mod+N` is a registered command.** Obsidian binds hotkeys to command ids, so a pane-local
handler cannot be rebound and may collide with a user's own binding. Registering also puts the
action in the palette, which is where the stranger looks.

**Files:**
- Modify: `src/plugin/RenovationPlannerPlugin.ts`
- Modify: `src/presentation/views/ProjectList.vue`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `styles/project-list.css`, `styles/forms.css`
- Test: `tests/plugin/registration.test.ts` (existing — extend)
- Test: `tests/presentation/views/projectListFoot.test.ts`

**Interfaces:**
- Consumes: `revealView`, the plugin's existing `openProject` door.
- Produces:
  - Command id `new-project`, name from `command.new-project`.
  - `modifierLabel(): string` in `src/presentation/views/modifierLabel.ts` — `⌘` or `Ctrl`.
  - `ProjectList` renders the foot; `ViewRoot` renders it in the empty state too.

- [ ] **Step 1: Write the failing foot test**

Create `tests/presentation/views/projectListFoot.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const ONE: ProjectSummaryDto[] = [
	{
		id: 'p1',
		name: 'Kitchen',
		status: 'IDEA',
		currency: 'EUR',
		libraryOverlap: false,
		planCount: 0,
		lastWorked: null,
	},
];

describe('ProjectList foot line', () => {
	it('holds the key legend and New asset, and nothing else', () => {
		const wrapper = mount(ProjectList, { props: { projects: ONE } });
		const foot = wrapper.find('.rp-project-list__foot');

		expect(foot.find('.rp-project-list__keys').exists()).toBe(true);
		expect(foot.find('.rp-view-aside__create-asset').exists()).toBe(true);
	});

	it('has exactly ONE New asset affordance on the whole surface', () => {
		// The duplication this region removes: `ProjectList`'s header button and `ViewRoot`'s
		// `.rp-view-aside` were two independently-decided homes for one action.
		const wrapper = mount(ProjectList, { props: { projects: ONE } });

		expect(wrapper.findAll('.rp-view-aside__create-asset')).toHaveLength(1);
		expect(wrapper.find('.rp-project-list__create-asset').exists()).toBe(false);
	});

	it('emits createAsset from the foot', async () => {
		const wrapper = mount(ProjectList, { props: { projects: ONE } });

		await wrapper.find('.rp-view-aside__create-asset').trigger('click');

		expect(wrapper.emitted('createAsset')).toHaveLength(1);
	});

	it('names the modifier in the legend rather than hard-coding one', () => {
		const legend = mount(ProjectList, { props: { projects: ONE } })
			.find('.rp-project-list__keys')
			.text();

		expect(legend).toContain('open');
		expect(legend).toMatch(/⌘|Ctrl/);
		// `{mod}` is resolved at the call site — a fact about the machine, not the language —
		// so an unresolved hole would be a visible bug report rather than a silent one.
		expect(legend).not.toContain('{mod}');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/projectListFoot.test.ts`
Expected: FAIL — no `.rp-project-list__foot`.

- [ ] **Step 3: Write the modifier label**

Create `src/presentation/views/modifierLabel.ts`:

```typescript
import { Platform } from 'obsidian';

/**
 * `⌘` on macOS, `Ctrl` everywhere else — resolved at the CALL SITE and never baked into a
 * locale string, because it is a fact about the machine rather than about the language. That
 * is why `view.project.keys` carries a `{mod}` hole in both locales.
 *
 * `Platform.isMacOS` rather than sniffing `navigator.platform`: Obsidian answers this itself,
 * and this is `presentation/`, which may name `obsidian`.
 */
export function modifierLabel(): string {
	return Platform.isMacOS ? '⌘' : 'Ctrl';
}
```

Check `tests/helpers/obsidian-mock.ts` models `Platform.isMacOS`; if not, add it answering
`false`, and say so in that fake's own "what is NOT modelled" note — a fake thinner than the
real thing is this repository's most-repeated defect.

- [ ] **Step 4: Build the foot line**

In `src/presentation/views/ProjectList.vue`, remove the header's `New asset` button and add the
foot after the groups and the no-match block:

```vue
		<!--
			THE FOOT LINE (design spec §5, region 7). Present in BOTH the empty state and the
			populated one, which is what removes today's duplication: the list header's own
			`New asset` button and `ViewRoot`'s `.rp-view-aside` were two independently-decided
			homes for one action and are now one.

			Its EXIT CONDITION, recorded so it is not rediscovered: this action leaves the
			surface when Epic 6's catalogue surface exists, which is where a creation action for
			a vault-wide catalogue entry belongs. Until then it is here, quiet, at the foot.
		-->
		<p class="rp-project-list__foot rp-view-aside">
			<span class="rp-project-list__keys">{{ keyLegend }}</span>
			<button
				type="button"
				class="rp-view-aside__create-asset"
				@click="$emit('createAsset')"
			>
				{{ tr('view.asset.create') }}
			</button>
		</p>
```

```typescript
import { modifierLabel } from './modifierLabel';

// Resolved once per mount, like the collator: the platform does not change under a running app.
const keyLegend = tr('view.project.keys', { mod: modifierLabel() });
```

It keeps the `rp-view-aside__create-asset` class so `forms.css`'s existing focus-ring rule for
it still applies — that rule was measured and argued for, and renaming the class would be
re-litigating it inside a composition change.

- [ ] **Step 5: Move the empty state's aside into the same shape**

In `src/presentation/views/ViewRoot.vue`, the `.rp-view-aside` paragraph beside the empty state
becomes the same foot line, so the empty and populated states draw one composition. Replace the
existing comment with:

```vue
					<!--
						THE SAME FOOT LINE the populated state draws (design spec §5, region 7),
						so a fresh vault can still build a catalogue and the two states are one
						composition rather than two that happen to agree.

						A SIBLING of the empty state rather than a second action ON it, which is
						unchanged: `EMPTY_STATE_CONTENT` is a typed registry whose entries carry
						one action each, so a second one would be a widening every entry inherits
						for the sake of one. The key legend is omitted here — there is no list to
						navigate and no note to open, so a legend would advertise keys that do
						nothing.
					-->
					<p class="rp-project-list__foot rp-view-aside">
						<button
							type="button"
							class="rp-view-aside__create-asset"
							@click="onCreateAsset"
						>
							{{ tr('view.asset.create') }}
						</button>
					</p>
```

- [ ] **Step 6: Add the foot's rules**

Append to `styles/project-list.css`:

```css
/*
 * The legend at the LEADING edge and the action at the TRAILING one, both quiet. `space-between`
 * because it has two children to push apart; when the empty state draws only the action, that
 * one child sits at the leading edge, which is what `flex-start` would have given anyway.
 *
 * `.rp-view-aside`'s own muted colour and smaller size come from `forms.css` and are not
 * restated — that block is imported first and this class is added beside it, so both apply.
 */
.rp-project-list__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-4-2);
	/* `forms.css` centres `.rp-view-aside` for the empty state's sake; the foot is a row across
	   the pane, so the alignment is stated here rather than inherited. */
	text-align: left;
	padding: var(--size-4-4) var(--size-4-2) var(--size-4-2);
}

.rp-project-list__keys {
	/* A legend, never a control: it is not focusable and it names keys rather than offering
	   them. Middle-click and modifier-click are undiscoverable on their own, and this is where
	   they are discovered. */
	color: var(--text-faint);
}
```

- [ ] **Step 7: Register the command**

In `src/plugin/RenovationPlannerPlugin.ts`, beside the other `addCommand` calls:

```typescript
		/**
		 * `Mod+N` as a REAL command rather than a pane-local key handler — the Home design
		 * spec's §14 decision, taken.
		 *
		 * Obsidian binds hotkeys to command IDs, so a pane-local handler cannot be rebound and
		 * may silently collide with one the user already has. Registering also puts the action
		 * in the palette, which is where a stranger to this plugin looks — and it is why the
		 * pane's key legend names the modifier rather than claiming a binding the user may have
		 * changed.
		 *
		 * No default hotkey is declared. `hotkeys: []` would claim `Mod+N` for this plugin on
		 * every install, over whatever the user already had there.
		 *
		 * The id is DATA: a user's hotkey is bound to it, so it does not get renamed.
		 */
		this.addCommand({
			id: 'new-project',
			name: tr('command.new-project'),
			callback: () => {
				this.newProject();
			},
		});
```

`newProject()` reveals the Renovation project view through the same `revealView` door every
other input uses — ONE action, every input — and then asks it to open the form. Follow
`openProjectDetail`'s existing shape for how a command reaches a view; if the view has no door
for "open the create dialog", add one to `RenovationProjectView` beside `sync`, and route the
pane's own header button through it too, so there is one function rather than two.

- [ ] **Step 8: Extend the registration test**

Add to `tests/plugin/registration.test.ts`:

```typescript
	it('registers New project as a command, so a user can bind and rebind it', () => {
		const command = plugin.commands.find((c) => c.id === 'new-project');

		expect(command?.name).toBe('New project');
		// No default binding: `hotkeys: []` would claim Mod+N on every install, over whatever
		// the user already had there.
		expect(command?.hotkeys).toBeUndefined();
	});
```

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run check`

Expect `viewRootCreateAsset.test.ts` to need its selector updated from
`.rp-project-list__create-asset` to `.rp-view-aside__create-asset` in the populated case. That is
the duplication being removed showing up as a test edit, which is what it should look like.

```bash
git add src/plugin/RenovationPlannerPlugin.ts src/presentation/views/ \
  styles/project-list.css styles/forms.css tests/
git commit -m "$(cat <<'EOF'
Give New asset one home, and New project a real command

The foot line carries the key legend and New asset, in both the empty and the
populated state — replacing two independently-decided call sites with one,
with its exit condition recorded: it leaves when Epic 6's catalogue surface
exists.

Mod+N is a registered command rather than a pane-local key, so Obsidian owns
the binding, a user can rebind it, and it appears in the palette. No default
hotkey is declared: claiming Mod+N on every install would take it from
whatever the user already had.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 10: Where a continue context is stored

§13's Constraint 1, which is the one a builder is most likely to get wrong by reflex, so it is
built before anything renders it.

**It is plugin-local, not vault data, and it does NOT go in a project note.** Writing a visit
into a note makes opening a project dirty the vault and produces a sync conflict between the
desk and the site. **It does not go through `settingsFrom` either**, which is a trust boundary
that drops keys this version does not declare — an outstanding context would be silently
discarded by the next settings save.

So: its own plugin-local JSON file beside `data.json`, with its own parse-and-fall-back-to-absent
rule. `SequenceMarkerFileStore` is the precedent in this exact repository, for this exact reason,
and its `TextFileAdapter` is reused rather than a second file surface being declared.

**Whether it is device-local is NOT settled, and step 0 is where that is decided.** The file
sits under the plugin's manifest directory, inside `.obsidian/`, which Obsidian Sync can be
configured to carry — so the context may follow the vault to another device. A per-device API
outside the vault tree would restore the stronger guarantee; whether the pinned typings expose
one is unverified here and is step 0's to answer, because asserting an API this plan has not
seen is the shape it keeps being corrected for.

**What is stored, per the locked §14 decision: `{ projectId, planId }` and NO leaf identity.**
Continue restores by navigating THIS leaf through the doors a row already uses, so "restoring
into a leaf Obsidian has already restored differently" cannot arise — there is no leaf id to be
wrong about. Surviving a restart follows for free.

**Files:**
- Create: `src/presentation/views/continueContext.ts`
- Create: `src/plugin/continueContextStore.ts`
- Modify: `src/presentation/views/RenovationProjectContext.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts`, `src/plugin/composition-root.ts`
- Test: `tests/plugin/continueContextStore.test.ts`

**Interfaces:**
- Consumes: `TextFileAdapter` from
  `src/infrastructure/obsidian/persistence/SequenceMarkerFileStore.ts`, `Logger`.
- Produces:
  - `interface ContinueContext { readonly projectId: string; readonly planId: string | null }`
  - `parseContinueContext(raw: unknown): ContinueContext | null`
  - `class ContinueContextStore { read(): Promise<ContinueContext | null>; write(context: ContinueContext): Promise<void> }`
  - `RenovationProjectDeps.continueContext: () => Promise<ContinueContext | null>`
  - `RenovationProjectDeps.rememberContinue: (context: ContinueContext) => void`

- [ ] **Step 0: Check whether a per-device storage door exists**

With `node_modules` installed, grep the pinned typings for a storage API outside the vault tree:

```bash
grep -n "LocalStorage\|localStorage" node_modules/obsidian/obsidian.d.ts
```

**Why this is a step rather than a footnote.** The file below lives under the plugin's manifest
directory — inside `.obsidian/` — and Obsidian Sync can carry community-plugin settings, so the
context can follow the vault to another device. If the typings expose a per-device door that a
`Plugin` can reach through its own `this.app` (never the global `app`, which the marketplace
rules refuse), use it and keep the strong guarantee. If they do not, the file stays and the
narrowed claim in the store's docblock is the honest one.

Either way, **write down what the grep printed** — the point is that the guarantee matches the
mechanism, and this plan has already been corrected once for asserting the stronger one.

- [ ] **Step 1: Write the failing store test**

Create `tests/plugin/continueContextStore.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ContinueContextStore } from '../../src/plugin/continueContextStore';
import { parseContinueContext } from '../../src/presentation/views/continueContext';
import { RecordingLogger } from '../helpers/logger';

function adapter(initial?: string) {
	const files = new Map<string, string>();
	if (initial !== undefined) files.set('p/continue.json', initial);
	return {
		files,
		exists: (path: string) => Promise.resolve(files.has(path)),
		read: (path: string) => Promise.resolve(files.get(path) ?? ''),
		write: (path: string, data: string) => {
			files.set(path, data);
			return Promise.resolve();
		},
		remove: (path: string) => {
			files.delete(path);
			return Promise.resolve();
		},
	};
}

function store(initial?: string) {
	const io = adapter(initial);
	return { io, store: new ContinueContextStore(io, 'p/continue.json', new RecordingLogger()) };
}

describe('parseContinueContext', () => {
	it('reads a whole context', () => {
		expect(parseContinueContext({ projectId: 'p1', planId: 'plan-1' })).toEqual({
			projectId: 'p1',
			planId: 'plan-1',
		});
	});

	it('reads a project-only context, planId absent', () => {
		expect(parseContinueContext({ projectId: 'p1' })).toEqual({ projectId: 'p1', planId: null });
	});

	it('falls back to ABSENT for anything it does not recognise', () => {
		// The parse-and-fall-back-to-absent rule §13 asks for. A malformed context is not an
		// error a user can act on and not a state worth reporting: the Continue group simply
		// does not render, which is a state the surface already draws for a fresh vault.
		for (const raw of [null, undefined, 42, 'p1', {}, { projectId: '' }, { projectId: 7 }]) {
			expect(parseContinueContext(raw)).toBeNull();
		}
	});

	it('drops a planId that is not a non-empty string rather than refusing the whole context', () => {
		// The project half is still usable, and Continue on a project is a real gesture.
		expect(parseContinueContext({ projectId: 'p1', planId: 7 })).toEqual({
			projectId: 'p1',
			planId: null,
		});
	});
});

describe('ContinueContextStore', () => {
	it('round-trips a context through the file', async () => {
		const { store: s } = store();

		await s.write({ projectId: 'p1', planId: 'plan-1' });

		expect(await s.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	it('answers null when no file has been written', async () => {
		expect(await store().store.read()).toBeNull();
	});

	it('answers null for malformed JSON rather than throwing', async () => {
		// This file is on disk beside `data.json` and a user can open it. A throw here would
		// reach `onMounted`, where nothing awaits it.
		expect(await store('{ not json').store.read()).toBeNull();
	});

	it('answers null for a file this build does not recognise the shape of', async () => {
		expect(await store('{"schemaVersion":99,"context":{"projectId":"p1"}}').store.read()).toBeNull();
	});

	it('writes a versioned envelope, so a future shape has something to branch on', async () => {
		const { io, store: s } = store();

		await s.write({ projectId: 'p1', planId: null });

		expect(JSON.parse(io.files.get('p/continue.json') ?? '')).toEqual({
			schemaVersion: 1,
			context: { projectId: 'p1', planId: null },
		});
	});

	it('answers a read AFTER a write that is still in flight', async () => {
		// The navigate-then-remount sequence: remember, navigate, the view remounts and reads.
		// An unqueued read is answered the previous file — and the context is read once per
		// mount, so that stale answer is the whole mount's, not an instant's.
		const io = adapter();
		let release = (): void => {};
		const plain = io.write;
		io.write = (path, data) =>
			new Promise((resolve) => {
				release = () => {
					void plain(path, data);
					resolve();
				};
			});
		const s = new ContinueContextStore(io, 'p/continue.json', new RecordingLogger());

		const writing = s.write({ projectId: 'p1', planId: 'plan-1' });
		const reading = s.read();
		release();
		await writing;

		expect(await reading).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	it('keeps the LATEST context when two writes overlap', async () => {
		// The ordinary gesture: open a project, then open a plan inside it. Both writes are in
		// flight together because `rememberContinue` discards its promise, and an adapter that
		// finishes them out of order lets the older project-only context erase the newer one.
		const io = adapter();
		const settle: (() => void)[] = [];
		const plain = io.write;
		io.write = (path, data) =>
			new Promise((resolve) => {
				settle.push(() => {
					void plain(path, data);
					resolve();
				});
			});
		const s = new ContinueContextStore(io, 'p/continue.json', new RecordingLogger());

		const first = s.write({ projectId: 'p1', planId: null });
		const second = s.write({ projectId: 'p1', planId: 'plan-1' });
		// The queue means the second write has not even STARTED yet, which is the property:
		// releasing them in the order they were queued is the only order available.
		settle[0]();
		await first;
		settle[1]();
		await second;

		expect(await s.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	it('never rejects on a failed write', async () => {
		// `rememberContinue` is fire-and-forget from a click handler that discards its promise,
		// so a rejection here is an unhandled rejection reaching nobody. A context that failed
		// to persist costs a Continue row; it must not cost an error.
		const io = adapter();
		io.write = () => Promise.reject(new Error('disk full'));

		await expect(
			new ContinueContextStore(io, 'p/continue.json', new RecordingLogger()).write({
				projectId: 'p1',
				planId: null,
			}),
		).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/plugin/continueContextStore.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the shape and its parse**

Create `src/presentation/views/continueContext.ts`:

```typescript
/**
 * What the Home surface remembers about where the user was (design spec §7's Continue).
 *
 * **In `presentation/` because it is the VIEW's shape**, and the plugin-local store below it
 * is what persists it — the same division `RenovationProjectDeps` already draws for
 * `openProject`: the view says what it needs, the composition root knows where it comes from.
 *
 * **No leaf identity is stored, and that is what settles the spec's own open question.** §14
 * asks whether Continue survives an Obsidian restart, on the grounds that "the stored leaf
 * state is durable; the leaf is not". It does, because there is no leaf here to be wrong
 * about: Continue navigates THIS leaf through the doors a row already uses (`navigate` for a
 * project, `openPlan` for a plan), so restoring into a leaf Obsidian has already restored
 * differently cannot arise.
 */
export interface ContinueContext {
	readonly projectId: string;
	/** The plan the user was in, or `null` when they were on the project's detail state. */
	readonly planId: string | null;
}

/**
 * A stored context, or ABSENT — §13's own parse-and-fall-back-to-absent rule.
 *
 * Absent rather than an error, at every failure: this file sits beside `data.json` where a user
 * can open it, and a malformed context is neither something they can act on nor a state worth a
 * notice. The Continue group simply does not render, which is a picture the surface already
 * draws for a fresh vault.
 *
 * A bad `planId` costs the PLAN half only, not the whole context, because Continue on a project
 * is a real gesture and refusing it over a field the user never sees would be the harsher answer.
 */
export function parseContinueContext(raw: unknown): ContinueContext | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const projectId = (raw as { projectId?: unknown }).projectId;
	if (typeof projectId !== 'string' || projectId.length === 0) return null;
	const planId = (raw as { planId?: unknown }).planId;
	return { projectId, planId: typeof planId === 'string' && planId.length > 0 ? planId : null };
}
```

- [ ] **Step 4: Write the store**

Create `src/plugin/continueContextStore.ts`:

```typescript
import type { Logger } from '../application/ports/Logger';
import { KeyedQueues } from '../infrastructure/obsidian/repositories/KeyedQueues';
import type { TextFileAdapter } from '../infrastructure/obsidian/persistence/SequenceMarkerFileStore';
import { parseContinueContext, type ContinueContext } from '../presentation/views/continueContext';

const CONTINUE_CONTEXT_SCHEMA_VERSION = 1;

/**
 * Where the Home surface's Continue context lives — ONE plugin-local JSON file beside
 * `data.json`, and the reasons are §13's Constraint 1 rather than a preference.
 *
 * **Not a project note.** Writing a visit into a note makes merely OPENING a project dirty the
 * vault, and produces a sync conflict between the desk and the site — two devices disagreeing
 * about a fact neither of them was editing.
 *
 * **Not `data.json`'s settings object.** `settingsFrom` is a trust boundary that drops a key
 * this version does not declare, so an outstanding context would be silently discarded by the
 * next settings save. `SequenceMarkerFileStore` is this repository's own precedent for exactly
 * this reasoning, and its `TextFileAdapter` is reused rather than a second file surface being
 * declared — one shape, satisfied by the vault's own adapter as-is.
 *
 * **It MAY follow the vault to another device, and the earlier draft's flat "device-local,
 * Continue does not follow the vault to the phone" was wrong.** This file sits under the
 * plugin's own manifest directory — inside `.obsidian/`, the vault's configuration tree — and
 * Obsidian Sync can be configured to carry community-plugin settings. So on a synced vault with
 * that option on, the last-visit context travels, and two devices overwrite each other's.
 *
 * **The claim is narrowed rather than the storage moved, because the remedy is unverified.**
 * Genuinely per-device storage would need an API outside the vault tree; whether the pinned
 * `obsidian` 1.13.0 typings expose one could not be checked in the session that wrote this
 * (`node_modules` was absent), and asserting an API this plan has not seen is exactly the shape
 * this document keeps being corrected for. **Task 10 step 0 is that check**; if such a door
 * exists, moving there restores the stronger guarantee and this paragraph shrinks back.
 *
 * What the weaker guarantee actually costs is small, which is why it is acceptable meanwhile:
 * the row is an OFFER, both of its ids are re-validated against the vault at every mount, and a
 * context written by another device either resolves — in which case it names real work — or is
 * dropped and the group does not render. The failure mode is a Continue row pointing at what
 * you were doing on the desktop rather than on the phone, not a broken or destructive one.
 *
 * **Neither door ever rejects.** `read` is awaited by a mount that draws a list either way, and
 * `write` is fire-and-forget from a click handler that discards its promise — so a rejection
 * would be an unhandled rejection reaching nobody, which is the one shape `runDetached` exists
 * to prevent. A context that failed to persist costs a Continue row; it must not cost an error.
 */
export class ContinueContextStore {
	/**
	 * **Writes are SERIALIZED, and the race is an ordinary gesture rather than an exotic one.**
	 * `rememberContinue` answers `void` and every caller navigates in the same tick, so two
	 * writes are in flight together the moment a user opens a project and then a plan inside it
	 * — two clicks, seconds apart, which is the flow this feature exists for. Nothing about
	 * `TextFileAdapter.write` promises completion order, so the older project-only write can
	 * land last and erase the newer plan context: Continue would then offer the project the user
	 * passed through rather than the plan they stopped in, intermittently and unreproducibly.
	 *
	 * `KeyedQueues` is what `SequenceMarkerFileStore` already uses one directory over, for the
	 * same file and the same reason. One key, because there is one file.
	 */
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly adapter: TextFileAdapter,
		private readonly path: string,
		private readonly logger: Logger,
	) {}

	/**
	 * **Queued alongside the WRITES, not beside them.** `rememberContinue` starts a
	 * fire-and-forget write and the caller navigates in the same tick; the view then remounts
	 * and `resolveStored` reads. An unqueued read races that write and can be answered the
	 * previous file — or none at all, on the first ever visit — and because the context is read
	 * exactly ONCE per mount, that stale answer is what the Continue row shows for the whole
	 * mount rather than for an instant.
	 *
	 * Serializing the writes and leaving the read outside the queue was the previous version:
	 * it closed write-versus-write and left write-versus-read wide open, which is the same
	 * half-a-fix shape as fixing one door of a pair.
	 */
	read(): Promise<ContinueContext | null> {
		return this.queues.run('continue-context', () => this.readNow());
	}

	private async readNow(): Promise<ContinueContext | null> {
		try {
			if (!(await this.adapter.exists(this.path))) return null;
			const raw: unknown = JSON.parse(await this.adapter.read(this.path));
			if (
				typeof raw !== 'object' ||
				raw === null ||
				(raw as { schemaVersion?: unknown }).schemaVersion !== CONTINUE_CONTEXT_SCHEMA_VERSION
			) {
				// A version this build does not read is DISCARDED rather than migrated, exactly
				// as a sequence marker is: there is nothing here worth a migration path, and the
				// next write replaces it.
				return null;
			}
			return parseContinueContext((raw as { context?: unknown }).context);
		} catch (cause) {
			this.logger.warn('continue-context.read-failed', { cause });
			return null;
		}
	}

	write(context: ContinueContext): Promise<void> {
		return this.queues.run('continue-context', async () => {
			try {
				await this.adapter.write(
					this.path,
					// An ENVELOPE rather than the bare context, so a future shape has something
					// to branch on instead of having to guess from the fields present.
					JSON.stringify({ schemaVersion: CONTINUE_CONTEXT_SCHEMA_VERSION, context }),
				);
			} catch (cause) {
				this.logger.warn('continue-context.write-failed', { cause });
			}
		});
	}
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/plugin/continueContextStore.test.ts`
Expected: PASS, 9 cases.

Adjust `RecordingLogger`'s import path and `logger.warn`'s signature to whatever
`tests/helpers/logger.ts` and `application/ports/Logger` actually declare — read both before
writing the calls rather than after.

- [ ] **Step 6: Add the two deps members**

In `src/presentation/views/RenovationProjectContext.ts`, add to `RenovationProjectDeps`:

```typescript
	/**
	 * The stored continue context, or absent — read ONCE at mount, never subscribed to (design
	 * spec §7: "Validation is a read, not a subscription"). Nothing redirects, nothing
	 * announces, and nothing is retracted later.
	 */
	readonly continueContext: () => Promise<ContinueContext | null>;
	/**
	 * Remember where the user just went. Fire-and-forget by declaration — it answers `void`,
	 * not a promise — because every caller is a click handler that navigates in the same tick
	 * and a failed write costs a row rather than an error.
	 */
	readonly rememberContinue: (context: ContinueContext) => void;
```

Both REQUIRED, so the compiler names every construction site — `makeRenovationProjectView` and
the composition root among them — rather than letting one silently answer `undefined`.

- [ ] **Step 7: Compose it**

In `src/plugin/RenovationPlannerPlugin.ts`, hold ONE store per session beside `markerStore`,
built the same way and for the same reason (the file it points at survives root swaps):

```typescript
	private continueStore: ContinueContextStore | null = null;

	private continueContextStore(logger: Logger): ContinueContextStore {
		this.continueStore ??= new ContinueContextStore(
			this.app.vault.adapter,
			`${this.manifest.dir}/continue-context.json`,
			logger,
		);
		return this.continueStore;
	}
```

In `src/plugin/composition-root.ts`'s `renovationProjectDeps`, add the two members. The store
reaches it the same way `indexScanCompleted` does — through the `options` bundle, because it is
the plugin's and not the root's, and a default here would let a composition forget one and still
compile:

```typescript
		continueContext: () => options.continueContext(),
		rememberContinue: options.rememberContinue,
```

widening that `options` parameter's type accordingly, and passing both from
`RenovationPlannerPlugin`'s `renovationProjectViewDeps()`. `rememberContinue` there is
`(context) => void this.continueContextStore(this.root.logger).write(context)` — the `void` is
correct rather than a lint appeasement, because the store's own `write` cannot reject.

- [ ] **Step 8: Fix every construction site the compiler names, then commit**

Run: `npm run build`, then `npm run check`.

`tests/helpers/makeRenovationProjectView.ts` is one of them and is the one to be careful with:
its own docblock promises a grown constructor requirement "meets every consumer at the same
time", so give it real defaults (`continueContext: () => Promise.resolve(null)`,
`rememberContinue: () => {}`) rather than an `as never`.

```bash
git add src/presentation/views/continueContext.ts src/plugin/continueContextStore.ts \
  src/presentation/views/RenovationProjectContext.ts src/plugin/ tests/
git commit -m "$(cat <<'EOF'
Store the continue context in the plugin, not the vault

One plugin-local JSON file beside data.json: writing a visit into a project
note would dirty the vault on open and conflict between the desk and the
site, and data.json's settings object drops undeclared keys.

No leaf identity is stored, which is what settles the spec's open question
about surviving a restart — Continue navigates this leaf through the doors a
row already uses, so there is no leaf to be wrong about. Device-local is the
stated price: Continue does not follow the vault to the phone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 11: The Continue row

§5's region 3 and §7's Continue. A row in the same armature as every other, distinguished by its
group heading and by carrying a **second action** — never by being a different shape. A raised
card above a flat list is the composition this direction did not lock.

**The group renders only when the stored context resolves to something that still exists.** With
no stored context, or one pointing at a deleted project, the group is ABSENT — not a
placeholder, not a disabled button. The most recently worked project is then simply the first row
of `Projects`, which is where it would be anyway. This is what removes the continue-first
structure's recorded risk without adopting its composition.

**Validation is a READ, not a subscription.** Resolve at hydrate; if it misses, the group does
not render. Nothing redirects, nothing announces, nothing is retracted later.

**The project also appears in `Projects` below, and that duplicate is correct.** `Continue` is an
action and `Projects` is the index; hiding a project from the index because it happens to be
resumable makes the index lie.

**Its two actions are ordinary tab stops**, which is the other half of why this row sits OUTSIDE
the `Projects` list rather than at the top of it: a roving list whose first item contains two of
its own controls is the composite that would force a grid pattern onto everything below it.

**Files:**
- Create: `src/presentation/views/ContinueRow.vue`
- Modify: `src/presentation/views/ProjectList.vue`, `src/presentation/views/ViewRoot.vue`
- Modify: `src/presentation/views/ProjectDetailState.vue` — the only path that opens a plan, and
  therefore the only thing that can ever store a non-null `planId`
- Modify: `styles/project-list.css`
- Test: `tests/presentation/views/continueRow.test.ts`
- Test: `tests/presentation/views/viewRootContinue.test.ts`
- Test: `tests/presentation/views/projectDetailState.test.ts` (existing — extend)

**Interfaces:**
- Consumes: `ContinueContext`, `ProjectSummaryDto`, `context.navigate`, `context.openPlan`,
  `context.continueContext`, `context.rememberContinue`.
- Produces:
  - `ContinueRow` props `{ project: ProjectSummaryDto; planId: string | null }`, emits
    `{ resume: []; open: [] }`.
  - `ProjectList` prop `continueProject?: { project: ProjectSummaryDto; planId: string | null } | null`
    and emits `{ resume: [context: ContinueContext] }`.

- [ ] **Step 1: Write the failing row test**

Create `tests/presentation/views/continueRow.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ContinueRow from '../../../src/presentation/views/ContinueRow.vue';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECT: ProjectSummaryDto = {
	id: 'p1',
	name: 'House Renovation 2026',
	status: 'DESIGN',
	currency: 'EUR',
	libraryOverlap: false,
	planCount: 2,
	lastWorked: '2026-08-14T00:00:00.000Z',
};

function row(planId: string | null = 'plan-1', plan = { id: 'plan-1', name: 'Kitchen' }) {
	return mount(ContinueRow, { props: { project: PROJECT, planId, plan: planId === null ? null : plan } });
}

describe('ContinueRow', () => {
	it('is drawn in the same armature as every other row', () => {
		// Distinguished by its group heading and its second action, NEVER by being a different
		// shape. A raised card above a flat list is the composition this direction did not lock.
		expect(row().find('.rp-project-list__row').exists()).toBe(true);
	});

	it('names the project AND the plan it will resume', () => {
		// §7's diagram is `House Renovation 2026 · Kitchen › Work`. Without the plan half the
		// row cannot answer "which plan will this open" on a project that has several — which
		// is the question Continue exists to answer.
		const text = row().text();

		expect(text).toContain('House Renovation 2026');
		expect(text).toContain('Kitchen');
	});

	it('names the project alone when the context holds no plan', () => {
		// Absent, not blank: an empty slot renders nothing and its neighbours close up.
		expect(row(null).find('.rp-continue__plan').exists()).toBe(false);
	});

	it('dates itself by lastWorked', () => {
		const text = row().text();

		// An ABSOLUTE short date, not a relative time: relative needs a live ticker and makes
		// every test time-dependent.
		expect(text).toMatch(/2026/);
	});

	it('carries two actions, both ordinary controls', () => {
		const wrapper = row();

		expect(wrapper.find('.rp-continue__resume').text()).toBe('Continue');
		expect(wrapper.find('.rp-continue__open').text()).toBe('Open');
		// Ordinary tab stops, not members of a roving group — which is the other half of why
		// this row sits outside the Projects list rather than at the top of it.
		expect(wrapper.find('.rp-continue__resume').attributes('tabindex')).toBeUndefined();
	});

	it('emits resume and open separately', async () => {
		const wrapper = row();

		await wrapper.find('.rp-continue__resume').trigger('click');
		await wrapper.find('.rp-continue__open').trigger('click');

		// Two different destinations: Continue restores where the user was, Open always goes to
		// the project's detail state. That distinction is what the usability script tests.
		expect(wrapper.emitted('resume')).toHaveLength(1);
		expect(wrapper.emitted('open')).toHaveLength(1);
	});

	it('still offers both actions when the context names no plan', () => {
		// Continue on a project is a real gesture: it goes to the detail state, same as Open,
		// and the row does not become a different shape for it.
		const wrapper = row(null);

		expect(wrapper.find('.rp-continue__resume').exists()).toBe(true);
		expect(wrapper.find('.rp-continue__open').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/presentation/views/continueRow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the row**

Create `src/presentation/views/ContinueRow.vue`:

```vue
<script setup lang="ts">
/**
 * Where the user was, as a row (design spec §7).
 *
 * **The same armature as every other row**, distinguished by its group heading and by carrying a
 * SECOND action — never by being a different shape. A raised card above a flat list is the
 * composition this direction did not lock, and drawing one here would be adopting the
 * continue-first structure's form while claiming the launcher's.
 *
 * It is a `<div>` with two `<button>`s rather than a `<button>` with two inside it, which is
 * invalid HTML and is also the composite §7 refuses: a roving list whose first item contains
 * its own controls forces a grid pattern onto everything below it. That is the other half of
 * why this row sits OUTSIDE the `Projects` list rather than at the top of it.
 *
 * **`Continue` and `Open` are two destinations, not one with a shortcut.** Continue restores
 * where the user was — the plan editor, when the context names a plan; the detail state
 * otherwise — and Open ALWAYS opens the detail state. That distinction is A.4's own and it is
 * what the usability script in the workspace prototype spec §13 is written to test.
 */
import { computed } from 'vue';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import { statusLabel } from './statusLabel';
import { currentLanguage, tr } from '../i18n/strings';

const props = defineProps<{
	project: ProjectSummaryDto;
	planId: string | null;
	/** The resolved plan this will resume, or `null` when the context names the project alone. */
	plan: PlanSummaryDto | null;
}>();
defineEmits<{ resume: []; open: [] }>();

/**
 * An ABSOLUTE short date, never a relative time (§8). A relative time needs a live ticker,
 * makes every test time-dependent, and `Last opened yesterday` is a wireframe's nicety rather
 * than a requirement.
 *
 * Empty rather than a dash when there is no date, per the content rule: a slot with nothing in
 * it renders nothing and its neighbours close up.
 */
const worked = computed(() => {
	if (props.project.lastWorked === null) return '';
	return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(
		new Date(props.project.lastWorked),
	);
});
</script>

<template>
	<div class="rp-project-list__row rp-continue">
		<!--
			The project AND the work inside it — §7's diagram is `House Renovation 2026 ·
			Kitchen › Work`, and the plan half is what makes the row answer "which plan will
			this open" on a project that has several. Absent, not blank, when the context names
			no plan: the content rule is that an empty slot renders nothing and its neighbours
			close up.
		-->
		<span
			class="rp-project-list__name"
			:title="plan === null ? project.name : `${project.name} · ${plan.name}`"
		>{{ project.name }}<span
			v-if="plan !== null"
			class="rp-continue__plan"
		> · {{ plan.name }}</span></span>
		<span class="rp-project-row__facts">{{ worked }}</span>
		<span class="rp-project-list__status">{{ statusLabel(project.status) }}</span>
		<button
			type="button"
			class="rp-continue__resume"
			@click="$emit('resume')"
		>
			{{ tr('view.project.continue.resume') }}
		</button>
		<button
			type="button"
			class="rp-continue__open"
			@click="$emit('open')"
		>
			{{ tr('view.project.continue.open') }}
		</button>
	</div>
</template>
```

- [ ] **Step 4: Add its rules**

Append to `styles/project-list.css`:

```css
/*
 * The Continue row is `list-row.css`'s shared row plus two trailing controls. It carries no
 * `cursor: pointer` of its own and no hover background — the row itself is NOT the target here,
 * its two buttons are, and a row-wide hover would promise a click that does nothing.
 */
.rp-project-list__continue .rp-project-list .rp-continue {
	justify-content: space-between;
	gap: var(--size-4-2);
	cursor: default;
}

/*
 * The row itself is not a target here — its two BUTTONS are — so the hover background
 * `list-row.css` gives every row is taken back off. A row-wide hover promises a click that does
 * nothing.
 */
.rp-project-list__continue .rp-project-list .rp-continue:hover {
	background-color: transparent;
}

.rp-project-list__continue .rp-continue__resume,
.rp-project-list__continue .rp-continue__open {
	flex-shrink: 0;
}

.rp-project-list__continue .rp-continue__resume:focus-visible,
.rp-project-list__continue .rp-continue__open:focus-visible {
	outline: 2px solid var(--interactive-accent);
	/* POSITIVE: these are inset controls with room, unlike the edge-to-edge row itself. */
	outline-offset: 2px;
}
```

- [ ] **Step 5: Render the group**

In `src/presentation/views/ProjectList.vue`, add the prop and the group above `Projects`:

```typescript
const props = defineProps<{
	projects: readonly ProjectSummaryDto[];
	/**
	 * The resolved continue context, or absent. RESOLVED by the view, not by this component:
	 * §7's rule is that the group renders only when the stored context points at something that
	 * still exists, and only the view can ask.
	 */
	continueProject?: {
		project: ProjectSummaryDto;
		planId: string | null;
		plan: PlanSummaryDto | null;
	} | null;
}>();
```

```vue
		<!--
			ZERO OR ONE ROW, and absent rather than empty when there is nothing to resume — not a
			placeholder, not a disabled button. With no stored context the most recently worked
			project is simply the first row of `Projects`, which is where it would be anyway.

			The project ALSO appears in `Projects` below, and the duplicate is correct: Continue
			is an action and Projects is the index, so hiding a project from the index because it
			happens to be resumable would make the index lie.
		-->
		<section
			v-if="continueProject"
			class="rp-project-list__group rp-project-list__continue"
		>
			<h3 class="rp-project-list__group-title">
				{{ tr('view.project.group.continue') }}
			</h3>
			<!--
				INSIDE a `.rp-project-list` `<ul>`, exactly like the other two groups, and that is
				load-bearing rather than tidy: every shared row declaration in `list-row.css` and
				`forms.css` is scoped `.rp-project-list .rp-project-list__row` — the descendant
				selector that beats Obsidian's own `button:not(.clickable-icon)` — so a row
				rendered outside that ancestor gets none of `display: flex`, the width, the
				padding, the 24px minimum height or the name's truncation, and the "same armature
				as every other row" claim would be false in the one place it is made.

				It also puts the row inside the container query, so the Continue row narrows with
				its siblings instead of being the one row that does not.

				A list of ONE is the right shape rather than a concession: the group is zero-or-one
				by design, and `<li>` is what `<ul>` may contain.
			-->
			<ul class="rp-project-list">
				<li>
					<ContinueRow
						:project="continueProject.project"
						:plan-id="continueProject.planId"
						:plan="continueProject.plan"
						@resume="$emit('resume', { projectId: continueProject.project.id, planId: continueProject.planId })"
						@open="$emit('open', continueProject.project.id)"
					/>
				</li>
			</ul>
		</section>
```

widening the emits with `resume: [context: ContinueContext]`.

**The Continue group is not filtered.** It is an ACTION rather than a member of the index, so a
query that excludes its project still leaves it offered — and its own row says which project it
is, so nothing is ambiguous. Add a case pinning that, because the opposite is the reflex.

Add one more, in `projectListGroups.test.ts`, because `continueRow.test.ts` mounts the row
standalone and therefore cannot see the thing that matters here:

```typescript
	it('renders the Continue row INSIDE a .rp-project-list, like every other row', () => {
		const wrapper = mount(ProjectList, {
			props: { projects: MIXED, continueProject: { project: MIXED[1], planId: null } },
		});

		// Every shared row declaration is scoped `.rp-project-list .rp-project-list__row` — the
		// descendant selector that beats Obsidian's own `button:not(.clickable-icon)`. Outside
		// that ancestor the row gets no flex, no width, no padding and no 24px floor, and the
		// "same armature" claim is false in the one place it is made. jsdom resolves no CSS, so
		// this asserts the STRUCTURE the selector needs rather than the result.
		expect(wrapper.find('.rp-project-list__continue .rp-project-list .rp-continue').exists()).toBe(
			true,
		);
	});
```

- [ ] **Step 6: Resolve it in the view**

In `src/presentation/views/ViewRoot.vue`:

```typescript
/**
 * The stored context, resolved against the list this mount actually read — §7's "validation is
 * a READ, not a subscription".
 *
 * The PROJECT half is a `computed` over `projects` rather than a second query: it must still
 * exist, and the list in front of us is the freshest answer to that there is. It therefore
 * re-resolves for free on every hydrate, and a project deleted underneath simply stops being
 * found — nothing redirects, nothing announces, nothing is retracted.
 *
 * The PLAN half cannot ride that list, because this surface's list holds projects. It is read by
 * `resolveStored` below and held in `storedPlan`, which is why the two halves are two fields
 * rather than one predicate — and why `resolveStored` runs on every hydrate rather than once at
 * mount. §7 says "resolve the stored ids against the project index AT HYDRATE TIME"; a mount-only
 * read does not do that, and the case it loses is the one Continue exists for. Obsidian restores
 * its leaves BEFORE `onLayoutReady` and the index scan runs FROM it (SDD §47), so a pane restored
 * with the app resolves its plan against an EMPTY index, finds nothing, and pins `storedPlan` to
 * `'gone'` for the life of that mount. The project half self-heals — it is a `computed` over
 * `projects`, which the `ProjectIndexRebuilt` subscription re-hydrates — so the two halves
 * recovered differently and only the one nothing re-ran stayed broken. Continue-across-restart is
 * exactly the flow this feature advertises, so it would have failed in its headline case.
 */
const stored = ref<ContinueContext | null>(null);
/**
 * How the stored context's PLAN resolved: `'none'` when it names no plan, `'gone'` when the
 * plan read did not find it, or the plan itself.
 *
 * **The plan rather than a boolean**, because the row has to NAME it. §7's own Continue diagram
 * is `House Renovation 2026 · Kitchen › Work`, and a first version reduced this read to
 * `true`/`false` — so the row said which project it would resume and not which plan, which on a
 * project with several plans is the one thing a user needs it to say. The read was already being
 * made; only its answer was being thrown away.
 */
const storedPlan = ref<PlanSummaryDto | 'none' | 'gone'>('gone');

const continueProject = computed(() => {
	const resume = stored.value;
	if (resume === null || storedPlan.value === 'gone') return null;
	const project = projects.value.find((candidate) => candidate.id === resume.projectId);
	if (project === undefined) return null;
	return {
		project,
		planId: resume.planId,
		plan: storedPlan.value === 'none' ? null : storedPlan.value,
	};
});
```

Resolve both from inside `hydrate()` — the function `ViewRoot`'s own header already calls "the ONE
read this view has, on every occasion it runs" — rather than from `onMounted`. That gives the
mount, the post-create re-read and the `ProjectIndexRebuilt` subscription the same answer for
free, and it is why no second refresh path is added: a `resolveStored()` call sitting beside each
`hydrate()` is a list of callers that goes stale at the fourth one.

**Running on every hydrate makes `resolveStored` concurrently callable, which it was not at
mount, so it carries the request ticket `store.hydrate` already has** — written into the block
below rather than described above it. Two hydrates can be in flight at once — the create path
awaits its own while the rebuild subscription fires — and without the ticket both resolutions end
in bare assignments to `stored` and `storedPlan`, so the slower earlier one overwrites the newer:
a just-opened plan's context replaced by the one before it, with nothing to say it happened.
Worse than stale, the two fields are written at different awaits, so an interleaving can leave
`storedPlan` describing a different context than `stored` holds — the group then vanishes or
offers the wrong work.

This is the same shape `ProjectStore.hydrate` and `InspectorStore` already use, and the reason
CLAUDE.md gives for it: a store two things hydrate needs a ticket, or the slower earlier read
wins.

```typescript
/**
 * **BOTH ids are resolved, which is what §7 asks for and an earlier draft of this plan did not
 * do**: "resolve the stored ids against the project index at hydrate time, and if EITHER
 * misses, the group does not render."
 *
 * Validating only the project left `onResume` calling `openPlan` on a plan that is gone — and
 * `renovationProjectOpenPlan` reveals a Plan Editor leaf for that id, whose `missing` state
 * draws `editor.plan-missing.*` and asks the user to close the tab. So Continue on a deleted
 * plan opened a dead editor, under a comment in this same plan claiming it "lands on the detail
 * state". It does not, and the comment was the best available description of the defect — this
 * repository's oldest recurring shape, arriving in a document about avoiding it.
 *
 * The plan half costs ONE extra read, and only when a stored context names a plan: the query
 * bundle already carries `listPlansByProject`, so nothing new is commissioned for it. A project
 * whose plans could not be read is treated as a miss — the group is an offer, and an offer that
 * might open a dead editor is worse than no offer.
 */
let resolveTicket = 0;

async function resolveStored(): Promise<void> {
	// Taken BEFORE the first await, and compared before every assignment below: this runs on
	// every hydrate, and two hydrates can be in flight at once.
	const ticket = ++resolveTicket;
	const resume = await context.continueContext();
	if (ticket !== resolveTicket) return;
	stored.value = resume;
	if (resume === null) {
		storedPlan.value = 'gone';
		return;
	}
	if (resume.planId === null) {
		storedPlan.value = 'none';
		return;
	}
	const plans = await context.queries.listPlansByProject(resume.projectId);
	if (ticket !== resolveTicket) return;
	// The matched plan is KEPT, not counted: the row names it.
	const found = isErr(plans)
		? undefined
		: plans.value.plans.find((plan) => plan.id === resume.planId);
	storedPlan.value = found ?? 'gone';
}
```

and handle the new emit:

```typescript
/**
 * Continue's own destination, which is the whole of what makes it different from Open: it
 * restores where the user WAS — the plan editor when the context names one — while Open always
 * goes to the project's detail state.
 *
 * It goes through the SAME doors a row already uses. Nothing here reclaims a leaf by identity,
 * which is what makes surviving a restart a non-question rather than a behaviour to design.
 *
 * The `planId` branch is safe to take unguarded ONLY because `resolveStored` established that
 * the plan exists — this function has no fallback of its own and must not grow one, because a
 * fallback here would be a second answer to a question the resolution already owns.
 */
function onResume(resume: ContinueContext): void {
	if (resume.planId === null) {
		context.navigate(resume.projectId);
		return;
	}
	void context.openPlan(resume.planId);
}
```

and remember on every navigation into a project:

```typescript
			@open="onOpenProject"
```

```typescript
function onOpenProject(id: string): void {
	context.rememberContinue({ projectId: id, planId: null });
	context.navigate(id);
}
```

A named function rather than a template arrow doing two things — that is where the second one
gets dropped by an edit which only meant to change the first.

- [ ] **Step 6a: Remember the PLAN, which is the half nothing else writes**

`ProjectDetailState.vue` opens a plan directly —
`@open-plan="(planId) => void context.openPlan(planId)"` — and that is **the only path in the
app that opens one from this view's tree**. Without a `rememberContinue` there, no gesture ever
stores a non-null `planId`, so `ContinueContext.planId` is always `null`, `resolveStored`'s plan
branch is dead, and **Continue can never resume the plan the user was working in** — which is
the whole of what distinguishes it from `Open`.

The row above remembers a PROJECT; this remembers the plan inside it, and both are needed
because they are two different places the user can have been.

```typescript
/**
 * Where the user is, recorded at the moment they go there. `props.projectId` is this state's
 * own subject, so the pair is complete without a lookup.
 *
 * BEFORE the open rather than after: `openPlan` is fire-and-forget and this must not depend on
 * its resolution, and a context stored for a plan that then failed to open still describes
 * where the user asked to be.
 */
function onOpenPlan(planId: string): void {
	context.rememberContinue({ projectId: props.projectId, planId });
	void context.openPlan(planId);
}
```

bound as `@open-plan="onOpenPlan"`. Add a case to `tests/presentation/views/projectDetail*.test.ts`
asserting `rememberContinue` was called with both ids — watched failing with the call removed,
because every other case in that file passes without it.

- [ ] **Step 7: Write the view test**

Create `tests/presentation/views/viewRootContinue.test.ts` with cases for: the group rendering
when the stored context names a project the list holds; the group ABSENT when it names one the
list does not; the group absent with no stored context; **the group absent when it names a plan
`listPlansByProject` does not return**; **the group absent when that plan read REFUSES**; the
group rendering when the context names no plan at all (so the plan read is never made);
`Continue` on a plan context calling `openPlan` and not `navigate`; `Continue` on a project
context calling `navigate`; `Open` always calling `navigate`; and opening a row calling
`rememberContinue` before navigating. Mount through `makeRenovationProjectView`'s helper with
`continueContext` returning each case's value.

Two of these are the ones this design turns on, and each needs watching fail against a
DIFFERENT mutation:

- **the deleted PROJECT** — watch it fail with the `find` removed, so it pins the resolution
  rather than merely the absence;
- **the deleted PLAN** — watch it fail with `storedPlan` hard-coded to a plan. That is the
  version the plan shipped first, and every other case in the file passes against it, which is
  exactly why the case has to exist. Assert `openPlan` was NOT called, not merely that the group
  is absent: a build that draws the group and opens a dead editor is what the case is about.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add src/presentation/views/ContinueRow.vue src/presentation/views/ProjectList.vue \
  src/presentation/views/ViewRoot.vue src/presentation/views/ProjectDetailState.vue \
  styles/project-list.css tests/presentation/views/
git commit -m "$(cat <<'EOF'
Offer to continue where the user was

A row in the same armature as every other, carrying a second action — never a
raised card, which is the composition this direction did not lock. The group
is absent rather than disabled when the stored context points at a project
that is gone, so the most recently worked project is simply the first row of
Projects, which is where it would be anyway.

Validation is a read against the list this mount already has, not a
subscription: nothing redirects and nothing is retracted later. The project
also appears in Projects below, because Continue is an action and Projects is
the index.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 12: Capture it and look

§10's build order items 1 and 2, and the reason this task is not optional: **spacing, wrapping,
overflow, hit size and the tick strip's legibility are measurements no gate in this repository
performs.** jsdom lays nothing out. Every layout defect this surface has ever had was found by a
capture read by eye and by nothing else — the header that stacked instead of being a row, the
long name that pushed the status off the pane, the status that stopped forming a column when a
third item arrived.

**The spec was NOT verified against a render.** Its own header says so: `node_modules` was empty
in the session that produced it, so nothing in it was read off a capture and every measured
figure it quotes is cited to a file that already recorded one. This task is where that changes.

**Files:**
- Modify: `tests/harness/fixture.ts`
- Modify: `tests/harness/page.ts`
- Modify: `tests/harness/accessibility.test.ts`
- Modify: `scripts/harness-shot.mjs` (the three fixed shots Steps 2–3 add to its SHOTS array)
- Modify: `tests/build/harness-shot.test.ts` (its fixed-shot list and count)
- Modify: `styles/project-list.css` (the threshold, once it is measured)

- [ ] **Step 1: Give the harness fixture the ranges §9 names**

§9: *"Ranges to design and prototype against: 0, 1, 4 (typical), 30 (the stress case for tab
stops, ordering and scroll), and one project whose name overruns the pane at 460px — the fixture
that already found two defects in this surface."*

In `tests/harness/fixture.ts`, give the project fixtures real `planCount` and `lastWorked`
values (a spread of dates, so the ordering is visible rather than incidental), at least one
`COMPLETE` and one `AS_BUILT` so the collapsed group draws, at least one `libraryOverlap: true`
so the marker's interaction with the new facts slot is on screen, one project whose name overruns
a 460px pane, and a resolved continue context.

A fixture that FITS cannot demonstrate a rule — the plan-list scroll rule was invisible at twelve
plans because the list's scroll height equalled its client height exactly. Thirty is past what
fits and is what §9 names.

- [ ] **Step 2: Add a URL for the stress case**

`?project=<id>` already opens the detail state. Add `?projects=30` (or the smallest knob that
reaches the seeded thirty-project fixture) to `tests/harness/page.ts`, following that file's own
existing account of why the bare root must go on meaning the project view — three fixed captures
address this surface with no `view` parameter at all, and making a bare root mean something else
would break them while the test asserting they exist kept passing.

Give `tests/harness/page.ts` a **`?q=` parameter** that seeds the filter's initial query, and have
`ProjectFilter` take that seed as its starting value. Without it the no-match state is
unreachable by any capture: `harness-shot` navigates and screenshots, it types nothing, so both
shots below sit at an empty query forever and checklist item 7 — does the create action wrap
rather than pushing the pane wide, with a long typed query — inspects a block that is never on
screen. A URL-seeded query is the same state the user reaches by typing, arrived at by the one
route a headless runner has.

Then add **three fixed shots** to the `SHOTS` array in `scripts/harness-shot.mjs`, each
`{ name, query, selector: PROJECT_VIEW }` plus `width: 460` on the narrow two:

| name | query | width |
|---|---|---|
| `home-stress` | `?projects=30` | default |
| `home-stress-narrow` | `?projects=30` | 460 |
| `home-no-match-narrow` | `?projects=30&q=` + a long query matching nothing | 460 |

The third is narrow because item 7 asks about wrapping and pane width, which is where a long
create action can only be judged. `project-detail-narrow` is the exact precedent for the shape,
including why a narrow view belongs in the fixed set rather than behind a `--width` invocation.

**`scripts/entryShots.mjs` is NOT where these go, and two rounds of this plan said it was.**
That module defines no fixed set at all: `resolveShots(argv, fixedShots, env)` *receives* the
array and returns it for an argumentless run, and `harness-shot.mjs` is what passes `SHOTS` in.
The mistake came from reading `resolveShots`'s own error — "the fixed shots carry their own"
width — as evidence that the shots live beside the sentence about them, without opening the file
that defines them. It survived a round because the staging fix that followed added
`scripts/entryShots.mjs` to this task's Files list, which made the wrong file look accounted for.
**A citation is only as good as the file it was read from**, and an error message is a claim
about another module, not that module.

Extend the existing assertion in **`tests/build/harness-shot.test.ts`** — `it('still defines the
fifteen fixed shots, so an argumentless run is unchanged')`, which names every shot in a list —
so the three new names are in it and its own count reads **eighteen**. Not
`tests/harness/harness.test.ts`, which asserts nothing about this set. The fixed shots are the only ones that carry a width of
their own — which is what `resolveShots` refuses a bare `--width` for — and this surface's whole
narrow composition is a container query on the pane, so a 460px capture of the real view is the
only thing that can show it. Extend `tests/harness/harness.test.ts`'s existing assertion about
which fixed shots exist, so a later edit dropping one fails there rather than quietly reducing
the set.

- [ ] **Step 3: Capture both widths in both schemes**

**The Home surface itself must be one of the 460px shots**, and the fixed set is where it
belongs: `?projects=30` drives the REAL view through the real data path, where a prototype would
draw a hand-built copy of it. A fixed shot carries its own
width, which is why `resolveShots` refuses a bare `--width` — the three entries Step 2 adds to
`SHOTS` are what this step captures.

**`prototype:StatusTicks` does not substitute for it and never could**: that prototype holds ten
tick strips and nothing else — no filter, no foot line, no `Completed` disclosure, no Continue
controls, no overrunning name and no translated status words. It answers exactly one of step 4's
questions (can ten cells be counted at a glance) and none of the other seven. An earlier draft of
this step listed it as the narrow capture, which would have left every 460px condition in the
checklist below uninspected while reading as though the capture had been taken.

```bash
npm run harness-shot                                        # the fixed set, now including the three Home shots
npm run harness-shot prototype:StatusTicks                  # the ten strips, wide
npm run harness-shot prototype:StatusTicks -- --width=460   # and narrow, for the strip alone
```

**The `--` is load-bearing.** npm claims a bare `--width` as its own config; `resolveShots`
throws `--width applies to a named entry, and the fixed shots carry their own` for a bare one,
which is the good failure — without the separator the capture is taken at the DEFAULT width,
two PNGs are written and the command exits 0.

**The entry id is required** for the same reason: `--width` applies to a named entry and the
fixed shots carry their own.

If the pinned Chromium is absent, `scripts/chromium.mjs` refuses rather than hunting a build on
disk. In a container that cannot run `npx playwright install chromium`, set
`RP_CHROMIUM_EXECUTABLE=/path/to/chrome` — the capture then prints that it is not the pinned
build, so the caveat travels with the picture. **If neither is available, say so in the pull
request rather than marking this task done**: a capture check that goes un-run and undisclosed is
exactly how the canvas-navigation branch shipped.

- [ ] **Step 4: Read the pictures against a list, not impressionistically**

At 1280 and at 460, in both schemes:

1. Does the trailing column line up ACROSS rows, or does each row's status sit wherever its own
   name length left it? That is the defect `flex-grow` on the name was added for and the facts
   slot is a third item in the same row.
2. Can the ten cells be counted at a glance, and does a reached cell read as reached? Three
   pixels wide with a one-pixel gap is a guess until it is looked at.
3. At 460: does the row wrap to two lines, is the strip gone, and does the second line hold the
   status and the facts without either wrapping again?
4. **With the German status words in place** — `Bestandsaufnahme` is 16 characters against
   `Survey`'s 6, and a threshold validated only in English is not validated. Switch the harness
   locale, or hard-code the German label into the fixture for one capture.
5. Does the filter line read as a state line at rest, or as an empty box? Two projects is the
   vault size the direction's own recorded risk names.
6. Is the foot line quiet enough to be secondary and visible enough to be found?
7. Does the no-match block's create action wrap rather than pushing the pane wide, with a long
   typed query?
8. Is the 24px hit floor met by the row, the `Completed` summary and both Continue buttons?

- [ ] **Step 5: Move the container-query threshold to what the capture says**

`34rem` in `styles/project-list.css` is a starting value, and **moving it is expected rather than
a failure**. Set it to the width at which the one-line row can no longer hold name, facts and
status without the name truncating past readability — with German in place. Record the measured
number in the rule's own comment, replacing the sentence that says it is provisional.

- [ ] **Step 6: Fix what the pictures show, in ONE batch**

Then capture again, once, to confirm. The spec's build order item 5: one batched inspection
round at both widths, one fix batch, one confirming round, and stop.

- [ ] **Step 7: Extend the accessibility scan**

`tests/harness/accessibility.test.ts` grades the mounted surface with axe-core in jsdom. Add a
case mounting this surface POPULATED — the existing project case scans the empty state — and
assert the elements are actually in the scanned DOM before trusting the pass:

```typescript
	it('grades the populated project list', async () => {
		const { contentEl } = mountHarness();
		await flushPromises();

		// ASSERT WHAT WAS SCANNED. `mountHarness` is synchronous and voids `onOpen`, so a scan
		// taken one tick early finds zero elements under every rule bucket — a pass that is
		// true of an empty subtree and indistinguishable from a pass on a compliant one.
		expect(contentEl.querySelector('.rp-project-list__row')).not.toBeNull();
		expect(contentEl.querySelector('.rp-project-filter__input')).not.toBeNull();
		expect(contentEl.querySelector('.rp-project-list__completed')).not.toBeNull();

		const results = await axe.run(contentEl);

		expect(results.violations).toEqual([]);
	});
```

**Read that file's header before widening the claim.** It cannot measure contrast, focus
visibility or hit-target size — jsdom has no rendering engine for any of the three — and it does
not reach a `Notice`. What it does reach and this surface adds a lot of: roles, accessible names,
the filter's label association, heading order (`<h2>` then `<h3>`), and ARIA attribute validity.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run check`

```bash
git add tests/harness/ tests/build/harness-shot.test.ts scripts/harness-shot.mjs \
  styles/project-list.css
git commit -m "$(cat <<'EOF'
Capture the Home surface at both widths and fix what it showed

The threshold in the container query is measured now rather than provisional,
taken with the German status words in place — Bestandsaufnahme is 16
characters against Survey's 6, and a threshold validated only in English is
not validated.

The accessibility case scans the populated list and asserts the rows, the
filter and the completed group are actually in the scanned DOM first: a scan
one tick early finds zero elements and passes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Task 13: The manual case, and this repository's own account

§10's build order item 4 and §11's "what no gate here can check, and where it is checked
instead". Everything only a live vault verifies gets written down and run.

**Files:**
- Create: `docs/tests/cases/Find and resume a project.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (or the project surface's own suite)
- Modify: `CLAUDE.md`
- Modify: `docs/user-experience/renovation-planner-home-DESIGN-SPEC.md`

- [ ] **Step 1: Write the manual case**

Create `docs/tests/cases/Find and resume a project.md`, following the frontmatter and Runs-table
shape of an existing case in that directory (`docs/tests/cases/Navigate into a project and back.md`
is this surface's nearest sibling — read it first).

The steps, each with what to look for:

1. Build into the vault (`npm run test-build`), reload, open the Renovation project view.
2. **Contrast**: the status word, the facts slot and the foot line against the background, in
   both a light and a dark theme, and in a THEMED vault rather than the default — the harness's
   vendored `app.css` is Obsidian's defaults only.
3. **The focus ring**: Tab through the whole sequence — `New project`, the filter, `Continue`,
   `Open`, the `Projects` list (ONE stop), the `Completed` summary, the `Completed` list when
   expanded, `New asset` — and confirm a VISIBLE indicator at every one. Obsidian's global
   `:focus { outline: none }` reaches every control and its own `:focus-visible` shadow measures
   2.29:1 dark and 1.88:1 light, both under 3:1, so every ring on this surface is opted back in
   per control and every one of them is a place that can be forgotten.
4. **The 24px floor**: the row, the `Completed` summary, both Continue buttons.
5. **The keyboard**: arrows move inside the list; a printable character seeds the filter without
   losing its first keystroke; Escape clears a query and then hands focus to the first row.
6. **`Mod+↵`** on a focused row opens that project's note. jsdom dispatches no native activation
   and models no host keymap, so this step is the only instrument for it.
7. **`Ctrl+P` with the pane focused** still opens Obsidian's command palette — the surface must
   not swallow host shortcuts.
8. **The `new-project` command** appears in the palette under its translated name and is bindable
   in Settings → Hotkeys; bind it and confirm the binding invokes it. The pane's key legend must
   **not** name a New project shortcut — the command ships with no default hotkey, and Obsidian's
   hotkey registry is internal, so a legend clause for it would either advertise a dead key on a
   fresh install or claim a binding this build cannot read. An earlier draft of this step asked
   for the legend to "name whatever the user bound", which the amendment below rules out as
   unbuildable: a step that can only fail on a correct implementation.
9. **Continue**: open a project, open one of its plans, come back — Continue offers that plan and
   restores it. Then delete that project's note in the file explorer and reopen the pane: the
   Continue group is ABSENT, with no placeholder and no error.
10. **Continue across a restart**: quit Obsidian entirely and reopen. The context is still
    offered. (This is the spec's §14 question, settled by storing no leaf identity — the step is
    what confirms it.)
11. **The German pane**: switch Obsidian's language to German and confirm the narrow row still
    holds `Bestandsaufnahme` without the status wrapping, and that the count line and the
    no-match sentence read as German rather than as a template.
12. **A themed vault**: install a community theme and confirm the tick strip still reads — it is
    drawn from `currentColor`, so it follows the theme's text colour rather than a literal.

- [ ] **Step 2: Register it in the suite**

Add it to the suite that lists this surface's cases, so it is run rather than merely written.

- [ ] **Step 3: Run it**

Run: `npm run test-build`, then walk every step in a real vault and fill in the Runs table with
what happened — including the steps that passed. A case written and never run is a plan to find
out, not a finding: slice 21's outcome row said "walked" over an unrun case until a review bot
compared the two, and that is the exact mistake to avoid here.

Fix what it finds. Each fix that changes behaviour gets a test in the suite; each that cannot be
tested here gets a sentence in the case saying why.

- [ ] **Step 4: Amend the spec where the build disagreed with it**

The spec is a contract and this is where it meets the code. Amend it in place — never silently —
for anything that changed:

- The measured container-query threshold, replacing the 460px-capture instruction with the number
  it produced.
- The `PlanDeleted` commission in §8, which has no producer: record that the entry arm carries
  deletion instead.
- **§7's key legend and §12's `view.project.keys`**, which name a `{mod}N new project` clause the
  build does not ship: the command carries no default hotkey, so that clause would advertise a
  key that does nothing on a fresh install, and Obsidian's hotkey registry is internal so the
  real binding cannot be read back.
- §14's three open decisions, each with the answer taken and by whom.
- Anything the capture or the manual case falsified.

A criterion that quietly keeps its old wording is how the gap between promise and check reopens —
this repository's own rule, and §5's `three refusals` amendment is its worked example.

- [ ] **Step 5: Write this surface's account into `CLAUDE.md`**

Add a paragraph in the house style — what landed, and then the rules that came out of BUILDING it
rather than a summary of the spec. Candidates already visible from the plan, to be replaced by
whatever the work actually taught:

- **`PlanDeleted` was commissioned and does not exist.** A spec can name an event with no
  producer, and the fix is not to add the name to a subscription list — it is to find which arm
  already carries the case (`VaultChangeAdapter` announces on `index.remove`) and write that down
  where the list is.
- **A required DTO field is what makes the compiler name the second door.** `toProjectSummaryDto`
  has two callers and only one of them is the list; an optional third parameter would have
  compiled at both and left `getProject` silently answering `0` about a project it never counted.
- **A roving group whose list gets shorter can end up with no tabbable member at all** — silently,
  for the rest of the mount. The filter is what makes that reachable, and the clamp is what a
  mutation check proves is load-bearing.
- **The count line was the declined candidate's donation and it is what makes the field not
  furniture.** Worth recording because the reflex is to ship a search box and let it say nothing
  when empty.

Also update the settings-pane count sentence if this work touched it (it should not), and the
`three workspace surfaces` paragraph if a fourth `registerView` appeared (it should not).

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run check`

```bash
git add docs/ CLAUDE.md
git commit -m "$(cat <<'EOF'
Write down what only a vault can verify, and what building it taught

The manual case covers contrast, the focus ring at every tab stop, the 24px
floor, Mod+Enter, the palette command, Continue across a restart, and the
German pane — every one of which is a measurement no gate here performs.

The spec is amended where the build disagreed with it rather than left to
read as satisfied: the measured threshold, the PlanDeleted event that has no
producer, and the three section 14 decisions with the answers taken.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S8qUpkaedQrp2PbtDdVAbL
EOF
)"
```

---

## Self-review

Run against the spec after writing the plan, section by section.

**Spec coverage.**

| Spec section | Task |
|---|---|
| §1 Job and audience | — (context; no deliverable) |
| §2 Outcome, no-invented-numbers rule | 1, 4 (the facts slot renders nothing for an empty entry) |
| §3 Thesis, three raises, signature interaction | 4 (armature), 6 (count line), 7 (signature) |
| §4 Scope, anti-goals | Global constraints; 4 (no colour status), 6 (no autofocus) |
| §5 Regions 1–7, empty/failure/loading | 5 (3,4,5), 6 (2), 9 (1, 7), 11 (3); 6/7 unchanged from `ViewRoot` |
| §6 Row anatomy, status strip, narrow | 3 (stage), 4 (row, strip, container query) |
| §7 Pointer, keyboard, filter, Continue | 6 (filter), 8 (keyboard), 10–11 (Continue) |
| §8 DTO fields, freshness, reserved slot, ordering | 1 (fields), 2 (freshness), 4 (reserved), 5 (ordering) |
| §9 States table, ranges | 7 (filtered to nothing), 12 (ranges) |
| §10 Visual contract | Global constraints; 4, 5, 6, 7, 9, 11 (per-control focus rings) |
| §11 Accessibility | 4 (aria-hidden strip), 5 (headings, `<details>`), 6 (label, status), 8 (focus), 12 (axe), 13 (manual) |
| §12 Localization | 3 |
| §13 Constraints 1–5 | 10 (1), 1 (2), 12 (3), global (4), 9 (5) |
| §14 Open decisions | Locked at the head of this plan; 9 and 10 build them; 13 amends the spec |
| §15 Build order | Phases A→F follow it: fields before the row (item 3), prototype and capture (1, 2), manual case (4), one finish pass (5) |

**Every task's `git add` is checked against its own Files list, mechanically.** A file a task
declares under `Modify:` or `Create:` and never stages is a step that reads as complete and
leaves its change uncommitted — and the failure is invisible to any gate, because the plan is
prose and `npm run check` never reads it. Codex found two instances (`ProjectDetailState.vue` in
Task 11, the capture registry in Task 12 — which a later round found was the wrong FILE, so
staging it made the real one look accounted for); auditing the whole plan rather than the two
reported found a **third nobody had named**, `styles/forms.css` in Task 9. That is this
repository's own recurring lesson arriving in a planning document: a partial fix reads exactly
like a complete one, and "I fixed the case in the report" is not "I fixed the class".

The audit is a comparison anyone can re-run: for each `## Task`, collect every **path-shaped**
backticked token in its `Modify:`/`Create:` lines — one containing a `/` or a file extension —
and require each to be covered by a path in that task's own `git add`, either exactly or by
directory prefix. Path-shaped rather than every backticked token, because a Files line may
legitimately name a symbol in its parenthetical, and a check that reports one as a missing file
teaches its next reader to ignore it. It reports zero as this plan stands. Re-run it after any
edit that adds a file to a task, because the two lists are two statements of one fact and they
drift the moment only one of them is updated.

Two gaps are deliberate and named where they occur rather than left to be found:

- **`planCount`'s `PlanDeleted`** (§8) has no producer in the tree. Task 2 carries the case
  through the entry arm and Task 13 amends the spec. This is the one place the plan does not do
  what the spec literally asks, and it is because the spec asks for something that does not exist.
- **§7's open-note accelerators** — middle-click, modifier-click and `Mod+↵` — were found
  missing by this review and are **built by Task 8 step 5a**, not deferred. An earlier draft of
  this paragraph described the fix and told the reader to "add it there", which is the
  describe-without-showing failure this skill's own rules forbid: the numbered tasks would have
  shipped rows that only emit `open` while the foot legend and the manual case both claimed the
  accelerators existed. One detail that only writing it surfaced: the middle button fires
  `auxclick`, never `click`, so a `click` handler testing `event.button === 1` never runs at all.

**Placeholder scan.** No `TBD`, no "add appropriate error handling", no "similar to Task N". Every
code step carries the code. Three steps deliberately say *read the existing file first* rather
than quoting it — `NewProjectForm`'s name-input selector (Task 7 step 6), the plugin's
view-reaching shape for `newProject()` (Task 9 step 7), and the `Logger.warn` signature (Task 10
step 5) — because quoting a line this plan has not verified would be worse than naming the file
to read.

**Type consistency.** `ProjectRowFacts` is the name in the port, the query result, the DTO mapper
and both query tests. `ProjectListFacts.factsFor` is the only method name used. `ContinueContext`
is `{ projectId, planId }` in the parse, the store, the deps, the emit and the resolver.
`nameCollator` is defined in Task 5 and consumed by Tasks 5, 6 and 9. `matchesQuery`/`splitMatch`
are Task 6's throughout. `useRovingFocus` returns `{ activeIndex, onKeydown, clamp, focusFirst }`
and Task 8 uses exactly those four.

**Second round, after Codex review of the first push.** Six findings against this plan, all six
verified and all six real. Four were defects the plan would have shipped, and they are recorded
here rather than only fixed, because three of them are shapes this repository already has a name
for:

- **`ProjectDetailState` is the only path that opens a plan, and it did not remember one** —
  so `ContinueContext.planId` was always `null` and Continue could never resume a plan, which is
  the whole of what distinguishes it from `Open`. The plan built a feature that could not reach
  half its own purpose. Task 11 step 6a.
- **A comment describing behaviour the code cannot deliver.** The resume handler claimed a
  deleted plan "lands on the detail state"; `renovationProjectOpenPlan` reveals a Plan Editor
  whose `missing` state asks the user to close the tab. Re-reading §7 settled it — the spec
  already required resolving *both* ids ("if either misses, the group does not render") and the
  plan validated one. This repository's oldest recurring shape, arriving in a document about
  avoiding it.
- **A guard clamped against the wrong set.** One controller over two groups, clamped on the
  filter's total match count: with one active row and two completed matches, the `Projects`
  group silently loses its only tab stop. The mutation is written into Task 8 step 7 because
  every other case in that file passes against the broken version.
- **`Space` is a printable character and a row is a `<button>`.** The type-to-filter rule would
  have collided with native activation on the one key that has both meanings.

The other two are narrowings rather than defects: the arrows now work from the filter as §7's
table always said, and `Completed` gets its own roving controller because §7's sequence names it
as one stop.

**Fourth round, and three of its four are the third round's own repairs.** The pattern is now
the finding: every round on this branch has broken something the round before it fixed, and the
common shape is a fix applied at the door being looked at rather than at the question being
asked.

- **The ratio bound on the collation window was FALSE, and it was asserted from one
  measurement.** `compare('ﬃ', 'ffi')` is `0` — one code unit equal to three — and so are
  `æ`/`ae`, `œ`/`oe`, `ﬁ`/`fi`, `ﬂ`/`fl`, `ﬀ`/`ff`. The bound had been derived from `ä`/`ae`,
  which is not a ligature and is measurably *not* equal, so the one pair it tested was the one
  pair that proved nothing about the class. **A bound derived from one example is a bound
  derived from nothing**; there is no ratio bound now, and the cost is paid by a two-pass search
  rather than by an assumption.
- **Escape kept the blind spot the arrows had just lost**, three lines away in the sibling
  function. The fix went to the door in the report and not to the question, which is the
  partial-fix shape this repository has paid for repeatedly. `focusFirstRow` is now one function
  both doors ask.
- **The Continue row was rendered outside `.rp-project-list`**, so every shared row declaration
  — scoped as a descendant to beat Obsidian's own button rule — missed it. The row that the
  design calls "the same armature as every other row" was the one row with no armature at all,
  and only reading the selector's scope against the markup could see it.
- **The 460px capture pointed at `prototype:StatusTicks`**, which holds ten tick strips and none
  of the filter, foot line, disclosure, Continue controls or long names the checklist beneath it
  inspects. A capture step that cannot see what it asks about reads exactly like one that can.

**Fifth round, five findings, and the shape shifted: three are claims this plan made that its own
code did not keep.**

- **The continue store queued its WRITES and left `read` outside the queue**, so a read racing a
  write in flight is answered the previous file — and the context is read once per mount, so that
  stale answer lasts the mount. Half a fix, in the change that was fixing the other half.
- **The debounce was applied to the VISIBLE count**, which made the pane's state line wrong for
  400ms after every keystroke and indefinitely while typing — over rows that had already
  filtered. The count *is* the state (§3's whole teletext argument), so the one thing it must not
  do is lag. The announcement is a separate hidden live region now.
- **The Continue row named its project and not its plan**, though §7's own diagram is
  `House Renovation 2026 · Kitchen › Work` and `resolveStored` was already reading the plan
  before reducing it to a boolean. The read was made and its answer thrown away.
- **`Completed` had no `<h3>`**, so the one group hidden by default was also the one absent from
  heading navigation, while both its siblings were listed.
- **"Device-local" was false where the file actually lives** — under `.obsidian/`, which Obsidian
  Sync can carry. Narrowed rather than relocated, because the relocation needs an API this
  session could not verify (`node_modules` absent) and asserting an unseen API is precisely what
  round four cost.

**Third round, on the fixes themselves.** Four more, all real, and two of them are defects the
second round's own repairs introduced or left standing — which is this repository's recorded
pattern for review rounds on one branch, arriving on schedule:

- **`Intl.Collator` at base sensitivity treats `ß` and `ss` as EQUAL**, so a 6-unit name is
  matched by a 7-unit query. Measured in node rather than reasoned:
  `compare('Straße', 'Strasse')` is `0` in `de` *and* in `en`. The fixed-width window and its
  `needle.length > name.length` early return rejected exactly that, so a user typing
  `hauptstrasse` — the ordinary ASCII spelling — found nothing. **The failure the collator was
  chosen to prevent, arriving through the search that uses it.** The window's width varies now
  and `splitMatch` highlights the matched SPAN rather than the query's length, which are
  different numbers whenever an expansion fired. *(This round then bounded the varying width at
  a 1:2 ratio, on the strength of `ä`/`ae` measuring not-equal. The fourth round proved that
  bound false — see below. The correction is left visible rather than edited away, because the
  mistake was generalising a class from one example, and hiding it would hide that.)*
- **The filter's new arrow handler returned whenever `Projects` was empty**, leaving a vault of
  only completed projects unreachable by keyboard. A fix written for the common case, blind to
  the case that made the group exist.
- **The open-note accelerators were "add it there" and nothing else.** The self-review found
  them missing and then described the remedy instead of writing it — the exact
  describe-without-showing failure the planning rules forbid, committed in the paragraph that
  had just caught the omission. Task 8 step 5a builds them, and writing it surfaced what the
  description had missed: the middle button fires `auxclick`, never `click`.
- **Two continue-context writes can overlap and land out of order**, so opening a project and
  then a plan inside it — the flow the feature exists for — could persist the project-only
  context last and erase the plan. Serialized through `KeyedQueues`, which the marker store one
  directory over already uses for the same file and the same reason.

**Coverage risk.** Tasks 1, 6 and 10 each add error arms that no production path reaches
(`NO_FACTS` at the `getProject` door, `findMatch`'s empty-query arm, both `catch` blocks). Each
has a test above that drives it — deliberately, because at this repository's ONE unit of headroom
an untested arm in a tight metric fails the gate outright and one in a slack metric hides
completely.

---
