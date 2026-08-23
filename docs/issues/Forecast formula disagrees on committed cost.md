---
type: Issue
status: Open
order: 10
parent: "[[Architecture and Software Design]]"
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Forecast formula disagrees on committed cost

The received PRD (`docs/prds/obsidian-renovation-planner.md`) states two different
formulas for the same "Forecast" concept:

- **PRD §28 — Epic 17, Reporting & Project Cockpit**, under its `Forecast:` block:
  `Actual Cost + Committed Cost + Remaining Estimate = Forecast`
- **PRD §33 — Financial Lifecycle**, under its own `Forecast:` block:
  `Actual + Committed but not invoiced + Remaining Estimate`

(An earlier version of this note cited the first as "F17.3". No such identifier exists:
Epic 17 lists its features as an unnumbered bullet list — *project health, budget
overview, forecast, upcoming work, procurement overview, project summary* — so a
feature-number citation resolves to nothing and cannot be checked against the source.
Both sites are cited by PRD section number instead, per `docs/tasks/README.md`'s rule
that a PRD citation is written `PRD §N` and checked against the actual heading.)

If §28's `Committed Cost` is read as the full committed amount, a commitment that has
already been invoiced is counted twice — once as `Actual Cost`, once again as
`Committed Cost` — inflating the forecast. §33's `Committed but not invoiced` phrasing
does not have this problem.

## Alternatives considered

- **Implement §28's formula literally, as received.** Rejected: produces a forecast that
  double-counts realized commitments, contradicting the more precise definition the
  same document gives in §33.
- **Edit the PRD to scope §28's `Committed Cost` to "not yet invoiced."** Rejected:
  the PRD is received evidence and is kept verbatim per `docs/README.md`, so a note
  citing it should cite something unedited. The correction belongs here, not in the
  source document.

## Decision

Implement the Forecast calculation using PRD §33's definition —
`Actual + Committed but not invoiced + Remaining Estimate` — and treat §28's
`Committed Cost` as shorthand for that same "not yet invoiced" scope, not as a
separate, literal, full-committed-amount total.

## Where this gets applied

Nothing in the sliced foundation computes a Forecast: the cost rollup this decision
governs is feature work (PRD Epic 17), and `docs/tasks/README.md` puts everything from
Epic 8 onward outside the slices. What the foundation does supply is the shape the rollup
will be built on, so the two places to check when it arrives are named here rather than
left to be rediscovered:

- **`docs/tasks/09-quantity-and-cost-engine.md`** — the Cost Pipeline, which produces
  `Estimated Cost` only. `Actual`, `Committed` and `Invoiced` are cost *types* that
  slice 09 does not model, so the rollup adds them rather than reinterpreting anything
  slice 09 computed.
- **`docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`** — the cost-event
  family and its reserved `CostChangePayload` (`costType`, `scope`, `currency`). That
  `costType` is the field this decision constrains: a rollup subscriber summing
  `committed` events has to sum the not-yet-invoiced subset, and the payload exists so
  it can tell them apart without reading four unrelated event shapes.

Both slices point back at this note, so the resolution is reachable from either end.
