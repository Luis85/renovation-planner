# Detailed implementation plan

**Proposal, 2026-09-13. No implementation work is marked complete.** Read the [evidence summary](README.md), [audit](audit.md) and [validation plan](validation-plan.md) with this document.

## 1. Increment contract

### Intended outcome

A first-time private renovator can choose a sensible start, create or trace a room, set its size, select the intended element, make a safe adjustment and resume later with confidence. They should be able to explain what is selected, what happens next, whether the change is saved, and how to undo or cancel it.

“My grandmother can use it” means designing and testing for varying confidence, vision, motor precision, memory and prior software experience. It is not a claim that age predicts ability. Target novices to drawing software within the existing Obsidian context; separately measure friction caused by Obsidian itself.

### Included

- Existing room, area, wall, opening, object and group workflows: discoverability, order, copy, visual hierarchy, editing feedback and recovery.
- Current reference import/calibration, layer visibility/locking, selection, clipboard, undo/redo, save/conflict communication and panel behavior.
- Existing Plan/Renovate/Review context and navigation, without expanding renovation functionality.
- Native theme integration, English/German copy, desktop pointer/keyboard/non-drag alternatives, zoom and split-pane behavior.
- Documentation corrections and meaningful verification tied to the exact implementation commit.

### Excluded

3D rendering or previews, AI recognition, new geometry primitives, new snapping algorithms, auto-layout, room templates, catalogue expansion, CAD/BIM import/export, mobile drawing parity, collaboration, cloud analytics, new renovation/cost features and wholesale design-system replacement. Do not add disabled future controls to advertise these. Existing read-only mobile scope remains.

Interaction affordances over existing commands can be in scope: a clearer picker, disclosure, inline help or an overlap list is usability work. A new domain capability, storage model or geometric operation is not. Any package crossing that line must be split out before implementation.

### Non-negotiable behavior

- Vault records remain the source of truth. No direct component writes or second geometry model.
- Existing facts, Planned changes and Work linked to outcomes remain distinct; changing perspective does not change stored reality.
- Rooms/areas and structural walls retain their current independent relationships. A resized Room must not imply that nearby independent walls moved.
- Drafts are visibly temporary. Preview, validation and guarded writes retain their current transactional boundaries.
- Cancel does not write; failed writes do not show Saved; stale data does not masquerade as current.
- Preserve accepted bottom taskbar, resizable/collapsible side panels, edge-hover rotation, context shape editing, native Obsidian chrome and the ability to work without a reference plan.

## 2. Reference-to-increment mapping

| Reference intent | Current position | Increment response |
|---|---|---|
| Clear tools/canvas/stable Inspector | Implemented shell and bottom taskbar; wide Details and constrained drawers | Keep regions and placement; improve priority, current-task cues and return behavior (U1/U2/U8) |
| Named overlap selection | Alt cycling and entity lists exist; full menu parity needs confirmation | Test dense overlaps; reuse existing hit candidates for a named route if gap confirmed (U4) |
| Instructions, live preview, Finish/Cancel | Implemented for room draft; available routes differ by task | Shared state/action contract across existing tools (U2/U5) |
| Snap and measurement feedback | Implemented; exact readability/discoverability varies | Measure screen-space clarity, explain snapped target, preserve precision routes (U5) |
| Copy summary and optional placement preview | Snapshot/dependency scope exists; Paste currently executes directly | Explain actual scope/destination; evaluate the optional preview separately instead of claiming it exists (U6) |
| Two points + known distance | Implemented staged reference workflow with exposed pixel coordinates | Prioritize ordinary visual task; disclose exact controls (U3) |
| Narrow-pane access | Rails/drawers exist at 400–899 px | Verify every active task, draft and focus transition; clear recovery below minimum (U8) |
| Plan/Renovate continuity | Confirmed for one created room in current walkthrough | Preserve selection/camera; simplify mode-relevant Details and test more target types (U7) |

## 3. Prioritization and evidence rules

**P0:** prevents a core task, causes data loss/misleading results, or excludes a required input route. **P1:** recurrent friction, confusion or difficult recovery in a core task. **P2:** lower-frequency refinement that can follow once core gates pass. These are proposed product priorities, not existing bug severities.

