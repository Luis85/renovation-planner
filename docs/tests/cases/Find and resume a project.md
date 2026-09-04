---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 56
sources:
  - Renovation Planner Home design spec §§5-13
  - Workspace PRD §13
  - SDD §85
status: Ready
---

# Find and resume a project

The Renovation project pane's **list state** — the launcher — in a real vault: the filter that
is also the pane's count line, the ten-step status strip, the roving keyboard model, the
`Continue` row, and the foot line. `docs/user-experience/renovation-planner-home-DESIGN-SPEC.md`
is the contract and this case is §11's *"what no gate here can check, and where it is checked
instead"*.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and

- **at least four** renovation projects spread across different statuses, **one of them
  `COMPLETE` or `AS_BUILT`** (the collapsed `Completed` group renders only when one exists), and
- **one project holding at least one plan**, for steps 9 and 10, and
- **one project with a name long enough to overrun the pane at a sidebar width** — the fixture
  that has already found two defects on this surface (`styles/forms.css` records both).

`Create sample renovation project` seeds a project, a plan and five zones if the vault is empty;
the other three and the completed one are made through the pane's own `New project`, which is
what step 15 walks anyway.

**Why a human is the only instrument for most of this.** **Thirteen of the sixteen rows below**
are `obsidian` or `browser`; each carries its own reason in the table's **fifth** column, and
those reasons fall into the four groups here. The other three — steps 5, 14 and 15 — are
`suite`, reachable in jsdom with no new infrastructure, and they are in this case because it
is about the surface rather than about what happens to be uncovered.

- **Nothing on this surface has ever been in Obsidian.** Every picture taken of it is
  `npm run harness-shot` through the vendored `tests/harness/obsidian.css`, which is Obsidian's
  *default* palette only, and every one of those was taken with **Chromium 141 rather than the
  pinned build** because this container holds no pinned browser — the script printed its
  *approximate* caveat on every run. A defect seen in those captures is real; an absence is
  weaker evidence than it would be on the pinned build, and neither says anything about a
  themed vault.
- **The focus rings are opted back in per control.** Obsidian's global `:focus { outline: none }`
  reaches every control on this pane, and its own `:focus-visible` shadow measures **2.29:1**
  dark and **1.88:1** light — both under WCAG 1.4.11's 3:1 floor — so this surface states a ring
  at each of its eight tab stops itself: **five declaration blocks across four stylesheets**
  (`forms.css` for the two header/foot actions and again for a row, `continue-row.css` for the
  pair, `project-list.css` for the `Completed` summary, `project-filter.css` for the field), plus
  a sixth for the two actions the filtered-to-nothing state swaps in. Every one of those is a
  place a ring can be forgotten, and exactly one of them has ever been photographed — the
  filter's, in `home-filter-focus`, which presses Tab rather than calling `page.focus()` because
  only a real keypress satisfies `:focus-visible`.
- **jsdom lays nothing out and dispatches no native activation**, so the 24px hit floor, the
  41rem container query and `Space`-on-a-row are outside `npm run check` entirely.
- **jsdom models no host keymap**, so whether `Mod+↵` reaches a row and whether `Ctrl+P` still
  reaches Obsidian's palette from a focused row are facts about Obsidian and about nothing here.

**What is already discharged elsewhere, so a runner does not re-derive it.** Seven fixed
captures address this surface — `home-stress`, `home-stress-light`, `home-stress-de`,
`home-whole`, `home-stress-narrow`, `home-no-match-narrow` and `home-filter-focus` — and **five**
defects were found by reading them, every one fixed and every one invisible to a green
`npm run check`. **This list is the authoritative one**; the design spec's header amendment
points here rather than keeping a second copy, because the first draft of these two documents
disagreed about the count and the omitted defect was the one a runner is sent to look at.

1. **Every row overlapped the row below it at 460px.** A row is a `<button>`, and Obsidian's own
   `button` rule sets a **fixed** `height: var(--input-height)` — so the container query wrapped
   the content to two lines and the box stayed one line tall: 41px of content in a 30px box.
2. **The wrapped row's second line was pushed to opposite pane edges** by `forms.css`'s
   `justify-content: space-between`, which is right for the wide row and applies to *every* line
   of a wrapped one — 280px of nothing between `Ausführung` and `4 Pläne · EUR`.
