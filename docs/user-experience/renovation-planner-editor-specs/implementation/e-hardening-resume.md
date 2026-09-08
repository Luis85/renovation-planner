# Hardening contributor resume

Updated: 2026-09-07. This is the recovery contributor's checkpoint; integration owns the
central `RESUME.md`, PR #91 and the final combined acceptance decision.

## Location and committed results

- Worktree: `D:/Projects/renovation-planner/.worktrees/native-recovery-boundaries`.
- Branch: `codex/native-recovery-boundaries`.
- Last implementation commit before this documentation checkpoint:
  `300a0929dec7965147ff83cf2e3732c706ad5e94`, pushed and integrated by root as `11e5aa26`.
- Its parent `fe76028ec99d82a7e69fc6ee145835aa33036b58` contains the four native recovery
  boundary cases and the browser resize synchronization. Root already integrated it.
- No pending production edits or owned test/build/browser processes at this checkpoint.
  Do not repeat these two commits when integrating this documentation.

The four boundary cases passed with their neighbors: 23/23 tests in five files, 15.15 seconds.
The LinkedSummary correction reproduced four body-focus failures while two lifecycle guards
already passed, then passed 28/28 tests in five files, 21.63 seconds. Types, whole Oxlint,
scoped ESLint and diff checks passed. The complete German recovery probe passed after the
production focus correction, without adding Escape or camera shortcuts. See
[native boundaries](native-recovery-boundaries-evidence.md) and
[linked-summary focus](linked-summary-focus-evidence.md), including its committed raw browser
report and capture provenance. These are focused results, not a final full-gate pass.

## Audit results delivered to integration

Root requested independent read-only reviews of its subsequent M14 Evidence changes.

1. Evidence `date` was missing from `sameRenovation`'s owned-facts tuple. Root reproduced
   admission of an old draft with date-only mismatched projections and added the field.
2. Pins used fresh `project.plan` metadata while the Inspector retained an older planning
   baseline. Root reproduced mismatched pin/gallery numbering after a peer date change and
   failed planning read. The reviewed correction projects pins once in `PlanCanvas` from
   `runtime.planning.baseline`, with required props to both render paths.
3. A digest test still imported the now-private V7 schema; root owns the V8 test correction.
4. A saved `workId` with empty `recordId` was invisible in Evidence. Root added the existing
   Work relationship using the existing navigation, avoiding duplicate equal-ID links.

No further explicit Evidence tuple or copy path losing dates was found. Rename, batch sharing,
secondary-context removal and whole-Renovation snapshots preserve existing record fields.
Root reported 476 passing tests across nine files after the M14 changes. That was root's run;
the hardening contributor did not independently execute it. No date-related data loss was
claimed: date-only Save/Clear/Undo and peer CAS had already passed before the tuple correction.

The latest integration message reports Linux Node 24 CI on its `73…` checkpoint with
8,053 passing, three failing and 69 skipped tests in 647 files. Root identified stale migration
expectations and an ambiguous Related-record selector, and owns those test corrections.
Coverage reported there: statements 17,842/18,028 (98.96%), branches 12,371/12,686 (97.51%),
functions 5,106/5,153 (99.08%), lines 13,964/14,038 (99.47%). These are historical inputs to
the pending audit, not current-head coverage or a passing gate.

## Next steps and ownership

1. Wait for root to provide the preserved **complete current** `coverage-final.json` and
   `lcov.info`. Audit exact counter maps read-only; do not infer missing arms from old counts.
   Propose meaningful reachable cases before editing or running additional suites.
2. Root owns current production/test corrections, CI workflow implementation, shared ledgers
   and the full gate. UI owns its visual/icon work. Coordinate before overlapping those files.
3. Heavy commands remain serialized on this Windows host. No install, build, test, lint or
   browser run without the current explicit slot handoff. Source-only audits can proceed.
4. Interpret the **one shared final** recovery/performance report and representative PNGs
   when integration provides them; include M15 saved-overview. Do not replace that evidence
   with another diagnostic capture or claim H1–H6 from browser tests.
5. [Host acceptance and CI artifact audit](e-host-ci-audit.md) preserves the actionable H1–H6
   plan and the minimal proposed remote coverage artifact step. Both remain unexecuted here.

The user explicitly requests frequent durable checkpoints. After each connected work section
and before long checks/idle periods, commit and push this existing topic branch. Mark unverified
implementation as WIP, record passed/pending checks and the next action, and send root the SHA,
branch, status and integration recommendation. Never weaken gates or create replacement tasks
or automations. Do not merge PRs without authorization.

Integration task: `01a0786f-b624-7303-987f-b18b94db48d9`.
UI task: `01a0783d-199d-7772-920b-90493cf0d8b4`.
PR: <https://github.com/Luis85/renovation-planner/pull/91>.
