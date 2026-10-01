# Known limitations

What this build does not do, does not support, or has not been checked to do. It describes the
code on this branch; it is not a release note and not an acceptance record. Each item names the
record that carries its evidence, so it can be re-checked rather than trusted.

Four words are kept apart on this page, because the rest of the documentation used to mix them:

- **Implemented** — the code is in this repository and the automated suite exercises it.
- **Proposed** — a design package, PRD or plan describes it; it is not built.
- **Supported** — the product commits to it for the beta. A support claim needs device or vault
  evidence before it is published as observed.
- **Verified** — a person or a driven run in Obsidian observed it, on a recorded build.

The beta's status, gates and decisions are in
[first beta readiness](releases/first-beta-readiness/README.md). How to back up and restore is in
[Working with saved data](using-planning-recovery.md#back-up-and-restore).

## Nothing here is release-accepted yet

- **No release has been cut.** `manifest.json` is at `0.1.0` and the repository has no release
  tag. No production candidate has been named: the tracker's
  [candidate identity record](releases/first-beta-readiness/03-execution-tracker.md#candidate-identity-record)
  reads "Unassigned", and its go/no-go decision reads "Not made".
- **Most manual cases have never been walked.** The catalogue under
  [`tests/cases/`](tests/cases/) gives each case a `## Runs` table; most of those tables record no
  run, and none records a run against a production candidate, because there is none. Where a case
  does record a run — a human walk in a vault, or the E2E driver in a real Obsidian — the row
  names its build and date, and it applies to that build only.
- **Older acceptance records are history.** Release and evidence ledgers written before a
  candidate exists — for example under
  `user-experience/renovation-planner-editor-specs/implementation/` — record what was checked on
  the build they name. They are not acceptance of this build.
- **`npm run test-build` is a development build.** It runs `vite build --mode development`
  (`package.json`), so a check walked on it is not a check of the minified bytes a release
  attaches.

## Platforms

- **Desktop edits; mobile reads.** On a phone or tablet the Renovation project view and the Asset
  library open read-only (`readOnly: Platform.isMobile` in `RenovationProjectView.ts` and
  `AssetLibraryView.ts`): you can browse and search, and every control that would change
  something is disabled. The Plan editor and the Asset designer do not open there; they draw
  "This surface is not available on mobile. Open it on a desktop." The commands that would only
  create or edit — **New project**, **Open plan editor**, **Set plan background**, **Open asset
  designer** and **Create sample renovation project** — are not offered on mobile. Source: tracker
  [D-03 and L-43](releases/first-beta-readiness/03-execution-tracker.md#decisions-and-explicit-limitations),
  and owner ruling 66, which kept the library read-only rather than desktop-only on mobile.
  **This is implemented and tested in jsdom, and has not been checked on any device**: the case
  [Read projects on mobile](tests/cases/Read%20projects%20on%20mobile.md) reads "Not yet run on a
  device". The E2E workflow's `mobile-emulation` leg is desktop Obsidian emulating a phone, not a
  device test.
- **Touch drawing is not a goal.** Drawing, calibration and canvas editing are desktop surfaces
  (`PRODUCT.md`, *Capabilities and Constraints*). Mobile parity is explicitly not the target.
- **Obsidian versions.** `minAppVersion` is 1.13.0. Obsidian 1.13.0 itself has never been run
  here (it was an Insiders-only build); the E2E workflow runs 1.13.7, the earliest public build at
  that floor, and `latest`, on Linux under xvfb (`.github/workflows/e2e.yml`). Several cases record
  E2E runs on Windows 11. No case's `## Runs` table records a run on macOS.
- **Two windows on one vault** have never been exercised. The write-incident record is shared by
  the vault, while the pause that enforces it lives in each running plugin (tracker L-07).

## Interactions that are limited or not supported

- **The pane's back and forward arrows do not walk the Renovation project view.** Opening a
  project from the list and going back with the in-app **‹** works; in Obsidian 1.13.7 the
  pane's own arrows stay disabled after a row click. `tests/e2e/renovationPlanner.e2e.ts` pins
  that, and the case [Navigate into a project and back](tests/cases/Navigate%20into%20a%20project%20and%20back.md)
  records it as failing.
- **Edit corners moves an existing corner only.** It cannot add or remove one (use **Add point**
  and Undo). At a sidebar's width its dialog covers the canvas, so the marked corner cannot be
  seen while you type (tracker L-27). Whether it is usable by keyboard and with assistive
  technology is not established: its case records no run.
- **A control can look available and refuse when used.** While writing is paused by an open
  incident, controls are not greyed out in advance; the refusal comes when you use one (tracker
  L-14).
- **A room with no area that is already in a vault** still loads, and refuses any edit that
  changes its outline; rename, details, lock and delete still work so you can find and remove it.
  New rooms with no area, or a negligible area, cannot be saved (tracker L-23).
- **Rooms that already cross themselves** are not refused when a vault is opened, and their
  requirement figures are not flagged. The Plan editor's own drawing and editing refuse a
  self-crossing outline, but the Asset designer's shape edits do not check for one, and pasting a
  copied crossing room is not refused either (tracker L-29; recorded as accepted beta gaps by owner
  ruling 58).
- **Pasting an old near-zero object or hatch** that was copied from an older plan is still
  written; elements have no area rule of their own (tracker L-23; owner ruling 40).
- **The getting-started guide's sample-project step** points at a command that is desktop-only;
  on mobile the guide shows the read-only line instead (owner ruling 53).

## Data safety and crash recovery

Recovery in this plugin is **detection and guarded manual recovery, not automatic crash replay**
(tracker D-02). The details and the steps are in
[Working with saved data](using-planning-recovery.md); what that means as limits:

- **Nothing replays, rolls back or repairs an interrupted multi-file operation.** The plugin
  records that a half-write happened and pauses writing across the vault. There is no journal
  that could undo it. The one exception is the separate delete-recovery marker, which can roll
  back an interrupted delete.
- **A half-write the plugin did not notice is not recorded.** Not every failure is detected where
  it happens, and a half-write that happens while the plugin is not loaded is not recorded unless
  a save was still running when it unloaded.
- **What sits outside the pause is not listed or checked anywhere** (tracker L-11). The link
  update made when you rename or move a file a plan links to is one example.
- **The pause survives restarts on purpose, and only you can end it**: by checking the affected
  files against your backup, removing `write-incidents.json` from the plugin's folder and reloading
  the plugin (tracker D-08, L-09). Reading, reopening, reloading or restarting is not a repair, and
  a successful read is not evidence that the files are whole. Removing the file only takes effect
  after a reload; that step has not been exercised in a vault (L-09).
- **An unwritable plugin folder silently weakens this.** If the plugin cannot write its own
  folder, an incident lasts only for the running session (tracker L-08).
- **A delete-recovery marker this build cannot read is reported only in the developer console**,
  not in the plugin's own screens (tracker L-10).
- **Some pauses can fall on a vault that is in fact coherent**, and are accepted for the beta:
  - a rename whose later plan's save is refused by a conflict, or whose later plan fails to load
    with `plan.migration-failed`, after an earlier plan was already written — open owner question
    (tracker L-51);
  - a delete the plugin itself completes at the next load keeps its incident open, because nothing
    retires an incident (tracker L-52, open);
  - in the Asset designer, an Undo that meets a rare disk fault, a sync client locking the file, a
    delete at the moment of the read, or an asset that fails its own re-save check can pause writing
    although the vault may be fine (accepted by owner rulings 19, 23 and 31; ADR-0034 lists them);
  - when the plugin unloads while a save is still running, it keeps that session's record of
    partly failed writes alive so the save is still checked; until the plugin next loads, that
    older record can answer for the vault (owner ruling 16, tracker L-21).
- **A binary downgrade is not a data rollback.** See
  [Back up and restore](using-planning-recovery.md#back-up-and-restore).

## Accessibility

**WCAG 2.2 AA is the target, not a verified result** (`PRODUCT.md`, *Accessibility &
Inclusion*). The automated checks run axe-core in jsdom, which has no rendering engine, so they
measure neither a visible focus indicator, nor contrast, nor hit-target size. The E2E workflow
adds a contrast scan in a real Obsidian over the Renovation project view only. Notices are outside
every scan. No screen-reader run is recorded in any case's `## Runs` table.

## Not professional planning software

The plugin helps a private renovator organise their own project. It does not replace CAD, BIM,
structural engineering software, architectural design, permitting software, professional
estimating suites, accounting, construction ERP or professional site management (`PRODUCT.md`,
*Explicit non-goals*). In particular:

- quantities and costs are calculated from the shapes and prices you enter; they are not a
  professional estimate;
- the Review perspective and a generated Review note check planning gaps only — the shipped text
  says it "does not assess engineering or construction readiness", and a Review note is not a
  construction approval;
- a post or beam marked load-bearing carries a property you set; nothing checks the structure;
- an asset's clearance allowances are your own numbers, not a standard, and marking a clearance
  reviewed certifies nothing.
