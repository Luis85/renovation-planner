# Renovation Planner — agent guide

An Obsidian plugin for planning a renovation: plans and zones, assets and quantities, costs,
trades, work packages and a schedule. The target architecture is
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](./docs/development/sdds/obsidian-renovation-planner-SDD.md)
and the product intent is in `docs/product/prds/`. **Read the SDD before proposing structure**: it
has already refused things that look obvious from the code alone, and where this guide and
the SDD disagree, the SDD is the authority and this file is the bug.

Today the build, the gates, the browser harness and the release pipeline work; the
settings pane declares **seven rows and four of them bind a control** — units, the default
projects folder (where a NEW project's folder is created, since slice 18; an EXISTING project's
folder derives from where its `Project.md` sits instead, ADR-0013), the currency increment's
`defaultCurrency` and slice 11's verbose
logging, plus slice 19's two library-folder rows, one INFORMATIONAL and one an ACTION, and the
unreadable-note increment's diagnostics-report ACTION row, the second of that report's two
doors beside the palette command. The three that bind nothing each have their own reason, and
only the library pair share one: `setControlValue` writes through `saveSettings` on every
change, and a control on `libraryFolder` would persist a folder with no notes moved and strand
the catalogue.
Counted in `getSettingDefinitions` rather than remembered — this sentence said "the one setting
there is" for several slices after it stopped being one, then "the three settings there are"
through slice 19, then **"five rows and only three of them bind a control" for slice 21 and
through the currency increment that added the sixth row**, which is the same failure a third
time in a sentence that already recorded the first two. The distinction between a row and a
control did not save it; only counting did. **The seventh row arrived by MERGE rather than by
an edit to this file**, which is the fourth way this count can go wrong and the one no author
of either branch is looking at: two branches each added a row, each correctly updated the
sentence to six, and the merge of them is seven with both sentences reading right in isolation.
`tests/plugin/settings/unrecovered.test.ts` is what caught it, because it asserts the count
rather than describing it. The persistence layer of design slice 4 is in
place — Obsidian repositories, the geometry sidecar store, the project index and its
vault-change pipeline
(bounded since slice 18 by what a note DECLARES, not by where it sits, which closes slice 4's
own recorded multi-root prerequisite without registering a single root), and the migration
runner.

**Every entity and mechanism the MVP architecture needs now exists**, which is what slice
10 closing means: `Project`, `Plan`, `Zone`, `Asset` and `Requirement`, the quantity and
cost engine behind them, the reference-integrity engine that guards deleting either end of
a link, and the recalculation cascade that keeps a figure honest when its inputs move.
Everything past this point is feature work on a proven template. Slice 11 closed
the first half of the cross-cutting pair — the Error Boundary, the logging policy,
diagnostics and the data-safety rules — and **slice 12, its second half, has since closed
too**: `docs/requirements/Errors, diagnostics and the test harness.md` opens
"Slices 11 and 12: the two cross-cutting slices", so those two are the pair and nothing else
can be a half of it. An earlier draft of this passage gave that half to slice 13 in the same
breath as it listed slice 12 as outstanding — a sentence contradicting itself two clauses
later. Slice 13 belongs to *Shared UI vocabulary* (slices 13–17), and what it closed there is
the toast and the save-state badge — the notice queue and
the save-state indicator, the surface any view or command reports a transient message or a
save state through. **That group is now complete: 14 and 15 landed first, then 16, and slice
17 — the integration slice the map calls "17 integrates them" — has closed it.** **Design slice
19 has closed since**, which is what took slice 10's own document from seven open criteria to
none: the Asset catalogue left the project, so a catalogue entry carries no project id at all.
**Design slice 21 has closed too, and slice 20 has now closed BOTH of its halves** — the currency
invariant first, then the per-project price override it was split from. This sentence has been
wrong here three times running, each time in the same direction and each time about a slice whose
own section further down this file already said otherwise: it read "slices **20 and 21**, which
are written and unbuilt" for a slice after 21 landed; then "20 has closed its FIRST HALF … the one
increment written and unbuilt now" through the increment that built the second. The remedy is not
a more careful sentence — it is that **this paragraph names no slice as outstanding at all**, so
there is nothing here to go stale, and a reader asking what is unbuilt is sent to
`docs/tasks/` where the checkboxes are. Also not done are the items slices 16, 17, 19,
**20** and 21 WITHDREW or narrowed rather than ticked; each is recorded in its own task
document's amendments rather than here, because a list of exceptions kept in two places is one
that disagrees with itself.

