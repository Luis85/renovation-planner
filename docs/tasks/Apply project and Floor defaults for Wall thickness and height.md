---
type: Task
parent: "[[Draw connected walls and create an enclosed room]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Apply project and Floor defaults for Wall thickness and height

## Evidence

M04 requires precise thickness and height settings, with defaults supplied by project or Floor context.

## Why it matters

Repeatedly entering common dimensions slows tracing, while hidden constants create Walls the homeowner did not review.

## Approach

Resolve explicit Floor defaults over project defaults, show the effective thickness and height in the Wall draft,
allow supported per-chain adjustment, and pass final values into the prerequisite command.

## Acceptance criteria

- New Wall drafts show their effective thickness and height.
- Floor defaults override project defaults through one documented precedence.
- Supported draft changes affect only the chain being created.
- Invalid defaults or overrides refuse Finish rather than silently substituting values.

## Risks

Persisting a draft override as a new default would change future Walls without consent.

## Outcome

Wall drawing begins with truthful reusable dimensions that remain reviewable before commit.
