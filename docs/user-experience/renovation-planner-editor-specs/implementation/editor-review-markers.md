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
