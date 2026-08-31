# One bad note costs one note — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A note this build cannot read costs the user that note and nothing more — on the Plan Editor canvas and the project detail state, both of which today lose everything to one bad note — and the diagnostics report their fallback has always named finally has a door.

**Architecture:** Two repository listings stop answering the first read failure they meet and instead skip-and-count into a `{ loaded, refused }` object, following `ProjectListing`'s existing shape exactly. The count travels to two surfaces as a counted warning strip. **The policy lives in the consumer, not in the listing**: two queries carry the count, and the delete flow's reassignment picker refuses explicitly instead, because an incomplete picker before a delete is a destructive silence. A plain-DOM Obsidian `Modal` renders the already-composed `GetDiagnosticsSnapshotQuery`.

**Tech Stack:** TypeScript, Vue 3 + Pinia (presentation), Obsidian plugin API, Vitest + jsdom, ESLint + oxlint, fallow.

**Spec:** [`docs/superpowers/specs/2026-08-31-one-bad-note-costs-one-note-design.md`](../specs/2026-08-31-one-bad-note-costs-one-note-design.md)

## Global Constraints

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests + fallow. All four, before every commit. CI runs the same command verbatim across four legs.
- **Layer rule**, enforced by `no-restricted-imports` per directory: `presentation → application → domain → core`, `infrastructure → application → domain → core`, and `plugin/` composes all of them. `application/` may not name `infrastructure/`, `vue`, `pinia`, `konva` or `obsidian`.
- **Every user-facing string goes through `t()`/`tr()`**, never a literal. `I18N_LITERAL_BAN` fires at six call sites including `createEl`'s `text:` option and `.setText(...)`. Sentence-case UI text (marketplace rule; `obsidianmd/ui/sentence-case-locale-module` fails the build on a capitalised word mid-sentence).
- **Every key added to `en.ts` must also be added to `de.ts`.** `tests/presentation/i18n/strings.test.ts` asserts `de` translates every key `en` declares, and asserts that any key's German translation names the same interpolation holes as its English one.
- **A new `AppError` code with no locale entry does not degrade to silence — it degrades to the WRONG sentence.** Every code raised in this plan gets copy in both locales, bound to its raise site.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches). Branches read 98.05% at slice 19's close — roughly one covered branch of headroom. Write each arm's test with the arm. After each task read `coverage-final.json` for the CHANGED FILES; the summary line cannot see a single arm.
- **Every regression test is watched failing before the fix**, and the mutation that reddens it is named in the task.
- **`tests/**` is type-checked by `npm run build`** — no `as never`, no local `ResultLike` shims.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `src/plugin/diagnostics/DiagnosticsReportModal.ts` | Plain-DOM Obsidian `Modal` rendering a `DiagnosticsSnapshot`; owns the copy action |
| `src/plugin/diagnostics/showDiagnosticsReport.ts` | The ONE function both doors call (one-action-every-input) |
| `tests/plugin/diagnostics/diagnosticsReportModal.test.ts` | Rendering, the path join, and the copy payload |
| `tests/plugin/diagnostics/diagnosticsReportDoors.test.ts` | Both registrations reach one function |
| `docs/tests/cases/A note that cannot be read.md` | The only instrument for what the strips and the report look like |

**Modified**

| File | Change |
| --- | --- |
| `src/application/errors.ts` | Gains `persistenceError` — one definition, two importers |
| `src/infrastructure/obsidian/repositories/noteIo.ts` | Re-exports that factory instead of declaring a second |
| `src/application/ports/ZoneRepository.ts` | `ZoneListing`; both list methods answer it |
| `src/application/ports/PlanRepository.ts` | `PlanListing`; `listByProject` answers it |
| `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts` | `list` skips and counts; stale `findByProject` docblock clause deleted |
| `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts` | `listByProject` skips and counts |
| `src/infrastructure/persistence/in-memory/InMemoryZoneRepository.ts` | `refused: 0` |
| `src/infrastructure/persistence/in-memory/InMemoryPlanRepository.ts` | `refused: 0` |
| `src/application/queries/FindZonesByPlan.ts` | Carries the count |
| `src/application/queries/ListPlansByProject.ts` | Carries the count |
| `src/application/queries/ListReassignmentTargets.ts` | Refuses explicitly on `refused > 0` |
| `src/presentation/read-models/planEditorQueries.ts` | `findZonesByPlan` answers `{ zones, unreadable }` |
| `src/presentation/read-models/renovationProjectQueries.ts` | `listPlansByProject` answers `{ plans, unreadable }` |
| `src/presentation/stores/ProjectStore.ts` | `unreadableZones` |
| `src/presentation/stores/ProjectDetailStore.ts` | `unreadablePlans` |
| `src/presentation/editor/PlanEditorRoot.vue` | The canvas strip, as its own `v-if` |
| `src/presentation/views/ProjectDetail.vue`, `PlanList.vue`, `ProjectDetailState.vue` | The detail strip and its prop |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | Six keys |
| `src/plugin/RenovationPlannerPlugin.ts` | `show-diagnostics-report` command |
| `src/plugin/settings/SettingsTab.ts` | The report ACTION row |
| `src/plugin/guardedServices.ts` / `composition-root.ts` | Hand the report its snapshot query and path resolver |

**Naming convention this plan follows, and it is deliberate:** the PORT says `{ loaded, refused }` and the PRESENTATION seam says `{ …, unreadable }`. `ListProjects`' docblock states why — *"the port speaks of notes it declined to load, and the view speaks of projects the user cannot see. Same number, and the rename is deliberate."* Do not collapse them.

---

### Task 1: `persistenceError` gets one home

Task 3 needs to raise a `PersistenceError` from `application/`, and today the only factory lives in `infrastructure/obsidian/repositories/noteIo.ts:28` — which `application/` may not import. Adding a second factory would be the second derivation this codebase keeps deleting, so the definition moves and infrastructure imports it.

**Files:**
- Modify: `src/application/errors.ts`
- Modify: `src/infrastructure/obsidian/repositories/noteIo.ts:28-30`
- Test: `tests/application/errors.test.ts`

**Interfaces:**
- Consumes: `PersistenceError` from `src/core/errors/AppError`
- Produces: `persistenceError(code: string, message: string, cause?: unknown): PersistenceError`, exported from `src/application/errors.ts` **and** re-exported from `noteIo.ts` so its ~40 existing importers are untouched.

- [ ] **Step 1: Write the failing test**

