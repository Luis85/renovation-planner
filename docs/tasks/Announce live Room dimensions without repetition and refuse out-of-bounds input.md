---
type: Task
parent: "[[Draw and name a rectangular room]]"
order: 60
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Announce live Room dimensions without repetition and refuse out-of-bounds input

## Evidence

M03 requires live dimensions without excessive announcements and explicit validation for numeric
input that would place the Room outside editable bounds.

## Why it matters

Rapid pointer updates can overwhelm assistive technology, while a plausible numeric value can still
produce spatially invalid geometry.

## Approach

Render live width, depth and area continuously, but announce only meaningful settled changes through a
deduplicated status channel. Validate numeric drafts against complete geometry and Floor bounds before Finish.

## Acceptance criteria

- Visible dimensions remain current throughout drag and numeric editing.
- Assistive announcements are deduplicated and do not repeat on immaterial pointer movement.
- Out-of-bounds numeric input has an explicit field or form error and cannot finish.
- Correcting the value clears the stale error while retaining the draft.

## Risks

Throttling visual updates together with announcements would make the preview lag.

## Outcome

Live Room measurements stay informative without becoming repetitive, and precise invalid input is refused clearly.

## Closing evidence

**2026-09-04**, the Add Room increment.

Criterion 1 — **visible dimensions stay current** — is reactive reads of one store: the form's
Width, Depth and Area, and the canvas sketch's two labels, all follow `rect` as the drag writes
it. Held by `tests/presentation/editor/roomDraftSketch.test.ts` and by
`newRoomInspector.test.ts`'s area and field cases.

Criterion 2 — **announcements deduplicated, and none on immaterial movement** — is the separation
of the two: the FIGURES update on every move, while the `role="status"` element carries
`settledSize`, which `settle()` writes on a drag END and on a numeric COMMIT and at no other
time. Held by `newRoomInspector.test.ts`'s 'the settled-size status changes once per drag, not
once per move'.

**That case is the increment's sharpest instrument, and its first spelling could not see the
defect it exists to catch.** As briefed, the loop fired twenty pointer moves synchronously and
awaited once — Vue batches all twenty into ONE render, so a `MutationObserver` records a single
mutation whatever the store did in between. Measured, not reasoned: with `draft.settle()` added
to `DrawRoomTool.pointerMove` — the exact defect this criterion forbids — the case still PASSED,
`seen.length` reading 1. It awaits per move now, which is the grammar a real device sends, and
under that spelling the same mutation goes red at `seen.length` while the un-mutated build reads
1. The reasoning is in the case's own docblock, so the loop is not "simplified" back.

Criteria 3 and 4 — **out-of-bounds numeric input refused with an explicit error; correcting it
clears the error and keeps the draft** — are `parseMetres`'s three refusals in
`src/presentation/editor/shell/formatLength.ts`
(`tests/presentation/editor/shell/formatLength.test.ts`), surfaced inline by
`newRoomInspector.test.ts`'s 'a refused width shows inline, keeps the text, and clears on
correction', with `valid` false — and therefore Create and Finish both `aria-disabled` — for as
long as either field holds an error.

**"Out of bounds" is NARROWED, and the narrowing is a finding rather than a shortcut.**
ADR-0017's Plan has no extent and a background is optional, so a Floor has no bounds for a
rectangle to be outside of. What is left is numeric sanity, stated once as those three refusals:
not a number, not positive, and longer than `MAX_ROOM_SIDE_MM` — 1,000,000 mm, **a kilometre**,
not a Floor's edge. `Infinity` is refused through that same `too-large` arm rather than through a
special case, which is what removed the one dead branch the plan's own snippet carried.

A refusal keeps the user's typed text verbatim rather than reverting it — slice 16's rule for
every field in this plugin — which is why criterion 4 names the draft surviving as well as the
error clearing.