Use **O** for current-run observation, **C** for source/history-backed behavior, **H** for an untested usability hypothesis, and **R** for external research. Do not convert H into a confirmed defect simply because a competitor documents an alternative. A screenshot alone cannot prove contrast ratios, screen-reader behavior or persistence correctness.

| Package | Priority | Evidence | Outcome | Estimate |
|---|---|---|---|---|
| U0 Baseline and contracts | P0 prerequisite | C/H | Agreed task baseline and preserved decisions | 2–3 days |
| U1 Shell and Details hierarchy | P1 | O/C/H | Everyday edits are easy to find | 3–4 days |
| U2 Room/area task consistency | P1 | O/C | A clear draft-to-result path | 2–4 days |
| U3 Reference preparation | P1, P0 if task failure reproduced | O/C/R | Scale a plan without understanding pixels/paths | 3–5 days |
| U4 Selection and overlap | P1; validate chooser | C/H/R | Reliably reach intended/locked/overlapping targets | 2–4 days |
| U5 Manipulation and feedback | P1 | C/H/R | Know what moves and by how much | 3–5 days |
| U6 Copy, delete and recovery | P0 safety; P1 presentation | C/H | Predict results and recover safely | 2–3 days |
| U7 Perspective continuity | P1 | O/C/H | Change task focus without losing place | 1–2 days |
| U8 Compact, inclusive visual polish | P0 access; P1 polish | O/C/R | Same task works across supported contexts | 3–5 days |
| U9 Validation and handoff | P0 release gate | C/H | Measured usability and current release evidence | 3–5 days |

Total: 24–40 person-days. Estimates assume existing commands are retained and no fundamental geometry changes. Recruitment lead time and any newly discovered P0 fix are additional uncertainty. Work is not ten simultaneous redesigns: U8 criteria apply throughout, and U9 includes repeated validation rather than one final inspection.

## 4. Work packages and acceptance criteria

### U0 — Establish the current task baseline and interaction contract

**Owner:** product designer + frontend lead + QA. **Dependencies:** none.

1. Walk the full production-equivalent fixture and a disposable Obsidian vault at the same commit. Inventory active tool, selection, inspector section, draft, history, save state and camera for each core journey.
2. Run the first novice study round before moving controls. Retain the raw task denominators, assistance and wrong turns. Separate software defects from discoverability problems.
3. Reconcile dated amendments with original designs. Especially preserve withdrawn coordinate-dialog decisions, accepted rotation affordances, bottom taskbar, side panels, parent/detail-plan semantics and recent wall-without-room support.
4. Agree a shared action/state matrix: idle, selected, drafting, invalid draft, preview, saving, success, stale, blocked and cancelled. Name the primary action and recoverable exit in each state.

**Acceptance:** capability and evidence matrix names exact commit/fixture; no missing capability is inferred from the plain read-only harness; unresolved product decisions have an owner and validation method; baseline contains at least one complete no-reference and reference-assisted task. Native checks and participant tasks may be pending at plan approval, but must not be marked passed.

**Deliverables:** baseline task scorecard, short interaction contract, preserved-decision register, annotated current captures. Update affected journey/test notes through dated amendments, not by erasing history.

### U1 — Make the shell and Details panel easy to scan

**Owner:** product/interaction designer + frontend. **Dependencies:** U0.

Keep context at the top and the established bottom taskbar. In Details, keep a stable identity header (name, kind, floor where ambiguous, size/area and lock state). Put everyday actions before advanced shape operations. Treat the following order as the first prototype to test:

1. Identity and essential dimensions.
2. Name/size and applicable direct edit actions.
3. Shape/rotation/structure details in a labeled disclosure, with the accepted canvas affordances intact.
4. Compact navigation to existing renovation information appropriate to perspective.
5. Secondary and destructive actions in their established safe locations.

Do not copy the screenshot's width/height fields onto every shape. Axis-aligned room width/depth, rotated or irregular outlines, wall thickness/length and opening dimensions are different concepts. Show only truthful editable values; otherwise expose the existing appropriate route with a short explanation.