Append to `tests/application/errors.test.ts` (create the file if absent, matching the sibling tests' import style):

```ts
import { describe, expect, it } from 'vitest';
import { persistenceError } from '../../src/application/errors';
import { persistenceError as fromNoteIo } from '../../src/infrastructure/obsidian/repositories/noteIo';

describe('persistenceError', () => {
	it('is one definition with two importers', () => {
		expect(fromNoteIo).toBe(persistenceError);
	});

	it('omits `cause` entirely when none is given', () => {
		expect('cause' in persistenceError('zone.listing-incomplete', 'x')).toBe(false);
	});

	it('carries a cause when one is given', () => {
		const boom = new Error('boom');
		expect(persistenceError('zone.listing-incomplete', 'x', boom).cause).toBe(boom);
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/application/errors.test.ts`
Expected: FAIL — `persistenceError` is not exported from `src/application/errors`.

- [ ] **Step 3: Move the definition**

In `src/application/errors.ts`, add the import and the factory:

```ts
import type { CalculationError, PersistenceError, ReferenceError } from '../core/errors/AppError';

/**
 * The vault-side failure factory. It lives HERE rather than beside the note reader that
 * used to own it because `application/` may not import `infrastructure/`, and since the
 * listings skip-and-count a QUERY is now a raise site: `ListReassignmentTargets` refuses
 * when the zones it must offer are incomplete. One definition with two importers cannot
 * drift; two factories for one shape is the second derivation this project keeps deleting.
 *
 * `cause` is spread rather than assigned so an absent one leaves no key at all — a
 * `cause: undefined` reads as "there was a cause and it was nothing".
 */
export function persistenceError(code: string, message: string, cause?: unknown): PersistenceError {
	return { category: 'Persistence', code, message, ...(cause === undefined ? {} : { cause }) };
}
```

In `src/infrastructure/obsidian/repositories/noteIo.ts`, delete the local declaration at lines 28-30 and replace it with a re-export, keeping its existing docblock above:

```ts
export { persistenceError } from '../../../application/errors';
```

- [ ] **Step 4: Run the test and the suites that lean on it**

Run: `npx vitest run tests/application/errors.test.ts tests/infrastructure`
Expected: PASS. Every existing importer of `noteIo`'s `persistenceError` still resolves.

- [ ] **Step 5: Full gate, then commit**

```bash
npm run check
git add src/application/errors.ts src/infrastructure/obsidian/repositories/noteIo.ts tests/application/errors.test.ts
git commit -m "refactor: give persistenceError one home so a query can raise one

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The zone listing skips and counts

The largest task, and it cannot be split: widening a port type breaks every implementer and consumer at once, so the tree only compiles again when all of them move together.

**Files:**
- Modify: `src/application/ports/ZoneRepository.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianZoneRepository.ts:345-371`
- Modify: `src/infrastructure/persistence/in-memory/InMemoryZoneRepository.ts:43-53`
- Modify: `src/application/queries/FindZonesByPlan.ts`
- Modify: `src/application/queries/ListReassignmentTargets.ts:54-60`
- Modify: `src/presentation/read-models/planEditorQueries.ts:39,144-148`
- Test: `tests/infrastructure/obsidian/repositories/zoneListingSkips.test.ts` (new)
- Test: `tests/application/queries/listReassignmentTargets.test.ts` (existing — add the refusal case beside it)

**Interfaces:**
- Consumes: `persistenceError` from Task 1.
- Produces:
  - `ZoneListing { readonly loaded: readonly Loaded<Zone>[]; readonly refused: number }` from `src/application/ports/ZoneRepository.ts`
  - `ZoneRepository.listByPlan(planId): Promise<Result<ZoneListing, RepositoryError>>` and `listByProject(projectId)` likewise
  - `FindZonesByPlan.execute({ planId }): Promise<Result<ZoneListing, RepositoryError>>`
  - `PlanEditorQueryServices.findZonesByPlan(planId: string): Promise<Result<ZoneScene, RepositoryError>>` where `ZoneScene { readonly zones: readonly ZoneDto[]; readonly unreadable: number }`
  - error code `zone.listing-incomplete`

- [ ] **Step 1: Write the failing repository test**

Create `tests/infrastructure/obsidian/repositories/zoneListingSkips.test.ts`. It must use the **disk-backed** fixture vault: a stubbed repository cannot fail to parse a note, so it proves nothing about a listing that skips parse failures.

```ts
import { describe, expect, it } from 'vitest';
import { openFixtureVault } from '../../../helpers/fixtureVault';

describe('the zone listing skips a note it cannot read', () => {
	it('answers the readable zones and counts the refusal', async () => {
		const stack = await openFixtureVault();
		const { planId } = await stack.seedPlanWithZones(2);
		await stack.corruptZoneNote(0); // writes a `schema-version` this build predates

		const listed = await stack.zones.listByPlan(planId);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
	});

	it('records the refusal in the diagnostics ledger, so skipping loses nothing', async () => {
		const stack = await openFixtureVault();
		const { planId } = await stack.seedPlanWithZones(2);
		await stack.corruptZoneNote(0);

		await stack.zones.listByPlan(planId);

		expect(stack.ledger.issues()).toHaveLength(1);
	});

	it('counts a refusal reached through listByProject too', async () => {
		const stack = await openFixtureVault();
		const { projectId } = await stack.seedPlanWithZones(2);
		await stack.corruptZoneNote(0);

		const listed = await stack.zones.listByProject(projectId);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
	});
});
```

**Before writing the bodies, read `tests/helpers/fixtureVault.ts`.** `seedPlanWithZones` and `corruptZoneNote` are named here for the test's intent; if that helper spells them differently, use its spelling — do not add a second seeding helper beside an existing one. If neither exists, add them **to `fixtureVault.ts`**, not to this test file: a second stack builder is the drift `repositoryStack.ts` exists to prevent.

- [ ] **Step 2: Run it and watch it fail at the assertion**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/zoneListingSkips.test.ts`
Expected: FAIL — the listing answers `err`, so `listed.ok` is `false`. A red at `Unable to get` or a helper `TypeError` proves nothing; it must fail at the `expect`.

- [ ] **Step 3: Widen the port**

In `src/application/ports/ZoneRepository.ts`, add above the interface:

```ts
/**
 * What a zone listing answers: the zones that LOADED, and how many notes refused to.
 *
 * The same shape as `ProjectListing`, for the same reason and deliberately not a second
 * one — SDD §92 item 13 asks that a refusal be scoped to THIS note, and a listing that
 * answers the first failure it meets scopes it to the whole plan instead. On this surface
 * that cost everything: one unparseable zone note and the Plan Editor drew NO zones at all.
 *
 * A COUNT and deliberately not a list of ids: `getById` already records which note refused
 * into the diagnostics ledger, and a second copy here would be a second answer to one
 * question.
 *
 * **`refused` does not decide anything by itself.** Skip-and-count is a READING policy and
 * not a property of this listing: the canvas carries the count into a warning strip, while
 * `ListReassignmentTargets` refuses outright, because an incomplete picker offered before a
 * delete is a destructive silence rather than a recoverable one. Each consumer decides; this
 * type only makes both answerable.
 */
export interface ZoneListing {
	readonly loaded: readonly Loaded<Zone>[];
	readonly refused: number;
}
```

and change the two members:

```ts
	listByProject(projectId: ProjectId): Promise<Result<ZoneListing, RepositoryError>>;
	listByPlan(planId: PlanId): Promise<Result<ZoneListing, RepositoryError>>;
```

- [ ] **Step 4: Make the Obsidian repository skip**

In `ObsidianZoneRepository.ts`, replace the body of `private async list` (currently at 356-371) with:

```ts
	private async list(ids: readonly ZoneId[]): Promise<Result<ZoneListing, RepositoryError>> {
		const sidecars = new Map<PlanId, ReturnType<SidecarReader>>();
		const readOnce: SidecarReader = (planId) => {
			const pending = sidecars.get(planId) ?? this.geometry.read(planId);
			sidecars.set(planId, pending);
			return pending;
		};

		const loaded: Loaded<Zone>[] = [];
		let refused = 0;
		for (const id of ids) {
			const one = await this.loadOne(id, readOnce);
			if (!one.ok) {
				// Skipped rather than fatal: `loadOne` reaches `getById`, which has already
				// recorded this refusal into the diagnostics ledger, so the detail survives
				// and the user keeps every zone that DID load.
				refused += 1;
				continue;
			}
			if (one.value) loaded.push(one.value);
		}
		return ok({ loaded, refused });
	}
```

Import `ZoneListing` from the port.

**In the same edit, delete the stale clause in the docblock above `list` (line ~354).** It reads *"…and `findByProject` hands it zones from several"*; `grep -rn "findByProject" src/` returns that comment and nothing else — the method does not exist. Rewrite the sentence as: *"Keyed by plan, not fixed to one, because `list` takes ids rather than a plan and `listByProject` hands it zones from several."*

- [ ] **Step 5: Make the in-memory repository answer the same shape**

In `InMemoryZoneRepository.ts`:

```ts
	listByPlan(planId: PlanId): Promise<Result<ZoneListing, PersistenceError>> {
		return Promise.resolve(
			ok({ loaded: this.store.values().filter((z) => z.entity.planId === planId), refused: 0 }),
		);
	}

	listByProject(projectId: ProjectId): Promise<Result<ZoneListing, PersistenceError>> {
		return Promise.resolve(
			ok({ loaded: this.store.values().filter((z) => z.entity.projectId === projectId), refused: 0 }),
		);
	}
```

Add the docblock the sibling in-memory project repository already carries, in one sentence: *"`refused` is 0 by construction — this store holds entities, not text, so there is no parse step to refuse at. The non-zero arm belongs to the Obsidian implementation."*

- [ ] **Step 6: Run the repository test and watch it pass**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/zoneListingSkips.test.ts`
Expected: PASS, all three.

- [ ] **Step 7: Carry the count through `FindZonesByPlan`**

In `src/application/queries/FindZonesByPlan.ts`, change the class's type parameter and return type to `Result<ZoneListing, RepositoryError>` and import `ZoneListing` from `../ports/ZoneRepository`. The body still `return this.zones.listByPlan(planId);` — it adds nothing, which its docblock already says. Update that docblock's last sentence to name the listing rather than an array.

- [ ] **Step 8: Write the failing picker-refusal test**

The picker can no longer keep failing fast by propagation — the repository does not fail any more — so it must refuse explicitly. Add to `tests/application/queries/listReassignmentTargets.test.ts`, **directly beside the zone cases**, under this header comment:

```ts
// These two disagree with the canvas ON PURPOSE, and they sit together so that neither
// reads as an oversight. The canvas draws nineteen zones instead of twenty and says so —
// recoverable. This picker offers the zones a Requirement may be reassigned to BEFORE a
// zone is deleted, so an incomplete list, silently, is how a user reassigns to the wrong
// zone and then deletes. Skip-and-count is a reading policy; this reader refuses.
describe('an incomplete zone listing', () => {
	it('refuses rather than offering a partial set of targets', async () => {
		const { query, zones } = harnessWithZones(3);
		zones.refuseOne();

		const listed = await query.execute({ zoneId: 'zone-1', assetId: 'asset-1' });

		expect(listed.ok).toBe(false);
		if (listed.ok) return;
		expect(listed.error.code).toBe('zone.listing-incomplete');
		expect(listed.error.category).toBe('Persistence');
	});

	it('offers every target when nothing refused', async () => {
		const { query } = harnessWithZones(3);

		const listed = await query.execute({ zoneId: 'zone-1', assetId: 'asset-1' });

		expect(listed.ok).toBe(true);
	});
});
```

Read the existing file first and reuse its own fixture builder and input shape rather than introducing `harnessWithZones` if something equivalent is already there.

- [ ] **Step 9: Run it and watch it fail**

Run: `npx vitest run tests/application/queries/listReassignmentTargets.test.ts`
Expected: FAIL — the query currently answers `ok` with a short list.

- [ ] **Step 10: Make the picker refuse**

In `ListReassignmentTargets.ts`, replace the zone branch (lines ~54-60):

```ts
		const all = await this.zones.listByProject(projectId);
		if (isErr(all)) return all;
		if (all.value.refused > 0) {
			// The one consumer that must NOT carry the count. This list is offered before a
			// delete, so an incomplete one is how a user reassigns to the wrong zone and then
			// destroys the right one. A refusal is recoverable by asking again; a silently
			// short picker is not recoverable at all.
			return err(
				persistenceError(
					'zone.listing-incomplete',
					`${String(all.value.refused)} zone note(s) in this project could not be read, so the set of reassignment targets is incomplete`,
				),
			);
		}
		return ok(
			all.value.loaded
				.filter((z) => z.entity.id !== target.zoneId)
				.map((z) => ({ id: z.entity.id, label: z.entity.name })),
		);
```

Import `err` from `../../core/result/Result` and `persistenceError` from `../errors`. The message is developer English for a log line — `AppError.message` is never user copy; the user's sentence comes from Task 4's locale key via `toUserMessage`.

- [ ] **Step 11: Give the code its copy in both locales**

`src/presentation/i18n/locales/en.ts`:

```ts
	'error.zone.listing-incomplete': 'Some zones in this project could not be read, so the list of places to move this to is incomplete. Open the diagnostics report to see which notes refused.',
```

`src/presentation/i18n/locales/de.ts`:

```ts
	'error.zone.listing-incomplete': 'Einige Bereiche in diesem Projekt konnten nicht gelesen werden, daher ist die Liste möglicher Ziele unvollständig. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
```

**Read `toUserMessage.ts` first** to confirm the `error.`-prefixed key convention for a code, and add the binding row to `tests/presentation/i18n/toUserMessage.test.ts` **copied from the raise site**, not from `en.ts` — a table derived from the locale file would agree with a typo.

This sentence names the diagnostics report, which is why Tasks 6 and 7 are in the same increment. If those tasks are dropped, this sentence must lose its second clause.

- [ ] **Step 12: Update the presentation seam**

In `planEditorQueries.ts`, add beside the other read-model types:

```ts
/**
 * The canvas's own shape of a zone listing: the zones it can draw, and how many it cannot.
 * `unreadable` is the view-side name for the port's `refused` — same number, and the rename
 * across this seam is the one `ProjectListView` already makes.
 */
export interface ZoneScene {
	readonly zones: readonly ZoneDto[];
	readonly unreadable: number;
}
```

Change the interface member at line 39 to `findZonesByPlan(planId: string): Promise<Result<ZoneScene, RepositoryError>>`, the injected query type at line 130 to `Query<FindZonesByPlanInput, Result<ZoneListing, RepositoryError>>`, and the mapping at 144-148:

```ts
		async findZonesByPlan(planId) {
			const found = await queries.findZonesByPlan.execute({ planId: planId as PlanId });
			if (isErr(found)) return found;
			return ok({
				zones: found.value.loaded.map((loaded) => toZoneDto(loaded.entity)),
				unreadable: found.value.refused,
			});
		},
```

`refuseUnrecovered` at line 105 needs no change — it refuses before producing a value.

- [ ] **Step 13: Fix `ProjectStore`'s read so the tree compiles**

In `ProjectStore.ts:148-161`, `foundZones.value` is now a `ZoneScene`. Change the assignment at line 159 to `zones.value = new Map(foundZones.value.zones.map((zone) => [zone.id, zone]));`. **Do not add the `unreadableZones` field yet** — that is Task 4, which owns its test.

- [ ] **Step 14: Run the whole suite**

Run: `npm run check`
Expected: green. Fix every compile error the widening surfaced; each is a real consumer, not noise.

- [ ] **Step 15: Verify the mutation and the coverage**

Restore `if (!one.ok) return one;` in `ObsidianZoneRepository.list` and run `npx vitest run tests/infrastructure/obsidian/repositories/zoneListingSkips.test.ts` — expect red at the assertions. Restore the fix. Then:

```bash
npm run test:coverage
node -e "const c=require('./coverage/coverage-final.json');for(const [k,v] of Object.entries(c)){if(/ObsidianZoneRepository|ListReassignmentTargets|FindZonesByPlan/.test(k)){const b=Object.values(v.b).flat();console.log(k, 'uncovered branches:', b.filter(n=>n===0).length)}}"
```

Expected: 0 uncovered branches in the changed files. Any non-zero is an arm this task added without a test.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "fix: one unreadable zone note costs that zone, not every zone

ObsidianZoneRepository.list answered the first read failure it met, so a
single unparseable zone note failed the whole listing and the Plan Editor
drew no zones at all. It skips and counts now, following ProjectListing.

The count is not a decision. FindZonesByPlan carries it to the canvas;
ListReassignmentTargets refuses on it, because that picker is offered
before a delete and a silently short list is how a user reassigns to the
wrong zone and then destroys the right one.

Also deletes a docblock clause naming a findByProject that exists nowhere
in src/ -- the source of the Issue's claim that this listing had three
entry points, where grep finds two.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The plan listing skips and counts

The same change on the surface design slice 21 shipped: one unparseable plan note makes the project detail state draw its failure screen instead of the plans it can read.

**Files:**
- Modify: `src/application/ports/PlanRepository.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianPlanRepository.ts:279-…`
- Modify: `src/infrastructure/persistence/in-memory/InMemoryPlanRepository.ts:42-46`
- Modify: `src/application/queries/ListPlansByProject.ts:42-46`
- Modify: `src/presentation/read-models/renovationProjectQueries.ts:41,99`
- Modify: `src/presentation/stores/ProjectDetailStore.ts:110-118`
- Test: `tests/infrastructure/obsidian/repositories/planListingSkips.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Tasks 1-2 beyond the established `{ loaded, refused }` / `{ …, unreadable }` convention.
- Produces:
  - `PlanListing { readonly loaded: readonly Loaded<Plan>[]; readonly refused: number }`
  - `PlanRepository.listByProject(projectId): Promise<Result<PlanListing, RepositoryError>>`
  - `ListPlansByProject.execute({ projectId }): Promise<Result<PlanListResult, RepositoryError>>` where `PlanListResult { readonly plans: readonly Plan[]; readonly unreadable: number }`
  - `RenovationProjectQueryServices.listPlansByProject(projectId: string): Promise<Result<PlanListView, RepositoryError>>` where `PlanListView { readonly plans: readonly PlanSummaryDto[]; readonly unreadable: number }`

- [ ] **Step 1: Write the failing test**

Create `tests/infrastructure/obsidian/repositories/planListingSkips.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openFixtureVault } from '../../../helpers/fixtureVault';

describe('the plan listing skips a note it cannot read', () => {
	it('answers the readable plans and counts the refusal', async () => {
		const stack = await openFixtureVault();
		const { projectId } = await stack.seedProjectWithPlans(2);
		await stack.corruptPlanNote(0);

		const listed = await stack.plans.listByProject(projectId);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
	});
});
```

Same instruction as Task 2 Step 1: read `fixtureVault.ts` and use its own seeding helpers, extending that file rather than this one if they are missing.

- [ ] **Step 2: Run it and watch it fail at the assertion**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/planListingSkips.test.ts`
Expected: FAIL — `listed.ok` is `false`.

- [ ] **Step 3: Widen the port**

In `src/application/ports/PlanRepository.ts`:

```ts
/**
 * What a plan listing answers: the plans that LOADED, and how many notes refused to.
 * `ZoneListing`'s twin, for the reason stated there — this one lands on design slice 21's
 * project detail state, which drew its failure screen for one bad note.
 */
export interface PlanListing {
	readonly loaded: readonly Loaded<Plan>[];
	readonly refused: number;
}
```

and `listByProject(projectId: ProjectId): Promise<Result<PlanListing, RepositoryError>>;`

- [ ] **Step 4: Make both implementations answer it**

In `ObsidianPlanRepository.listByProject`, keep the existing `getIdsByType` narrowing and its docblock untouched, and change the loop to accumulate `refused` and `continue` exactly as `ObsidianProjectRepository.listAll:212-224` does, returning `ok({ loaded, refused })`.

In `InMemoryPlanRepository.ts`:

```ts
	listByProject(projectId: ProjectId): Promise<Result<PlanListing, PersistenceError>> {
		return Promise.resolve(
			ok({ loaded: this.store.values().filter((p) => p.entity.projectId === projectId), refused: 0 }),
		);
	}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/infrastructure/obsidian/repositories/planListingSkips.test.ts`
Expected: PASS.

- [ ] **Step 6: Carry the count through the query and the seam**

`ListPlansByProject.ts`:

```ts
/**
 * The plans of one project, and how many of its plan notes could not be read.
 * `unreadable` is the query-side name for the port's `refused`, the rename
 * `ProjectListResult` already makes across this same boundary.
 */
export interface PlanListResult {
	readonly plans: readonly Plan[];
	readonly unreadable: number;
}
```

```ts
	async execute({ projectId }: ListPlansByProjectInput): Promise<Result<PlanListResult, RepositoryError>> {
		const listed = await this.plans.listByProject(projectId);
		if (isErr(listed)) return listed;
		return ok({
			plans: listed.value.loaded.map((loaded) => loaded.entity),
			unreadable: listed.value.refused,
		});
	}
```

In `renovationProjectQueries.ts`, add beside `ProjectListView`:

```ts
/**
 * The detail state's own shape of a plan listing: summaries it can render, and how many
 * plans it cannot show.
 */
export interface PlanListView {
	readonly plans: readonly PlanSummaryDto[];
	readonly unreadable: number;
}
```

Change the member at line 41 to `listPlansByProject(projectId: string): Promise<Result<PlanListView, RepositoryError>>;`, the injected query type at line 99 to `Query<ListPlansByProjectInput, Result<PlanListResult, RepositoryError>>`, and map `plans: found.value.plans.map(toPlanSummaryDto)` beside `unreadable: found.value.unreadable` in the same shape the `listProjects` mapping above it uses.

- [ ] **Step 7: Fix `ProjectDetailStore`'s read so the tree compiles**

At line 118, `plans.value = listed.value.plans;`. **Do not add `unreadablePlans` yet** — Task 5 owns it with its test.

- [ ] **Step 8: Gate, mutate, cover, commit**

```bash
npm run check
```

Then restore `if (!one.ok) return one;` in `ObsidianPlanRepository.listByProject`, confirm `planListingSkips.test.ts` goes red at its assertion, restore, and read `coverage-final.json` for the three changed source files as in Task 2 Step 15.

```bash
git add -A
git commit -m "fix: one unreadable plan note costs that plan, not the project's whole list

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The canvas says how many zones it could not draw

**Files:**
- Modify: `src/presentation/stores/ProjectStore.ts:32-55,148-165`
- Modify: `src/presentation/editor/PlanEditorRoot.vue:234-248`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Test: `tests/presentation/editor/unreadableZonesNotice.test.ts` (new)

**Interfaces:**
- Consumes: `ZoneScene { zones, unreadable }` from Task 2.
- Produces: `ProjectStore.unreadableZones: Ref<number>`, and the rendered element `.rp-editor-notice` carrying `editor.some-zones-unreadable`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountPlanEditor } from '../../helpers/planEditorRig';

