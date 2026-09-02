---
type: Task
parent: "[[Link planned outcomes to canonical work]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Describe existing and planned spatial state]]"
---

# Create canonical work from a planned outcome

## Evidence

M10 needs a planned outcome to hand off to work, while the Task management epic already defines
the vault-visible canonical record and contextual origin.

## Why it matters

An editor-local Work row would split status and identity from the task a renovator edits in
ordinary Obsidian.

## Approach

Extend contextual task creation to accept a Planned outcome and spatial target, dispatch one
canonical create command, and return the task identity for authoritative refresh.

## Acceptance criteria

- One confirmation creates one canonical task.
- The task stores stable Planned-outcome and spatial-target references.
- Cancellation or refusal creates no task or relationship.
- The result is readable through the task authority and ordinary vault tooling.

## Risks

Adding scheduling or trade fields here would widen the MVP into execution; only contextual
identity belongs in this task.

## Outcome

Not started.
