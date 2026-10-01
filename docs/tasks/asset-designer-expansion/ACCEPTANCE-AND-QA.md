# Acceptance, test fixtures and release evidence

All targets below are proposed acceptance criteria, not results from this planning session. Resolve real test locations and existing fixtures in AD00. Reuse existing tests before introducing another runner.

## 1. Fixture catalogue

| ID | Fixture | Why it exists |
|---|---|---|
| F01 | Measured rectangle/bench, 1200 × 450 mm, optional descriptive height | Minimal entry path without a reference. |
| F02 | Bathroom vanity assembled from a measured footprint and suitable existing sanitary details | Whole workflow. A specific vanity preset is not assumed to exist. |
| F03 | Straight-sided L-shaped footprint without details | Exposes accidental resize-to-rectangle replacement. |
| F04 | Curved outline/circular detail with an off-centre anchor | Arc policy, derived bounds, rotation and mirroring. |
| F05 | Measured footprint plus pending traced detail/clearance | Prevents accidental mixing of coordinate spaces. |
| F06 | One horizontal and one vertical open path, plus a bent polyline | Valid zero extent on one axis, open-path persistence/hit-testing/export. |
| F07 | Interleaved grouped and ungrouped elements with overlapping solid/dashed parts | Group/order/occlusion invariants. |
| F08 | Legacy v1 and v2 files, null shape, unusual labels and fractional dimensions | Migration and semantic preservation. |
| F09 | Malformed sidecars and unsupported future schema | Refusal, recoverability and no accidental overwrite. |
| F10 | One definition used in two projects and, where supported, one frozen revision | Live update scope versus historical output. |
| F11 | Missing/moved/deleted reference resources and renamed library notes | Stable identity and recoverable resource failures. |
| F12 | 25, 250 and 1000 graphic parts with documented vertex counts | Typical/stress performance and graceful degradation. |

Dimensions are test data, not recommended construction specifications. Keep canonical fixtures immutable; tests mutate temporary copies or a disposable vault.

## 2. Integrated user scenarios

### U01 — Create and place without a drawing

From the asset library, create a measured 1200 × 450 mm object with a name. Leave category, supplier, price and reference empty. Open its designer, add one recognizable detail, invoke Use in plan, place it, reopen both object and plan, and verify physical dimensions/identity. Cancel a second creation and confirm no orphan/placement remains.

### U02 — Compose a bathroom vanity

Use an existing suitable preset or a measured rectangle; do not fabricate an already-shipped vanity preset. Add/adjust basin and handle-like details, rename their user labels, select several, align them to an explicit reference, group/ungroup, duplicate and undo/redo. Set a back-centre placement point and front direction. Add a user-defined planning clearance, inspect the preview, and place in the plan. Show no compliance/fit certification.

Then duplicate as a new asset, edit the duplicate, and prove the original definition and its instances are unchanged. Editing the original shared definition must show its scope and obey historical-state policy.

### U03 — Draw a repeated bench detail

Create a measured bench, add one graphic slat, repeat it using a declared edge gap and count, group the slats, rotate/resize according to the accepted geometry rules, add an open seam, and save/reopen. Repetition must remain one undoable action, and the graphic slats must not become separate purchase quantities.

### U04 — Trace and calibrate deliberately

Use a local reference image or supported PDF page; calibrate a known length; lock/fade the reference; trace the footprint and add details. Test an uncalibrated trace first, then calibration, reference replacement and a missing file. Verify only pending groups are converted and no plan calibration changes.

### U05 — Recover rather than lose work

Open the same definition in two leaves. Make conflicting changes, fail a write and separately fail post-write refresh. Attempt undo while an earlier write is unsettled. Close/reopen a leaf and delete/move a note externally. Verify visible outcomes, stable IDs, no repeated mutations and recovery instructions.

### U06 — Preserve an issued view where supported

Freeze/issue through the product's actual existing workflow, then change footprint, graphics, anchor, facing, clearance and height in the live definition. Reopen/export the issued state and verify complete preservation. If no such workflow exists, test the explicit absence/gate and do not claim U06's frozen-state outcome has passed.

## 3. Behavior and regression matrix