describe('the canvas reports zones it could not read', () => {
	it('draws a counted notice when some zone notes refused', async () => {
		const editor = await mountPlanEditor({ zones: 2, unreadableZones: 3 });
		await flushPromises();

		const notices = editor.findAll('.rp-editor-notice').map((n) => n.text());

		expect(notices.some((text) => text.includes('3'))).toBe(true);
	});

	it('draws no such notice when every zone note was read', async () => {
		const editor = await mountPlanEditor({ zones: 2, unreadableZones: 0 });
		await flushPromises();

		const notices = editor.findAll('.rp-editor-notice').map((n) => n.text());

		expect(notices.some((text) => text.includes('could not be read'))).toBe(false);
	});

	it('draws it INDEPENDENTLY of the background chain', async () => {
		// The regression this asserts: chained into the background v-if/v-else-if, one
		// failure silently swallows the other. This plan has a missing background AND
		// unreadable zones, and BOTH sentences must be on screen.
		const editor = await mountPlanEditor({ zones: 1, unreadableZones: 1, background: 'missing' });
		await flushPromises();

		expect(editor.findAll('.rp-editor-notice')).toHaveLength(2);
	});
});
```

Read `tests/helpers/planEditorRig.ts` first and extend its options object with `unreadableZones` rather than inventing a second rig. Assert on the **rendered DOM**, never on the store field: a store field no template reads is a shipped defect this repository already has a rule about.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/unreadableZonesNotice.test.ts`
Expected: FAIL — no such notice is rendered.

