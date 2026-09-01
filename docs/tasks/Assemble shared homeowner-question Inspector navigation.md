---
type: Task
parent: "[[Inspect a selected room]]"
order: 40
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Assemble shared homeowner-question Inspector navigation

## Evidence

M00 requires one selected-Room Inspector to combine transformation summary and homeowner-question
navigation. The component contract fixes What's here, What will change and What needs doing as
the three primary routes and says `TransformationSummary` is not navigation when those routes are
present.

## Why it matters

Independent destination lists make the Inspector repetitive and let summary state disagree with
the route that owns the detail.

## Approach

Assemble the shared `HomeownerQuestionNav` inside the selected-Room Inspector from capability-aware
route descriptors. Keep `TransformationSummary` as a compact Existing → Work → Planned narrative
that reports state but does not duplicate active destinations or controls.

## Acceptance criteria

- The selected-Room Inspector exposes What's here, What will change and What needs doing in the
  canonical order.
- Every available route preserves the selected Room stable ID and viewport.
- Empty, unavailable, unreadable and attention-needed route states are distinct and use
  authority-owned summaries.
- The same navigation content is reused in full Inspector and constrained drawer layouts.
- `TransformationSummary` presents a compact Existing → Work → Planned narrative without links,
  buttons or repeated destination labels already owned by `HomeownerQuestionNav`.
- Keyboard focus enters the navigation predictably and returns meaningfully when a child view
  closes.
- Adding a future linked-content section does not create a second homeowner-question navigation
  model.

## Risks

The summary may become a second navigation surface, or full and constrained Inspectors may fork
their route availability logic.

## Outcome

The selected Room has one reusable homeowner-question navigation surface and one complementary,
non-duplicative transformation summary.
