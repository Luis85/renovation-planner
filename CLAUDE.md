# Renovation Planner — agent guide

An Obsidian plugin for planning a renovation: plans and zones, assets and quantities, costs,
trades, work packages and a schedule. The target architecture is
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](./docs/development/sdds/obsidian-renovation-planner-SDD.md)
and the product intent is in `docs/product/prds/`. **Read the SDD before proposing structure**: it
has already refused things that look obvious from the code alone, and where this guide and
the SDD disagree, the SDD is the authority and this file is the bug.

Today the build, the gates, the browser harness and the release pipeline work; the settings pane
declares **seven rows and four of them bind a control** — units, the default projects folder
(where a NEW project's folder is created, since slice 18; an EXISTING project's folder derives
from where its `Project.md` sits instead, ADR-0013), the currency increment's `defaultCurrency`
and slice 11's verbose logging, plus slice 19's two library-folder rows, one INFORMATIONAL and
one an ACTION, and the unreadable-note increment's diagnostics-report ACTION row, the second of
that report's two doors beside the palette command. The three that bind nothing each have their
own reason, and only the library pair share one: `setControlValue` writes through `saveSettings`
on every change, and a control on `libraryFolder` would persist a folder with no notes moved and
strand the catalogue. Counted from `getSettingDefinitions` rather than remembered: this sentence
has been wrong four times, most recently by a MERGE where two branches each added a row and each
correctly updated the count to six. `tests/plugin/settings/unrecovered.test.ts` asserts the
number rather than describing it, which is the only reason any of those were caught. The
persistence layer of design slice 4 is in place — Obsidian repositories, the geometry sidecar
store, the project index and its vault-change pipeline (bounded since slice 18 by what a note
DECLARES, not by where it sits, which closes slice 4's own recorded multi-root prerequisite
without registering a single root), and the migration runner.

**Every entity and mechanism the MVP architecture needs now exists**: `Project`, `Plan`,
`Zone`, `Asset` and `Requirement`, the quantity and cost engine behind them, the
reference-integrity engine that guards deleting either end of a link, and the recalculation
cascade that keeps a figure honest when its inputs move. Everything past this point is feature
work on a proven template.

**This paragraph names no slice as outstanding, deliberately**, because a status sentence here
is one nothing re-runs — it went stale three times in the same direction, each time about a
slice whose own section already said otherwise. `docs/tasks/` carries the checkboxes, and the
items that were WITHDRAWN or narrowed rather than ticked are in each task document's own
amendments, because a list of exceptions kept in two places is one that disagrees with itself.

