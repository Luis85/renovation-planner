---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 0
status: Active
started: 2026-08-23
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Architecture and Software Design

The SDD runs to ninety-three sections and most of them are about no product epic at all.
§2 states the architectural goal — the vault is the persistent source of truth, and Vue,
Pinia and Konva are replaceable presentation technologies. §7 names the five layers and §8
gives the dependency rule, with three invalid arrows spelled out beside the valid ones:
domain → obsidian, geometry engine → konva, cost engine → pinia. §76 asks for automated
architecture tests. §§77–81 fix the repository structure, the internal module pattern, the
public boundaries, the naming conventions and the TypeScript rules. §89 records ten
architecture decisions and §92 lists fifteen criteria by which the whole foundation is
judged. None of that is the plan editor's work, and none of it is the cost engine's, and
all twenty product epics are built on it.

That is the second of this epic's two admission clauses rather than the first. Structure
does not appear *inside* every product epic the way text does or the way a typed error
does; it is the thing they are all measured by, which is the other half of the sentence and
the half this Feature is here on.

**Its outcome is the maintainer's, not the renovator's, and that is written down rather
than dressed up.** Somebody planning their own bathroom never observes the dependency rule
holding. What they eventually observe is a consequence they cannot attribute — that the
nineteenth screen behaves like the first, that a cost is the same number wherever it is
asked, that a broken file cost them one project and not the plugin. Every other Feature
under this epic promises something the reader can see; this one cannot, and phrasing it in
a user's terms would make it the one note in the folder whose Outcome is a fiction.

The record it owns has a direction, and the direction is the rule. The SDD is **received**
and stays verbatim, so a note citing §8 cites something that has not been edited to agree
with it. `docs/tasks/` holds seventeen **derived** slices, expected to change as the
design is refined, each naming the SDD sections it derives from. `docs/adrs/` holds what
was actually **decided**, and where a decision and the SDD disagree the ADR is what holds.
That is not hypothetical: ADR-011 moves the geometry sidecar into a `Geometry/` folder
inside the project's own folder and gives it a registered extension, which is nowhere
among §89's ten. A refinement that contradicts its source lands in a slice or an ADR and
never in `docs/sdds/`; **Shared conventions** below states that rule and is where to read
it in full.

What separates this Feature from a paragraph about good structure is how little of the SDD
argues for itself. §8's dependency rule is `no-restricted-imports`, per directory, in
`eslint.config.mjs`; §76 asks that `domain/**` refuse `vue`, `pinia`, `konva` and
`obsidian`, and the config refuses all four in `core/`, `domain/` and `application/` —
wider than the SDD asked. §76 offered two tools and the first was taken, which is a choice
with no ADR behind it. `WRITE_BOUNDARY` in the same file catches the case the layer bans
cannot see, a vault write from a view or the composition root, and the config names the
spellings its selectors do see and the ones they cannot. Then there is the part no linter
reaches: of §92's fifteen criteria, "Konva stores no canonical business data", "vault files
remain understandable without the plugin" and "new views can reuse the same
application/domain layers" are judgements about a design, checked by reading it against a
slice. Naming which criteria are lint's and which are review's is the work here, because a
criterion nobody has assigned is a criterion everybody assumes somebody else holds.

Beneath this Feature is where the slices become work, and they now do. Each of the seventeen
is scoped to be implemented, tested and reviewed on its own, which is a `Task` in this
register's own vocabulary — engineering work with evidence, an approach and acceptance
criteria — so each carries `type: Task`, lives in `docs/tasks/` (the folder the view files a
`Task` into), and hangs from one of the five PBIs below rather than from this note directly.

**The rest of this note is what all seventeen share**, and it is here because it was
previously a `README.md` in their folder. That file is gone: a folder of backlog items whose
index is an untyped note beside them is a second place to look, and everything in it was
either about the group (which is what a parent is for) or about every slice (which is what
this note is for). What it held that frontmatter can carry — each slice's dependencies —
became a `dependsOn` list on the slice itself.

## The slice map

