# Rotation presentation delivery reconstruction

Base: clean shared-shell concern `6fee2df45a84fecb35ec9535b64ca766cda1c55c`, following native icons and contextual details after published PR94 → PR95 → PR96. No published branch was rewritten. This branch combines the final hover-arrow interaction in one concern; intermediate labelled-control images remain historical evidence.

| Original source | Reconstructed source |
|---|---|
| `0dd0841e` | `037db8dd` |
| `7e296667` | `3f2b7436` |
| `1245d2d7` | `52d51ae3` |
| `2da62460` | `dd72d5af` |
| `c5e93f64` | `5338f7c1` |
| `fff1d3ca` | `d3fa4500` |
| `5853827a` | `f20c537e` |
| `da58c822` | `8377489e` |

The standalone RoomInspector fixture hunk from `a8180bd6` is also retained: it supplies a typed unavailable rotation facade and asserts that no rotation controls appear. Its Group-hover test amendment belongs to the later Group UI concern.

## Shared-file reconciliation

- Retain the seven shell icons and add both native rotation icons.
- Restore every rotation hunk deferred by contextual-details: the selected-Zone heading fallback; Area More actions; Room rotation inside RoomRenovationDetails More actions; and Structure rotation inside its existing More actions. Existing context and evidence navigation remain intact.
- Keep PR95's public RotationRuntime and inline wall capability; add the optional future group-target callback without resurrecting a private Runtime alias or unused WallRotationActions export.
- Preserve PR95's discardGesture lifecycle and add hover display/control admission. The later input concern must extend the full SelectionInteractions interface and preserve both hover and group/marquee movement.
- Combine separate dimension/rotation obstacle events with the existing photo-strip/popover overlay choice.
- Keep the complete original rotation research document, including the later user preference that supersedes a permanent labelled control. Remove that superseded claim from the active changelog.

## Deferred Room-edge hunk

Room-edge creation/measurement belongs to `e0feef74`, so this branch omits its changelog paragraph and the not-yet-existing `scripts/editor-room-edge-check.mjs`. When that concern is reconstructed, apply the two-line `da58c822` amendment immediately after `rectangle-all-edges`: obtain `editorFidelity.rotationHoverPoint(id)`, move the mouse there and await two animation frames before reading the rotation scene. No assertion is removed.

## Verification and provenance

Only source/conflict review, Git diff inspection and whitespace checks have been performed on this reconstructed cumulative source. Types, lint, behavioral checks, browser/native captures, push and PR publication remain pending. Original source/build identifiers, image bytes, timestamps and limitations are not relabelled as evidence for the reconstructed SHA. The final cumulative source must be compared with the fully verified integration source before acceptance.