**Every workspace surface mounts its own isolated Vue app** (SDD §12) — nothing outside a view
knows it is Vue. **No count is stated here**, deliberately: a number written in this file is a
number nothing re-runs, and this one was wrong twice. **The registered view types are pinned in
order, by exact array, by `tests/plugin/settings/unrecovered.test.ts`** ("registers the view and
the command anyway") — that assertion is where the next one arrives and fails, rather than here
where it would read correctly forever. Beware borrowing that array's length: the pin is over
REGISTRATIONS and this paragraph is about Vue ROOTS, and the two differ by exactly
`GEOMETRY_SIDECAR_VIEW`, which is registered and mounts none. Do not re-measure with
`grep -c "registerView" src/plugin/RenovationPlannerPlugin.ts` either — that file's own prose
names the call, so it answers one more than the calls. The **Renovation project** view is a
singleton with a ribbon button and a command, and its list state is a **LAUNCHER**:
`ProjectList.vue` draws a header, a filter that doubles as the pane's count line, one row per
project carrying two facts and a ten-step status strip, a `Continue` group offering the project
and plan last worked in, a collapsed `Completed` group and a foot line.
`ViewRoot.vue` renders it whenever the empty state does not apply, and
`renovationProject.noProjects` in its place when it does — the two never draw together, gated
on the same `'ready'` status the rest of this paragraph describes. **"Whenever the empty state
does not apply" is not "once the vault holds at least one project":**
`selectRenovationProjectEmptyState` answers `null` on
`unreadable > 0` BEFORE it ever looks at the length, so a vault whose only projects are ones
this build cannot read draws an empty LIST — its header, its Create button and no rows —
beside the refusal notice, which is the right picture and not the one the sentence promised.
The list is the `v-else`, so it is what draws in every case the selector declines, present and
future; the mapped failure sentence for the refusing `AppError`'s own code
(`.rp-view-message`, via `trError`, so unrecovered settings and a vault fault say different
things); a loading line in that same region while the read is in flight; and
`.rp-view-notice`, the one ADDITIVE one, when SOME project notes refused
(`view.project.some-unreadable`). `DialogHost` mounts here too and is invisible
until something opens a dialog — `NewProjectForm` is its first caller in this
view, opened from the empty state's action button and from `ProjectList`'s own header.
`ListProjects()` resolves to a `ProjectListResult` —
`{ projects, unreadable }`, not a bare array; the PORT below it answers a `ProjectListing`,
`{ loaded, refused }`, and the rename across that seam is deliberate — and the empty state is the `'ready'` status
with BOTH halves clear: an empty list with `unreadable > 0` is a vault that has projects this
build could not read, so it gets the notice and no "no projects yet".

**That view has a SECOND state, and everything above describes the first.** A project row
NAVIGATES now rather than opening `Project.md`, into a detail state that
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
the framework into the editor for real, and slice 15 made slice 7's tool reachable. The one
thing slice 5 writes is which document a Plan's background IS.

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

**`create-sample-project` is SCAFFOLDING and says so in its name, and it is now a CONVENIENCE
rather than the only source of anything.** One command seeds a project, a plan and five zones
through the real `CreateProjectCommand` / `CreatePlanCommand` / `CreateZoneCommand`, then opens
the editor on what it made — the vault-side equivalent of `npm run harness`. Exactly three
commands and nothing else: no asset and no requirement, which is worth saying because a reader
reasoning from slice 10's closed loop would expect them. Zones stopped needing it once slices 6
and 8 gave `DrawPolygonTool` a way to draw one by hand; the PROJECT half stopped needing it once
slice 16 gave `renovationProject.noProjects` a real action (`NewProjectForm` /
`CreateProjectCommand` — Amendment 1's "ships with no action at all" held through slices 14 and
15 and stopped being true here) and gave `ProjectList` its own header button beside it; and the
PLAN half stopped needing it in slice 21, whose detail state carries a `New plan` button over the
real `CreatePlanCommand`. What is left is the reason it was written for: one gesture produces a
scene worth LOOKING AT, where assembling the same one by hand is two forms, two navigations and
five polygons drawn vertex by vertex. **Its trigger is now that it stops being USED** — a fact
about a habit, which no gate can report. `src/plugin/sampleProject.ts` carries that and why the
partial notes a failed seed leaves behind are deliberate.

Both of those were **found by a human running the plugin in Obsidian**, not by a gate — three
defects in a row, each one a FAKE that accepted what Obsidian refuses, with `npm run check`
green throughout. The Testing section's fake rule is the general form.

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
environment and a module registry, both paid once per FILE) exceeds the test bodies.
**Every number here is a DATED SNAPSHOT of one machine and one tree**, the test-file count
included — re-measure before reasoning from any of them; what survives is the per-file
conclusion, because that is a RATIO rather than a total. ONE
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
  `tests/build/i18n-literal-boundary.test.ts` asserts the selector's blind spots as blind
  spots: `id` stays a literal because a command id is DATA a hotkey binds to, and the ribbon
  selector keys on the ARGUMENT POSITION because the icon beside the title is a literal too —
  widen it to "a literal anywhere in the call" and two allow-cases go red, measured.
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
- **test:coverage** — the suite plus the coverage floors, **99/99/99/98**
  (statements/functions/lines/branches) in `vitest.config.ts`, which also carries the live
  measurements, what every remaining uncovered arm IS, and the ratchet policy: floors only
  rise, and they rise to what a FINISHED increment measures. **Do not read a figure from this
  file as current; run `npm run test:coverage`.** Three rules about that margin, each paid
  for:

  - **Count in UNITS, not percentage points** — one branch is ~0.035pp and one function
    ~0.069pp, both below the hundredth the summary line prints, so a figure that did not
    visibly move is not evidence that nothing moved.
  - **A passing gate is not a review** — an untested arm in a TIGHT metric fails outright, and
    one in a SLACK metric hides completely. `coverage-final.json` read for the CHANGED FILES
    is the instrument that can see a single arm; the threshold is not. Plan the test with the
    code rather than after it.
  - **An UNREACHABLE guard is not free.** It costs a branch it can never pay back, so removing
    one is a real way to recover headroom.

  The suite includes `tests/harness/accessibility.test.ts` and, since two branches each
  appended cases to it and the sum crossed the 450-line cap,
  `tests/harness/accessibilityAssetLibrary.test.ts` beside it — one seam, drawn where the
  file already had three top-level `describe`s, with
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
  `tests/build/chromium.test.ts` drives all of it. **The captures have caught ten defects the
  whole of `npm run check` could not** — every one a measurement no layout engine in this
  repository performs (spacing, wrapping, overflow, contrast, hit size), which is the argument
  for running this on anything that draws. The ten, and the CI lessons `chromium.test.ts` and
  `settleUntil` each paid for, are in the increment history.
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
FULL COPY of `src/`, `tests/` and `styles/`, so moving them inside was measured rather than
assumed — `npm run check` was run with one in place. **`build`, `oxlint` and `fallow` ignored
it and `eslint .` did not**: flat config reads no `.gitignore` and no longer skips
dot-directories, so it walked in, found a second `tsconfig.json` beside the root's, and failed
EVERY file with "multiple candidate TSConfigRootDirs are present". `.worktrees/**` is in
`eslint.config.mjs`'s global `ignores` for that reason, which is the load-bearing claim that
block's own comment already makes about itself.

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
`--no-file-parallelism` re-run of the same tree. A parallelism artifact, not a broken gate
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

