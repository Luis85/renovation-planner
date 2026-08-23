# Design Slices — from SDD to Implementable Chunks

## Purpose

The received SDD (`docs/sdds/obsidian-renovation-planner-SDD.md`) describes the target
architecture as a whole. It stays verbatim, as received, per this folder's convention.

This folder breaks that architecture down into smaller, bounded design documents —
"slices" — each scoped tightly enough to be implemented, tested, and reviewed on its
own, in the order listed below. Together they build the plugin's architectural
foundation: bootstrapping, domain model, persistence, rendering, editor framework, the
cost/quantity engine, and the shared UI/UX vocabulary every view reuses (notifications,
empty states, modals, form feedback, error surfacing) — proven end to end on the first
three domain entities (Project, Plan, Zone). Only once that foundation exists does
actual **feature development** begin — the rest of the PRD's epics (trades, work
packages, tasks, procurement, suppliers, documents, risks, scenarios, and so on) are
built on top of it, not as part of it.

These are derived documents, not received evidence: unlike `docs/prds/` and
`docs/sdds/`, they are expected to be edited as the design is refined. They are not
part of the Epic/Feature/PBI backlog either — they carry no `type`, `parent`, or
`order`, and do not appear in the backlog tree.

## How to read a slice

Each slice document follows the same shape:

- **Purpose** — what this slice delivers and why it is its own bounded chunk.
- **Scope** — explicitly what is in and out, so slices don't overlap or leave gaps.
- **Dependencies** — which earlier slices and ADRs it builds on.
- **Design** — the actual architecture, derived from the SDD sections cited in
  **References**.
- **Interfaces & Contracts** — the key types, interfaces, and module boundaries a
  reviewer or implementer needs to see before writing code.
- **Persistence Impact** — what this slice reads or writes in the Vault, if anything.
- **Testing Strategy** — what must be tested, and at what level, before the slice is
  considered done.
- **Definition of Done** — a concrete, verifiable checklist, in the same spirit as the
  SDD's own MVP increment success criteria.
- **References** — the SDD sections, PRD sections, and ADRs this slice derives from.

## Repository conventions a slice must conform to

The SDD is the architectural authority (CLAUDE.md says so, and says this folder is the
bug where they disagree). Two files under `docs/setup/` are narrower but binding in their
own areas, and a slice that touches those areas is expected to have been read against
them:

