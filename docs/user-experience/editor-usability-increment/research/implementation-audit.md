# Implementation and product-history audit

Planning baseline: `origin/main` / worktree HEAD `4ca4c7ea77e72e3ce4ea631884b353662d69964a`, inspected 2026-09-13. This memo is a read-only source and repository-record audit; it does not claim a current browser, native-host or test pass. The coordinating task owns current screenshot evidence. No `AGENTS.md` or `.codex/` instruction files were found in this worktree; the supplied project instructions apply. `CLAUDE.md` and the relevant SDD sections were consulted for command, persistence and tool boundaries. No production changes are proposed as completed.

## Executive finding

The next increment should consolidate an already capable editor. Stable panel containers, explicit completion, precise measurement, snapping, copy/paste, reference navigation, context menus and the three perspectives already exist. Their visibility, consistency and explanatory quality are the opportunity. Rebuilding those capabilities would duplicate tested paths and risks undoing deliberate changes made after the original M00–M17 designs.

The largest planning trap is confusing three different baselines: the original design, the September 9 acceptance stack, and September 10–12 changes driven by use in a vault. Another is treating the plain screenshot harness as the fully connected product. Both produce false missing-feature findings.

## Evidence hierarchy and validation history

Use current production code for capability, the latest explicit user decisions for intended behavior, revision-bound receipts for verification, and current matched screenshots for usability. A dated specification or issue status alone is insufficient.

| Stage | What the repository establishes | Implication for this increment |
|---|---|---|
| Original editor / early manual use | `docs/tests/cases/Editor Walkthrough.md:44` distinguishes pdf.js, host theme, cache/reopen and actual leaf behavior; `docs/tests/suites/Walk the landed editor stack.md:11` records the September 8 stack's strong automated gates but absence of host walks. | FakeVault and jsdom cannot establish Obsidian cache, keymap, native notices, audible announcements or real reload behavior. |
| September 9 release planning | `docs/user-experience/renovation-planner-editor-specs/implementation/remaining-plan.md:13` lists implemented capabilities with visual/native acceptance still open at that time. | This is historical continuation guidance, not a current list of missing features. |
| September 10 integration confirmation | `docs/tasks/Confirm merged main carries the verified editor state.md:14` records merged stack and tree identity at `5dcc1f20`; line 34 records the full pinned-Chromium visual matrix pass for `22772267`, and line 41 distinguishes local and CI test counts. | Do not claim the original visual matrix has never passed. Equally, this receipt does not accept later changes: its risk section explicitly excludes subsequent main commits. |
| September 10 vault-driven fidelity | `docs/development/agent-guide-increment-history.md:5615` explains that a real wall loop looked diagrammatic and the old harness contained no walls. A initially impossible fixture was caught by a real sidecar round trip. | Screenshot fixtures must represent valid saved model states and include actual architecture/openings, not attractive fake geometry. |
| September 11–12 model-aware fixes | History at lines 5667, 5699 and 5774 records walls outside room outlines, mitred corners and wall-body joins. Line 5805 records a user-observed oblique T overshoot that required correcting the geometry used for painting. | Do not reopen fixed wall-area and corner findings from older screenshots. Test current oblique, curved, shared and unequal-thickness cases. |
| September 12 panel consolidation | History at line 5719 documents completed resizing/collapse and content cleanup; line 5741 records intentional deviations and superseded spec rows; line 5771 explicitly says native resize/restart acceptance was not run. | Full-layout panel stability exists, while constrained-rail issues and native persistence remain legitimate validation targets. |
| September 12 newest domain changes | ADR-0030 (`docs/development/adrs/0030-a-renovation-record-may-have-no-room.md:17`) admits renovation records without rooms and any zone as a context; ADR-0031 adds construction-material and pattern distinctions. | Room-only assumptions in old plans and fixture scenarios are obsolete. Include a freestanding wall and an Area when validating inspector consistency. |

Some current high-level documents still contain obsolete implementation statements: SDD §96 at line 2772 calls most Add entries unavailable and perspectives proposed, whereas current production exposes them. Treat these as documentation reconciliation work, not evidence that functionality must be built again.

### Harness versus installed product

`tests/harness/planEditor.ts:394` supplies a restricted base command bundle, with intentionally refusing writes. The connected workspace is selected at line 760 only with `reference`; `planning` selects planning fixtures. `src/presentation/editor/shell/EditorContextBar.vue:82` only shows perspectives when renovation services are available. `src/presentation/editor/renovation/renovationActions.ts:166` derives availability from `context.commands.renovation`. Production composition spreads `planningEditorServices` in `src/plugin/planEditorDeps.ts:100`.

