---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 65
sources:
  - PRD §36
  - PRD §83
  - SDD §47
  - SDD §65
  - SDD §66
  - SDD §84
  - SDD §85
  - ADR-0013
status: Ready
---
# Move the Library

Design slice 19: the asset catalogue leaves the project. Assets are a **vault-wide**
library under one configurable folder rather than a per-project folder, `libraryFolder` is
a **migration** rather than a preference (PRD §83 — the setting "moves the catalogues,
rebuilds the index, and refuses the new value until the move has succeeded"), and a
project folder that overlaps the library is **marked on its row** rather than refused,
because §83's third site has no door to refuse at. This file is the **canonical
procedure**; `docs/tasks/19-the-asset-catalogue-leaves-the-project.md` records what the
runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled.

**Why a human still matters here, and why this case exists at all.** Moving the library is
the most destructive operation this plugin performs — it renames every catalogue note in
the vault — and it has never been run in a real Obsidian. Three separate things put it out
of every gate's reach:

- **Every collaborator it has is a real-Obsidian API a fake stands in for.**
  `fileManager.renameFile`, `vault.createFolder`, `vault.getAllFolders`, `vault.getFiles`
  and `FuzzySuggestModal` — five surfaces, five fakes. CLAUDE.md's Testing section numbers
  the fake-too-thin / too-kind / too-harsh / too-fast instances this repository has already
  paid for, and **four consecutive ones were found by running the plugin rather than by any
  gate**. The suite cannot tell a fake that accepts what Obsidian refuses from an Obsidian
  that would have accepted it.
- **The whole reason this is a rename is a property no fake models.** `renameFile` is
  Obsidian rewriting the vault's own links; a create-and-delete would leave every
  `[[Tiles]]` pointing at nothing. The fake vault has no link graph at all, so step 6 is the
  only instrument for the argument the design rests on.
- **Five hardening rounds produced five properties only a vault can show.** The picker's
  real item list, its dismissal path, the synchronous lock under a genuinely slow rename
  loop, the `onClose`/`onChooseItem` ordering, and the §83 marker's own data path — see the
  clause notes on each step below, and the *Deliberately NOT checked* section for what
  remains out of reach even here.

**One thing to know before starting: nothing in this build inserts an asset.**
`CreateAssetCommand` is composed and guarded, and no view, dialog or plugin command calls
it — the assign picker offers assets that already exist and creates none. So the library
folder's lazy creation (step 2) has no user gesture behind it in this build, and the
catalogue this case moves is hand-written (step 3). That is a fact about slice 19's
surface, not a defect to file.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge
it as written. [[Smoke Test the Editor]]'s *The triage column* section defines the five
values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Run `npm run test-build`, open this folder as a vault (or reload it), enable the plugin, and open the developer console (`Ctrl+Shift+I`) | The plugin loads with no console error | The baseline every other step assumes |
| 2 | `obsidian` | With the plugin freshly enabled and no assets anywhere, look at the file explorer and at Settings → Renovation Planner | **No** `Renovation/Library` folder exists, and no `Suppliers/` or `Trades/` folder exists under it either — while the settings row reads "Library folder — Currently Renovation/Library. Changing this moves the notes." | The folder is created **lazily**, by `ObsidianAssetRepository` on the first asset INSERT, and never by loading the plugin or by rendering the setting. `Suppliers/` and `Trades/` are anticipated in `assetsFolderFor`'s neighbouring comment and in PRD §36's diagram, and **nothing creates them** — a tester expecting the diagram's full shape would file a false defect. A folder appearing here means something is eager that must not be: the setting's description prints the configured path without touching the vault |
| 3 | `obsidian` | Hand-write the catalogue, because nothing in this build inserts one. Create `Renovation/Library/Assets/` in the file explorer and put two notes in it — `Tiles.md` and `Paint.md` — each with frontmatter: `type: renovation-asset`, `schema-version: 1`, a unique non-empty `id`, `name`, `category: material`, `unit: m2`, `unit-cost: "24.50"` (a quoted decimal STRING, never a YAML float — ADR-010), `currency: EUR`. Reload the plugin, then open a plan editor, select a zone, and open the Assign picker | Both asset names are offered in the Assign dropdown | Two things at once: the notes are real assets the index accepts (a missing `schema-version` reads as version 0 and there is no migration step from 0, so the note would refuse to load — the exact false refusal a prior slice's walkthrough actually hit), and the picker in a **restored** leaf is populated. This second half is the regression this branch's final wave fixed: `PlanEditorView.sync()` mounts on the restored view state before `onLayoutReady`, so the options used to be read against a still-empty index and stayed empty for the life of the leaf |
| 4 | `obsidian` | In some unrelated note (e.g. the vault root's daily note), write a wikilink to one asset: `[[Tiles]]`. Confirm it resolves before going any further | The link is live, not an unresolved-link colour | The setup for step 6, and it must be established BEFORE the move or that step proves nothing |
| 5 | `obsidian` | Create a folder `Shared` at the vault root. Open Settings → Renovation Planner and press **Move the library** | A fuzzy picker opens. Its items are folders **the vault already has** — there is no field to type a new path into. `Renovation/Library` itself is **absent** from the list, as is every project folder (and anything inside one) | `libraryDestinations` filters the offered list in both directions, and the picker's shape is the honest cost of using `FuzzySuggestModal`: it chooses from a list, so a destination that does not exist yet has to be created in the file explorer first. A path typed by hand cannot be mistyped because it cannot be typed. **The filtering is a convenience and never the guard** — step 9 is where the guard itself is looked at |
| 6 | `obsidian` | Choose `Shared` | `Renovation/Library/Assets/Tiles.md` is now `Shared/Assets/Tiles.md` and `Paint.md` beside it — the path **relative to the old root** is preserved, so the notes are under `Assets/`, not flattened to `Shared/Tiles.md`. The settings row's description re-reads as "Currently Shared." And: **the `[[Tiles]]` link from step 4 still resolves** | The whole argument for a rename. `fileManager.renameFile` is Obsidian rewriting its own link graph; a create-and-delete would leave that link dangling, and **no fake in this repository models a link at all** — this clause is the only instrument for it anywhere. The relative-path half is its own defect class: `note.name` alone would flatten `Assets/` away and collide the moment `Suppliers/` and `Trades/` exist. The re-read description is `update()` rather than `refreshDomState()`: only a re-read of the definitions changes a row's DESCRIPTION |
| 7 | `obsidian` | Press **Move the library** again and dismiss the picker with `Esc`. Then press it again and dismiss by clicking outside it. Then press it a third time and choose a destination | Both dismissals leave the row **enabled**, and the third press opens a working picker that completes a real move | The lock is released on the cancel path. Dismissal is the picker's only way to answer "nothing was chosen", and without an answer `migrating` is never cleared and the row is disabled **for the rest of the session** — a failure that arrives quietly and only in a vault. This step is also **the only instrument for `onClose`'s `queueMicrotask`**: Obsidian's own ordering of `onChooseItem` and `onClose` is not stated in the typings (`SuggestModal` is widely believed to close before it delivers the choice), so the suite drives both orderings against a mock and neither ordering is a claim about the real host. If a chosen destination were ever silently discarded as a cancellation, this is where it shows |
| 8 | `obsidian` | Make the move slow enough to race: put **thirty or more** asset notes in the library folder (copy `Tiles.md` and give each copy a unique `id`), reload, then **double-click** the Move-the-library action fast enough that the second click lands while the first move is running | Exactly **one** picker opens and exactly **one** move runs. No second picker appears behind the first, and no note ends up moved twice or half-moved | `migrating` is a SYNCHRONOUS lock set before anything yields, not a rendering state: `disabled` is evaluated per render and needs an `update()` to be re-evaluated, and the picker's own one-at-a-time only covers the window while it is up — which closes when the destination is submitted, **before** the rename loop finishes. A second click during a slow migration would otherwise start a second rename loop from the same old root. jsdom's rename loop finishes in one tick, so the suite can only drive the lock synthetically; a real vault with real files is where the window is genuinely open |
| 9 | `obsidian` | Press **Move the library**, and while the picker is open, drag a project folder in the file explorer **into** the folder you are about to choose. Then choose it | A notice appears reading **"That folder is inside a project folder, or contains one."** — not a generic category sentence — and the catalogue does **not** move | `settings.library-overlaps-project`, and the reason the picker's filtering is not the guard: the offered list is built before the modal opens, so a project folder can arrive under a destination between choosing and applying. The notice is `surfaceError(..., { kind: 'explicit-operation' }, noticeOnlySinks)` — a settings tab has no view of its own to fail in place, no form banner and no save indicator, so a notice is the honest sink set. **Read the sentence, do not paraphrase it**: a code with no locale entry does not degrade to silence, it degrades to the wrong sentence (the Validation category one), which is a defect this repository has already shipped once |
| 10 | `obsidian` | Undo step 9's drag. Create `Spare/Assets/` and put a note called `Tiles.md` in it (any content). Then move the library to `Spare` | A notice appears reading **"The library could not be moved, so the setting was not changed."**, the setting still names the old folder, and the console carries a `settings.library-move-failed` line whose `moved` array names however many notes had already been renamed | `settings.library-move-failed`, the partial-move path, driven by the one collision a human can arrange by hand: Obsidian refuses a rename onto an existing path. **The partial move is not compensated** — see *Deliberately NOT checked* — so the honest pass condition is that the setting was NOT persisted and the diagnostic names the count, never that the vault is back where it started |
| 11 | `obsidian` | Set **Default projects folder** to the library folder itself (or to a folder inside it), open the Renovation project view and create a project through the New project form | The form shows a banner reading **"That project folder would overlap the library folder."**, no project is created, and **no folder is left behind** in the vault where the project would have gone | `project.folder-overlaps-library` — §83's first door, the one that CAN refuse. It has no `FieldErrorMap` entry, deliberately: the refusal is about a folder relationship rather than about a field, so it belongs in the banner. The orphan half is why the guard sits BEFORE `ensureFolder`: the compensation this repository already carries is for a write that FAILED, not for a refusal it could have made first, and a folder left behind pushes the retry onto an id-suffixed name |
| 12 | `obsidian` | Put the projects folder back. With the library at `Shared`, drag a whole project folder **into** `Shared` in the file explorer, reload the plugin, and open the Renovation project view | That project's row carries a marker with **both a triangular mark and the words "Overlaps the library folder"** — never one without the other | §83's third site, end to end **through the data path**, which is the half nothing has ever exercised: task 9 verified this marker by injecting the span into the DOM by hand, so `ListProjects` → `IndexLibraryOverlaps.overlapping` → `ProjectSummaryDto.libraryOverlap` → the `v-if` has never actually rendered it in anger. A mark AND a word is SDD §85's refusal of status carried by colour alone, and the mark is a `::before` drawn out of borders — a rule declaring nothing but `content: ''` satisfies "the stylesheet declares this class" and draws absolutely nothing, which is what the first draft of that block did |
| 12a | `obsidian` | Drag the Renovation project view into a **sidebar** leaf (about 460px wide) and look at the marked row again | The marker is fully visible and legible, the project name is what gives way, and nothing overflows the row | The marker is the **third** child of a `space-between` flex row. 460px is the width an Obsidian sidebar leaf actually has, and it is the width that has already hidden a layout defect the default 1280 could not show. `flex-shrink: 0` on the marker is what should make the NAME the item that truncates — a truncated warning is a warning that no longer says what it is about — and jsdom lays nothing out, so no gate anywhere reads this |
| 12b | `obsidian` | Drag one project's `Project.md` to the **vault root** (leave its `Plans/`, `Zones/` and `Geometry/` folders where they are), reload the plugin, open the Renovation project view, then press **Move the library** | That project's row carries the same marker as step 12 — the triangular mark **and** the words "Overlaps the library folder" — and the destination picker opens with **no items at all**, so no destination can be chosen and the catalogue does not move | The vault ROOT as a project folder, which ADR-0013 makes reachable by exactly this gesture: `projectFolderOf` is `parentOf(Project.md)`, and a note at the root derives the root. The root contains every folder, so §83 must mark that row and refuse every destination — and this is the **only instrument anywhere** for which string Obsidian's `normalizePath` answers for the root. `foldersOverlap` folds `''` and `'/'` together deliberately because that answer is undocumented and cannot be asked from this repository; the mock answers `''`. An unmarked row here, or a picker offering folders, is that fold failing in a real vault, and it means both §83 safeguards are off for the one case that costs every project's catalogue |
| 13 | `obsidian` | Rename the library folder in the file explorer to a **case-differing** spelling of what the setting names (e.g. `Shared` → `shared`), leaving the setting untouched. Reload Obsidian, then press **Move the library** and choose any destination | A notice appears naming the case mismatch — "The library folder does not exist at the spelling this setting names, though a similarly named folder does. Rename that folder to match before moving." — and **nothing is moved or persisted** | `settings.library-source-case-mismatch`, and it is the ONE arm of this migration that could otherwise report success having moved nothing: the catalogue enumeration matches paths exactly (it must not fold — over-selecting MOVES FILES), so a misspelt source selects nothing, moves nothing, raises nothing, and persists the destination as though it had worked, leaving the catalogue at a path no setting names any more. The guard is a conjunction because "the folder is not there" is true of two states, and the other one — a genuinely absent folder on a fresh vault, step 2 — must go on succeeding |
| 14 | `obsidian` | Switch Obsidian's language to German (Settings → General → Language) and repeat steps 5 and 9 | The picker's placeholder, the two library rows and the refusal notice are all German, and the notice reads "Dieser Ordner liegt in einem Projektordner oder enthält einen." | `de.ts` translates every key `en.ts` declares, and nothing in any gate RENDERS `de.ts` — the two German terms `strings.test.ts` pins are two words, not the language. Every earlier German defect in this repository (a wrong term, a garbled word, one noun with two genders) was found by a human reading the rendered pane |

## Deliberately NOT checked

- **Partial moves are not compensated.** Step 10 leaves some notes at the destination and
  the rest at the source, with the setting still naming the source. That is the documented
  cost, identical to slice 18's migration and for the same reason: a reverse move can fail
  the same way and leave no coherent shape. The notes that did move are still readable, and
  the setting still names the folder the rest of them are in. Do not file it as a defect;
  the diagnostic naming the count is the whole of what is owed.
- **The late-arrival window during the rename loop.** `catalogueNotes(source)` is read once,
  before the awaited loop, so an asset note created or dragged into the source *while the
  loop runs* is not moved. There is no way to hit that window deliberately at human speed,
  and no instrument here can hold it open. It is also **not** a split catalogue, which is
  why it is listed here rather than as a defect to hunt: since slice 18 the index is bounded
  by what a note DECLARES rather than by where it sits, and `ObsidianAssetRepository.listAll`
  reads the TYPE axis, so such a note stays discoverable, readable and updatable — an update
  writes where the note already sits, and only inserts go to the library folder. The whole
  outcome is one asset filed outside the library, which is the state Task 5's open question 3
  already declares legal.
- **`settings.library-folder-empty` and `settings.library-overlaps-source`.** Both are
  unreachable through the picker and are named here rather than listed as checkable rows.
  The empty value has nowhere to come from: the picker offers folders the vault has, and
  `getAllFolders(false)` excludes the vault root, so there is no item that could be an empty
  path. The source overlap is filtered out of the offered list in every direction — equal,
  containing and contained — so no item the picker can return can trip it. Both guards are
  real and both are asserted in the automated suite; neither has a gesture behind it.
- **`settings.library-rebuild-failed` and `settings.library-persist-failed`.** Forcing an
  index rebuild or a `data.json` write to fail by hand inside Obsidian is not a step anyone
  can follow reliably. Both are asserted in the suite, and both carry their own code
  precisely because their recovery differs from the move's: after either one the notes are
  already at the destination, so re-running the migration is not the remedy — pointing the
  setting at where they now are is.
- **The TOCTOU window on the destination during the rename loop.** A project created or
  moved beneath the destination *after* validation and *during* the awaited loop is not
  re-detected, so the migration can persist a library that now contains a project. Deferred
  deliberately rather than left unnoticed: this slice's declared answer to "the library
  contains a project" is the row marker of step 12, which covers a project that arrives by
  any route including this one.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from PRD §83, the design document and the code, not an observation. |

Fill this table in on the first walkthrough, and treat anything it finds as a defect of
slice 19 rather than of this case — with a test that fails without the fix, per the suite's
own rule.
