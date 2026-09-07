# Selected geometry canvas actions

This implementation closes the M00/M07 canvas-action gap: native Room width/depth
labels, an inline scalar form, nearby Edit shape/Add detail actions, and selected-wall
length/Mark change actions. It builds on the joined `63173897` checkpoint. Its full
verification passed 7,562 tests but failed the global branch-coverage floor; the scoped
results below do not replace that remaining combined gate.

## Interaction and authority

- `roomEditLifecycle` shares the existing versioned Zone read, identity/selection guard,
  conditional geometry commit and stale-write recovery between modal and inline Room edits.
  The canonical `runtime.writesBlocked` and saving state gate both doors.
- The scalar draft reuses `dimensionProposal`, preserves raw native text and untouched
  coordinates, and never converts an irregular Room to a bounding rectangle. Apply/Enter
  writes once through `commitField`; Escape cancels and Undo uses the existing history.
- The temporary `edit-room-dimension` tool prevents pointer selection from discarding text.
  Keyboard selection changes retain the draft with an explicit context warning. Deliberate
  tool switches abandon an unsaved draft; the existing perspective confirmation remains.
- Generic `EditorTool.canDeactivate` refuses cancellation/switching before mutation while
  saving. The reactive mirror reports the actual tool. Leaf disposal forcibly retires tools
  and ignores late UI completion. Select/Add/Cancel expose the pending restriction.
- Add detail uses the root-provided renovation/planning actions. It does not introduce a
  second creation catalogue or persistence path. Wall length uses the existing structure
  edit form and required Preview/Apply; Mark change uses the canonical Planned target draft.
- Controls follow the selected layer, viewport and host theme. Inline fields survive
  supported reflow; form overflow reserves room for the floating primary actions.

## Verification

Source preparation includes real-editor persistence, exact Undo, invalid input, native-key
ownership, delayed baseline, disposal, planning-failure/unrecovered guards, selection changes,
pending-write veto, all detail routes and wall Preview/Apply regressions. The connected
overview browser journey adds native inline entry, supported reflow, a held Zone write,
Escape/Select refusal and Undo. Its test-only probe pauses the actual Zone repository save.

- Production build/typecheck, changed-source ESLint, whole-repository Oxlint, script syntax
  and whitespace checks pass. The new CSS uses the host shadow token as well as semantic
  foreground, surface, border and accent tokens.
- The nine-file focused suite passes **122 tests** (83.68 s, one worker), covering the new
  controls and existing Room resize/name, recovery, floating actions, temporary banner and
  ToolManager contracts. Scoped coverage passes the unchanged floors: **99.30% statements
  (285/287), 98.92% branches (277/280), 100% functions (81/81), 100% lines (191/191)**.
  See [coverage summary](evidence/editor-direct-actions/coverage.json); this is the nine new
  or shared implementation modules, not whole-repository coverage.
- The connected overview journey passes all four scenarios: light, dark, custom accent and
  German at 460 px. It uses installed Edge **152.0.4191.62**, explicitly overriding the
  Chromium version pinned by Playwright. Native Tab/Enter typing, exact Undo, one held Zone
  write, repeated constrained Details activation and shared Work Preview/Apply pass with
  no page errors. See [browser report](evidence/editor-direct-actions/report.json).
- Twelve axe scans report zero violations. Incomplete contrast checks include scrolled
  Inspector/Room headings and canvas controls obscured by the constrained Details panel.
  They do not establish screen-reader acceptance; review the saved screenshots and each
  scan's `incomplete` nodes alongside the zero-violation result.
- Visually inspected the light Room overview, light/dark inline draft at 720 × 450, and
  German wall Inspector. Controls remain native and inside the canvas; scalar text/focus
  survives supported CSS reflow. This is not actual host zoom or physical-device evidence.

The browser pass caught no remaining direct-action failure. The test pass caught and fixed
modified/repeated Escape propagating from the Add detail disclosure into canvas selection.
Plain Escape closes the disclosure first; the next Escape clears selection. Late reads,
cancel/render focus transfer and leaf disposal retain their independent regression cases.

Final visual acceptance remains open: the shared host-icon treatment and matching-state
floor fixture need the final visual pass, and downstream Trade/Supplier/schedule/quote routes
are still joining. All eight final journeys and 18 comparisons must be recaptured from the
complete committed source. No actual Obsidian or screen-reader acceptance is claimed here.