**Acceptance:** in a selected simple Room at 1280 × 800, name, type, area and the primary size/name route are visible without scrolling; no obligatory field is hidden in Advanced; selection identity remains understandable on empty/multi/locked/unsupported cases; collapsed sections have meaningful names and sensible per-session continuity; no future-feature placeholder dominates the Plan panel; existing renovation links remain reachable. Native theme tokens and both locales are used.

**Verify:** novice “rename/resize this room” task, longest German labels, rotation/irregular-room cases, low-height pane, keyboard focus order and screen-reader heading/name checks. Reject a visually simpler panel if it adds task steps or hides the only accessible route.

### U2 — Unify drawing tasks without removing useful alternatives

**Owner:** interaction designer + editor frontend. **Dependencies:** U0/U1.

Keep room-first entry and current name suggestions. Present the ordinary name/width/depth path before free-form and curve detail. Each task should explain, in one short sentence, what to do now; the instruction changes when the next step changes. Use an outcome verb such as Create room, Place door, Apply change or Finish drawing instead of applying one vague label everywhere.

Use one underlying task state and action contract for banner and Details. Parallel Create/Cancel controls are allowed where they keep canvas and keyboard/narrow routes usable. They must agree on label, availability, errors and result. Do not hide a control until an equivalent visible and focusable route is proven.

**Acceptance:** entering a task clearly distinguishes existing selection from the new draft; changing size updates preview and summary; invalid input explains how to repair it near the field; no write occurs before explicit completion; Cancel exits the whole task while Escape follows its existing staged cancellation order, both preserving committed geometry; neither implies that an in-flight write can be cancelled; successful creation returns to Select unless the user deliberately enabled Keep adding; that preference and the created result are clear; both action routes submit exactly once; changing panel width does not reset values or errors. Switching tools/perspectives during a draft has an explicit, consistent outcome and never silently persists it.

**Verify:** create rectangle numerically and by pointer; free-form room and area; cancel before/after sizing; invalid/locale input; double activation; repeated creation; draw while Details is closed; undo/redo created result. Existing keyboard creation alternatives remain discoverable.

### U3 — Make reference setup a guided everyday task

**Owner:** interaction designer + reference-flow frontend + QA. **Dependencies:** U0; use U1/U2 conventions.

Primary narrative: **Choose a plan → Prepare if needed → Mark two points → Enter the known distance → Review and use the plan.** Preserve the existing three-stage transaction rather than adding a competing wizard.

- Lead with the existing file suggestions/selection route. Use a filename-friendly label and explain that the source must be in the vault. Retain typed paths as an alternate exact route. If importing from outside the vault requires new storage behavior, keep that capability outside this increment and explain the existing way to place a file in the vault.
- Show image/PDF preview and selected filename as soon as available. Rotation, PDF-page selection and crop remain reachable; source-pixel crop fields move into an exact-adjustment disclosure. Do not remove keyboard preparation controls.
- Lead scaling with “Choose two points whose distance you know,” a visible first/second point state, and “Distance between these points.” Place the known-distance input before advanced source-pixel coordinates. Keep coordinate entry as a usable alternative, not hidden from keyboard/assistive users.
- Explain whether a step previews a change or saves it. The final review summarizes source/page, distance and unit, scale state and lock/opacity choices using current capabilities.
- Correct the generic Scale not set status so users can distinguish an unscaled reference from geometry they deliberately drew with real dimensions. No invented measurement accuracy, no meaningless warnings when no reference exists.

**Acceptance:** a novice can complete setup using a supported file already in the vault without typing a path or understanding pixels; exact alternatives remain reachable using keyboard and click; first/second endpoints and known distance are legible together; source retry, back, choose-another-distance and cancel retain the correct draft; invalid/zero/ambiguous distance cannot silently apply; English/German decimal handling follows the existing locale contract; geometry rescaling retains its existing impact review and consent, including the current scope of authored zones and current/intended structures; final commit preserves atomic setup, original source and lock behavior. An unreadable file yields a specific next action. This presentation change must not alter which saved geometry calibration transforms.

