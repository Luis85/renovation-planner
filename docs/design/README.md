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
| 7 | [Calibration](07-calibration.md) | 6 | 5 | §25 |
| 8 | [Zone Editing](08-zone-editing.md) | 6 | 6 | §26–28 |
| 9 | [Quantity & Cost Engine](09-quantity-and-cost-engine.md) | 2 | 7 (part) | §48–52; ADR-010 |
| 10 | [Assets, Requirements & the End-to-End Loop](10-assets-requirements-and-the-end-to-end-loop.md) | 4, 8, 9 | 7 (part) | wiring; PRD §8, §9 |
| 11 | [Error Handling, Diagnostics & Data Safety](11-error-handling-diagnostics-and-data-safety.md) | 2 | — | §67–68, §86–88 |
| 12 | [Testing & Architecture Enforcement Infrastructure](12-testing-and-architecture-enforcement-infrastructure.md) | all | — | §69–76, §92 |
| 13 | [Notifications & Save-State Surfaces](13-notifications-and-save-state-surfaces.md) | 5 | — | PRD §67 (Autosave: Saved/Saving/Unsaved/Save Error) — not to be confused with the SDD's own §67 (Logging) |
| 14 | [Empty States](14-empty-states.md) | 5 | — | PRD §94 |
| 15 | [Modals & Confirmation Dialogs](15-modals-and-confirmation-dialogs.md) | 5, 6 | — | PRD §64 (Deletion Semantics), PRD §39 (Inspector actions) — PRD §39/§64 are unrelated to the SDD's own §39 (Sidecar Files) and §64 (Error Model) |
| 16 | [Form & Inline Validation Feedback](16-form-and-inline-validation-feedback.md) | 6 | — | SDD §59 (Inspector), SDD §64 (Error Model, applied) |
| 17 | [Presentation-Layer Error Surfacing](17-presentation-layer-error-surfacing.md) | 11, 13, 15, 16 | — | SDD §66 (Error Boundary, the Presentation half) |

Slices 7 and 8 both depend only on slice 6 and can be built in either order (the PRD's
own MVP scope needs calibration before zone measurements are meaningful, but nothing in
the architecture forces that sequencing). Slice 10 is the integration point: it does
not introduce new architecture, only wires slices 4, 8, and 9 together into the
`Zone Geometry → Area → Requirement → Cost` loop the SDD's Increment 7 describes.
Slices 11 and 12 are cross-cutting and can be worked in parallel with slices 5–10 once
slice 2 exists, since nothing later structurally depends on them — but the SDD's own
Architecture Completion Criteria (§92) are not met until they are.

Slices 13–16 are independent UI vocabulary — each defines one reusable presentation
pattern (a toast, an empty-state slot, a dialog, a field-level error) that any view can
use, and none of them depend on each other. They can be built in parallel once slice 5
(the Vue/Pinia shell they render inside) exists. Slice 17 is the integration point for
this group, the same role slice 10 plays for the domain/cost loop: it does not
introduce new UI vocabulary, it only defines the decision rules connecting slice 11's
error categories to slices 13–16's surfaces — which category becomes a toast, which
becomes an inline field error, which becomes a blocking modal, and which becomes a
persisted status badge like slice 10's `recalculationStatus`.

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
