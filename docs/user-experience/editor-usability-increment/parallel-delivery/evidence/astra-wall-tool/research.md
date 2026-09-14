# Wall tool research and interaction contract

Research date: 2026-09-14. Product Design audit setup/preflight and Impeccable context/polish/craft guidance were used. No saved Product Design context existed. The incumbent Obsidian design and approved directions 1+3 remain authoritative. RemPlanner supplies interaction inspiration only.

## Primary sources and evidence

- [Official step-by-step support](https://remplanner.com/de/planner/support/): describes press-drag-release wall creation, visible connection feedback and short-click selection with endpoint/midpoint manipulation. These are instructional claims, separate from observed interaction below.
- [Official FAQ](https://remplanner.com/de/planner/support/faq/), sections 2.2–2.4: describes right-click editing, thickness before drawing, direct numeric entry afterward, and a dedicated per-side thickness action. The thickness answer specifies integer centimetres; the general unit answer elsewhere mentions millimetres/centimetres/inches. We do not infer a uniform precision contract from those statements. Section 4.2 warns of downstream finishing data loss after room changes; that pattern is rejected here.
- [Official home](https://remplanner.com/de/), then [anonymous planner](https://remplanner.com/de/planner/): publicly reachable without login or account creation. Current-run in-app Browser captures show a 330 cm wall created by press-drag-release, a right-click popup with length/thickness/material, and the dedicated four-control thickness state. No proprietary code/assets were copied. Anonymous session only; no account or personal data.
- User reference images `05e656f9`, `6ad21884`, `fb2f0772` were all inspected before design. They depict those three wall states but are pale/cropped references, not current-run verification. The later `d9894f7a` opening reference was inspected separately.

Accepted capture inventory: `01-remplanner-faq.jpg` (expanded thickness answer), `02-remplanner-drawn.jpg` (wall and parameter panel), `03-remplanner-popup.jpg` (right-click fields/actions), `04-remplanner-adjust.jpg` (side controls). Captures are research evidence; only the publicly exercised wall flow is an audit. Accessibility limits: most canvas controls in the reference are graphical and did not expose distinct names in the available accessibility tree. No assistive-technology certification or performance claim.

## Inventory before changes

| Concern | Existing contract and disposition |
| --- | --- |
| Creation | `StructureTool`, `structureDraft`, `StructureTaskForm`: click-built continuous chains, numeric coordinates/length/angle, close loop, undo last point, optional room creation. Preserve these established contracts. |
| Thickness before drawing | Already stored in `draft.text.thickness`, but hidden with height under Dimensions. Expose it before placement and add 0.1/0.15/0.2 m convenience presets; these are selectable values, not material recommendations. |
| Measurement/snapping | `WallDraftOverlay`, `StructureTool`, `wallJoin`: live segment lengths/angles, snap guides, endpoint/body joining and split-cut feedback already exist. Do not duplicate or replace them with a second drawing gesture. |
| Geometry/storage | `Wall` stores one `thickness` in mm around `start/end` (with optional bulge). No independent face offsets. Symmetric controls are truthful; side-specific arrows would imply unsupported geometry. |
| Rendering/joins | `wallBody`, `wallPasses`, `StructureLayer` use half thickness on either side and derive join caps from neighbouring thicknesses. Centre-line endpoints and topology stay fixed. |
| Openings | `openingGeometry`, `OpeningSymbols`: host-relative offset, width, sill and swing; frame/cut depth derives from host thickness. Thickness changes preserve the opening object and along-wall position. |
| Selection/rotation | Selection store, wall endpoints, rotation actions and viewport remain separate from persisted thickness. Preview must retire when selection/tool/perspective changes. |
| Details | Structure facts and Edit geometry already expose thickness with preview/apply. Preserve the complete keyboard/non-canvas form; add the focused adjustment entry as another route. |
| Commands/persistence | `StructureCommand` validates and conditionally writes the geometry sidecar, records WriteLedger, publishes projection refresh and owns inverse/redo. Reuse it; no schema change or migration. Initial admission is checked around asynchronous version reads; successful history remains usable after the preview session closes. |
| Units | Current editor length contract is `formatMetres`/`parseMetres`: metres displayed, comma or point accepted, edited values normalized to whole mm. Per-plan display-unit selection is not yet implemented. Reuse that contract and preserve untouched sub-mm stored precision. |
| Localization/accessibility | EN/DE structure tables, host icons/tokens, labelled DOM controls, focus entry/return, polite preview/save state and inline invalid/refusal messages. Canvas affordances supplement Details. |

## Decisions

1. **Direct entry:** right-click a selected wall → Enter wall thickness → compact numeric popup with Apply and Cancel. Shift+F10/ContextMenu is the keyboard route. It edits only thickness, not length/material.
2. **Focused adjustment:** right-click → Adjust wall thickness, or Details → Adjust wall thickness. One pair of 44 px minus/plus buttons adjusts the whole wall; adjacent text explicitly states that both sides move equally and the centre line remains fixed. It is not per-side geometry.
3. **Increment/bounds:** 10 mm total thickness per activation (5 mm per face). Near a bound the last step clamps. Bounds are the existing spatial dimension sanity range, 1–1,000,000 mm, not construction advice. Invalid, nonfinite, zero, negative or over-limit inputs do not preview or save. Direct entry retains millimetre precision.
4. **Transaction:** typing/steps show a transient preview; Apply saves the whole session as one reversible command. Cancel, Escape, a new outside pointer action, selection/tool changes or leaving Plan discard the preview. No-op Apply is disabled. Busy/read/refusal states are explicit; saving suppresses duplicate Apply/edits/cancel. A write already admitted to persistence completes normally; mode navigation is disabled while saving.
5. **Layout/focus:** panel stays inside the canvas above taskbar clearance, scrolls within short panes, and closes the narrow Details overlay on entry. Input receives focus; Tab reaches step and footer controls; normal Enter applies, repeated/composed/chorded Enter is suppressed. Escape returns to the connected opener, otherwise canvas. No selected-item Add detail is restored.
6. **Rejected expansion:** no per-side offsets, materials catalogue, 3D, CAD/BIM assumptions, copied RemPlanner styling, or replacement of the existing click-chain workflow. I18 arbitrary Room/Area-corner editing remains separate and open.

## Door/window follow-up packet

The additional reference shows three circular along-wall points, paired vertical arrows, paired horizontal arrows, swing arc and measurements. A static image does not prove whether the vertical arrows resize or move; that meaning needs live/public confirmation.

Existing: direct hosted move (`openingMove.ts`, `OpeningMoveTool.ts`), exact offset/width/height/sill (`StructureEditForm.vue`), hinge start/end, side left/right and angle (`OpeningSwingFields.vue`), and host-derived symbols. Missing: a compact direct opening-size/swing popup and clearly named width/offset steps or hinge/swing flips with preview/Apply/Cancel and 44 px keyboard controls. Endpoint resizing needs a fixed-end versus centre-anchor decision, host containment/overlap refusal, and curved-host `alongWall`/`projectOntoWall` semantics. Also audit the `openingMove.ts` own permitted predicate, which currently excludes Review rather than explicitly requiring Plan.

Proposed ownership: new `openingDirectActions.ts`/`OpeningDirectPanel.vue`, opening movement/swing/details files as needed, dedicated CSS and tests/help. Shared seams changed by this wall branch: `PlanCanvas.vue`, `StructurePlanActions.vue`, `useCanvasMenuActions.ts`, `structureActions.ts`, EN/DE `structure.ts`, and optional initial admission in `StructureCommand`. Land the follow-up above this branch or coordinate those seams. Packet sent to adoption coordinator task `01a0a064-04e7-7252-becf-c54cdc07819d`; no opening UI is half-implemented here. Wall tests verify hosted opening preservation. No color-task files are owned.
