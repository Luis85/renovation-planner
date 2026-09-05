---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 20
status: New
started: ""
finished: ""
horizon: "MVP"
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
---

# Return to the project list with my search context

A renovator with thirty projects filters to the one they want, opens it, finds it is not the one,
and comes back to an empty filter and the top of the list. They type the same query again.

The list is a launcher whose whole argument is that finding a project costs one gesture. Losing the
filter on every return means the gesture is paid twice for any trip that does not end in the right
project — which is exactly the trip a filter exists to shorten.

## Why this is not a defect

Nothing broke. `RenovationProjectView` remounts its whole Vue tree per navigation, deliberately:
which project is open lives in Obsidian's own view state, and the remount is what makes a stale
selection unrepresentable rather than something a watcher has to keep fresh. The filter, the
`Completed` group's expansion and the scroll position are held in the tree that is torn down, and
the Home design spec priced that loss where it was taken. This item is the decision to pay for
them back, not a report that they were dropped by accident.

## Actor

A renovator, in a vault with enough projects that the filter is the way they navigate.

## Main flow

1. The renovator types a query into the filter, and the count line becomes a ratio.
2. They expand `Completed`, or leave it collapsed.
3. They open a project from the filtered rows.
4. They use the project's detail state.
5. They return to the list — by the in-pane back control or the pane's own back arrow.
6. The filter still holds their query, the `Completed` group is as they left it, the list is
   scrolled as it was, and focus is on the row they opened.

## Extensions

- **6a. The row they opened no longer matches the query**, because the project was renamed while
  they were in it. Focus moves to the filter, never to an unrelated row, and the list draws what
  the query now matches.
- **6b. The row they opened no longer exists.** Same answer as 6a: focus to the filter. The list
  does not select a neighbour on the user's behalf.
- **6c. The query now matches nothing.** The no-match state draws, with the query intact so it can
  be corrected rather than retyped.
- **6d. A second leaf is open on the same view.** Each leaf keeps its own query, its own expansion
  and its own scroll. One leaf's filter never appears in another.
- **6e. Obsidian is restarted.** Nothing is restored. This item restores context across a
  navigation within a leaf's life, and durable persistence is a separate decision with a separate
  cost.

## Guarantee

**A return to the list never silently changes which projects the renovator can see.** Whatever
survives the trip and whatever does not, the rows drawn on return are the rows the visible query
matches — so a restored filter is visibly a filter, and a lost one is visibly an empty field, and
neither can be mistaken for a vault that changed.

## Acceptance criteria

- Filtering, opening a project and returning leaves the filter's value, the `Completed` group's
  expansion and the scroll offset as they were, with focus on the opened row.
- Renaming the opened project so it no longer matches, then returning, puts focus on the filter and
  leaves the query visible.
- Two leaves on this view hold two independent queries; typing in one changes nothing in the other.
- Reopening the pane after an Obsidian restart draws an empty filter and the full list.

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-01 and its §1 rows on navigation and search state; screens P00 and P06;
`docs/user-experience/archive/renovation-planner-home-DESIGN-SPEC.md` §7 (the filter and the
keyboard model) and §4 (the remount, recorded there as out of scope).
