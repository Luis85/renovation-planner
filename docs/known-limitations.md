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
[Working with saved data](using-planning-recovery.md#back-up-and-restore). Numbered owner rulings
cited here are recorded in [owner decisions](releases/first-beta-readiness/05-owner-decisions.md);
a decision not yet recorded there is stated in words, with its date.

## Nothing here is release-accepted yet

- **No release has been cut.** `manifest.json` is at `0.1.0` and the repository has no release
  tag. No production candidate has been named: the tracker's
  [candidate identity record](releases/first-beta-readiness/03-execution-tracker.md#candidate-identity-record)
  reads "Unassigned", and its go/no-go decision reads "Not made".
- **Most manual cases have never been walked.** Most cases in the catalogue under
  [`tests/cases/`](tests/cases/) carry a `## Runs` table recording who or what walked them, on
  which build; a few older ones record runs under another heading or not at all. Most of those
  records hold no run, and none records a run against a production candidate, because there is
  none. Where a case does record a run — a human walk in a vault, or the E2E driver in a real
  Obsidian — the row names its build and date, and it applies to that build only.
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
  `AssetLibraryView.ts`): you can browse and search, and the controls that would change something
  stay visible and do not act, under a read-only notice. The tests check those controls one by
  one, so a control they do not name is not covered. The Plan editor and the Asset designer do
  not open there; they draw "This surface is not available on mobile. Open it on a desktop."
  The commands that would only create or edit — **New project**, **Open plan editor**, **Set plan
  background**, **Open asset designer** and **Create sample renovation project** — are not offered on mobile. Source: tracker
  [D-03 and L-43](releases/first-beta-readiness/03-execution-tracker.md#decisions-and-explicit-limitations),
  and the owner's L-43 decision of 2026-09-23, confirmed again on 2026-10-01, to keep the library
  read-only rather than desktop-only on mobile.
  **This is implemented and tested in jsdom, and has not been checked on any device**: the case
  [Read projects on mobile](tests/cases/Read%20projects%20on%20mobile.md) reads "Not yet run on a
  device". The E2E workflow's `mobile-emulation` leg is desktop Obsidian emulating a phone, not a
  device test.
- **What the beta is scoped to support**: editing on desktop Obsidian 1.13.0 or later
  (`minAppVersion`), and reading on mobile (`isDesktopOnly: false`; tracker D-03, which records
  it as existing scope to revalidate). That is a scope, not a verified result: what has been
  observed is in the cases' run records.
- **Touch drawing is not a goal.** Drawing, calibration and canvas editing are desktop surfaces
  (`PRODUCT.md`, *Capabilities and Constraints*). Mobile parity is explicitly not the target.
- **Obsidian versions.** `minAppVersion` is 1.13.0. Obsidian 1.13.0 itself has never been run
  here (it was an Insiders-only build); the E2E workflow runs 1.13.7, the earliest public build at
  that floor, and `latest`, on Linux under xvfb (`.github/workflows/e2e.yml`). Several cases record
  E2E runs on Windows 11. No case records a run on macOS.
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
- **A control can look available and refuse when used.** The Plan editor greys out its writing
  controls while writing is paused, but a pane that is already open when another pane raises the
  pause, and a tab restored at startup, show their controls as available until the first one is
  refused (tracker L-14). In the Asset designer only Undo and Redo go grey for a pause; its other
  writing controls stay available and are refused when used (tracker L-13).
- **A room with no area that is already in a vault** still loads. An edit that would leave it
  without an area is refused, including a recolour; one that gives it an area, such as dragging a
  corner off the line, is accepted and fixes it. Rename, details, lock and delete also work. New
  rooms with no area, or a negligible area, cannot be saved (tracker L-23).
- **Rooms that already cross themselves** are not refused when a vault is opened. Their area, and
  every quantity and cost derived from it, is wrong (a figure-eight counts the difference of its
  two loops), and nothing flags it. Dragging a corner until the outline no longer crosses is the
  fix. The Plan editor's own drawing and editing refuse a self-crossing outline, but the Asset
  designer's shape edits do not check for one, and pasting a copied crossing room is not refused
  either (tracker L-29; the owner decided on 2026-09-30 to record these three gaps for the beta
  and change nothing).
- **Pasting an old near-zero object or hatch** that was copied from an older plan is still
  written; elements have no area rule of their own (tracker L-23; owner ruling 40).
- **The getting-started guide's sample-project step** points at a command that is desktop-only;
  on mobile the guide still lists that step and adds "Available for viewing on mobile. Changes
  need a desktop." (owner ruling 53).

## Data safety and crash recovery

Recovery in this plugin is **detection and guarded manual recovery, not automatic crash replay**
(tracker D-02). The details and the steps are in
[Working with saved data](using-planning-recovery.md); what that means as limits:

- **The plugin takes no backup or snapshot of its own.** Keeping one is up to you (tracker D-01
  proposes keeping an optional snapshot out of the beta; owner confirmation is pending).
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
- **Some pauses can fall on a vault that is in fact coherent**, and some of these are accepted
  for the beta:
  - in the Asset designer, an Undo that meets a rare disk fault, a sync client locking the file, a
    delete at the moment of the read, or an asset that fails its own re-save check can pause writing
    although the vault may be fine (accepted by owner rulings 19, 23 and 31; ADR-0034 lists them);
  - when the plugin unloads while a save is still running, it keeps that session's record of
    partly failed writes alive so the save is still checked; until the plugin next loads, that
    older record can answer for the vault (owner ruling 16, tracker L-21).
- **Two more are open owner questions, not accepted:**
  - a rename whose later plan's save is refused by a conflict, or whose later plan fails to load
    with `plan.migration-failed`, after an earlier plan was already written (tracker L-51);
  - a delete whose half-write the plugin repairs at the next load keeps its incident open,
    because nothing retires an incident (tracker L-52).
- **A designer Undo can lose a calibration without recording it.** Two other writers changing a
  calibrated asset during an Undo can leave it without its calibration, shown only as "edited
  elsewhere" and not recorded as an incident (owner ruling 29). Check its scale if you see that
  message.
- **Once a pause lands in the middle of a gesture, the gesture's later steps are refused too**
  (owner ruling 20).
- **A binary downgrade is not a data rollback.** See
  [Back up and restore](using-planning-recovery.md#back-up-and-restore).

## Accessibility

**WCAG 2.2 AA is the target, not a verified result** (`PRODUCT.md`, *Accessibility &
Inclusion*). The automated checks run axe-core in jsdom, which has no rendering engine, so they
measure neither a visible focus indicator, nor contrast, nor hit-target size. The E2E workflow
adds a contrast scan in a real Obsidian over the Renovation project view only. Notices are outside
every scan. No screen-reader run is recorded in any case.

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