**Every workspace surface mounts its own isolated Vue app** (SDD §12) — nothing outside a view
knows it is Vue. **This sentence carried a NUMBER until the merge that read it beside its own
conclusion**, which is the sharpest form this defect has taken here: the lead said *four* in
bold and the sentence four lines below it said *No count is stated here, therefore* — one
paragraph, written in one commit, disagreeing with itself about whether it was allowed to
count. Neither half was wrong about the tree; the paragraph was wrong about the paragraph, and
nothing in any gate reads whether a passage's argument survives its own opening clause. This
sentence said TWO for a slice after the third was
registered and THREE for a branch after the fourth was, and the second time it was already
"re-founded on `registerView`" — so a COUNT is not what fixes it, whatever the count is of. Two
reasons, and only the first was known: a number written here is a number nothing re-runs, and
`grep -c "registerView" src/plugin/RenovationPlannerPlugin.ts` answers one MORE than the calls
because that file's own prose names the call, so the obvious re-measurement misleads too.
No count is stated here, therefore. **The registered view types are pinned in order, by exact
array, by `tests/plugin/settings/unrecovered.test.ts`** ("registers the view and the command
anyway") — that assertion is where the NEXT one arrives and fails, rather than here where it
would read correctly forever. Not *a fifth*, which this sentence said while the array already
held five: the pin is over REGISTRATIONS and the paragraph is about Vue ROOTS, and an ordinal
borrowed from one of those two counts the other. Which of them mounts a Vue ROOT is the different fact and the one
this paragraph is about: every entry on that list except `GEOMETRY_SIDECAR_VIEW`, which is
registered and mounts none. The **Renovation project** view is a singleton with
a ribbon button and a command, and it now draws **a project list** — design slice 16's
`ProjectList.vue`, not slice 17's: that document is the error-surfacing decision table and
never once mentions one, so the list was owned by no slice until slice 16 claimed it. This
paragraph said "still no project list" for slices 14 and 15, which was true until slice 16
landed. `ViewRoot.vue` renders `ProjectList` whenever the empty state does not apply, and slice 14's
`renovationProject.noProjects` in its place when it does — the two never draw together, gated
on the same `'ready'` status the rest of this paragraph describes. **"Whenever the empty state
does not apply" is not "once the vault holds at least one project", and this sentence said the
second for a review round:** `selectRenovationProjectEmptyState` answers `null` on
`unreadable > 0` BEFORE it ever looks at the length, so a vault whose only projects are ones
this build cannot read draws an empty LIST — its header, its Create button and no rows —
beside the refusal notice, which is the right picture and not the one the sentence promised.
The list is the `v-else`, so it is what draws in every case the selector declines, present and
future; the mapped failure sentence for the refusing `AppError`'s own code
(`.rp-view-message`, via `trError`, so unrecovered settings and a vault fault say different
things); a loading line in that same region while the read is in flight; and
`.rp-view-notice`, the one ADDITIVE one, when SOME project notes refused
(`view.project.some-unreadable`). Slice 15's `DialogHost` mounts here too and is invisible
until something opens a dialog — slice 16's `NewProjectForm` is its first caller in this
view, opened from the empty state's action button and from `ProjectList`'s own header.
`ListProjects()` resolves to a `ProjectListResult` —
`{ projects, unreadable }`, not a bare array; the PORT below it answers a `ProjectListing`,
`{ loaded, refused }`, and the rename across that seam is deliberate — and the empty state is the `'ready'` status
with BOTH halves clear: an empty list with `unreadable > 0` is a vault that has projects this
build could not read, so it gets the notice and no "no projects yet".

**That list is a LAUNCHER since the Renovation Planner Home increment**, and this paragraph
describes the bare `<ul>` it grew out of rather than what draws today — a filter that is also
the pane's count line, two facts per row, a ten-step status strip, a `Continue` group, a
collapsed `Completed` group and a foot line, with the header and the empty state unchanged.
Left standing rather than rewritten, because every sentence in it is still true of the seam it
is about (`ListProjects`, the `'ready'` gate, the two-halves empty state, `DialogHost`); the
Home section far below carries what was added and what building it taught.

**Design slice 21 gave that view a SECOND state, and everything above describes the first
one.** A project row NAVIGATES now rather than opening `Project.md`, into a detail state that
draws one project — its name, its lifecycle status, an **Open note** action (the only surface
left that opens the raw note), a **‹ back**, and that project's plans with a `New plan` form
dispatching the real `CreatePlanCommand`. A project that turns out not to be there draws a
screen saying so, with its own way back, and **nothing redirects on its own** — reached
identically from a read that missed, from `CreatePlanCommand`'s `plan.project-not-found`, and
from a back-arrow restore of a project since deleted. Which project is open lives in **Obsidian's own view
state** (`getState`/`setState`), never in Pinia: `rebind` remounts the whole Vue tree on a
settings save, and a Pinia-held selection would throw the user out of the project they are in.
`ViewRoot` reads `context.projectId` ONCE — `null` is the list, a string hands the whole state
to `ProjectDetailState.vue`, which owns its store, its two subscriptions and its own dialog —
and the view REMOUNTS per navigation (`sync`), which is what makes that value unable to go
stale rather than a `Ref` somebody has to keep fresh. Navigation goes through
`leaf.setViewState` and sets `ViewStateResult.history`, so **the pane's own back and forward
arrows walk it** — the in-app ‹ back is a different mechanism from that arrow (it SETS a state
where the arrow asks Obsidian to RESTORE one) and both carry the same `''`-means-the-list
sentinel `getState` writes. Whether Obsidian honours the arrow is checkable nowhere here —
`FakeLeaf` records asks rather than behaving — so it is left to
`docs/tests/cases/Navigate into a project and back.md`, **which is written and has not been run
in a vault**: that case's Runs table says so, and slice 21's own outcome row said "walked" over
it until a review bot compared the two. An unrun manual case is a plan to find out, not a
finding. The **Plan editor** is per-plan (several
leaves coexist, keyed by a plan id in Obsidian's own view state): §60's five shell regions
around a Konva stage of §17's seven layers, the Zones of one Plan, an image or PDF
background, and a pan/zoom camera — slice 5. **That canvas is editable now**, which is the
next section: slice 6 built the tool framework underneath it (`EditorTool` and its switching
lifecycle, `CommandHistory` undo/redo, the reversible move-zone command, transformer
normalization, the snap service, the selection store and the Inspector's
selection-to-DTO-to-command pipeline), slice 7 added the first concrete tool, slice 8 wired
the framework into the editor for real, and slice 15 made slice 7's tool reachable. This
paragraph said "nothing on that canvas is editable" for four slices after it stopped being
true, contradicting the sentence immediately below it. The one thing slice 5 writes is which
document a Plan's background IS.

The **Asset designer** is the third, and it is per-ASSET rather than per-plan — design slice B3,
ADR-0015, keyed by an `assetId` in Obsidian's own view state exactly as the Plan editor is keyed
by a plan id. That ADR exists because the code had already taken a decision a `docs/issues/` note
records as REJECTED: that note is `status: Done` and says slice 05 registers no new view type,
while `RenovationPlannerPlugin.ts` registers `PLAN_EDITOR_VIEW`. ADR-0015 follows the code rather
than the note, says so, and the note carries a pointer back — because a contradiction findable
from only one side is one the next reader resolves the wrong way.

The **Asset library** is the fourth: one vault-wide catalogue of every `Asset`, reached through
`revealView` exactly as the Renovation project view is, drawing shelves of rows and an inspector
for whichever row is selected. Its own design document is
`docs/user-experience/archive/asset-library-overview-DESIGN-SPEC.md`, which is the authority for every
section number the `src/presentation/library/` modules cite; this file describes no part of it
that document already owns.

**Its shell regions are held reachable by an import-graph walk, not by a habit.**
`tests/presentation/designer/regionsReachable.test.ts` requires every `.vue` under
`src/presentation/designer/` to be reachable by import from `AssetDesignerView.ts`, and
`assetDesignerRoot.test.ts` asserts each region is drawn. Two instruments for two different
failure modes: a component created and mounted nowhere, and a region silently dropped while its
component stays reachable elsewhere. The walk is driven against seven fixtures BEFORE it is
pointed at `src/` — reached, not reached, transitive, dynamic `import()`, a cycle, an
unresolvable specifier, a layer bound — because an instrument that reaches nothing looks exactly
like a clean tree, and it asserts it found something at all.

Written that way because the alternatives all fail in the same direction. A region registry the
root iterates relocates the forgetting rather than closing it; named slots move it up to whoever
mounts the root, which is another file in the same task; and a test asserting "this placeholder
region is empty for a stated reason" stays GREEN on exactly the day somebody forgets, so it
certifies the gap. `npm run analyze` cannot cover it either — fallow reports an unimported FILE,
and a component's own test imports it.

**What the walk cannot see is written into its header**: it reads specifier text, so a component
imported and never rendered counts as reached. Measured rather than assumed — an unrendered import
in the root reports `'X' is defined but never used` under `@typescript-eslint/no-unused-vars`, so
imported-implies-rendered is held by lint rather than by this test, and the gap is named where the
next reader is standing.

**The recorded history of every design slice and increment lives in**
[`docs/development/agent-guide-increment-history.md`](./docs/development/agent-guide-increment-history.md)
— what each slice landed, what it withdrew rather than ticked, and the review-round findings
behind the shape of each module. It is reached through the `increment-history` skill rather than
loaded here, because it is a record of how the code got this way and not a rule about working in
it. **Read it before proposing structure in an area a slice has already touched**: it has refused
things that look obvious from the code alone, and every recurring failure shape this repository
has paid for is written down in it.

**Which plan the editor opens is a PICKER**, not the active file. `open-plan-editor` used a
`checkCallback` requiring the active note to be a Plan, which kept it out of the palette in
every vault that had no plan notes — and nothing in the app could create one, so that was
every vault. It is a plain callback over a `FuzzySuggestModal` of the Project Index's plan
entries now. The command ID did not change, because a user's hotkey is bound to it.

**`create-sample-project` is SCAFFOLDING and says so in its name, and it is now a
CONVENIENCE rather than the only source of anything.** One command seeds a project, a plan and
five zones through the real `CreateProjectCommand` / `CreatePlanCommand` /
`CreateZoneCommand`, then opens the editor on what it made — the vault-side equivalent of
`npm run harness`. Exactly three commands and nothing else: no asset and no requirement, which
is worth saying because a reader reasoning from slice 10's closed loop would expect them.
Zones stopped needing it once slices 6 and 8 gave `DrawPolygonTool` a way
to draw one by hand; the PROJECT half stopped needing it once slice 16 gave
`renovationProject.noProjects` a real action (`NewProjectForm` / `CreateProjectCommand` —
Amendment 1's "ships with no action at all" held through slices 14 and 15 and stopped being
true here) and gave `ProjectList` its own header button beside it; and the PLAN half stopped
needing it in slice 21, whose detail state carries a `New plan` button over the real
`CreatePlanCommand`. This paragraph said "the PLAN half is what this module is still the only
source of … there is no project-detail surface a 'new plan' action could live on" until that
slice landed, which is a trigger stated in prose firing without anything to notice it. What is
left is the reason it was written for: one gesture produces a scene worth LOOKING AT, where
assembling the same one by hand is two forms, two navigations and five polygons drawn vertex
by vertex. **Its trigger is now that it stops being USED** — a fact about a habit, which no
gate can report. `src/plugin/sampleProject.ts` carries that and why the partial notes a failed
seed leaves behind are deliberate.

Both of those were **found by a human running the plugin in Obsidian**, not by a gate, and
each is written up where the code is: the seed's first run failed on Obsidian's
asynchronously-populated `MetadataCache`, then on a missing `Geometry/` folder, and toggling
the plugin off and on logged `Several Konva instances detected`. `npm run check` was green
for all three, and each one was a FAKE that accepted what Obsidian refuses.

Requires Obsidian 1.13.0+.

**The settings pane is DECLARATIVE** (`getSettingDefinitions`, plus `getControlValue` /
`setControlValue`), which is what 1.13 renders from and what it indexes for the settings
search; `display()` is deprecated, is called only when the definitions are empty, and
`eslint-plugin-obsidianmd` fails the build for a tab with neither — a suppression is not
available, since the ruleset also forbids disabling its own rules inline. A setting is
added by returning one more definition; the read and write overrides are keyed generically
and need no branch per field.

**Both ends of a setting go through `settingsFrom`.** `data.json` is a file the user can
edit, so it is a trust boundary: a value outside the vocabulary falls back to the default
and a key this version does not declare is dropped, on the way in AND on the way out. A
cast at either end would be a second answer to what a setting is.

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow
```

All four must pass before committing; CI runs the same `npm run check`, verbatim, across
four legs — the same one command every one of them has to survive. Three are **Ubuntu**,
one per `engines.node` range this package declares (`^22.22.2 || ^24.15.0 || >=26.0.0`):
a declared range nobody actually executes on is the same defect `engines.node` itself
exists to catch, moved to a different file, so 22/24/26 all ride CI. The fourth is
**Windows**, at the floor only — a full OS × Node cross product would be six jobs for what
this earns, so the newer ranges ride the faster Ubuntu leg rather than tripling the slow
Windows one, while Windows still runs the version every platform must support. Paths and
line endings are the only things that differ between the two PLATFORMS, and both have
already produced a defect the project this harness came from could not see on one alone.

**That gate is ~200 seconds, and the number is a fact about the LOOP rather than about the
gate.** Measured on a quiet four-core box: `vue-tsc` 14.0s + `vite build` 1.6s, `oxlint`
1.0s + `eslint .` 23.8s, `test:coverage` 159.7s, `fallow` ~2s. **The suite is 79% of it**,
and the suite's own accounting says the cost is not the tests — `transform 13.7s, import
74.3s, tests 143.9s, environment 82.1s` over 362 files, so per-file overhead (a jsdom
environment and a module registry, both paid once per FILE) exceeds the test bodies. **Every
number in this paragraph is a DATED SNAPSHOT of one machine and one tree, the file count
included** — `find tests -name "*.test.ts" | wc -l` prints **461** on 2026-09-05, **450** the day
before, and 362 in the run the timings above come from, so the file count is three measurements
behind and the
per-file conclusion is what survives it, since that conclusion is a RATIO rather than a total.
The 2026-09-04 run of that suite at 429 files reports `transform 22.43s, import 125.34s,
tests 365.21s, environment 149.02s` in 260s wall clock — import and environment together still
exceed the test bodies, which is the ratio holding across a 19% growth in files.
**A merge is where a file count moves furthest and where nobody re-takes it**, and this
paragraph is its own worked example twice over: one branch of this merge read 429 and the other
418, on the same day, against trees that differed by a merge neither had taken — and the answer
here was 450, and one review round later it is 461. Re-measure before reasoning from any of
them. ONE
door exists beside `check` for that reason, and it does not replace it:

- **`npm run check:fast [paths]`** — `oxlint`, `vue-tsc -noEmit` and `vitest run`, no
  coverage and no `eslint .`. Arguments after `--` reach the vitest call, so
  `npm run check:fast -- tests/application` is **12.3s** against the gate's 200. That is
  the inner loop: run it between edits, and `npm run check` once before the commit. It is
  NOT a smaller definition of done — it omits `eslint .`, which is where the layer bans,
  the write boundary and both text bans live, and it omits the coverage floors entirely.

**Two gates at once do not cost 2x, they thrash — and the remedy is the WORKFLOW above
rather than a mutex.** What contention produces is a WRONG red rather than a slow one: a
destroyed `coverage/.tmp/coverage-N.json`, and `tests/build/` ESLint boots over their
`beforeAll` budget, both named as hazards elsewhere in this file. So agents working in
parallel run `check:fast` — which touches no `coverage/` and boots ESLint for one file at
most — and the full `npm run check` runs ONCE, before a commit, by whoever is committing.
One gate at a time falls out of that rule; nothing has to enforce it.

**A machine-wide lock was built for this and then deleted, which is worth recording because
the deletion is the finding.** `scripts/gate-lock.mjs` reached 475 lines and its suite 590 —
91% of that increment's whole diff — through eight review rounds: an unlink race, validation
over a free path, a put-back clobbering a fresh empty claim, `spawnSync` blocking every
signal, handlers armed after the claim, `child.kill` reaching only `npm`, and a group signal
that did not wait for descendants. Every one was real. **It bought zero seconds**, and two
races remained that the shape could not close: `rename` can only atomically replace an EMPTY
directory, and an empty directory is exactly what another process's claim looks like between
its `mkdirSync` and its `writeFileSync` — atomicity needs them indistinguishable, safety
needs them told apart. Reach for the workflow rule before the mutex; if one is ever wanted
again, the argument to beat is a kernel-released primitive (a held socket, released by the OS
on any death including SIGKILL), not a directory protocol.

Two things make the gate itself cheaper, and both are measured rather than argued.
`tsconfig.json` is `incremental` with its build info under `node_modules/.cache/` — 14.3s
cold against **3.8s warm**, including after touching a source file, so CI (always cold) is
unchanged and the loop is not. And `vitest.config.ts` runs `tests/build/` as its own
project with `isolate: false`, which shares the eleven type-aware ESLint boots that
directory pays per file: **34.6s to 20.8s** for that directory, 102.9s against 121.8s for
the suite as a whole.

**What was measured and REFUSED is worth as much as what was taken.** `--no-isolate` over
the whole suite runs it in half the time (121.8s to 61.3s) and is not a flag anybody may
flip: three runs produced three DISJOINT failure sets — four files, a different three under
coverage, a different three again with the first four excluded — so which files break is a
function of worker scheduling and quarantining the observed ones is whack-a-mole. Four
families of module-level state cause it: Konva's `stages` registry, a `npm_package_version`
mutation, `@napi-rs/canvas`'s install against a reused jsdom global, and the harness
`import.meta.glob` registry. Closing those is an increment with its own argument — and note
that the cases it breaks (`stacks nothing across repeated open and close cycles`) are the
ones whose SUBJECT is isolation, so they need re-siting rather than deleting.

What each step refuses, because a step whose purpose is vague gets skipped:

- **build** — `tsc` first, then Vite. Also the stylesheet: the build fails on a partial no
  entry file imports, a line in `styles/index.css` the assembler cannot resolve, a partial
  over the 400-line cap, or a hard-coded colour — SDD §84 asks for an Obsidian CSS variable
  instead, so a themed vault stays themed. That check runs on `lightningcss`'s own parsed
  tree (already a devDependency, already used to minify this sheet), not on source text, so
  it sees every literal colour a declaration's VALUE resolves to, at any nesting depth,
  regardless of what a selector, an at-rule prelude, a comment or a quoted string contains —
  hex, `rgb`/`hsl`/`hwb`/`lab`/`lch`/`oklab`/`oklch`/`color()`, and (because the parser
  resolves a CSS NAMED colour to the identical node a hex literal produces) a bare word like
  `red`, on any property lightningcss's grammar fully parses. `device-cmyk()` is the one
  colour function the parser does not fold into that shape, so it is refused by name
  instead — the one function-specific case, not the general rule. What the check still
  cannot see: a bare colour WORD inside a raw token stream the parser leaves unresolved —
  a custom property's own value (`--accent: red;`) or an unresolved function's fallback —
  where a hex or `rgb()`-shaped literal is still caught generically but a bare word is just
  an identifier. `scripts/styles-assemble.mjs` carries the full account.
- **lint** — TWO linters in one step, because they refuse different things and neither
  subsumes the other. **ESLint** is where the architecture lives: the layer rule below is
  `no-restricted-imports`, and `no-restricted-syntax` carries the write boundary,
  `I18N_LITERAL_BAN` (`eslint.config.mjs` — `docs/requirements/Multilanguage.md`'s rule)
  and `NOTICE_TEXT_BAN` — not prose. `I18N_LITERAL_BAN` is narrower than "every
  user-visible string": it refuses a
  literal at exactly SIX call sites — `.setText(...)`, the `text:` option of
  `.createEl(...)`/`.createDiv(...)`/`.createSpan(...)`, `addCommand`'s `name` and
  `addRibbonIcon`'s title — and passes a call to `t`/`tr`
  untouched, since that is a `CallExpression`, not a `Literal`, at the position it checks.
  The last two arrived with design slice 21's improvement pass, and what made them cheap is
  what the widening MEASURED rather than assumed: `docs/tasks/21` had declined to close that
  gap because widening "touches every existing call site's evidence", and it touches none —
  every one of them already passes `tr(...)`. `tests/build/i18n-literal-boundary.test.ts` is
  that rule's first instrument in fifteen slices, and it is a whole selector's blind spots
  read back for the first time: `id` stays a literal because a command id is DATA a hotkey
  binds to, and the ribbon selector keys on the ARGUMENT POSITION because the icon beside the
  title is a literal too — widen it to "a literal anywhere in the call" and two allow-cases go
  red, measured.
  **`NOTICE_TEXT_BAN` is the notice door, and it is a SECOND rule rather than a widening of
  that one**: it refuses a `.message`/`.stack` read anywhere inside a `notify(...)`,
  `notifySuccess(...)`, `notifyWarning(...)` or `new Notice(...)` call, and a bare string
  literal as a direct argument to any of them — slice
  11's Definition of Done item 3 ("never a raw exception message, stack trace or internal
  file path; produced by `t()` rather than by a literal or by `AppError.message`") put at
  the forbidden call, because that door was the one user-facing surface no gate could see.
  It cannot see a value one hop away (`const text = e.message; notify(text)`), a template
  literal carrying raw English with no member access in it, a notice raised under a third
  name, or any door reached through a MEMBER EXPRESSION (`o.notify(e.message)`,
  `new n.Notice(e.message)`) — every selector keys on `callee.name`, which a member-expression
  callee has none of, and that is exactly why the four doors are bare functions rather than
  `notify.success(...)`; `tests/build/notice-text-boundary.test.ts` drives all of that through real fixture
  paths, blind spots included, and drives BOTH blocks that carry the rule — dropping the
  repeat in the `infrastructure/obsidian/` block turns exactly two of its cases red,
  measured.
  `I18N_LITERAL_BAN` reaches `addCommand({ name: '…' })` and
  `addRibbonIcon(icon, 'title', …)` since slice 21's improvement pass, and still does not
  reach a `title` or `attr:` value, `el.textContent = '…'`, a TEMPLATE literal, a
  registration reached as a bare function, or a literal held in a variable first — so the UI
  text that is left (settings `name`/`desc`, `getDisplayText`) is compliant by convention
  rather than by this gate, the same way the write
  boundary below names the spellings its selectors see and the ones they cannot, rather
  than claiming to see more. Every one of those blind spots is asserted AS a blind spot in
  `tests/build/i18n-literal-boundary.test.ts`, because a rule that had narrowed further
  would read exactly the same. It also runs the Obsidian plugin guidelines
  and the size and complexity budgets. Warnings fail too (`--max-warnings 0`) — the
  mobile-safety rule reports as a warning, and `isDesktopOnly: false` is a promise.
  `manifest.json` itself is linted
  (`obsidianmd/validate-manifest`), so the marketplace naming rules are a gate, not a
  submission surprise. The ruleset is also kept ON inside the `no-console` carve-out for
  `src/infrastructure/logging/**`, which is what still fails `console.log`/`console.info`
  in the one directory `no-console` is off for. Switching it off there was available and is
  refused for a reason worth stating, because the obvious one is wrong: not that the
  ruleset forbids disabling its own rules, but that **the marketplace review bot lints
  with its own configuration**, so a local override would not travel and the rejection
  would arrive at submission rather than at `npm run check`. That guarantee rests on a
  wrapper (`rule-custom-message`) matching ESLint's own message text verbatim and
  reporting NOTHING on a miss, so `tests/build/logging-carve-out.test.ts` pins the two
  against each other — a reworded upstream message would otherwise turn the marketplace
  check off silently. **oxlint** runs first, in milliseconds, and adds the broad
  wrong-code ruleset ESLint never turned on, over a WIDER tree: the Obsidian ruleset is
  type-aware, so `eslint.config.mjs` stops it at `src/` and ignores `scripts/` and the
  root configs outright — which left `tests/` on 24 rules and the build scripts on none.
  Warnings fail here too (`--deny-warnings`), for the same reason. It is an ADDITION and
  not a migration: oxlint has no `no-restricted-syntax` at all (a config naming that rule
  is rejected outright, measured), no port of `eslint-plugin-obsidianmd`, and nothing
  type-aware. It does have `no-restricted-imports` and the budgets, so the layer bans are
  the one part that could move, and they stay where the rest of the architecture is.
  `.oxlintrc.json` carries which categories are on and what the other four cost, plus 29
  rules named one at a time out of the categories left off — a category is a bundle whose
  worst member decides whether the bundle is usable, and those four each hide a few rules
  about being WRONG behind a majority about being written differently. It also gives
  `scripts/` and the root configs the size and complexity budgets they had none of — the
  numbers `src/` already lives under, reaching the rest of the repository. **A rule is
  adopted while it reports nothing**: 27 of the 29 did, which is what made them one line
  each instead of a cleanup nobody schedules.
  It also mirrors ESLint's **`no-console`** and its `infrastructure/logging/**` carve-out,
  which is the one policy rule ESLint owned alone with nothing to notice its removal —
  and the mirror is what puts it in the EDIT LOOP, since `scripts/lint-edited.mjs` runs
  oxlint for every file it lints and ESLint for `.vue` alone. Scoped to `src/**` by measurement rather than taste: at the root
  it reports nine findings across `scripts/`, where a build script printing to the console
  is correct. The mirror is not total, and the sentence has to say so — inside the carve-out
  ESLint still fails `console.log`/`console.info` through the obsidianmd wrapper, oxlint has
  no port of that ruleset, so exactly that case is invisible to the edit loop and is caught
  by `npm run check` and `tests/build/logging-carve-out.test.ts`.
  Two things about it are claims rather than rules, so both have checks. Its SCOPE: an
  `ignorePatterns` edit that drops a directory makes the gate quieter rather than redder,
  so `tests/build/lint-scope.test.ts` asks oxlint itself which files it lints and compares
  that against the tree. And its REACH: **no comment in a linted file turns a rule off.**
  Two halves, because the two linters read comments differently. ESLint takes
  `linterOptions.noInlineConfig`, which refuses the whole class — the disable directives
  AND the rule-CONFIGURATION form, a block comment reading `eslint some-rule: off`, which
  carries no directive keyword. That form was the real exposure: `no-restricted-syntax`
  and `no-restricted-imports` are ESLint-only, so one comment turned the write boundary
  off and oxlint could not have backstopped it. oxlint's half is a scan of the files it
  lints (`tests/build/suppressions.test.ts`) plus `reportUnusedDisableDirectives`, since
  nothing in ESLint's configuration reaches oxlint's directive handling. A rule that does
  not fit is turned off in `.oxlintrc.json`, where the reason is written down and review
  sees it.
- **test:coverage** — the suite plus the coverage floors. `src/` measured 100% of all four
  metrics through slice 2 and no longer does: slice 4 brought the first arms no test can
  reach — defensive double-fault logging, an Obsidian-runtime view callback. Floors of
  99/99/99/98 (statements/functions/lines/branches), against 99.22/99.10/99.46/98.05
  measured at design slice 19's close. **Read branches and FUNCTIONS again: the headroom is
  ONE covered unit on each — 2780 branches covered where 2779 is the floor, and 1432
  functions where 1431 is — which is the tightest either metric has ever been here.** Count
  in UNITS rather than in percentage points, because a unit is what an untested arm actually
  costs: one branch is 0.035pp and one function 0.069pp, both below the hundredth the summary
  line prints, so a figure that did not visibly move is not evidence that nothing moved. **A
  passing gate is not a review either** — slice 16's review pass left an arm uncovered while
  branches read 98.12 against a floor of 98, and the three units of headroom it had then
  swallowed it silently; it was found by reading `coverage-final.json` for the CHANGED FILES,
  which is the instrument that can see one arm. At today's margin an untested arm in a tight
  metric fails the gate outright and one in a slack metric hides completely, so plan the test
  with the code rather than after it — and **an UNREACHABLE guard is not free**: the first
  draft of slice 13's live-region fix carried a `regions?.[…]` null arm no test could drive,
  and removing it by handing the regions to the host as an argument is what put that figure
  back. Do not read a figure from this line as current; run `npm run test:coverage`. The exact
  numbers, which increment moved them, and what every remaining uncovered arm IS live in
  `vitest.config.ts`, which also carries the ratchet policy: floors only rise, and they
  rise to what a FINISHED increment measures — so an increment whose rounded-down figures
  equal the floors already in force ratchets NOTHING, which is what slices 5, 11, 13, 15, 16,
  18 and 19 did.
  The suite
  includes `tests/harness/accessibility.test.ts` and, since two branches each appended cases
  to it and the sum crossed the 450-line cap, `tests/harness/accessibilityAssetLibrary.test.ts`
  beside it — one seam, drawn where the file already had three top-level `describe`s, with
  `runOptions` shared through `./axeOptions` rather than copied, because the alternative to
  sharing it is two copies of the list naming the rules this suite cannot honestly grade. Both
  are axe-core driven in jsdom against the
  real mounted surfaces (`mountHarness`, the real Plan Editor, and the harness index in
  three states — never a fixture), checking
  roles, accessible names, form labels, heading order and ARIA attribute validity. It
  earns its place rather than merely running: pointed at the Plan Editor — the first
  surface here that draws anything — it immediately found three `aria-label`s on role-less
  `<div>`s, which is a real violation and one no other gate can see. The index is the only
  page here built out of interactive controls rather than a canvas, which is why it is
  scanned open, empty and failed rather than once: those three draw different markup, and
  the failure card is the tree's one live region. Read its header before trusting
  the word "accessibility" any wider than that: it does NOT verify colour contrast, a
  visible focus indicator or hit-target size (jsdom has no rendering engine to measure any
  of the three), nor page-wide structural rules like duplicate ids or landmark uniqueness —
  and those two are not the same mechanism: `duplicate-id` is deprecated and disabled by
  default in this axe-core version, so it is invisible here independent of scope — it
  fires correctly at BOTH `contentEl` and whole-document scope once force-enabled, so
  scoping is not why it is missed today. The landmark rules (`region`, `document-title`,
  `html-has-lang`, …) are the ones actually scope-dependent, needing whole-page context
  this file cannot give them because it scans `contentEl`, the plugin's own subtree, not
  the whole document. **That same scope is why no notice is graded here**: an Obsidian
  `Notice` renders on `document.body` under `.notice-container` and slice 13's two live
  regions are appended to `document.body` itself, so that pair of `role`/`aria-live` values
  and the dismiss control's accessible name — the most new ARIA any one slice has added — sit
  outside every scan this file performs. A live vault
  (`npm run test-build`) remains the only place appearance is verified.
- **analyze** — fallow: dead files and exports, duplication, complexity against coverage,
  and dependency hygiene.

**There are TWO repository stacks and ONE thing they are.** `createRepositoryStack`
(in-memory, `tests/helpers/vault.ts`) and `openFixtureVault` (disk-backed,
`tests/helpers/fixtureVault.ts`) differ in three host fakes and nothing else — which
`FixtureStack`'s docblock had asserted for years while two copies made the claim rather than
one definition, and `npm run analyze` reported the pair as the repository's largest clone
family (four groups, 98 lines). `tests/helpers/repositoryStack.ts`'s `stackFoundation` is the
definition: the logger recorder, the index, the echo window, the migration runner, the
ledger, the `NoteVaultDeps` bundle, the geometry store and `rebuildIndex`. Three smaller
shared behaviours sit in `vault.ts` beside `parseFrontmatter`, which `fixtureVault.ts`
already imports from — `describeFile`, `applyFrontmatterEdit` and `fileCacheAnswer`, the last
being the THREE-answer rule (`null` for no entry, `{}` for parsed-with-no-frontmatter, the
frontmatter otherwise) that both fakes carried a paragraph about and that `frontmatterOf`
must not conflate.

**The five repositories are deliberately NOT in that foundation, and the reason is a fallow
constraint worth knowing before the next extraction.** Fallow resolves a class's members
through the annotation where the consuming expression sits, and it does NOT follow a field
through an `extends` into another module — so constructing them in the shared function took
`npm run analyze` from clean to eleven `unused-class-members` findings, every one a
repository method whose only call sites are tests. Measured in three steps: redeclaring the
fields on both stack interfaces recovered three and left eight, and only the `new` expression
living in each stack file recovered all eleven. This is the Gotchas section's "fallow
resolves an interface's members through an explicit type annotation" met from a new
direction, and it costs five constructor calls per file — with the drift that mattered gone
anyway, since `deps` and `store` are built in one place so the arguments cannot differ.

**`tests/**` is type-checked by the `build` step, like `src/`** — `tsconfig.json`'s `include`
is `src/**` plus `tests/**`, and there is no second program and no fifth gate. That was not
free and the cost is worth knowing: `vue-tsc` goes from about 8 seconds to about 16, on each
of the four CI legs.

It arrived through a RATCHET that no longer exists. Turning the compiler on reported 562
errors across 114 of 307 files, so the debt was held as a baseline of files permitted to
fail, cleared over five increments, and the script and its baseline deleted when the list
emptied. What that bought is in the Testing section below; what it cost is the eight seconds.

**One thing the ratchet proved before it was retired, and the reason this now sits inside
`check` rather than beside it:** while it was a separate command nobody ran, four files
silently stopped type-checking between two merges — a deps type that grew a member, a
function that grew a parameter, two new test files. A gate outside `npm run check` is a gate
that reports only when somebody remembers to ask it.

`npm audit` is deliberately NOT in `check`: an advisory with no patched version is a red
nobody can clear, and a gate people learn to ignore protects nothing. It is its own CI job.

Obsidian itself cannot run here. Three commands stand in, and none replaces another:

- `npm run harness` — a Vite dev server drawing the real view against the real stylesheet
  and **Obsidian's own app.css**, in a browser, with no Obsidian. `?view=plan-editor` draws
  the Plan Editor instead of the project surface, `?theme=light`, `?phone`, `?index` and
  `?entry=<id>` are the other knobs, and all of them exist so a headless capture needs a URL
  and nothing to click. Faithful about markup,
  spacing, hierarchy and Obsidian's DEFAULT colours — including the leaf chrome Obsidian
  nests around every view (`.workspace-leaf-content[data-type]` → `.view-header` +
  `.view-content`), which the fake `ItemView` in `tests/helpers/obsidian-mock.ts` nests the
  same way, checked against the real selector `styles/chrome.css` declares by
  `tests/harness/harness.test.ts` rather than assumed. Not faithful about a themed vault's
  colours, its accent, or any element default the vendored sheet's reduction dropped — it
  was reduced against another plugin's driven states. Say so honestly rather than letting
  "faithful" read wider than it is. **The sharpest instance of that reduction: it declares no
  `.notice` and no `.notice-container` rule at all** — that plugin never raised one, and all
  that survives is a `--layer-notice` variable used on an unrelated selector, measured rather
  than assumed. So a notice here would have no position, no stacking and no chrome: this tool
  cannot show what one LOOKS like, which puts slice 13's whole toast surface outside it and
  outside every gate. `docs/tests/cases/Notices and save state.md` is the only instrument
  for it.

  **`?index`** draws an index of every prototype and every real component, discovered from the
  tree with `import.meta.glob` so a saved file needs no registration. `?entry=<id>` opens one
  directly, and `npm run harness-shot <id>` captures it in both schemes. The index is OPT-IN
  and the bare root still draws the project view: the three project-view captures address that
  surface with no `view` parameter at all — two of the three carry a query string
  (`?theme=light`, `?phone`), just never a `view` one — so making a bare root mean "index" would
  break them while the test asserting they exist kept passing. The index has two fixed captures
  of its OWN (`?index` in both schemes), which is a different thing from the bare root meaning
  index and is what lets this tool photograph its own chrome. Mocks live in `src/prototypes/` as
  SFCs — a `<template>`, optionally a `<script setup>`, optionally a `<style scoped>` — written to the
  same Vue lint rules as the rest of `src/` so that promotion is moving the file rather than
  redrawing the markup. A template-only mock composes real components and sibling mocks through
  the index's global registry, having no script block to put an import in; a scripted one may
  import them directly, which is what a shipped component does. A `<style scoped>` block does not ship
  and does not travel — promotion lifts it into a `styles/` partial, since SDD §84's colour
  check runs over the assembled sheet and never sees inside an SFC. `scoped` is required rather
  than preferred: Vite never removes an injected block, so an unscoped one would still be
  styling the index after the designer opened something else.
  `src/prototypes/README.md` carries the one rule that IS relaxed there and why. **No prototype or fixture MODULE ever composes a built chunk**, refused
  twice: a per-layer `no-restricted-imports` ban makes it a one-way door, and
  `tests/build/prototypes-not-bundled.test.ts` runs a real `vite build` in memory (`write:
  false`, so nothing is ever written to `dist/`) and asks Rolldown which modules composed
  each chunk. Neither is sufficient — lint reads static imports, the bundle scan reports
  after the fact — and the bundle scan is narrower than the wider claim it serves: a
  prototype or fixture shipped as a separate emitted ASSET, with no module id in the chunk
  list, is outside what `chunk.modules` can see, and not cheaply checkable.
- `npm run harness-shot` drives that same page headlessly (`playwright-core`, a Chromium
  binary resolved from disk rather than a hard-coded revision) and writes a PNG per colour
  scheme plus `?phone`, both Plan Editor schemes and both harness-index schemes to a gitignored
  `harness-shots/`
  folder — a look at rendered layout, which jsdom cannot produce at all. Given an entry id
  (`npm run harness-shot prototype:ZonePanel` — the qualified id from `entries.ts`, not the
  basename the index displays) it captures that one prototype or component from the index
  instead of the ten fixed shots, in both colour schemes, with the index's own sidebar
  dropped so the picture measures the screen. `-- --width=460` captures a narrow pane as
  well, which is the width an Obsidian sidebar leaf actually has and the one that has already
  hidden a layout defect the default 1280 could not show. The `--` is load-bearing: npm claims
  a bare `--width` as its own config, and the command refuses that spelling rather than
  capturing at the wrong width and exiting 0.
  It draws and asserts nothing itself and there is no baseline to diff against, so like
  `npm run harness` it is deliberately outside `npm run check` and outside CI.

  **The browser is the pinned one or one you NAME, never one found lying around.**
  `scripts/chromium.mjs` asks `playwright-core` where the revision this repository pins
  would be and refuses to hunt a different build on disk when it is absent — a capture taken
  with an unannounced substitute is a picture somebody then reasons about as if it were the
  pinned browser's, which is a quieter problem than not capturing. The remedy it names,
  `npx playwright install chromium`, is a developer's laptop's remedy and is exactly what a
  container with its browsers baked in cannot do — so an error naming only that remedy is
  how a capture check goes un-run and gets disclosed as outstanding, which is what happened
  on the canvas-navigation branch. `RP_CHROMIUM_EXECUTABLE=/path/to/chrome` is the one door
  out, and it differs from hunting in both halves: a person names the build, and the capture
  prints that it is not the pinned one, so the caveat travels with the picture. What no gate
  can check is whether the substitute renders like the pinned build; read those captures as
  approximate. Both doors ask `isFile` and not `existsSync`, which answers `true` for a
  DIRECTORY — Playwright accepts one as an `executablePath` and fails at a launch several
  steps later, blaming the browser rather than the thing that named it, which is the late
  failure this module exists to convert into an early one. The EXECUTABLE bit is deliberately
  not asked with it: Windows has no such bit and `accessSync(path, X_OK)` succeeds there for
  any file, so the check would hold on one CI platform and be theatre on the other.
  `tests/build/chromium.test.ts` drives all of it, half in ONE CHILD PROCESS
  because `chromium.executablePath()` reads `PLAYWRIGHT_BROWSERS_PATH` at IMPORT and not at
  call — its own first draft set that variable in `beforeEach`, was answered from the real
  cache throughout, and planted an empty file called `chrome` in this machine's provisioned
  Playwright directory, which every later case then read as an installed pinned build.
  **ONE child, not one per case, and that is a CI lesson rather than tidiness**: a spawn that
  imports playwright-core costs about 650ms, and six of them cost 3.76s of a two-core runner
  in synchronous bursts — beside test files whose waits are bounded in TICKS rather than
  seconds. `settleUntil`'s own docblock already records a fixed-tick wait failing next to a
  PDF rasterizing two million pixels; this file reproduced that shape, timing out
  `accessibility.test.ts`'s cold Vite transform on one CI leg while the other three passed.
  Nothing needed a process each: the import happens once and the FILESYSTEM and ENVIRONMENT
  are read at CALL time, so one child walks every state and the `it`s read the results back.
  **A test file's CPU cost is part of its correctness when anything in the suite waits in
  ticks**, and a green local run on a four-core machine cannot see it.

  **`settleUntil`'s own bound was that same mistake one level up, and it took a red CI leg to
  see it.** The helper exists because a fixed `settle()` is a fixed tick count; its remedy was
  a loop bounded at 50 ROUNDS, and a round is four microtasks and one `setTimeout(0)` that Node
  clamps to about a millisecond — so the budget was about fifty milliseconds of wall clock on
  every machine, while the work it waits on is a cold Vite transform whose duration is entirely
  the machine's business. Measured rather than reasoned: `openIndex('entry=prototype:ZonePanel')`
  settles in four to six rounds locally, which READS as a tenfold margin and is five
  milliseconds against fifty. `verify (ubuntu-latest, 26)` spent all fifty and failed, while
  the three prototypes scanned before it passed — a per-MODULE cost, so no ordering makes one
  of them "the cold one". It is a DEADLINE now (4s, under vitest's 5000ms default so a real
  regression still fails as this helper's named error rather than as an anonymous test
  timeout).
  **Pre-warming the entry module was tried first and is the more useful half of the finding**:
  `HarnessEntry.component` is a real loader, so awaiting it does move that transform out of the
  polled window — and with the budget starved to one round `ZonePanel` still failed, because it
  is a template-only mock composing a real `<StatusBar />` that the index registers through
  `defineAsyncComponent`, which resolves lazily INSIDE the window. **A list of things to warm
  goes stale as mocks compose more of them; a deadline needs no list.** `settleUntil.test.ts`
  pins boundedness with a STUBBED `Date.now` rather than by waiting the budget out — four
  seconds on every CI leg to prove one `throw` is a bad trade — and says so, since what it
  cannot measure is whether the VALUE is right for a contended runner.

  **It has now caught ten defects the whole of `npm run check` could not**, which is the
  argument for running it on anything that draws: the view collapsing to a sliver of its
  pane (slice 1); and in slice 5, a layers panel sized with `--size-4-18` — 72 pixels,
  clipping every label to "Backg" — a zone caption offset multiplied by the scale twice
  over, putting three of four names off the top of the pane, and every zone type drawn in
  the same grey because the harness page applied its theme class AFTER mounting, so the
  editor resolved its palette when no `--color-*` existed. Every one passed the suite:
  jsdom lays nothing out, and the tests set the theme variables themselves.

  The fifth is the harness index's own entry list, where every row read `ZonePanelprototype`:
  Vue's default `whitespace: 'condense'` removes whitespace between two elements when it
  contains a newline, so an `<a>` and a `<span>` on adjacent template lines render with nothing
  between them. It was found by CAPTURING a PNG and looking at it, on the first thing a designer
  sees, after forty-four review rounds over that file.

  **What that fifth one says about the instrument, and it is the reason to keep running it:** the
  suite is not blind to the missing separator — jsdom's `textContent` reads `ZonePanelprototype`
  perfectly well. It is blind to SPACING, so it cannot see the defect once the remedy is CSS, and
  it could not have told anyone the rendered page looked wrong in the first place. Anything whose
  symptom is a measurement no layout engine performs — spacing, wrapping, overflow, contrast, hit
  size — is outside every gate this repository has, and a capture read by eye is the only
  instrument here that reaches it.

  **Six to ten came from the first design review of the harness index itself**, and they are the
  paragraph above proved rather than restated — every one is a measurement no layout engine in
  this repository performs, and `npm run check` was green on all five at once. The entry links
  had NO visible focus indicator: the vendored app.css carries `:focus { outline: none }` and
  `a { outline: none }`, and its reduction kept no `a:focus-visible` to put one back, so the
  page's only navigation was invisible to a keyboard — WCAG 2.2 2.4.7 at AA, which `PRODUCT.md`
  binds by name. The rows were 19.5px tall against 2.5.8's 24px minimum. The kind label was
  dimmed with `opacity: 0.6`, which composites to **4.29:1** on the light scheme's background
  and passes in dark — a contrast value no source file contains, which is the general lesson
  about dimming text with opacity. `.rp-harness-failure` — the tree's one live region — was
  applied in the template and declared in NO stylesheet, so a failed entry and an unpicked one
  drew the same picture. And the fix for the first four introduced the fifth: `.rp-harness-index
  h2` is a descendant selector, the stage lives inside that element, and the picker's uppercase
  type was drawn over every entry's own headings until a capture showed `WorkPackages.vue`'s
  title reading "WORK PACKAGES". `tests/harness/indexChrome.test.ts` refuses a selector that
  reaches the mounted entry now, from any of the three roots that lead there — the picker, the
  stage and the leaf — rather than only the one that shipped.

  **Which capture watches which of the other four**, because the resting pair cannot watch all
  of them and saying it could is how a state stops being looked at: `index-dark`/`index-light`
  hold the row height and the kind label's contrast, both of which are on screen at rest.
  A focus ring is not — nothing is focused in a headless page until something presses Tab — so
  that one is `index-focus`, which is why that shot takes a `focus` selector and why
  `focusForShot` presses Tab rather than calling `page.focus()`, which does not satisfy
  `:focus-visible`. The failure card is not on screen either, since no entry has failed: it is
  `index-failure`, which asks for an entry id that does not exist.
- `npm run test-build` — builds into `.obsidian/plugins/<id>/` in this repository, which IS
  a vault. Naming this is a shorter ask than "please set up a vault", and it is the only
  way appearance and any assumed API get verified.

  **What to run in it is written down**: `docs/tests/suites/Smoke Test the Editor.md` and
  the cases under it. That suite is not a nicety — the first walkthrough of design slice 5
  found FOUR defects in a row that all four gates passed, three of them a test fake
  accepting what Obsidian refuses. Its header tabulates them, which is the fastest way to
  know what to suspect when a manual case fails and the suite disagrees. The fixtures the
  cases need live in `docs/tests/fixtures/`; the PNG is generated by
  `npm run background-fixture` so that what it asserts is reviewable as code rather than
  buried in a binary.

  **The suite reads those fixtures from `tests/fixtures/`, never from `docs/`.** `docs/` is
  the vault — user land — and a test that depended on a path someone reorganises while
  writing notes would make a documentation tidy-up a build failure. The generator writes the
  PNG to both, so the copies cannot drift; the PDF has no generator and is tracked twice.

## Architecture

The SDD's layers (§8), and each may reach anything below it and nothing above:

```
presentation → application → domain → core
infrastructure → application (its ports) → domain → core
plugin/ composes all of them, and is the only layer that may
```

`eslint.config.mjs` enforces that with per-directory `no-restricted-imports`, so a violation
fails `npm run lint` rather than waiting for review. It also bans **`vue`, `pinia`, `konva`
and `obsidian` by name** in `core/`, `domain/` and `application/` — the SDD's §3.4, and the
architecture test its §76 asks for. `infrastructure/` may name `obsidian`; that is its job.

Two rules that follow from it and are worth stating because breaking them is cheap:

- **A type belongs with the code that PRODUCES it, not the code that consumes it.** A type
  placed with its consumer makes the pure layer depend on the effectful one.
- **Nothing writes to the vault outside `infrastructure/`.** The layer bans already keep
  `obsidian` out of the inner layers, so `no-restricted-syntax` rules on the write calls
  (`WRITE_BOUNDARY` in `eslint.config.mjs`) catch the case they cannot see: a write from a
  view, a Bases adapter or the composition root, bypassing the repository that owns the
  file format. The config names the spellings those selectors see and the ones they cannot.
- **One action, every input.** A ribbon click, a command and whatever a toolbar adds later
  call ONE function — `revealView` is the first of them. Adding an input means calling that
  function, never re-deciding beside it; a second entry point with its own activation looks
  correct alone and opens a duplicate tab the moment a user uses both. `infrastructure/`
  takes the view type as a STRING for the same reason it takes anything: it may not reach
  `presentation/`, and the composition root is what knows which view it is wiring.

  **One function is not enough on its own, because a leaf takes TIME to exist.** Both
  leaf-creating doors — there are exactly two in `src/`, `openNote.ts` and `reveal.ts`,
  counted by grepping `getLeaf('tab')` — that grep prints three lines today, one historical
  comment and the two calls — look a leaf up and create one when the lookup finds nothing, and a
  leaf they create does not answer that lookup until its own `await` resolves. So two
  activations in one tick both find nothing and both create: a double click on the ribbon gave
  two tabs of the SINGLETON view, two opens of one plan gave two Plan Editors, and a double
  click on a project row gave two note tabs. Each door now holds a map of what is in flight,
  asked BEFORE the lookup and released in a `finally`, keyed by what makes two calls the same
  request — the file path at `openProjectNote`, the view type plus the state that would be set
  at `revealCandidate`, since `setViewState({ type, active, state })` is the whole of what
  makes the leaf. Keying on the type ALONE collapses the multiplicity `revealPlanEditor`
  exists to permit, which is measured as a mutation rather than argued.

  **Every one of those doors is also DETACHED** — Obsidian's ribbon, command and modal
  handlers all return nothing — so a fault in one has no awaiter. Four spelled that as a bare
  `void`, two under a comment calling the missing rejection handler deliberate; a ribbon click
  that faulted opened nothing, said nothing and recorded nothing. `src/plugin/runDetached.ts`
  is the one step that maps, logs and notifies (SDD §66), and it is a FUNCTION rather than a
  habit because a fifth door would have to remember a `.catch` nothing checks.
- **Registering with Obsidian belongs to `src/plugin/`, and that is a check rather than a
  sentence.** `RenovationPlannerPlugin`'s header claimed to be "the ONLY place anything is
  registered with Obsidian" and a comment fifty lines below repeated it; both were false when
  written and stayed false for fifteen slices, since `planEditorCommands.ts` and
  `sampleProject.ts` each register commands through the `PluginCommandHost` seam. The layer
  bans cannot express the true claim — `obsidian` is importable in `infrastructure/` and a
  `Plugin` travels as `host` — so `tests/build/registration-locality.test.ts` reads `src/` for
  nine registration members and requires every hit under `src/plugin/`. It reads source TEXT,
  so a differently-named wrapper is invisible to it, and it carries a finds-something-at-all
  case: a typo'd member list would otherwise pass by reaching nothing.
- **A view type and a command id are DATA, not text.** Obsidian persists the first in the
  workspace layout and binds a user's hotkey to the second, so renaming either orphans
  something a user has. The display names beside them are text.
- **`src/prototypes/` is inside `src/` and outside the layering.** A mock may carry a script and
  a style block, composes real components and sibling mocks through the harness index's registry
  or — once it has a script — by importing them, and may be imported by NOTHING — a per-layer `no-restricted-imports` ban
  makes that a one-way door and `tests/build/prototypes-not-bundled.test.ts` asks the real
  build which modules composed each chunk. Its CSS has TWO homes and they differ in one thing,
  whether the rules ship: a `<style scoped>` block in the mock does not — nothing imports this
  tree — and does not travel at promotion either, while a `styles/` partial does both. `scoped`
  is required rather than preferred, because Vite never removes an injected block and an
  unscoped one would go on styling the index after the designer opened something else.
  `tests/build/prototype-styles.test.ts` refuses a class NEITHER home declares, and refuses an
  unscoped block. A real component is still drawn by the assembled sheet and by nothing else,
  which is what criterion 5 actually guarantees. `src/prototypes/README.md` carries the whole
  trade and the one lint rule that is relaxed there.

There is deliberately no list of modules here. `src/` is the list and it cannot go stale.

Build artifacts go to `dist/` and nothing is written to the repository root — `vite.config.ts`
says why, and it is a real constraint rather than taste. Everything `npm run` invokes lives in
`scripts/`, except the configuration files a tool finds by NAME at the root — the eslint,
vitest, Vite (build and harness), TypeScript, fallow, npm and editor configs — and every
script resolves its paths from the WORKING DIRECTORY rather than from its own location.

**Worktrees live in `.worktrees/`, inside the repository and gitignored.** They used to sit in a
sibling directory, which needed no ignore rule and was exactly the problem: a path outside the
repository is invisible to `git status`, so an abandoned worktree holding uncommitted work was
findable only by `git worktree list`, and four accumulated before anyone looked. A worktree is a
FULL COPY of `src/`, `tests/` and `styles/`, so moving them inside had to be measured rather
than assumed — `npm run check` was run with one in place. **`build` and `oxlint` ignored it and
`eslint .` did not**: flat config reads no `.gitignore` and no longer skips dot-directories, so
it walked in, found a second `tsconfig.json` beside the root's, and failed EVERY file with
"multiple candidate TSConfigRootDirs are present". `.worktrees/**` is in `eslint.config.mjs`'s
global `ignores` for that reason, which is the load-bearing claim that block's own comment
already made about itself. `fallow` counted the same 1193 files either way.

## The linter in the edit loop

`.claude/settings.json` runs `scripts/lint-edited.mjs` after every Edit and Write, which
lints THAT ONE FILE and hands the agent what the linters say. About 90ms for most files
(seconds for an SFC — see below), against `npm run check` several turns later — and by then the reasoning that produced the defect
is gone, which is the whole reason to move the cheap half earlier.

**oxlint for every file, and ESLint too when the file is a `.vue`.** oxlint has no port of
`eslint-plugin-vue` — no Vue rules at all — so for that one extension the fast linter is blind
to the entire ruleset governing the file, and an SFC came back clean from a hook that could not
read it. That is not hypothetical: the first author to write a mock here tripped
`vue/html-indent` and `vue/singleline-html-element-content-newline`, got a green hook, and met
`npm run check` several turns later — the exact gap this hook exists to close, in the one tree
whose authors are most likely to fall into it. The cost is measured and is why it is not
extended to `.ts`: oxlint answers for one SFC in about 110ms and ESLint in seconds, and on
`.ts` the two overlap enough that seconds per edit would buy little. **That second figure
tracks the size of `src/`, not the size of the file** — the Vue ruleset is type-aware, so
the project service loads the whole tree before it answers for one SFC. It was about 2.5s
when this hook was built and is 5.4s now; the two SFC cases in
`tests/build/lint-edited.test.ts` carry an explicit budget because growth alone pushed them
past vitest's 5000ms default, and that budget is the instrument for whether this hook is
still cheap enough to sit in the edit loop at all.

**The same cost has a second face, in the SUITE, and it looks like a regression when it is
not one.** Every `tests/build/` file that drives ESLint boots its own instance — vitest gives
each test file its own module registry — and each boot loads the whole type-aware project
service. Under vitest's DEFAULT file-parallelism on Windows those boots contend, and
`beforeAll(warmUpEslint)` can exceed even its deliberately large `ESLINT_BOOT_MS` (60s):
measured, six such files timed out in one run and every one of them passed on a
`--no-file-parallelism` re-run of the same tree. (An earlier draft of this sentence put a
file count on that re-run. No subtree of `tests/` has that many files, so the figure was
unverifiable and is gone rather than replaced by a second guess.) A parallelism artifact, not a broken gate
— so re-run serially before believing a `beforeAll` timeout in that directory, and count the
cost of the next ESLint-booting test file against it. **Serial is the diagnostic, not the
remedy, and the difference is measured rather than assumed**: the twelve files that boot an
instance run in about 30s under default parallelism and about 60s under
`--no-file-parallelism` on a two-core container, so making the serial run the default costs
exactly double. The contention is real and the obvious fix for it is worse than the problem;
a lever that helps would have to reduce the number of BOOTS, which cross-worker sharing
cannot do because each test file gets its own module registry.

**THAT LAST SENTENCE WAS RIGHT ABOUT THE REQUIREMENT AND WRONG ABOUT THERE BEING NO LEVER, AND
THE LEVER IS NOW TAKEN.** Sharing across workers cannot reduce the boots; REMOVING the workers
can. The `build` project runs at `maxWorkers: 1` since the Add Room merge, so its files go
through one worker against one module registry and pay one `new ESLint(...)` between them —
which is what `isolate: false` was already reaching for and could only ever achieve *within* a
worker. **Measured as a boot COUNT rather than as a duration**, because the duration cannot see
it: a probe appending `process.pid` beside that constructor printed **12 boots in 12 processes**
unconfined against **1** confined, and 12 → 2 over the whole run. A quiet 22-core machine passes
that directory either way, which is precisely why this had gone on reading as somebody else's
CPU.

**It cost ~49 seconds of every run and that was accepted deliberately as a trade — and the
trade has since been RETIRED, because the confinement was applied to the wrong set.** Vitest 4
refuses to overlap two projects whose `maxWorkers` differ, so each needs an explicit
`sequence.groupOrder` and the two stop running concurrently: **88.0s → 137.1s end to end, 459 of
459 files passing both ways** at the time. The first version of the config comment claimed it
cost nothing, reasoning that the build worker's ~29s would hide inside the suite project's
~120s — true of the scheduler that config does not get.

**What the sixth review round then measured is that the confinement was buying its property for
twelve files and charging twenty-nine.** On this machine (2026-09-05, quiet tree, no coverage)
the whole `build` project ran **174s** serially and its twelve ESLint-booting files are **34s**
of that, so four fifths of the serialised time was files that boot nothing and had run
parallel-safely for their whole lives. There are THREE projects now — `build-lint` (the booting
files, one worker, its own group) and `build` and `suite` sharing the parallel group — and the
whole suite runs **269s → 167s, 461 of 461 green**. Two things about that set are the durable
part rather than the numbers: it is **DERIVED** from a pattern over `tests/` rather than listed,
because which files boot ESLint is a fact about the import graph that a hand-written list gets
wrong silently; and the derivation **THROWS when it matches nothing**, because an instrument
that reaches nothing looks exactly like a clean tree and would drop every file back into the
parallel group with the timeouts returning unexplained. The review round's own section above
carries why the proposed twelve-file version of this turned the gate red.

**What the fix EXPOSED rather than caused**, since deterministic worker placement is a stronger
instrument than a lucky one: `tests/build/localeModuleSentenceCase.test.ts` called
`resolveConfig` under vitest's default 5s case budget with no `beforeAll(warmUpEslint)`, and had
been passing only when the scheduler happened to drop it in a worker some sibling had already
warmed. **A case whose pass depends on which sibling ran first is not a case anybody has
checked** — it is the fake-too-thin rule pointed at a test runner — and it carries the warm-up
its siblings carry now.

**It does not prevent the edit and it does not roll one back**, and every description of it
has to say so. `PostToolUse` runs AFTER the tool has written the file — Claude Code's own
table reads "Shows stderr to Claude; the tool already ran". Only `PreToolUse` blocks, and
only for a payload it can lint before the write: a `Write` carries its whole content, an
`Edit` carries a fragment whose result would have to be reconstructed first. That is the
trigger for revisiting the mechanism; it is not a reason to describe this one as more than
it is. (This paragraph exists because the first version of it claimed otherwise, and a
review bot caught it against the reference in `.claude/skills/impeccable/`.)

Four properties it is built to have, each with a test in `tests/build/lint-edited.test.ts`:

- **Each linter runs in the edited FILE's own project root**, which is not always the root the
  hook itself runs in. A worktree is a full checkout carrying its own `.oxlintrc.json`, its own
  `eslint.config.mjs`, its own `node_modules` and its own branch's rules, and until this was
  fixed every edit inside one was answered with a tool error about the config and no file was
  ever linted: oxlint anchors "the root config" on its working directory, so the worktree's
  byte-identical copy was read as a NESTED one and `options.reportUnusedDisableDirectives` —
  root-only — failed the whole run onto STDOUT, which this hook returns as findings. The root
  is derived from the file by walking up to the nearest `.oxlintrc.json`/`package.json`, never
  by matching the name `.worktrees`, and by a walk rather than `git rev-parse --show-toplevel`
  because the two name the same directory and cost **0.22ms** against **61ms** — two thirds of
  oxlint's whole answer. oxlint's `-c` and `--disable-nested-config` were both available and
  are refused where the code is: either would lint a worktree file against the MAIN branch's
  rules, which is this same bug with no error message on it. The binaries come from that root
  when it has them and are borrowed from this one when it does not — the working directory is
  what carries the rules, so a borrowed binary still reports about the right branch.
  **Read the `.vue` half narrowly**: an SFC in a worktree is linted correctly today only
  because ESLint 10 resolves the config file from the linted file's location — ESLint 9
  resolved it from the working directory, found this repository's config, and `.worktrees/**`
  in its global `ignores` meant an SFC came back silently clean from a hook that never read it.
  The fix makes that correct by construction; the test is a LOCK on a lookup rule that has
  changed once already, and what it catches TODAY is the oxlint noise that used to be joined
  into the same findings string.
- **It exits 2, not merely non-zero.** Neither code stops anything here, but 1 shows stderr
  to the USER and lets the agent carry on unaware, while 2 hands the findings over as a
  tool error the agent has to answer for. That is who gets told, not whether it happened.
- **It fails OPEN on its own bugs** — unreadable input, no file, a missing linter. A hook
  that failed closed would answer every edit in the session with an error about the hook
  rather than about the code, and the gate still catches what the hook missed.
- **The wiring is checked, not assumed.** The hook only runs because the settings name it;
  a renamed script leaves that pointing at nothing and edits silently stop being checked.

It sees ONE file, so it cannot see a layer violation's other end, a type error, a dead
export or anything ESLint owns. `npm run check` is still the definition of done, and
nothing here is allowed to read as if it were.

## Testing

`tests/` mirrors `src/`. Pure logic gets node tests — a rule about a quantity, a cost or a
zone is asked of a function, never of a screen, which is the whole return on the layering.
DOM code gets jsdom, per file. The `obsidian` module is aliased to one small mock that the
suite, the harness and nothing else share.

**Known limits of the fakes**, so nothing trusts them wider than they are: the module mock
models only the members something drives, and its `getLanguage()` answers `'en'` **unless a
caller sets it** — the Home surface branch made it a module-level `let` behind a `setLanguage`
setter for the browser harness's `?lang=` knob, and **no suite calls that setter**, so the
suite's own exposure is unchanged: a call site resolving the language wrongly is still
invisible to it, which is why `t` is pure and driven per locale directly. What DID change is
that the value is now mutable across a worker, so a suite that ever calls it owes every later
file in that worker the reset — the setter's own docblock is the authority and says so. (This
sentence read "always answers `'en'`" for the whole of the branch that falsified it, in a
paragraph the same branch edited by 179 lines: the count of a claim's readers is not the count
of its editors.) **`Platform.isMacOS` is the second mutable member and it IS driven by the
suite** — `platformModifier`'s cases assign it directly to reach the macOS arm — so it is the
one that actually owes the reset in practice. `FakeLeaf`/`FakeWorkspace` RECORD asks rather
than behave. The DOM helpers install only `createEl`, `createDiv`, `empty`, `setText`. And
**`npm run build` type-checks `tests/**` in full** — `tsconfig.json`'s `include` is `src/**`
plus `tests/**`, with no `paths` mapping, so a test is checked against the same types `src/`
is. Vitest still transpiles without checking; the compiler that matters runs in `build`.

**It arrived through a ratchet, and the ratchet is gone.** For a long time this said "two
entries", then four, five, six, seven — one file at a time, each admitted because a specific
proof needed a compiler and each paying for itself on its first run. Turning the whole tree on
reported **562 errors across 114 of 307 files**, so the rest was held as a baseline of files
permitted to fail (`scripts/typecheck-tests-baseline.json`, enforced by
`scripts/typecheck-tests.mjs`), cleared over five increments, and both deleted with the list.
What is worth carrying is not the mechanism but what it found, because every one of these was
green in all four gates beforehand:

- **A command bundle missing `calibratePlan` entirely**, so slice 15's calibrate button would
  have TypeErrored in the e2e rig rather than refusing or working.
- **Two cascade registrations passing the command OBJECT** where `CascadeDeps` declares a
  METHOD — `deps.recalculate({…})` would have been "not a function", unreached only because
  both cases abort at a failing list step.
- **A `createZoneId()` handed to `InMemoryRequirementRepository.poke`**, which takes a
  `RequirementId` — a foreign brand reaching a method, in the file that tests that repository.
- **`saveSettings({ …, projectsFolder })` where the setting is `projectFolder`.** `settingsFrom`
  is a trust boundary that drops a key this version does not declare, so six cases certified a
  rebind on a settings change that never happened. **A SEVENTH was living on an open branch and
  arrived at the merge**, in design slice 21's `rootSwapRebind.test.ts` — invisible to the sweep
  that found the other six, because that file did not exist on `main` when the sweep ran. It
  cost nothing behaviourally, and saying why is the point: `saveSettings` calls
  `rebindOpenViews()` unconditionally rather than comparing old settings against new, so the
  rebind those cases are about really did happen. What it cost is that the case reads as
  changing a setting and does not — and it would go on passing on the day `saveSettings` learns
  to short-circuit an unchanged save. **This is the argument for the gate being PERMANENT rather
  than a sweep**: a one-off cleanup measures the tree in front of it, and every open branch is a
  tree it cannot see.
- **A confirm dialog handed `body:` where `ConfirmDescriptor` declares `message`** — an excess
  property, so that fixture's dialog rendered no message at all.
- **`argumentsOf` guarding a lightningcss pseudo-class with `Array.isArray`**, which cannot
  discriminate there: `Selector` is itself `SelectorComponent[]`, so the guard answered true
  for every variant and handed `:host`'s single selector back as a LIST of them.
- **Dead code that read as belt and braces** — `zone.withChanges?.({})` on a `Zone` with no
  such member, immediately `void`ed, under a comment describing the two lines below it.
- **A local `type ResultLike<T> = { ok: true; value: T }`** asserting that a validating call
  cannot refuse.
- **`withConflictingReads` typed to a port while calling `poke`**, which no port declares.
  That one is also its own lesson: narrowing to `InMemoryRequirementRepository` was the
  obvious next answer and was wrong in the OTHER direction, since a second call site wraps the
  ASSET repository — a fix written against the case in front of the author rather than the
  class, caught only because the compiler was still running.

Three rules came out of the exercise and outlive it:

- **A fixture is usually behind a change it was the REASON for.** `PolygonSketch`'s docblock
  records `cursor` being split into `pointer` and `nextVertex`, and a fixture still wrote
  `cursor`; `flattenedWithoutRing` declared `Map<string, string>` while its body built a list
  of sites per class, for a defect its own comment explains. Prose recorded both changes.
  Nothing checked them.
- **`as never` over a whole double hides which members it stands in for**, and makes every
  read through it an error the moment anything asks. Two `vaultStack()` helpers were `as never`;
  `never` has no properties.
- **A local assigned inside a callback narrows to `null` at every later read.** Four separate
  `let settle: (() => void) | null = null` locals stopped being callable. The house spelling is
  a definite assignment (`let settle!: () => void`), which `drawPolygonTool.test.ts` already used.

**And the argument for it living in `build` rather than beside it:** while the gate was a
separate command, four files silently stopped type-checking between two merges, and nothing
reported it until somebody ran it by hand. The eight seconds it adds to `vue-tsc` is what that
costs.

The seven entries that were admitted one at a time are still worth reading for WHY each was
worth a compiler, since the same reasons apply to the next proof somebody needs:

`tests/harness/**/*.vue` is the first, and it is about SCOPE rather than about a proof:
`IndexPage.vue` is the largest Vue file in the repository and the surface every prototype is
viewed through, and it was reached by neither `vue-tsc` nor `eslint-plugin-vue` (whose
`VUE_FILES` was `src/` only). The first run over it found `HARNESS_PLAN` missing a required
`PlanDto` field while annotated as one. Both globs are asked of the tools rather than read,
in `tests/build/lint-scope.test.ts` — TypeScript's own config parser, with `.vue` declared as
an extra extension, and ESLint's `calculateConfigForFile`.

`tests/presentation/editor/type-safety.test-d.ts` is the second, and it is a proof: slice 6's
screen/world brand
separation and the narrowing of `SelectionStore` to the four members `EditorContext` may
hand a tool are both claims only a compiler can settle, and `vue-tsc --noEmit` in
`npm run build` is the whole mechanism by which a compile-time proof exists here — a
`// @ts-expect-error` that goes unenforced is just a comment. It carries both directions:
what must NOT compile (the two brand mixes) and what must (the live Pinia store still
satisfying that four-member contract). Outside that one file, an `implements` still binds
the editor, not the gate.

`tests/application/ports/diagnostics.test-d.ts` is the third, and it is the other proof only
a compiler can carry: slice 11's "diagnostics contain no project content" is a claim about
`DiagnosticsLedger.record`'s PARAMETERS, so it has no runtime form at all. Five
`@ts-expect-error` directives — a zone's NAME, a note PATH, a free-text third argument, a
kind outside the union, and the old three-string call shape — plus one line asserting what
must still compile, which is an `AppError` whose `message` and `cause` DO hold content and
are dropped by the ledger rather than refused at the door. An unsatisfied directive is itself
an error, so widening `record` back to strings fails the build at the directive that no
longer has anything to suppress.

`tests/helpers/makeRenovationProjectView.ts` is the fourth, and it is neither scope nor a
proof but a FAKE held to the contract it stands for. That file's own docblock promises that a
grown constructor requirement "meets every consumer at the same time" — a compile-time claim
with no compiler behind it, and it had already been broken: slice 16 gave
`RenovationProjectDeps` a `commands` bundle whose `logger` is required, the factory built
`commands` out of `createProject` alone, and `ViewRoot` then handed `logger: undefined` to
`useFormCommit` — where a REJECTING dispatch TypeErrors inside the very catch that exists so a
fault reaches somebody. Invisible to all four gates, and doubly so because every dispatch wired
today is a guarded command that cannot throw. **The wider instrument was measured before the
narrow one was chosen**: every `.ts` under `tests/helpers` in that same `include` reports 29
errors, at least four of them this repository's own fake-too-thin shape rather than scaffolding
noise — `calibrateHarness`'s viewport missing `worldPerScreenPixel`, `planEditorRig`'s bundle
missing `calibratePlan`, two `PlanDto` fixtures missing `calibration`. Worth closing, and not
inside a review pass on another slice, so the number is written down where the next reader
finds it rather than left to be re-measured.

`tests/helpers/fixtureVault.test-d.ts` is the fifth, and it is a KIND of its own rather than
a fourth instance of scope, of a `@ts-expect-error` proof, or of a fake held to a contract.
It asserts BIDIRECTIONAL assignability — that slice 12's disk-backed `FixtureStack` satisfies
the same structural `VaultSurface` that `FakeVault`'s in-memory `RepositoryStack` already
does, and that `RepositoryStack` still satisfies it too, so the widening that let the surface
admit a second implementation is proven not to have narrowed what the first one already
promised.
Neither half is a `@ts-expect-error`: both assignments must compile, which is the opposite
shape from the two `.test-d.ts` files above it. Naming `RepositoryStack` is what gives it its
second effect, incidental to the proof it was written for: that type lives in
`tests/helpers/vault.ts`, which no earlier `*.test-d.ts` had ever pulled into a real program,
and `tests/**` is normally transpiled without checking — so this was the first time anything
type-checked that file's ANNOTATIONS against its CODE, and it found two pre-existing defects
on its first run. `tests/helpers/logger.ts` carried `Logger` only as a LOCAL, unexported
type-only import (`TS2459: declares 'Logger' locally, but it is not exported`), which
`vault.ts` had been importing from there regardless, unchecked, for its own
`RepositoryStack.logger: Logger` field; and `RepositoryStack` itself never declared the
`ledger` field `createRepositoryStack` had always returned, invisible for as long as the gap
between a factory's return value and its declared interface had no compiler pointed at it.
Both were fixed at their source rather than augmented around here. The technique
generalises past this one file: pulling a single `*.test-d.ts` into `tsconfig.json`'s
`include` does not check only the assertions written in it — it type-checks every module that
file imports, transitively, for the first time, which is a cheap way to point a compiler at a
helper subtree nothing else reaches.

`tests/presentation/errors/errorSurfacePolicy.test-d.ts` is the sixth, and it is a second
instance of the `@ts-expect-error` kind rather than a new one — with the difference that what
it proves is an ACCESS rule rather than a parameter's shape. Slice 17's `ErrorSurface` carries
a `unique symbol` its own module declares and never exports, so the three literals in this file
are structurally perfect and still unassignable: the only way to hold a surface is to have
called `surfaceFor`, which is what makes "a call site cannot reach a toast without asking the
policy" a `tsc` guarantee rather than a lint one. Measured, not asserted — deleting `& Routed`
from the seven union members reports exactly three `TS2578: Unused '@ts-expect-error'`
directives, one per literal. **What it deliberately does not prove is written into the file**:
that a call site asked with the RIGHT origin, which no type can hold, and for which the spec's
origin table plus review are the whole instrument.

`tests/application/errors/exceptionMapper.test-d.ts` is the seventh, and it is the same kind
put to a claim about code NOBODY HAS WRITTEN YET. `ExceptionMapper`'s declared return is
`AppError & TechnicalFault`, so a mapper that forgets to stamp the fault it mints fails at its
own `return` — which is the only form in which "every `AppError` minted from a thrown cause
carries the stamp" can be checked at all, since the mappers it quantifies over are the future
geometry and import ones the type's own docblock promises. Its two directives are held for
DIFFERENT reasons and both mutations were run rather than reasoned: widening `ExceptionMapper`
to a bare `AppError` unsatisfies the first and leaves the second biting, because
`VaultExceptionMapper` restates the obligation in its own call signature; widening only that
signature reports nothing at all, because the interface EXTENDS `ExceptionMapper` and inherits
the stamped one. The first draft of the file's own comment asserted the two were independent
and that widening one would leave the other open — false in both directions, and the sentence
is now what the mutations printed.

**It exists because the rule's earlier, REMEMBERED form was kept at one of its two sites.**
Slice 17 stamped by hand in `faultError`, under a docblock calling that "the single site where
a thrown cause becomes an `AppError`"; `guardAgainstThrowing.ts`'s catch is the second, and it
is the one every guarded command and query goes through. So a repository exception under a
dispatched editor command arrived in Presentation unstamped, was read as an ordinary
save-affecting refusal, and was routed to the save indicator — badge raised, toast suppressed
as a double-report, and the mapped sentence, which is the only account of a fault that will
ever exist, reaching nobody. Reported by a review bot on the pull request; `CLAUDE.md`'s own
rule is that a docblock saying "the only place X" gets a `grep` in the SAME edit, and that one
never did. **The two report doors then collapsed into one**, which is the part worth carrying:
`reportCommitFailure` existed as a separate function ONLY because its callers were the only
ones whose faults were stamped, so the fault arm would have been dead in its sibling. Making
the stamp a type obligation removed the asymmetry, and with it the reason for the second
function — a split kept alive by a defect rather than by a distinction.

- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. On one pull request in the
  source project, six of ten review findings were comments precisely stating the rule the
  code beside them broke. A confident paragraph is evidence of intent and of nothing else.
- **A fake must not be kinder than the real thing, not thinner than it, not HARSHER than it,
  and not FASTER than it.** A DOM helper
  that accepted what Obsidian rejects shipped a dead drag target while every test and the
  browser harness drew it happily; too kind. A fake `ItemView` that never nested a
  `.view-header` inside `.workspace-leaf-content` the way Obsidian does left
  `styles/chrome.css`'s own selector nothing to match and the harness's growth chain
  nothing to key its `:last-child` rule off, collapsing the browser harness to a sliver of
  its pane — too thin, and invisible to the suite either way, since neither defect touches
  a property jsdom draws or an assertion checked. Where a fake cannot be made strict, ban
  the tolerated spelling at the call site — `SVG_CLASS_TOKENS` in `eslint.config.mjs` is
  that shape. Where a fake is too thin, the fix is a fake that actually nests what the real
  thing nests — `ItemView` in `tests/helpers/obsidian-mock.ts`, since the harness-collapse
  fix.

  **The most expensive instance so far, because it hid a shipped defect behind 860 green
  tests:** `FakeMetadataCache` parsed the vault's own text SYNCHRONOUSLY, while Obsidian
  populates `MetadataCache` asynchronously — so a note read back in the tick it was created
  has no cache entry at all. Every read-after-write passed here and failed in a vault, where
  `create-sample-project` reported "Migrating the project note failed" on a note it had just
  written correctly (an absent `schema-version` reads as version 0, and there is no migration
  step from 0). Making the fake honest turned **65 tests across 12 files** red at once, which
  is the measure of what a kind fake was concealing. Two things came out of it and both are
  load-bearing: `frontmatterOf` falls back to `EchoWindow` — already "what this plugin last
  wrote here" — when there is no cache entry (and, since the modify window below, when the
  entry it has predates our own write), and it keys on the cache ENTRY rather than on
  `entry?.frontmatter`, because `getFileCache` answers `null` for "never parsed" but an
  object with no `frontmatter` for "parsed, and the user deleted it". Collapse those two and
  a note whose frontmatter was deleted is served this plugin's own stale bytes forever. The
  fake states what it models and what it still does not: the create window, not the parse lag
  after a modify, where Obsidian holds a STALE entry rather than none.

  **That last sentence stood for eleven slices and named the defect it was hiding.** The
  MODIFY window is real and it shipped: `SetPlanBackground` wrote the reference, published
  `PlanBackgroundChanged`, the Plan Editor re-hydrated off that event INSIDE the window, and
  `GetPlan` answered a plan with no background — so the canvas drew none, and the background
  appeared only much later, when some unrelated action (a calibration, in the report) re-read
  a note the parse queue had caught up with in the meantime. Every gate was green: the fake
  cleared its own lag record on `modify`, so every read-after-modify in the suite read the
  bytes on disk. **A fake that says what it does not model is still a fake that does not model
  it**, and writing the gap down bought exactly nothing — the sentence was read as a survey of
  the ground rather than as a live exposure, which is this file's own "a documented residue
  reads as surveyed ground" rule, arriving in the one place that had already written it out.

  What closed it: `FakeVault.pendingParse` models BOTH windows (a create leaves the cache with
  no entry, a modify leaves it the PREVIOUS text, and a second write inside one window keeps
  the earliest, because the cache is behind both), and `frontmatterOf` now detects the modify
  window rather than declaring it undetectable. The detection is a READING and not a guess:
  every writer takes `cacheReading` — the cache's own answer, immediately before it writes —
  and hands it to `markFrontmatter` as `supersedes`; a cache still answering exactly that has
  not been re-parsed, so the echo record is the truthful answer, and a cache answering
  anything else has moved on and wins. **A revision comparison was tried first and is the
  instructive failure**: it cannot tell a lagging cache from a hand edit that DROPPED the
  `revision` key, and it made `VaultChangeAdapter` blind to exactly such an edit — measured,
  on the two `announcements.test.ts` cases that drive one, which is the whole reason the
  discriminator is a token of the pre-write reading. `cacheReading` is also deliberately not
  `observeFrontmatter(frontmatterOf(...))`: inside the window that digests what this plugin
  WROTE rather than what the cache SHOWED, which breaks the chain on the second consecutive
  write and read the stale marker back in the slice-10 cascade. Blast radius of the honest
  fake: **9 tests**, every one of them a genuine read-after-modify, against 65 and 86 for the
  two instances above — the number is not the shape, which is why all three are recorded.

  **Two review rounds then found that the fix's own fallback was the new hazard, and the
  second round's lesson is the one worth keeping.** A cache TOKEN cannot tell "the cache is
  behind US" from "the cache is behind SOMEBODY ELSE", and it cannot see an external edit at
  all — an unparsed edit is by definition invisible to the cache. So the echo is served only
  when BOTH questions answer yes: is the FILE still the one we wrote (`EchoWindow` records
  `TFile.stat` after each write), and is the cache showing a state of ours we have since
  superseded (a CHAIN, because Obsidian may parse an intermediate write while a later one is
  still unparsed). The first of those was a REGRESSION this fix introduced and it was data
  loss: a hand edit landing inside the window was hidden by the echo, and the next
  conditional save — which the stale cached revision used to REFUSE — then overwrote it.

  - **A reading about "the file WE wrote" is only true while that is still what is on disk,
    and that is a rule about the CALL SITE no signature can carry.** Four writers take the
    stat with nothing but synchronous index bookkeeping since their write;
    `ObsidianZoneRepository` awaits a whole sidecar mutation in between and took it after,
    so an external edit landing in that window was recorded as OURS and `frontmatterOf`
    vouched for somebody else's bytes. Found by a review bot reading the ONE writer whose
    shape differs — which is the search worth copying: when a rule is kept correctly at four
    sites, look for the fifth that is not shaped like them.
  - **"Both directions of that error are SAFE" was false, and it was false because it
    measured the wrong baseline.** `observedFileStat`'s docblock argued that the guard "can
    only refuse the echo more often than a version without it" — true, and the version
    without the guard is the one that shipped the overwrite, so being no worse than it is not
    a safety property. Against the behaviour BEFORE the fallback existed the two directions
    differ: a stat MISMATCH withdraws (safe, and only lets the parse-lag defect resurface),
    while a stat COLLISION serves the echo over bytes that are not ours (an overwrite that
    used to be a refusal). A safety claim names its baseline or it is not a claim.
  - **`mtime:size` cannot be strengthened here and the sentence says so rather than
    promising more.** It is the whole of what a file states about itself synchronously, and
    `frontmatterOf` is synchronous by construction — `VaultChangeAdapter` calls it and has no
    `await` to spend — so a content hash is unavailable at the only moment the question is
    asked. The residue is PINNED as behaviour (`noteIo.echo.test.ts`) rather than described,
    so a build that closes it fails a case instead of leaving a paragraph quietly stale.
  - **A residue has as many faces as it has readers, and this one had a second nobody
    named.** `VaultChangeAdapter.processNote` reads through `frontmatterOf` and then asks
    `echo.matches` of the RESULT — so inside the window the fallback hands back exactly the
    value that comparison is against, and a colliding external edit is suppressed as our own
    echo. The read half self-corrects the moment the parse queue catches up; the INDEX half
    does not, because that path's one event has already been spent
    (`echoCollision.test.ts`). Both instruments had to be hand-built, because the fake
    vault's mtime is a monotonic COUNTER and every write there moves the stat — a fake
    kinder than a real clock, in the one property the guard rests on, and its own docblock
    says so.
  - **The CREATE window deliberately takes no stat guard, and that asymmetry needed writing
    down before it read as an oversight.** With no cache entry the only thing to withdraw to
    is `{}`, which every caller reads as a version-0 document — the original create-window
    defect. In the MODIFY window withdrawing yields the stale cache: wrong, harmless, and it
    refuses the next save. Withdrawing is only the safe direction where there is something
    safe to withdraw TO.
  - **Two claims that survived the fix and were still wrong, both found by re-reading rather
    than by any gate.** `markFrontmatter` said starting a fresh chain "stops this set growing
    for the life of the session" — it resets only when a write OBSERVES the cache caught up, so
    the real bound is the writes inside one un-drained parse window, and a queue that never
    drained would grow it. And the five writers disagree on how an INSERT spells "nothing to
    supersede" — four pass `{ reading: undefined, stat }` because `cacheReading` is branch-free
    by design, `ObsidianPlanRepository` splits its arms and passes none — which is equivalent
    (a fresh path leaves the chain empty either way, so the stat an insert records is DEAD),
    and nothing said so. Both are now written to what the code does, and the equivalence is
    pinned by a pair of cases rather than asserted, because "these two spellings mean the same
    thing" is exactly the sentence that stops being true without anything failing.
  **Third instance, same shape, found the same way — by running the plugin.** `FakeVault`'s
  `create` accepted a path whose PARENT FOLDER did not exist; Obsidian refuses one. So
  `PlanGeometryStore` had no `ensureFolder` in front of the geometry sidecar — the project,
  plans and zones folders each get one from the repository that writes into them, and
  ADR-011's `Geometry/` is a folder no note ever lands in — and on a fresh vault the first
  write of the first plan ever saved failed with "the geometry sidecar could not be
  created". Making the fake refuse turned **86 tests** red. The lesson that generalises: when
  a fake stands in for something that ENFORCES a precondition, the fake has to enforce it
  too, or the precondition is only ever checked in production.
  **Fourth instance, found by review rather than by a gate.** The slice 8 e2e rig drove
  gestures with bare `pointerdown` events that no `pointerup` ever followed — a sequence
  no mouse can produce, since a real click always delivers both. `ToolManager` clears its
  in-flight flag on `pointerUp`, so between two vertices of a polygon the flag is false,
  and Escape-cancels-the-drawing was certified by a test whose event stream never left
  the state the flag models. The fix (cancelGesture reaches any active tool) is fine; the
  lesson is about the RIG: a simulated event stream must respect the grammar of the real
  input device — clicks are down+up pairs, drags are down/move…/up — and the rig now
  spells them that way (`click()` in `zoneEditing.test.ts`), so the next gesture test
  cannot accidentally model an impossible input.

  **Fifth instance, and the THIRD face of the rule** — the one the heading gained the word
  "harsher" for. `tests/harness/planEditor.ts` handed the browser harness
  `unavailablePlanEditorCommands()`, the bundle a session with unrecovered settings gets, under
  a comment reading "every write refuses". But that bundle also carries `zoneInspector`, a READ
  (SDD §59 groups the Inspector query with the commands it shares a selection with), and the
  refusal refused it too — on a page whose fixture holds the zone in full. `InspectorDto` has no
  error variant, so a failed read and an empty selection are the same `{ kind: 'empty' }`: the
  canvas showed the seeded Kitchen selected and the Inspector showed nothing, with no error
  anywhere and two of the five shell regions contradicting each other. The lesson generalises
  past this bundle: a stand-in that REFUSES what production answers turns a tool built for
  looking into one that shows a false picture, and it does it silently wherever the consumer has
  no shape for an error. A refusal bundle is the honest stand-in only where the real thing would
  also have nothing to give.

  **The FOURTH face of the rule, and the one that hides a defect completely: FASTER than the
  real thing.** `FakeLeaf.openFile` and `FakeLeaf.setViewState` each established their leaf's
  view state SYNCHRONOUSLY, where Obsidian reads a file or runs a view factory and `onOpen`
  first. That models a guarantee `Promise<void>` does not make — nothing in that signature
  says the side effect has landed before the promise resolves — and the consequence is worse
  than a thin fake's: the racing second call always won the lookup, so a regression case
  written for the duplicate-tab race PASSED against the live defect. Measured both ways, in
  both files. `FakeVault.createFolder` was the same rule's older face, kind rather than fast:
  idempotent where Obsidian throws on an existing folder, one method away from a `create` that
  already refused a duplicate file. **All three corrections cost 0 tests**, which is the figure
  worth remembering beside the 86 and the 65 for the same reason those are: the blast radius
  is not the shape. When a fake stands in for something ASYNC, ask what its signature promises
  rather than what one implementation happens to do first — and where the fake must stay
  fast, say so, because "faster" reads exactly like "correct" from every green test.

  **And a fake's speed changes what a test's EVENT STREAM means.** `registration.test.ts` drove
  a ribbon click and a command invocation one `await Promise.resolve()` apart — an input no
  human can produce — which was harmless until `revealCandidate` learned to coalesce in-flight
  activations, at which point the case was asserting on a gesture that had not happened. The
  gap between two human gestures is a MACROTASK turn (`tests/helpers/async.ts`'s `settle()`),
  never a counted number of microtask hops: a count is a fact about today's implementation and
  goes stale silently, in the direction of a green test.
- **A global a dependency installs is a global this plugin has to remove.** Konva assigns
  `window.Konva` at module scope, so every plugin load re-runs it; nothing took it off, so
  deactivating and reactivating logged `Several Konva instances detected` at `console.error`
  and kept the previous load's whole bundle reachable from `window`. That is what finally
  earned `onunload` an existence — it releases the global, and only while it is still the one
  that load claimed, since another Konva-bundling plugin may have replaced it since.
  `pdfjs-dist` had the same shape (`globalThis.pdfjsWorker`) and lost it by ceasing to be
  bundled. Check what a new dependency writes to `window`, and check it in the BUILT bundle
  rather than in the dependency's docs.
- **A test that writes into a directory another test WALKS is a race, and the exclusion has to
  live with the walk rather than with whoever remembered it.** `tests/build/lint-edited.test.ts`
  plants real `.vue` probes under `tests/harness/` — it must, because only a path matching
  ESLint's `VUE_FILES` exercises the Vue rules those cases exist for — and TWO other files walk
  that directory in parallel workers. `lint-scope.test.ts` excluded them and carried a careful
  argument for why; `harness.test.ts` never did, so it listed a probe and then READ it, losing
  the race: `ENOENT … lint-edited-probe-1.vue`, on a tree with no source change at all,
  reproduced on a stash of the branch and therefore nothing to do with the change under review.
  `tests/helpers/plantedProbe.ts` now owns both the NAME and the predicate, with the planter and
  both walkers importing it, because a naming convention two files agree about by hand is one
  rename away from silently reaching nothing. Three things came out of it:
  - **Hoisting the working version verbatim would have been a silent no-op on one CI leg.** The
    regex was `/^tests\/harness\/…/` and its original caller builds `${dir}/${entry.name}`;
    `harness.test.ts` uses `path.join`, which is a BACKSLASH on Windows. Measured as a mutation:
    restoring the POSIX-only shape reddens two cases of `planted-probe.test.ts`. **A predicate
    moving to a second caller is a predicate meeting a second spelling of its input**, and the
    old caller's correctness says nothing about the new one's.
  - **A comment naming a helper that does not exist reads exactly like one naming a helper that
    does.** `lint-scope.test.ts` said "see `isPlantedProbe`" while the thing was called
    `PLANTED_PROBE`, and a grep for the name it gave returned that comment and nothing else.
    Now it is the real name, in a real module.
  - **Removing a `const` orphans the docblock above it**, which is this file's own
    attached-docblock rule read backwards: the paragraph about the probe regex was left sitting
    over `walk`, describing something two definitions away. Nothing in any gate reads whether a
    docblock still belongs to what follows it.
- `tests/**` has a larger line budget than `src/**`, not none. The one suite without a cap
  is the one that grows into the place tests hide.

## Claims, and the checks under them

Every rule here was broken in the project this harness came from, several inside the change
that was fixing the previous instance.

- **Write the guarantee to the check, never ahead of it.** When a check cannot reach the
  whole claim, narrow the sentence rather than leaving the wider one standing. A guide that
  promises more than lint and the suite deliver is the same defect as an unchecked comment,
  and harder to catch because it reads as settled. If narrowing makes the sentence ugly, the
  sentence has become honest and the ugliness is the information.
- **A category invariant is checked at the forbidden thing, not by listing the places.**
  "Nothing does X" cannot be verified by driving the paths someone thought of; the next path
  is the one that breaks it. Put the check on the call — a lint rule, or a spy on the call
  itself — so it holds for code not yet written, and name the spelling it does see.
- **Measure a set with an instrument that can see all of it, and test the instrument
  first.** A grep for `foo(` misses `foo<T>(`. Both happened there, and both times the wrong
  count was already being used as the evidence for a decision.
- **A static-analysis category is a LENS, not a census**, which is the rule above met from
  the direction where the instrument is somebody else's. `private-type-leak` reports an
  exported signature naming a private type, so when `type DispatchResult` turned out to be
  declared byte-identically in SEVEN places, it showed the TWO whose alias reached an
  exported signature and was silent about the five that did not — and one line is under the
  clone detector's floor, so nothing else could see them either. The other five turned up
  only because clearing those two meant grepping for the SHAPE. A tool answers the question
  it was written to ask; the count it returns is not the size of the thing it points at.
- **A tool's suggested fix is a hypothesis.** Fallow's first action on a `private-type-leak`
  is "export the referenced private type by name", and it was wrong twice in nineteen: on
  `Routed` it would have destroyed the `unique symbol` access lock three `@ts-expect-error`
  directives exist to prove, and on `ReversibleOverrideBase` it traded two leaks for an
  `unused-exports` finding — the report contradicting ITSELF, visible only by making the
  change and re-running.
- **A docblock that says "the only place X" gets a `grep` in the SAME edit**, and the
  sentence is then written from what the grep printed. Slice 11's review rounds counted
  eleven sentences promising a category where the code held a list — three of them
  introduced by the very changes fixing the earlier ones — and the two that cost BEHAVIOUR
  rather than only accuracy were both "only"
  claims. `guardCommand` wrapped `execute` and the docblock called that the boundary, while
  the Inspector dispatches an override through `executeWithVersion`: wrapper present, test
  green, door open. And `notifyError`'s header called itself "the only [door] an `AppError`
  may take" while two call sites in `src/plugin/` hand-spelled
  `notify(toUserMessage(getLanguage(), …))` — a spelling the notice-door lint rule's own
  docblock named as CORRECT, so one slice declared the same shape forbidden in one file and
  blessed in another, with neither aware of the other. Counting is necessary and not
  sufficient: the sentence has to be checked against the measurement as carefully as the
  measurement was checked against the code, because slice 11 twice wrote a false sentence
  FROM a correct count.
- **Address code by name, not by position.** Selectors, symbols and paths survive an edit;
  line numbers are correct until the next insertion above them.
- **A table that enumerates code goes stale; a table that states a rule does not.** Name a
  module only where the sentence is *about* that module.

## Gotchas

- The `obsidian` devDependency is pinned to the FLOOR **exactly** (`1.13.0`), not to npm's
  newest and not to a range over it, so the compiler refuses an API `minAppVersion` does not
  promise. `tests/release/manifest.test.ts` holds that pairing. Raise both or neither.
- **`lib` and `target` are two different claims and deliberately disagree.** `lib` is
  ES2021 — what the type system says EXISTS at runtime — while `target` stays at ES2020 in
  BOTH `tsconfig.json` and `vite.config.ts`, which is the SYNTAX the bundle emits. Raising
  `lib` alone widens what `src/` may reach for (`String.replaceAll`, `Promise.any`,
  `AggregateError`, `WeakRef`) and changes not one byte of emitted syntax, because a method
  call is not downlevelled and esbuild polyfills nothing. So it rests on a RUNTIME claim,
  and only half of that claim is checked: all four shipped in Node 15, below every range
  `engines.node` declares and therefore inside what `tests/build/engines.test.ts` already
  compares — while the Electron an Obsidian at `minAppVersion` 1.13.0 ships is checked by
  nothing here, and is the half to argue at the next raise. `Object.hasOwn` is still out,
  measured rather than remembered: a probe compiled under ES2021 reports exactly that one
  missing and the other four present, because it is ES2022.
- **`engines.node` is a RANGE, and a measurement rather than a decision.** Every dependency
  renegotiates it silently. `>=22` was already false before oxlint arrived, and the obvious
  repair — raise the floor — was still wrong at the other end: eighteen installed packages
  support `^22.x` and `>=24` while excluding Node 23, so any unbounded floor claims a
  runtime the toolchain refuses. **A bound is not a range**, and a check that reads one
  bound only finds the defects living at that end.
  `tests/build/engines.test.ts` compares the whole declared range against every installed
  package with npm's own `semver.subset` — the instrument that decides this in reality is
  the one that should decide it here. What it cannot see: a constraint stated anywhere but
  `engines.node`, and a package this platform did not install.
- `@types/node` tracks the `engines` floor, never npm's newest — as closely as npm allows,
  which is not exactly: the floor is `22.22.2` and `@types/node` stops at `22.20.1` on the
  22 line, so `^22.20.1` is the nearest thing that exists. TypeScript upgrades are
  bounded by what `typescript-eslint` declares as a peer — losing lint is the cost.
- **Vite's minifier strips every comment**, legal ones included — measured, both as
  `output.banner` and in the source. There is no source-pointer banner on the bundle for
  that reason; `vite.config.ts` says where the pointer lives instead.
- `output.exports: 'named'` in `vite.config.ts` is about Obsidian's loader, not bundling: it
  produces the `exports.default` shape esbuild gave every plugin built from the sample repo.
  Which shape Obsidian accepts cannot be checked here, so it takes the one with a record.
- Two flat-config blocks matching one file **override** a rule rather than merging it, and
  it is the RULE KEY that decides, not the rule's purpose. A per-directory block that
  forgets to repeat the shared `no-restricted-syntax` selectors silently drops every one of
  them — and the same trap is live on `no-restricted-globals`, which
  `eslint-plugin-obsidianmd` sets across `src/` to ban `app`, `fetch` and `localStorage`:
  the `core`/`domain` DOM block had been overriding that list since it was written, so `app`
  — the global the marketplace review bot rejects for — was rule-level unbanned in the two
  layers least likely to notice. Both `no-restricted-globals` blocks spread the plugin's own
  list now, derived from its config object rather than transcribed. Read the exposure
  narrowly: `no-undef` still reported a bare `app` at severity 1 and `--max-warnings 0` fails
  warnings, so the gate would have reddened — under the wrong rule, with the wrong message.
  A different rule KEY merges, which is why the DOM block can add to the Obsidian ruleset's
  globals only by restating them.
- **PowerShell 5.1 writes a BOM** (`Set-Content`/`Out-File -Encoding utf8`), and
  `JSON.parse` refuses one — a BOM'd `manifest.json` broke every lint run here once, with
  an error pointing nowhere near the cause. Write files with node or an editor;
  `tests/build/encoding.test.ts` refuses the BOM either way.
- **`private-type-leaks` is an `error` now, and it was ratcheted the way every floor here is:
  cleared to zero first.** Nineteen had accumulated under `warn` — an exported signature
  naming a type its own module does not export, so no caller can annotate one. That matters
  more since `tests/**` type-checks: a test cannot name a type it cannot import, and an
  explicit annotation is exactly what the rule above needs to resolve a member. **Two of the
  nineteen must NOT be cleared the way the report's first action says**, and each says so
  where its suppression is. `Routed` is a `unique symbol` its module deliberately never
  exports, so exporting it would let a call site hand-build a toast surface and reach
  `notifyError` without asking `surfaceFor` — the guarantee `errorSurfacePolicy.test-d.ts`
  proves with three `@ts-expect-error` directives, undone by taking the advice. And exporting
  `ReversibleOverrideBase` traded its two leaks for an `unused-exports` finding, because
  nothing outside its module extends or imports it: there the report contradicts ITSELF, which
  is only visible by making the change and re-running. **A static analyser's suggested fix is
  a hypothesis, and this one was wrong twice in nineteen.**
- **`fallow-ignore-next-line` means the next line LITERALLY, and the line it must sit above is
  where the type is NAMED — not where the exported symbol begins.** Both mistakes were made
  here in turn: an explanatory paragraph between the directive and the code silenced nothing,
  and so did placing it above `export type ErrorSurface =` when the leak is reported on the
  first union member three lines down. Each time fallow reported the suppression as STALE
  while going on counting the leak — which is the good failure mode, and the only reason
  either was caught.
- **Clearing a leak can uncover the one beneath it.** Exporting `MoveCommand` made
  `MoveError` — private, and named in that very signature — reportable for the first time. A
  count taken before a fix is not the size of the job.
- Fallow resolves an interface's members through an **explicit type annotation**, not a
  property access: annotate the local (`const x: PortType = …`) rather than reaching for
  `usedClassMembers`, which is for members a framework invokes and would hide a dead one.
- Marketplace rules (enforced by `npm run lint` plus review): sentence-case UI text, no
  special characters in the manifest description, no inline styles, `normalizePath` on user
  paths, no global `app`. The recurring rejections are listed in `docs/setup/publishing.md`.
- Release tags equal the `manifest.json` version with NO `v` prefix (`.npmrc` sets
  `tag-version-prefix=""`), and `CHANGELOG.md` gains its dated section in the same pull
  request as the bump, as a second commit — `npm version` refuses a dirty tree. Both are
  checked (`tests/release/`), and the whole procedure is [`RELEASING.md`](RELEASING.md).
  The release workflow refuses to publish a commit `main` does not contain or whose CI
  run is not green — the "Require a green CI run" step in
  `.github/workflows/release.yml`. That guard matches CI's job by the name `verify`;
  renaming the CI job means updating the guard in the same edit, or every release times
  out waiting for a check that never reports.

## Deliberately absent

Not oversights; each has a trigger.

- **dayjs**, and nothing else on the SDD's stack. Installing a dependency nothing imports
  fails `npm run analyze`, so each arrives with its first real use — scheduling, which does
  not exist yet.

- **vue-router**, considered explicitly at design slice 21 because that slice introduced
  navigation and a router is the canonical Vue answer to it. Four reasons, and the first is
  the one that decides: **its product is URL binding, and an `ItemView` has no URL** — it
  would be instantiated with `createMemoryHistory()`, which reduces it to a state machine
  keyed by path-shaped strings, a `v-if` in a `/projects/:id` costume. It would also be a
  SECOND history stack competing with the one the pane's back arrow already drives (nothing
  errors; the two quietly disagree, which is worse), a second authority for a fact
  `RenovationProjectView`'s view state now owns outright, and a dependency bought for one
  binary state.

  **The trigger is a third level of nesting AND a genuine need for a history independent of
  Obsidian's** — both, not either. *"Epic 4 arrives"* is explicitly NOT the trigger, and that
  is a measurement rather than a hedge — and the measurement had to be corrected once, which is
  the useful half: this sentence said "Epic 4's whole navigation set" over SIX destinations, and
  PRD Feature 4.1 lists SEVEN (Overview, Spaces, Design, Work, Budget, Schedule, **Documentation**
  — the one dropped). It was also wrong about its own scope: 4.1 is one feature of Epic 4, which
  also carries the project switcher (4.2), breadcrumbs (4.3) and context preservation (4.4).
  The argument survives both corrections, which is why it is corrected rather than withdrawn:
  seven destinations fit in `{ projectId, section }` exactly as six do — one more key rather than
  a router — and 4.3 and 4.4 are DERIVED from that state rather than additional history, while
  4.2 is the picker this slice already built. Found by a reviewer reading the PRD rather than the
  sentence.

  **decimal.js is NOT on this list any more.** It arrived with slice 9's money arithmetic
  (ADR-010) and this line said otherwise for two slices. `core/money/Money.ts` is the ONLY
  module that touches a `Decimal` for a monetary amount — `amount` is a decimal STRING
  across every boundary, because a float is exactly what ADR-010 refuses — and quantities
  carry a `Decimal` directly. Three decimals is the figure that catches a coercion:
  `594.005` is not representable in binary floating point while `99.99` survives one.

  **Vue, Pinia, zod, konva and vue-konva are NOT on this list any more**, and
  this paragraph is the record of what their arrival cost, because the next arrival pays
  the same. `@vitejs/plugin-vue` is
  one line in EVERY config that transforms source — `vite.config.ts`,
  `vite.harness.config.ts` and the standalone `vitest.config.ts`, which is three here, not
  the two a generic project has — and `tsc` became `vue-tsc` in the same edit.
  [`docs/setup/vue-conventions.md`](docs/setup/vue-conventions.md) carries the conventions
  and the lint rules that enforce them, but it was written against a project with two Vite
  surfaces and names neither `test-build` nor the coverage include. The full contract for
  that arrival, as a superset of it and scoped to the gates this repository actually has,
  is design slice 1's Vue arrival checklist
  ([`docs/tasks/01-plugin-bootstrap-and-composition-root.md`](docs/tasks/01-plugin-bootstrap-and-composition-root.md)),
  recorded there as complete. Read it as the reference for what a NEW dependency has to
  wire, not as work still to do.

  **What the canvas stack cost, since it is the newest bill and none of it was obvious.**
  `konva` is `vue-konva`'s PEER dependency: `src/` never names it (the components use
  `<VStage>` and friends), so `npm run analyze` reads it as test-only and would have it
  moved to devDependencies — which would build here and fail in a vault. It is in
  `.fallowrc.json`'s `ignoreDependencies` with that reason. The bundle went from about
  60 KB to **488 KB** at design slice 5's close; that is what ADR-003 and §54 cost, and it
  is worth knowing before the next dependency. **488 KB is that slice's own figure, not
  today's** — `dist/main.js` measured 670.06 kB (gzip 211.08 kB) at design slice 16's close and
  **703.39 kB (gzip 221.71 kB) at design slice 19's**, and **825.68 kB (gzip 252.79 kB) at the
  close of the plan editor foundation's first increment** (2026-09-03, after the asset-designer
  merge — the two arrivals are not separated here), and **867.05 kB (gzip 262.83 kB) at the close
  of the Add Room increment** (2026-09-04 — no new dependency, so that 41 kB is this
  repository's own code: a tool, a store, an action, a form, a sketch and their strings), each
  verified by running `npm run build` rather than carried forward from an earlier entry here. Read every bundle figure in this file the
  same way: as the size AT THE SLICE NAMED, not as a standing total nothing re-measures.

  **`pdfjs-dist` is a devDependency, and that is the whole point of the entry.** It was a
  production one for exactly one increment, and the bill was 1728 KB of a 2216 KB bundle —
  78%, parsed on every Obsidian start by every user whether they ever opened a PDF. What
  replaced it is Obsidian's own copy, through the `@public` `loadPdfJs()` the pinned
  `obsidian` devDependency already proves is promised at `minAppVersion`. Three facts went
  with it, all of them now TEST-only: the **legacy** build, because the standard one
  constructs a `DOMMatrix` at module scope and cannot be imported under jsdom at all; the
  `globalThis.pdfjsWorker` escape hatch, which a one-file plugin needed because it had no
  `pdf.worker.js` to point `GlobalWorkerOptions` at, and which the suite turns out not to
  need either (pdf.js's own node path resolves the worker beside itself); and main-thread
  parsing, since Obsidian's copy runs a real worker. `useWasm: false` survives with a new
  reason — Obsidian ships the WebAssembly but `wasmUrl` is a `getDocument` parameter its
  viewer sets only for itself. The residual gap is that the suite runs OUR pdf.js and
  production runs Obsidian's — the same version today, verified, and nothing keeping them
  so. All of it is written down in
  `src/presentation/editor/layers/background/pdfRaster.ts` and in the mock's `loadPdfJs`.

  The suite paid too: jsdom implements no canvas, no `DOMMatrix`, no `Path2D` and loads no
  images, so `tests/helpers/canvas.ts` puts a REAL rasterizer (`@napi-rs/canvas`, prebuilt
  per platform — no build toolchain, which is what makes it viable on all four CI legs)
  behind jsdom's `<canvas>` and `<img>`. An inert stub was built first and is refused in
  that file's header for the reason this project already knows: a fake kinder than the real
  thing turns a shipped crash into a green suite.
- **The empty layer directories the SDD draws.** Git cannot hold them and lint already
  guards them; create one when a module goes into it.
- **`eslint-plugin-oxlint`.** It switches off the ESLint rules oxlint already covers,
  which on `src/` is most of core `recommended`. Two linters agreeing is not a defect —
  one fix satisfies both, and neither list can quietly become a rule's only owner.
  Thinning one to speed up the other trades a gate for seconds. Add it when ESLint's
  runtime is a cost somebody can name.
- **`oxlint --type-aware`.** It needs `oxlint-tsgolint`, and the type-aware rules this
  project actually leans on — `no-floating-promises`, the Obsidian ruleset — already run
  under ESLint's project service. Add it for a type-aware rule ESLint does not have.
- **A `docs/` register gate** (`npm run docs` in the source project: every wikilink
  resolving, every module specified by a note, opt-in claim citations). Add it when `docs/`
  has a convention worth enforcing — see section 5 of `docs/setup/quality-harness.md`.
- **`npm run perf`** and the icon renderer in the harness. The first needs a render cost to
  argue about; the second needs the first `setIcon` call, and until then every icon would be
  an invisible gap in the tool built for looking.
