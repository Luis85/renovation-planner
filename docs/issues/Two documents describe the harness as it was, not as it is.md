---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 60
status: Done
started: 2026-08-26
finished: 2026-08-26
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
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

## What closed it

The assumption is a fact and reads as one, naming `ZonePanel.vue` and the two suites that drive
it. The Architecture section gained a bullet placing `src/prototypes/` — what may import it
(nothing), what refuses it (a per-layer ban plus a bundle scan of the real build), and that its
CSS is not exempt from anything.

Two more passages had gone stale in the same week and are corrected here rather than filed
again, since they are the same defect:

- the accessibility paragraph named `mountHarness` and the Plan Editor as the surfaces axe
  runs against, and the index is scanned in three states now;
- the testing section said `tsconfig.json` covers `src/` only "except one file", and there are
  two entries now — the second, `tests/harness/**/*.vue`, being about scope rather than proof.

## Why it matters

- A requirement note carrying an assumption that has since been settled invites the next reader
  to re-settle it.
- The architecture section is the one place a contributor reads before adding a directory.
  A layer that exists in the tree and not in that section will be discovered by a failing lint
  run, which is the expensive way round.
