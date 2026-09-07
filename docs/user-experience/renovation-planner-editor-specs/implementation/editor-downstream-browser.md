# Downstream browser acceptance

**Preliminary integration evidence, not final visual or release acceptance.** The four-scenario
downstream browser journey passes. The current production header and Quote form still need the
visual corrections recorded below, and the final combined gate and nine-journey/eighteen-image
acceptance remain open.

The final runner retains its original eight journeys and all eighteen image comparisons, adding
a ninth journey for the M10 and M13 downstream requirements. Its native interaction path
starts with a Room, Existing/Planned facts and a Work item created through the editor, then opens
Project Work outside the Inspector. It creates a Trade, previews and applies responsibility and
manual dates, verifies Undo/Redo, and returns to the same Room. From Costs it creates two Suppliers
and received quotes covering the same Work, compares their separate totals, creates a separate
draft revision while retaining both received originals, and returns without changing the room's
spending facts.

The opt-in `&reference&planning&downstream` adapter reuses the connected reference workspace vault and metadata. One
production composition root provides both editor and Project services and notifications after
initial fixture seeding. Both initial `PlanEditorView.setState` and `onOpen` wait for seeding and
the index scan because `setState` itself can mount the editor. Native view state parsing and
context arrival remain the navigation path. The editor instance remains mounted while the Project
surface is visible; before/after Room dimension bounds and selection identify camera/context loss.

The browser adapter supplies only host leaf construction/reveal behavior. It cannot establish
actual Obsidian leaf/history, real MetadataCache timing or native host restart behavior. Those
observations remain separate from this browser evidence.

`tests/harness/downstreamWorkspace.ts` constructs production view dependencies from that root.
The browser leaf adapter constructs a Project view on its first native view-state write; the
existing FakeLeaf forwards all subsequent writes to the real view. Native `navigateToProject`
and `revealPlanEditor` retain their production selection, serialization and arrival behavior.
The adapter only switches container visibility and disposes mounted views and subscriptions on
page hide. It does not assign editor stores or fabricate schedule, catalogue or comparison rows.

## Verification on 2026-09-07

- `node scripts/editor-downstream-check.mjs`: all four scenarios passed (1440px light/dark,
  1000px custom accent, 460px German; all 900px high). Edge 152.0.4191.62 was explicitly selected
  with `RP_CHROMIUM_EXECUTABLE`; this is not the pinned Playwright Chromium or an Obsidian host.
- Sixteen visible-surface axe scans reported zero violations. Four Quote preview scans contain
  an incomplete color-contrast check for a paragraph partially covered by the dialog. This is
  recorded rather than interpreted as screenreader or complete accessibility acceptance.
- Native Work/Trade assignment, manual dates, Schedule Undo/Redo, Supplier creation, two received
  quotes with one explicit Work scope, and a separate draft revision all passed. Both returns
  retained Room identity and camera projection; the Room's cost totals remained unchanged.
- Whole Oxlint and scoped ESLint passed. Build/typecheck passed, including the production root
  browser adapter. The focused harness/direct-action/dimension run passed 61 tests and failed
  one existing import-closure check: `tests/helpers/downstreamNoteCases.ts` escapes the allowed
  test-helper roots. The guard is unchanged; the finalization branch owns that correction.
- `DirectDetailOptions.vue` extracts only the list presentation from `DirectActionPopover.vue`.
  The parent retains expansion, opener focus, selection watch, Escape and canonical commands.
  The existing direct-action and dimension lifecycle tests passed; Fallow no longer reports
  the popover template above its cognitive-complexity limit. Other combined Fallow findings
  and the repository coverage shortfall remain open in the finalization branch.

The source baseline is `49ed14761bb28a19fabfd73a5978891b96ddb826`, followed by this branch's
fixture-startup, visible-surface scanning and popover decomposition corrections. Reproducible
reports and screenshots are in [the evidence folder](evidence/editor-downstream/). Only named
successful-state artifacts were copied; earlier failed-run screenshots are not acceptance evidence.

## Visual findings still requiring correction

The screenshots were inspected, including the light Schedule and comparison and German Schedule,
comparison and Quote preview. The Project header reuses four grid tracks without the required
Back/name placement: Back stretches on desktop and the German Quote heading overlaps at 460px.
Retry is prominent even in a successful Saved state. Quote form labels and controls need the
stacked alignment and spacing used by the existing editor forms. The finalization branch owns
these production corrections. The constrained comparison itself remains a native keyboard
scrollable table; no whole-page horizontal overflow was observed.

Final implementation, complete visual comparison and actual-host acceptance remain open.

## Final matrix preflight correction

The joined source `0f0fdab1a94200e3e19822736c44f9d0bba72825` has the identical tracked tree
`10e74111027686bf9833c6025a20904e15b45b88` as integration source
`9e2b89f893ae8facd0dede86f99be492453d7b26`. The final runner passed its first two journeys
(four scenarios each), then stopped at Reference cancellation after desktop-to-constrained
reflow: focus attempted to return to a connected but hidden opener. The Reference journey's
assertion and timeout remain unchanged; this is an outstanding production correction.

Inspection also found the historical M10 screenshot came from the older fixture without
Project navigation. The final M10/M13 mappings now select native ninth-journey Room Work and
Costs captures, retaining the historical before images. That journey uses the representative
floor image and adds a real Cost through its form: 800 planned, 500 committed, and a 200 actual
deposit settling that commitment. Stage values are asserted before opening quotes; the complete
totals are compared after returning. Work and Costs each receive a visible-surface axe scan.
These additions are prepared for the next complete run; the earlier four-scenario evidence does
not verify them. Failure artifacts now include the active element and Reference/rail visibility
to distinguish focus regression from a harness readiness failure.