Therefore a plain `?view=plan-editor` screenshot with no perspective switch and a Room's “Coming later” content does **not** establish a production gap. Use the connected route `?view=plan-editor&reference&planning&fidelity` for comparisons involving renovation. The supplemental modal driver uses that route plus `modal-placement-fixtures` (`scripts/editor-modal-placement-check.mjs:47`). Record URL parameters, selected entity, perspective and connection type beside every capture. The plain harness remains useful for shell-only comparisons, labeled as such. Selection-triggered fit in a fixture needs reproduction on a connected workspace before being called production camera instability.

## Present capabilities and bounded consolidation opportunities

Severity here ranks proposed usability work, not a confirmed production defect. P1 blocks or materially confuses a common task; P2 adds recurring effort; P3 is minor polish. “High” confidence means source/dated record supports the claim; user impact still needs the current walkthrough where stated.

| Concern | Present implementation and evidence | Consolidation opportunity; severity / confidence |
|---|---|---|
| Inspector stability | `EditorSidePanel.vue:12` documents preserving mounted content; its template at line 105 uses `v-show`. `ResponsiveEditorShell.vue:61` measures the leaf and preserves focused regions; lines 154–184 switch full/constrained/unsupported presentation. `EntityInspector.vue:105` chooses task, multi-selection and entity bodies. | Keep one frame and stable identity/context header while bodies change. Standardize information order and action positions across Room, Wall, Opening, Element, multi-selection and renovation details. This is consistency work on existing containers, not a new inspector architecture. P1 / high for structural divergence, medium for measured impact. |
| Wide versus narrow panels | `layoutMode.ts:10` defines full ≥900 px, constrained ≥400 px. `panelLayout.ts:21` defines stored widths and line 70 computes effective widths while preserving a 320 px canvas. The September 12 history at line 5766 records the 460 px Layers overlay covering Details and the German label wrapping inside a word. | Explicitly solve rail reachability, active-panel switching and readable narrow labels. Test full boundary 900 px as well as 460/400 px; a 1280 px-only audit misses both. Avoid spending scope reimplementing existing resize/collapse. P1 / high for recorded obstruction, current reproduction required. |
| Toolbars and persistent controls | `EditorContextBar.vue:23` declares Plan/Renovate/Review; history at line 5590 intentionally retains Pan after user testing. `TemporaryToolBanner.vue:64` registers existing tasks; component library line 211 specifies one bottom bar with Finish primary. | Consolidate label, icon, grouping and active-task hierarchy. Keep Select/Pan/Add and tool-specific completion discoverable without competing rows. Preserve the user's explicit Pan decision; do not apply old M01 “no persistent Pan” literally. P2 / high. |
| Selection disambiguation | `selection/resolveSelectionTarget.ts:18` ranks object/stair/asset before opening, wall and zone. Handles, captions and badges have separate hit paths. Guide `docs/using-plan-editor.md:22` documents Alt cycling, group member selection and keyboard lists. Zone locks allow click-through. | Explain what will be selected, why a group expands and how to reach an obscured wall/opening/room; expose the existing alternate-target path at the moment of ambiguity. Preserve hit rank, handle priority, hidden/locked behavior and stable member IDs. No new selection model is required. P1 / high capability, medium discoverability finding. |
| Finish, Cancel and Escape | `TemporaryToolBanner.vue:98` derives completion and line 110 dispatches to existing task facades. `TaskDrawingControls.vue:30` supplies shape-specific controls. Room, Area, wall, opening, asset, curve and dimension tasks legitimately have different completion semantics. | Derive visible instruction, next required action, valid completion and exit wording from the same task state. Explain invalid/pending/busy states without suggesting Cancel can interrupt an in-flight write. Standardize wording without flattening one-shot, repeated placement and Preview→Apply into one incorrect rule. P1 / high. |
| Live dimensions | `resize/roomDimensions.ts:8` admits only four distinct axis-aligned straight corners. `dimensionProposal` at line 40 preserves untouched precision, vertex order and top-left anchor. `DraftRoomDimensions.vue:13` positions live rectangle width/depth; `RoomDimensionLabels.vue:47` gates edge measurements by actual editing state. | Show current length/angle/size at the working location and use consistent formatting/labels. Do not label a polygon's axis-aligned bounding box as semantic room width/depth or promise arbitrary rotated-room resizing. P1 / high. |
| Snapping | `snapping/editorSnapping.ts:18` documents room candidates, screen tolerance and the grid distinction; line 35 fixes the shared 15° constraint. `StatusBar.vue:119` shows snap state. `StructureTaskForm.vue:22` derives named wall-join feedback. | Distinguish snap enabled from snap actually acquired, identify target/constraint and show feedback near the gesture. Grid visibility is not grid snapping; hosted-opening attachment persists independently. Test toggling and Shift across relevant tools, rather than assume one global geometry rule. P1 / high. |
| Copy scope | `clipboard/clipboardActions.ts:24` captures a snapshot; line 35 gates Paste during unsupported write/edit states. `editorClipboard.ts:5` explains shared memory across leaves and loss on reload. Domain closure lives in `domain/spatial/clipboard.ts:56`. Spec `2026-09-10-editor-copy-paste-design.md:35` defines copied dependencies and line 47 excludes planning links/status/intended geometry. | Explain “geometry plus dependent hosts/openings,” target floor and fresh record identity at the action. A selected opening also brings its wall and sibling openings; copying a Room brings its boundary walls. Costs, work and evidence are excluded to avoid duplicate accounting. Do not add OS clipboard, linked duplication or external interchange. P1 / high. |
| Reference calibration | `reference/ReferencePreview.vue` already implements zoom/pan/Fit, pointer capture and keyboard navigation; `ReferenceSetupForm.vue:50` derives scale, line 56 gates rescale consent, and line 120 enforces it. | Clarify image navigation versus point placement, A/B progress, known-distance units, and the effect of recalibration on existing geometry. Enlarge or improve layout only after measuring the actual painted image and reachable controls. Do not build a second calibration path. P1 / high. |
| Plan/Renovate continuity | `renovationSession.ts:4` separates perspective and detail mode. `renovationActions.ts:77` guards perspective changes, snapshots Review context and restores it on return to Renovate. `SpatialInspectorActions.vue:17` explains deliberate late Room-context sync; line 45 connects Room and Area renovation entry. | Keep identity, spatial target and Existing/Planned meaning visible when switching. Both Plan and Renovate edit current geometry; intended changes remain separate. Context is not always a Room after ADR-0030. P1 / high. |

