# Contextual detail delivery reconstruction

Status: **validation pending**. Source/compatibility tip `ba9c96a8591f4ab063232a6828bfb7683fe7bb0c` was reconstructed on native-icon delivery `fbe8a3935eb442653d5043c23855db25ab5071f5` (published PR96 ancestor `037a8496a71b914e55b49e5e06cecb51564db77f`). The later commit containing this mapping changes documentation only. Branch: `codex/editor-deliver-details`.

## Source mapping

| Original commit | Reconstructed commit |
|---|---|
| `2f1b32b07a30aaafcc680ee74a8383cf792b54b8` | `64529a6e9fbad493d2d1f22c356795d714cfbe3c` |
| `b1763c5ecd92a9a7694686d255e88e0fc119dc84` | `92a6f58a41cf4555846f1d263240ce5ab7744c0b` |
| `f310a2694bad33bbeebdf1635e1fa61fec73e267` | `4449e67dc818a94eeb37748aad6093402c80deae` |
| `35d53e7cd982acb34baccb5675409cc0057383a0` | `956cdade8abd46a69ffe608d49a9ccbae5e487bb` |
| `d2d08cb958dd220a7a9f4ed525ea365024874406` | `afa85598d87d7cc962f8e468a36fc150768c9224` |
| `8f352c3a0e01862ec259c3fc872068358626dc9e` | `966d5ad8a702ef74110783661f1bb6ffa38c1674` |
| `5d783f1a4305e6f00846b68bf4d2bef522ccf331` | `b39c8b6b514201ef6bc9717a34f3a2a4a03b92f2` |

Additional compatibility commit `ba9c96a8591f4ab063232a6828bfb7683fe7bb0c` registers the genuine `scripts/editor-subject-kind-check.mjs` CLI entry in Fallow and preserves ordinary button activation until the downstream shell introduces roving-tabindex perspective radios. The radio keyboard path is retained when those controls exist; no shell production changes are imported.

## Context resolution and downstream restoration

- The release audit was absent from published PR96. Retain the complete original historical document; its dated state and acceptance statements describe its named original revisions, not this reconstruction.
- `RenovationInspector.vue`: retain the detail-mode heading condition. Defer the original `selectedZone?.name` heading fallback and the `selectedZone && !room` More actions disclosure containing `ObjectRotationControls :id="selectedZone.id"` until the rotation concern supplies the selected-Zone computed value/import and generic rotation admission.
- `RoomRenovationDetails.vue`: retain the reordered More actions disclosure and its existing naming/outline controls; defer only the added `ObjectRotationControls` import and `<ObjectRotationControls :id="room.id" />`.
- `StructureInspector.vue`: move `StructureRenovationEntry` into More actions as requested. Defer `<ObjectRotationControls :id="id" />` and its supporting import until the generic rotation concern. Preserve published PR96 host-rotation behavior.
- `CHANGELOG.md`: retain detail/photo claims; exclude the unrelated generic spatial-rotation paragraph and the detail entry's rotation clause until that concern lands.
- These omitted rotation hunks are required in the cumulative final tree. Do not treat them as scope cancellation. No other source ancestry, schema, storage, input or creation changes were transferred.

## Original evidence

All 141 evidence files introduced by the specified commits have identical Git blob IDs to `f310a2694bad33bbeebdf1635e1fa61fec73e267`. This includes binary screenshots, reports, capture manifests, the saved reproducer and provenance JSON. Both historical audit documents also match their original final blobs (`release-screen-fidelity.md` at f310a269; `contextual-detail-fidelity.md` at d2d08cb9).

Original source/build identifiers, timestamps and limitations remain unchanged. The before/after subject-kind and four-scenario overview evidence does not claim acceptance for the reconstructed cumulative SHA. Existing nine final journeys and eighteen comparisons are preserved. New validation/capture is pending.

## Changed-file audit and verification

Before this mapping, 173 files differ from the native-icon base: 141 historical evidence files plus the following concern-owned files:

- `.fallowrc.json`
- `CHANGELOG.md`
- `docs/user-experience/renovation-planner-editor-specs/implementation/contextual-detail-fidelity.md`
- `docs/user-experience/renovation-planner-editor-specs/implementation/release-screen-fidelity.md`
- `docs/user-experience/renovation-planner-editor-specs/screens/M08-existing-room-details.md`
- `docs/user-experience/renovation-planner-editor-specs/screens/M09-planned-room-details.md`
- `scripts/editor-area-browser.mjs`
- `scripts/editor-subject-kind-check.mjs`
- `src/presentation/editor/PlanCanvas.vue`
- `src/presentation/editor/planning/CostGroup.vue`
- `src/presentation/editor/planning/CostsInspector.vue`
- `src/presentation/editor/planning/EvidenceInspector.vue`
- `src/presentation/editor/planning/ExistingPhotoStrip.vue`
- `src/presentation/editor/planning/MaterialsInspector.vue`
- `src/presentation/editor/planning/existingPhotos.ts`
- `src/presentation/editor/renovation/DecisionList.vue`
- `src/presentation/editor/renovation/RenovationEntry.vue`
- `src/presentation/editor/renovation/RenovationInspector.vue`
- `src/presentation/editor/renovation/RenovationLayer.vue`
- `src/presentation/editor/renovation/RenovationLinkedSummary.vue`
- `src/presentation/editor/renovation/RoomRenovationDetails.vue`
- `src/presentation/editor/renovation/SubjectRow.vue`
- `src/presentation/editor/renovation/TransformationSummary.vue`
- `src/presentation/editor/renovation/WorkRow.vue`
- `src/presentation/editor/structure/StructureInspector.vue`
- `src/presentation/i18n/locales/de/renovation.ts`
- `src/presentation/i18n/locales/en/renovation.ts`
- `styles/editor-visual-overview.css`
- `styles/editor-visual-records.css`
- `tests/presentation/editor/existingPhotoStrip.test.ts`
- `tests/presentation/editor/renovationOverview.test.ts`
- `tests/presentation/editor/subjectKindPresentation.test.ts`

Only Git/blob comparison and source/context review were performed. No tests, types, lint, browser/native capture, push or PR was run for this reconstructed revision; root retains the serialized verification slot. Historical passed checks are provenance only.
