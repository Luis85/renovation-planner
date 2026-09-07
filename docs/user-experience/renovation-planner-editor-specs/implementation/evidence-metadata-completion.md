# Evidence metadata and consistent source navigation

Date: 2026-09-07. Implementation candidate on the finalization branch; final full gates and browser/host acceptance remain open.

M14, the V1 spatial-evidence flow and the Photo/Document contracts require explicit dates. The existing Evidence relationship now carries optional `date` metadata. The native form accepts a calendar date or an explicitly unknown blank; file/import timestamps are never substituted. Recorded dates appear in semantic `time` elements. Equal dates retain source order; undated records follow dated records. No independent timeline or metadata store was added.

Plans with a date write schema 8. The pure read migration does not write a file or invent dates, and schema 7 and earlier writers refuse dated payloads. Clearing the last date returns to the schema required by the remaining capabilities; conditional Undo restores the earlier dated payload. The owned-fact comparison includes dates, and existing repository versions/sidecar confirmation continue to guard writes.

One pin projection is now composed in PlanCanvas from the same retained planning baseline as the Inspector. Required props carry it to ZoneLayer and through RenovationLayer to EvidencePins. Current ProjectStore Room geometry only positions those retained metadata records on the drawn canvas. No fallback metadata source or optional Runtime injection was introduced. The UI owner's icon/number geometry, event callbacks and caption clearance remain intact.

A separately recorded Work relationship is now shown through existing record navigation when it differs from the generic related-record link. A duplicate Work/record link appears once; distinct relationships remain visible independently. Navigating preserves the saved date, source file and spatial context.

## Regression evidence

The first date regression failed because the native date field was absent. After the initial implementation, native Save/Edit/Undo and composition wiring passed 15 cases. The broader 11-case metadata probe passed eight and failed three: two missing Work links, plus a pin test that initially assumed Konva child insertion order represented displayed numbering. That assertion was corrected to select the actual rendered number.

The corrected snapshot probe then reproduced both real defects: a retained gallery's number1 selected the other photo from a newer Project snapshot, and a date-only mismatch between two successful read snapshots opened an obsolete Cost draft. Adding date to owned-fact comparison and using one retained pin projection correct these failures. Normal date-only Save/Clear/Undo and the peer-CAS protection already passed before those corrections; no data-loss claim is made.

The final combined run passed all 476 tests in nine files in 45.06 seconds. It includes nine date cases, three Work-link cases, UI caption/icon and native Canvas arc checks, hardening's linked-focus and recovery-boundary cases, composition wiring and repository digest checks. Invalid calendar dates retain raw input without writes. Gallery/pin order, old-writer refusal, date clearing/Undo, peer conflict and read-only recovery use actual composed commands/repositories over FakeVault.

Logs remain in the finalization scratch directory: `evidence-date-red.log`, `evidence-date-initial-green.log`, `evidence-metadata-boundaries-red.log`, `evidence-snapshot-red.log` and `evidence-metadata-joined-green.log`. Final type checking and whole Oxlint/ESLint pass. After the last default/mock corrections, the focused checkpoint run passed 478 tests in nine files in 51.66 seconds. Full coverage/Fallow and the final shared visual/host matrix remain open. These focused results do not establish final screen or release acceptance.