- **`docs/setup/vue-conventions.md`** — the component, composable and Pinia rules. It
  binds **any slice that specifies a Vue surface at all** — a component (whether or not it
  names an SFC file), a component test, a Pinia store, a composable, or the build or test
  wiring for any of them. That is a rule rather than a list on purpose. Two drafts
  of this bullet carried a list instead: the first was "the presentation slices (5, 6,
  13–17)", which omitted slice 1 — the slice that installs Vue and writes the build configs,
  and the one that was actually wrong. The second added slice 1 and still omitted slice 10,
  which adds a Requirements panel to the Inspector and specifies its component tests.

  Both misses have the same cause, and it is the reason the rule replaced the list: a
  membership test you apply by recognising which documents are *about* Vue will keep
  missing the ones that merely *touch* it, and it goes stale the moment a slice grows its
  first component. CLAUDE.md states this directly — a table that enumerates code goes
  stale, a table that states a rule does not — and it took two findings here to apply it.
  The predicate had to be widened once more after that, and the reason is worth keeping.
  The first mechanical version asked whether a slice names "a `.vue` file, a store, a
  composable, or the config that builds one" — and slice 10 names none of those. It
  specifies a Requirements panel and a component test without ever assigning an SFC
  filename, so the rule written to stop excluding slice 10 went on excluding it. I had
  drawn the test from the artifacts I happened to be looking at (filenames) rather than
  from what the convention governs (Vue surfaces), which is the same scoping error in its
  third costume.

  So the test errs toward inclusion, which is the right direction for a conformance sweep:
  a slice wrongly included costs a reading, a slice wrongly excluded costs a defect that
  ships. If a slice talks about Vue in any way, read it against the conventions.

  Where a slice departs from the conventions, the departure is named in that slice's
  **References**, not left to be discovered. There are **two** today, both in slice 13 and
  both parts of one decision:
  - **§5, one Pinia per view app** — `NotificationStore` is plugin-global.
  - **§6, apps created in a view's `onOpen` and unmounted in `onClose`** — the
    `NotificationHost` app is created in `RenovationPlannerPlugin.onload()` and
    unmounted in `onunload()`, so the composition root knows it is mounting Vue. That
    also departs from CLAUDE.md's "nothing outside the view will know it is Vue."

  A first draft of this section called the store the *one* departure and stopped there,
  which is the failure this whole section is supposed to prevent: an inventory that is
  wrong reports a nonconforming slice as conforming, and does it with more authority than
  no inventory at all. The store cannot be plugin-global without an app to mount its host
  into, so listing one and not the other was never a defensible split.

  Slice 16 briefly had a third and no longer does, which is worth recording because
  withdrawing a departure is the outcome to prefer. `useFormCommit.values` was a
  `Reactive<TInput>`, declared on the reasoning that `v-model="values.unitCost"` beats a
  per-field `Ref` map — but `v-model` on a mutable reactive property assigns to it
  directly, walking past the `setField` the same sentence called the sole write path. The
  justification defeated itself, so `values` is a `DeepReadonly<Ref<TInput>>` written only
  through `setField`, and the slice conforms.

  **Deep**, and the first repair was not. It said `Readonly<Ref<TInput>>`, which is a
  shallow mapped type: it freezes `.value` and leaves every property under it writable, so
  `values.value.unitCost = -5` and — since a ref unwraps in templates — the very
  `v-model="values.unitCost"` the departure was withdrawn over both still type-checked.
  The fix reproduced the defect it was closing, in a shape that reads as though it had
  not. Recorded here because it is the fourth instance of this section's own subject: a
  sentence describing a mechanism that is not there, this time carried by a type name that
  sounded like the guarantee. Slice 16's Definition of Done now requires both writes to
  fail `vue-tsc`, so the claim has a check under it rather than a plausible-looking type.

  Its two other §4 near-misses were likewise
  conformed rather than declared: `useFieldCommit` now accepts `MaybeRefOrGetter`, and
  `fieldErrors` — a bare `ReadonlyMap`, which is a defect rather than a style question,
  since a plain Map out of a composable is a snapshot and a rejected `submit()` would have
  rendered no errors at all — is a `Ref`.

  A fifth followed from the fourth and is a different lesson worth keeping. Giving
  `setField` real behaviour — clearing the edited field's error, so a corrected value
  stops carrying a stale message — established a rule on the form path and left the
  Inspector's `onInput` without it, in a slice whose own text says the two composables
  differ only in commit boundary. The types had been mirrored and the behaviour had not,
  which is the harder half to notice: an Inspector field would have displayed "must be
  zero or more" under a value the user had already fixed. Both composables now carry the
  rule and each asserts it directly rather than inheriting it from the other. **When a
  rule is established on one path, find its mirror in the same change** — nothing in a
  document flags the half you did not write.

  The rule those four cases produced: **a departure is for when conforming and behaving
  come apart.** Three of the four turned out not to be that, and the fourth (slice 13's)
  genuinely is.
- **`docs/setup/quality-harness.md`** — the harness's rationale: what each gate refuses
  and why, which is the reasoning a Definition of Done should be written in the spirit of.
  It is a **build-this-from-nothing guide describing a target**, not a description of the
  gate as it stands: it specifies five steps under `npm run check` including
  `npm run docs`, and four of those five are live. There is no `docs` script and no
  `scripts/docs-check.mjs` — CLAUDE.md lists that register gate under "Deliberately
  absent", to arrive when `docs/` has a convention worth enforcing (the guide's §5 is what
  to build then).

  **A slice's Definition of Done is written against the four gates that exist**, which
  are `package.json`'s `check` — build, lint, `test:coverage`, analyze — as CLAUDE.md's
  "Definition of done" states them. A first draft of this bullet called the guide "what
  `npm run check` refuses", which would have pointed a slice at a fifth gate nothing runs.
  That is the same defect as the inventory above and as the testability claim in slice 16:
  a sentence describing a mechanism that is not there. Three of them in one pull request
  whose subject is documents disagreeing with each other is not an irony worth polishing
  away — it is the measurement, and it is why the last paragraph of this section says what
  it says.

Neither is checked mechanically against these documents. That is worth stating rather
than implying: a slice conforming is a review outcome, and the conformance a slice
claims in prose is exactly as reliable as its Definition of Done makes it.

