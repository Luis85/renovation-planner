# Group storage delivery reconstruction

Status: source reconstructed; validation pending. Historical verification recorded in
the original concern receipts describes those original trees, not this delivery tree.
No tests, type checks, lint, build or browser run were performed for reconstruction.

Initial base: input delivery `6284aa4a8f5945c72fd94b4ba1309304e63e536f`.
Review base: `codex/editor-deliver-reference` (`8948c7a3`), incorporating the independent
Photo and Reference concerns before Group storage. No integration-branch ancestry is
imported. Schema order remains Opening 5 followed by Group 6; Curve 7 follows later.

| Original | Reconstructed | Included scope |
| --- | --- | --- |
| `587f0266` | `e114355b` | Group model, schema 6, guarded services, atomic command, root memberships, Zone pre-write version receipts, projections and original foundation tests/docs. |
| `75175e1f` | `14378070` | Individual deletion membership cleanup and exact safe history restoration, including grouped Room boundary recovery. |
| `f5a28f45` | This delivery follow-up | Three Group command error messages in both locales, membership restoration error, composed guarded Group tests and exact guard-census ownership. |
| `eb59fc2b` | This delivery follow-up | Group command write boundaries, ordered publication events, reversible-write discovery and census rows. |

The Group error locale modules are deliberately limited to the three storage errors.
They are wired into the existing editor locale tables now; Group UI may extend them
later without adding a second source of error copy.

Omitted from `f5a28f45`: German Curve copy; future-schema fixture generalization made
for Stair 8; and the mixed integration repair receipt. The existing Group6 future
schema fixture remains appropriate for this schema boundary. Omitted from
`eb59fc2b`: the Group pointer-rotation UI test and its mixed UI verification receipt.
No Group Inspector, selection expansion, pointer group target, browser driver or
Curve/Stair schema is introduced by this concern.

Review compares the exclusive Group domain/command/repository/helper files with their
original feature commits. Shared DTO, locale, projection and census files are reviewed
as concern hunks against the Reference base, retaining the clean delivery's prior
Opening and input contracts. Later cumulative comparison must account for Curve
extensions to Group bounds, validation and Zone geometry receipts.