| Test ID | Required assertion | Minimum test layer |
|---|---|---|
| T01 | L-shape resize retains topology; Replace footprint is explicit. | Domain + mounted UI |
| T02 | No-op/cancel/invalid dimensions produce no write or history entry. | Command + UI |
| T03 | Nonuniform circular-arc resize follows the accepted visible policy. | Domain + UI |
| T04 | Whole-object anchor stays fixed where required; height/calibration remain independent. | Domain + integration |
| T05 | Canonical values survive display-unit changes and fractional editing. | Domain + persistence |
| T06 | Pending flags survive every non-calibration edit correctly. | Domain + persistence |
| T07 | Mixed-space composition is refused rather than accidentally scaled. | Domain + gesture |
| T08 | Undo/redo cannot overtake write/read-back boundaries. | Session/fault injection |
| T09 | Queued work cannot deadlock by recursively joining its own queue. | Session |
| T10 | A successful write and failed refresh show stale content honestly. | Integration + UI |
| T11 | A retry does not duplicate a write whose outcome is uncertain. | Persistence + session |
| T12 | Two leaves retain expected-version conflict behavior. | Integration + real host |
| T13 | NoteVersion is never used as GeometryVersion or vice versa. | Application |
| T14 | Multi-part operation validates/persists as one aggregate change. | Domain + command |
| T15 | Preset/dimension/background/height/history operations all use the accepted sequencing policy. | Application + UI |
| T16 | Every supported legacy fixture migrates with semantic equality. | Actual mapper/store |
| T17 | Unknown future/corrupt sidecars are not overwritten or rendered as an editable empty asset. | Persistence + UI |
| T18 | User labels do not replace semantic names; IDs/order persist. | Model + persistence |
| T19 | Open lines remain open and valid with one zero axis extent. | Domain + persistence |
| T20 | Groups reject dangling/duplicate/nested membership. | Model + persistence |
| T21 | Group/ungroup does not move/reorder content. | Domain + rendering |
| T22 | Duplicate/repeat creates correct identities and deterministic redo. | Domain + history |
| T23 | Align/distribute honors reference, gap definition and fixed endpoints. | Domain + UI |
| T24 | Parts and canvas use one selection model; deleted selections prune correctly. | Component + integration |
| T25 | Escape, pointercancel, blur and outside release are safe. | Gesture/browser |
| T26 | Click-after-drag does not clear/retarget selection. | Browser |
| T27 | Keyboard input in forms/notes is not consumed by designer shortcuts. | Browser + real host |
| T28 | Edit locks/isolation do not change final output or quantity inputs. | Component + integration |
| T29 | Each new tool is actually registered, visible, functional and undoable. | Mounted integration |
| T30 | Every current asset renderer/exporter understands each geometry kind. | Rendering + export |
| T31 | Authoring overlays/reference images do not leak into final symbol by default. | Rendering + export |
| T32 | Theme changes preserve line visibility/occlusion without geometry changes. | Visual + geometry |
| T33 | Library thumbnail and plan views refresh after relevant asset changes. | Integration |
| T34 | Use in plan places the real definition at canonical size and returns context. | Browser + real host |
| T35 | Duplicate asset is independent, with stable references after rename/move. | Application + persistence |
| T36 | Partial create/duplicate failure does not leave misleading half-created objects. | Fault injection |
| T37 | Placement point/front match the coordinate convention after rotate/mirror. | Geometry + cross-surface |
| T38 | Required clearance review survives reopen; no false green fit claim. | Persistence + UI |
| T39 | Frozen/issued consumers preserve all supported referenced attributes, or unavailable capability is explicit. | Revision/export integration |
| T40 | Graphic editing does not change cost/quantity/work data by accident. | Product integration |
| T41 | Repeated view mount/unmount releases handlers, observers and pending resources. | Host/lifecycle |
| T42 | Compact panes keep primary actions and errors reachable. | Visual + keyboard |

## 4. Representative Gherkin acceptance criteria

