# Design slice 21 — the project detail state: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a project row opens that project inside the Renovation Project view — its
plans listed, a plan creatable through the real `CreatePlanCommand`, and a way back — so that
a renovator can reach the `Zone Geometry → Area → Requirement → Cost` loop without the
scaffolding command named for being scaffolding.

**Architecture:** The Renovation Project view becomes a **list state and a detail state** in
one leaf. Which project is open lives in **Obsidian's view state** (`getState`/`setState`),
never in Pinia, so a `rebind` remount and an app restart both survive it. Navigation is a
round trip through `leaf.setViewState`, which sets `ViewStateResult.history` and therefore
buys the pane's own back arrow. `sync()` — borrowed from `PlanEditorView` — is the one place
that decides what is mounted, and it REMOUNTS per navigation, which makes a stale tree
unrepresentable.

**Tech Stack:** TypeScript, Vue 3 SFCs (`<script setup>`), Pinia, Obsidian `ItemView` API,
Vitest (node + jsdom), `@vue/test-utils`, axe-core.

**Spec:** [`docs/superpowers/specs/2026-08-30-project-detail-view-design.md`](../specs/2026-08-30-project-detail-view-design.md)
— six decisions, each with its rejected alternatives. The slice document with the 14
acceptance criteria is [`docs/tasks/21-the-project-detail-state.md`](../../tasks/21-the-project-detail-state.md).
Read both. Where they disagree, the slice document owns *whether it is done* and the spec
owns *how*.

---

## Deviation from the spec, decided before Task 1

**The spec's decision 6 asks for a command id and a locale key that are both already taken,
and taking them would hijack a binding a user already has.**

Measured on `main`:

- `src/plugin/RenovationPlannerPlugin.ts:202` already registers `id: 'open-project'`.
- `src/presentation/i18n/locales/en.ts:8` already holds
  `'command.open-project': 'Open renovation project'`; `de.ts` holds
  `'Renovierungsprojekt öffnen'`.
- That key is ALSO the ribbon button's title
  (`this.addRibbonIcon(RENOVATION_PROJECT_ICON, tr('command.open-project'), …)`), under a
  comment reading *"Two ways in, one behaviour: both call the same function"*.
- `tests/plugin/registration.test.ts:78` and `tests/plugin/settings/unrecovered.test.ts:73`
  both assert that id.

The existing command means **"show me the Renovation Project pane."** The spec's new command
means **"pick a project and go into it."** They are different behaviours, and the spec's own
argument for treating an id as data — *"Obsidian binds a user's hotkey to it"* — is the
argument against reusing this one: a user whose hotkey means "show me the pane" would get a
fuzzy picker instead. Repurposing it also splits the ribbon from the command that shares its
copy, breaking the invariant the comment above states.

**So this plan registers a SECOND command**, and leaves the existing one and the ribbon
exactly as they are:

| | id | locale key | behaviour |
|---|---|---|---|
| existing, untouched | `open-project` | `command.open-project` | reveal the pane |
| new, this slice | `open-project-detail` | `command.open-project-detail` | reveal the pane, then pick a project and navigate into it |

Everything else in decision 6 is implemented as written — the two-step reveal-then-navigate,
the latest-request ticket, the `Promise<boolean>` from `revealView`, and revealing the LIST
rather than a picker or a notice in an empty vault. If the reviewer prefers a different name
for the new command, only Task 12's id string and its two locale entries change.

---

## Global Constraints

Copied verbatim from the spec, `CLAUDE.md` and `vitest.config.ts`. Every task's requirements
implicitly include this section.

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests +
  fallow. All four, before every commit.
- **Coverage floors: statements 99, functions 99, lines 99, branches 98.** Branches is the
  binding one and the margin is a handful of branches, not a percentage point. **An untested
  new arm does not shave a number, it fails the gate — plan the test with the code.**
  Re-measure with `npm run test:coverage` on the tree this actually lands on; do not trust
  any figure written in the spec.
- **Run the suite ALONE when you want the coverage number.** A single file timing out under
  machine load suppresses the coverage report entirely. `tests/build/` files timing out in a
  `beforeAll` are a parallelism artifact — re-run with `--no-file-parallelism` before
  believing one.
- **Layering** (`eslint.config.mjs` enforces it): `presentation → application → domain →
  core`; `infrastructure → application → domain → core`; `plugin/` composes all of them and
  is the only layer that may. `presentation/` may NOT import `infrastructure/`. `core/`,
  `domain/` and `application/` may not name `vue`, `pinia`, `konva` or `obsidian`.
- **Nothing writes to the vault outside `infrastructure/`** (`WRITE_BOUNDARY` in
  `eslint.config.mjs`).
- **Registering anything with Obsidian belongs to `src/plugin/`** —
  `tests/build/registration-locality.test.ts` reads `src/` for nine registration members and
  requires every hit under `src/plugin/`.
- **Every user-facing string resolves through `t()`/`tr()`**, in BOTH locale tables. A
  descriptor's `title:` is resolved by the CALLER, never inside the dialog framework.
  `EMPTY_STATE_CONTENT` holds `StringKey`s and never literal copy.
- **German vocabulary:** `Objekt`, never `Material`; `Vault` wherever `en.ts` says "vault".
  `tests/presentation/i18n/strings.test.ts` holds both rows plus completeness.
- **A view type and a command id are DATA.** Obsidian persists the first in the workspace
  layout and binds a user's hotkey to the second. Never rename either.
- **A rejected commit KEEPS the user's typed value.** It never reverts. (Slice 16.)
- **No `<style>` block in an SFC under `src/presentation/`** — `vue/no-restricted-block`
  fails one. CSS lives in `styles/`, assembled by `scripts/styles-assemble.mjs`, and a
  hard-coded colour fails the build: use an Obsidian CSS variable. Partials cap at 400 lines
  and must be imported by `styles/index.css`.
- **`max-lines` is 400 for `src/**`.** `runtime.ts` has already been extracted once for this.
  If a file crosses it, extract a coherent seam rather than reformatting to buy lines.
- **A fake must not be kinder, thinner, harsher or FASTER than the real thing.**
  `FakeLeaf.setViewState` establishes its state only when its promise settles — that is
  deliberate and load-bearing for this slice's whole navigation. Do not "simplify" it.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Where a step below says *watch it fail*, actually run it and see red.
- **Sentence case in UI text** (`obsidianmd/ui/sentence-case-locale-module` fails the build
  on a capitalised word mid-sentence).

---

## File structure

**New files**

| File | Responsibility |
|---|---|
| `src/application/queries/ListPlansByProject.ts` | One project's plans, over `PlanRepository.listByProject`. Hands back domain entities. |
| `src/application/events/projectPlansChangeSource.ts` | "The set of plans in THIS project changed" — the third change source. |
| `src/presentation/stores/ProjectDetailStore.ts` | `project`, `plans`, `status`, `error`, `emptyStateKey`, `hydrate`, `reset`. |
| `src/presentation/views/ProjectDetail.vue` | The detail state's markup: header + `PlanList`. Emits `back`, `openNote`, `openPlan`, `createPlan`. |
| `src/presentation/views/PlanList.vue` | Plan rows plus a `+ New plan` header button. Emits `open`, `create`. |
| `src/presentation/views/NewPlanForm.vue` | One field (`name`), on `useFormCommit`. A `component` under the existing `kind: 'form'`. |
| `src/presentation/views/statusLabel.ts` | The `isProjectStatus`-guarded label helper, extracted from `ProjectList.vue` at its second consumer. |
| `src/presentation/modals/ProjectSuggestModal.ts` | A `FuzzySuggestModal` over the index's `renovation-project` entries. |
| `src/infrastructure/obsidian/workspace/navigateToProject.ts` | Reveal the singleton, then navigate it. Holds the navigation ticket. |
| `styles/project-detail.css` | The detail header and plan list rules. |

**Changed files**

| File | Change |
|---|---|
| `src/presentation/read-models/PlanDto.ts` | `PlanSummaryDto` + `toPlanSummaryDto`. |
| `src/presentation/read-models/renovationProjectQueries.ts` | `getProject` and `listPlansByProject` on the interface, the factory and the refusal bundle. |
| `src/presentation/views/RenovationProjectContext.ts` | Five new `RenovationProjectDeps` members. |
| `src/presentation/views/RenovationProjectView.ts` | `getState`/`setState`/`sync`/`mount`/`unmount`; `rebind` becomes `unmount(); sync();`. |
| `src/presentation/views/ViewRoot.vue` | Draws the list or `ProjectDetail` on `context.projectId`. |
| `src/presentation/views/ProjectList.vue` | Uses the extracted `statusLabel`. |
| `src/presentation/emptyStates/content.ts` | `renovationProject.noPlans`, with an `actionLabel`. |
| `src/presentation/emptyStates/selectors.ts` | `selectProjectDetailEmptyState`. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | Nine new keys (Task 7/8/10/12). |
| `src/infrastructure/obsidian/workspace/revealView.ts` | Returns `Promise<boolean>`. |
| `src/plugin/composition-root.ts` | Wires the two new queries and the four new deps members. |
| `src/plugin/RenovationPlannerPlugin.ts` | The `open-project-detail` command; the index-scan flag. |
| `src/plugin/sampleProject.ts` | The docblock whose stated trigger this slice fires. |
| `styles/index.css` | Imports the new partial. |
| `tests/helpers/makeRenovationProjectView.ts` | Grows with the interface, in the same edit. |
| `CLAUDE.md` | Two paragraphs stop being true; vue-router joins *Deliberately absent*. |
| `docs/tests/cases/` | A new manual case for the back arrow and appearance. |

---

### Task 1: `ListPlansByProject` and `PlanSummaryDto`

The read the detail state is built on, and the two behaviours its port's own loop makes
possible and its return type hides. Both are TODAY's behaviour rather than this slice's
choice, and both are pinned here — the first so that softening it is deliberate, the second
so that a row count silently disagreeing with the index is a fact somebody chose.

**Files:**
- Create: `src/application/queries/ListPlansByProject.ts`
- Create: `tests/application/queries/listPlansByProject.test.ts`
- Modify: `src/presentation/read-models/PlanDto.ts` (add `PlanSummaryDto`, `toPlanSummaryDto`)
- Modify: `tests/presentation/read-models/planDto.test.ts` (add the mapping case; create the
  file if it does not exist — check with `ls tests/presentation/read-models/` first)

**Interfaces:**
- Consumes: `PlanRepository.listByProject(projectId: ProjectId): Promise<Result<Loaded<Plan>[], RepositoryError>>`
  (`src/application/ports/PlanRepository.ts:19`).
- Produces:
  - `class ListPlansByProject implements Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>`
    with `execute({ projectId }: { projectId: ProjectId })`.
  - `interface PlanSummaryDto { readonly id: string; readonly name: string }`
  - `function toPlanSummaryDto(plan: Plan): PlanSummaryDto`

- [ ] **Step 1: Write the failing test**

Create `tests/application/queries/listPlansByProject.test.ts`:

```ts
/**
 * `ListPlansByProject` — the project detail state's read (design slice 21).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. Two of its four cases pin behaviour this slice INHERITS from
 * `PlanRepository.listByProject` rather than chooses — the loop fails the whole list for one
 * unreadable note (`if (!one.ok) return one`) and silently drops an indexed id whose note is
 * gone (`if (one.value) loaded.push(...)`). The store above cannot tell the second from a
 * project that really has fewer plans, because both arrive as a successful array. Pinned so
 * that changing either is a deliberate act with a red test behind it.
 */
import { describe, expect, it } from 'vitest';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { err, isErr, isOk, ok } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { PlanRepository } from '../../../src/application/ports/PlanRepository';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { Plan } from '../../../src/domain/plan/Plan';
import { expectOk } from '../../helpers/domain';
import { makePlan } from '../../helpers/entities';

const PROJECT = 'project-01JAAA' as ProjectId;

const READ_FAILED: PersistenceError = {
	category: 'Persistence',
	code: 'plan.read-failed',
	message: 'boom',
};

/**
 * Declared member by member rather than spread from an instance: spreading copies only own
 * enumerable properties and drops every prototype method, leaving a double that does not
 * satisfy the port at runtime. `listProjects.test.ts` states the same ruling.
 */
function repositoryAnswering(
	listByProject: PlanRepository['listByProject'],
): PlanRepository {
	return {
		listByProject,
		getById: () => Promise.reject(new Error('not exercised')),
		save: () => Promise.reject(new Error('not exercised')),
		delete: () => Promise.reject(new Error('not exercised')),
	};
}

describe('ListPlansByProject', () => {
	it('answers an empty list for a project with no plans', async () => {
		const result = await new ListPlansByProject(new InMemoryPlanRepository()).execute({
			projectId: PROJECT,
		});

		expect(isOk(result) && result.value).toEqual([]);
	});

	it('answers the project’s plans as domain entities', async () => {
		const plans = new InMemoryPlanRepository();
		const ground = expectOk(await plans.save(makePlan({ projectId: PROJECT, name: 'Ground floor' }), 'absent'));

		const result = await new ListPlansByProject(plans).execute({ projectId: PROJECT });

		expect(isOk(result) && result.value.map((plan) => plan.name)).toEqual(['Ground floor']);
		expect(isOk(result) && result.value[0]?.id).toBe(ground.entity.id);
	});

	/**
	 * The STRICT half, and the one with teeth: a single plan note written by a newer build
	 * refuses as a `MigrationError` and takes the entire detail state with it — every other
	 * plan in the project hidden behind one file's schema version, where the project LIST
	 * would have shown its readable rows and counted the rest. Inherited from the port, not
	 * chosen here. Trigger to change it: a second surface wanting per-row resilience, or the
	 * first report of a project made unopenable by one plan note.
	 */
	it('hands a failed read back as a failure, never as a short list', async () => {
		const result = await new ListPlansByProject(
			repositoryAnswering(() => Promise.resolve(err(READ_FAILED))),
		).execute({ projectId: PROJECT });

		expect(isErr(result) && result.error.code).toBe('plan.read-failed');
	});

	/**
	 * The LOSSY half, bounded and self-correcting: `ok(null)` for an indexed id means the note
	 * is gone, which `VaultChangeAdapter` corrects on its next pass. A row vanishing for a
	 * moment is the honest picture of a note that is not there — but the ROW COUNT then
	 * disagrees with the index, silently, and this case is what makes that a fact somebody
	 * chose. Driven at the port, because `InMemoryPlanRepository` cannot produce the state.
	 */
	it('drops an indexed id whose note is gone rather than reporting it', async () => {
		const survivor: Loaded<Plan> = { entity: makePlan({ projectId: PROJECT, name: 'First floor' }), version: 1 };

		const result = await new ListPlansByProject(
			repositoryAnswering(() => Promise.resolve(ok([survivor]))),
		).execute({ projectId: PROJECT });

		expect(isOk(result) && result.value.map((plan) => plan.name)).toEqual(['First floor']);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/application/queries/listPlansByProject.test.ts
```

Expected: FAIL — `Failed to resolve import ".../ListPlansByProject"`.

- [ ] **Step 3: Write `ListPlansByProject`**

Create `src/application/queries/ListPlansByProject.ts`:

```ts
import { isErr, ok, type Result } from '../../core/result/Result';
import type { Plan } from '../../domain/plan/Plan';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { PlanRepository } from '../ports/PlanRepository';
import type { RepositoryError } from '../ports/repositoryErrors';
import type { Query } from './Query';

export interface ListPlansByProjectInput {
	readonly projectId: ProjectId;
}

/**
 * One project's plans — the project detail state's read (design slice 21).
 *
 * A thin wrapper over `listByProject`, which slice 3 declared on the port and slice 4
 * implemented ahead of any consumer, precisely so adding one is a query file rather than a
 * port change. Named `List*` per SDD §80, the shape `ListProjects` and `ListAssets` follow.
 *
 * It hands back DOMAIN ENTITIES, not a DTO: `application/` may not name `presentation/`, so
 * the mapping to `PlanSummaryDto` happens in the read-model bundle the view is handed, beside
 * every other `to*Dto`.
 *
 * **It has no `unreadable` half, and that is inherited rather than decided.** `ListProjects`
 * can report a partial listing because `ProjectRepository.listAll` answers `{ loaded,
 * refused }`; `PlanRepository.listByProject` answers a bare array whose loop fails the whole
 * list for one bad note and silently drops an id whose note is gone. Both are pinned in
 * `listPlansByProject.test.ts` so that softening either is deliberate. Widening this needs
 * the PORT's contract to change, which `ListAssets` and `ListReassignmentTargets` also read
 * through.
 */
export class ListPlansByProject
	implements Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>
{
	constructor(private readonly plans: PlanRepository) {}

	async execute({ projectId }: ListPlansByProjectInput): Promise<Result<Plan[], RepositoryError>> {
		const listed = await this.plans.listByProject(projectId);
		if (isErr(listed)) return listed;
		return ok(listed.value.map((loaded) => loaded.entity));
	}
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/application/queries/listPlansByProject.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Add `PlanSummaryDto` beside `ProjectSummaryDto`**

In `src/presentation/read-models/PlanDto.ts`, after `ProjectSummaryDto` (currently line 53):

```ts
/**
 * A plan as a LIST ROW sees it (design slice 21) — deliberately not `PlanDto`.
 *
 * A row needs neither the background, the calibration nor the layers, and handing a component
 * the full DTO makes it a consumer of fields it does not read: the next change to any of those
 * three would then have to reason about a list that never wanted them. `ProjectSummaryDto` is
 * the same distinction one entity up.
 */
export interface PlanSummaryDto {
	readonly id: string;
	readonly name: string;
}
```

and beside `toProjectSummaryDto` (currently line 84):

```ts
export function toPlanSummaryDto(plan: Plan): PlanSummaryDto {
	return { id: plan.id, name: plan.name };
}
```

- [ ] **Step 6: Cover the mapping**

`ls tests/presentation/read-models/` first. Add to the file that already covers
`toProjectSummaryDto` (or create `tests/presentation/read-models/planSummaryDto.test.ts`
with the same header style):

```ts
it('maps a Plan to the two fields a row renders and no more', () => {
	const plan = makePlan({ name: 'Ground floor' });

	expect(toPlanSummaryDto(plan)).toEqual({ id: plan.id, name: 'Ground floor' });
});
```

The `toEqual` is exact on purpose: it fails if a later edit widens the DTO without deciding to.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add src/application/queries/ListPlansByProject.ts src/presentation/read-models/PlanDto.ts tests/application/queries/listPlansByProject.test.ts tests/presentation/read-models/
git commit -m "Add ListPlansByProject and the summary DTO a plan row reads"
```

