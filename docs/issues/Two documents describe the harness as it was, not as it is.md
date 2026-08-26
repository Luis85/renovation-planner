---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
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

# Two documents describe the harness as it was, not as it is

Documentation residue from building the prototyping harness — small, and filed because this
repository treats a stale guarantee as the same defect as an unchecked comment.

## The question

Two statements went stale when the harness landed and nothing fails because of it:

1. **[[Prototype a screen in the harness before it is built]]**, in its assumptions, says a
   template-only SFC is a valid Vue component *"unverified against this repository's exact
   toolchain because `node_modules` was not installed when this note was written"*. It is
   verified now: `src/prototypes/ZonePanel.vue` is template-only, mounts, composes a real
   component and a sibling mock, and is asserted by the suite. The assumption is a fact and
   should read as one.
2. **`CLAUDE.md`'s Architecture section** draws the layer diagram and states the import rules,
   and does not mention `src/prototypes/` — which has its own per-layer `no-restricted-imports`
   ban (no prototype module may compose a built chunk) plus a bundle scan enforcing the same
   thing after the fact. A reader of that section learns the layering and not the one directory
   inside `src/` that is outside it.

## What is true today

- Both are documentation-only. No code depends on either sentence, which is precisely why
  neither was caught by a gate.
- The prototypes ban is real and doubly enforced; only its *description* is missing from the
  place a reader looks for import rules.

## What closes it

Retensing the assumption to a verified statement with the file that verifies it named, and one
line in the Architecture section placing `src/prototypes/` — what it may import, what refuses
it, and the pointer to `src/prototypes/README.md`.

## Why it matters

- A requirement note carrying an assumption that has since been settled invites the next reader
  to re-settle it.
- The architecture section is the one place a contributor reads before adding a directory.
  A layer that exists in the tree and not in that section will be discovered by a failing lint
  run, which is the expensive way round.
