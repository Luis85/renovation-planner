# I03 — Put common Room edits first

**Status: not started.** Suggested model: `gpt-5.6-luna`, reasoning `high`. This is a bounded assignment, not a benchmark or a guarantee. Wave 2; prerequisites: I00, I01 merged or explicitly dispositioned where conditional. Branch `codex/usability-i03-room-details`; worktree `.worktrees/usability-i03-room-details`.

## Visual reference

- [hybrid-01-modes.png](../../mockups/images/hybrid-01-modes.png)
- [ux04-05-selection-precision-v2.png](../../mockups/images/ux04-05-selection-precision-v2.png)

Open only these images and their matching gallery sections initially. Do not load the entire image/research corpus for a bounded packet.

## Outcome

Reorder Plan Room identity, area, name and eligible size route before advanced shape/rotation. Show one clear Renovate-this-element route instead of the full renovation inventory in Plan. Keep the normal no-selection/multi/locked bodies truthful.

## Ownership

- `src/presentation/editor/shell/RoomInspector.vue`
- `src/presentation/editor/shell/SpatialInspectorActions.vue`
- `styles/editor-inspector.css`
- New focused tests may be added only under `tests/presentation/editor/usability/i03-*.test.ts`.
- Write this packet's receipt at `docs/user-experience/editor-usability-increment/parallel-delivery/receipts/I03.md`.
- Existing tests listed below are read/run targets, not blanket edit ownership. Request a serialized test-fixture/selector update if needed.
- Root, locale dictionaries/aggregates, CSS index and unrelated files are reserved to the integrator unless explicitly owned above. No entire-folder edit permission.

## Read before coding

Read [session contract](../session-contract.md), [dispatch order](../README.md), this packet, and the relevant image/state notes in [hybrid screens](../../mockups/hybrid-screens.md). Then read only these immediate code seams before expanding inspection for a concrete reason:

- `src/presentation/editor/resize/roomDimensions.ts`
- `src/presentation/editor/renovation/RenovationEntry.vue`

## Preserve

Do not invent universal width/depth for irregular/rotated rooms, auto-follow walls, new renaming commands or permanent rotation handles.

All changes remain presentation/consolidation work over existing commands. Do not infer persisted geometry, domain relationships, automatic saving, a new toolbar command or an unsupported API from generated artwork.

## Acceptance and verification

- The outcome above is reachable from its existing production entry point, not only a component specimen.
- No unrelated command, geometry, selection, history, draft, host or failure behavior changes.
- New controls have meaningful names/focus, supported locale strings and coherent light/dark/narrow behavior where relevant.
- A refusal/no-op creates no write/history entry; successful intent keeps existing transaction granularity.
- No unresolved import/locale/CSS integration is hidden behind a passing isolated mock.
- Request the shared verification slot, then run:

```powershell
npm run check:fast -- tests/presentation/editor/shell/roomInspector.test.ts tests/presentation/editor/rotationInspectorRoutes.test.ts
```

These commands are planned, not already passed. Add a focused regression only when behavior/edge risk warrants it; do not mirror a static text change. If a listed path is renamed on current main, find the actual successor and record it. Do not claim a pass with no matched tests. UI changes also need the relevant real browser/native evidence specified in the session contract. I16 owns the final `npm run check` and CI receipt.

## Copy-ready session prompt

```text
Implement only I03 (Put common Room edits first) in the Renovation Planner repository.
Read docs/user-experience/editor-usability-increment/parallel-delivery/session-contract.md and packets/i03-room-details.md under that directory, plus the relevant hybrid screen contract. Follow repository AGENTS.md and .codex instructions if present.
Use model gpt-5.6-luna with high reasoning when available; do not silently change models.
Confirm the implementation request and that prerequisites I00, I01 are merged/recorded before creating a fresh worktree from origin/main. Use branch codex/usability-i03-room-details under .worktrees/usability-i03-room-details; keep main clean.
Deliver this outcome: Reorder Plan Room identity, area, name and eligible size route before advanced shape/rotation. Show one clear Renovate-this-element route instead of the full renovation inventory in Plan. Keep the normal no-selection/multi/locked bodies truthful.
Edit only this packet's owned paths and new tests/receipt. Preserve: Do not invent universal width/depth for irregular/rotated rooms, auto-follow walls, new renaming commands or permanent rotation handles.
Do not modify shared root/locale/CSS-index files outside your ownership. Send a concrete integration request with exact keys/props/selectors or patch needed; the integrator must land it atomically on this PR before final verification. Never leave a broken consumer waiting for a late wiring wave.
Run targeted checks in the shared verification slot and capture applicable UI evidence. Record exact commit, commands/results, dimensions/theme/locale, remaining risks and dependency receipts. Commit, push and open a PR; do not merge it yourself. Stop at the packet outcome and report the PR URL, branch and SHA.
```

## Escalation

If the task needs a schema/core geometry/history change, a shared interface is missing, two focused fix attempts fail for the same reason, or more than roughly six production files are needed, return a concrete integration/split request with evidence. Continue independent owned work; do not invent a workaround, weaken gates or silently expand scope. The integrator resolves routine requests without asking the user to reconfirm already authorized work.
