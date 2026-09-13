# I05 — Clarify starting and finishing Room creation

**Status: not started.** Suggested model: `gpt-5.6-luna`, reasoning `high`. This is a bounded assignment, not a benchmark or a guarantee. Wave 2; prerequisites: I00, I04 merged or explicitly dispositioned where conditional. Branch `codex/usability-i05-room-start-draft`; worktree `.worktrees/usability-i05-room-start-draft`.

## Visual reference

- [ux02-start.png](../../mockups/images/ux02-start.png)
- [ux03-room-draft.png](../../mockups/images/ux03-room-draft.png)

Open only these images and their matching gallery sections initially. Do not load the entire image/research corpus for a bounded packet.

## Outcome

Preserve three starting routes with reference optional. Put name and width/depth before advanced shape controls. Keep valid/invalid input, last-valid preview labeling and synchronized Create/Cancel availability. Keep adding remains explicit.

## Ownership

- `src/presentation/editor/reference/FloorStart.vue`
- `src/presentation/editor/shell/NewRoomInspector.vue`
- `styles/editor-new-room.css`
- `styles/editor-creation-fidelity.css`
- New focused tests may be added only under `tests/presentation/editor/usability/i05-*.test.ts`.
- Write this packet's receipt at `docs/user-experience/editor-usability-increment/parallel-delivery/receipts/I05.md`.
- Existing tests listed below are read/run targets, not blanket edit ownership. Request a serialized test-fixture/selector update if needed.
- Root, locale dictionaries/aggregates, CSS index and unrelated files are reserved to the integrator unless explicitly owned above. No entire-folder edit permission.

## Read before coding

Read [session contract](../session-contract.md), [dispatch order](../README.md), this packet, and the relevant image/state notes in [hybrid screens](../../mockups/hybrid-screens.md). Then read only these immediate code seams before expanding inspection for a concrete reason:

- `src/presentation/editor/add/roomCreation.ts`
- `src/presentation/editor/add/room-draft-store.ts`

## Preserve

Do not change draft-store/parser or persistence semantics. Select is not pressed while creation is active. Escape and Cancel remain different.

All changes remain presentation/consolidation work over existing commands. Do not infer persisted geometry, domain relationships, automatic saving, a new toolbar command or an unsupported API from generated artwork.

## Acceptance and verification

- The outcome above is reachable from its existing production entry point, not only a component specimen.
- No unrelated command, geometry, selection, history, draft, host or failure behavior changes.
- New controls have meaningful names/focus, supported locale strings and coherent light/dark/narrow behavior where relevant.
- A refusal/no-op creates no write/history entry; successful intent keeps existing transaction granularity.
- No unresolved import/locale/CSS integration is hidden behind a passing isolated mock.
- Request the shared verification slot, then run:

```powershell
npm run check:fast -- tests/presentation/editor/shell/newRoomInspector.test.ts tests/presentation/editor/roomCreationWiring.test.ts tests/presentation/editor/roomCreation.e2e.test.ts
```

These commands are planned, not already passed. Add a focused regression only when behavior/edge risk warrants it; do not mirror a static text change. If a listed path is renamed on current main, find the actual successor and record it. Do not claim a pass with no matched tests. UI changes also need the relevant real browser/native evidence specified in the session contract. I16 owns the final `npm run check` and CI receipt.

## Copy-ready session prompt

```text
Implement only I05 (Clarify starting and finishing Room creation) in the Renovation Planner repository.
Read docs/user-experience/editor-usability-increment/parallel-delivery/session-contract.md and packets/i05-room-start-draft.md under that directory, plus the relevant hybrid screen contract. Follow repository AGENTS.md and .codex instructions if present.
Use model gpt-5.6-luna with high reasoning when available; do not silently change models.
Confirm the implementation request and that prerequisites I00, I04 are merged/recorded before creating a fresh worktree from origin/main. Use branch codex/usability-i05-room-start-draft under .worktrees/usability-i05-room-start-draft; keep main clean.
Deliver this outcome: Preserve three starting routes with reference optional. Put name and width/depth before advanced shape controls. Keep valid/invalid input, last-valid preview labeling and synchronized Create/Cancel availability. Keep adding remains explicit.
Edit only this packet's owned paths and new tests/receipt. Preserve: Do not change draft-store/parser or persistence semantics. Select is not pressed while creation is active. Escape and Cancel remain different.
Do not modify shared root/locale/CSS-index files outside your ownership. Send a concrete integration request with exact keys/props/selectors or patch needed; the integrator must land it atomically on this PR before final verification. Never leave a broken consumer waiting for a late wiring wave.
Run targeted checks in the shared verification slot and capture applicable UI evidence. Record exact commit, commands/results, dimensions/theme/locale, remaining risks and dependency receipts. Commit, push and open a PR; do not merge it yourself. Stop at the packet outcome and report the PR URL, branch and SHA.
```

## Escalation

If the task needs a schema/core geometry/history change, a shared interface is missing, two focused fix attempts fail for the same reason, or more than roughly six production files are needed, return a concrete integration/split request with evidence. Continue independent owned work; do not invent a workaround, weaken gates or silently expand scope. The integrator resolves routine requests without asking the user to reconfirm already authorized work.