```gherkin
Feature: Non-destructive object resizing
  Scenario: Resize a straight non-rectangular footprint
    Given an asset has a measured L-shaped footprint and no graphic details
    When I change its width through Resize object
    Then the footprint retains its L-shaped topology
    And its physical width reflects the committed value
    And no rectangle-replacement command has occurred
    And I can restore the original shape with one undo

Feature: Atomic composition
  Scenario: Undo a group alignment
    Given three compatible measured graphic parts are selected
    And the middle part is the alignment reference
    When I align the selected parts to that reference
    Then the reference part remains fixed
    And one validated shape update is committed
    When I undo
    Then all three parts regain their original coordinates and order

Feature: Honest persistence state
  Scenario: Write succeeded but refresh failed
    Given a move was persisted successfully
    And the subsequent read-back fails
    When the designer displays the operation outcome
    Then it identifies the displayed content as stale
    And it does not repeat the move when I retry the refresh

Feature: Calibration isolation
  Scenario: Calibrate only newly traced geometry
    Given a measured footprint and a pending traced detail exist
    And a plan references the asset
    When I calibrate the asset reference
    Then only the pending coordinate group is converted
    And the measured footprint is unchanged
    And the plan calibration is unchanged

Feature: Safe shared-definition reuse
  Scenario: A frozen revision is independent from a live definition
    Given a supported frozen plan revision includes an asset definition state
    When the live asset's anchor, facing, details and clearance are edited
    Then the frozen revision still uses its preserved state
    And its supported export remains reproducible
```

Use the last scenario only when the actual frozen-state capability exists. Test capability gating separately otherwise; do not mark an unavailable feature as passed.

## 5. Environment and visual coverage

Record Windows/Obsidian version, Node/npm, supported browser, device scaling, viewport/leaf size, theme and fixture. Test light and dark host themes, a compact desktop leaf, a medium pane and a wide pane. Suggested leaf widths: 520, 900 and 1400 CSS pixels, adjusted to actual host constraints. Also inspect focus/navigation at enlarged UI/text scaling.

Inspect every S00–S11 state. Label screenshots with task, state, theme, width and exact commit. The two generated reference boards are not screenshots of implemented software and never count as execution evidence.

Keyboard checks cover entering/leaving the canvas, selecting rows, rename, numeric transforms, duplicate/delete, undo/redo, dialogs/drawers and visible alternatives to pointer-only actions. Add accessible names and field errors through current components. A canvas alone is not sufficient accessibility support.

Browser harness and real Obsidian checks are separate. Only the latter validates host back/forward, per-leaf subject restoration, plugin remount/unload and interaction with a note editor. Do not present an unrun manual case as a result.

## 6. Proposed performance and usability gates

Approve or revise these with evidence rather than silently weakening them:

| Metric | Proposed acceptance target | Measurement condition |
|---|---|---|
| Selection response | p95 at most 100 ms | 250-part fixture, warmed renderer, recorded hardware and leaf width. |
| Drag frame time | p95 at most 33 ms | 250-part fixture during representative multi-selection drag. |
| Warm asset opening | At most 1 second for the agreed typical fixture | Record separately from cold disk/reference loading and plugin startup. |
| Stress behavior | No crash, unbounded write burst or irreversible UI lock | 1000-part fixture with documented path/vertex complexity. |
| Lifecycle | No monotonic retained-listener/observer growth | 50 repeated open/close cycles after warm-up; document collection/measurement limits. |
| Preset creation/placement | At least 4 of 5 novice test participants complete without facilitator instruction within 3 minutes | Proposed research target, not a measured usability claim. |
| Group/align comprehension | At least 4 of 5 complete the specified task and identify the alignment reference | Capture errors and misleading labels, not just completion time. |

Do not generalize benchmark results to arbitrary hardware or unlimited drawing size. Test optimization effects against unchanged geometry/persistence behavior. Do not add workers, spatial indexes, layer caches or a new rendering system solely because they appear scalable on paper.

## 7. Release gate

AD16 requires accepted AD15 evidence, current package gates, cross-consumer support, legacy upgrade/recovery, no unresolved critical/high issues, honest limitations and verified host behavior for essential workflows. A blocked browser or host test remains blocked; it is not replaced by a green unit-test count.

For schema rollout, retain a verified backup and document the compatibility boundary. Restoring an older plugin binary without restoring compatible data is not a rollback plan. Stage trial upgrades only in disposable copies of a vault.