---

### Task 2: `projectPlansChangeSource`

The third change source, and the only one that can hear `PlanCreated`. Without it a plan
created from the form beside the list would not appear until the pane was reopened — on a
form whose whole job is to add a row to that list, which is the shape that invites a user to
press Create again and get two.

**Files:**
- Create: `src/application/events/projectPlansChangeSource.ts`
- Create: `tests/application/events/projectPlansChangeSource.test.ts`

**Interfaces:**
- Consumes: `EventBus.subscribe(type, handler): { dispose(): void }`
  (`src/core/events/EventBus.ts`); `planCreated({ planId, projectId })`
  (`src/domain/plan/Plan.events.ts`), published by `CreatePlanCommand.execute`;
  `ProjectIndexEntryChangedPayload` (`src/application/events/projectIndex.events.ts`).
- Produces: `createProjectPlansChangeSource(events: EventBus): (projectId: string, listener: () => void) => () => void`

- [ ] **Step 1: Write the failing test**

Create `tests/application/events/projectPlansChangeSource.test.ts`:

```ts
/**
 * "The set of plans in THIS project changed" — design slice 21's third change source.
 *
 * A third source rather than a filter on either of the two that exist, because it asks a
 * third question: `planChangeSource` is "this PLAN changed" and every caller binds a plan id;
 * `projectListChangeSource` is "the set of PROJECTS changed" and is unfiltered. This one is
 * filtered on the OWNING PROJECT, which `PlanCreated`'s payload carries.
 *
 * The third case pins a STATED COST rather than a wanted behaviour:
 * `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType` and no owning
 * project, so that arm cannot be filtered by project and fires for a change to any plan note
 * in the vault. Affordable because the view is a singleton and the query is project-scoped.
 * Pinned so that narrowing it later — when that payload gains the owning project id — is a
 * deliberate change rather than a silent one.
 */
import { describe, expect, it, vi } from 'vitest';
import { createProjectPlansChangeSource } from '../../../src/application/events/projectPlansChangeSource';
import { createEventBus } from '../../../src/core/events/EventBus';
import { planCreated } from '../../../src/domain/plan/Plan.events';
import { projectIndexEntryChanged } from '../../../src/application/events/projectIndex.events';

const OURS = 'project-01JAAA';
const THEIRS = 'project-01JBBB';

describe('createProjectPlansChangeSource', () => {
	it('delivers a PlanCreated for its own project', async () => {
		const events = createEventBus();
		const listener = vi.fn();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: OURS }));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	/**
	 * The filter, and the reason this is not `projectListChangeSource` with a different name.
	 * Without it every project's plan creation would re-read every open detail state.
	 */
	it('does not deliver a PlanCreated for another project', async () => {
		const events = createEventBus();
		const listener = vi.fn();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: THEIRS }));

		expect(listener).not.toHaveBeenCalled();
	});

	/**
	 * The stated cost, asserted rather than described. `entityType` is all the payload gives,
	 * so a plan note arriving through sync anywhere in the vault re-reads this one project's
	 * plans. Deliberate; narrow it when the payload can say whose plan it is.
	 */
	it('delivers a plan index entry change regardless of which project it belongs to', async () => {
		const events = createEventBus();
		const listener = vi.fn();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(projectIndexEntryChanged({ entityId: 'plan-01JZZZ', entityType: 'renovation-plan' }));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('ignores an index entry change for something that is not a plan', async () => {
		const events = createEventBus();
		const listener = vi.fn();
		createProjectPlansChangeSource(events)(OURS, listener);

		await events.publish(projectIndexEntryChanged({ entityId: 'zone-01JZZZ', entityType: 'renovation-zone' }));

		expect(listener).not.toHaveBeenCalled();
	});

	it('disposes every subscription it took', async () => {
		const events = createEventBus();
		const listener = vi.fn();
		const dispose = createProjectPlansChangeSource(events)(OURS, listener);

		dispose();
		await events.publish(planCreated({ planId: 'plan-01JXXX', projectId: OURS }));
		await events.publish(projectIndexEntryChanged({ entityId: 'plan-01JZZZ', entityType: 'renovation-plan' }));

		expect(listener).not.toHaveBeenCalled();
	});
});
```

**Before running it**, open `src/application/events/projectIndex.events.ts` and
`src/domain/plan/Plan.events.ts` and confirm the two factory names and payload shapes used
above (`projectIndexEntryChanged`, `planCreated`) and the `entityType` string for a plan
(`'renovation-plan'`, the same value `planEntries` filters on in
`src/plugin/planEditorCommands.ts:39`). Fix the test's imports to match what is there rather
than adding an export to make the test compile.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/application/events/projectPlansChangeSource.test.ts
```

Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the source**

Create `src/application/events/projectPlansChangeSource.ts`:

```ts
import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { PlanEventPayload } from '../../domain/plan/Plan.events';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "Some plan of THIS project changed, from anywhere" — design slice 21's third change source.
 *
 * It lives in `application/` for the reason its two siblings do, and that reason is the whole
 * point of the indirection: this layer is the one that may know both halves — the `EventBus`
 * port and the event names — so `presentation/` gets a callback and never learns either.
 *
 * **Why a THIRD source rather than a filter on one of the two.** `createPlanChangeSource`
 * answers "tell me when THIS plan changed" and every caller binds a plan id; this view has
 * none, it has a PROJECT. `createProjectListChangeSource` answers "the set of projects
 * changed" and is unfiltered; delivering that here would re-read one project's plans for
 * every project note in the vault. The question asked here is narrower than the first and
 * wider than the second.
 *
 * The LIST is the extension point — a name added here, never a second refresh path in the
 * view.
 */
const PROJECT_PLAN_EVENTS = ['PlanCreated'] as const;

/**
 * Events that name ONE index entry, and are this project's business when that entry is a
 * plan — a SECOND list rather than a hole in the guard below, for the reason
 * `planChangeSource` gives for its own pair: letting an unmatched event through would deliver
 * every future payload-less event to every listener by accident.
 *
 * **This arm cannot be filtered by project, and that is a stated cost rather than an
 * oversight.** `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType` and no
 * owning project — measured — so it fires for a change to any plan note in the vault and this
 * one leaf re-reads one project's plans. Affordable exactly because the view is a singleton
 * and the query is project-scoped, which is what makes it different from the "once per synced
 * zone note" the project list's own filter exists to avoid.
 * *Trigger to narrow it: that payload gaining the owning project id.*
 */
const PLAN_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `planChangeSource.planIdOf` is: an event added to a list above WITHOUT the payload it
 * expects is then simply never delivered, instead of comparing `undefined` against an id and
 * matching whichever listener also has none.
 */
function projectIdOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<PlanEventPayload> }).payload;
	return typeof payload?.projectId === 'string' ? payload.projectId : null;
}

function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

export function createProjectPlansChangeSource(
	events: EventBus,
): (projectId: string, listener: () => void) => () => void {
	return (projectId: string, listener: () => void) => {
		const subscriptions = [
			...PROJECT_PLAN_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (projectIdOf(event) === projectId) listener();
				}),
			),
			...PLAN_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (changedEntityTypeOf(event) === 'renovation-plan') listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
```

If `PlanEventPayload` does not declare `projectId`, read `src/domain/plan/Plan.events.ts`:
`planCreated({ planId, projectId })` is published by `CreatePlanCommand`, so the field exists
on that event's payload even if the shared type does not name it. Widen the local
`Partial<...>` shape to `{ projectId?: unknown }` rather than widening the domain type.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/application/events/projectPlansChangeSource.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Watch the filter fail**

Temporarily delete `if (projectIdOf(event) === projectId)` (call `listener()` unconditionally)
and re-run. Expected: the "does not deliver a PlanCreated for another project" case goes RED.
Restore it.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add src/application/events/projectPlansChangeSource.ts tests/application/events/projectPlansChangeSource.test.ts
git commit -m "Add the change source for the set of plans in one project"
```

---

### Task 3: two new doors on `RenovationProjectQueryServices`, guarded at the root

`getProject` and `createPlan` are ALREADY guarded and already on the persistence bundle
(`src/plugin/composition-root.ts:225` and `:422-423`, `src/plugin/guardedServices.ts:111`
and `:220`). Only `listPlansByProject` is new. What this task adds is the view's own read
surface over them, its refusal arm, and the root wiring — plus the case that tells a
composition that wires them from one that does not.

**Files:**
- Modify: `src/presentation/read-models/renovationProjectQueries.ts`
- Modify: `src/plugin/guardedServices.ts` (the `listPlansByProject` guard + interface member)
- Modify: `src/plugin/composition-root.ts` (`renovationProjectDeps`)
- Modify: `tests/plugin/renovationProjectWiring.test.ts`
- Create: `tests/presentation/read-models/renovationProjectQueries.test.ts` (if absent —
  check `ls tests/presentation/read-models/` first and extend the existing file if one covers
  `createRenovationProjectQueries`)

**Interfaces:**
- Produces, on `RenovationProjectQueryServices`:
  - `getProject(projectId: string): Promise<Result<ProjectSummaryDto | null, RepositoryError>>`
  - `listPlansByProject(projectId: string): Promise<Result<readonly PlanSummaryDto[], RepositoryError>>`
- Produces, on `GuardedEditorServices`:
  `readonly listPlansByProject: Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>`

- [ ] **Step 1: Write the failing tests**

Add to the read-model test file:

```ts
/**
 * Both new doors map at THIS seam, not in the query: `application/` may not name
 * `presentation/`, so the query hands back domain entities and the DTO is minted here —
 * the same division `createPlanEditorQueries` draws for `getPlan` and `findZonesByPlan`.
 */
describe('createRenovationProjectQueries — the detail state’s two reads', () => {
	it('maps a found project to its summary DTO', async () => {
		const projects = new InMemoryProjectRepository();
		const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));
		const queries = createRenovationProjectQueries(
			new ListProjects(projects),
			new GetProject(projects),
			new ListPlansByProject(new InMemoryPlanRepository()),
		);

		const found = await queries.getProject(saved.entity.id);

		expect(isOk(found) && found.value).toEqual({ id: saved.entity.id, name: 'Hallway', status: saved.entity.status });
	});

	/**
	 * `ok(null)` travels through UNCHANGED — it is not an error and must not become one.
	 * `ProjectDetailStore` branches on exactly this to tell "no such project" from "the read
	 * failed", and flattening the two is what would tell a user their project was deleted
	 * because their vault hiccuped.
	 */
	it('passes a missing project through as ok(null)', async () => {
		const queries = createRenovationProjectQueries(
			new ListProjects(new InMemoryProjectRepository()),
			new GetProject(new InMemoryProjectRepository()),
			new ListPlansByProject(new InMemoryPlanRepository()),
		);

		const found = await queries.getProject('project-01JNOPE');

		expect(isOk(found) && found.value).toBeNull();
	});

	it('maps a project’s plans to summary DTOs', async () => {
		const plans = new InMemoryPlanRepository();
		const projectId = 'project-01JAAA' as ProjectId;
		expectOk(await plans.save(makePlan({ projectId, name: 'Ground floor' }), 'absent'));
		const queries = createRenovationProjectQueries(
			new ListProjects(new InMemoryProjectRepository()),
			new GetProject(new InMemoryProjectRepository()),
			new ListPlansByProject(plans),
		);

		const listed = await queries.listPlansByProject(projectId);

		expect(isOk(listed) && listed.value.map((plan) => plan.name)).toEqual(['Ground floor']);
	});

	/**
	 * ONE logical failure must not arrive under two codes when something downstream branches
	 * on it — the rule `unavailableRenovationProjectQueries` already states for `listProjects`.
	 */
	it('refuses both new doors with settings.unrecovered when settings could not be recovered', async () => {
		const queries = unavailableRenovationProjectQueries();

		const project = await queries.getProject('project-01JAAA');
		const plans = await queries.listPlansByProject('project-01JAAA');

		expect(isErr(project) && project.error.code).toBe('settings.unrecovered');
		expect(isErr(plans) && plans.error.code).toBe('settings.unrecovered');
	});
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run tests/presentation/read-models/
```

Expected: FAIL — `createRenovationProjectQueries` takes one argument.

- [ ] **Step 3: Widen the read-model bundle**

In `src/presentation/read-models/renovationProjectQueries.ts`:

```ts
export interface RenovationProjectQueryServices {
	listProjects(): Promise<Result<ProjectListView, RepositoryError>>;
	/**
	 * One project by id — design slice 21's detail state. `ok(null)` means "no such project"
	 * and travels through unchanged, because the store has to tell that apart from a failed
	 * read: navigating away on a failure would tell a user their project was deleted because
	 * their vault hiccuped.
	 */
	getProject(projectId: string): Promise<Result<ProjectSummaryDto | null, RepositoryError>>;
	/** That project's plans, as list rows read them. */
	listPlansByProject(projectId: string): Promise<Result<readonly PlanSummaryDto[], RepositoryError>>;
}
```

`unavailableRenovationProjectQueries` gains both, each returning `refuseUnrecovered` — the
SAME function, so the shared `settings.unrecovered` code cannot drift between them:

```ts
export function unavailableRenovationProjectQueries(): RenovationProjectQueryServices {
	return {
		listProjects: refuseUnrecovered,
		getProject: refuseUnrecovered,
		listPlansByProject: refuseUnrecovered,
	};
}
```

`refuseUnrecovered` currently takes no parameters and returns a `Promise<Result<never, …>>`-
shaped value; TypeScript accepts it for a one-parameter member because a function of fewer
parameters is assignable. If the return type does not unify, annotate `refuseUnrecovered`'s
return as `Promise<Result<never, RepositoryError>>` rather than writing a second refusal.

And the factory:

```ts
export function createRenovationProjectQueries(
	listProjects: Query<void, Result<ProjectListResult, RepositoryError>>,
	getProject: Query<GetProjectInput, Result<Loaded<Project> | null, RepositoryError>>,
	listPlansByProject: Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>,
): RenovationProjectQueryServices {
	return {
		async listProjects() { /* unchanged */ },

		/**
		 * The `as ProjectId` is the same boundary assertion every other edge of the system
		 * makes — `createPlanEditorQueries` states it for `as PlanId` at its own two doors.
		 * The id arrives from a `ProjectSummaryDto` this bundle itself minted or from
		 * Obsidian's view state, and the repository's answer for an id that names nothing is
		 * `ok(null)`, which is a case the caller already handles.
		 */
		async getProject(projectId) {
			const found = await getProject.execute({ projectId: projectId as ProjectId });
			if (isErr(found)) return found;
			return ok(found.value === null ? null : toProjectSummaryDto(found.value.entity));
		},

		async listPlansByProject(projectId) {
			const listed = await listPlansByProject.execute({ projectId: projectId as ProjectId });
			if (isErr(listed)) return listed;
			return ok(listed.value.map(toPlanSummaryDto));
		},
	};
}
```

- [ ] **Step 4: Guard `ListPlansByProject` at the root**

In `src/plugin/guardedServices.ts`, add to `GuardedEditorServices` beside `listProjects`:

```ts
	/**
	 * Design slice 21's detail-state read, guarded like every other door here (design slice
	 * 11) rather than composed raw — a bare application class leaving the root is exactly what
	 * `tests/plugin/guardCategory.test.ts` was built to catch.
	 */
	readonly listPlansByProject: Query<ListPlansByProjectInput, Result<Plan[], RepositoryError>>;
```

and in `composeGuarded`, beside the `listProjects` local (each guard call is a LOCAL `const`
first — assigning one straight into a field of the declared return type gives it a contextual
type and `E` then infers from the target):

```ts
	const listPlansByProject = guardQuery(new ListPlansByProject(plans), 'query.listPlansByProject.failed', logger, map);
```

then add `listPlansByProject` to the returned object.

- [ ] **Step 5: Wire it in `renovationProjectDeps`**

In `src/plugin/composition-root.ts`:

```ts
		queries: persistence
			? createRenovationProjectQueries(
					persistence.listProjects,
					persistence.queries.getProject,
					persistence.listPlansByProject,
				)
			: unavailableRenovationProjectQueries(),
```

- [ ] **Step 6: Add the wiring case**

In `tests/plugin/renovationProjectWiring.test.ts`, modelled on what that file already does
for `listProjects`:

```ts
/**
 * A composition that forgets a dependency COMPILES and passes everything else — the
 * `slice10CascadeWiring` reason. So this asserts on what the composed door actually
 * ANSWERS, against a real repository behind a real root, rather than on the member existing.
 */
it('hands the view both detail-state reads, composed against the real persistence stack', async () => {
	const { root, workspace, vault, projects } = await composedRoot();
	const saved = expectOk(await projects.save(makeProject({ name: 'Hallway' }), 'absent'));

	const deps = renovationProjectDeps(root, workspace, vault);

	const found = await deps.queries.getProject(saved.entity.id);
	const plans = await deps.queries.listPlansByProject(saved.entity.id);

	expect(isOk(found) && found.value?.name).toBe('Hallway');
	expect(isOk(plans) && plans.value).toEqual([]);
});
```

Read the file's existing setup helper before writing this — reuse whatever it already uses to
build a root rather than inventing `composedRoot`.

- [ ] **Step 7: Confirm `guardCategory` reaches the new query**

`tests/plugin/guardCategory.test.ts` finds doors by SHAPE and its own header lists what it
cannot see. **Verify, do not assume.** Run it, then temporarily replace the guarded
`listPlansByProject` in `composeGuarded` with the raw `new ListPlansByProject(plans)` and run
again:

```bash
npx vitest run tests/plugin/guardCategory.test.ts
```

