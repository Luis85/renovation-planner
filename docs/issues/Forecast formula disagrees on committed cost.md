---
type: Issue
status: Open
---

# Forecast formula disagrees on committed cost

The received PRD (`docs/prds/obsidian-renovation-planner.md`) states two different
formulas for the same "Forecast" concept:

- **Epic 17 — Reporting & Project Cockpit, F17.3 Forecast**:
  `Actual Cost + Committed Cost + Remaining Estimate = Forecast`
- **Financial Lifecycle**:
  `Actual + Committed but not invoiced + Remaining Estimate = Estimated Final Cost`

If F17.3's `Committed Cost` is read as the full committed amount, a commitment that has
already been invoiced is counted twice — once as `Actual Cost`, once again as
`Committed Cost` — inflating the forecast. The Financial Lifecycle section's
`Committed but not invoiced` phrasing does not have this problem.

## Alternatives considered

- **Implement F17.3 literally, as received.** Rejected: produces a forecast that
  double-counts realized commitments, contradicting the more precise definition the
  same document gives under Financial Lifecycle.
- **Edit the PRD to scope F17.3's `Committed Cost` to "not yet invoiced."** Rejected:
  the PRD is received evidence and is kept verbatim per `docs/README.md`, so a note
  citing it should cite something unedited. The correction belongs here, not in the
  source document.

## Decision

Implement the Forecast calculation using the Financial Lifecycle section's
definition — `Actual + Committed but not invoiced + Remaining Estimate` — and treat
F17.3's `Committed Cost` as shorthand for that same "not yet invoiced" scope, not as a
separate, literal, full-committed-amount total.