The seventeen slices fall into five groups, each a `PBI` under this Feature holding the
slices whose scheduling argument is the same. The groups are read off the dependency graph
rather than imposed on it.

| PBI | Slices | Character |
| --- | --- | --- |
| [Foundation and composition root](Foundation%20and%20composition%20root.md) | 1–4 | A strict chain; no parallelism inside it |
| [Plan editor and canvas](Plan%20editor%20and%20canvas.md) | 5–8 | 7 and 8 both hang off 6 and are order-free |
| [Quantity, cost and the end-to-end loop](Quantity,%20cost%20and%20the%20end-to-end%20loop.md) | 9–10 | 10 is the group's integration point |
| [Errors, diagnostics and the test harness](Errors,%20diagnostics%20and%20the%20test%20harness.md) | 11–12 | Cross-cutting, and the two differ in how |
| [Shared UI vocabulary](Shared%20UI%20vocabulary.md) | 13–17 | Mutually independent; 17 integrates them |

**Dependencies live on the slice, in `dependsOn`**, as a list of wikilinks — one per slice
that must land first. Each PBI's own note carries the reasoning that a link cannot: why
slice 9 sits in the cost group while depending only on slice 2, why slice 12's build
dependency and its completion criteria are different claims, and why slice 7's `dependsOn`
names slice 6 and not the slice 15 its recalibration branch needs.

## How to read a slice

Each slice document follows the same shape:

- **Purpose** — what this slice delivers and why it is its own bounded chunk.
- **Scope** — explicitly what is in and out, so slices don't overlap or leave gaps.
- **Dependencies** — which earlier slices and ADRs it builds on.
- **Design** — the actual architecture, derived from the SDD sections cited in
  **References**.
- **Interfaces & Contracts** — the key types, interfaces, and module boundaries a reviewer
  or implementer needs to see before writing code.
- **Persistence Impact** — what this slice reads or writes in the Vault, if anything.
- **Testing Strategy** — what must be tested, and at what level, before the slice is
  considered done.
- **Definition of Done** — a concrete, verifiable checklist, in the same spirit as the SDD's
  own MVP increment success criteria.
- **References** — the SDD sections, PRD sections, and ADRs this slice derives from.

## Shared conventions

**In these seventeen documents a bare `§N` means the SDD; `PRD §N` means the PRD.** That is
the slice half of a register-wide rule, and the rest of it — which folder each default holds
in, and why an `adrs/` citation gets no default at all — is in
[`docs/README.md`](../README.md)'s **Conventions**. What matters here: the two documents
number their own sections independently from 1, so `§39`/`§64`/`§67` (among others) name a
completely different topic in each. Always write `PRD §N` when citing the PRD from a slice,
never rely on context to disambiguate, and check the actual heading before citing a number
from memory.

These apply to every slice and are not repeated in each one:

- **Repository structure** — SDD §77.
- **Module pattern** (a domain module is self-contained: entity, ID, schema, errors, events;
  commands live under `application/commands/<module>/`) — SDD §78.
- **Public boundaries** (explicit module exports, no deep internal imports) — SDD §79.
- **Naming conventions** (singular domain nouns, verb+object commands, past-tense events,
  Get/List/Find queries) — SDD §80.
- **TypeScript rules** (`strict: true`, no `any`, no non-null assertions, prefer `unknown` +
  runtime validation) — SDD §81.
- **Entity IDs & references** (stable IDs independent of filename/title/path; UUID or ULID;
  Markdown links are navigation, never identity) — SDD §82–83.
- **The layer dependency rule** (Presentation → Application → Domain → Core; Infrastructure →
  Application Ports → Domain; enforced by lint, not just convention) — SDD §8, ADR-006.

## Shared vocabulary

Seventeen documents describing one codebase will drift on the small shared types unless one
place fixes them. Each rule below is stated once here and consumed, never restated with a
variation, by every slice. Where a slice's own examples and this list disagree, this list is
the bug report.

