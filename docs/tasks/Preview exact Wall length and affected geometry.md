---
type: Task
parent: "[[Edit a selected wall precisely]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Walls and hosted openings]]"
---

# Preview exact Wall length and affected geometry

## Evidence

M07 requires exact length entry to preview affected geometry before commit.

## Why it matters

Changing a Wall endpoint can alter adjacent boundaries, so one number cannot describe the whole consequence.

## Approach

Parse unit-aware length input into a complete draft geometry proposal. Render the Wall, connected geometry,
new measurements and any invalid relationship before enabling Finish.

## Acceptance criteria

- Exact length updates a draft and performs no persistence write.
- The preview shows every geometry item the command would change.
- Invalid or ambiguous results identify the conflict and cannot finish.
- Cancel removes the preview without changing the Wall.

## Risks

A preview based on less data than the command validates can promise a result the commit refuses.

## Outcome

The renovator sees the full spatial effect of an exact Wall length before committing it.
