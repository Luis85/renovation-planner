---
type: Issue
parent: "[[Shared UI vocabulary]]"
order: 60
status: New
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Two project-view regions are verified by no instrument

Accepted knowingly during the slice 11/14 polishing pass, which built both regions and
closed half of the gap rather than all of it.

## The question

`ViewRoot.vue` gained two regions in that pass. `.rp-view-message` carries the mapped
failure sentence (`trError(store.error)`) or the loading line; `.rp-view-notice` carries the
partial-read warning when `unreadable > 0`. Before them, any status but `'ready'` drew an
empty `<div>` and `store.error` was read by nobody.

Neither region is reachable by the instrument that measures appearance. `npm run harness`
draws the project surface at its bare root, but the harness mounts `makeView()` with the
default query bundle, which resolves to a readable, empty vault — so `failed` and
`unreadable > 0` cannot be reached there at all without a URL knob, and the pass deliberately
did not add one.

Half the accessibility gap was closed and half was not, and the half that remains is a
different mechanism rather than an oversight. `.rp-view-message` is now scanned:
`tests/harness/accessibility.test.ts` mounts the refusing bundle, awaits `flushPromises()`,
runs axe against `view.contentEl` and asserts the region is actually present in the scanned
DOM. `.rp-view-notice` is scanned by nothing.

## What is true today

- The failure region's case was watched failing — the region removed from the template reds
  it on the presence assertion, not on a violation — so it is load-bearing rather than a scan
  of a subtree that happens to be clean.
- The presence assertion exists because the alternative already bit this repository once: a
  slice 14 case scanned one tick early, found zero elements under any rule bucket, and passed.
  A pass true of an empty subtree is indistinguishable from a pass on a compliant one.
- `.rp-view-notice` is a `<p role="status">` — a valid role for that element, and the same
  construct `PlanEditorRoot` already ships under a graded scan. The residual risk is its
  position in the reading order, not the role.
- `styles/view.css` styles the notice as a strip beneath a list (`border-top`, secondary
  background). There is no list yet, and in the all-notes-refused case the notice is the only
  thing in the pane, so the treatment is correct for slice 17 and slightly odd today.

## Why no gate saw it

jsdom lays nothing out, so the whole class — centring, wrapping, overflow, contrast, hit
size — is outside every automated instrument this repository has. `npm run harness-shot`
reads by eye and is the only one that reaches it; it was not run against these states because
it cannot be pointed at them.

## Alternatives weighed, and why they were not taken

- **A harness URL knob** (`?state=failed`, `?unreadable=3`) reaching both states. Rejected in
  the pass on scope: it widens the harness's own surface, and a polishing pass closing eight
  named defects is the wrong place to add an eighth entry point to a tool. It is the obvious
  candidate when this is picked up, and it would close the appearance half for both regions
  at once.
- **A second accessibility fixture for the notice.** Not rejected on merit — deferred. It
  needs its own mount, because the notice sits inside `<template v-if="status === 'ready'">`
  and the message is its `v-else` sibling: one mount structurally cannot render both. That is
  a second case, not a second assertion in the existing one.
- **Folding the two regions into one so a single fixture covers both.** Rejected on design:
  the notice is *additive* — it sits beside whatever loaded and must not replace it, because
  suppressing four readable projects to report a fifth unreadable one is the failure the
  partial listing exists to avoid. The message *replaces*, because there is nothing to sit
  beside. Collapsing them would trade a real distinction for test convenience.
- **Leaving the spec's claim standing.** The design document asserted that
  `tests/harness/accessibility.test.ts` grades these regions. It did not, and the sentence was
  narrowed in the same pass rather than left to read as settled.

## Why it matters

- The partial-read notice is the copy for the state the whole `listAll` behaviour change
  exists to serve. A user whose project notes cannot be read sees this region and nothing
  else, and how it reads is verified by no one.
- `npm run test-build` in a live vault is currently the only way either region's appearance
  is ever looked at, and nothing schedules that for these two states.

## What closes it

Not designed here. The two halves are separable and can be taken separately: a harness knob
for appearance, a second fixture for the notice's accessibility. Whoever takes the first
should decide whether the knob belongs to this view or is a general "drive the view into a
named state" facility, since the Plan Editor has the same unreachable-state problem.

## References

- `src/presentation/views/ViewRoot.vue` — the two regions and the `v-if`/`v-else` structure
  that makes one mount unable to hold both.
- `tests/harness/accessibility.test.ts` — the failure-state case, its `flushPromises()` and
  its presence assertion.
- `styles/view.css` — `.rp-view-message` and `.rp-view-notice`.
- `docs/superpowers/specs/2026-08-27-slice-11-14-polish-design.md` — amendment 2, which
  records the claim this note is the residue of.
- [[Prototype a screen in the harness before it is built]] — the PBI that owns the harness and
  the URL knob the appearance half would need.
- [[Nothing checks the harness index for accessibility]] — the same shape, one surface over,
  and closed.