## Requirements that need semantic discipline

### “Room dimensions” is not one universal operation

The saved Room is a Zone polygon, not a rectangle object with authoritative width/depth fields (SDD `:1085`). A rotated rectangle and a curved/free-form Room do not pass `roomDimensions`. Current curved edge lengths are actual arcs, not chord or bounding-box length. Inner room area, wall centreline length, outer wall envelope and selected-group extent must use distinct names and visual anchors.

Enclosure is explicit and does not continuously rebuild walls when an independent Room outline changes (`docs/using-plan-editor.md:97`). Shared edges may place a wall centred on a shared boundary, while exterior enclosure places its inner face on the room outline. A screenshot request for a universal width/depth editor or automatic wall following would change semantics and model scope. Restrict this increment to clearer existing measurements and numeric routes already supported, unless a separate model decision is deliberately approved.

### Preserve model integrity while simplifying controls

All new entrances must call the existing runtime action, not duplicate persistence logic. SDD `:1057` requires expected versions; `:1119` establishes one user intent, one transaction/history entry. Presentation must not write the vault (agent guide `CLAUDE.md:603`). Preserve stable Room/Wall/Opening/Element/group identities, host/boundary links, current versus intended geometry, and compensated recovery. Retry after a successful write is read-only; apparent “Saved” cannot erase stale-view qualification.

Do not turn “copy this room” into a linked project clone. Do not make a wall's current edit silently change Planned structure. Do not relocate room-less records into a new enclosing Room; ADR-0030 explicitly preserves their context. Do not use screen coordinates as persisted calibration points or dimensions.

### Stable context is more than keeping the panel mounted

The shell already preserves DOM lifetime through reflow. Contextual bodies still change with task, selection and perspective. A successful consolidation needs an explicit visible contract for: selected entity identity, current perspective, relevant detail section, temporary operation state, and the return destination. Changes should preserve a draft's original target while refusing stale writes rather than retargeting text automatically to whatever happens to be selected next.

Review remains read-only. Leaving an active task for another perspective can ask about the draft; forcing seamless switching by discarding drafts would violate existing behavior. Copy is allowed in Review because it does not write; Paste is not.

## Closed decisions and issues that must not be reopened accidentally

