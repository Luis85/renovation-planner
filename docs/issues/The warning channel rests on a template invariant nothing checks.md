---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 70
status: Done
started: 2026-08-26
finished: 2026-08-26
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# The warning channel rests on a template invariant nothing checks

An invariant asserted in a comment, in the file the whole harness index is built from.

## The question

`tests/harness/IndexPage.vue` routes Vue warnings to the mount that raised them through
module-level state — `warningOwner`, published by the live `EntryBoundary` and read by the
warning handler, because a warning has no per-mount channel of its own the way an error does.

That works because **at most one `EntryBoundary` is ever alive**: the template mounts it inside
a single `v-else-if` Suspense, so there is exactly one, and `generation` keys it so a
navigation tears it down and builds a new one. The invariant is stated in the comments, at
length and correctly.

Nothing checks it. A second entry pane — a side-by-side comparison view, which is a plausible
thing to want from a prototyping harness — would put two boundaries in the tree, and the
second one's `onMounted` would silently take ownership of the first's warnings. No error, no
failing test; warnings would simply be attributed to the wrong entry.

## What is true today

- The comments are accurate, and the fix rounds that produced them (particularly the
  `generation` key replacing an entry-id key) closed real defects.
- Every existing test drives one boundary at a time, so the suite would go on passing through
  the change that breaks it.

## What closed it

`tests/harness/entryBoundary.test.ts`, checking the invariant where it lives — the template
mounts `<EntryBoundary` exactly once — plus a counter in `IndexPage.vue` that reports through
`console.error` when two are ever mounted at once, which is the channel `harness-shot` exits
non-zero on. Both watched failing: a second boundary added to the template reds the source
check AND fires the counter.

**Writing it corrected the file it was written for, which is the part worth keeping.** The
first version asserted that a second mounted `IndexPage` trips the counter, on the strength of
the comments calling `warningOwner` "module state". It does not, and it should not: a
`<script setup>` block's top-level bindings run inside `setup()`, so `warningOwner`, the
counter and `mountedGeneration` are per mounted page, not per module. Two indexes are two Vue
apps with two `warnHandler`s and cannot misattribute to each other at all — the scope is right,
and only the description of it was wrong. `IndexPage.vue` says per page now, in both places
that made the claim, and a case pins that the second index is not reported as a defect.

That also settles what the counter can and cannot be tested for: the only way to hold two live
boundaries is a template that mounts two, so the `> 1` arm has no committed test and the
template check is what keeps it unreachable. The counter is the defence for the change a source
scan cannot describe — a `v-for`, a second `<Suspense>` branch, a boundary moved into a child.

**One unrelated defect fell out of the same work.** The shared `openIndex` settled for a fixed
number of flushes, which is not enough for a cold dynamic import of a real `.vue` file: the
caller got a page still mid-`open()`, showing `Pick an entry.` It waits for a resolved state
now, bounded. This is not a flake — whichever file imported that component earlier made the
same helper work, so the identical line passed in one suite and failed in another for a reason
neither file could see.

## Why it matters

- This repository's rule is explicit: an invariant asserted in a comment gets a test that fails
  without it, and the test is watched failing. This is the clearest remaining instance in the
  code the harness added.
- A confident paragraph is evidence of intent and of nothing else — and here there are several,
  which is what makes it easy to mistake for a checked property.
