---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 70
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

## What closes it

A test that mounts two boundaries and asserts the attribution is either correct or refused —
whichever the design chooses. Refusing is the cheaper honest answer: `EntryBoundary` can throw
on a second concurrent mount, which turns a silent misattribution into a failure at the moment
someone adds the second pane. Then the comment describes a checked rule instead of a hope.

## Why it matters

- This repository's rule is explicit: an invariant asserted in a comment gets a test that fails
  without it, and the test is watched failing. This is the clearest remaining instance in the
  code the harness added.
- A confident paragraph is evidence of intent and of nothing else — and here there are several,
  which is what makes it easy to mistake for a checked property.