| Record | Current disposition / regression duty |
|---|---|
| `docs/issues/A Cancel button with a drafted room leaves the creation task active.md:72` | Done: explicit Cancel exits the whole task; Escape backs out one interaction at a time. Do not “unify” them by calling Escape from Cancel. |
| `docs/issues/The Escape contract clears selection before a Select drag is abandoned.md:63` | Done: abandon gesture before selection clearing. Preserve Escape routing across canvas and sidebar focus. |
| `docs/issues/A resize-driven overlay close strands focus on body.md:81` | Done: returning focus after responsive closure has an existing contract. Extend tests if chrome changes; do not treat all resize focus as still broken. |
| `docs/issues/Selection clearing is silent while the constrained Inspector is closed.md:63` | Done: announcement moved outside the transient Inspector. Keep selection status independent of panel visibility. |
| `docs/issues/The Add menu sends wheel gestures to the canvas.md:68` | Done: scrolling menus must not zoom/pan the canvas. Preserve pointer and keyboard isolation. |
| `docs/issues/A field edit commits on blur, and two design packages ask for an explicit Apply.md:94` | Done for Asset library through Save/Discard. It is not authorization to globally change every remaining field's transaction behavior; inspect the particular editor field. |
| History `:5746` and commit `fe22121b5` / PR #149 | Existing outline-coordinate editing was deliberately withdrawn. Later shape editing moved to context menus (`086125177`, PR #154). Do not reinstate every deleted edit button merely to resemble an older reference. |
| History `:5590`, component library `:186` | Persistent Pan was an explicit user-testing reversal of the original design. Retain it. |
| History `:5686` and `:5805` | Inner-face enclosure and oblique T overshoot were fixed after older visual findings. Reproduce before reopening; unequal-L and very shallow thick-stem limits remain distinct. |

The Issue titled “The Inspector's two unavailable lists are separate navigation models” is marked Done, but its closure (`:90`) is a documentary correction withdrawing a false completion claim, not proof of a universal inspector model. More recent implementation deleted the duplicate unavailable-row components in favor of ComingLaterLine. Read the closure, not merely its status.

## Open questions and acceptance risks

1. **Keyboard corner editing needs an explicit decision.** `docs/issues/Vertex editing has no keyboard path.md:34` claims the September 7 coordinate form supplied a non-pointer route; that form was later removed by user request. Current `SpatialInspectorActions.vue:35` offers curve/name/axis-aligned size, not arbitrary corner coordinates. Current source therefore does not support claiming every reshape gesture has an equivalent keyboard path. Do not silently reinstate the rejected form: choose a compact accessible corner-editing route within consolidation, or record the precise limitation. This is P1 / high for a coverage gap, with interaction design still undecided.
2. **Native acceptance is selective and still incomplete.** New panel and copy/paste cases explicitly have unrun vault tables (`docs/tests/cases/Resize and collapse side panels.md`, `Copy and paste across floors.md:55`). Older host-plan H1–H6 tables are not proof that nothing has ever been used in a vault; history records real observations. Neither anecdotes nor current screenshots discharge the formal reload, two-leaf, device or screen-reader matrix.
3. **Mode continuity needs the latest context matrix.** Room, Area, wall with room, wall without room, opening, element, shared context, selected group and Review-return behavior must each be walked. A Room-only happy path cannot validate ADR-0030.
4. **Actual snap predictability and measurement legibility require movement.** Static screenshots cannot establish acquired-target stability, angle constraint, pointer latency, live length precision or cursor/selection agreement. Capture short before/during/after sequences and inspect resulting saved geometry.
5. **Reference size claims need painted pixels.** Canvas attribute sizes and dialog width are not the effective image area after aspect fit, crop, zoom and narrow reflow. Validate both PNG and PDF, narrow and wide aspect ratios, point picking after camera changes, cancel/reopen and rescale consent.
6. **Acceptance artifacts must not leak impossible fixtures.** Run domain/persistence validation on every new saved fixture. Include wall/zone/host identities and schema-aware latest data; frontend fakes can accept impossible structures.

## Implementation boundaries and sequencing

1. Freeze a current connected baseline and a vocabulary/interaction matrix before changing templates. Separate confirmed usability findings from harness deficiencies and historical claims.
2. Consolidate shell/context/inspector presentation first, reusing `ResponsiveEditorShell`, `EditorSidePanel`, panel preferences and existing body components. Avoid another layer of overriding CSS; September 12 already removed competing cascade rules.
3. Consolidate action labels, task-state guidance, selection explanation, snapping and measurement feedback through existing runtime facades. Preserve focus hooks (`data-rp-action`, region selectors) or migrate all consumers together.
4. Clarify copy/calibration scope at existing entry points. Do not change formats, commands, schemas, geometry dependencies or planning calculations for copy-only UI changes.
5. Reconcile guide, affected original spec amendments, issue records, acceptance matrix and latest evidence together. In particular resolve stale keyboard-editing and old acceptance-status assertions without rewriting historical receipts.

