---
kind: actor
name: Professional planner
layer: human
standing: out of scope
sources: ["PRD §4", "PRD §54", "PRD §57", "PRD §58", "PRD §73"]
---

# Professional planner

Small contractors, interior designers, landscape planners, owner-side consultants, facility
managers. §4 names them a *future* persona and says plainly they are not part of the MVP.
This note exists so "not yet" is recorded somewhere other than a heading, and so a feature
argued for on their behalf can be recognised as such.

What makes them genuinely different is not sophistication — the [[Advanced DIY planner]]
covers that. It is that they work **on behalf of someone else**, on **several projects at
once**, and are **liable** for what they produce.

## What admitting this actor would change

Each of these is a stated non-goal or a load-bearing assumption, so none is a small addition:

- **Multi-user.** §57 rules out cloud collaboration and §3.1 makes local-first a principle.
  A planner and a client both editing means concurrency, permissions and a merge story the
  vault model has none of.
- **Cross-project work.** The [[Project]] is the root of the relationship model (§58) and the
  project index (SDD §47) is scoped to one. A portfolio view is a second root.
- **Liability.** §73 calls the tax model planning support and explicitly not accounting or
  tax advice; §57 rules out permitting and professional estimating suites. Someone billing
  from these numbers changes what the numbers have to be.
- **Client-facing output.** §43's exports are for the person who made them.

## What the plugin owes it today

Nothing, and saying so is the point. The obligation is negative: do not take a decision that
would be impossible to revisit if this actor is ever admitted. §60's identity model and the
layering in SDD §8 are the two that matter most, and both are already load-bearing for other
reasons.

## Sources

PRD §4 · PRD §54 · PRD §57 · PRD §58 · PRD §73, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