## Shared conventions

These apply to every slice below and are not repeated in each one:

- **Repository structure** — SDD §77.
- **Module pattern** (a domain module is self-contained: entity, ID, schema, errors,
  events; commands live under `application/commands/<module>/`) — SDD §78.
- **Public boundaries** (explicit module exports, no deep internal imports) — SDD §79.
- **Naming conventions** (singular domain nouns, verb+object commands, past-tense
  events, Get/List/Find queries) — SDD §80.
- **TypeScript rules** (`strict: true`, no `any`, no non-null assertions, prefer
  `unknown` + runtime validation) — SDD §81.
- **Entity IDs & references** (stable IDs independent of filename/title/path; UUID or
  ULID; Markdown links are navigation, never identity) — SDD §82–83.
- **The layer dependency rule** (Presentation → Application → Domain → Core;
  Infrastructure → Application Ports → Domain; enforced by lint, not just convention) —
  SDD §8, ADR-006.

## Shared vocabulary

Seventeen documents describing one codebase will drift on the small shared types unless
one place fixes them. Each rule below is stated once here and consumed, never restated
with a variation, by every slice. Where a slice's own examples and this list disagree,
this list is the bug report.

- **`Result` is data, not an object with methods.** Slice 2 exports the free functions
  `ok` / `err` / `isOk` / `isErr` and the `.ok` discriminant. Write `isErr(result)` or
  `if (!result.ok)`, never `result.isErr()`; write `err(...)`, never `Result.err(...)`.
- **An `AppError` is a plain, constructed-by-factory object.** Never `new SomeError(...)`
  — slice 2's categories are interfaces, and `new ReferenceError(...)` in particular
  resolves to the JavaScript global, not the domain type.
- **A domain event's discriminant is `type`**, matching slice 2's `DomainEvent<TType>`.
  Not `name`, and not `kind`.
- **Every repository port method returns a `Result`**, including reads — slice 3 declares
  that shape once and slice 4 implements it without widening any signature. "Not found"
  is `ok(null)`, never an error; an error means the read or write itself failed.
- **Units come from slice 9**, not slice 2: `Money`, `Quantity`, `UnitKind` (SDD §48's
  seven dimension kinds), `MeasurementUnit` (the concrete symbol persisted on an Asset),
  and `DerivedValue<T>`. Slice 2's `core/units/` holds only the world-unit convention.
