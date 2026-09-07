# M17 — shared Room review markers and actionable findings

Source-only WIP; current native/browser verification remains pending.

The issue-rich native capture created two real Decisions and exposed two presentation gaps:
the second 86.8-pixel finding card exceeded the visible Inspector, and the canvas used wide
per-finding text boxes. M17's interaction table distinguishes selecting a Review marker (Room
selection and readiness summary) from selecting an issue (the actual source in Renovate).
Root reconciled this with ADR-0021's issue-source entry contract and approved this correction.

## Shared presentation

`provideReviewPresentation` is created once per editor leaf after the planning provider. It
combines the existing Renovation and Planning findings, existing shared-context resolver and
existing Room summaries. No new readiness rules, queries per marker, store or vault writes are
introduced. ReviewInspector, ReviewSummary and ReviewRoomMarkers consume the same refs.

Known Rooms use deterministic ID order. Only marked Rooms receive an ordinal; the exact same
number appears in their Room row and canvas marker. Unavailable results do not create a clear
status or a numbered marker. All original findings remain in the source lists, including those
whose Room geometry/name is unavailable; record IDs are the last source-label fallback.

Marker click/tap selects and frames its Room while retaining Review, revealing Details when
constrained. The existing Back route restores prior Renovate selection/camera. Issue actions
still open the exact Decision/Work/Cost/Evidence source. Their accessible names include the
actual source record label, so two blocked Work items sharing a dependency remain distinct.
Existing/Planned/Work record markers keep their existing rendering and source routes.

## Presentation and stable verification seams

- Findings are whole native buttons with visible context and question/cause, at least 48 pixels
  high. No finding/action is hidden. The source label is used when a cause is empty.
- Duplicate selected-Room heading/attention totals are represented by the existing Room row;
  the semantic Room heading remains. Normal M00 summaries keep their previous presentation.
- A native Limited review scope disclosure keeps the qualification visible and makes the
  unchanged full scope prose available. Generated review-note content is unchanged.
- Konva group: `review-room-marker`, with `roomId` and `number` attributes.
- Room row: `data-rp-review-room`, optional `data-rp-review-number`.
- Selected summary: `data-rp-review-summary-room`.
- Native source action: `data-rp-review-issue`; visible cause: `data-rp-review-cause`.

The existing shared Work/missing Evidence test now compares Room and marker numbers; an added
case distinguishes Work sources with a common dependency. The separate coverage task owns
`reviewMarkerNavigation.test.ts`; it is not edited by this UI task. Native routing, unavailable
states, full scope disclosure, all themes and actual issue-rich pixels still need verification.

Initial typecheck passed. Whole Oxlint passed after a browser callback variable rename; scoped
ESLint then identified only Vue formatting warnings, now corrected. Existing UI-owned route
tests are updated from per-finding Review markers to the approved Room-marker contract, with
explicit nonzero counts so an empty old-selector loop cannot pass vacuously. Issue-source
assertions remain. A new browser step clears selection with native Escape, clicks the actual
marker pixels, checks Review/number/summary with no dialog, and verifies Back restores Room/
camera without writing files. This browser step and the current native batch remain pending.

## Native checkpoint — f576d13c

Current types, whole Oxlint and scoped ESLint passed. The native batch passed all 45 tests in
five files in 66.38 seconds: renovation Workflow/Overview/Routes and Planning Review/Markers.
This includes both finding families in shared Rooms, matching marker/list numbers, distinct
Work source labels, issue source routes and the updated Room-marker contract. Existing normal
planning/overview behavior remains covered. Original logs and hashes are in
[the native evidence](evidence/editor-review-markers-native/).

The actual extended four-theme browser run, issue-rich layout/marker mouse input, other screen
comparisons and uninterrupted final nine-journey run remain pending. Native green does not
declare full visual or live-host acceptance.

## Extended browser checkpoint — a89ab791

The joined run completed Light and Dark's full extended journey: actual caption/control/pin
clearance through pan and inline editing, two native Decision saves, source/cancel/Back routes,
and real mouse Room-marker selection without a dialog or file writes. Custom caption checks
also passed, but its last review-note button exceeded the Inspector bottom by 8.39 pixels.
The four-scenario run therefore failed and German was not reached; no old report is reused.

The next correction reduces Review summary spacing by two pixels and the Open-room top margin
by four pixels. Text sizes, controls, data and visibility assertions stay intact. Work findings
with a shared dependency now show the actual Work label visibly as well as accessibly; repeated
source/cause wording is deduplicated without changing any rule or source route. Current validation
of these small follow-ups remains pending. The partial images and original failure log are saved
under `evidence/editor-review-markers-browser/partial-a89`.

## Complete extended browser checkpoint — df7100b4

The complete extended planning journey passed all four scenarios (Light, Dark, Custom accent,
German at 460 pixels) on `df7100b434e864d9d93c52f180dd58529c72f8ad`, using Edge
152.0.4191.62. Session 98235 exited zero. The six native photo records retain their During
filter, date order, selected metadata and Work context through selection and resizing. Actual
Konva captions clear dimensions, pins and normal/top-clamped inline forms through native pan,
cancel and reverse pan, with unchanged fonts, text, geometry and vault contents.

Two native unresolved Decisions exercise visible issue causes, source/Cancel/Back routes and
real mouse Room markers with matching numbers and unchanged data. Full-size Inspector bounds
pass in all three wide themes; German keeps ordinary drawer scrolling and native reachability.
The fresh report, selected screenshots, axe reports, terminal log and hashes are preserved in
`evidence/editor-review-markers-browser/verified-df7100b4`. This is one complete extended
planning run, not the still-pending original nine-journey/eighteen-reference final acceptance.
