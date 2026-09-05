# Verification plan and evidence

## Checks performed for this package
- Eight English screen specifications each embed their corresponding original mockup.
- Corrected P02/P04 images are retained, not rejected intermediates.
- Original dark/narrow images were visually inspected during design work.
- English document links, image mapping, and ZIP integrity are checked before delivery.
- The separate repository reconciliation records a code review pinned to its stated commit. Translation itself does not refresh that review.

Not performed: plugin implementation, browser/Obsidian render testing, automated functional suite, contrast measurement, screen-reader testing, or user study. Designed/scoped does not mean ready, tested, or shipped.

## Required implementation checks
| ID | Scenario | Expected result | Level |
| --- | --- | --- | --- |
| T01 | Open project row | Project details, not editor | Component + integration |
| T02 | Resume valid plan ID | Correct plan/project | Integration + Obsidian |
| T03 | Last plan missing | Explanation, remaining plans, no redirect | Integration + Obsidian |
| T04 | Index incomplete | Loading, not gone | Query/store |
| T05 | Target read failure | Error, not deletion claim | Query/store |
| T06 | Search has no matches | Retain input; deliberate prefilled creation | Component |
| T07 | List → detail → back | Search, scroll, meaningful focus | Integration + Obsidian |
| T08 | Hide/show guidance | Core access and focus retained | Component |
| T09 | New project | Note accessible without plan | Integration |
| T10 | Draft 46.50, usable price 49.90 | 49.90 remains until confirmed success | Component + command |
| T11 | Price write fails | Input retained; no success | Command/store |
| T12 | Price saved, refresh fails | Saved and stale distinguished | Store/integration |
| T13 | Clear override | Only project price removed; catalogue unchanged | Command/persistence |
| T14 | Parallel change | Conflict, not blind overwrite | Integration |
| T15 | Project removed during form | Consistent form/gone policy | Integration + Obsidian |
| T16 | Multiple leaves/navigation | No subscription leaks/stale responses | Integration |
| T17 | Light/dark/custom theme | Readable values, focus, warnings | Render + Obsidian |
| T18 | 460/360 px, long German copy, 200% zoom | All supported actions usable | Render + Obsidian |
| T19 | Keyboard/screen reader | Labels, order, focus, announcements | Manual |
| T20 | Narrow desktop price editing | Field and Apply accessible | Render + desktop Obsidian |
| T21 | Mobile reading | Read-only scope, no misleading write controls | Obsidian Mobile |
| T22 | English/German price input | Defined normalization; canonical storage | Unit + component |
| T23 | New project with duplicate name | Navigate via returned ID, exactly once | Integration |
| T24 | Save pending / leaf close | Actual host behavior documented; no false rollback promise | Integration + Obsidian |

Fixtures: 0/1/3/30 projects, long names, 0/1/multiple plans, unreadable subsets, validated/unvalidated saved context, same/different currencies, saved/no override, zero price, orphan/unreadable assets. Data is fictional.

## Visual QA
Compare reference and actual screenshot at comparable width/state: order, spacing, wrapping, contrast, focus, scroll boundaries, visible actions. Do not confuse image raster size with CSS pixels. Host/OS chrome is not plugin UI to reproduce.

Original images illustrate German localization. English documentation and the [UI copy table](../ui-copy.md) define intended text. Test English rendering independently; keeping a German reference image does not verify English layout.

## Formative user evaluation
Ask relevant private renovators to start a garden project without a plan, resume after a break, choose another plan, set a project material price, and recover from a missing plan. Observe first click, detours, understanding of Open/Resume/project price, and return-path discovery. Record observations rather than deriving results from the design.

## Known clarifications
- P00 shortcuts are illustrative; ship only implemented, host-compatible shortcuts.
- Preserve Asset library access.
- First draft without saved override has no Clear action.
- P04 uses “Back to project”; “Remove project price” avoids promising an unusable catalogue fallback.
- Dark/narrow images are examples, not every combination of states.
- Measure breakpoints and contrast only after real rendering.
- Narrow desktop editing is distinct from mobile reading.