- [ ] **Step 3: Add the store field**

In `ProjectStore.ts`, beside `zones` at line 32:

```ts
	/**
	 * How many of this plan's zone notes could not be read. A separate field from `zones`
	 * because it is a fact about the READ rather than about the scene: the canvas draws
	 * every zone it has AND says how many it does not have, which is what makes one bad
	 * note cost one zone instead of the plan.
	 *
	 * Written only on a successful hydrate, beside `zones`, so it can never describe a
	 * different read than the one on screen.
	 */
	const unreadableZones = ref(0);
```

In `hydrate`, at the success block around line 159:

```ts
		zones.value = new Map(foundZones.value.zones.map((zone) => [zone.id, zone]));
		unreadableZones.value = foundZones.value.unreadable;
```

Add `unreadableZones` to the store's returned object, and reset it to `0` wherever `zones` is reset.

- [ ] **Step 4: Render the strip**

In `PlanEditorRoot.vue`, add `unreadableZones` to the `storeToRefs` destructure at line 38, and insert this block **after** `staleAfterRefresh`'s `<p>` and **before** the `backgroundStatus === 'missing'` block, as its own `v-if`:

```html
		<!--
			Its OWN `v-if`, never chained into the background `v-if`/`v-else-if` below. That
			chain's own comment records what chaining an independent condition cost last time:
			two unrelated failures, one silently swallowing the other. "Some zones could not be
			read" and "this plan's background is missing" are independent facts and a plan can
			have both.
		-->
		<p
			v-if="unreadableZones > 0"
			class="rp-editor-notice"
			role="status"
		>
			{{ tr('editor.some-zones-unreadable', { count: String(unreadableZones) }) }}
		</p>
```

