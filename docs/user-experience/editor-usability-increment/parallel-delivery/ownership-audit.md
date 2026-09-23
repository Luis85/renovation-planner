# Parallel delivery ownership audit

**Scope.** The hybrid direction is user-selected; its individual mockup screens are illustrative, not separately approved specifications. This is a delivery proposal only. It covers the compact rail, canvas-first shell, readable Details, distinct Plan/Renovate content, no Renovate geometry gesture writes or handles, room creation, precise edits, staged reference setup, the existing direct Paste, and narrow/dark/recovery states. Plan from `ba7fce3ad`; each coding session starts a fresh `codex/editor-usability-<packet>` worktree from `origin/main` after its prerequisites merge.

**Path convention.** Short sources are under `src/presentation/editor/`; short editor tests are under `tests/presentation/editor/`; styles are under `styles/`. `[new]` means a prospective path. Every other named path exists in this worktree.

## Concrete ownership and collision rules

| Concern | Existing source paths | Existing focused tests |
|---|---|---|
| Runtime, root keys, history | `PlanEditorRoot.vue`, `runtime.ts`, `escapeRouting.ts`, `surface/historyShortcut.ts` | `shell.test.ts`, `escapeRouting.test.ts`, `inputInteractions.test.ts`, `history.e2e.test.ts`, `tests/plugin/planEditorWiring.test.ts` |
| Shell and Details | `shell/ResponsiveEditorShell.vue`, `EditorSidePanel.vue`, `PanelRail.vue`, `EntityInspector.vue`, `PropertyLayerPanel.vue`, `EditorContextBar.vue` | `shell/responsiveShell.test.ts`, `sidePanels.test.ts`, `panelLayout.test.ts`, `panelResizer.test.ts`, `shell/floorInspector.test.ts`, `shell/roomInspector.test.ts` |
| Plan/Renovate gesture and content | `renovation/renovationSession.ts`, `renovation/renovationActions.ts`, `renovation/RenovationEntry.vue`, `renovation/RenovationInspector.vue`, `planning/PlanningInspector.vue`, `layers/InteractionLayer.vue`, `structure/StructureLayer.vue`, `tools/select-tool.ts` | `renovationWorkflow.test.ts`, `renovationRoutes.test.ts`, `renovation/reviewPresentation.test.ts`, `selection/spatialSelection.test.ts` |
| Room, dimensions, snap, selection | `add/AddMenu.vue`, `add/room-draft-store.ts`, `shell/NewRoomInspector.vue`, `resize/RoomDimensionLabels.vue`, `resize/InlineRoomDimension.vue`, `resize/RoomEdgeMeasurements.vue`, `layers/SnapGuides.vue`, `shell/StatusBar.vue`, `shell/SelectionGuidance.vue` | `add/addMenu.test.ts`, `add/roomDraftStore.test.ts`, `roomCreation.e2e.test.ts`, `roomDimensionInline.test.ts`, `roomEdgeMeasurements.e2e.test.ts`, `snapping/snapService.test.ts`, `selection/resolveSelectionTarget.test.ts` |
| Direct Paste and reference setup | `selection/CanvasContextMenu.vue`, `selection/useCanvasMenuActions.ts`, `clipboard/clipboardActions.ts`, `clipboard/editorClipboard.ts`, `reference/ReferencePreview.vue`, `reference/ReferenceSetupForm.vue` | `clipboard.test.ts`, `tests/application/commands/pasteCommand.test.ts`, `referenceSetup.test.ts`, `referenceViewportControls.test.ts`, `referenceWorkflow.e2e.test.ts` |
| Copy and styles | `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`, `src/presentation/i18n/locales/en/editor.ts`, `src/presentation/i18n/locales/de/editor.ts`, `styles/index.css` | `tests/presentation/i18n/strings.test.ts`, `tests/gates/language-resolution-boundary.test.ts`, `shellFidelity.test.ts`, `tests/harness/accessibility.test.ts` |

