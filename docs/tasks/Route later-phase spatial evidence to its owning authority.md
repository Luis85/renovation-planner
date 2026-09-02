---
type: Task
parent: "[[Capture and retrieve evidence from spatial context]]"
order: 70
status: New
horizon: "V1"
release: ""
---

# Route later-phase spatial evidence to its owning authority

## Evidence

M14 lists Hidden services and Before, During and After phases, while this PBI explicitly excludes
execution completion evidence, site-log chronology and as-built handover. Those semantics belong
to [[Progress and site documentation]] and [[As-built documentation]].

## Why it matters

Showing unsupported phases as empty would claim the authority was queried and found nothing;
implementing them locally would create a competing execution or as-built model.

## Approach

Define capability results for phase filters and capture actions that distinguish available,
unavailable, deferred, empty and failed. Route Hidden services and other execution or as-built
requests to their named canonical later authority when present; otherwise explain the deferral
while keeping basic V1 evidence usable.

## Acceptance criteria

1. Hidden services identifies its canonical later authority and is never represented by a
   fabricated empty evidence result.
2. During, After, completion and as-built actions route to their owning capability or show a
   specific deferred/unavailable state.
3. Basic V1 document, photo and note links remain readable when later authorities are unavailable.
4. A failed later-authority query is distinct from unavailable, deferred and authoritative empty.
5. No execution status, completion evidence or as-built state is persisted by the V1 evidence
   shell.

## Risks

- A generic empty state could erase the distinction between no records and no authority.
- Naming phases without ownership could quietly expand V1 into execution tracking.

## Outcome

Later-phase evidence requests are handed to their canonical authority or deferred explicitly,
without weakening the truthful V1 evidence shell.
