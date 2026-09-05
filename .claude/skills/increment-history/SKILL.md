---
name: increment-history
description: Use when you need the recorded history behind a module's shape - what a design slice or increment landed, what it withdrew or narrowed rather than ticked, or what a review round already found. Read it before proposing structure in an area a slice has already touched, when a comment or docblock cites a slice number, when investigating why a guard, fake, or invariant exists, or when a defect looks familiar and you want to know whether this repository has already paid for it.
---

# Increment history

The full record lives in
[`docs/development/agent-guide-increment-history.md`](../../../docs/development/agent-guide-increment-history.md).

It was extracted from `CLAUDE.md` so it loads on demand rather than in every session. The rules
that govern work *today* stayed in `CLAUDE.md`; this is how the code got that way.

## What is in it

One section per slice or increment, in the order they landed:

- **Design slices 8, 10, 11, 13-21** - the tool framework and editable canvas, the closed
  quantity/cost loop, the error boundary and guard category, the notice door and save-state
  indicator, empty states, the dialog framework, forms and inline validation, the error-surface
  policy, the project folder, the vault-wide Asset catalogue, and the project detail state.
- **Later increments** - the currency invariant, the per-project price override, the asset
  designer, both plan-editor-foundation increments (read path and selection; Add Room), the
  undo/redo publishing boundary, and Renovation Planner Home.
- **Canvas navigation** - the largest single section, and mostly defect post-mortems: pointer
  grammar, chorded buttons, gesture ownership, held-key races, and interruption doors.

## How to use it

Grep it for the slice number, the module name, or the invariant you are about to change. Do not
read it end to end - it is ~360,000 characters.

Its recurring lessons are the reason it exists: a partial fix reads exactly like a complete one;
a fake must not be kinder, thinner, harsher or faster than the real thing; a rule stated in a
docblock is a rule some door is not following; a count written in prose is a count nothing
re-runs; and "the class is closed" is a claim that needs an instrument like any other.