**Verify:** PNG, JPEG and multipage PDF in native Obsidian; crop/rotate followed by scale; back/cancel at each stage; replace an existing reference; missing file; locale input; keyboard-only and non-drag completion; 460 px and large-text layout. Current audit reached Set scale and cancelled; it did not verify successful calibration persistence.

### U4 — Select the right element with confidence

**Owner:** interaction designer + selection frontend. **Dependencies:** U0; U1 identity rules.

Test a doorway shared by wall/Room boundaries, a small opening, nested/overlapping areas, objects over rooms and group/member ambiguity. First establish what current Alt cycling, context menus and entity lists already solve. Provide a visible named selection route when the existing path requires hidden modifier knowledge or repeated guesswork.

**Conditional implementation:** a small “Choose element” menu over the current hit candidates, reached through existing context interaction and a discoverable alternate route. It must name kind plus room/element identity, indicate current selection/lock and preview the intended target when feasible using existing highlighting. Do not display a chooser on every normal single click or introduce new picking semantics.

**Acceptance:** ordinary selection stays fast; the overlap task can be completed without remembering Alt; keyboard/list and click routes reach every supported candidate; Escape closes without a selection change; choosing a candidate updates canvas and Details consistently; focus returns meaningfully; hidden layers and locked elements follow current rules; selecting a room must not accidentally move its wall or door; multi-selection/group membership stays unambiguous. If baseline users succeed reliably with the current visible route, ship only its clarity fixes and retain the chooser as a tested-deferred decision.

**Verify:** candidate order, duplicate names, flat saved group/member and overlapping/nested-zone cases, hidden/locked/deleted candidate, repeated clicks, keyboard selection and viewport edges. Include a native context-menu check and novice target-identification task.

### U5 — Explain manipulation, precision and snapping

**Owner:** editor frontend + interaction designer. **Dependencies:** U2/U4; U8 criteria throughout.

Standardize the presentation of current measurements, editable dimensions and snap feedback. During movement/resize/rotation show the relevant quantity and target, without covering the element, handle or confirmation controls. Make it clear whether a dimension edit changes room bounds, a wall segment, a hosted opening or an object.

Preserve edge-hover rotation and its numeric/quarter-turn route; do not reintroduce the earlier rejected permanent Rotate label. Keep existing snapping behavior; clarify what has snapped and where the current toggle/temporary override lives. Existing wall-impact preview must state which connected structure/openings are affected before applying.

**Acceptance:** measurement hit targets remain usable at different canvas zooms; the editable state is signaled through more than color; labels avoid collisions in representative dense plans; a keyboard/non-drag route exists for each in-scope manipulation unless an applicable criterion exception is documented; locked/unsupported operations give a reason and next action; preview/apply/cancel and undo granularity match the established command; rotating/resizing does not leave stale dimensions. The current arbitrary-corner accessibility gap receives an explicit design decision, not an automatic resurrection of the removed coordinate dialog.

**Verify:** room rectangle vs rotated/irregular outline, connected wall and hosted opening, group rotation/refusal, object placement, small handles at extreme zoom, snapping on/off, repeated nudges, invalid numeric values and stale/conflicting writes. Review the actual painted glyph and hit region separately.

### U6 — Make copy, delete, undo and save behavior trustworthy

**Owner:** frontend + command/persistence owner + QA. **Dependencies:** U0; U4 selection identity.

Use the existing clipboard scope to explain exactly what is copied, what is excluded and where the copy will be placed. Say whether attached renovation information is included according to actual behavior; do not promise the screenshot's example counts without inspecting the selection snapshot. Current Paste executes directly through PasteCommand; there is no placement-preview/confirmation/Cancel lifecycle to preserve. Keep direct paste and its undo behavior as the baseline. Evaluate the reference's optional preview only if observed misplacement warrants a deliberate new interaction decision within this existing capability; it is not mandatory scope.

Keep routine edits lightweight. Do not add confirmation dialogs to every change. Explain consequences for genuinely guarded deletion, groups, dependencies and history invalidation; offer current safe alternatives. Undo/Redo must be visible and named consistently. Save-state language must distinguish draft, pending write, saved, stale/conflict and failed states.