Expected: PASS guarded, FAIL raw (a raw command REJECTS where the mapped
`vault.unexpected-failure` is required). If it passes BOTH ways, the walk does not reach this
door — say so in the commit message and add the door to that file's header list rather than
leaving a guard nothing checks.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Give the project view its detail-state reads, guarded at the root"
```

---

### Task 4: `ProjectDetailStore`

Two reads that combine all-or-nothing, a request ticket, the re-hydration guard, and the one
rule that took the spec three drafts: **navigating away on a missing project requires the
initial index scan to have COMPLETED — zero entries included.**

**Files:**
- Create: `src/presentation/stores/ProjectDetailStore.ts`
- Create: `tests/presentation/stores/projectDetailStore.test.ts`
- Modify: `src/presentation/emptyStates/selectors.ts` (add `selectProjectDetailEmptyState`)

**Interfaces:**
- Consumes: `RenovationProjectQueryServices.getProject`, `.listPlansByProject` (Task 3).
- Produces:
  ```ts
  useProjectDetailStore(): {
    project: Ref<ProjectSummaryDto | null>;
    plans: Ref<readonly PlanSummaryDto[]>;
    status: Ref<'idle' | 'loading' | 'ready' | 'failed' | 'gone'>;
    error: Ref<RepositoryError | null>;
    emptyStateKey: ComputedRef<'noPlans' | null>;
    hydrate(queries: RenovationProjectQueryServices, projectId: string, indexScanCompleted: boolean): Promise<void>;
    reset(): void;
  }
  ```
  `'gone'` is the state `ViewRoot` watches to navigate back to the list; it is a STATUS rather
  than a callback so the store stays a pure function of query results and the navigation stays
  a rendering rule — slice 14's own division, applied here.

- [ ] **Step 1: Write the failing tests**

Create `tests/presentation/stores/projectDetailStore.test.ts`. Model the setup on
`tests/presentation/stores/renovationProjectStore.test.ts` (read it first for the
`createPinia`/`setActivePinia` boilerplate this repository uses).

```ts
const PROJECT: ProjectSummaryDto = { id: 'project-01JAAA', name: 'Hallway', status: 'IDEA' };

function queriesAnswering(overrides: Partial<RenovationProjectQueryServices>): RenovationProjectQueryServices {
	return {
		listProjects: () => Promise.reject(new Error('not exercised')),
		getProject: () => Promise.resolve(ok(PROJECT)),
		listPlansByProject: () => Promise.resolve(ok([])),
		...overrides,
	};
}

describe('ProjectDetailStore', () => {
	it('is ready with the project and its plans when both reads answer', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ listPlansByProject: () => Promise.resolve(ok([{ id: 'plan-1', name: 'Ground floor' }])) }), PROJECT.id, true);

		expect(store.status).toBe('ready');
		expect(store.project?.name).toBe('Hallway');
		expect(store.plans.map((plan) => plan.name)).toEqual(['Ground floor']);
	});

	/**
	 * A failed read is NOT a missing project. Navigating away on one would tell a user their
	 * project was deleted because their vault hiccuped — the whole reason
	 * `ProjectStoreStatus` keeps `missing` and `failed` apart, kept here.
	 */
	it('fails rather than going, when a read refuses', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.status).toBe('failed');
		expect(store.error?.code).toBe('project.read-failed');
	});

	/**
	 * No partial state: either both reads answered and the detail draws, or neither did. There
	 * is no honest picture of a project whose identity loaded but whose plans did not.
	 */
	it('draws nothing at all when the plans read refuses and the project read succeeded', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ listPlansByProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.status).toBe('failed');
		expect(store.project).toBeNull();
		expect(store.plans).toEqual([]);
	});

	it('is gone when the project is missing and the scan has completed', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, true);

		expect(store.status).toBe('gone');
	});

	/**
	 * **The restored-leaf hazard, driven in the order the hazard is about.** Obsidian restores
	 * its leaves BEFORE `onLayoutReady`, and the index scan runs from it — so a detail leaf
	 * restored with the app hydrates against an EMPTY index and `getProject` answers a
	 * perfectly legitimate `ok(null)`. Going there would set `{ projectId: '' }` and destroy
	 * the very view state criterion 8 exists to preserve, which no later read can restore.
	 *
	 * Hydrate FIRST, rebuild AFTER: hydrating a scanned index passes either way.
	 */
	it('holds the loading state on a missing project while the scan has not completed', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, false);

		expect(store.status).toBe('loading');
	});

	it('reaches the project once the scan has run and the re-hydrate arrives', async () => {
		const store = useProjectDetailStore();
		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, false);

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(store.status).toBe('ready');
	});

	/**
	 * **The case that discriminates `indexScanCompleted` from the "seen populated" rule it
	 * replaced.** A vault whose only project note was deleted while Obsidian was closed
	 * rebuilds to a legitimately EMPTY index, so "populated" never becomes true, the `ok(null)`
	 * arm never fires, and the pane spins for the session. Every other case here passes under
	 * both rules; this one does not.
	 */
	it('reaches the list rather than spinning when the completed scan found nothing at all', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(ok(null)) }), PROJECT.id, true);

		expect(store.status).toBe('gone');
	});

	/**
	 * The ticket. A slower EARLIER read must not land on top of a faster later one — without
	 * it the content silently reverts with no error anywhere. Driven with a deferred first
	 * read so the earlier request genuinely settles last.
	 */
	it('discards a slower earlier read when a later one has already landed', async () => {
		const store = useProjectDetailStore();
		let releaseFirst = (): void => undefined;
		const slow = new Promise<void>((resolve) => { releaseFirst = () => { resolve(); }; });

		const first = store.hydrate(
			queriesAnswering({ getProject: async () => { await slow; return ok({ ...PROJECT, name: 'Stale' }); } }),
			PROJECT.id,
			true,
		);
		await store.hydrate(queriesAnswering({}), PROJECT.id, true);
		releaseFirst();
		await first;

		expect(store.project?.name).toBe('Hallway');
	});

	/**
	 * The re-hydration guard — ONE line, and its absence is a flicker no assertion about final
	 * content can see. `onPlansChanged`'s index arm fires for ANY plan note in the vault, so
	 * without it a background sync flickers the whole detail state through its loading line
	 * while the user is reading it.
	 */
	it('does not flip a ready detail state through its loading line while re-reading', async () => {
		const store = useProjectDetailStore();
		await store.hydrate(queriesAnswering({}), PROJECT.id, true);
		const seen: string[] = [];
		watch(() => store.status, (value) => { seen.push(value); });

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(seen).not.toContain('loading');
	});

	/**
	 * Structurally gated on `'ready'` — the `RenovationProjectStore.emptyStateKey` shape, not
	 * `ProjectStore`'s stated-exception one — so a failed read can never render as "no plans
	 * yet".
	 */
	it('offers no empty state from any status but ready', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({ getProject: () => Promise.resolve(err(READ_FAILED)) }), PROJECT.id, true);

		expect(store.emptyStateKey).toBeNull();
	});

	it('offers noPlans when a ready project has no plans', async () => {
		const store = useProjectDetailStore();

		await store.hydrate(queriesAnswering({}), PROJECT.id, true);

		expect(store.emptyStateKey).toBe('noPlans');
	});
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run tests/presentation/stores/projectDetailStore.test.ts
```

Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Add the selector**

In `src/presentation/emptyStates/selectors.ts`:

```ts
/**
 * A project with no plans yet (design slice 21). A function of QUERY RESULTS, like its two
 * siblings — `status` is the store's structural gate above it, never a fourth argument here,
 * which is what keeps "which state is this project in" answerable by a node test.
 */
export function selectProjectDetailEmptyState(plans: readonly PlanSummaryDto[]): 'noPlans' | null {
	return plans.length === 0 ? 'noPlans' : null;
}
```

- [ ] **Step 4: Write the store**

Create `src/presentation/stores/ProjectDetailStore.ts`:

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import { selectProjectDetailEmptyState } from '../emptyStates/selectors';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';

/**
 * How far the detail state got, and `'gone'` is the member the other two stores here do not
 * have.
 *
 * `'gone'` means "the scan has run and this project is not in the vault", which is what
 * `ViewRoot` navigates back to the list on. It is a STATUS rather than a callback the store
 * fires, so the store stays a pure function of what the queries answered and "navigate" stays
 * a rendering rule — slice 14's own division between a selector and a component.
 *
 * `'failed'` is separate from it for the reason `ProjectStoreStatus` keeps its own two apart:
 * a failed read is a real problem, and navigating on one would tell a user their project was
 * deleted because their vault hiccuped.
 */
type ProjectDetailStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'gone';

export const useProjectDetailStore = defineStore('project-detail', () => {
	const project = ref<ProjectSummaryDto | null>(null);
	const plans = ref<readonly PlanSummaryDto[]>([]);
	const status = ref<ProjectDetailStatus>('idle');
	const error = ref<RepositoryError | null>(null);

	/**
	 * The ticket every `hydrate` takes before its first await, so a slower earlier read cannot
	 * land on top of a faster later one — `ProjectStore.hydrate` and `InspectorStore` carry
	 * the same mechanism. This store has FOUR callers from day one, which is exactly the
	 * condition that made the ticket necessary there: the mount, `onProjectsChanged`, the
	 * awaited re-read after a successful create, and `onPlansChanged`.
	 */
	let latestHydration = 0;

	/** A failed read leaves NO stale content behind — `ProjectStore.fail`'s rule. */
	function fail(cause: RepositoryError): void {
		project.value = null;
		plans.value = [];
		error.value = cause;
		status.value = 'failed';
	}

	/**
	 * `status` drops to `'loading'` only when it is not already `'ready'` — the same guard
	 * `RenovationProjectStore.hydrate` carries, and the exposure here is WIDER than there:
	 * `onPlansChanged`'s index arm fires for any plan note in the vault, so without this a
	 * background sync flickers the whole detail state through its loading line while the user
	 * is reading it.
	 *
	 * `indexScanCompleted` is passed IN rather than read, because the store may not reach the
	 * plugin. It answers one question — has the initial scan RUN, zero entries included — and
	 * it is the difference between an authoritative `ok(null)` and one that merely raced the
	 * scan. Until it is true, a missing project holds the loading state; from then on it is
	 * the list.
	 *
	 * The two reads COMBINE all-or-nothing: there is no honest picture of a project whose
	 * identity loaded but whose plans did not.
	 */
	async function hydrate(
		queries: RenovationProjectQueryServices,
		projectId: string,
		indexScanCompleted: boolean,
	): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;

		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const found = await queries.getProject(projectId);
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}
		if (found.value === null) {
			// Not authoritative until the scan has run: a leaf restored before `onLayoutReady`
			// asks an EMPTY index and is answered a legitimate `ok(null)`. Going there would
			// destroy the `projectId` this state is about, and no later read could restore it.
			if (indexScanCompleted) status.value = 'gone';
			return;
		}

		const listed = await queries.listPlansByProject(projectId);
		if (superseded()) return;
		if (isErr(listed)) {
			fail(listed.error);
			return;
		}

		project.value = found.value;
		plans.value = listed.value;
		status.value = 'ready';
	}

	/**
	 * Structurally gated on `'ready'`, so a failed or missing read is literally unreachable
	 * from an empty state rather than merely unreached by convention.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready' ? selectProjectDetailEmptyState(plans.value) : null,
	);

	/**
	 * Rebuilds this store to its opening state (ADR-005). Nothing calls it today: every
	 * navigation REMOUNTS, so each detail state gets a fresh `createPinia()` and this store
	 * has no cross-navigation lifetime to protect. Declared for the reason
	 * `RenovationProjectStore.reset` is — a shape deleted whenever nothing calls it stops
	 * being a declared shape.
	 */
	function reset(): void {
		latestHydration += 1;
		project.value = null;
		plans.value = [];
		error.value = null;
		status.value = 'idle';
	}

	return { project, plans, status, error, emptyStateKey, hydrate, reset };
});
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
npx vitest run tests/presentation/stores/projectDetailStore.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 6: Watch the two guards fail**

Both of these have to be seen red, because each is one line and each is invisible in a green run:

1. Change `if (indexScanCompleted) status.value = 'gone';` to an unconditional
   `status.value = 'gone';`. Expected: the "holds the loading state" case goes RED.
2. Change `if (status.value !== 'ready') status.value = 'loading';` to an unconditional
   `status.value = 'loading';`. Expected: the "does not flip a ready detail state" case goes RED.

Restore both.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add src/presentation/stores/ProjectDetailStore.ts src/presentation/emptyStates/selectors.ts tests/presentation/stores/projectDetailStore.test.ts
git commit -m "Add the project detail store, with the index-scan gate a restored leaf needs"
```

---

### Task 5: five new `RenovationProjectDeps` members, and the helper that grows with them

`presentation/` may not reach `infrastructure/`, so every one of these is a seam the
composition root has to fill — and **a component emitting an event no context member answers
compiles and does nothing.** The spec's own first draft named one of the five.

**Execute Task 11 before this task.** `navigate` routes through `navigateToProject`, which
Task 11 builds — see the code below and the ruling in the ledger. Task 11 depends on nothing
in Tasks 1–10, so the execution order is 1, 2, 3, 4, **11**, 5, 6, 7, 8, 9, 10, 12, 13. The
task numbering is unchanged so that briefs, the ledger and the PR discussion keep referring to
the same things.