**`tests/**` was type-checked through a ratchet that no longer exists**, and the ten defects
it found while all four gates were green are in the increment history, along with why each
`.test-d.ts` entry was worth a compiler. Three rules came out of that exercise and outlive it:

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

The rules this suite is actually held to:

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

  The recorded instances — every one a fake that was kinder, thinner, harsher or faster than
  the real thing, with its blast radius in tests — are in the increment history. The numbers
  there (0, 9, 65 and 86 tests turned red) are deliberately not a pattern: the blast radius is
  not the shape.
  They are numbered there (first through fifth instance, and the four FACES of the rule), so a
  comment citing "CLAUDE.md's fifth fake-instance lesson" resolves against that document.
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
  rename away from silently reaching nothing. Three things came out of it, recorded in the
  increment history.
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
  Obsidian's** — both, not either. *"Epic 4 arrives"* is explicitly NOT the trigger, and that is
  a measurement: PRD Feature 4.1's seven destinations fit in `{ projectId, section }` as one
  more key rather than a router, 4.3 (breadcrumbs) and 4.4 (context preservation) are DERIVED
  from that state rather than additional history, and 4.2 is the picker slice 21 already built.

  **decimal.js is NOT on this list any more.** It arrived with slice 9's money arithmetic
  (ADR-010). `core/money/Money.ts` is the ONLY
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
  `.fallowrc.json`'s `ignoreDependencies` with that reason. Adding the canvas stack took the
  bundle from about **60 kB to 488 kB** in one slice; that is what ADR-003 and §54 cost, and it
  is worth knowing before the next dependency. **Last measured: 867.05 kB (gzip 262.83 kB) on
  2026-09-04**, at the close of the Add Room increment — 41 kB of which was this repository's
  own code rather than a dependency. **Read that as the size on the date named, never as a
  standing total**; the full series is in the increment history, and `npm run build` prints
  today's.

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