**Acceptance:** clipboard summary matches actual payload and target floor; copied geometry receives correct new identities and no accidental links to excluded records; Copy writes no project data; one Paste action creates one undoable result; delete consequences identify the affected scope; undo restores supported results and accurately explains unsupported/invalidated history; failed/stale writes preserve truthful UI and an available recovery route; reopening the editor does not imply a draft or history survived when it did not. If a preview is separately accepted, add explicit cancel/no-write and single-confirmation tests for that new interaction.

**Verify:** single Room/Area, wall/opening and group snapshots supported by current commands; multi-selection and destination changes; missing source after copy; copy while typing does not steal text clipboard; Escape; undo/redo; reference/dependency guards; failed write and external vault edit; close/reopen and app restart in a disposable vault.

### U7 — Clarify perspectives and preserve place

**Owner:** product designer + planning frontend. **Dependencies:** U1/U2.

Plan emphasizes arrangement and dimensions; Renovate emphasizes the existing/planned/work information already supported; Review emphasizes existing checks and return navigation. The selected identity stays stable. Avoid duplicated full renovation menus dominating Plan, while retaining a clear route to the selected element's related content.

**Acceptance:** switching perspective preserves plan, selection and camera according to the existing session contract, including restoring the pre-Review selection/camera snapshot when returning to Renovate; applicable drafts are handled explicitly before switching; no unexpected geometry write occurs; room, wall, opening, object and room-less record contexts are truthful; panel title and available actions explain the new task focus; returning from a detail or linked note restores usable context; hidden/deleted/unreadable selections have explicit fallbacks. Perspective names and Existing/Planned terminology are not collapsed into one ambiguous state.

**Verify:** round-trip Plan → Renovate → Review → Plan with selected/unselected/multi/locked elements; room-less wall records; unsupported selection; linked note return; two simultaneous plan leaves. Current single-room continuity is a positive baseline, not a complete pass.

### U8 — Apply inclusive visual polish and compact-layout rules

**Owner:** accessibility specialist + frontend/design systems + QA. **Dependencies:** begins at U0, closes after U1–U7.

Use Obsidian semantic tokens, existing icons and typography. Improve readable text hierarchy, spacing, alignment, field labeling, focus visibility, disabled-state explanation and long-label handling. Avoid hardcoded branded blue/green panels and visual noise. Do not rely on color for selection, snap, lock, validation or renovation status.

At wide widths retain resizable/collapsible panels. At 400–899 px preserve current rails/drawers; return to the canvas must be explicit and restore selection/draft. When a resize leaves content offscreen, make existing Fit/reveal navigation discoverable; do not automatically change camera during an edit. Below 400 px provide a clear widening/focus action and preserve state. Separately assess whether essential nonspatial controls can remain available under host zoom: the 2D canvas reflow exception does not exempt surrounding UI.

**Acceptance:** evaluate applicable WCAG 2.2 A/AA criteria across the complete declared editor scope; core-task success is a release gate, not an AA conformance claim. Document only criterion-defined exceptions; unresolved failures remain failures. Aim for 44 × 44 CSS px primary action targets while accurately applying AA's 24 × 24 minimum/spacing exceptions; dragging has an equivalent single-pointer route where required, separately from keyboard access; focus survives dialog/panel changes and is not obscured; 200% text enlargement causes no loss of content or functionality; evaluate 400% host zoom and 320 CSS px reflow for surrounding nonspatial UI; errors and save feedback are announced at appropriate frequency; hover affordances have non-hover alternatives; English/German, light/dark and a representative community theme remain legible.

**Verify:** actual rendered target/contrast measurements, complete keyboard journeys, NVDA/native Obsidian checks, zoom and reduced-motion, 1280/1024/900/899/640/460/400/399 px widths with representative heights. No full Cartesian matrix is required: boundary widths plus high-risk task/locale/theme combinations are mandatory. Native host zoom is not interchangeable with changing browser viewport width.

### U9 — Validate, consolidate documentation and release

**Owner:** QA/research lead + product owner + frontend lead. **Dependencies:** all accepted packages.

Run formative rounds during delivery, then the final unaided core-task gate with fresh participants. Fix the largest remaining failures before cosmetic P2 items. Repeat only tests affected by changes or unresolved concerns, then run the full repository gate at release.