- [ ] **Step 5: Add the copy to both locales**

`en.ts`:

```ts
	'editor.some-zones-unreadable': '{count} zone(s) in this plan could not be read and are not drawn. Open the diagnostics report to see which notes refused.',
```

`de.ts`:

```ts
	'editor.some-zones-unreadable': '{count} Bereich(e) in diesem Grundriss konnten nicht gelesen werden und werden nicht gezeichnet. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
```

Both name the same `{count}` hole, which `strings.test.ts` checks per key.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/editor/unreadableZonesNotice.test.ts`
Expected: PASS, all three.

- [ ] **Step 7: Verify the mutation that matters**

Move the new `<p>` into the background chain by changing its `v-if` to `v-else-if` and placing it after the `missing` block. Re-run: the third case must go red at `toHaveLength(2)`. Restore.

- [ ] **Step 8: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: the canvas says how many zones it could not read

Its own v-if rather than a link in the background chain -- that chain's
comment already records what chaining an independent condition cost.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The project detail state says how many plans it could not read

**Files:**
- Modify: `src/presentation/stores/ProjectDetailStore.ts:31-47,110-120,150,173,178`
- Modify: `src/presentation/views/ProjectDetailState.vue:52-58`
- Modify: `src/presentation/views/ProjectDetail.vue:36-40` and its template
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Test: `tests/presentation/views/unreadablePlansNotice.test.ts` (new)

**Interfaces:**
- Consumes: `PlanListView { plans, unreadable }` from Task 3.
- Produces: `ProjectDetailStore.unreadablePlans: Ref<number>`; `ProjectDetail` gains the prop `unreadablePlans: number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountProjectDetail } from '../../helpers/projectDetail';

describe('the project detail state reports plans it could not read', () => {
	it('draws a counted notice when some plan notes refused', async () => {
		const view = await mountProjectDetail({ plans: 2, unreadablePlans: 1 });
		await flushPromises();

		expect(view.find('.rp-view-notice').text()).toContain('1');
	});

	it('draws none when every plan note was read', async () => {
		const view = await mountProjectDetail({ plans: 2, unreadablePlans: 0 });
		await flushPromises();

		expect(view.find('.rp-view-notice').exists()).toBe(false);
	});

	it('draws the plans it CAN read beside the notice, never instead of them', async () => {
		// The defect this whole task exists for: before it, one bad plan note took the
		// listing down and the detail state drew its failure screen with no plans at all.
		const view = await mountProjectDetail({ plans: 2, unreadablePlans: 1 });
		await flushPromises();

		expect(view.findAll('.rp-plan-list__row')).toHaveLength(2);
		expect(view.find('.rp-view-notice').exists()).toBe(true);
	});
});
```

Read the existing detail-state test helpers first — design slice 21 shipped several — and extend the one already there. Confirm `.rp-plan-list__row` is the real row class before asserting on it; if `PlanList.vue` spells it differently, use its spelling.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/views/unreadablePlansNotice.test.ts`
Expected: FAIL — no notice element exists.

- [ ] **Step 3: Add the store field**

In `ProjectDetailStore.ts`, beside `plans` at line 31:

```ts
	/**
	 * How many of this project's plan notes could not be read. `ProjectStore.unreadableZones`
	 * on the other surface, for the same reason: the region draws every plan it has AND says
	 * how many it does not.
	 */
	const unreadablePlans = ref(0);
```