- **`Result` is data, not an object with methods.** Slice 2 exports the free functions
  `ok` / `err` / `isOk` / `isErr` and the `.ok` discriminant. Write `isErr(result)` or
  `if (!result.ok)`, never `result.isErr()`; write `err(...)`, never `Result.err(...)`.
- **An `AppError` is a plain, constructed-by-factory object.** Never `new SomeError(...)` —
  slice 2's categories are interfaces, and `new ReferenceError(...)` in particular resolves
  to the JavaScript global, not the domain type.
- **A domain event's discriminant is `type`**, matching slice 2's `DomainEvent<TType>`. Not
  `name`, and not `kind`.
- **Every repository port method returns a `Result`**, including reads — slice 3 declares
  that shape once and slice 4 implements it without widening any signature. "Not found" is
  `ok(null)`, never an error; an error means the read or write itself failed.
- **Units come from slice 9**, not slice 2: `Money`, `Quantity`, `UnitKind` (SDD §48's seven
  dimension kinds), `MeasurementUnit` (the concrete symbol persisted on an Asset), and
  `DerivedValue<T>`. Slice 2's `core/units/` holds only the world-unit convention.
- **`Point` is always world millimetres; `ScreenPoint` is always pixels.** They are defined
  in two different places, and the split is the point: `Point` is slice 2's, in
  `core/geometry` — core is where a world coordinate belongs and core never sees a pixel.
  `ScreenPoint` and the `worldToScreen`/`screenToWorld` pair are slice 5's, in
  `presentation/editor/viewport/`, and slice 5 **re-exports** `Point` beside them rather than
  redeclaring it (slice 5's Definition of Done says so explicitly). A second
  structurally-identical `ScreenPoint` — or a second `Point` — would silently defeat the
  brand that keeps the two apart.
- **A polygon is validated by `createPolygon`** (slice 2). A bare `Polygon` value is not
  assumed valid. `createPolygon` implements the *four* of SDD §26's six required bullets that
  are properties of a point list — ≥3 vertices, finite coordinates, no `NaN`, no `Infinity`
  (slice 2 counts these as "three rules", collapsing `NaN`/`Infinity`). The other two,
  **`valid unit` and `valid transform`, are not properties of a point list** and therefore
  cannot live in a smart constructor over one; §26 is refined here rather than dropped, and
  each has a named owner:
  - *At the editor boundary* — slice 8's "Geometry validation (SDD §26)" table. `valid unit`
    is a compile-time guarantee (a handler reads `event.worldPoint`, and `ScreenPoint` is not
    assignable to `Point`); `valid transform` falls back onto `createPolygon`'s
    finite-coordinate check, which a degenerate viewport trips.
  - *At the persistence boundary* — slice 4's schema validation, which is where §26's own
    "validate before persistence" framing actually lands and where the compile-time half of
    the editor's answer buys nothing, because the input came off disk.
- **Logging goes through the `Logger` port**, `application/ports/Logger.ts` from slice 1,
  injected from the composition root and never constructed at a call site. `event` is a
  stable dot-delimited key (`'zone.save.failed'`), `context` carries the values, and
  `error`'s context carries `cause`. Nothing outside `infrastructure/logging/` touches
  `console.*` — `no-console` is a lint error everywhere else in `src/` — and nothing under
  `domain/` logs at all: a pure entity returns a `Result` and its caller records it. Which
  level a given event takes is slice 11's table, not each slice's judgement.
- **Every user-facing string goes through `t(language, key)`** — the pure lookup that already
  exists in `src/presentation/i18n/`, with `en.ts` as the complete table `StringKey` derives
  from and per-key fallback for every other locale. A slice that needs new copy adds keys to
  `en.ts`; it does not define its own string table. This matters more than it looks: the
  English table is the file the `obsidianmd` ruleset's locale rules match, so sentence-case UI
  text is *linted* there and merely reviewed anywhere else, and
  `docs/requirements/Multilanguage.md` is a standing requirement a hardcoded literal quietly
  breaks. Callers resolve the language once from Obsidian's own `getLanguage()`; the plugin
  never grows a language setting of its own.

## Conventions a slice must conform to

The SDD is the architectural authority. Two files under `docs/setup/` are narrower but
binding in their own areas:

- **`docs/setup/vue-conventions.md`** — the component, composable and Pinia rules. It binds
  **any slice that specifies a Vue surface at all**: a component (whether or not it names an
  SFC file), a component test, a Pinia store, a composable, or the build or test wiring for
  any of them. That is a rule rather than a list on purpose. Three drafts of this bullet
  carried a list instead, and each one omitted a different slice — first slice 1, which
  installs Vue and writes the build configs; then slice 10, which specifies a Requirements
  panel and its component tests without ever naming an SFC file. A membership test applied by
  recognising which documents are *about* Vue keeps missing the ones that merely *touch* it,
  and goes stale the moment a slice grows its first component. The test errs toward
  inclusion: a slice wrongly included costs a reading, a slice wrongly excluded costs a
  defect that ships.

  **A departure is for when conforming and behaving come apart**, and it is named in that
  slice's **References** rather than left to be discovered. There are two today, both in
  slice 13 and both halves of one decision: §5's one-Pinia-per-view-app (`NotificationStore`
  is plugin-global) and §6's create-in-`onOpen`/unmount-in-`onClose` (the `NotificationHost`
  app is created in `onload()` and unmounted in `onunload()`, so the composition root knows
  it is mounting Vue). Three other candidates were withdrawn rather than declared, because
  the conforming shape turned out to be the one that behaved — the review ledger in
  `docs/reviews/` carries that history.
