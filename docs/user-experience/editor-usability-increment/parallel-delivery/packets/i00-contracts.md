# I00 — Freeze interaction, selector and copy contracts

**Status: not started.** Suggested model: `gpt-5.6-terra`, reasoning `high`. This is a bounded assignment, not a benchmark or a guarantee. Wave 0; prerequisites: mockup/chunk PR merged and implementation requested. Branch `codex/usability-i00-contracts`; worktree `.worktrees/usability-i00-contracts`.

## Visual reference

- [hybrid-01-modes.png](../../mockups/images/hybrid-01-modes.png)

Open only these images and their matching gallery sections initially. Do not load the entire image/research corpus for a bounded packet.

## Outcome

Record existing action entry points, data-rp hooks, mode/task/selection/save matrix and exact new EN/DE strings. Land required locale registration and any genuinely necessary shared presentation seam atomically before consumer packets. Do not add speculative orphan modules or dead CSS. Resolve U4 chooser decision and arbitrary-corner accessibility scope; unresolved conditional work remains blocked.

## Ownership

- `src/presentation/editor/PlanEditorRoot.vue`
- `src/presentation/i18n/locales/en.ts`
- `src/presentation/i18n/locales/de.ts`
- `styles/index.css`
- New focused tests may be added only under `tests/presentation/editor/usability/i00-*.test.ts`.
- Write this packet's receipt at `docs/user-experience/editor-usability-increment/parallel-delivery/receipts/I00.md`.
- Existing tests listed below are read/run targets, not blanket edit ownership. Request a serialized test-fixture/selector update if needed.
- Root, locale dictionaries/aggregates, CSS index and unrelated files are reserved to the integrator unless explicitly owned above. No entire-folder edit permission.

## Read before coding

Read [session contract](../session-contract.md), [dispatch order](../README.md), this packet, and the relevant image/state notes in [hybrid screens](../../mockups/hybrid-screens.md). Then read only these immediate code seams before expanding inspection for a concrete reason:

- `src/presentation/editor/runtime.ts`
- `src/presentation/editor/renovation/renovationActions.ts`
- `src/presentation/editor/surface/EditorSurface.vue`

## Preserve

No behavioral rebuild. Preserve working Paste/history/root routes. This packet is the only default writer of root and aggregate files; later requests require serialized integrator ownership.

All changes remain presentation/consolidation work over existing commands. Do not infer persisted geometry, domain relationships, automatic saving, a new toolbar command or an unsupported API from generated artwork.

## Acceptance and verification

- The outcome above is reachable from its existing production entry point, not only a component specimen.
- No unrelated command, geometry, selection, history, draft, host or failure behavior changes.
- New controls have meaningful names/focus, supported locale strings and coherent light/dark/narrow behavior where relevant.
- A refusal/no-op creates no write/history entry; successful intent keeps existing transaction granularity.
- No unresolved import/locale/CSS integration is hidden behind a passing isolated mock.
- Request the shared verification slot, then run:

```powershell
npm run check:fast -- tests/presentation/i18n/strings.test.ts tests/presentation/editor/shell.test.ts
```

These commands are planned, not already passed. Add a focused regression only when behavior/edge risk warrants it; do not mirror a static text change. If a listed path is renamed on current main, find the actual successor and record it. Do not claim a pass with no matched tests. UI changes also need the relevant real browser/native evidence specified in the session contract. I16 owns the final `npm run check` and CI receipt.

## Copy-ready session prompt

```text
Implement only I00 (Freeze interaction, selector and copy contracts) in the Renovation Planner repository.
Read docs/user-experience/editor-usability-increment/parallel-delivery/session-contract.md and packets/i00-contracts.md under that directory, plus the relevant hybrid screen contract. Follow repository AGENTS.md and .codex instructions if present.
Use model gpt-5.6-terra with high reasoning when available; do not silently change models.
Confirm the implementation request and that prerequisites the planning/mockup PR are merged/recorded before creating a fresh worktree from origin/main. Use branch codex/usability-i00-contracts under .worktrees/usability-i00-contracts; keep main clean.
Deliver this outcome: Record existing action entry points, data-rp hooks, mode/task/selection/save matrix and exact new EN/DE strings. Land required locale registration and any genuinely necessary shared presentation seam atomically before consumer packets. Do not add speculative orphan modules or dead CSS. Resolve U4 chooser decision and arbitrary-corner accessibility scope; unresolved conditional work remains blocked.
Edit only this packet's owned paths and new tests/receipt. Preserve: No behavioral rebuild. Preserve working Paste/history/root routes. This packet is the only default writer of root and aggregate files; later requests require serialized integrator ownership.
Do not modify shared root/locale/CSS-index files outside your ownership. Send a concrete integration request with exact keys/props/selectors or patch needed; the integrator must land it atomically on this PR before final verification. Never leave a broken consumer waiting for a late wiring wave.
Run targeted checks in the shared verification slot and capture applicable UI evidence. Record exact commit, commands/results, dimensions/theme/locale, remaining risks and dependency receipts. Commit, push and open a PR; do not merge it yourself. Stop at the packet outcome and report the PR URL, branch and SHA.
```

## Escalation

If the task needs a schema/core geometry/history change, a shared interface is missing, two focused fix attempts fail for the same reason, or more than roughly six production files are needed, return a concrete integration/split request with evidence. Continue independent owned work; do not invent a workaround, weaken gates or silently expand scope. The integrator resolves routine requests without asking the user to reconfirm already authorized work.
