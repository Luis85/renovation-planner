---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 60
sources:
  - PRD §36
  - PRD §83
  - PRD §102
  - SDD §41
  - SDD §46
  - SDD §47
  - ADR-0013
  - ADR-011
status: Ready
---
# A Project Owns Its Folder

Design slice 18: a project's folder is now **derived** — the folder its own note sits in
(ADR-0013) — rather than the single plugin-wide `projectFolder` root every project used to
nest inside. The Project Index and the vault-change pipeline no longer filter by a path
prefix; both ask a note's own frontmatter through one shared function, `entityRefOf`. The
plugin setting survives with exactly one job: where a **new** project's folder is created.
This slice adds no entity, no command and no rendering — it only changes where a note is
written and how the vault is scanned. This file is the **canonical procedure**;
`docs/tasks/18-a-project-owns-its-folder.md` records what the runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled.

**Why a human still matters here.** Three separate things put this slice out of every
gate's reach:

- **The property the whole design was chosen for cannot be demonstrated by any test in
  this repository.** ADR-0013's entire argument is that dragging a project's folder
  somewhere else in Obsidian's file explorer moves the project — writes follow it, because
  the folder is read from the note's current path rather than cached. The fake vault has no
  file explorer and nothing in the suite ever moves a file out from under the plugin.
  Step 7 is the one place that property is actually looked at.