- **G1 — root/input/history:** `PlanEditorRoot.vue`, `escapeRouting.ts`, `surface/historyShortcut.ts`, `clipboard/clipboardActions.ts`, and `shell/TemporaryToolBanner.vue`. One senior-reviewed change at a time. No packet proposes rewriting the existing direct-Paste shortcut/root route.
- **G2 — shell:** `shell/ResponsiveEditorShell.vue`, `EditorSidePanel.vue`, `PanelRail.vue`, `EntityInspector.vue`, `EditorContextBar.vue`, and `shell/panelLayout.ts`. One active packet at a time.
- **G3 — Renovate gesture policy:** `tools/select-tool.ts`, `layers/InteractionLayer.vue`, `structure/StructureLayer.vue`, `elements/ElementShapes.vue`, and `elements/ObjectRotationHandle.vue`. One active packet at a time.
- **G4 — locale and CSS integration:** only the integrator edits `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`, and `styles/index.css`.

## Prerequisite and atomic integration

**P01 — contract, selectors and vocabulary (integrator; strong reviewer).** Add `tests/presentation/editor/editorUsabilityContract.test.ts` **[new]** and reserve every agreed editor-usability key directly in the already-integrated `src/presentation/i18n/locales/en/editor.ts` and `src/presentation/i18n/locales/de/editor.ts`. The contract must state that Renovate rejects geometry gesture writes as well as drawing no handles, and that Paste remains available through its existing context-menu and keyboard routes. Do not change runtime behavior. Verify the new test and `tests/presentation/i18n/strings.test.ts`.

There is no late locale/CSS wiring packet. Each UI packet that adds a CSS partial is accepted only when the integrator adds its `styles/index.css` import in the **same atomic integration PR**, before visual verification. No unimported CSS partial is merged. Packets use P01's already-wired keys; no orphan locale module is created.

## Small packets

| ID | Exact owned paths; bounded outcome | Prerequisites and checks | Owner |
|---|---|---|---|
| P02 | `shell/PanelRail.vue`, `shell/ResponsiveEditorShell.vue`, `styles/editor-usability-rail.css` **[new]**, `shell/repeatedRailActivation.test.ts`, `shell/responsiveShell.test.ts`: make Property/Layers and Details reachable in the constrained rail. | P01; G2. Integrator imports the new CSS atomically. Run both named shell tests and `tests/harness/accessibility.test.ts`. | Luna/Terra |
| P03 | `shell/EntityInspector.vue`, `styles/editor-usability-details.css` **[new]**, `shell/floorInspector.test.ts`, `shell/roomInspector.test.ts`, `shell/multiSelectionInspector.test.ts`: stabilize the Details frame and readable information order. | P02; G2. Atomic CSS import; run named tests and `shellFidelity.test.ts`. | Terra |
| P04 | `renovation/RenovationEntry.vue`, `renovation/RenovationInspector.vue`, `planning/PlanningInspector.vue`, `styles/editor-usability-modes.css` **[new]**, `renovationRoutes.test.ts`, `renovationWorkflow.test.ts`, `renovation/reviewPresentation.test.ts`: differentiate Plan and Renovate content without changing persistence semantics. | P01; atomic CSS import; run named tests. | Terra |
| P05 | `tools/select-tool.ts`, `layers/InteractionLayer.vue`, `structure/StructureLayer.vue`, `elements/ElementShapes.vue`, `elements/ObjectRotationHandle.vue`, `renovation/gestureWriteGuards.test.ts` **[new]**: Renovate draws no geometry handles and rejects vertex, wall, element move, rotation, marquee/group gesture writes; Plan and Review retain their respective contracts. | P04; G3; strong review. Run new test, `selection/spatialSelection.test.ts`, `renovationRetiredActions.test.ts`, and `renovation/reviewPresentation.test.ts`. | Strong reviewer |
| P06 | `add/AddMenu.vue`, `shell/NewRoomInspector.vue`, `add/room-draft-store.ts`, `styles/editor-usability-room-creation.css` **[new]**, `add/addMenu.test.ts`, `add/roomDraftStore.test.ts`, `roomCreationWiring.test.ts`, `roomCreation.e2e.test.ts`: clarify entry, draft, completion and cancellation for Room creation. | P01; atomic CSS import; run named tests. | Luna/Terra |
| P07 | `resize/RoomDimensionLabels.vue`, `resize/InlineRoomDimension.vue`, `resize/RoomEdgeMeasurements.vue`, `resize/DraftRoomDimensions.vue`, `styles/editor-usability-precision.css` **[new]**, `roomDimensionInline.test.ts`, `roomDimensionLifecycle.test.ts`, `roomEdgeMeasurements.test.ts`, `roomEdgeMeasurements.e2e.test.ts`, `resize/roomDimensions.test.ts`: improve eligible rectangular dimensions while retaining true edge measures for other shapes. | P01; atomic CSS import; run named tests. | Terra |
| P08 | `layers/SnapGuides.vue`, `shell/StatusBar.vue`, `shell/SelectionGuidance.vue`, `styles/editor-usability-feedback.css` **[new]**, `snapping/snapService.test.ts`, `snapping/lineDrawingConstraints.test.ts`, `selection/resolveSelectionTarget.test.ts`, `selection/spatialSelection.test.ts`: clarify acquired snap/constraint and ambiguity without changing selection rank. | P01; atomic CSS import; run named tests. | Luna/Terra |
| P09 | `reference/ReferencePreview.vue`, `reference/ReferenceSetupForm.vue`, `styles/editor-usability-reference.css` **[new]**, `referenceSetup.test.ts`, `referenceViewport.test.ts`, `referenceViewportControls.test.ts`, `referenceWorkflow.e2e.test.ts`, `referencePdfCleanup.test.ts`: stage reference setup and distinguish navigation from point placement without changing calibration storage. | P01; atomic CSS import; run named tests. | Terra |
| P10 | `selection/CanvasContextMenu.vue`, `selection/useCanvasMenuActions.ts`, `clipboard.test.ts`, `tests/application/commands/pasteCommand.test.ts`: prove the existing direct Paste is discoverable and accurately describes scope/refusal; patch only presentation wording or state if that proof fails. Do not touch root keys, `historyShortcut.ts`, `clipboardActions.ts`, or clipboard command semantics. | P01; no CSS or root change. Run both named tests. | Terra |
| P11 | `shell/TemporaryToolBanner.vue`, `shell/PersistentWarningStrip.vue`, `forms/DraftRecovery.vue`, `shell/temporaryToolBanner.test.ts`, `shell/warnings.test.ts`, `inputInteractions.test.ts`, `tests/plugin/guardCategory.test.ts`: make blocked, stale, busy, cancel/finish, and failed-read-back recovery understandable without altering Escape or write guards. | P01; G1 review. Run named tests. | Strong reviewer |
| P12 | `styles/editor-usability-theme.css` **[new]**, `shellFidelity.test.ts`, `shell/responsiveShell.test.ts`, `tests/harness/accessibility.test.ts`: dark and narrow refinement over merged functional changes. | P02–P09; atomic CSS import; run named tests. | Luna |
| P13 | `tests/harness/accessibility.test.ts`, `shellFidelity.test.ts` only if an integration assertion is demonstrably required: final cross-packet regression and integration ledger. No locale, CSS-index, root, or feature rewrite is authorized here. | All preceding accepted packets. Run focused shell/input/clipboard/reference/renovation tests, then `npm run check:fast`; reserve `npm run check` for the final branch. | Integrator + strong reviewer |

