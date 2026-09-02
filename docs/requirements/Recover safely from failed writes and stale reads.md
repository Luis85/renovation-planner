---
type: PBI
parent: "[[Release hardening]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Reload the editor without losing room data]]"
  - "[[Error handling and diagnostics]]"
  - "[[Validation and vault health]]"
---

# Recover safely from failed writes and stale reads

## Actor

The private renovator whose edit or follow-up refresh fails while valuable plan content is open.

## Main flow

1. The renovator commits an editor action.
2. The write completes and the editor reads canonical state back.
3. If read-back succeeds, the normal projection replaces the previous one.
4. If read-back fails, the last valid projection remains visible and is marked potentially stale.
5. Unsafe writes are disabled with an explanation.
6. The renovator retries hydration; the original mutation is never replayed.

## Extensions

- **2a** — The write fails before a complete logical mutation exists. Compensation restores the
  prior valid state where possible and the canonical error surface explains the result.
- **2b** — Compensation or recovery cannot finish. The editor reports that manual inspection is
  required and does not claim the vault is safe.
- **6a** — Retry fails again. The retained projection and guard remain; only the accessible
  failure message is updated.
- **6b** — Retry succeeds. Stale labels disappear and write actions become available again.

## Guarantee

A failed read never erases the last valid content or replays a successful write. While the editor
cannot establish current canonical state, no unsafe follow-up write is enabled.

## Acceptance criteria

1. M15 preserves the last valid plan after a post-write read failure.
2. `Try again` performs a read only and cannot dispatch the original command.
3. Geometry, add, delete, and other unsafe mutations are disabled until refresh succeeds.
4. A failed logical write leaves either the prior complete state or an explicit unrecovered
   condition; no partial success is presented as safe.
5. Error copy and diagnostics use the authorities in [[Error handling and diagnostics]] and
   [[Validation and vault health]] rather than a release-specific error vocabulary.

## Assumptions

- Selection and navigation may remain available for inspection while stale.
- “Unsafe” means an action whose correctness depends on the unavailable current projection.
- Backup guidance supports recovery but does not substitute for compensation and guarded writes.

## Sources

[M15 — Stale-Data Warning](../user-experience/renovation-planner-editor-specs/screens/M15-stale-data-warning.md);
VS-10 and Scenario D in the
[editor vertical-slice plan](../user-experience/renovation-planner-editor-specs/Renovation%20Planner%20—%20First%20Vertical%20Slice%20Plan%20and%20Data-Model%20Specification.md);
Phase 12 in the
[editor implementation plan](../user-experience/renovation-planner-editor-specs/implementation/implementation-plan.md).