- **`Point` is always world millimetres; `ScreenPoint` is always pixels.** They are
  defined in two different places, and the split is the point: `Point` is slice 2's, in
  `core/geometry` — core is where a world coordinate belongs and core never sees a pixel.
  `ScreenPoint` and the `worldToScreen`/`screenToWorld` pair are slice 5's, in
  `presentation/editor/viewport/`, and slice 5 **re-exports** `Point` beside them rather
  than redeclaring it (slice 5's Definition of Done says so explicitly). A second
  structurally-identical `ScreenPoint` — or a second `Point` — would silently defeat the
  brand that keeps the two apart.
- **A polygon is validated by `createPolygon`** (slice 2). A bare `Polygon` value is not
  assumed valid. `createPolygon` implements the *four* of SDD §26's six required bullets
  that are properties of a point list — ≥3 vertices, finite coordinates, no `NaN`, no
  `Infinity` (slice 2 counts these as "three rules", collapsing `NaN`/`Infinity`). The
  other two, **`valid unit` and `valid transform`, are not properties of a point list**
  and therefore cannot live in a smart constructor over one; §26 is refined here rather
  than dropped, and each has a named owner:
  - *At the editor boundary* — slice 8's "Geometry validation (SDD §26)" table. `valid
    unit` is a compile-time guarantee (a handler reads `event.worldPoint`, and
    `ScreenPoint` is not assignable to `Point`); `valid transform` falls back onto
    `createPolygon`'s finite-coordinate check, which a degenerate viewport trips.
  - *At the persistence boundary* — slice 4's schema validation, which is where §26's
    own "validate before persistence" framing actually lands and where the compile-time
    half of the editor's answer buys nothing, because the input came off disk.
- **Logging goes through the `Logger` port**, `application/ports/Logger.ts` from slice 1,
  injected from the composition root and never constructed at a call site. `event` is a
  stable dot-delimited key (`'zone.save.failed'`), `context` carries the values, and
  `error`'s context carries `cause`. Nothing outside `infrastructure/logging/` touches
  `console.*` — `no-console` is a lint error everywhere else in `src/` — and nothing under
  `domain/` logs at all: a pure entity returns a `Result` and its caller records it. Which
  level a given event takes is slice 11's table, not each slice's judgement.
- **Every user-facing string goes through `t(language, key)`** — the pure lookup that
  already exists in `src/presentation/i18n/`, with `en.ts` as the complete table
  `StringKey` derives from and per-key fallback for every other locale. A slice that
  needs new copy adds keys to `en.ts`; it does not define its own string table. This
  matters more than it looks: the English table is the file the `obsidianmd` ruleset's
  locale rules match, so sentence-case UI text is *linted* there and merely reviewed
  anywhere else, and `docs/requirements/Multilanguage.md` is a standing requirement a
  hardcoded literal quietly breaks. Callers resolve the language once from Obsidian's
  own `getLanguage()`; the plugin never grows a language setting of its own.

## The slice map

**A citation with a bare `§N` means the SDD; `PRD §N` means the PRD.** The two
documents number their own sections independently starting from 1, so `§39`/`§64`/`§67`
(among others) name a completely different topic in each — always write `PRD §N` when
citing the PRD, never rely on context to disambiguate, and check the actual heading
before citing a number from memory.

| # | Slice | Depends on | Increment | Primary SDD sections |
| --- | --- | --- | --- | --- |
| 1 | [Plugin Bootstrap & Composition Root](01-plugin-bootstrap-and-composition-root.md) | — | 1 | §§4–12, §76 |
| 2 | [Core Primitives](02-core-primitives.md) | 1 | 2 (part) | §7.1, §22–23, §33–34, §64–66, §82 |
| 3 | [Domain Foundation: Project, Plan, Zone](03-domain-foundation-project-plan-zone.md) | 2 | 2 (part) | §7.2, §29, §32/34 (applied), §35 (applied); PRD §8 |
| 4 | [Persistence & Repository Layer](04-persistence-and-repository-layer.md) | 3 | 3 | §35–47; ADR-002, ADR-011 |
| 5 | [Canvas Rendering & Editor Shell](05-canvas-rendering-and-editor-shell.md) | 4 | 4 | §11–19, §54–55, §60 (layout), §84–85 |
| 6 | [Editor Tool Framework, Undo/Redo & Inspector](06-editor-tool-framework-undo-redo-and-inspector.md) | 5 | — | §20–21, §29–31 (undo), §56–59 |
| 7 | [Calibration](07-calibration.md) | 6; 15 for the recalibration branch | 5 | §25 |
| 8 | [Zone Editing](08-zone-editing.md) | 6 | 6 | §26–28 |
| 9 | [Quantity & Cost Engine](09-quantity-and-cost-engine.md) | 2 | 7 (part) | §48–52; ADR-010 |
| 10 | [Assets, Requirements & the End-to-End Loop](10-assets-requirements-and-the-end-to-end-loop.md) | 4, 8, 9 | 7 (part) | wiring; PRD §8, §9 |
| 11 | [Error Handling, Diagnostics & Data Safety](11-error-handling-diagnostics-and-data-safety.md) | 1, 2 | — | §67–68, §86–88 |
| 12 | [Testing & Architecture Enforcement Infrastructure](12-testing-and-architecture-enforcement-infrastructure.md) | 1 to build; all to complete | — | §69–76, §92 |
| 13 | [Notifications & Save-State Surfaces](13-notifications-and-save-state-surfaces.md) | 5, 6, 11 | — | PRD §67 (Autosave: Saved/Saving/Unsaved/Save Error) — not to be confused with the SDD's own §67 (Logging) |
| 14 | [Empty States](14-empty-states.md) | 5 | — | PRD §94 |
| 15 | [Modals & Confirmation Dialogs](15-modals-and-confirmation-dialogs.md) | 5, 6 | — | PRD §64 (Deletion Semantics), PRD §39 (Inspector actions) — PRD §39/§64 are unrelated to the SDD's own §39 (Sidecar Files) and §64 (Error Model) |
| 16 | [Form & Inline Validation Feedback](16-form-and-inline-validation-feedback.md) | 6, 11 | — | SDD §59 (Inspector), SDD §64 (Error Model, applied) |
| 17 | [Presentation-Layer Error Surfacing](17-presentation-layer-error-surfacing.md) | 11, 13, 14, 15, 16 | — | SDD §66 (Error Boundary, the Presentation half) |

Slice 8 depends only on slice 6. Slice 7 depends on slice 6 too, and additionally on
slice 15 for one branch — `CalibrateTool` opens a `ConfirmDialog` before recalibrating
over existing geometry (07 *Dependencies*, and its Definition of Done). A **first**
calibration, which is all Increment 5 requires, dispatches without a dialog, so slice 7
is buildable and shippable against slice 6 alone; only the recalibration branch waits for
slice 15. The two can be built in either order (the PRD's own MVP scope needs calibration
before zone measurements are meaningful, but nothing in the architecture forces that
sequencing). Slice 10 is the integration point: it does not introduce new architecture,
only wires slices 4, 8, and 9 together into the
`Zone Geometry → Area → Requirement → Cost` loop the SDD's Increment 7 describes.

Slices 11 and 12 are cross-cutting, and their scheduling is **not** the same:

- **Slice 11 can be worked in parallel with slices 5–10 once slice 2 exists, and later
  slices do depend on it.** Slices 13, 16 and 17 all consume its `ToUserMessage` and
  Error Boundary (see their *Dependencies*, and the table above), so "nothing later
  structurally depends on it" is false and is not the reason to parallelize it — the
  reason is that its own inputs are slices 1 and 2, so it does not wait on 5–10. What
  follows is a scheduling constraint rather than freedom: 11 must land before 13, 16
  and 17, not merely alongside them.
- **Slice 12's infrastructure can be stood up as early as slice 1; only its completion
  waits on everything.** The table's "1 to build; all to complete" is the whole contract,
  and slice 12's own *Dependencies* section states it: the directory layout, the vitest
  configuration and the lint rules have no ordering constraint and should exist from day
  one so no slice retrofits a harness, while the Architecture Completion Criteria (§92)
  cannot be verified true until every slice exists. Nothing later structurally depends on
  slice 12 — the justification that does not survive for slice 11 does survive here.

Slices 13–16 are independent UI vocabulary — each defines one reusable presentation
pattern (a toast, an empty-state slot, a dialog, a field-level error) that any view can
use, and none of them depend on each other. **Slice 5 is not sufficient for all four**,
which the table above is the authority on: 14 is the only one buildable on slice 5
alone. 13 additionally needs slice 6's `CommandHistory` and slice 11's `ToUserMessage`;
15 needs slice 6; 16 needs slice 6 and slice 11. Read "parallel" as "independent of each
other", not as "unblocked by slice 5". Slice 17 is the integration point for
this group, the same role slice 10 plays for the domain/cost loop: it does not
introduce new UI vocabulary, it only defines the decision rules connecting slice 11's
error categories to slices 13–16's surfaces — which category becomes a toast, which
becomes an inline field error, which becomes a blocking modal, and which becomes a
persisted status badge like slice 10's `recalculationStatus`. Slice 14 is in its
dependency list because it is the one slice that hands cases *to* slice 17 rather than
taking a surface from it: a view whose hydrating query failed, and a view whose stored
entity ID no longer resolves, are both explicitly deferred there and must land
somewhere in slice 17's table.

## Explicitly deferred

The SDD itself treats the following as optimizations or future work, not required
foundation, and they are out of scope for every slice above:

- **Bases Integration** (§13) — custom Bases views (Budget, Schedule, Procurement,
  Risk) over the same Vault data.
- **Scheduling Architecture** (§53) — the SDD states this explicitly is "not part of
  the initial architecture core."
- **Advanced Polygon Operations** (§27, `clipper2-ts`) and **Spatial Index** (§28,
  `rbush`) — both explicitly framed as optimizations; "correctness must not depend on"
  the index.
- **Worker Strategy** (§63) — "do not introduce workers until profiling justifies
  them."

Everything from PRD Epic 8 onward — Trades & Work Packages, Task Management, Schedule,
Suppliers & Quotes, Documents/Photos, Procurement, Decisions & Change Management,
Risks/Issues, Progress & Site Documentation, Reporting, Scenarios, Existing/As-Built
State, and Plan Revisions — is feature development that builds on this foundation. It
is deliberately not sliced here.
