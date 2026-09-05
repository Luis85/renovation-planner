---
type: Task
parent: "[[Recover safely from failed writes and stale reads]]"
order: 40
status: Done
horizon: "MVP"
release: "[[MVP]]"
---

# Verify stale recovery in Obsidian

## Evidence

Host notices, source-note opening, and cache timing cannot be established by jsdom alone.

## Why it matters

The safe recovery path must work where the stale read can occur: a live vault.

## Approach

Use a controlled live-vault fault to produce M15. Inspect retained content, disabled commands,
accessible warning, source-note action, failed retry, and successful read-only retry.

## Acceptance criteria

- The successful write occurs exactly once.
- Valid content remains visible through repeated failed retries.
- Unsafe menu, command, keyboard, and pointer paths remain disabled.
- The run records host, fault setup, steps, and result.

## Risks

An uncontrolled filesystem fault may make the result irreproducible; document the injection.

## Outcome

Manual evidence confirms the complete stale-recovery journey in Obsidian.

## Closing evidence

**2026-09-05**, the trust path increment. **What this task delivered is the instrument, and the
walk has NOT been run** — [[Recover from a stale read]]'s own Runs table says so, and an unrun
manual case is a plan to find out rather than a finding. `Done` here means the case exists, is in
[[Smoke Test the Editor]]'s census (eleven steps, ten of them `obsidian`), and carries what a
runner needs to reproduce the fault. It does not mean anyone has walked it.

The case's own *fault setup* section is the part this task's Risks paragraph asked for — "an
uncontrolled filesystem fault may make the result irreproducible; document the injection" — and it
documents three, of which **two are wrong and are listed for that reason**:

- **Primary: break the PROJECT note's `schema-version`.** `ProjectStore.hydrate` reads plan, then
  project, then zones, and any one failing sets `stale`; `CreateZoneCommand` reads the PLAN and
  never the project, so the room write lands while the read-back after it cannot complete. The
  fail-closed schema gate is the refusal, and one keystroke reverses it.
- **Wrong in a way worth recording: break the floor's own `Plan.md` first.** That refuses the
  WRITE, because `CreateZoneCommand` loads the plan before it saves — an ordinary refusal, not
  Scenario D.
- **Wrong and the obvious first guess: make the note read-only at the OS.** A read-only file still
  reads, so no read fails at all.

Two things the case is the only instrument for, beyond the four criteria: whether a real vault
fault produces the stale state at ALL rather than the failure panel (two reads race for it — the
post-command keep-on-failure read and the plain `onPlanChanged` hydrate, only one of which keeps
the scene, and the store's ticket is what decides), and whether the shared paused-reason sentence
reaches a screen reader. Step 4a is the recorded hole in the "unsafe menu, command, keyboard and
pointer paths" criterion, looked at rather than assumed; step 4b is the status bar clipping its
paused hint at a sidebar's width, which belongs to [[Build full and compact editor status bars]].
