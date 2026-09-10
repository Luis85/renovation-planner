---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 90
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Manually accept the eighteen editor reference comparisons]]"
  - "[[Run the six additional editor interaction drivers]]"
  - "[[Verify reference plan scaling and photo search]]"
---

# Run native Obsidian acceptance H1 to H6 in the repository vault

## Evidence

The merged editor has not been accepted in Obsidian. In
`docs/user-experience/renovation-planner-editor-specs/implementation/`, `remaining-plan.md`'s
*Native und externe Grenzen* says the current combined build is not natively accepted;
`completion-matrix.md` reads H2 "Not run on combined tree" and H5 "Not performed"; and `RESUME.md`
calls the build installed in its test vault preliminary.

The plan approves one vault, `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault`,
which does not exist on this machine. **The product owner decided on 2026-09-10 to use
`C:\Projects\renovation-planner`** — this machine's Obsidian vault and the repository itself, open
in Obsidian with `.obsidian/plugins/renovation-planner/` installed, the vault `npm run test-build`
builds into. The plan wanted an isolated vault so fixtures never overwrite user data, and this
vault holds the working `docs/`. That safety rule carries over as a dedicated fixture folder and a
backup before any run.

The old host notes' labels and counts are stale: `RESUME.md`'s H2 row says 11 Add routes,
`remaining-plan.md` says 13, and `tests/presentation/editor/stairsArrows.test.ts` asserts 13
catalogue entries.

| H | What must be observed | Existing owner |
| --- | --- | --- |
| H1 | Legacy notes byte-identical and read-only; PNG and PDF configure, Cancel and Save; calibration; evidence open, rename and move; cache, link and thumbnail update; reopen | none; [[Walk a room reload in a live vault]] covers the reopen only |
| H2 | Native keyboard journey; all 13 Add routes opened and cancelled; Room, Object, Wall and Group interactions; drafts; split leaves; linked workflows | in part, [[Complete keyboard focus and command journeys]] |
| H3 | Filled light, dark, custom accent and German states; about 460 px; host zoom 200%; a clear refusal under 400 px; no new theme installed | [[Review the live theme and layout matrix]] |
| H4 | Final raw measurements, camera delta, markers and cleanup; physical touch, pen and trackpad need a named device and observer | automated half [[Meet editor performance and cleanup budgets]]; physical half [[Audit real input and assistive technology]] |
| H5 | Named screen reader, version and language; selection, modal, validation and M15 announcements; focus successors; no disruptive repetition | [[Audit real input and assistive technology]] |
| H6 | Real peer conflict and missing file in the vault; draft, peer bytes and retry preserved | [[Verify stale recovery in Obsidian]] |

## Why it matters

The release claim is about Obsidian, not a browser: vault files, the metadata cache, native icons,
host themes and zoom, real focus and real faults can only be observed there. And in this vault, a
fixture run that writes over a note rewrites the product's own register.

## Approach

Name the fixture folder and take the backup first, install and reload the merged build, then walk
H1 to H6 once each, re-observing window and focus before every action. Each row's result is also
the live-host record its owner note asks for; this note does not restate their criteria.
[[Execute the manual release evidence matrix]] is the general form of this run. Only the H4 row
waits on [[Meet editor performance and cleanup budgets]]; H1 to H3, H5 and H6 do not.

## Acceptance criteria

1. The run uses `C:\Projects\renovation-planner` with a dedicated fixture folder, named before the
   run, and no note outside that folder is written.
2. Before any run, the existing notes under every path the run touches and the installed plugin's
   file hashes are backed up, and no fixture overwrites an existing note.
3. The merged build is installed and reloaded, with SHA-256 recorded for source, bundle, styles and
   manifest.
4. Window identity and focus are re-observed before every action.
5. Labels and counts are reconciled to the current UI first. H1 to H6 then each get one record:
   observed pass, fail, or not performed with its reason.
6. Physical touch, pen and trackpad input and a named screen reader are recorded separately, as not
   performed unless actually done. Which devices, and which screen reader with which observer, are
   asked only after the host evidence exists.
7. The Save, failed read-back and repeated retry proof stays recorded as automated-only evidence
   while no safe host fault seam exists.
8. No blanket H1–H6 acceptance is claimed.

## Risks

- A fixture written over an existing `docs/` note corrupts the register this vault is. The backup
  is the recovery, not the plan.
- Automation driving the host can act on the wrong window; re-observing before every action is the
  guard.
- Injected input, axe or UI Automation results can read as if they answered H4's physical half or
  H5. They do not.

## Outcome

The merged editor has one native-host record per H row in the repository vault, with what was not
performed stated as such.