**Acceptance:** all P0 items closed; core journeys meet the proposed thresholds or a product-owner decision explicitly narrows scope without claiming success; no critical persistence/history regression; documented accessibility scope and remaining limitations; current native-vault evidence; exact-commit automated/capture receipts; user guide and relevant case notes match the delivered UI. Old receipts are not relabeled as current. Use the complete [release checklist](validation-plan.md).

## 5. Delivery sequence and dependency gates

| Stage | Work | Gate to proceed |
|---|---|---|
| A: establish | U0 and initial U8 audit | Production-capable fixture verified; baseline task failures and accepted historical decisions recorded |
| B: prove two core tasks | U3 reference clarity; U1/U2 room hierarchy and guidance | End-to-end room and reference prototypes tested; accessible alternatives preserved; conditional choices resolved |
| C: consolidate existing edits | U4/U5/U6 with U7 | Select → inspect → change → undo/recover passes for representative supported entities |
| D: finish across contexts | U8 and remaining U7 checks | Same core task works in supported split panes, locales/themes and native host |
| E: release decision | U9 | Novice, accessibility, regression and native evidence gates satisfied |

Each implementation branch should deliver one concern with related docs/tests and a reviewable PR. Avoid a broad shell rewrite; extract shared presentation logic only when the task slices demonstrate real duplication. High-risk command, selection and reference changes require review from the owning domain/command engineer even if the visual diff is small.

## 6. Decisions to resolve during baseline/prototype work

| Decision | Initial recommendation | Required evidence/owner |
|---|---|---|
| Duplicate banner and Details actions | Preserve both accessible routes; reduce competing visual emphasis | Designer tests task completion at wide/narrow widths; QA confirms identical command state |
| Overlap chooser | Add only if current visible paths fail the task; user reference gives it high investigation priority | Selection owner + candidate-round target-selection task with denominator recorded and keyboard check |
| Exact reference fields | Disclose pixel/path details beneath the ordinary workflow, with keyboard access retained | Reference owner + non-drag/keyboard setup and two-point novice task |
| Arbitrary-corner accessibility | Design an understandable equivalent within current geometry capability; do not restore rejected coordinate dialog automatically | Accessibility + geometry owners; explicit user review of concrete interaction if changing accepted direction |
| Camera after resizing/selecting | Preserve current intentional camera behavior; expose existing fit/reveal route | Observe disorientation/recovery in split-pane tasks before changing navigation semantics |
| Room inspector cross-links | Compact in Plan, prominent in Renovate | Check related-content findability and existing context continuity |
| “Scale not set” | Distinguish reference calibration from authored geometric dimensions | Domain/reference owner confirms truthful wording for every state |

These are implementation-stage decision gates. The planning request does not require waiting for answers before delivering this proposal.

## 7. Risks and controls

- **Simplification hides safety or access.** Review every removed/moved control against task and input-route matrices, not screenshot aesthetics.
- **Original mockups override field learning.** Use dated implementation amendments and commit-specific evidence; explicitly record each deliberate departure.
- **Harness omits production behavior.** Use the full reference/planning workspace, identify any mocks, and verify native integration separately.
- **Polish changes geometry semantics.** Keep command boundaries; reject visual shortcuts that imply unsupported wall/room linkage.
- **Cross-cutting changes multiply regressions.** Deliver task slices, preserve shared state semantics and add meaningful boundary tests.
- **Testing only the author overstates usability.** Recruit new users with diverse confidence and input needs; report assistance, raw counts and limits.
- **Scope expands toward competitors.** Judge proposals by smoother existing tasks; keep 3D and feature breadth outside the increment.

## 8. Implementation handoff record

For each package, the implementation owner records: linked user outcome; baseline evidence IDs; changed files and command boundaries; acceptance results; exact commit; automated checks; captured viewport/theme/locale/fixture; native manual runs; participant findings; unresolved risk; and PR URL. Keep progress in the derived task record and execution receipts, not in received design sources. The proposed package IDs U0–U9 are local to this plan and do not claim existing backlog PBI IDs.
