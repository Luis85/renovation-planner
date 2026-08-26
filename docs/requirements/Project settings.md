---
type: Feature
parent: "[[Project management]]"
order: 20
status: ""
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

# Project settings

**Changing the project folder refuses a path that equals, contains or sits inside the library
folder** — §83's overlap rule, which this feature has to honour because it owns the only flow that
changes an existing project's folder. It is not a formality: deleting a project is deleting its
folder, so a project folder moved to sit around the library would take the shared [[Asset]],
[[Supplier]] and [[Trade]] catalogues of every other project with it. [[Start a renovation project]]
states the same refusal for creation, and [[Settings and configuration]] for the library's own move;
this is the third of the three places a path is set.

§83 divides configuration in two, and this is the project half: currency, unit system, tax
defaults, contingency, lifecycle configuration and the project folder. Every one of them is read
by something downstream, so they are project data rather than preferences — two projects in one
vault may legitimately disagree about all six. The plugin half of §83 belongs to
[[Settings and configuration]] under [[Cross-cutting concerns]].

## Outcome

A project states its own currency, units, tax and contingency, and every figure the plugin shows
for it obeys them.
