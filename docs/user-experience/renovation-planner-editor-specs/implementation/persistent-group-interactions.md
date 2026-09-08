# Persistent group interactions

The user's release expansion requires saved groups, drag selection, assembly movement,
and explicit automatic Room enclosure. Schema 6 foundation commit `587f0266` supplies
flat floor-owned membership and a conditional, single-sidecar reversible command.
This follow-up connects that model to the editor.

Normal canvas and list selection expands a saved group. Alt retains individual
overlap selection. Group identities never replace the actual selected member IDs.
Marquee hits expand saved groups; Shift-marquee retains valid hidden members already
selected. Explicit Alt marquee selects individual hits.
Walls include their present and future hosted openings. Hidden members remain part
of rigid movement and rotation. The hover arrows show the group envelope without
changing selection; pressing an arrow admits the group explicitly.

Inspector and object-aware context-menu actions expose Group, Ungroup and Enclose
with walls. Enclosure reuses exact boundary walls, creates missing edges with the
existing 150 mm / 2400 mm defaults, and saves membership in the same undo step.
It is an explicit operation; later independent Room edits do not silently rebuild
walls. Group transformation controls expose exact numeric movement and rotation,
including quarter turns. Unmodified body drag moves the whole selection. A change
to connected wall endpoints outside the selection receives impact review.

Each gesture captures original geometry and a generation, then reads a fresh
conditional sidecar version before writing. Tool, perspective, selection or member
geometry changes retire that intent. No-op and cancelled gestures write nothing.
One group command supplies one undo entry and preserves hosted opening parameters
and intended geometry. A saved write cannot be replayed after a failed readback.

## Verification state

Checked on 2026-09-09 over combined base `0ce4e317`, including the verified schema 7
foundation. The 25-case batch covers 18 new grouped-interaction/gesture cases plus
existing group rotation and command cases in four files:

- `tests/presentation/editor/groupEditing.test.ts`
- `tests/presentation/editor/groupGestureGeometry.test.ts`
- `tests/presentation/editor/groupRotationPresentation.test.ts`
- `tests/application/commands/groupGeometry.test.ts`

It verifies native-tree/runtime action wiring, persisted enclosure and saved-group
reopen, implicit later openings, hidden members, immutable drag, decimal numeric
rotation, duplicate Apply admission, peer retirement, exact history, curved Room/
Wall bend preservation, and failed-readback recovery without another write.

`vue-tsc -noEmit`, scoped ESLint with zero warnings, whole Oxlint 1.81 with warnings
denied, `node --check scripts/editor-group-check.mjs`, and `git diff --check` pass.
The shared ignored dependencies were aligned from an existing install with the
identical lockfile before this verification: Konva 10.3.2, Zod 4.5.4, compiler-sfc
3.5.42, Oxlint 1.81, and Fallow 3.22. Vitest reports 4.1.11. No lockfile or check
threshold was changed.

The supplemental browser journey is authored but unrun. Multi-Room measurement
preview and curved rendering require the curve UI continuation; stairs are a later
schema 8 dependency. Full integrated coverage/static analysis, final comparisons
and actual native-host acceptance remain pending. These focused results do not
claim those observations.

### Individual member selection follow-up

Group transform controls now reflect the actual selection. Selecting one member
explicitly exposes its own editing controls; it no longer shows a group Move field
whose captured selection would refuse. The Inspector and context menu offer Select
focused item and Select saved group without changing persisted membership. Right
click focuses the actual member while retaining the group, and Inspector focus is
retained across the selection transition.

The follow-up's scoped ESLint/whole Oxlint checks and 20 cases in the two grouped
interaction/gesture files pass, including the two new selection-route regressions.
Joined type/scene and final browser/native verification remain tracked by the
integration branch.