Template complexity and line budgets are real implementation constraints: `EntityInspector.vue:78` documents why a named body mapping replaces repeated branches; `clipboardActions.ts:64` explains why clipboard composition remains outside the runtime's line budget. Prefer small extracted presentation components/read models where necessary, while retaining one owner for action and state decisions. Do not weaken lint, coverage or complexity gates to fit a redesigned panel.

## Targeted verification for implementation

These are recommended commands, not results from this planning audit. Run appropriate subsets once per concern; run the unchanged integrated gate for the final implementation. `package.json:21` defines `check:fast`; `CLAUDE.md:207` requires green CI across Ubuntu Node 22/24/26 and Windows Node 22 before merge. Current guidance explicitly avoids concurrent heavy gates.

```powershell
npm run check:fast -- tests/presentation/editor/shell tests/presentation/editor/shellFidelity.test.ts tests/presentation/editor/nativeShellInputBoundaries.test.ts
npm run check:fast -- tests/presentation/editor/taskBannerOperationBoundaries.test.ts tests/presentation/editor/roomDimensionInline.test.ts tests/presentation/editor/roomDimensionLifecycle.test.ts tests/presentation/editor/roomEdgeMeasurements.test.ts tests/presentation/editor/roomEdgeMeasurements.e2e.test.ts tests/presentation/editor/snapping tests/presentation/editor/tools/roomSnapping.test.ts
npm run check:fast -- tests/presentation/editor/selection tests/presentation/editor/clipboard.test.ts tests/application/commands/pasteCommand.test.ts
npm run check:fast -- tests/presentation/editor/referenceWorkflow.e2e.test.ts tests/presentation/editor/referenceViewport.test.ts tests/presentation/editor/referenceViewportControls.test.ts tests/presentation/editor/referenceSetup.test.ts
npm run check:fast -- tests/presentation/editor/roomlessRecords.test.ts tests/presentation/editor/roomlessRecordRows.test.ts tests/presentation/editor/roomlessPlanningForms.test.ts tests/presentation/editor/planning/roomlessPlanningRecords.test.ts tests/infrastructure/persistence/roomlessPlanVersions.test.ts
npm run check
```

For screenshots use the existing matrix and targeted drivers with fixed source and artifact provenance. `node scripts/editor-visual-final-check.mjs` retains the original nine journeys and eighteen comparisons. Relevant additional drivers are `editor-room-edge-check.mjs`, `editor-object-rotation-check.mjs`, `editor-group-check.mjs`, `editor-curves-check.mjs`, `editor-stairs-arrows-check.mjs`, `editor-modal-placement-check.mjs` and `editor-caption-browser.mjs`. Treat selector drift after intentional UI changes as an instrument update requiring reviewed behavior assertions, not permission to omit a journey or lower a timeout.

Minimum regression acceptance:

- No-selection, Room, Area, wall/opening with and without room, element, group/multiple selection, task, paused/conflict and Review bodies preserve visible identity and action order.
- Keyboard and pointer entry reach the same operation. Native fields retain editing keys. Cancel/Escape/Finish obey draft, pending-input, busy and compensated-write rules; history contains one entry per successful intent and none for no-ops/refusals.
- Full ≥900 px, constrained 400–899 px and unsupported <400 px, both collapses, resizer keyboard/pointer, two leaves and repeated reflow preserve drafts, caret/focus, panel preferences and reachable canvas.
- Selection rank, Alt cycling, group/member selection, captions, locked/hidden geometry, hosted dependencies and context menus agree between hover and activation.
- Width/depth labels remain honest for eligible rectangles; rotated/free-form/curved Rooms use actual edge measures. EN/DE commas, precision, zero/no-op and invalid inputs retain their contract.
- Copy/Paste preserves scope, geometry scale, hosts/group remapping and exact undo, excludes planning links, survives cross-leaf use, refuses overlap before partial writes, and leaves text-field/system clipboard behavior intact.
- Calibration camera operations never move saved A/B image coordinates; preview and saved rescale agree across PNG/PDF, crop/rotation, cancel, stale conflict and read-back recovery.
- Inspect light/dark/custom accent, German long labels and narrow panes. Axe is supplementary; name the screen reader and audible observations if claiming screen-reader acceptance.
- Native Obsidian smoke covers actual keymap, focus after tab switch, panels after restart, same-plan split leaves, save/reopen files, and one safe peer-conflict path on a synthetic vault. Record unperformed device/fault cases precisely.

Planning-audit verification: HEAD checked, relevant source/docs/history read, no runtime or test execution, no browser launched, and only this memo written by this audit task.
