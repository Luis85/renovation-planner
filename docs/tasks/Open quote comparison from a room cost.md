---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 40
status: In Progress
horizon: "V1"
release: ""
---

# Open quote comparison from a room cost

## Evidence

M13 explicitly sends Compare quotes to a dedicated downstream view. The existing
[[Quote comparison]] feature compares each offer against the plan and owns that derived view.

## Why it matters

Quote comparison needs enough space and authority to expose scope gaps; compressing it into the
Inspector would duplicate both its model and its decisions.

## Approach

Add a route from the selected room or cost group to the quote-comparison capability, passing
authoritative spatial, work and cost references. Render only availability, summary and navigation
in the Inspector.

## Acceptance criteria

1. The action opens quote comparison with the selected room's relevant plan/work context.
2. No quote normalization, scoring, coverage arithmetic or selection state is implemented in the
   Inspector.
3. Returning from comparison restores the room selection where the host supports it.
4. An unavailable comparison route is disabled with an accessible explanation.

## Risks

- Treating a navigation summary as comparison could create competing answers.
- Context restoration depends on clear ownership between Obsidian view state and editor selection.

## Outcome

Room costs lead to authoritative quote comparison without turning the Inspector into one.

## Finalization candidate — 2026-09-07

Production source is implemented in the editor finalization worktree under [ADR-0024](../development/adrs/0024-trades-manual-schedules-and-quote-comparison.md). Canonical repositories, guarded commands and contextual Project routes are reused. Targeted tests and the unchanged combined gates are in progress; final browser and live-host acceptance remain open. See the [completion matrix](../user-experience/renovation-planner-editor-specs/implementation/completion-matrix.md).

## Amendments

**2026-09-08** — the finalization candidate landed in 59977120 (#91, ADR-0024), and this task
stays In Progress for criterion 3's host clause. Criterion 1 is
`tests/presentation/views/quoteFlow.test.ts` ('shows explicit scope gaps and keeps each offer and
currency total separate', 'creates a Supplier and a received quote, then records a separate
editable revision') reached from the Room's cost group through `DownstreamAction.vue`, with
`tests/application/navigation/projectDestination.test.ts`'s 'round trips the stable floor, Room,
Work and cost identities across host navigation' carrying the context. Criterion 2 holds by
placement: comparison, scope arithmetic and drafts live in `src/presentation/views/quotes/`, and
`tests/presentation/views/quoteCatalogueChanges.test.ts`'s 'refreshes the origin Room after its
real rename command without saving the quote' is the Inspector-side summary owning nothing of its
own. Criterion 4 is `DownstreamAction.vue` refusing a missing plan at `open()` — #91's coverage
closure removed the second copy of that guard, `destination()`, rather than driving it. Criterion
3 — *returning restores the room selection where the host supports it* — is
`tests/plugin/editorWorkspaceNavigation.test.ts`'s 'keeps the editor intact across Work and Quote
routes, including a failed host state change' against `FakeLeaf`, which records asks rather than
behaving; the host half is the H2 row of the completion matrix, unrun on the landed build.