## Safe waves (at most three coding sessions plus one integrator)

| Wave | Coding sessions | Integrator action |
|---|---|---|
| 0 | P01 | merge the contract and available keys |
| 1 | P02, P04, P06 | atomically import each accepted new CSS partial before its visual checks |
| 2 | P03, P07, P09 | merge P02 before P03; atomically integrate each CSS partial |
| 3 | P05, P08, P10 | start P05 only after P04; preserve Paste runtime paths |
| 4 | P11, P12 | serialize P11 under G1; atomically import P12 CSS |
| 5 | P13 | run the cross-packet regression matrix |

Each session uses `origin/main` plus its merged prerequisites, never another session's unmerged branch. The integrator admits one accepted packet at a time and reruns its focused checks after the atomic integration edit.

## Reviewer focus

- `tools/select-tool.ts` is the command/history seam for P05. Confirm Renovate starts no geometry gesture and commits no geometry write, rather than merely hiding its markers.
- Responsive focus restoration and Escape routing are established behavior. P02, P03, and P11 must not modify `PlanEditorRoot.vue` or `escapeRouting.ts`.
- Direct Paste already has both `selection/useCanvasMenuActions.ts` and `surface/historyShortcut.ts` paths. P10 verifies/polishes its existing surface; it does not rebuild it.
- Reference work must preserve pointer capture, A/B image coordinates, PDF cleanup, rescale consent, cancellation and stale recovery.
- The final matrix covers Plan/Renovate/Review; no selection, Room, Area, wall/opening, element, group, temporary room task, blocked/stale state; 900 px, 400–899 px, under 400 px; dark theme, German labels, cross-floor Paste, and PNG/PDF reference setup.