- **This slice's own `FakeVault` finding is the SIXTH recorded instance of "a fake must not
  be kinder than the real thing, not thinner than it, and not harsher than it"** — CLAUDE.md
  numbers five earlier ones in its Testing section (ending at "Fifth instance, and the THIRD
  face of the rule") and records this slice's as the sixth, explicitly, at its own line 549.
  It is on the THIN face specifically, not the same face as the two persistence-vault
  examples the suite already carries — slice 5's `create` that accepted a path whose parent
  folder did not exist, and slice 4's `MetadataCache` parsed synchronously where Obsidian's
  is asynchronous, both of which are the fake being too KIND (accepting what Obsidian
  refuses). This slice's instance is the opposite shape: `FakeVault.getAbstractFileByPath`
  answered `null` for every folder, so `freshProjectFolder`'s collision check — "does a
  folder of this name already exist?" — could never be driven green in the suite at all,
  and would have done nothing in a real vault; a fake too THIN to demonstrate the behaviour,
  not one that wrongly accepted it. It was found and fixed during this slice's own review
  (commit `76cd45f`), before any human had opened Obsidian, which is the good outcome — its
  blast radius was 0 tests, because nothing had shipped yet to be wrong. It is named here
  because the pattern is what to stay suspicious of on this exact surface, not because it is
  still live.
- **The whole-vault scan is a real-vault measurement, and PRD §102 sets no figure to check
  it against.** `frontmatterOf` now runs for every markdown file at `onLayoutReady`, not for
  the handful that used to sit under one prefix — a `MetadataCache` map lookup plus an
  `EchoWindow` digest check, not a file read or a parse, but §102 names "project indexing
  time" as a category needing a budget without setting one. jsdom has no cost model at all.
  Step 11 is a recorded observation, not a pass/fail number, on purpose.

## Steps

| # | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- |
| 1 | Run `npm run test-build`, open this folder as a vault (or reload it), enable the plugin | The plugin loads with no console error | The baseline every other step assumes |
| 2 | Run `Create sample renovation project` **twice** | **Two** folders appear under `Renovation/`, each holding its own project note plus `Plans/`, `Zones/`, `Geometry/` — not two project notes sharing one folder | The old shared-root shape (one `Renovation/` for every project) is what this slice replaces. `freshProjectFolder` appends the project's id to the second folder's name on collision, so the two folder names will differ |
| 3 | Open each project note and read its filename | It is the project's own name (e.g. `Sample renovation.md`), **not** `Project.md` | PRD §36's vault-layout diagram draws `Project.md`; the code has always written a name-derived filename and this slice deliberately does not close that gap — renaming the note would move every existing project's note, which is the migration this slice refuses to build. A tester trusting the diagram over the running code would report a false defect here |
| 4 | Open the plan editor on each project's plan (`open-plan-editor` offers a picker) and draw a zone in each | Each zone's note lands under **its own** project's `Zones/` folder, not the other project's | `ObsidianZoneRepository` resolves its folder from `projectFolderOf(index, zone.projectId)` per write now, rather than from one shared constructor field. Two zones landing in one folder means the wrong project id was threaded through |
| 5 | Confirm each plan's geometry sidecar | Each `.rpgeo` file sits under its own project's `Geometry/` folder, named by that plan's id | ADR-011's rule (project-scoped `Geometry/`, sidecar keyed by plan id) is unchanged; only which string "project folder" resolves to has changed. A sidecar in the wrong project's folder means that resolution broke |
| 6 | Open Settings, change the projects folder to a second root (e.g. `Renovations 2`), run `Create sample renovation project` again | The **new** project lands under the new root; both projects from steps 2–5 keep opening and saving from where they already are | The setting's one remaining job. Both projects still working proves the setting is read only at project CREATION, never at every write |
| 7 | **Drag one project folder to a different location in Obsidian's file explorer**, reload the plugin, open that project's plan and draw a new zone | The project still opens; the new zone's note lands under the folder's **new** location | The property ADR-0013 was chosen for, and the one no automated test in this repository can reach — see the walkthrough's own header |
| 8 | **Rename** a project folder in place (as distinct from moving it), reload, and draw another zone in it | The zone lands under the renamed folder | The same derivation, exercised by a rename rather than a move — Obsidian raises the same underlying vault event for both, but they are different user gestures and worth checking separately |
| 9 | Note the `entries` count in the console's `persistence.index.rebuilt` line at startup. Hand-write a new note **anywhere outside every project folder** (e.g. at the vault root) with frontmatter `type: renovation-zone` and a unique `id`, reload the plugin, and read that line again | The count is **one higher**, and no `persistence.index.note-excluded` warning names this file's path | The declared bound replacing the old path prefix: a note of ours is now found by what it says about itself, not by where it sits. This will surprise anyone still expecting the old "only under the project folder" behaviour — that is the point of writing it down |
| 10 | Duplicate a whole project folder as a backup (copy-paste it elsewhere in the vault, keeping its contents unchanged) and reload the plugin | A `persistence.index.sidecar-duplicate` line appears in the developer console (`Ctrl+Shift+I`), naming a `planId`, the two paths, `kept` (the path the mapping now holds) and `derivedPath` (empty only when the plan's project note cannot be located). The line appears whichever of the two files the scan reached first — order decides which path is `path` and which is `otherPath`, never whether there is a line. No setting change needed to see it: this diagnostic logs at `warn`, and `console.warn` is emitted whenever the level is at or above the plugin's default floor (`'info'`) — the **Verbose logging** toggle only widens the floor to `'debug'` for lower-level lines, so it does not gate this one. Then open a plan and draw one zone: the `.rpgeo` file whose contents change sits in the **same** project folder as the project note that plan belongs to | This is the data-loss-shaped path ADR-0013's own "moves, backs up and deletes as one unit" property opens: two `.rpgeo` files now share both a basename and the plan id inside it, and the sidecar's own verification cannot tell them apart. What is checked is CONSISTENCY, not a winner: copying the folder duplicates the NOTES too, and which project note the index resolves is still note-level last-writer-wins by scan order, so either project winning is a pass. The defect to catch is the plan resolving from one folder while its geometry resolves from the other — `sidecarMappingFor` keeps the derived sidecar for exactly that reason |
| 11 | Open a large vault (hundreds to thousands of markdown notes) with the plugin installed, and note whether startup feels slower than before this slice | Record the observation — do **not** write a pass/fail threshold | `frontmatterOf` is now called for every markdown file rather than the handful under one prefix. PRD §102 names indexing time as a budget category and sets no figure, so there is nothing yet to clear — only something to watch |
| 12 | Open Settings → Renovation Planner | The setting reads "Default projects folder", its description explains it is where a **new** project's folder is created and that an existing project keeps the folder it is already in, and the label is sentence case | `settings.project-folder.name`/`.desc` in `src/presentation/i18n/locales/en.ts` — read directly, not paraphrased |
| 13 | Set the projects folder to a custom value, then disable and re-enable the plugin (or reload Obsidian) | The custom value is still there | `settingsFrom` still reads/writes the stored key `projectFolder` — renamed only in copy, not in `data.json` — so an old value is never silently reset to the default |
| 14 | Reproduce the real pre-slice-18 layout without hand-typing any frontmatter: take one of the two projects from step 2, and in Obsidian's file explorer move its `Plans/`, `Zones/` and `Geometry/` folders **up one level**, out of the per-project subfolder and directly beside the project note — so, e.g., `Renovation/Sample renovation.md` sits next to `Renovation/Plans/`, `Renovation/Zones/`, `Renovation/Geometry/` — then delete the now-empty per-project subfolder. Reload the plugin, open that project's plan, and draw one more zone in it | The project, its plan and its pre-existing zones all still open and read correctly; the **new** zone's note lands in the flattened `Zones/` folder | The "no migration owed" claim, made concrete rather than hand-built from a guessed frontmatter shape: the actual pre-slice-18 layout was never `Renovation/Project.md` — the project note's filename is name-derived (step 3) — it was `Renovation/<Project name>.md` with `Plans/`/`Zones/`/`Geometry/` directly beside it. Reusing an already-written, schema-valid project (rather than hand-typing one) is deliberate: a hand-built `renovation-project` note needs `type: renovation-project`, `schema-version: 1` (an absent `schema-version` reads as version 0, and there is no migration step from 0 — the note would refuse to load), a non-empty `id`, a `name`, and a `status` that is one of the ten Renovation Lifecycle values (e.g. `status: idea`) — a hand-built fixture missing exactly `status` is what a prior review round on this slice actually found (see this case's report). Flattening a real note sidesteps that whole class of false refusal while still proving the folder shape, for both a READ and a fresh WRITE |
| 15 | Switch Obsidian's language to German (Settings → General → Language) and reopen the settings pane | The projects-folder setting's name and description are in German | `settings.project-folder.name`/`.desc` are both answered in `de.ts` |
| 16 | **With the plugin still running** (no reload), copy one plan's `Geometry/<plan id>.rpgeo` file — the file alone, not the folder — into any other folder in the vault. Then draw a zone in that plan, then delete the copy, then draw another zone | A `persistence.pipeline.sidecar-duplicate` line names the copy as `path` and the original as `otherPath`; both zones land in the **original** sidecar (the copy's contents never change); deleting the copy neither breaks the plan nor loses a zone | The incremental door, which is the one that had no guard at all when step 10's scan got one: `processSidecar` repointed the mapping onto any arriving `.rpgeo` with a matching basename, so every geometry write after the copy landed in the copy, and deleting the copy then left the plan's geometry unresolvable (`plan-geometry.path-unresolved`) with the original file frozen at whatever it held before. Step 10 cannot see this — a reload adjudicates through the scan instead |

## Deliberately NOT checked

- **Folder overlap between a project and the library.** `foldersOverlap` is slice 19's
  predicate, built where it has a caller — there is no library folder to overlap with yet.
- **A one-time folder migration and its partial-move diagnostic.** Withdrawn, not deferred:
  under the derived shape the existing single-folder layout is already a valid project
  folder, so nothing has to move (see step 14).
- **The orphan diagnostic.** Withdrawn: under a declared bound (a note is ours if it
  declares our `type` and a non-empty `id`) there are no orphans, so there is nothing to
  report.
- **Two projects deriving the same folder.** Reachable today — running the seed command
  twice under the pre-slice-18 build produced exactly this — and it is untidy but not
  corrupting: every entity note carries `project:` frontmatter, so the index attributes each
  note to its own project regardless of which folder it sits in, and sidecars are keyed by
  plan id rather than by folder. Worth naming as known-and-tolerated rather than left for a
  tester to file as a new defect.
- **A vault read failure rendering as anything other than a refusal.** Forcing a persistence
  fault by hand inside Obsidian is not a step anyone can follow reliably; it is asserted in
  the automated suite instead.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design document, ADR-0013 and the code, not an observation. |

Fill this table in on the first walkthrough, and treat anything it finds as a defect of
slice 18 rather than of this case — with a test that fails without the fix, per the suite's
own rule.