3. **The foot line's key legend measured 2.30:1**, against the 4.5:1 floor `PRODUCT.md` binds by
   name — and it is the only place middle-click and modifier-click are discoverable at all.
4. **The ten-step tick strip read as one filled bar** at 3px cells with 1px gaps: a proportion,
   which is the one thing §6 argues the strip is not.
5. **The filter's count rendered OUTSIDE the field's border** — a full-pane-width empty
   rectangle with `10 projects` floating to the right of it, and no placeholder saying what
   typing does. That is §3's teletext raise inverted: the field was furniture in the region
   written to answer exactly that risk. **Step 1 is where a runner looks at what replaced it**,
   so leaving this one off the list sent them to re-derive the finding this section exists to
   spare them.

Steps 1, 2, 3, 4 and 13 are what a **themed** vault and a **real leaf** add to those readings,
not a first look.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and
what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open the Renovation project pane from the ribbon | Top to bottom: **`Renovation projects`** with **`New project`** beside it, the filter line with its count at the field's trailing edge **inside the border**, `Continue` (if a context is stored), `Projects` with one row each, a collapsed **`Completed (n)`**, and a foot line carrying the key legend at the leading edge and **`New asset`** at the trailing edge | §5's seven regions, in one look. This whole surface has never been drawn by Obsidian; every previous picture of it is a headless Chromium 141 through a vendored stylesheet |
| 2 | `obsidian` | Install a community theme, then read the pane in **both** its light and dark schemes: the status word, the facts slot (`2 plans · EUR`), the foot line and the tick strip | Each is legible against the ground the theme gives it, and the reached cells of the strip are plainly distinguishable from the unreached ones | The one measurement the captures cannot make. Every contrast figure this surface has — `--text-muted` at 6.69:1 light and 8.13:1 dark, the strip's reached-vs-unreached at 6.93:1 light and 4.11:1 dark — is against **Obsidian's default palette**, and a theme replaces every one of those tokens. The strip is drawn from `currentColor` precisely so it follows the theme's text colour rather than a literal, and this is where that claim is checked |
| 3 | `obsidian` | Tab from the top of the pane and keep going: `New project` → the filter → `Continue` → `Open` → the `Projects` list (**one** stop) → the `Completed` `<summary>` → expand it and Tab again into the `Completed` list (**one** stop) → `New asset` | A **visible** focus indicator at every one of those stops, and thirty projects cost **one** tab rather than thirty | §7's tab sequence and §10's per-control rings, together. Obsidian's `:focus { outline: none }` reaches every control here, so each ring is a separate opt-in declaration and each is a place one can be forgotten — only the filter's has ever been photographed. A roving group that lost its clamp has **no** tabbable member at all, silently, for the rest of the mount |
| 4 | `obsidian` | With a ruler or the devtools box model, measure the hit target of a project row, the `Completed` `<summary>`, and the Continue row's `Continue` and `Open` buttons | Every one is at or above **24px** | WCAG 2.5.8, which `tests/harness/accessibility.test.ts` explicitly does not grade (jsdom has no rendering engine to measure it). Measured in the substitute browser at row 30px, summary **exactly 24px**, both Continue buttons 30px — exactly is no margin, and a theme that changes `--size-4-6` or the UI font moves it |
| 5 | `suite` | With a row focused, press `↓` and `↑` repeatedly; then type `k`, `i`, `t` | Focus walks the rows and stops at each end; the **first** character is not lost — the filter ends up holding `kit`, with the caret after it | §7's launcher entry, and the reason this pane needs no autofocus. Seeding rather than merely focusing is what stops a user typing `cellar` losing the `c` |
| 6 | `obsidian` | With a row focused, press **`Space`**. Then press `Esc` in the filter with a query in it, and `Esc` again with it empty | `Space` **activates the row** (it navigates) and does **not** put a space in the filter. The first `Esc` clears the query with the caret still in the field; the second moves focus to the first row | §7's `Space` carve-out. A row is a `<button>` whose native activation is `Enter` *and* `Space`, and jsdom dispatches no native activation at all — so the collision between "printable character" and "activate this button" can only be seen here. Both `Esc` meanings go through one `focusFirstRow`, which is what stops the second one dropping focus to `<body>` |
| 7 | `obsidian` | With a row focused, press **`Mod+↵`** (`⌘↵` on macOS, `Ctrl+↵` elsewhere). Then middle-click a row, then `Mod+click` one. Then `Ctrl+Shift+click` a row | The first three open that project's **`Project.md`** and do **not** navigate. `Ctrl+Shift+click` does **neither** — no note, no navigation | §7's three-arm gesture, and the modifier the legend names. jsdom models no host keymap, so nothing here can say whether Obsidian's own bindings take `Mod+↵` first. Middle-click is the one gesture that fires `auxclick` and never `click`, and Chrome's autoscroll widget is suppressed on `mousedown` because `auxclick` fires after release and is too late. On macOS `Ctrl+click` **is** the secondary-click gesture, which is why any other modifier must fall through to nothing rather than to the navigation |
| 8 | `obsidian` | With a project row focused, press **`Ctrl+P`** (`⌘P` on macOS) | Obsidian's **command palette** opens | The type-to-filter rule swallowing every host shortcut a user presses while a row has focus. The guard is one clause (`altKey \|\| ctrlKey \|\| metaKey`), and this pane is the only place it can be observed |
| 9 | `obsidian` | Open the palette and run **`New project`**. Then open **Settings → Hotkeys**, search for it, bind a key, and press that key | The command appears under its translated name, creates a project through the same dialog the pane's own button opens, and the binding invokes it. The pane's key legend reads **`↵ open · Mod↵ open note`** and names **no** `New project` shortcut | §14's second open decision, answered by registering a real command rather than a pane-local key handler. The legend deliberately stops at two clauses: the command ships with **no default hotkey** — declaring one would claim `Mod+N` on every install over whatever the user already had — and Obsidian's hotkey registry is internal and out of this plugin's reach, so a third clause would advertise either a dead key or a binding this build cannot read |
| 10 | `obsidian` | Open a project, open one of its plans, then return to the pane (back arrow, or reopen it) | A **`Continue`** group is above `Projects`, its row reading **`<project> · <plan>`** with a date, a status and two buttons. **`Continue`** reopens that **plan** in the Plan Editor; **`Open`** goes to the project's detail state instead | §7's whole point, and the distinction A.4 draws. The row names the plan rather than the project alone, which is what makes it answer "which plan will this open" on a project that has several. `FakeLeaf` records asks and runs no view factory, so whether a restored leaf really lands on that plan is a fact about Obsidian |
| 11 | `obsidian` | Quit Obsidian **entirely** and reopen it. Then delete that project's `Project.md` in the file explorer and reopen the pane | After the restart the same `Continue` row is offered and still resumes. After the deletion the `Continue` group is **absent** — no placeholder, no disabled button, no error notice | §14's third open decision, answered by storing **no leaf identity**: the context is `{ projectId, planId }` in Obsidian's own per-device local storage, and it is re-resolved against the project index at every hydrate. If either id misses, the group does not render. A stored leaf id would have restored into a leaf Obsidian had already restored differently |
| 12 | `obsidian` | Switch Obsidian's language to German (**Settings → General → Language**) and reload. Read the list, the filter at rest and while filtering, the `Completed` heading, the no-match sentence and the foot line | Every string is German. The count line reads `1 Projekt` / `{n} Projekte` and the ratio `{shown} von {total}`; the group headings read `Weitermachen`, `Projekte` and `Abgeschlossen (n)`; the no-match line quotes the query in German quotation marks (`„…“`); the legend reads `↵ öffnen · Mod↵ Notiz öffnen`; the foot action reads `Neues Objekt`, **never** `Neues Material` | `tests/presentation/i18n/strings.test.ts` pins that `de.ts` answers every key this surface mints and that each key names the same interpolation holes as its English twin. It renders nothing, and nobody has read this copy in a running app. German is also the binding case for the layout, and the two longest words do different jobs: **`Bestandsdokumentation`** (AS_BUILT, 19.145ch against `Procurement`'s 10.037) is what the 20ch reserved status slot — and through it the 41rem threshold — is sized for, while **`Bestandsaufnahme`** (SURVEY, 15.213ch) is the longest word that appears in the un-collapsed `Projects` group. So the reservation is sized for a word most vaults never see on screen; that is deliberate, and `styles/project-list-narrow.css` records why shrinking it would widen the truncation band rather than narrow it |
| 13 | `browser` | Drag the pane narrow — a sidebar leaf's width, around 460px — and read it in German with the longest name in the list | Each row is **two lines**: the name on the first, `status · facts` on the second reading as one phrase from the leading edge. Rows do **not** overlap. The tick strip is gone. The Continue row wraps with its two buttons at the trailing edge. Nothing runs off the pane | §6's container query, at the width Task 12's captures found four defects at. It is a **container** query on the pane's own width, never a media query on the window, so splitting the workspace is what reaches it. The threshold is **41rem**, derived rather than picked (`styles/project-list-narrow.css` carries the arithmetic and the three ways that derivation can be wrong). This is discharged at 460px in a substitute Chromium already; what a themed vault adds is a different UI font, which moves every `ch` and `rem` in that derivation |
| 14 | `suite` | Type a query that matches nothing | The groups empty and the list region holds the no-match sentence quoting the query, **`Clear filter`**, and **`New project named "<query>"`** — which opens the create dialog with the name **pre-filled**. Pressing either one leaves focus in the **filter**, not on `<body>` | §3's signature interaction: the dead end becomes the fastest path to the thing the user was looking for and did not have. Both actions unmount the block that contains them the instant they succeed, so nothing on either path can move focus afterwards — the repair is a watcher that runs after the removal |
| 15 | `suite` | Move every project note aside so the vault holds none, reload, and open the pane | The empty state draws with its own **`New project`** action, **no header** (there is only one thing to do and the empty state's action already is it), no filter, and the foot line carrying **`New asset`** and **no key legend** | §5's regions 1, 2 and 7 in their empty-state conditions. The legend is omitted here deliberately — there is no list to navigate and no note to open, so it would advertise keys that do nothing — and that omission is a divergence from §5's own region table, ratified in this build's amendment to it |
| 16 | `obsidian` | With the pane open, create a plan in another leaf (or copy a plan note into a project's folder in the file explorer) | The row's plan count **changes** without reopening the pane | §8's freshness commission. `planCount` is invalidated by `PlanCreated` and by `ProjectIndexEntryChanged` for a `renovation-plan` entry; the **deletion** case has no event of its own and rides the entry arm, because `VaultChangeAdapter.announce` runs on `index.remove` as well as on upsert. A file explorer is what drives that second arm, and no fake here has one |

## Acceptance criteria

1. Step 1 draws all seven of §5's regions, in order, in a real leaf.
2. Steps 2 and 4 hold contrast and the 24px floor under a theme this repository has never rendered.
3. Step 3 shows a visible ring at every one of the eight tab stops, and one stop per row list.
4. Steps 5, 6 and 7 give the launcher its keyboard grammar without an autofocus, including the
   `Space` carve-out and the three-arm pointer/modifier vocabulary.
5. Step 8 leaves Obsidian's own shortcuts reachable from a focused row.
6. Step 9's command is in the palette and bindable, and the legend claims no key it cannot honour.
7. Steps 10 and 11 resume the right plan, survive a restart, and disappear rather than dangle.
8. Step 12 renders German everywhere and does not wrap or clip the longest status word.
9. Step 13 wraps rather than overlapping at a sidebar width.
10. Steps 14 and 15 leave focus somewhere a Tab can continue from and offer no control that
    does nothing.
11. Nothing in steps 1–16 renders a number the read model did not supply — no budget, no
    percentage, no cross-project total.

## Deliberately NOT checked

- **The detail state.** Design slice 21 owns it and [[Navigate into a project and back]] walks
  it. This case stops at the gesture that leaves the list.
- **Whether the ten tick cells can be *counted* by a low-vision reader.** That is a judgement no
  instrument here settles. What is checked is that reached and unreached are distinguishable
  (step 2), which is the property the strip is `aria-hidden` for: the status **word** is the
  accessible name and carries the whole meaning, so the strip is an enhancement and never a
  second channel accessibility depends on.
- **Ordering under concurrent writes.** §8 freezes `lastWorked`'s order for the life of the
  mount on purpose, so a background leaf saving a zone must **not** reshuffle the list under the
  user's cursor. Step 16 is about the plan **count**, which is invalidated; the **order** is
  expected to move only on a remount, a rebuild or a create.
- **Colour contrast of Obsidian's own default palette.** Task 12 measured that in a browser and
  fixed what it found. This case is about a *themed* vault, which is the state no capture here
  can produce.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not yet run in a vault.** Every row above is an expectation derived from the design spec, the shipped source and seven headless captures — and those captures were taken with **Chromium 141, not the pinned build**, through a vendored stylesheet carrying Obsidian's default palette only. Nothing on this surface has been seen in Obsidian. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