Set it from `listed.value.unreadable` beside `plans.value = listed.value.plans;` at line 118; reset it to `0` at each of the three places `plans.value = []` appears (lines ~47, ~150, ~173); add it to the returned object at line 178.

- [ ] **Step 4: Thread it to the component**

`ProjectDetailState.vue` — add `unreadablePlans` to the `storeToRefs` destructure and bind it on `<ProjectDetail :unreadable-plans="unreadablePlans" …>`.

`ProjectDetail.vue` — add to `defineProps`:

```ts
	unreadablePlans: number;
```

and render inside the plans region, above `<PlanList>`:

```html
		<p
			v-if="unreadablePlans > 0"
			class="rp-view-notice"
			role="status"
		>
			{{ tr('view.project.some-plans-unreadable', { count: String(unreadablePlans) }) }}
		</p>
```

`.rp-view-notice` is reused deliberately: it is the same additive-warning role `ViewRoot` already gives it on this same view, and it is already declared in the stylesheet.

- [ ] **Step 5: Add the copy to both locales**

`en.ts`:

```ts
	'view.project.some-plans-unreadable': '{count} plan(s) in this project could not be read. Open the diagnostics report to see which notes refused.',
```

`de.ts`:

```ts
	'view.project.some-plans-unreadable': '{count} Grundriss(e) in diesem Projekt konnten nicht gelesen werden. Der Diagnosebericht zeigt, welche Notizen abgelehnt wurden.',
```

- [ ] **Step 6: Run the test, then the accessibility case**

Run: `npx vitest run tests/presentation/views/unreadablePlansNotice.test.ts tests/harness/accessibility.test.ts`
Expected: both PASS. The axe case scans this surface; a `role="status"` on a `<p>` adds no violation, and a red here means the markup landed somewhere it should not have.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: the project detail state says how many plans it could not read

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The diagnostics report modal

`GetDiagnosticsSnapshotQuery` has been built, guarded, composed and tested since slice 11, and consumed by nobody. Three sentences added by this plan now tell the user to open it.

**Files:**
- Create: `src/plugin/diagnostics/DiagnosticsReportModal.ts`
- Create: `tests/plugin/diagnostics/diagnosticsReportModal.test.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`

**Interfaces:**
- Consumes: `DiagnosticsSnapshot` from `src/application/queries/GetDiagnosticsSnapshot`.
- Produces:
  ```ts
  export interface DiagnosticsReportDeps {
      readonly snapshot: DiagnosticsSnapshot;
      /** Where a note with this id sits, or `undefined` when the index does not know it. */
      resolvePath(entityId: string): string | undefined;
      writeToClipboard(text: string): Promise<void>;
  }
  export function renderDiagnosticsReport(into: HTMLElement, deps: DiagnosticsReportDeps): void;
  export function diagnosticsReportText(snapshot: DiagnosticsSnapshot): string;
  export class DiagnosticsReportModal extends Modal { … }
  ```
  `renderDiagnosticsReport` and `diagnosticsReportText` are exported **separately from the Modal** precisely so both are testable without constructing one.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { diagnosticsReportText, renderDiagnosticsReport } from '../../../src/plugin/diagnostics/DiagnosticsReportModal';

const SNAPSHOT = {
	pluginVersion: '0.1.0',
	obsidianVersion: '1.13.0',
	schemaVersions: { zone: 1 },
	migrationState: { pending: [], lastApplied: null },
	validationIssues: [{ entityType: 'zone', entityId: 'zone-01JAAA', issue: 'zone.frontmatter-invalid' }],
};