- **`docs/setup/quality-harness.md`** — the harness's rationale: what each gate refuses and
  why, which is the reasoning a Definition of Done should be written in the spirit of. It is
  a **build-this-from-nothing guide describing a target**, not a description of the gate as
  it stands: it specifies five steps under `npm run check` including `npm run docs`, and four
  of those five are live. There is no `docs` script — CLAUDE.md lists that register gate
  under "Deliberately absent".

  **A slice's Definition of Done is written against the four gates that exist**, which are
  `package.json`'s `check`: build, lint, `test:coverage`, analyze.

Neither is checked mechanically against these documents. That is worth stating rather than
implying: a slice conforming is a review outcome, and the conformance a slice claims in prose
is exactly as reliable as its Definition of Done makes it.

## Explicitly deferred

The SDD itself treats the following as optimizations or future work, not required foundation,
and they are out of scope for every slice:

- **Bases Integration** (§13) — custom Bases views (Budget, Schedule, Procurement, Risk) over
  the same Vault data.
- **Scheduling Architecture** (§53) — the SDD states this explicitly is "not part of the
  initial architecture core."
- **Advanced Polygon Operations** (§27, `clipper2-ts`) and **Spatial Index** (§28, `rbush`) —
  both explicitly framed as optimizations; "correctness must not depend on" the index.
- **Worker Strategy** (§63) — "do not introduce workers until profiling justifies them."

Everything from PRD Epic 8 onward — Trades & Work Packages, Task Management, Schedule,
Suppliers & Quotes, Documents/Photos, Procurement, Decisions & Change Management,
Risks/Issues, Progress & Site Documentation, Reporting, Scenarios, Existing/As-Built State,
and Plan Revisions — is feature development that builds on this foundation. It is
deliberately not sliced here.

Two boundaries. **The quality harness is not this Feature.** `npm run check`, the coverage
ratchet, the browser harness, the live-vault checks and the release pipeline are tooling
that holds the design; they are documented in `CLAUDE.md` and `docs/setup/`, and the epic
that once ranked them against the product is deleted rather than re-parented here. And the
ADRs are not backlog items either — an ADR is a decision with consequences and a
revisit-when, not a rank among siblings. A change under this Feature answers the SDD, a
slice or an ADR. Nothing here is a licence to restructure code that already satisfies all
three.

## Outcome

A structural question — which layer owns this, what may import what, what was decided
instead and what it cost — has one answer, in one place, and a violation of the layer rule
is refused by lint rather than noticed in review.
