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

§83 divides configuration in two, and this is the project half: currency, unit system, tax
defaults, contingency, lifecycle configuration and the project folder. Every one of them is read
by something downstream, so they are project data rather than preferences — two projects in one
vault may legitimately disagree about all six. The plugin half of §83 belongs to
[[Settings and configuration]] under [[Cross-cutting concerns]].

## Outcome

A project states its own currency, units, tax and contingency, and every figure the plugin shows
for it obeys them.