`tests/helpers/makeRenovationProjectView.ts` grows **in the same edit**. It is in
`tsconfig.json`'s `include` for exactly this: its docblock promises that a grown constructor
requirement "meets every consumer at the same time", and that promise has already been broken
once (slice 16's `commands.logger`, handed down as `undefined`).

**Files:**
- Modify: `src/presentation/views/RenovationProjectContext.ts`
- Modify: `src/plugin/composition-root.ts` (`renovationProjectDeps`)
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (the index-scan flag, `projectViewDeps`)
- Modify: `tests/helpers/makeRenovationProjectView.ts`
- Modify: `tests/plugin/renovationProjectWiring.test.ts`

**Interfaces:**
- Produces, on `RenovationProjectDeps`:
  ```ts
  readonly projectId: string | null;
  readonly navigate: (projectId: string | null) => void;
  readonly openPlan: (planId: string) => Promise<void>;
  readonly onPlansChanged: (projectId: string, listener: () => void) => () => void;
  readonly indexScanCompleted: () => boolean;
  ```
- Produces: `renovationProjectDeps(root, workspace, vault, options: { projectId: string | null; navigate: (projectId: string | null) => void; indexScanCompleted: () => boolean }): RenovationProjectDeps`

- [ ] **Step 1: Add the five members**

In `src/presentation/views/RenovationProjectContext.ts`, inside `RenovationProjectDeps`:

```ts
	/**
	 * Which state this mount draws: `null` is the LIST, a string is that project's detail
	 * state. Fixed per mount, never reactive — the view REMOUNTS per navigation
	 * (`RenovationProjectView.sync`), so the tree is built from this value and the two cannot
	 * disagree. A provided `Ref` would be the first reactive member any view context here
	 * carries and a second way a Vue tree in this plugin learns its subject changed.
	 */
	readonly projectId: string | null;
	/**
	 * Go to a project, or back to the list with `null`. The ONE writer of that state.
	 *
	 * It is a `setViewState` round trip rather than a store mutation, and that round trip is
	 * what buys the pane's own back and forward arrows: `RenovationProjectView.setState` sets
	 * `ViewStateResult.history`, so each navigation is an entry in Obsidian's own leaf
	 * navigation history. A `showList()` method on the view would be a second decider.
	 */
	readonly navigate: (projectId: string | null) => void;
	/**
	 * Open a plan in the Plan Editor — bound to `revealPlanEditor` at the root, the same shape
	 * and for the same reason as `openProject`: `presentation/` may not reach Obsidian's
	 * workspace, and a `PlanSummaryDto` carries no path.
	 */
	readonly openPlan: (planId: string) => Promise<void>;
	/**
	 * "Some plan of THIS project changed — re-read it." The third change source
	 * (`projectPlansChangeSource`), filtered on the owning project, which `PlanCreated`'s
	 * payload carries.
	 *
	 * Returns its own disposer, registered as an unmount hook for the reason
	 * `onProjectsChanged` states: Obsidian REUSES a view, so a subscription outliving its Vue
	 * app stacks another on every reopen.
	 */
	readonly onPlansChanged: (projectId: string, listener: () => void) => () => void;
	/**
	 * Has the initial index scan RUN — zero entries included.
	 *
	 * What makes a `getProject` answering `ok(null)` authoritative rather than a race against
	 * layout-ready. Obsidian restores its leaves BEFORE `onLayoutReady` and the scan runs from
	 * it, so a restored detail state asks an empty index and gets a legitimate `ok(null)`;
	 * acting on that would set `{ projectId: '' }` and destroy the state it is about.
	 *
	 * **A predicate rather than a subscription, and not a reuse of `onProjectsChanged`.** That
	 * callback collapses three events into one payload-less signal by design, so a listener
	 * cannot tell a completed rebuild from a `ProjectCreated` — treating any callback as proof
	 * of a scan would let a create in another leaf authorise the navigation. The store needs
	 * the answer AT HYDRATE TIME, and the re-hydrate already arrives through
	 * `onProjectsChanged`; a second subscription would be a second thing to dispose for a fact
	 * that never goes back to false.
	 *
	 * **The question is whether the scan RAN, never whether it found anything.** An earlier
	 * draft asked "has the index been populated", which hangs a restored pane forever in a
	 * vault whose last project note was deleted while Obsidian was closed.
	 */
	readonly indexScanCompleted: () => boolean;
```

- [ ] **Step 2: Build and read the failures**

```bash
npm run build
```

Expected: `vue-tsc` errors at `renovationProjectDeps` (`composition-root.ts`) and at
`makeRenovationProjectView.ts`'s annotated `defaults` — both are missing members. That is the
mechanism working; the annotation on `defaults` is what turns a silent `undefined` into this
error.

- [ ] **Step 3: Set the index-scan flag in the plugin**

In `src/plugin/RenovationPlannerPlugin.ts`, add a private field and set it in
`startPersistence` in the step that already publishes the rebuild:

```ts
	/**
	 * Has the initial index scan completed — zero entries included.
	 *
	 * Set in `startPersistence` beside the `projectIndexRebuilt()` publish, which is
	 * unconditional after `index.rebuild(...)`: a completed EMPTY rebuild announces itself
	 * exactly like a completed full one, and the difference matters — see
	 * `RenovationProjectDeps.indexScanCompleted`, whose docblock carries why "populated" was
	 * the wrong question.
	 *
	 * Never goes back to false. A settings swap re-runs the scan against a new root, and the
	 * fact this records — that a scan has happened in this session — stays true.
	 */
	private indexScanCompleted = false;
```

and, immediately before the existing `void this.root.eventBus.publish(projectIndexRebuilt());`:

```ts
		// Set BEFORE the announce, so a subscriber re-hydrating on that event already sees a
		// completed scan. Announcing first would leave the very re-read this flag exists for
		// asking a question the flag still answers `false` to.
		this.indexScanCompleted = true;
```

Then `projectViewDeps()` grows:

```ts
	/** ONE spelling of the Renovation Project view's bundle, for the factory and the rebind. */
	private projectViewDeps(projectId: string | null, leaf: WorkspaceLeaf): RenovationProjectDeps {
		return renovationProjectDeps(this.root, this.app.workspace, this.app.vault, {
			projectId,
			// Through `navigateToProject` (Task 11), NOT a raw `setViewState`, and it closes
			// two holes at once. A bare `void` on a rejecting `setViewState` is an unhandled
			// rejection reaching nobody — the shape `runDetached` exists to close, and the
			// palette command's own door already answers it through `reportFault`. And two
			// row clicks before the first write settles issue CONCURRENT writes, where the
			// earlier one can settle last and reopen the project the user has navigated away
			// from: the same window Task 11's write chain closes, on the door a user is far
			// more likely to double-fire than a palette command. Both reported by a review
			// bot against this plan.
			//
			// It is also this repository's own "one action, every input" rule: the row, the
			// Back action and the palette command now reach ONE door rather than two that
			// have to be kept in step.
			navigate: (next) => {
				void navigateToProject(
					{
						workspace: this.app.workspace,
						reportFault: (cause: unknown): void => {
							notifyFault(cause, this.root.logger, 'view.project.reveal-failed');
						},
					},
					RENOVATION_PROJECT_VIEW,
					next,
				);
			},
			indexScanCompleted: () => this.indexScanCompleted,
		});
	}
```

**Read `registerView` and `rebindOpenViews` before writing this.** The factory currently calls
`projectViewDeps()` with no arguments; it now needs `projectId`, which the VIEW owns. It no
longer needs the LEAF — routing `navigate` through `navigateToProject` means the singleton is
resolved by view type rather than captured, which is one fewer thing for the factory to carry. The cleanest shape that keeps `projectId` the view's own
field is to hand the view a FACTORY rather than a bundle:

```ts
this.registerView(
	RENOVATION_PROJECT_VIEW,
	(leaf) => new RenovationProjectView(leaf, (projectId) => this.projectViewDeps(projectId, leaf)),
);
```

and `rebind` then takes the same factory type. Task 6 spells the view side. If that shape
turns out to fight `rebindOpenViews`, the alternative — keeping `deps` a bundle and giving the
view a `navigate` that closes over `this.leaf` — is equally acceptable, but say which you
took in the commit message: it is the one structural choice this task makes.

- [ ] **Step 4: Fill the seams in `renovationProjectDeps`**

```ts
		projectId: options.projectId,
		navigate: options.navigate,
		indexScanCompleted: options.indexScanCompleted,
		openPlan: persistence
			? (planId) =>
					revealPlanEditor(
						{
							workspace,
							reportFault: (cause: unknown): void => {
								notifyFault(cause, root.logger, 'view.plan-editor.reveal-failed');
							},
						},
						PLAN_EDITOR_VIEW,
						planId,
					)
			: () => Promise.resolve(),
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `onProjectsChanged` states three lines down: the bus is the root's own and exists
		// either way, and a refusal bundle re-reading simply refuses again.
		onPlansChanged: createProjectPlansChangeSource(root.eventBus),
```

`revealPlanEditor` already returns `Promise<void>` and answers its own faults inside
`revealCandidate`, so nothing here catches.

- [ ] **Step 5: Grow the test helper in the same edit**

In `tests/helpers/makeRenovationProjectView.ts`'s annotated `defaults`, and **each default
must ANSWER rather than merely satisfy the type** — the file's own comment already draws that
line for `openProject`:

```ts
	const defaults: RenovationProjectDeps = {
		queries: createRenovationProjectQueries(
			new ListProjects(projects),
			new GetProject(projects),
			new ListPlansByProject(plans),
		),
		commands: { createProject: new CreateProjectCommand(projects, events), createPlan: new CreatePlanCommand(plans, projects, events), logger: recorder },
		openProject: () => Promise.resolve('opened'),
		onProjectsChanged: () => () => undefined,
		// The LIST state, which is what a harness mount with no query string draws and what
		// every existing case of this factory has always been asserting against.
		projectId: null,
		// Records the ask rather than performing it: there is no Obsidian leaf here to set a
		// view state on, and a default that silently did nothing would let a view that never
		// calls `navigate` pass a test written to prove that it does.
		navigate: () => undefined,
		openPlan: () => Promise.resolve(),
		onPlansChanged: () => () => undefined,
		// TRUE, deliberately: the default vault here is a real in-memory repository that has
		// already been read, so `ok(null)` from it is authoritative. Defaulting to `false`
		// would put every case that mounts a detail state through this factory into the
		// restored-leaf holding pattern, which is a fake driving behaviour nothing asked for.
		indexScanCompleted: () => true,
	};
```

Add a `const plans = new InMemoryPlanRepository();` beside the existing `projects`, and note
in the docblock that `commands` now carries `createPlan` (Task 8 adds that member; if you are
executing tasks in order, add it here when Task 8 lands and leave `commands` alone for now).

**`navigate` and `openPlan` being no-ops is the one place this default is deliberately
inert**, and the reason is the same one `openProject` gives: they are Obsidian-workspace
operations this harness has none of. Every case that asserts on them passes its own `deps`.

- [ ] **Step 6: Build clean, then run the suite**

```bash
npm run build && npx vitest run
```

Expected: build PASSES; the suite passes. If a case fails because the helper's `deps` changed
shape, fix the case rather than the helper — the helper is the contract.

**One cross-task break is expected here and is not a mistake:** Task 3 Step 6's wiring case
calls `renovationProjectDeps(root, workspace, vault)` with three arguments, and this task adds
a required fourth. Update that call to pass
`{ projectId: null, navigate: () => undefined, indexScanCompleted: () => true }`, the same
literal the two new cases in Step 7 use.

- [ ] **Step 7: Add the wiring cases**

In `tests/plugin/renovationProjectWiring.test.ts`:

```ts
/**
 * `onPlansChanged` needs the SHARPER version of the wiring case, the one this file already
 * learned for `onProjectsChanged`: a root handed a FRESH `createEventBus()` also compiles and
 * also announces into an object nothing subscribed to. So drive a real `PlanCreated` through
 * the ROOT's own bus and assert on what a subscriber hears.
 */
it('binds onPlansChanged to the root’s own event bus, filtered to the project', async () => {
	const { root, workspace, vault } = await composedRoot();
	const deps = renovationProjectDeps(root, workspace, vault, {
		projectId: null,
		navigate: () => undefined,
		indexScanCompleted: () => true,
	});
	const heard = vi.fn();
	deps.onPlansChanged('project-01JAAA', heard);

	await root.eventBus.publish(planCreated({ planId: 'plan-01JXXX', projectId: 'project-01JAAA' }));

	expect(heard).toHaveBeenCalledTimes(1);
});

/**
 * `openPlan` is bound to the REAL `revealPlanEditor`, which is criterion 2's whole route from
 * the layer that raises the event to the layer allowed to import that function. Asserted on
 * the leaf that ends up holding the plan, because "setViewState was called" is equally true
 * of a build that opened the wrong thing.
 */
it('binds openPlan to revealPlanEditor', async () => {
	const { root, workspace, vault } = await composedRoot();
	const deps = renovationProjectDeps(root, workspace, vault, {
		projectId: null,
		navigate: () => undefined,
		indexScanCompleted: () => true,
	});

	await deps.openPlan('plan-01JXXX');

	const leaf = workspace.getLeavesOfType(PLAN_EDITOR_VIEW)[0];
	expect(leaf?.getViewState().state).toEqual({ planId: 'plan-01JXXX' });
});
```

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Give the project view the five seams its detail state needs"
```

---

### Task 6: the view's state machine — `getState`, `setState`, `sync`, `mount`, `unmount`

Criteria 7, 8, 11 and 13 live here, and so does the single assignment the back arrow depends
on. **Borrow the STRATEGY from `PlanEditorView`, never the `mount` body**: that view mounts
into a `contentEl.createDiv(...)` wrapper, and this one mounts onto `contentEl` DIRECTLY so
the component's root element IS the `.renovation-planner-view` the stylesheet gives
`height: 100%`. A copied wrapper has `height: auto` and collapses the pane — the defect the
browser harness caught in slice 1, and one jsdom cannot see.

**Files:**
- Modify: `src/presentation/views/RenovationProjectView.ts`
- Modify: `tests/presentation/views/renovationProjectView.test.ts`

**Interfaces:**
- Consumes: `RenovationProjectDeps` (Task 5); the deps FACTORY shape chosen in Task 5 Step 3.
- Produces: `getState(): Record<string, unknown>`, `setState(state: unknown, result: ViewStateResult): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/presentation/views/renovationProjectView.test.ts` (read its existing setup and
reuse `makeView`):

```ts
describe('the list and detail states', () => {
	/**
	 * `''` is a DESTINATION here, and it is the one place this view must not copy
	 * `PlanEditorView`. `planIdFrom` refuses an empty id and `setState` then leaves the field
	 * alone, which is right for a view whose empty case is *nothing to draw*. This view's
	 * empty case is the LIST — a state a user navigates to — so refusing `''` refuses the only
	 * state the back arrow ever restores, and the pane never leaves the detail state.
	 */
	it('accepts an empty projectId as the list state', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		await view.setState({ projectId: '' }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: '' });
	});

	it('round-trips detail → list → detail', async () => {
		const view = makeView();
		await view.onOpen();

		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		await view.setState({ projectId: '' }, {} as ViewStateResult);
		await view.setState({ projectId: 'project-01JBBB' }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: 'project-01JBBB' });
	});

	/**
	 * A value that is not a string at all is a layout this build does not recognise, and the
	 * conservative answer is to go on drawing whatever is already drawn.
	 */
	it('refuses a non-string projectId and keeps the state it already had', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		await view.setState({ projectId: 42 }, {} as ViewStateResult);

		expect(view.getState()).toEqual({ projectId: 'project-01JAAA' });
	});

	/**
	 * **The single assignment the back arrow works because of, and every other case in this
	 * slice passes without it.** `ViewStateResult.history` is documented as "there is a state
	 * change which should be recorded in the navigation history"; setting it puts each
	 * navigation into Obsidian's own leaf history. No gate here can check that Obsidian
	 * HONOURS it — `FakeLeaf` records asks rather than behaving — so this is the whole of what
	 * the suite can say, and `docs/tests/cases/` carries the rest.
	 */
	it('records each navigation in the leaf’s navigation history', async () => {
		const view = makeView();
		const result = {} as ViewStateResult;

		await view.setState({ projectId: 'project-01JAAA' }, result);

		expect(result.history).toBe(true);
	});

	/**
	 * What the `mounted` flag exists for. `PlanEditorView`'s guard returns on
	 * `planId === null` because there is nothing to draw; here `null` is the LIST, a real
	 * state — so a bare `projectId === mountedProjectId` guard skips the first open and the
	 * pane draws nothing at all.
	 */
	it('mounts the list on a first open', async () => {
		const view = makeView();

		await view.onOpen();

		expect(view.contentEl.querySelector('.renovation-planner-view')).not.toBeNull();
	});

	/** `onOpen` and `setState` race and the order is not something a plugin may assume. */
	it('does not mount twice when setState follows onOpen', async () => {
		const view = makeView();

		await view.onOpen();
		await view.setState({ projectId: '' }, {} as ViewStateResult);

		expect(view.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * The whole of the spec's first review finding: a tree built from `projectId` and NOT
	 * remounted goes on drawing the state it was built for, after a `setState` that did
	 * everything it was asked. Every other case here passes against that build.
	 */
	it('remounts when navigating between two projects', async () => {
		const mounted: (string | null)[] = [];
		const view = makeViewRecordingMounts(mounted);
		await view.onOpen();

		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);
		await view.setState({ projectId: 'project-01JBBB' }, {} as ViewStateResult);

		expect(mounted).toEqual([null, 'project-01JAAA', 'project-01JBBB']);
	});

	/** Criterion 7: `projectId` is the view's own field and a remount never touches it. */
	it('keeps the open project across a rebind', async () => {
		const view = makeView();
		await view.onOpen();
		await view.setState({ projectId: 'project-01JAAA' }, {} as ViewStateResult);

		view.rebind(/* the same factory shape Task 5 chose */);

		expect(view.getState()).toEqual({ projectId: 'project-01JAAA' });
	});
});
```

`makeViewRecordingMounts` is a local helper in this file that hands the view a deps factory
recording each `projectId` it is asked for — the same shape as `makeView` but with the
factory captured. Write it beside the cases rather than in `tests/helpers/`: it exists to
observe this one class.

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run tests/presentation/views/renovationProjectView.test.ts
```

Expected: FAIL — `view.setState is not a function`.

- [ ] **Step 3: Write the state machine**

In `src/presentation/views/RenovationProjectView.ts`:

```ts
/**
 * The workspace layout is a file the user can edit and a file another version of this plugin
 * wrote, so the project id arrives as `unknown` and is validated rather than cast — the same
 * trust boundary `settingsFrom` draws around `data.json`.
 *
 * **The parse is three-way, and the third arm is the one `PlanEditorView` does not have.**
 * `''` is the LIST — a state, not an absence — so it must be ACCEPTED and turned into `null`
 * rather than refused. `planIdFrom` refuses an empty id because that view's empty case is
 * *nothing to draw*; refusing it here would refuse the only state the back arrow ever
 * restores, and the pane would never leave the detail state.
 *
 * A value that is not a string at all is a layout this build does not recognise, and the
 * conservative answer to that is to go on drawing whatever is already drawn — which is the
 * refusal arm. A leaf restored from a layout written BEFORE this slice carries no `projectId`
 * key at all and lands there, correctly, because a freshly constructed view's field is already
 * `null` and `null` is the list. That the two coincide is worth stating so that nobody later
 * "simplifies" the refusal into a default and discovers the difference on a view that has
 * already navigated.
 */
function projectIdFrom(state: unknown): { projectId: string | null } | null {
	if (typeof state !== 'object' || state === null) return null;
	const projectId = (state as Record<string, unknown>)['projectId'];
	if (typeof projectId !== 'string') return null;
	return { projectId: projectId.length > 0 ? projectId : null };
}
```

and on the class:

```ts
	/**
	 * What Obsidian persists for this leaf, so reopening the app reopens the same project —
	 * PRD Epic 6's "Last Context" arriving as a consequence rather than as a feature.
	 *
	 * `''` rather than omitting the key, for the reason `PlanEditorView.getState` already
	 * gives: a key that is sometimes absent is a different shape to reason about. Here it also
	 * carries meaning — `''` IS the list.
	 */
	getState(): Record<string, unknown> {
		return { projectId: this.projectId ?? '' };
	}

	/**
	 * Called by Obsidian both when a leaf is restored and when `navigate` sets the state, and
	 * the ORDER relative to `onOpen` is not something a plugin gets to assume. Both route
	 * through one `sync()`.
	 *
	 * `result.history = true` is the entire reason the pane's back and forward arrows walk
	 * these navigations: `ViewStateResult.history` is documented as "there is a state change
	 * which should be recorded in the navigation history". `PlanEditorView` ignores its own
	 * `_result` and gets the same one-line win whenever it is next touched — listed in the
	 * spec's *Deliberately out of scope* so the register can see it, rather than left as a
	 * comment nothing schedules.
	 */
	setState(state: unknown, result: ViewStateResult): Promise<void> {
		const parsed = projectIdFrom(state);
		if (parsed !== null) this.projectId = parsed.projectId;
		result.history = true;
		this.sync();
		return Promise.resolve();
	}

	private projectId: string | null = null;
	private vueApp: VueApp | null = null;
	private mountedProjectId: string | null = null;
	/**
	 * Whether anything is mounted at all — and it is NOT redundant with
	 * `mountedProjectId !== null`. `null` is the list, a real state, so without this flag a
	 * first open (`null === null`) is skipped by the guard and the pane draws nothing.
	 * `PlanEditorView` needs no equivalent because there `null` means *nothing to draw*.
	 */
	private mounted = false;

	private sync(): void {
		if (this.mounted && this.projectId === this.mountedProjectId) return;
		this.unmount();
		this.mount(this.projectId);
	}
```

`onOpen` becomes `containerEl.addClass(...)` then `this.sync()`; `onClose` becomes
`this.unmount(); this.contentEl.empty();`; `rebind` becomes:

```ts
	rebind(deps: RenovationProjectDepsFactory): void {
		this.deps = deps;
		if (!this.mounted) return;
		this.unmount();
		this.sync();
	}
```

`mount` keeps **`app.mount(this.contentEl)` after `this.contentEl.empty()`** — no wrapper
div — and `containerEl.addClass('renovation-planner-container')` stays in `onOpen`, where it
is a fact about the leaf rather than about the mount:

```ts
	private mount(projectId: string | null): void {
		this.contentEl.empty();
		const app = createApp(ViewRoot);
		app.config.idPrefix = nextAppIdPrefix();
		app.use(createPinia());
		app.provide(RENOVATION_PROJECT_CONTEXT, this.deps(projectId));
		app.mount(this.contentEl);
		this.vueApp = app;
		this.mountedProjectId = projectId;
		this.mounted = true;
	}

	private unmount(): void {
		this.vueApp?.unmount();
		this.vueApp = null;
		this.mountedProjectId = null;
		this.mounted = false;
	}
```

