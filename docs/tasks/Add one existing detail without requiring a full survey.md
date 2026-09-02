---
type: Task
parent: "[[Describe what exists in a selected room]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Add one existing detail without requiring a full survey

## Evidence

M08 says existing information is incremental and its Add action is pre-linked to the selected
room. The mental model makes incomplete survey information useful rather than invalid.

## Why it matters

Requiring every surface and fixture before saving turns a quick room survey into a blocking form
and encourages users to keep the truth outside the plugin.

## Approach

Connect one homeowner-labelled existing-detail form to the canonical command and read-back path.
Keep draft state local, attach the selected stable spatial identity, and show calculated values as
derived.

## Acceptance criteria

- One valid detail can be saved while every other category remains absent.
- Cancel writes nothing; refusal keeps the last valid projection.
- A calculated measurement is labelled and not directly persisted as an editable value.
- Reload shows the detail against the same spatial identity.

## Risks

A form schema may accidentally make optional survey categories mandatory or reinterpret
unavailable capability as missing user input.

## Outcome

A renovator can improve a room survey one truthful detail at a time.
