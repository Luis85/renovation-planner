# Group UI delivery reconstruction

Current PR #113 follow-up: [implementation and automated verification](../group-ui-delivery.md).
The reconstruction receipt below is historical; manual acceptance is user-owned
and pending, and does not block the current implementation step.

Status: **cumulative validation pending**. Branch `codex/editor-deliver-groups`
was reconstructed independently from clean Curve7/UI tip
`0a049e270de7b0dbdd4ba88e000866fe34f8634d`. The independently reconstructed Opening
Move concern was then joined as its parent. Final intended PR base:
`codex/editor-deliver-opening-move` at
`2b81464635aad433b3e08cbebe5cff9c990d6b5a`. No verification/integration branch ancestry
or future Stair8 source was imported.

| Original source | Reconstructed source |
|---|---|
| `f8028295` | `b2ae770579a80d2f017fa4ee692ddd72ba535565` |
| `f7e35ef4` | `c6fc1f98aa055d401e6aae72bbc1bfb2bffa5544` |
| `f3b40149` | `497ead72c52e06d4bcc053034886ae69472a0fee` |
| `6ed17be3` | `bb535a76f37ae088633f9abd2e4da2eb7a80cbac` |
| Group-pointer test from `eb59fc2b`; only Group-hover fixture amendment from `a8180bd6` | `e6bbfa9d` |
| Clean Opening Move parent `2b814646` | merge `969b3206c97b553dcd79091149f5e3565bed83b4` |

The source/parent-join tip before this mapping is `969b3206`. Published PR94 →
PR95 → PR96 remain unchanged in the clean predecessor chain.

## Reconciled contracts

- Retain the public RotationRuntime type, inline wall capability and explicit
  CurveTaskRuntime; extend rotation with the Group facade without restoring private
  Runtime aliases or unused WallRotationActions exports.
- Compose Group, Curve and element actions in createSpatialEditing. Forward full
  selectionMove/expandSelection and all hover display/control callbacks. Preserve
  member focus, individual/saved-group selection, marquee expansion, Alt admission
  and PR95's discardGesture behavior.
- Curve preview wins over Group preview, then the existing persisted/draft routes.
  ZoneLayer receives the selected preview's objects array. RoomDimensionLabels
  receives the complete document. StructureLayer and interaction candidates retain
  curve-first/group-second geometry; curved boundaries and marquee contacts remain
  analytic rather than reverting to chords.
- Preserve Group6 error/recovery copy and Curve7 locale spreads while adding Group
  labels. Keep all existing Fallow CLI entries and add the real Group driver.
- The Opening Move parent merge conflicts only in runtime composition. Keep its
  createStructureEditing factory and openingMove facade alongside the complete
  createSpatialEditing result, including Group and Curve. StructureLayer retains
  Opening Move's host highlight and shared structure preview route.
- Numeric Group rotation shows the affected outside-wall count in the existing
  preview dialog. Its existing Apply remains the single confirmation/dispatch;
  no nested modal drops the angle draft. Snapshot, fault and one-write guards stay
  intact. Hidden members and hosted openings retain the original Group contracts.

## Source and evidence audit

The four complete source commits touch 40 distinct paths. Final blobs match their
latest original owner for 24. The 16 differences retain prerequisite context in
Fallow/changelog, objectRotation/rotationActions/spatialEditing, PlanCanvas,
InteractionLayer/runtime/MarqueeSelection/EntityInspector/StructureLayer/SelectTool,
the two editor locale aggregators and the two Group locale files. Each is a shared
contract described above; no additional feature ancestry was copied.

Both selectively copied test files exactly match their requested source blobs.
The RoomInspector hunk from `a8180bd6` was already delivered with rotation and was
not copied again. Application Group-write/event census tests from `eb59fc2b` remain
with the Group foundation concern; this branch transfers its pointer test only.
The original persistent-group and native-behavior receipts are preserved at their
latest specified source blobs, retaining their original SHAs and limitations.
No image, capture manifest or evidence bytes changed.

Relative to the final Opening Move PR base, the source changes 40 paths; this
mapping adds one document. Only source/conflict inspection, Git blob/diff comparison
and `git diff --check` were performed. Tests, types, lint, Fallow and browser/native
captures are **unrun** for this cumulative delivery revision. Historical passed or
unrun claims do not validate the reconstructed SHA. No heavy run, push, PR or root
integration edit was performed. Root owns cumulative verification and publication.
