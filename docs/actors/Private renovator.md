---
kind: human
name: Private renovator
standing: primary persona
sources:
  - PRD §1
  - PRD §3.5
  - PRD §4
  - PRD §5
  - PRD §52
type: actor
---

# Private renovator

The person the product is for: someone renovating their own house, apartment, garden or
outdoor space, or building a small extension. They are not a construction professional, they
are not paid to plan, and the renovation is one of several things going on in their life.
§4 lists what they plan; §5's journey — create, import, calibrate, define, place, assign,
estimate, cost, schedule, execute, document — is the whole arc of what one of them does here.

Their job to be done, in §4's own words: *when I renovate my house or property, I want to
visualize all planned measures spatially and connect them to costs and tasks, so that I
always understand what must be done where, how much it costs, and how far the project has
progressed.*

What follows from that, and what §3.5's progressive complexity exists to protect, is that
they arrive knowing almost nothing about the model. They do not know what a
[[Construction section]] is, they will not distinguish a [[Requirement]] from a
[[Procurement item]] until the difference costs them money, and they will abandon the plugin
rather than learn a schema. Every concept in `entities/` has to be earnable in the order
§5 introduces it.

## What it does to the plugin

- Draws on a [[Plan]], which is where geometry originates — §3.4 has planning follow from
  geometry rather than from a form beside it.
- Edits the vault by hand, outside this plugin, and is entitled to. That path is the actor
  [[Another editor on the vault]], but it is usually this same person.
- Invents vocabulary. §84's custom types exist because a renovator's word for a kind of
  [[Zone]] or a kind of [[Trade]] is as valid as the plugin's, and has to survive a
  read-and-write round trip unchanged.
- Abandons a project part-way and returns months later, so the vault has to still make sense
  read as plain Markdown.

## What the plugin owes it

- An answer to *what must be done where, what does it cost, how far along is it* — §52's
  success criteria, which is a different product from a drawing tool.
- Data in Markdown they own, readable and useful without this plugin installed (§3.2, §41).
- Never silently overwriting something they typed (§65).
- A first run that does not require understanding the model first (§93, §94, §95).

## Sources

PRD §1 · PRD §3.5 · PRD §4 · PRD §5 · PRD §52, in
[`docs/product/prds/obsidian-renovation-planner.md`](../product/prds/obsidian-renovation-planner.md) and
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