Update the class docblock: the paragraph about `contentEl` and the no-wrapper height chain
STAYS (it is load-bearing and Task 6 is exactly where somebody would copy the editor's
wrapper), and a new paragraph records that every navigation remounts, discarding the list's
scroll position and settling any open dialog through `DialogHost.onBeforeUnmount` — both
correct for a deliberate navigation, both the residual `PlanEditorView.rebind` already carries.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run tests/presentation/views/renovationProjectView.test.ts
```

Expected: PASS.

- [ ] **Step 5: Watch three one-line guards fail**

Each of these is invisible in a green run and each has exactly one case:

1. Delete `result.history = true;` → the navigation-history case goes RED.
2. Change the guard to `if (this.projectId === this.mountedProjectId) return;` (drop
   `this.mounted &&`) → the "mounts the list on a first open" case goes RED.
3. Change `projectIdFrom`'s last line to `return projectId.length > 0 ? { projectId } : null;`
   → the "accepts an empty projectId" and round-trip cases go RED.

Restore all three.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add src/presentation/views/RenovationProjectView.ts tests/presentation/views/renovationProjectView.test.ts src/plugin/RenovationPlannerPlugin.ts
git commit -m "Give the project view a list state and a detail state in its own view state"
```

---

### Task 7: `PlanList.vue`, `ProjectDetail.vue`, and the shared `statusLabel`

Two components that DRAW only what they are given and emit ids — the shape `ProjectList.vue`
already has, so the three read as siblings. The status helper moves out of `ProjectList` at
its second consumer, because two expressions of one question in two files drift immediately.

**Files:**
- Create: `src/presentation/views/statusLabel.ts`
- Create: `src/presentation/views/PlanList.vue`
- Create: `src/presentation/views/ProjectDetail.vue`
- Create: `styles/project-detail.css`
- Modify: `styles/index.css`
- Modify: `src/presentation/views/ProjectList.vue`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Create: `tests/presentation/views/planList.test.ts`, `tests/presentation/views/projectDetail.test.ts`
- Modify: `tests/presentation/views/projectList.test.ts` (nothing should change behaviourally —
  run it to prove the extraction is a move)

**Interfaces:**
- Produces: `statusLabel(status: string): string` (`src/presentation/views/statusLabel.ts`)
- Produces: `PlanList` props `{ plans: readonly PlanSummaryDto[] }`, emits `open: [planId: string]`, `create: []`
- Produces: `ProjectDetail` props `{ project: ProjectSummaryDto; plans: readonly PlanSummaryDto[] }`,
  emits `back: []`, `openNote: []`, `openPlan: [planId: string]`, `createPlan: []`

**New locale keys** (both tables, sentence case):

| key | en | de |
|---|---|---|
| `view.project.back` | `Back to projects` | `Zurück zu den Projekten` |
| `view.project.open-note` | `Open note` | `Notiz öffnen` |
| `view.project.plans-title` | `Plans` | `Grundrisse` |
| `view.project.create-plan` | `New plan` | `Neuer Grundriss` |

`Grundriss`/`Grundrisse` is the word `de.ts` already uses for a plan
(`'command.open-plan-editor': 'Grundriss-Editor öffnen'`) — take the vocabulary from the file,
not from a dictionary. Run `npx vitest run tests/presentation/i18n/strings.test.ts` after
adding them: completeness is checked, and so are the two pinned German terms.

- [ ] **Step 1: Extract `statusLabel`, and prove the extraction is a move**

Create `src/presentation/views/statusLabel.ts` with the function and the ENTIRE docblock
currently sitting above `statusLabel` in `ProjectList.vue` — it explains why the fallback
exists and it belongs with the code:

```ts
import { isProjectStatus } from '../../domain/project/ProjectStatus';
import { PROJECT_STATUS_LABELS } from './projectStatusLabels';
import { tr } from '../i18n/strings';

/**
 * `ProjectSummaryDto.status` is typed `string`, not `ProjectStatus` — a project note this
 * build cannot recognise the lifecycle stage of is still a project this list must draw a row
 * for, so this cannot refuse the way `PROJECT_STATUS_LABELS[status]` alone would (an index
 * outside `Record<ProjectStatus, StringKey>`'s domain, `undefined` at runtime through the type
 * system's back). A recognised status resolves through the same label table `NewProjectForm`
 * uses, via `tr`; an unrecognised one renders as the raw value it actually is, deliberately,
 * rather than inventing a locale key for a value nothing in the domain can produce today
 * (`Project.create` refuses any `status` that fails `isProjectStatus`) — the fallback exists
 * for a note this build cannot fully make sense of, not for a value this build itself would
 * ever write.
 *
 * Extracted out of `ProjectList.vue` at its SECOND consumer (design slice 21's detail header),
 * rather than copied into it: two expressions of one question, two files apart, drift
 * immediately.
 */
export function statusLabel(status: string): string {
	return isProjectStatus(status) ? tr(PROJECT_STATUS_LABELS[status]) : status;
}
```

Delete the function and its imports from `ProjectList.vue`, import `statusLabel` instead, and run:

```bash
npx vitest run tests/presentation/views/projectList.test.ts
```

Expected: PASS unchanged. **If any assertion had to move, the extraction was not a move** —
stop and reconcile. If `projectList.test.ts` has no case for the unrecognised-status fallback,
add one to a new `tests/presentation/views/statusLabel.test.ts` now: the fallback is a branch
and the coverage margin is a handful of them.

- [ ] **Step 2: Write the failing component tests**

`tests/presentation/views/planList.test.ts`:

```ts
describe('PlanList', () => {
	it('draws one row per plan', () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor' }, { id: 'plan-2', name: 'First floor' }] } });

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual(['Ground floor', 'First floor']);
	});

	it('emits the plan id a row was clicked for', async () => {
		const wrapper = mount(PlanList, { props: { plans: [{ id: 'plan-1', name: 'Ground floor' }] } });

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('open')).toEqual([['plan-1']]);
	});

	it('emits create from its header button', async () => {
		const wrapper = mount(PlanList, { props: { plans: [] } });

		await wrapper.get('.rp-plan-list__create').trigger('click');

		expect(wrapper.emitted('create')).toHaveLength(1);
	});
});
```

`tests/presentation/views/projectDetail.test.ts`:

```ts
const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Hallway', status: 'IDEA' };

describe('ProjectDetail', () => {
	it('names the project and renders its status through the shared label', () => {
		const wrapper = mount(ProjectDetail, { props: { project: PROJECT, plans: [], emptyState: null } });

		expect(wrapper.get('.rp-project-detail__name').text()).toBe('Hallway');
		expect(wrapper.get('.rp-project-detail__status').text()).toBe(t('en', 'form.new-project.status.idea'));
	});

	it('emits back, openNote and createPlan from the header', async () => {
		const wrapper = mount(ProjectDetail, { props: { project: PROJECT, plans: [], emptyState: null } });

		await wrapper.get('.rp-project-detail__back').trigger('click');
		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await wrapper.get('.rp-plan-list__create').trigger('click');

		expect(wrapper.emitted('back')).toHaveLength(1);
		expect(wrapper.emitted('openNote')).toHaveLength(1);
		expect(wrapper.emitted('createPlan')).toHaveLength(1);
	});

	/**
	 * The re-emit is what criterion 2 travels through: `PlanList` emits an id, this component
	 * carries it up, and `ViewRoot` calls `context.openPlan`. A component that swallowed it
	 * would compile and do nothing.
	 */
	/**
	 * **The header survives an empty project**, which is every project a user has just
	 * created. Back and Open note live here and nowhere else, so an empty state drawn in
	 * PLACE of this component would fail criteria 5 and 11 on the most common detail state
	 * there is. Reported by a review bot against the plan.
	 */
	it('keeps back and open note when the project has no plans', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: PROJECT, plans: [], emptyState: { headline: 'h', body: 'b', actionLabel: 'a' } },
		});

		expect(wrapper.find('.rp-project-detail__back').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-plan-list').exists()).toBe(false);
	});

	it('carries a plan row’s id up from PlanList', async () => {
		const wrapper = mount(ProjectDetail, { props: { project: PROJECT, plans: [{ id: 'plan-1', name: 'Ground floor' }], emptyState: null } });

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(wrapper.emitted('openPlan')).toEqual([['plan-1']]);
	});
});
```

- [ ] **Step 3: Run and watch them fail**

```bash
npx vitest run tests/presentation/views/planList.test.ts tests/presentation/views/projectDetail.test.ts
```

Expected: FAIL — neither module resolves.

- [ ] **Step 4: Write `PlanList.vue`**

```vue
<script setup lang="ts">
/**
 * One project's plans, one row each, and the way to add another (design slice 21).
 *
 * Deliberately the shape `ProjectList.vue` already has — a header with a title and a create
 * button, then a `<ul>` of button rows — so the two read as siblings rather than as two
 * people's ideas of a list. It DISPATCHES nothing and opens nothing: it emits an id, and the
 * view calls `context.openPlan`, which the composition root supplied because `presentation/`
 * may not reach Obsidian's workspace.
 */
import type { PlanSummaryDto } from '../read-models/PlanDto';
import { tr } from '../i18n/strings';

defineProps<{ plans: readonly PlanSummaryDto[] }>();
defineEmits<{ open: [planId: string]; create: [] }>();
</script>

<template>
	<div class="rp-plan-list__header">
		<h3 class="rp-plan-list__title">
			{{ tr('view.project.plans-title') }}
		</h3>
		<button
			type="button"
			class="rp-plan-list__create"
			@click="$emit('create')"
		>
			{{ tr('view.project.create-plan') }}
		</button>
	</div>
	<ul class="rp-plan-list">
		<li
			v-for="plan in plans"
			:key="plan.id"
		>
			<button
				type="button"
				class="rp-plan-list__row"
				@click="$emit('open', plan.id)"
			>
				<span class="rp-plan-list__name">{{ plan.name }}</span>
			</button>
		</li>
	</ul>
</template>
```

`<h3>` and not `<h2>`: `ProjectList`'s title is the `<h2>` and this sits under the detail
header's own heading. **Heading order is one of the five things
`tests/harness/accessibility.test.ts` actually grades**, so getting this wrong fails Task 10
rather than review.

- [ ] **Step 5: Write `ProjectDetail.vue`**

```vue
<script setup lang="ts">
/**
 * One project (design slice 21): who it is, a way back, a way to its own note, and its plans.
 *
 * It draws only what it is given and emits intents — the row/emit division `ProjectList`
 * already states. `openNote` is a SECONDARY action rather than the row's behaviour: the row
 * navigates now, and `Project.md` stays reachable because the plugin would otherwise have no
 * route to a project's own metadata.
 *
 * The status reuses the shared `statusLabel`, which moved out of `ProjectList.vue` at this
 * second consumer.
 */
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import PlanList from './PlanList.vue';
import { statusLabel } from './statusLabel';
import { tr } from '../i18n/strings';

/**
 * `emptyState` is the resolved `EmptyState` props for a project with no plans, or `null`.
 * It is drawn INSIDE the plans region rather than in place of this component, because the
 * Back and Open note controls live in this header and nowhere else — replacing the whole
 * detail state with an empty state takes a newly created project's only way back with it.
 * Slice 14's own rule, arriving on a third surface: an empty state that replaces a region
 * hides the thing the region exists to show.
 */
defineProps<{
	project: ProjectSummaryDto;
	plans: readonly PlanSummaryDto[];
	emptyState: EmptyStateProps | null;
}>();
defineEmits<{ back: []; openNote: []; openPlan: [planId: string]; createPlan: [] }>();
</script>

<template>
	<div class="rp-project-detail">
		<div class="rp-project-detail__header">
			<button
				type="button"
				class="rp-project-detail__back"
				@click="$emit('back')"
			>
				{{ tr('view.project.back') }}
			</button>
			<h2 class="rp-project-detail__name">
				{{ project.name }}
			</h2>
			<span class="rp-project-detail__status">{{ statusLabel(project.status) }}</span>
			<button
				type="button"
				class="rp-project-detail__open-note"
				@click="$emit('openNote')"
			>
				{{ tr('view.project.open-note') }}
			</button>
		</div>
		<EmptyState
			v-if="emptyState !== null"
			v-bind="emptyState"
			@action="$emit('createPlan')"
		/>
		<PlanList
			v-else
			:plans="plans"
			@open="(planId) => $emit('openPlan', planId)"
			@create="$emit('createPlan')"
		/>
	</div>
</template>
```

`EmptyStateProps` is whatever `resolveEmptyState` returns — read
`src/presentation/emptyStates/resolve.ts` for the exported name and import the type rather
than restating its shape.

- [ ] **Step 6: Style it**

Create `styles/project-detail.css` and add `@import './project-detail.css';` to
`styles/index.css` in the same edit — **the build FAILS on a partial no entry file imports**.
Rules for `.rp-project-detail`, `__header`, `__back`, `__name`, `__status`, `__open-note`,
`.rp-plan-list`, `__header`, `__title`, `__create`, `__row`, `__name`. Copy the spacing and
row shape from `styles/view.css`'s `.rp-project-list` block rather than inventing a second
visual language.

**No hard-coded colour** — the build fails on any literal a declaration's value resolves to,
including a bare word like `red`. Use Obsidian's variables (`var(--text-muted)`,
`var(--background-modifier-border)`, `var(--size-4-2)`), which is what the existing partials
do. Give `.rp-plan-list__row` a minimum height of `var(--size-4-6)` or larger: the harness
index review already paid for a 19.5px row against WCAG 2.5.8's 24px minimum.

- [ ] **Step 7: Run the component tests and the locale gate**

```bash
npx vitest run tests/presentation/views/ tests/presentation/i18n/strings.test.ts
npm run build
```

