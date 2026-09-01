---
type: Task
parent: "[[Define and compare an intended room state]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Preview planned changes before saving

## Evidence

M09 requires applicable downstream work and cost impact before a planned edit commits, while the
backlog keeps those values derived from authority-owned records.

## Why it matters

A preview based on an older draft or changed authority can falsely reassure the renovator at the
moment they save.

## Approach

Compute a non-persistent impact preview for the current planned draft, including affected
authority-owned work and cost summaries. Invalidate and recompute it whenever the draft, target or
source inputs change.

## Acceptance criteria

- The preview appears before save where downstream work or cost is affected.
- It names the inputs and authority behind each summary.
- Changing the draft or any source marks the prior preview stale immediately.
- A stale, unavailable or failed preview cannot be presented as current.
- Cancelling or previewing writes no planned, work or cost record.

## Risks

Cached preview results may survive input changes or be mistaken for committed estimates.

## Outcome

The renovator sees a current, explicitly provisional consequence of a planned edit before saving.