describe('the diagnostics report', () => {
	it('shows the note path for an issue, so the user can find the broken note', () => {
		installObsidianDom();
		const into = document.createElement('div');

		renderDiagnosticsReport(into, {
			snapshot: SNAPSHOT,
			resolvePath: (id) => (id === 'zone-01JAAA' ? 'Renovation/Kitchen/Zones/Sink.md' : undefined),
			writeToClipboard: () => Promise.resolve(),
		});

		expect(into.textContent).toContain('Renovation/Kitchen/Zones/Sink.md');
		expect(into.textContent).toContain('zone-01JAAA');
	});

	it('renders an issue whose path the index does not know', () => {
		installObsidianDom();
		const into = document.createElement('div');

		renderDiagnosticsReport(into, {
			snapshot: SNAPSHOT,
			resolvePath: () => undefined,
			writeToClipboard: () => Promise.resolve(),
		});

		expect(into.textContent).toContain('zone-01JAAA');
	});

	it('EXCLUDES the path from the copied text, which the rendered row shows', () => {
		// The asymmetry this increment is built on. The ledger is provably content-free
		// (diagnostics.test-d.ts), the VIEW joins a path so the user can act, and the
		// exported text stays content-free because exporting is what SDD §86 governs.
		// Both halves in one case: either alone passes a build that got it backwards.
		const copied = diagnosticsReportText(SNAPSHOT);

		expect(copied).toContain('zone-01JAAA');
		expect(copied).not.toContain('Renovation/Kitchen/Zones/Sink.md');
		expect(copied).not.toContain('.md');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/plugin/diagnostics/diagnosticsReportModal.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/plugin/diagnostics/DiagnosticsReportModal.ts`. Build every element with `createDiv`/`createEl` and take every string from `tr(...)` — `I18N_LITERAL_BAN` watches `createEl`'s `text:` option and `.setText`, so a literal fails the build.

```ts
/**
 * The surface `GetDiagnosticsSnapshotQuery` never had. It was built, guarded, composed and
 * tested in slice 11 and consumed by nobody, while the design that skips unreadable notes
 * rests on "the per-entity detail lives in the diagnostics report" — a fallback to nothing
 * until this file existed.
 *
 * **Plain DOM, deliberately.** Slice 15's `DialogHost` is scoped to an ItemView's Vue app
 * and a palette command has no such host when no view is open, so mounting this in Vue
 * would mean a third Vue app — the plugin-global one SDD §12 would need an exception for
 * and slice 13 deliberately never built. `createDiv`/`createEl` is what the notice live
 * regions and the settings pane already use.
 *
 * **What is SHOWN and what is COPIED differ, on purpose.** `DiagnosticsLedger` is provably
 * content-free — `tests/application/ports/diagnostics.test-d.ts` holds five
 * `@ts-expect-error` directives forbidding a name or a path from ever entering it — so an
 * issue names an opaque id and nothing else. A user holding an id still has to find the
 * note, so the VIEW joins the id against the project index at render time. The COPIED text
 * is `diagnosticsReportText`, built from the snapshot alone and never from the join,
 * because SDD §86 governs what leaves the device rather than what is drawn on it.
 */
```

```ts
/**
 * The COPIED payload. It takes the snapshot and nothing else — no `resolvePath` parameter
 * exists to pass — which is what makes "the export carries no path" structural rather than
 * a discipline somebody has to keep. A future edit that wants a path in here has to widen
 * the signature, which is a visible decision.
 */
export function diagnosticsReportText(snapshot: DiagnosticsSnapshot): string {
	const lines = [
		`plugin ${snapshot.pluginVersion}`,
		`obsidian ${snapshot.obsidianVersion}`,
		`schema ${Object.entries(snapshot.schemaVersions).map(([k, v]) => `${k}=${String(v)}`).join(' ')}`,
		`migration last-applied ${snapshot.migrationState.lastApplied ?? 'none'}`,
		`migration pending ${snapshot.migrationState.pending.join(' ') || 'none'}`,
	];
	for (const issue of snapshot.validationIssues) {
		lines.push(`issue ${issue.entityType} ${issue.entityId} ${issue.issue}`);
	}
	return lines.join('\n');
}

export function renderDiagnosticsReport(into: HTMLElement, deps: DiagnosticsReportDeps): void {
	into.empty();
	const report = into.createDiv({ cls: 'rp-diagnostics' });

	report.createEl('p', { cls: 'rp-diagnostics__scope', text: tr('diagnostics.session-only') });

	const facts = report.createEl('dl', { cls: 'rp-diagnostics__facts' });
	const fact = (label: StringKey, value: string): void => {
		facts.createEl('dt', { text: tr(label) });
		facts.createEl('dd', { text: value });
	};
	fact('diagnostics.plugin-version', deps.snapshot.pluginVersion);
	fact('diagnostics.obsidian-version', deps.snapshot.obsidianVersion);
	fact('diagnostics.last-migration', deps.snapshot.migrationState.lastApplied ?? tr('diagnostics.none'));

	if (deps.snapshot.validationIssues.length === 0) {
		report.createEl('p', { cls: 'rp-diagnostics__empty', text: tr('diagnostics.no-issues') });
	} else {
		const list = report.createEl('ul', { cls: 'rp-diagnostics__issues' });
		for (const issue of deps.snapshot.validationIssues) {
			const row = list.createEl('li', { cls: 'rp-diagnostics__issue' });
			row.createSpan({ cls: 'rp-diagnostics__code', text: issue.issue });
			row.createSpan({ cls: 'rp-diagnostics__id', text: issue.entityId });
			// The JOIN, and the only place it happens. The ledger never held this.
			const path = deps.resolvePath(issue.entityId);
			if (path !== undefined) row.createSpan({ cls: 'rp-diagnostics__path', text: path });
		}
	}

	const copy = report.createEl('button', { cls: 'rp-diagnostics__copy', text: tr('diagnostics.copy') });
	copy.addEventListener('click', () => {
		void deps.writeToClipboard(diagnosticsReportText(deps.snapshot));
	});
}

export class DiagnosticsReportModal extends Modal {
	constructor(app: App, private readonly deps: DiagnosticsReportDeps) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.setText(tr('diagnostics.title'));
		renderDiagnosticsReport(this.contentEl, this.deps);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
```

Two things to check against the tree rather than trusting this sketch. `tests/helpers/obsidian-mock.ts` models only the DOM helpers something drives — if it lacks `createSpan` or `Modal.titleEl`, **widen the fake rather than avoiding the member**, and expect the widening to redden unrelated files. And add `.rp-diagnostics*` rules to a `styles/` partial: a class no stylesheet declares is a defect this repository has already shipped once, and jsdom resolves no CSS to catch it.

The `void` on the click handler is load-bearing: the handler is bound to a DOM event that discards its promise, so a rejected clipboard write would otherwise be an unhandled rejection reaching nobody. If the repo's lint prefers `runDetached` here, use it — the notice on success (`diagnostics.copied`) goes through `notifySuccess`.

- [ ] **Step 4: Add the copy to both locales**

`en.ts`:

```ts
	'diagnostics.title': 'Diagnostics report',
	'diagnostics.no-issues': 'No notes have refused to load in this session.',
	'diagnostics.session-only': 'This report covers the current session only. It is cleared when the vault is reopened.',
	'diagnostics.copy': 'Copy report',
	'diagnostics.copied': 'Diagnostics report copied.',
```

`de.ts`:

```ts
	'diagnostics.title': 'Diagnosebericht',
	'diagnostics.no-issues': 'In dieser Sitzung hat keine Notiz das Laden verweigert.',
	'diagnostics.session-only': 'Dieser Bericht umfasst nur die aktuelle Sitzung. Beim erneuten Öffnen des Vaults wird er geleert.',
	'diagnostics.copy': 'Bericht kopieren',
	'diagnostics.copied': 'Diagnosebericht kopiert.',
```

`diagnostics.session-only` is the first of the spec's two recorded limitations, put on the surface where the user meets it rather than only in a docblock. Note `Vault` stays untranslated in German — `strings.test.ts` requires it, since it is Obsidian's own name for the thing.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/plugin/diagnostics/diagnosticsReportModal.test.ts`
Expected: PASS, all three.

- [ ] **Step 6: Verify the asymmetry can fail**

Change `diagnosticsReportText` to accept and use `resolvePath`. The third case must go red at `not.toContain('.md')`. Restore. Then delete the join from `renderDiagnosticsReport` — the first case must go red. Restore. **Both directions, because a build that got the asymmetry backwards passes a suite that only checks one.**

- [ ] **Step 7: Write the second limitation where the code is**

In `renderDiagnosticsReport`'s docblock, add:

```
 * **A strip's count and this report's rows can disagree, and that is not reconciled.** A
 * warning strip counts ONE listing; this report holds every refusal recorded this session,
 * deduplicated on `(kind, id, code)` and bounded at `MAX_ISSUES = 200`
 * (`infrastructure/logging/diagnosticsLedger.ts:19`). A user who opens one plan and then
 * this report sees the same number; a user who opened three plans does not.
```

- [ ] **Step 8: Prove the content-free ledger is untouched**

The spec's Definition of Done item 6 is that this increment adds a path to the VIEW without spending the ledger's compile-time guarantee. Verify it rather than assuming it:

```bash
git diff --stat main -- tests/application/ports/diagnostics.test-d.ts src/application/ports/diagnostics.ts
```

Expected: **no output**. Both files unchanged. If either moved, the join leaked into the ledger and the five `@ts-expect-error` directives are no longer proving what the spec says they prove.

- [ ] **Step 9: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: the diagnostics snapshot gets a surface

Plain-DOM Modal rather than a third Vue app: slice 15's DialogHost is
scoped to an ItemView and a palette command has no host when no view is
open.

The ledger stays provably content-free. The view joins id to path so the
user can find the broken note; the copied text is built from the snapshot
alone, so what leaves the device stays content-free.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Both doors reach one function

**Files:**
- Create: `src/plugin/diagnostics/showDiagnosticsReport.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (beside the `open-project-detail` registration at ~257)
- Modify: `src/plugin/settings/SettingsTab.ts` (a row after the library-move ACTION row at ~184)
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Test: `tests/plugin/diagnostics/diagnosticsReportDoors.test.ts` (new)

**Interfaces:**
- Consumes: `DiagnosticsReportModal` from Task 6; `root.queries.diagnostics` from `guardedServices.ts:269`; `ProjectIndex.getPath(id): string | undefined` from `src/application/ports/ProjectIndex.ts:34`.
- Produces: `showDiagnosticsReport(host): Promise<void>` — the one function both doors call.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { makePluginHost } from '../../helpers/pluginHost';

describe('the diagnostics report has two doors and one function', () => {
	it('is registered as a command', async () => {
		const host = await makePluginHost();
		expect(host.commands.map((c) => c.id)).toContain('show-diagnostics-report');
	});

	it('is offered as a settings action row', async () => {
		const host = await makePluginHost();
		const rows = host.settingsTab.getSettingDefinitions();
		expect(rows.some((r) => r.action !== undefined && r.name.includes('iagnos'))).toBe(true);
	});

	it('both doors call the same function', async () => {
		const host = await makePluginHost();
		const opened = vi.spyOn(host, 'openDiagnosticsReport');

		host.commands.find((c) => c.id === 'show-diagnostics-report')?.callback?.();
		host.settingsTab.getSettingDefinitions().find((r) => r.action)?.action?.();

		expect(opened).toHaveBeenCalledTimes(2);
	});
});
```

Read `tests/plugin/registration.test.ts` first and reuse whatever host fake it already builds rather than adding `makePluginHost` beside an equivalent. The third case's spy must be verified to actually bind before its result is trusted — a spy on a module export can bind to nothing, which reports `not.toHaveBeenCalled()` for every build ever written.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/plugin/diagnostics/diagnosticsReportDoors.test.ts`
Expected: FAIL — no such command id.

- [ ] **Step 3: Write the one function**

Create `src/plugin/diagnostics/showDiagnosticsReport.ts`:

```ts
/**
 * The ONE function both doors call — a command and a settings action row — per this
 * repository's one-action-every-input rule. A second entry point with its own composition
 * looks correct alone and drifts the moment either is edited.
 *
 * `resolvePath` closes over the project index rather than being computed here, so the
 * modal never learns what an index is and the join stays a rendering concern.
 */
export async function showDiagnosticsReport(host: PluginCommandHost): Promise<void> {
	const snapshot = await host.root.queries.diagnostics.execute();
	new DiagnosticsReportModal(host.app, {
		snapshot,
		resolvePath: (entityId) => host.root.persistence?.index.getPath(entityId as never),
		writeToClipboard: (text) => navigator.clipboard.writeText(text),
	}).open();
}
```

Read `guardedServices.ts:269` and the composition root for the exact spelling of the diagnostics query and the index handle, and for whether `persistence` is nullable in an unrecovered-settings session. **If it is, the unrecovered case must resolve `undefined` for every path rather than throwing** — a report is exactly what a user with unrecovered settings needs, so it must still open.

- [ ] **Step 4: Register both doors**

In `RenovationPlannerPlugin.ts`, beside the existing commands:

```ts
		this.addCommand({
			id: 'show-diagnostics-report',
			name: tr('command.show-diagnostics-report'),
			callback: () => {
				this.openDiagnosticsReport();
			},
		});
```

Route the body through `runDetached` the way the other detached doors do — an Obsidian command handler returns nothing, so an unhandled rejection reaches nobody otherwise.

In `SettingsTab.ts`, after the library-move row:

```ts
			{
				name: tr('settings.diagnostics.name'),
				desc: tr('settings.diagnostics.desc'),
				action: () => {
					this.openDiagnosticsReport();
				},
			},
```

`getSettingDefinitions` returns `[{ name: tr('settings.unrecovered') }]` when settings are `null` (line ~138). **Decide deliberately and write down which you chose:** either the report row is added to that array too — the recommended reading, since an unrecovered session is when a user most needs it — or it is not, and the command remains the only door there.

- [ ] **Step 5: Add the copy to both locales**

`en.ts`:

```ts
	'command.show-diagnostics-report': 'Show diagnostics report',
	'settings.diagnostics.name': 'Diagnostics report',
	'settings.diagnostics.desc': 'Versions, schema versions, and the notes that refused to load in this session.',
```

`de.ts`:

```ts
	'command.show-diagnostics-report': 'Diagnosebericht anzeigen',
	'settings.diagnostics.name': 'Diagnosebericht',
	'settings.diagnostics.desc': 'Versionen, Schemaversionen und die Notizen, die das Laden in dieser Sitzung verweigert haben.',
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run tests/plugin/diagnostics/diagnosticsReportDoors.test.ts tests/plugin/registration.test.ts`
Expected: PASS. `registration-locality.test.ts` must stay green too — every registration member must sit under `src/plugin/`, which both of these do.

- [ ] **Step 7: Gate and commit**

```bash
npm run check
git add -A
git commit -m "feat: two doors to the diagnostics report, one function behind them

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The manual case, and the increment's own record

No gate here draws either strip, and the browser harness cannot produce a refusing note — its repositories start empty and hold entities rather than text. A vault is the only instrument.

**Files:**
- Create: `docs/tests/cases/A note that cannot be read.md`
- Modify: `docs/tests/suites/Smoke Test the Editor.md` (link the case)
- Modify: the three Issues this increment closes or narrows

- [ ] **Step 1: Read a sibling case for the shape**

Read `docs/tests/cases/Canvas Navigation.md` and `docs/tests/cases/Move the Library.md`. Both carry a Runs table and record what no gate here can check. Follow that shape exactly — including leaving the Runs table honestly **empty** until somebody runs it in a vault. An unrun manual case is a plan to find out, not a finding.

- [ ] **Step 2: Write the case**

Steps it must carry, each with an expected result:

1. `npm run test-build`, open the vault, run `create-sample-project`.
2. Edit one zone note's frontmatter to `schema-version: 99`.
3. Reload, open the Plan Editor on that plan. **Expect: four zones drawn, and one notice saying one zone could not be read.** Before this increment: no zones at all and a failed state.
4. Repeat with two corrupted zone notes. **Expect: the notice says 2.**
5. Corrupt a plan note; open the project detail state. **Expect: the other plans listed, and a notice.**
6. With a corrupted zone, open a Requirement's reassignment picker. **Expect: a refusal naming incomplete targets — never a short list.** This is the one surface that deliberately refuses; step 6 is where that decision is looked at.
7. Run `show-diagnostics-report`. **Expect: a row per refusal, each naming the note's path.**
8. Press Copy, paste into a note. **Expect: the ids are present and no path is.**
9. Open the report from the settings pane. **Expect: the same modal.**
10. Reload the vault and open the report without opening a plan. **Expect: no issues, and the session-only sentence.** This is the recorded limitation, looked at rather than described.
11. Switch Obsidian to German and repeat steps 3 and 7. **Expect: both sentences in German, with the count rendered — never a literal `{count}`.**

- [ ] **Step 3: Update the three Issues**

- `docs/issues/One unreadable zone note blanks every zone on the canvas.md` → `status: Done`, with a note that the Issue's "three entry points" was measured as two and where the third came from.
- `docs/issues/The diagnostics snapshot has no surface that reaches it.md` → `status: Done`, recording that the surface is a plain-DOM Modal and why not `DialogHost`, plus the session-scope limitation that remains.
- `docs/issues/A future-version note can be neither read nor deleted.md` → stays `New`. Add one line: the *which note* half is answered by the diagnostics report; the refusal itself is untouched and still open.

- [ ] **Step 4: Final gate and commit**

```bash
npm run check
git add -A
git commit -m "docs: the manual case for a note that cannot be read

The only instrument for either warning strip or the report -- no gate
here draws them, and the harness cannot produce a refusing note.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## After the plan

Run `npm run test-build` and walk the manual case. Four of the last several slices' worst defects were found by a human running the plugin while all four gates were green, and every one of them was a fake accepting what Obsidian refuses. This increment adds a `Modal`, a clipboard write and two DOM strips — three things this suite models and does not verify.
