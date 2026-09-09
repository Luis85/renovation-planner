# Input interaction delivery reconstruction

Status: **cumulative validation pending**. Branch `codex/editor-deliver-input`
starts at clean Opening5 tip `a6278ea5ca7f30f697fa81a459b9e59d0c4c6eea` after Room
edges, creation, rotation presentation, shell, details, native icons and the
published PR94 → PR95 → PR96 stack. Source tip before this mapping:
`f65acb9393446e188f5c1ea48fd9361a2023b751`.

| Original source | Reconstructed source |
|---|---|
| `2f2e99c30c527b3223ab0fb09a97e69f66f2cb59` | `45e5f4623b82f328f4ff6419fa91095279227c62` |
| `8db2c264d71e2c0ecafd6e8ef9304337d58bb582` | `0b42f6d71baefb68735118dd53c378c3e4d6fa79` |
| Input-only tests from `8a97bf655674d03aa12ffcf7d8fa486eb81a3702` and relevant `42957551` hover extraction | `f65acb9393446e188f5c1ea48fd9361a2023b751` |

This concern adds empty-canvas marquee selection, Shift union, explicit Pan,
guarded editor history shortcuts, typed context actions and shared Zone drawing
constraint behavior. Canvas candidates respect visible layers; sidebar records and
full group cohorts remain separate. Group ports are optional and expose only real
provided actions; no persisted Group/Curve/Stair source is included.

## Shared-file reconciliation

- Both SelectToolDeps and EditorToolDeps extend the complete SelectionInteractions
  interface. Forward selectionMove and expandSelection together with hover's
  rotationDisplayTarget and rotationControls callbacks. SelectionInteractions was
  already the full, identical interface in the clean predecessor; no second copy
  or narrower Pick replaced it.
- Admit rotation before ordinary candidate lookup/focused-member handling. Retain
  the body group path and null-target marquee path. A refused group start does not
  fall back to moving an individual member.
- Preserve PR95's discardGesture helper, adding group-move and marquee cancellation
  there. Cancel retains hover; deactivate clears ordinary and rotation hover.
  Keep Alt suppression, selection-preserving hover and reacquired rotation targets.
- Remove duplicate SelectionInteractions imports during conflict resolution and
  use exactly the relevant updateHover extraction from `42957551`. No other later
  ancestry or Group/Curve implementation was imported.
- Keep Opening5's successful pointer placement/finish branch in StructureTool and
  the predecessor's opening/Room-edge locale additions while sharing the existing
  drawing constraint helper. Rotation's own angle snapping remains unchanged.

## Tests and changed-file audit

The two feature sources touch 33 distinct paths. Final blobs match the latest
source owner for 26; the seven expected differences are StructureTool (Opening5),
registerEditorTools/SelectTool (the reconciled contracts above), EN/DE editor
aggregators (Opening5 and Room edges), and the two extended input/marquee test files.
The historical editor-input-interactions receipt is unchanged.

Three transferred test files exactly match `8a97bf65`: contextMenuActions,
contextMenuLifecycle and inputInteractions. marqueeSelection matches except for
the inherited Stair-footprint case, deferred to the Stair concern along with
stairFormGuards. The four input additions exercise native context/focus lifetime,
typed edit/rename/delete/rotate routes, history guards and optional group delegation;
they do not require persisted groups. No test assertions or thresholds were weakened.
There are 34 changed paths relative to Opening5 before this mapping, which adds one.

Only source/conflict inspection, Git blob/diff comparison and `git diff --check`
were performed. Tests, types, lint, Fallow and browser/native capture are **unrun**
for this reconstructed revision. The original input-coverage source receipt was
28/29 before its Room-deletion expectation correction; that historical result is
not a claim about this delivery tip. Root's cumulative checks must verify the final
source. No heavy run, push, PR, published-branch rewrite or merge of unrelated
integration ancestry was performed.
