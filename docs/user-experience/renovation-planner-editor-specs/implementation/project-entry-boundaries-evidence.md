# Project entry boundaries — WIP and resume

Updated: 2026-09-07. **WIP: source prepared; tests have not run.**

Worktree: `D:/Projects/renovation-planner/.worktrees/project-entry-boundaries`.
Branch: `codex/project-entry-boundaries`.
Base: root `f3067d82f413de6c67f9d4598608ce1e1a059cb3`.

Root approved four native cases in the single new
`tests/presentation/views/projectEntryBoundaries.test.ts`, plus this dedicated record:

- Empty mobile/read-only launcher retains its explanation and real Library action while
  hiding Project/Asset creation. The actual ItemView derives readOnly from Platform.
- Native New Project retains a valid draft after a real vault writer rejects; an explicit
  second submit uses the real writer, creates one Project and requests its exact ID.
- Project Detail requests Schedule and Quote comparison through its actual native buttons,
  one fresh ItemView per destination, preserving source bytes and Project identity.

All cases use the real public RenovationProjectView lifecycle with production composition,
repositories, guarded commands and a FakeWorkspace host port. No private Vue emitter/handler,
unsupported domain state or manually inserted option is involved. The mutable platform flag
is the existing Obsidian test seam and is restored after each case. The native navigation
tests observe the public host request; they do not claim a real Obsidian leaf was revealed.

Source comparison showed no changes in WorkResponsibilityFields, ViewRoot or
ProjectDetailState between `95e7510b` and `f3067d82`. The fresh Linux24 counter audit suggested
ViewRoot arms `41:0`, `50:1` and `34:1`, and ProjectDetailState statements `122`/`123`.
Those three-arm/two-statement gains remain hypotheses until actual measurement. The other
Trade and recovery guards lacked a regular native producer; no artificial cases were added.

Checks: source preparation and diff checks passed. No dependencies were installed in this
worktree, and no test/type/lint/coverage/browser process was started. Production, existing
tests, helpers and shared ledgers are unchanged. UI owns the browser slot.

Next: root will include this file in a coordinated batch with its separate five-case planning
package in an existing checkout, avoiding another dependency installation. Wait for exact
terminal results and handle only precise failures in this owned file. Do not independently
run heavy checks without root's handoff. Update this record and push another small checkpoint
after verification; do not claim full-gate or coverage success from source preparation.

Integration recommendation: WIP review/test preparation only. Root task:
`01a0786f-b624-7303-987f-b18b94db48d9`.
