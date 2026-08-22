---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 50
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

# Validation and vault health

§90's validation, §91's vault health check and §63's reference integrity: missing references, deleted
objects, invalid IDs, duplicate IDs. It is cross-cutting because Markdown is canonical (§3.2) — the user
is *invited* to edit the vault by hand, so a broken reference is a normal state to be reported rather
than an exceptional one to be prevented.

§44's tolerant loading is the other half: an invalid note is reported and recoverable, never silently
dropped or silently rewritten.

## Outcome

A renovator can ask whether their vault is intact and get a list of what is broken and where.