Expected: PASS; the build resolves the new partial.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Draw a project's detail state and its plan list"
```

---

### Task 8: `NewPlanForm.vue`

One field, on `useFormCommit`, modelled on `NewProjectForm`. **No new dialog KIND** — it is
another `component` under the existing `kind: 'form'`, so CLAUDE.md's "a new dialog kind is
FIVE edits" does not apply.

**Files:**
- Create: `src/presentation/views/NewPlanForm.vue`
- Create: `tests/presentation/views/newPlanForm.test.ts`
- Modify: `src/presentation/views/renovationProjectCommands.ts` (add `createPlan`)
- Modify: `src/plugin/composition-root.ts` (`renovationProjectDeps`'s `commands`)
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `tests/plugin/renovationProjectCommandWiring.test.ts`
- Modify: `tests/helpers/makeRenovationProjectView.ts` — **`createPlan` is REQUIRED on
  `RenovationProjectCommandServices`, so the helper's annotated `defaults` stops compiling the
  moment this task lands.** That is the annotation doing its job (Task 5 left `commands` alone
  deliberately). Add
  `createPlan: new CreatePlanCommand(plans, projects, events)` beside `createProject`, using the
  `plans` repository Task 5 introduced, and note in the docblock that the default now ANSWERS a
  plan creation — the harness page can seed one by hand.

**Interfaces:**
- Consumes: `useFormCommit<CreatePlanInput, { plan: Loaded<Plan> }>({ initial, dispatch, errorMap, toUserMessage, logger })`.
- Produces: `NewPlanForm` props
  `{ projectId: string; dispatch: (input: CreatePlanInput) => Promise<Result<{ plan: Loaded<Plan> }, AppError>>; busy?: Ref<boolean>; logger: Logger }`,
  emits `submit: [values: CreatePlanInput]`, `projectGone: []`.
- Produces, on `RenovationProjectCommandServices`:
  `readonly createPlan: Command<CreatePlanInput, Result<{ plan: Loaded<Plan> }, CreatePlanError>>`

**New locale keys:**

| key | en | de |
|---|---|---|
| `form.new-plan.title` | `New plan` | `Neuer Grundriss` |
| `form.new-plan.name` | `Name` | `Name` |

**The field error map, read FROM THE RAISE SITES** — never from `en.ts`, because a table
derived from the locale file agrees with a typo. `grep -rn "plan.empty-name\|plan.project-not-found" src/`
in the same edit; `plan.project-not-found` is raised in
`src/application/commands/plan/CreatePlan.ts` via `referenceError(...)`, and `plan.empty-name`
is minted by `Plan.create` through a `plan.${code}` template, so a plain grep for the full
string finds nothing — read `src/domain/plan/Plan.ts` for the code it passes.

| code | routes to |
|---|---|
| `plan.empty-name` | the `name` field |
| `plan.project-not-found` | a **notice**, and back to the list |
| anything else | banner |

**The middle row is the one most likely to be re-simplified back into a banner by someone
reading the other two, and it cannot be one.** Navigating rebuilds the tree, the tree carries
`DialogHost`, and `onBeforeUnmount` settles the open dialog with its kind's cancel result — so
the form holding the banner is destroyed in the same gesture that would have drawn it, and the
user is returned to the list having been told nothing. Slice 13's notice queue renders on
`document.body` and therefore outlives the remount. Keeping the user in a detail state for a
project that no longer exists, so a banner has somewhere to live, is the worse answer.

This form therefore emits `projectGone` for that one code, and `ViewRoot` (Task 9) is what
notifies and navigates: a form does not reach the notice door itself, and it does not navigate.

- [ ] **Step 1: Write the failing tests**

`tests/presentation/views/newPlanForm.test.ts`, modelled on `newProjectForm.test.ts`:

```ts
describe('NewPlanForm', () => {
	it('dispatches the typed name against the project it was opened for', async () => {
		const dispatch = vi.fn().mockResolvedValue(ok({ plan: { entity: makePlan(), version: 1 } }));
		const wrapper = mount(NewPlanForm, { props: { projectId: 'project-1', dispatch, logger: recorder } });

		await wrapper.get('[data-field="name"]').setValue('Ground floor');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledWith({ projectId: 'project-1', name: 'Ground floor' });
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	/**
	 * Slice 16's rule, and the one this form must not re-decide: a rejected commit KEEPS the
	 * user's typed value and shows a persistent inline error. Reverting destroys the user's
	 * own input for no architectural reason — slice 6 already guarantees a rejected commit
	 * wrote nothing.
	 */
	it('keeps the typed value and shows the field error on a refusal', async () => {
		const dispatch = vi.fn().mockResolvedValue(err({ category: 'Domain', code: 'plan.empty-name', message: 'x' }));
		const wrapper = mount(NewPlanForm, { props: { projectId: 'project-1', dispatch, logger: recorder } });

		await wrapper.get('[data-field="name"]').setValue('  ');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('  ');
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	/** A repeated submit is ONE intent pressed twice, so the second is DROPPED. */
	it('drops a second submit while the first is in flight', async () => {
		let release = (): void => undefined;
		const dispatch = vi.fn().mockImplementation(() => new Promise((resolve) => { release = () => { resolve(ok({ plan: { entity: makePlan(), version: 1 } })); }; }));
		const wrapper = mount(NewPlanForm, { props: { projectId: 'project-1', dispatch, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		await wrapper.get('form').trigger('submit');
		await wrapper.get('form').trigger('submit');
		release();
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	/**
	 * The one refusal that reaches the user through NEITHER of `useFormCommit`'s two doors.
	 * Asserted as an EMIT rather than as a notice, because the form does not reach the notice
	 * door and does not navigate — `ViewRoot` owns both halves, and this case is what says the
	 * form told it.
	 */
	it('emits projectGone when the project vanished while the form was open', async () => {
		const dispatch = vi.fn().mockResolvedValue(err({ category: 'Reference', code: 'plan.project-not-found', message: 'x' }));
		const wrapper = mount(NewPlanForm, { props: { projectId: 'project-1', dispatch, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.emitted('projectGone')).toHaveLength(1);
		expect(wrapper.emitted('submit')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run tests/presentation/views/newPlanForm.test.ts
```

Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the form**

`src/presentation/views/NewPlanForm.vue`. Copy `NewProjectForm.vue`'s structure — the
`writeBusy`/`watchEffect` pair, `refuseWhileSubmitting`, `focusFirstInvalidControl`, the
`:value` + `@input` binding (never `v-model`, which assigns straight past `setField`) and the
`:readonly`/`aria-disabled` treatment. **Do not disable a focused control while a write is in
flight:** Chromium moves focus to `<body>`, which is outside `.rp-dialog`, and that takes
`Escape` and the whole Tab trap out for exactly the window `busy` exists to make `Escape`
refuse deliberately.

The parts that are this form's own:

```ts
const props = defineProps<{
	projectId: string;
	dispatch: (input: CreatePlanInput) => Promise<Result<{ plan: Loaded<Plan> }, AppError>>;
	busy?: Ref<boolean>;
	logger: Logger;
}>();

const emit = defineEmits<{ submit: [values: CreatePlanInput]; projectGone: [] }>();

/**
 * Read from the raise sites, never invented and never copied from `en.ts` — a table derived
 * from the locale file agrees with a typo. `plan.empty-name` is minted by `Plan.create`
 * through a `plan.${code}` template, so a grep for the whole string finds nothing;
 * `plan.project-not-found` is `CreatePlanCommand`'s own `referenceError`.
 *
 * `plan.project-not-found` is deliberately ABSENT from this map. It is not about a field and
 * it is not a banner either: the project vanished while the form was open, so the honest
 * answer is a notice and a return to the list, which the caller owns — see `onSubmit`.
 */
const NEW_PLAN_ERRORS: FieldErrorMap<CreatePlanInput> = {
	'plan.empty-name': 'name',
};

const INITIAL: CreatePlanInput = { projectId: props.projectId as ProjectId, name: '' };
```

`background` and `layers` stay unset: both are optional on `CreatePlanInput`, slice 5's
background is its own command, and a plan with no background is a state the editor already
draws an empty state for.

`onSubmit` gains the one branch `NewProjectForm` does not have. `useFormCommit.submit()`
answers a boolean, so the vanished-project code has to be observed where the failure is still
typed — hold the last dispatch result in a local `ref` written by a wrapping `dispatch`:

```ts
/**
 * The refusal that belongs to neither of `useFormCommit`'s doors, caught at the seam where it
 * is still a typed `AppError`. Wrapping `dispatch` rather than reading a banner string keeps
 * this a decision about a CODE — a message comparison would break the moment the copy
 * changed, and it would break in the direction of stranding the user.
 */
const projectGone = ref(false);

async function dispatchWatchingForAGoneProject(input: CreatePlanInput) {
	const result = await props.dispatch(input);
	if (isErr(result) && result.error.code === 'plan.project-not-found') projectGone.value = true;
	return result;
}

async function onSubmit(): Promise<void> {
	if (form.submitting.value) return;
	projectGone.value = false;
	if (await form.submit()) {
		emit('submit', form.values.value);
		return;
	}
	if (projectGone.value) {
		emit('projectGone');
		return;
	}
	await focusFirstInvalidControl();
}
```

- [ ] **Step 4: Add `createPlan` to the command bundle**

In `src/presentation/views/renovationProjectCommands.ts`, beside `createProject`, and in
`unavailableRenovationProjectCommands` with the same `persistenceFailure()` the sibling uses —
one refusal function, so the shared `settings.unrecovered` code cannot drift. In
`composition-root.ts`:

```ts
		commands: persistence
			? { createProject: persistence.createProject, createPlan: persistence.createPlan, logger: root.logger }
			: unavailableRenovationProjectCommands(),
```

`persistence.createPlan` is already the guarded command (`composition-root.ts:423`).

- [ ] **Step 5: Add the wiring case**

In `tests/plugin/renovationProjectCommandWiring.test.ts`, matching what that file does for
`createProject`: dispatch through `deps.commands.createPlan` against a real composed root and
assert the plan is in the vault afterwards, plus that the refusal bundle answers
`settings.unrecovered`.

- [ ] **Step 6: Run everything new and watch it pass**

```bash
npx vitest run tests/presentation/views/newPlanForm.test.ts tests/plugin/renovationProjectCommandWiring.test.ts
```

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Add the new-plan form and the command bundle it dispatches through"
```

---

### Task 9: `ViewRoot.vue` draws the detail state

The seam where every piece so far meets. `ViewRoot` reads `context.projectId` ONCE per mount
— the tree is rebuilt per navigation, so there is nothing to make reactive.

**Files:**
- Modify: `src/presentation/views/ViewRoot.vue`
- Create: `tests/presentation/views/viewRootProjectDetail.test.ts`
- Modify: `tests/presentation/views/viewRoot.test.ts` (the list state must go on drawing)
- Modify: `tests/presentation/views/viewRootOpenProject.test.ts` — **it asserts the behaviour
  criterion 1 replaces.** That file covers the row click opening the note and the `'missing'`
  re-read. Repoint its row-click cases at the detail header's Open note action, which is where
  `onOpenProject` still lives; do not delete the `'missing'` coverage, which is still real.

**Interfaces:**
- Consumes: everything from Tasks 3–8.
- Produces: no new exports; four new handlers inside `ViewRoot`.

- [ ] **Step 1: Write the failing tests**

`tests/presentation/views/viewRootProjectDetail.test.ts`. Build `deps` by hand, the way
`viewRootCreateProject.test.ts` does, because these cases need controlled dispatches and a
`navigate` they can observe.

```ts
describe('ViewRoot in the detail state', () => {
	it('draws the project it was mounted for, never the list', async () => {
		const wrapper = mountRoot({ projectId: 'project-1' });
		await flushPromises();

		expect(wrapper.find('.rp-project-detail').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list').exists()).toBe(false);
	});

	/**
	 * **Criterion 1, and the case an earlier draft of this plan had no route for.** The list
	 * row NAVIGATES; it does not open `Project.md`. Both halves asserted, because "navigate
	 * was called" is equally true of a build that also still opens the note.
	 */
	it('navigates into a project from a list row rather than opening its note', async () => {
		const navigate = vi.fn();
		const openProject = vi.fn().mockResolvedValue('opened');
		const wrapper = mountRoot({ projectId: null, navigate, openProject, projects: [{ id: 'project-1', name: 'Hallway', status: 'IDEA' }] });
		await flushPromises();

		await wrapper.get('.rp-project-list__row').trigger('click');

		expect(navigate).toHaveBeenCalledWith('project-1');
		expect(openProject).not.toHaveBeenCalled();
	});

	/**
	 * Criterion 5 and criterion 11 on the most common detail state there is — a project just
	 * created, with no plans. The empty state goes inside the plans region, never in place of
	 * the header that holds the only way back.
	 */
	it('keeps the way back and the note action on a project with no plans', async () => {
		const wrapper = mountRoot({ projectId: 'project-1', plans: [] });
		await flushPromises();

		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__back').exists()).toBe(true);
		expect(wrapper.find('.rp-project-detail__open-note').exists()).toBe(true);
	});

	/** Criterion 2's presentation half; the `revealPlanEditor` half is Task 5's wiring case. */
	it('opens a plan row through context.openPlan', async () => {
		const openPlan = vi.fn().mockResolvedValue(undefined);
		const wrapper = mountRoot({ projectId: 'project-1', openPlan, plans: [{ id: 'plan-1', name: 'Ground floor' }] });
		await flushPromises();

		await wrapper.get('.rp-plan-list__row').trigger('click');

		expect(openPlan).toHaveBeenCalledWith('plan-1');
	});

	it('navigates back to the list with null', async () => {
		const navigate = vi.fn();
		const wrapper = mountRoot({ projectId: 'project-1', navigate });
		await flushPromises();

		await wrapper.get('.rp-project-detail__back').trigger('click');

		expect(navigate).toHaveBeenCalledWith(null);
	});

	it('opens the project’s own note from the header', async () => {
		const openProject = vi.fn().mockResolvedValue('opened');
		const wrapper = mountRoot({ projectId: 'project-1', openProject });
		await flushPromises();

		await wrapper.get('.rp-project-detail__open-note').trigger('click');

		expect(openProject).toHaveBeenCalledWith('project-1');
	});

	/**
	 * Criterion 3, asserted on the RENDERED ROWS and not on "hydrate was called" — the latter
	 * is equally true of a build whose subscription hears nothing and whose create happens to
	 * re-read.
	 */
	it('shows a created plan in the rows without reopening the pane', async () => {
		const plans: PlanSummaryDto[] = [];
		const wrapper = mountRoot({
			projectId: 'project-1',
			plansRef: plans,
			createPlan: async (input) => { plans.push({ id: 'plan-9', name: input.name }); return ok({ plan: { entity: makePlan(), version: 1 } }); },
		});
		await flushPromises();

		await openTheFormAndSubmit(wrapper, 'Ground floor');

		expect(wrapper.findAll('.rp-plan-list__row').map((row) => row.text())).toEqual(['Ground floor']);
	});

	/**
	 * Criterion 4's one refusal that cannot be a banner. BOTH halves in one case, deliberately:
	 * "it navigated" is equally true of the build that tells the user nothing, and "a notice
	 * appeared" is equally true of the build that strands them in a dead detail state.
	 */
	it('returns to the list AND notifies when the project vanished while the form was open', async () => {
		const navigate = vi.fn();
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			createPlan: () => Promise.resolve(err({ category: 'Reference', code: 'plan.project-not-found', message: 'x' })),
		});
		await flushPromises();

		await openTheFormAndSubmit(wrapper, 'Ground floor');

		expect(navigate).toHaveBeenCalledWith(null);
		expect(noticeHost.shown).toHaveLength(1);
	});

	/**
	 * A failed read STAYS on the detail and shows the mapped sentence — it does not navigate.
	 * Navigating on a failure would tell a user their project was deleted because their vault
	 * hiccuped.
	 */
	it('shows the mapped failure sentence and stays put when a read refuses', async () => {
		const navigate = vi.fn();
		const wrapper = mountRoot({ projectId: 'project-1', navigate, getProject: () => Promise.resolve(err(READ_FAILED)) });
		await flushPromises();

		expect(wrapper.get('.rp-view-message').text()).toBe(t('en', /* the key READ_FAILED's code maps to */));
		expect(navigate).not.toHaveBeenCalled();
	});

	/**
	 * The Open note action racing a deletion. Asserted on the NAVIGATION rather than on
	 * "hydrate was called", because refreshing the list store from the detail state is
	 * equally true of the build that leaves the user on a stale screen — which is what an
	 * earlier draft of this plan specified. Reported by a review bot.
	 */
	it('returns to the list when the header’s note turns out to be gone', async () => {
		const navigate = vi.fn();
		let exists = true;
		const wrapper = mountRoot({
			projectId: 'project-1',
			navigate,
			openProject: () => { exists = false; return Promise.resolve('missing'); },
			getProject: () => Promise.resolve(exists ? ok(PROJECT) : ok(null)),
		});
		await flushPromises();

		await wrapper.get('.rp-project-detail__open-note').trigger('click');
		await flushPromises();

		expect(navigate).toHaveBeenCalledWith(null);
	});

	/** Criterion 6's other arm: the project really is gone, so return to the list. */
	it('navigates back to the list when the project is gone and the scan has run', async () => {
		const navigate = vi.fn();
		mountRoot({ projectId: 'project-1', navigate, getProject: () => Promise.resolve(ok(null)) });
		await flushPromises();

		expect(navigate).toHaveBeenCalledWith(null);
	});

	it('holds the loading line rather than navigating before the scan has run', async () => {
		const navigate = vi.fn();
		const wrapper = mountRoot({ projectId: 'project-1', navigate, indexScanCompleted: () => false, getProject: () => Promise.resolve(ok(null)) });
		await flushPromises();

		expect(navigate).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-view-message').text()).toBe(t('en', 'view.project.loading'));
	});

	it('disposes its onPlansChanged subscription on unmount', async () => {
		const dispose = vi.fn();
		const wrapper = mountRoot({ projectId: 'project-1', onPlansChanged: () => dispose });
		await flushPromises();

		wrapper.unmount();

		expect(dispose).toHaveBeenCalledTimes(1);
	});
});
```

`mountRoot` is a local factory in this file assembling a `RenovationProjectDeps` from the
overrides each case cares about; `openTheFormAndSubmit` clicks `.rp-plan-list__create`, waits
for the dialog, fills `[data-field="name"]` and submits. Write both at the top of the file.

For the notice assertion, use whatever `tests/presentation/notices/` already installs as the
`NoticeHost` — read `tests/helpers/` for it rather than reaching for `new Notice`.

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run tests/presentation/views/viewRootProjectDetail.test.ts
```

- [ ] **Step 3: Write the `ViewRoot` half**

Add to `<script setup>`:

```ts
const detail = useProjectDetailStore();
const { project, plans, status: detailStatus, error: detailError, emptyStateKey: detailEmptyKey } = storeToRefs(detail);
const newPlanBusy = ref(false);

/**
 * The ONE read the detail state has, on every occasion it runs — mount, a rebuilt index, a
 * plan changed anywhere in this project, and after a successful create. A second "refresh"
 * path would be a second answer to what this pane is showing.
 */
function hydrateDetail(projectId: string): Promise<void> {
	return detail.hydrate(context.queries, projectId, context.indexScanCompleted());
}

/**
 * `'gone'` is the store saying the scan has run and this project is not in the vault, which
 * is `ProjectOpenOutcome.'missing'`'s answer one level up: return to the list, which re-reads
 * on mount. A `watch` rather than a branch inside `hydrate`, because navigation is a rendering
 * rule and the store stays a pure function of what the queries answered.
 */
watch(detailStatus, (value) => {
	if (value === 'gone') context.navigate(null);
});

/**
 * `openDialog` THROWS `DialogStackingError` while a dialog is already open, so the guard is
 * the same `dialogs.current` check `onCreateProject` uses: the first call sets `current`
 * before its own `await` yields, so two clicks in one tick still only ever reach it once.
 */
async function onCreatePlan(projectId: string): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		// Resolved by the CALLER, never by the dialog — slice 15's rule, and neither half of
		// it is caught by lint, since a descriptor's `title:` is none of `I18N_LITERAL_BAN`'s
		// four call sites.
		title: tr('form.new-plan.title'),
		component: NewPlanForm,
		props: {
			projectId,
			dispatch: (input: CreatePlanInput) => context.commands.createPlan.execute(input),
			busy: newPlanBusy,
			logger: context.commands.logger,
			onProjectGone: () => {
				// The one refusal that reaches the user through neither of `useFormCommit`'s
				// doors. A notice rather than a banner because the navigation below destroys
				// the form the banner would have lived in, and slice 13's queue renders on
				// `document.body` and outlives the remount.
				notifyWarning(tr('view.project.gone'));
				context.navigate(null);
			},
		},
		busy: newPlanBusy,
	});
	if (result === 'cancel') return;
	await hydrateDetail(projectId);
}
```

`onProjectGone` as a prop is how a `FormDialog` component's emit is reached from a descriptor —
check `FormDialog.vue`'s prop forwarding before writing it; if the framework does not forward
`on*` props, add the emit handling there in the same edit and say so in the commit message.

`onMounted` and the subscriptions branch on `context.projectId`:

```ts
onMounted(() => {
	if (context.projectId === null) void hydrate();
	else void hydrateDetail(context.projectId);
});

onBeforeUnmount(
	context.onProjectsChanged(() => {
		if (context.projectId === null) void hydrate();
		else void hydrateDetail(context.projectId);
	}),
);

// Registered only in the detail state: the list has no project whose plans could change, and
// a subscription taken there would re-read a store nothing renders.
if (context.projectId !== null) {
	const projectId = context.projectId;
	onBeforeUnmount(context.onPlansChanged(projectId, () => { void hydrateDetail(projectId); }));
}
```

Template: the existing body becomes the `v-if="context.projectId === null"` branch, and the
`v-else` draws the detail state with the same three-region shape — the content, and the shared
`.rp-view-message` for loading and failure. The `.rp-view-notice` warning strip stays on the
LIST branch only: it is about unreadable PROJECTS, and `listPlansByProject` reports no such
count.

**The list branch is NOT unchanged, and an earlier draft of this plan said it was.** Criterion
1 is *"clicking a project row opens that project's detail state; it does **not** open
`Project.md`"* — so `ProjectList`'s `@open` repoints from `onOpenProject` to
`context.navigate(id)`. Leaving the handler alone would have preserved the exact behaviour
this slice exists to replace, on the slice's primary entry path, while every other case in
this plan passed. Reported by a review bot against the plan.

`onOpenProject` KEEPS its `'missing'` → re-hydrate arm and keeps its only remaining caller:
the detail header's **Open note** action (decision 5).

**But the arm has to re-read the store that is actually DRAWN, and an earlier draft of this
plan claimed the detail state would correct itself when nothing made it.** `onOpenProject`
called the LIST store's `hydrate()`; in the detail state that refreshes something invisible,
`detailStatus` stays `'ready'`, and the user sits on a project whose note is gone with no
correction coming. The sentence asserting otherwise was mine, in a reply on PR #42, and a
review bot measured it false one round later — this repository's oldest recurring shape, in
its newest place.

So the handler branches on which state is drawn:

```ts
/**
 * A row's click is a NAVIGATION now (criterion 1); this handler survives for the detail
 * header's Open note action, which is the one caller that still opens `Project.md`.
 *
 * `'missing'` means the id resolved to nothing, so the surface that asked is stale — and
 * WHICH surface asked decides which read corrects it. The list re-reads itself; the detail
 * state re-reads ITSELF, which answers `ok(null)`, settles `'gone'`, and returns the user
 * to the list through the `watch` above. Calling the list's `hydrate` from the detail state
 * refreshes something nobody is looking at.
 */
async function onOpenProject(projectId: string): Promise<void> {
	if ((await context.openProject(projectId)) !== 'missing') return;
	if (context.projectId === null) await hydrate();
	else await hydrateDetail(context.projectId);
}
```

**`ProjectDetail` draws for EVERY ready project, and the no-plans empty state goes INSIDE its
plans region.** Replacing the whole detail state with an `EmptyState` takes the Back and Open
note controls with it — they live in `ProjectDetail`'s header and nowhere else — so criterion
5 and criterion 11 would both fail for a project with no plans, which is *every project a user
has just created*. That is slice 14's own rule arriving on a third surface: **an empty state
that replaces a region hides the thing the region exists to show**, which is why both Plan
Editor empty states are overlays inside `PlanCanvas` rather than replacements for it. Also
reported by a review bot against the plan.

```vue
	<div class="renovation-planner-view">
		<template v-if="context.projectId === null">
			<!-- the list state, with ONE change: @open navigates -->
			<ProjectList
				:projects="projects"
				@open="(id) => context.navigate(id)"
				@create="onCreateProject"
			/>
		</template>
		<template v-else>
			<ProjectDetail
				v-if="detailStatus === 'ready' && project !== null"
				:project="project"
				:empty-state="detailEmpty"
				:plans="plans"
				@back="context.navigate(null)"
				@open-note="() => void onOpenProject(project!.id)"
				@open-plan="(planId) => void context.openPlan(planId)"
				@create-plan="() => void onCreatePlan(context.projectId!)"
			/>
			<div
				v-else
				class="rp-view-message"
			>
				<p v-if="detailFailureMessage !== null">
					{{ detailFailureMessage }}
				</p>
				<p v-else>
					{{ tr('view.project.loading') }}
				</p>
			</div>
		</template>
		<DialogHost />
	</div>
```

`context.projectId!` reads badly; hoist it into a `const openProjectId = context.projectId;`
narrowed once in `<script setup>` and use that in the template instead. **`ViewRoot.vue` is
approaching the 400-line cap** — check with `wc -l` before committing, and if it crosses,
extract the detail branch into a `ProjectDetailState.vue` that owns its own store and
handlers rather than shaving lines.

`view.project.gone` is a new locale key: en `This project no longer exists.`, de
`Dieses Projekt existiert nicht mehr.`

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run tests/presentation/views/
```

- [ ] **Step 5: Watch two cases fail for the right reason**

1. Delete the `watch(detailStatus, ...)` → "navigates back to the list when the project is
   gone" goes RED, and "holds the loading line" stays GREEN. Both directions matter.
2. Replace `onProjectGone`'s body with `context.navigate(null)` alone → the notice half of the
   vanished-project case goes RED while the navigation half passes. That pairing is the whole
   point of asserting both in one case.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Draw the detail state from ViewRoot and wire its four intents"
```

---

### Task 10: `renovationProject.noPlans`, and the axe scan that grades its button

Slice 16 flipped `content.test.ts`'s assertion for `noProjects` from *absent* to *present*;
this task does the same for `noPlans`. CLAUDE.md records `noZones` as the one
action-carrying empty state no axe scan reaches — **this slice must not make that two.**

**Files:**
- Modify: `src/presentation/emptyStates/content.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `tests/presentation/emptyStates/content.test.ts`
- Modify: `tests/harness/accessibility.test.ts`

**New locale keys:**

| key | en | de |
|---|---|---|
| `empty.project.no-plans.headline` | `No plans yet` | `Noch keine Grundrisse` |
| `empty.project.no-plans.body` | `Add a plan to start drawing zones and working out quantities.` | `Füge einen Grundriss hinzu, um Zonen zu zeichnen und Mengen zu ermitteln.` |
| `empty.project.no-plans.action` | `New plan` | `Neuer Grundriss` |

Copy is DISTINCT from `noProjects` — `content.test.ts` asserts distinctness, because a
registry pointing two entries at one key would type-check perfectly.

- [ ] **Step 1: Add the entry**

```ts
	renovationProject: {
		noProjects: { /* unchanged */ },
		/**
		 * Design slice 21. It carries an `actionLabel` from the day it ships, unlike
		 * `noProjects`, whose hand-off did not exist until slice 16: `ViewRoot.onCreatePlan`
		 * opens `NewPlanForm` in slice 15's `FormDialog` and dispatches the real
		 * `CreatePlanCommand`, so the button is a live control from the first commit rather
		 * than the dead one slice 14's Amendment 1 refuses.
		 */
		noPlans: {
			headline: 'empty.project.no-plans.headline',
			body: 'empty.project.no-plans.body',
			actionLabel: 'empty.project.no-plans.action',
		},
	},
```

`EMPTY_STATE_CONTENT.renovationProject` is keyed to match the selector's return type, so
`selectProjectDetailEmptyState` returning `'noPlans'` and this entry existing are checked
against each other by the compiler at `ViewRoot`'s lookup.

Also update `EmptyStateContent.actionLabel`'s docblock: it currently says
`planEditor.noBackground` is "the only reason the field is optional rather than the exception
to it", which stays true — but the sentence naming which entries carry a button needs
`noPlans` added, or it becomes the stale-comment defect this repository keeps paying for.

- [ ] **Step 2: Flip the content assertion**

In `tests/presentation/emptyStates/content.test.ts`, add `noPlans` to whatever table drives
the "every entry's keys resolve in both locales" case, and assert its `actionLabel` is
**present** — the shape slice 16 used for `noProjects`. The existing assertion that
`planEditor.noBackground` has NO action stays: that absence is a decision with a reason and
adding a button there must stay a deliberate, tested change.

- [ ] **Step 3: Scan it**

In `tests/harness/accessibility.test.ts`, beside the existing "reports no semantic violations
on the surface RenovationProjectView actually draws" case:

```ts
/**
 * The detail state, scanned WITH its action button. CLAUDE.md records `noZones` as the one
 * action-carrying empty state no axe scan reaches, and this slice must not make that two.
 *
 * `flushPromises()` before scanning is load-bearing and this file has already been burned by
 * its absence: `mountHarness` is synchronous and `void`s `onOpen`, so a scan one tick early
 * finds ZERO elements under any rule bucket — a pass that is true of an empty subtree and
 * indistinguishable from a pass on a compliant one. The presence assertions are what make
 * this a scan of something.
 */
it('reports no semantic violations on the project detail state and its action', async () => {
	const view = makeView(detailDeps({ projectId: 'project-1', plans: [] }));
	await view.onOpen();
	await view.setState({ projectId: 'project-1' }, {} as ViewStateResult);
	await flushPromises();

	const results = await axe.run(view.contentEl, AXE_OPTIONS);

	expect(view.contentEl.querySelector('.rp-empty-state')).not.toBeNull();
	expect(view.contentEl.querySelector('.rp-empty-state__action')).not.toBeNull();
	// The empty state sits INSIDE the detail shell, so this scan grades the header's controls
	// in the same pass — which is what makes it the scan of a real surface rather than of a
	// component in isolation.
	expect(view.contentEl.querySelector('.rp-project-detail__back')).not.toBeNull();
	expect(results.violations).toEqual([]);
});

/** The populated detail state draws different markup — a header, a heading and a row list. */
it('reports no semantic violations on a project with plans', async () => {
	const view = makeView(detailDeps({ projectId: 'project-1', plans: [{ id: 'plan-1', name: 'Ground floor' }] }));
	await view.onOpen();
	await view.setState({ projectId: 'project-1' }, {} as ViewStateResult);
	await flushPromises();

	const results = await axe.run(view.contentEl, AXE_OPTIONS);

	expect(view.contentEl.querySelector('.rp-project-detail')).not.toBeNull();
	expect(results.violations).toEqual([]);
});
```

Copy `AXE_OPTIONS` and the `makeView(...)` idiom from the cases already in that file.
`detailDeps` is a local factory there.

**Expect the second case to find something.** The heading order (`<h2>` for the project name,
`<h3>` for the plans title) is exactly what this scan grades, and the first run of this scan
against the Plan Editor found three real violations. If it does, fix the markup in Task 7's
files rather than relaxing the rule set.

- [ ] **Step 4: Run and commit**

```bash
npx vitest run tests/harness/accessibility.test.ts tests/presentation/emptyStates/
npm run check
git add -A
git commit -m "Give a project with no plans an actionable empty state, graded by axe"
```

---

### Task 11: `revealView` answers, and `navigateToProject` reveals then navigates

Decision 6's remedy, and **it leaves `reveal.ts` untouched**, which is most of the argument
for it. Three cases pin that module's coalescing, its release and its one-report-per-failure,
and its key derivation is load-bearing for `revealPlanEditor`, where two plans genuinely are
two leaves.

**Files:**
- Modify: `src/infrastructure/obsidian/workspace/revealView.ts`
- Create: `src/infrastructure/obsidian/workspace/navigateToProject.ts`
- Modify: `tests/infrastructure/obsidian/workspace/revealView.test.ts` (find the real path
  with `find tests -name 'revealView*'`)
- Create: `tests/infrastructure/obsidian/workspace/navigateToProject.test.ts`

**Interfaces:**
- Consumes: `revealCandidate(deps: RevealDeps, type, candidates, state?)`; `RevealDeps` already
  carries `reportFault`, so the fault door needs no new seam.
- Produces:
  - `revealView(deps: RevealDeps, type: string): Promise<boolean>`
  - `navigateToProject(deps: RevealDeps, type: string, projectId: string | null): Promise<void>`

- [ ] **Step 1: Make `revealView` answer**

```ts
/**
 * … (existing docblock) …
 *
 * **It ANSWERS whether the activation succeeded**, and leaf existence could not have answered
 * that question. `revealCandidate` wraps `await deps.workspace.revealLeaf(existing)` in its
 * own fault boundary and RESOLVES after reporting — `revealView.test.ts`'s "answers a fault on
 * the reuse path too" pins exactly that — so a failed reveal of an EXISTING leaf leaves that
 * leaf sitting in `getLeavesOfType`. A caller inferring success from the leaf being there
 * would go on to mutate a leaf it had just failed to show, and the reuse path is the NORMAL
 * one for a singleton view.
 *
 * Additive rather than the widening decision 6 refused: this is a RETURN VALUE, not a
 * parameter whose two callers want opposite answers. Both existing doors `void` the call and
 * are unaffected.
 */
export function revealView(deps: RevealDeps, type: string): Promise<boolean> {
	return revealCandidate(deps, type, () => deps.workspace.getLeavesOfType(type));
}
```

`revealCandidate` must therefore answer a boolean too. **Read it before editing**: it has
three `return` points and one `catch`. `true` on every path that got through
`setViewState`/`revealLeaf` without the fault handler firing; `false` from the outer `catch`
and from the inner `.catch` that calls `reportFault`. A joined activation returns whatever the
one it joined returned, which is what `return await inFlight` already gives once the map holds
`Promise<boolean>`.

Add to the existing reveal test file:

```ts
it('answers false when revealing an existing leaf faults, and the leaf is still there', async () => {
	const workspace = new FakeWorkspace();
	const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);
	workspace.revealLeaf = () => Promise.reject(new Error('boom'));
	const reportFault = vi.fn();

	const answered = await revealView({ workspace, reportFault }, RENOVATION_PROJECT_VIEW);

	expect(answered).toBe(false);
	expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toContain(leaf);
	expect(reportFault).toHaveBeenCalledTimes(1);
});

it('answers true on a successful reveal', async () => {
	const workspace = new FakeWorkspace();
	workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);

	expect(await revealView({ workspace, reportFault: vi.fn() }, RENOVATION_PROJECT_VIEW)).toBe(true);
});
```

Adapt the `FakeWorkspace` calls to whatever that helper actually exposes.

- [ ] **Step 2: Write `navigateToProject`'s failing tests**

```ts
/**
 * Decision 6's two steps, and each case here FAILS against the design the spec shipped with —
 * which is why they exist. `revealView(deps, type, { projectId })` does not compile
 * (`revealView` takes no state); `revealCandidate` sets state only on a leaf it CREATED, so
 * the normal case (an already-open pane) would have been left where it was; and `requestKey`
 * is the type plus the serialized state, which for a SINGLETON is the wrong key — two
 * invocations naming different projects produce two keys, neither joins the other, and both
 * create a leaf.
 */
describe('navigateToProject', () => {
	it('navigates a leaf that is already open', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);

		await navigateToProject({ workspace, reportFault: vi.fn() }, RENOVATION_PROJECT_VIEW, 'project-1');

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-1' });
	});

	/**
	 * Driven with two DIFFERENT projects on purpose: the same project passes against a key
	 * that coalesces on the request, and the singleton breaks only where they differ.
	 */
	it('leaves exactly one leaf for two invocations in one tick naming different projects', async () => {
		const workspace = new FakeWorkspace();
		const deps = { workspace, reportFault: vi.fn() };

		await Promise.all([
			navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-1'),
			navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-2'),
		]);

		expect(workspace.getLeavesOfType(RENOVATION_PROJECT_VIEW)).toHaveLength(1);
	});

	/**
	 * The superseded request writes NOTHING — which is the ticket's own job, and the half the
	 * write chain does not do. A chain alone would remount to the first project and then to
	 * the second, which is the flicker the ticket exists to avoid, and asserting only the
	 * final state cannot tell the two apart.
	 *
	 * An earlier draft of this plan had a `deferredSetViewState` case here instead, awaiting
	 * both navigations and only then releasing the held write — which cannot finish, because
	 * neither navigation resolves until that write does. It would have timed out rather than
	 * checked an ordering, and with the write chain in place the scenario it described is
	 * unreachable anyway. Reported by a review bot; the helper is deleted with the case.
	 */
	it('performs no write at all for a request superseded in the same tick', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);
		const written = recordSetViewState(leaf);
		const deps = { workspace, reportFault: vi.fn() };

		await Promise.all([
			navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-1'),
			navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-2'),
		]);

		expect(written.map((state) => state.projectId)).toEqual(['project-2']);
	});

	/**
	 * **The window the ticket alone does not close**, and it is separate from the case above
	 * because the two calls do NOT overlap at the ticket check: the first passes it, begins a
	 * slow write, and only then does the second arrive. Without the write chain the first
	 * settles last and restores the project the user navigated away from. Reported by a review
	 * bot; the same-tick case passes against that build.
	 */
	it('ends on the later project when a second navigation arrives mid-write', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);
		const deps = { workspace, reportFault: vi.fn() };
		const writes = slowSetViewState(leaf); // first write resolves only when released

		const first = navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-1');
		await writes.firstWriteStarted;
		const second = navigateToProject(deps, RENOVATION_PROJECT_VIEW, 'project-2');
		writes.releaseFirst();
		await Promise.all([first, second]);

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-2' });
	});

	/**
	 * The case that fails against any build inferring success from the leaf being there —
	 * which every other case here passes with.
	 */
	it('navigates nothing when revealing an existing leaf faulted', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);
		workspace.revealLeaf = () => Promise.reject(new Error('boom'));

		await navigateToProject({ workspace, reportFault: vi.fn() }, RENOVATION_PROJECT_VIEW, 'project-1');

		expect(leaf.getViewState().state).toBeUndefined();
	});

	/** A door in this directory that REJECTS has no one to catch it. */
	it('reports a rejecting setViewState and still resolves', async () => {
		const workspace = new FakeWorkspace();
		const leaf = workspace.openLeafOfType(RENOVATION_PROJECT_VIEW);
		leaf.setViewState = () => Promise.reject(new Error('boom'));
		const reportFault = vi.fn();

		await expect(navigateToProject({ workspace, reportFault }, RENOVATION_PROJECT_VIEW, 'project-1')).resolves.toBeUndefined();
		expect(reportFault).toHaveBeenCalledTimes(1);
	});
});
```

`recordSetViewState` and `slowSetViewState` are local helpers in this file wrapping the leaf's
`setViewState`: the first appends every state actually written to an array, and the second
exposes `firstWriteStarted` (so the test can let call one get past the ticket check before call
two arrives) and `releaseFirst`. Write them beside the cases.

**Neither may await both navigations before releasing a held write** — that is a deadlock, not
a test, and it is the mistake the deleted `deferredSetViewState` case made: a navigation does
not resolve until its own write does.

**`navigationWrites` is module state, so reset it between cases** — either export a
test-only reset or `vi.resetModules()` in a `beforeEach`. A chain left holding a previous
case's rejected or pending promise makes the next case's result a fact about test order.
Whichever you choose, say so in the module's own comment: `activating` next door is module
state for the same reason and carries the same hazard.

- [ ] **Step 3: Write it**

```ts
import { revealView } from './revealView';
import type { RevealDeps } from './reveal';

/**
 * The latest navigation this module was asked for. Module-scoped beside the helper, for the
 * reason the coalescing map next door is: a subtlety re-remembered per caller is one that
 * eventually is not.
 */
let latestNavigation = 0;

/**
 * The writes themselves, in issue order.
 *
 * The ticket alone is not enough, and the spec's own version stopped one step short. It is
 * read once, before `setViewState`, so it can only drop a request that was superseded BEFORE
 * its write began — the same-tick case. A request that passed the check and is mid-write when
 * a later one arrives is not dropped and not ordered: both writes are in flight, and the
 * earlier one can settle LAST and restore the project the user has already navigated away
 * from. Reported by a review bot against this plan, and the window is real rather than
 * theoretical: `setViewState` on a live leaf runs the registered factory and the view's
 * `onOpen`, which mounts a Vue app and issues a query.
 *
 * Chaining makes "the latest request wins" true of the WRITES rather than of the intentions:
 * the earlier write completes first because it was queued first, and the later one lands on
 * top of it. The ticket check stays, INSIDE the chained step, because it is still what stops
 * a superseded request writing at all — a chain alone would remount to the first project and
 * then to the second, which is the flicker the ticket exists to avoid.
 */
let navigationWrites: Promise<void> = Promise.resolve();

/**
 * Reveal the singleton view, then navigate it to a project — design slice 21's two steps, in
 * the order they mean.
 *
 * **Why not one call.** `revealView` takes no `state`, and `revealCandidate` sets state only
 * on a leaf it CREATED (deliberately: setting it on an existing leaf "rebuilds a view the user
 * has already scrolled, filtered or panned"). The NORMAL case here is a leaf that is already
 * open, so a state passed through would have been ignored and the user left where they were.
 * And `requestKey` is the type plus the serialized state, which for a SINGLETON is the wrong
 * key — two invocations naming different projects produce two keys, neither joins the other,
 * an in-flight leaf does not answer `getLeavesOfType` yet, and both create one. The key
 * describes the REQUEST where the guard needs to describe the LEAF.
 *
 * **Uniqueness falls out**: `revealView`'s existing coalescing is keyed on the type alone,
 * because that call carries no state, so two invocations in one tick produce one leaf whether
 * they name the same project or different ones.
 *
 * **Ordering does NOT fall out**, and a sentence claiming it did was the spec's own repaired
 * finding: both calls await the SAME coalesced promise, resume in the same tick, and then
 * issue `setViewState` concurrently — the earlier one can settle last and win. The ticket is
 * what decides. Superseded calls DROP their write rather than queueing behind it, which is the
 * difference between a ticket and a chain and is the right one here: a user who picked twice
 * wants the second project, not a remount to the first followed by a remount to the second.
 *
 * It lives in `infrastructure/obsidian/workspace/` beside its siblings, because `plugin/`
 * composing the two steps for itself would be the second activation path decision 6 refuses —
 * and because `reportFault` is already a member of `RevealDeps`.
 */
export async function navigateToProject(
	deps: RevealDeps,
	type: string,
	projectId: string | null,
): Promise<void> {
	const ticket = ++latestNavigation;
	// Leaf existence and activation success are two facts, and only one of them was being
	// asked about: `revealCandidate` reports a failed reveal of an EXISTING leaf and RESOLVES,
	// leaving that leaf in `getLeavesOfType`.
	if (!(await revealView(deps, type))) return;

	navigationWrites = navigationWrites.then(async () => {
		// Read INSIDE the chain, not before it: a request superseded while it waited its turn
		// must not write at all, and by here the counter reflects everything that has arrived.
		if (ticket !== latestNavigation) return;
		const leaf = deps.workspace.getLeavesOfType(type)[0];
		// The case the boolean does not cover: a successful activation whose leaf has since
		// gone, and the create path having produced none.
		if (leaf === undefined) return;
		try {
			await leaf.setViewState({ type, active: true, state: { projectId: projectId ?? '' } });
		} catch (cause) {
			// This step sits OUTSIDE `revealView`'s boundary, whose contract is that it does
			// not reject — which is why its two detached callers hand it to `void` rather than
			// to `runDetached`. Without this catch the chain would reject, and every later
			// navigation queued behind it with it.
			deps.reportFault(cause);
		}
	});
	await navigationWrites;
}
```

- [ ] **Step 4: Run and watch them pass, then watch the ticket fail**

```bash
npx vitest run tests/infrastructure/obsidian/workspace/
```

Delete `if (ticket !== latestNavigation) return;` → the "ends on the later project" case goes
RED and every other case stays green. That contrast is the case's whole justification. Restore.

Then change `if (!(await revealView(deps, type))) return;` to `await revealView(deps, type);`
→ "navigates nothing when revealing an existing leaf faulted" goes RED. Restore.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Reveal the project view and navigate it, with a ticket deciding the order"
```

---

### Task 12: the `open-project-detail` command

**Read the *Deviation from the spec* section at the top of this plan before starting.** The id
the spec names is already taken by the command that reveals the pane, and taking it would
hijack a hotkey a user already has.

**Files:**
- Create: `src/presentation/modals/ProjectSuggestModal.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Create: `tests/presentation/modals/projectSuggestModal.test.ts`
- Modify: `tests/plugin/registration.test.ts`, `tests/plugin/settings/unrecovered.test.ts`

**New locale key:**

| key | en | de |
|---|---|---|
| `command.open-project-detail` | `Go to renovation project` | `Zu Renovierungsprojekt wechseln` |

- [ ] **Step 1: Write `ProjectSuggestModal`**

A near-copy of `PlanSuggestModal`, over `renovation-project` entries. Same three methods, same
reason for `getItemText` returning the PATH: an index entry is id, type and path, and reading
every project note to render a picker row would put a vault-wide read behind a palette
command. Its placeholder is `tr('command.open-project-detail')`.

Give it its own test mirroring whatever `tests/presentation/modals/` already does for
`PlanSuggestModal` — if that file does not exist, one case for `getItems` and one for
`onChooseItem` calling `choose`.

- [ ] **Step 2: Register the command**

In `RenovationPlannerPlugin.onload`, after the existing `open-project` command:

```ts
		/**
		 * Design slice 21: reveal the pane, then go INTO a project.
		 *
		 * A second command rather than behaviour behind the existing `open-project` id, and
		 * the spec's own argument for treating an id as data is the argument for it: a user
		 * whose hotkey means "show me the pane" must not suddenly get a fuzzy picker. The
		 * ribbon shares `open-project`'s copy, so repurposing it would also split the two ways
		 * in that the comment above insists call one function.
		 *
		 * **With no projects in the vault this reveals the LIST**, not a picker and not a
		 * notice — deliberately unlike `open-plan-editor`, which answers `notify(tr('plan.none'))`.
		 * The reason is a property of the surfaces: a Plan Editor with no plan draws nothing,
		 * so a notice is all that command can usefully do, while this view HAS a list state
		 * whose empty state carries a Create button — so revealing it puts the user one click
		 * from the thing they were trying to reach. A zero-row fuzzy picker would be the worst
		 * of the three. Stated here so that nobody later "fixes" the inconsistency by adding a
		 * `project.none` notice and quietly removing the better behaviour.
		 */
		this.addCommand({
			id: 'open-project-detail',
			name: tr('command.open-project-detail'),
			callback: () => {
				this.openProjectDetail();
			},
		});
```

and beside `openProject()`:

```ts
	/**
	 * Detached like every other Obsidian handler, and it spells no detachment itself:
	 * `navigateToProject` answers its own faults through `reportFault` and does not reject,
	 * which is `revealView`'s contract carried one step further.
	 */
	private openProjectDetail(): void {
		const projects = projectEntries(this.root.persistence?.index);
		const deps = {
			workspace: this.app.workspace,
			reportFault: (cause: unknown): void => {
				notifyFault(cause, this.root.logger, 'view.project.reveal-failed');
			},
		};
		if (projects.length === 0) {
			// The list, not a picker: see the command's own docblock.
			void navigateToProject(deps, RENOVATION_PROJECT_VIEW, null);
			return;
		}
		new ProjectSuggestModal(this.app, projects, (project) => {
			void navigateToProject(deps, RENOVATION_PROJECT_VIEW, project.id);
		}).open();
	}
```

`projectEntries` is `planEntries`'s sibling — a filter on `type === 'renovation-project'`.
`planEntries` currently lives in `planEditorCommands.ts`; write `projectEntries` beside
`openProjectDetail` rather than exporting the other one, or extract both into a shared module
if that reads better. Say which in the commit message.

`view.project.reveal-failed` is a new locale key if `notifyFault`'s event names resolve through
the tables — **check `notifyFault`'s signature before assuming**: it takes an event name for
the log line, and the user-facing sentence comes from the mapped `AppError`. If it needs no
key, add none.

- [ ] **Step 3: Extend the registration tests**

`tests/plugin/registration.test.ts` asserts the exact command id list; add
`'open-project-detail'` there and in `tests/plugin/settings/unrecovered.test.ts`. Both files
already spell the list, so this is a one-line edit in each — **and it is the check that the
new command is registered from `src/plugin/` at all**, which
`tests/build/registration-locality.test.ts` also enforces.

- [ ] **Step 4: Write the command's four behavioural cases**

In `tests/plugin/` (a new `openProjectDetail.test.ts`, or beside the existing plugin command
cases). Four properties, and each of the first three fails against the design the spec shipped
with:

```ts
it('navigates an already-open leaf to the chosen project', async () => { /* start FROM a leaf that exists; assert on THAT leaf's state, not on setViewState having been called — the create branch satisfies that too */ });
it('leaves exactly one leaf for two invocations naming different projects', async () => { /* … */ });
it('ends on the later of two invocations even when the first settles last', async () => { /* … */ });
it('reveals the list state rather than a picker in an empty vault', async () => { /* assert the leaf's state is { projectId: '' } and no modal was opened */ });
```

The first three are the same properties Task 11 pins on `navigateToProject`; here they are
asserted through the COMMAND, which is what says the command reaches that helper rather than
re-deciding for itself. If that reads as duplication, keep the empty-vault case and the
already-open-leaf case here and let Task 11 own the other two — but say so in the commit
message rather than dropping them silently.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Add a palette command that goes to a project"
```

---

### Task 13: the documents whose stated triggers this slice fires

**A comment stating a trigger that has fired is worse than no comment** — it reads as settled.
Four of them fire here, and this repository has already paid for a deferral written into a
comment that nothing scheduled.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `src/plugin/sampleProject.ts`
- Modify: `src/presentation/emptyStates/content.ts` (if Task 10 did not already)
- Modify: `docs/tasks/21-the-project-detail-state.md` (tick or WITHDRAW each criterion)
- Create: `docs/tests/cases/Navigate into a project and back.md`

- [ ] **Step 1: `sampleProject.ts`'s docblock**

It currently says the plan half "is what this module is still the only source of", on the
stated grounds that "there is no project-detail surface a 'new plan' action could live on".
Both stop being true. Replace with the honest, smaller reason its docblock already leads with:
it is the vault-side equivalent of `npm run harness`, one gesture that produces something
worth LOOKING AT, and a scene assembled by hand is six gestures a reviewer will skip. A
convenience, no longer a sole source. **Trigger: it stops being used** — nobody reaches for it
when opening a vault to look at the canvas.

Do NOT retire the command. And do not repeat the claim the spec measured false: it seeds
neither an asset nor a requirement — exactly three commands, one project, one plan and the
five entries in `SAMPLE_ZONES`.

- [ ] **Step 2: `CLAUDE.md`, three edits**

Two paragraphs stop being true and one section gains an entry. Counted by reading the file,
not estimated:

1. The `create-sample-project` paragraph — same correction as Step 1, plus dropping "The PLAN
   half is what this module is still the only source of".
2. The two-surfaces paragraph — it says the Renovation project view "now draws **a project
   list**" and stops there. It gains the detail state, the view state that carries which
   project is open, and the fact that navigation goes through `leaf.setViewState` and buys the
   pane's back arrow.
3. *Deliberately absent* gains **vue-router**, with decision 4's trigger stated exactly: **a
   third level of nesting AND a genuine need for a history independent of Obsidian's.** PRD
   Epic 4's whole navigation set fits in `{ projectId, section }`, so *"Epic 4 arrives"* is
   explicitly NOT the trigger.

Add a slice 21 section in the house style — what landed, and the rules that came out of it.
Candidates, all of them measured during this plan rather than invented:

- **A spec can name an identifier that is already taken, and the collision is invisible until
  somebody greps.** `open-project` was registered, locale-keyed and asserted in two test files
  before this slice proposed it for different behaviour.
- **`''` as a DESTINATION is the one place this view must not copy `PlanEditorView`** — and
  the failure is total rather than cosmetic: `getState` records `{ projectId: '' }` for the
  list, so pressing back restores exactly the value a `planIdFrom`-shaped validator discards,
  and the pane never leaves the detail state.
- **A `mounted` flag beside `mountedProjectId`**, because `null` is a state here and not an
  absence — a bare identity guard skips the first open and the pane draws nothing.
- **The question is whether the scan RAN, not whether it found anything.** "Populated at least
  once" hangs a restored pane forever in a vault whose last project note was deleted while
  Obsidian was closed.
- **A remount makes staleness unrepresentable**, and the alternative — a reactive ref in the
  context — would be the first reactive member any view context here carries.
- Whatever the implementation actually finds. **Write these from what happened, not from this
  list**; a plan predicting a lesson is not the same as a slice learning one.

- [ ] **Step 3: The manual case**

Create `docs/tests/cases/Navigate into a project and back.md`, modelled on
`docs/tests/cases/Create a Project.md`. It carries the three things NO gate here can check:

1. **The pane's back arrow returns to the list, and forward returns to the project.**
   `FakeLeaf` records asks rather than behaving and jsdom models no workspace, so the suite
   can assert only that `history: true` was set. Whether Obsidian honours it is this step.
2. **The detail state FILLS its leaf.** A collapsed pane is what a stray wrapper in the height
   chain produces; jsdom lays nothing out, and it is what the harness caught the first time in
   slice 1. Check at a narrow sidebar width too.
3. **Closing and reopening Obsidian reopens the project that was open** — including when the
   pane is restored before the index scan runs, which is the ordering Obsidian actually uses.

- [ ] **Step 4: Capture it**

The harness index discovers entries from `src/presentation/**/*.vue`, so `ProjectDetail.vue`
and `PlanList.vue` are registered with no step to remember. Capture and LOOK:

```bash
npm run harness-shot component:views/ProjectDetail
npm run harness-shot component:views/ProjectDetail -- --width=460
```

`--width=460` is the width an Obsidian sidebar leaf actually has and has already hidden a
layout defect the default 1280 could not show. If the pinned Chromium is absent, the script
says so and names `RP_CHROMIUM_EXECUTABLE` — a named substitute prints that it is not the
pinned build, so the caveat travels with the picture. **Do not skip this step silently**: a
capture check that goes un-run gets disclosed as outstanding, which is what happened on the
canvas-navigation branch.

Look for: the header not wrapping badly at 460, the plan rows at least 24px tall, the status
readable in both schemes, and the whole thing filling its pane.

- [ ] **Step 5: Reconcile the slice document**

Walk `docs/tasks/21-the-project-detail-state.md`'s 14 acceptance criteria one at a time and
tick each — or **WITHDRAW** it in writing, the way slice 16's Definition of Done item 2 was
withdrawn rather than ticked over a gap. Criterion 13 is walked in the manual case rather than
ticked by a gate, and criterion 14 is `npm run check`.

- [ ] **Step 6: Final gate, alone, and commit**

```bash
npm run check
npm run test:coverage   # alone, on a quiet machine — a timing-out file suppresses the report
```

Read the four figures against the floors in `vitest.config.ts` and ratchet them only to what
this FINISHED increment measures, rounded down. If branches came out below 98, the gate has
already told you; the fix is a test for the arm that has none, not a lowered floor.

```bash
git add -A
git commit -m "Record what slice 21 changed, and walk what no gate can see"
git push -u origin claude/slices-17-19-in-flight-bsrfa8
```

---

## Self-review, run against the spec after writing this plan

**Spec coverage.** Decision 1 → Tasks 6 and 9. Decision 2 → Task 6 (`projectIdFrom`'s
three-way parse, `getState`). Decision 3 → Task 6 (`result.history`) and Task 5 (`navigate`).
Decision 4 → Task 13 Step 2 (vue-router in *Deliberately absent*, with its trigger). Decision 5
→ Task 7 (the Open note action) and Task 9 (its handler). Decision 6 → Tasks 11 and 12, **with
the identifier collision resolved at the top of this plan**. Architecture (`sync`, the remount,
the no-wrapper mount) → Task 6. Components table → Tasks 1, 2, 4, 7, 8, 11, 12. Reads →
Tasks 1, 3, 4. Error handling → Task 4 (the four rows, the scan gate, the re-hydration guard)
and Tasks 8–9 (`plan.project-not-found`). The UI-string table → Tasks 7, 8, 10, 12. Testing →
every task's own steps, plus Task 10's axe cases.

**Known gaps, stated rather than left to be discovered.**

- **`ViewRoot.vue`'s line budget.** Task 9 adds a second branch to a file that is already
  substantial. The extraction (`ProjectDetailState.vue`) is named in that task rather than
  planned, because whether it is needed depends on how the branch actually lands. It is a
  decision the executor makes with `wc -l` in hand, not one this plan can make blind.
- **Task 5 Step 3's deps-factory shape.** Handing the view a `(projectId) => deps` factory
  rather than a bundle is the cleanest way to keep `projectId` the view's own field while the
  bundle stays composed in `plugin/`, but it changes `registerView` and `rebindOpenViews`.
  The alternative is named there. This is the one structural choice the plan leaves open, and
  it asks for the answer in a commit message rather than pretending there is only one.
- **`FormDialog`'s prop forwarding for `onProjectGone`** (Task 9 Step 3) was not verified
  against that component; the task says to check it and to fix the framework in the same edit
  if it does not forward `on*` props.
- **Coverage headroom is unmeasured on the tree this lands on** — deliberately, per the spec's
  own instruction. Every task pairs its new arms with tests, which is the only defence a
  handful of branches allows.
