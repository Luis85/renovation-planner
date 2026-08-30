---
type: Epic
order: 30
status: ""
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
release: "[[MVP]]"
---

# Project management

Everything else in this backlog needs something to hang from. The domain model in PRD §6 makes
Project the root, and PRD §83 puts on it the things every downstream calculation reads: the
currency, the unit system, the tax defaults, the contingency and the folder layout. A Plan
with no Project has no units to be measured in; a cost item with no Project has no currency
to be priced in. This epic is that root, and it exists so the other nineteen can assume one
rather than each inventing a place to keep it.

It is also the whole of what a first-time user sees. PRD §93's onboarding and PRD §94's empty states
land here, and PRD §95's example project is how somebody decides in two minutes whether this tool
is for them.

The boundary worth naming: PRD §12's project dashboard is *this* project's status and the way in
to its parts. Forecasting, health scoring and anything aggregating across the whole domain is
[[Reporting and project cockpit]], and putting it here would build that epic twice.

Derived from PRD §12 (Epic 1), with the settings model from PRD §83 and the folder layout
from PRD §36.

## Definition of done

An item beneath this epic is done when:

- The Project note carries the settings PRD §83 assigns to project scope — currency, units, tax
  defaults, contingency, project folder — and downstream code reads them from the Project
  rather than from a plugin default. A figure shown in the wrong currency is not a rounding
  difference.
- Every folder path is configurable (PRD §36) and every user-supplied path passes through
  `normalizePath`. That one is a marketplace rejection as well as a bug.
- Status, budget and date range are frontmatter a human can read and edit in any editor,
  because PRD §44's portability requirement says the vault stays useful without the plugin.
- A Project note renamed, moved or edited outside the plugin is picked up rather than
  overwritten (PRD §65).
- Opening a vault with no project shows something that says what to do next (PRD §94), not an
  empty pane.
