---
type: Task
parent: "[[Describe existing and planned spatial state]]"
order: 30
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Record a planned outcome without overwriting existing state]]"
---

# Compare existing and planned state from canonical records

## Evidence

M08/M09 require unchanged, remove, modify and add meanings, and the approved roadmap moves only
that Existing→Planned seam into MVP, not execution or as-built state.

## Why it matters

Persisting a comparison duplicates facts and lets it drift; inferring it from a work status
conflates independent axes.

## Approach

Derive comparison on read from canonical Existing and Planned records, including one-sided and
unreadable cases, and expose the result without adding in-progress, installed or as-built values.

## Acceptance criteria

- Equal records derive unchanged reproducibly.
- Existing-only, Planned-only and changed pairs derive the defined meanings.
- One unreadable side yields unavailable comparison, not equal.
- No comparison value is persisted as a second authority.

## Risks

An over-broad comparison could smuggle execution readiness into the state model; keep the result
limited to semantic difference.

## Outcome

Not started.
