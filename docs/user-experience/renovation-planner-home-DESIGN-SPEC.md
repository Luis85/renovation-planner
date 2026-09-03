# Design Specification — Renovation Planner Home (the projects list)

The list state of the **Renovation project** view: the surface a renovator lands on, finds
their project on, resumes it from, and creates the next one on.

Produced with the `impeccable` skill. Visitor mode **Operate**. Structure chosen by the user
from a dealt hand of three (seed `37af950b`, scope `surface`, mode `operate`, dealt indices
3 · 1 · 4); the locked structure is **the launcher**, index 4 of the ordered candidate list.
This document is a design contract. It writes no code and changes no behaviour.

**Not verified against a render.** `node_modules` was empty in the session that produced this,
so `npm run harness-shot` could not run and nothing here was read off a capture. Every
measured figure quoted below is cited to the file that already recorded it. Section 10 names
the captures that must be taken before this ships.

---

## 1. Job and audience

**Who arrives.** The private renovator of `PRODUCT.md` — an Obsidian user planning their own
house, apartment or garden, over months, in their own themed vault. Two arrival states matter
and they are not the same person's mood:

- **The returning renovator**, opening the pane for the fifth Saturday running, who wants the
  thing they were doing and nothing else. This is the majority of every opening after the
  first week.
- **The stranger in an unfamiliar vault** — the marketplace half of the audience, weighted
  equally by `PRODUCT.md` — who has never seen the domain model and must be able to act
  without reading anything.

**Their situation.** A pane, not a page. Obsidian's own `.view-header` is hidden for this view
type (`styles/chrome.css`), so this surface owns its whole title bar and its whole width; the
width is the window minus both sidebars minus whatever is split beside it, and **460px is a
real width**, not an edge case — `styles/forms.css` already records two layout defects found
only at it.

**Mode: Operate.** Expression may never obscure the task, the state or a familiar affordance.
Brand lives in precision here, and the surface's identity is the host's — `PRODUCT.md`'s
brand commitment is that the host's appearance wins, so the visual world is fixed and this
document decides composition only.

---

## 2. Outcome and proof

**Primary task.** Get into the right project, in one gesture, and be able to tell which one is
right before making it.

**Success.** The returning renovator resumes without reading the pane. The stranger, on their
first open, knows what this is and has exactly one thing to press.

**Product-specific truth this surface must carry.** Selecting among projects **is not a
portfolio** — `docs/issues/The vault holds many projects, and selecting one is not a
portfolio.md` decided it, `Project` remains the sole root, SDD §47's index stays per-project,
and nothing here aggregates across projects. This is the sharpest constraint on the design:
every card-grid instinct that wants a cross-project total is refused at the door.

**Proof, and its honesty rule.** `PRODUCT.md` records that no real renovation project, plan,
price or supplier exists. Every fixture in the prototype is invented and labelled as such, and
**no field renders a number the read model cannot supply**. A row that would show
`€42,300 planned · 32% complete` today would be inventing both.

---

## 3. Selected direction

### THESIS

**The pane is a launcher, and its resting state is the home.** The vault's projects are a
result list under a filter that is always present and never in the way; the keyboard is the
primary instrument and the mouse is its equal. It refuses the card grid the category always
ships — doors with metric strips that this product has no honest metrics to fill.

### The three raises this direction was given

The dealt hand's declined challengers each donated one discipline, and each is written into
the composition rather than admired:

- **From teletext — a stated state, never silence.** The filter is not a decorative box: at
  rest it *is* the pane's count line, and typing turns the count into a ratio. A launcher
  whose field says nothing when empty is furniture; this one is the status line at every
  vault size, which answers the direction's own recorded risk that two projects make a search
  field into furniture.
- **From the Crouwel grid specimen — a visible armature.** Result rows align to a real column
  structure, so a keyed jump lands somewhere measured rather than in a soft stack, and the
  trailing facts form a column across rows instead of floating to wherever each name's length
  left them. `styles/forms.css` records that exact defect being found in a capture and fixed
  with `flex-grow` on the name; this direction makes the fix structural rather than incidental.
- **From the sneaker-box wall — the end label is the whole index.** The row must say what it
  is at 460px. Narrow is a designed state with its own composition, never a fallback the wide
  one degrades into.

### FIRST VIEWPORT

Top to bottom, edge to edge:

1. **`Renovation projects`** as an `<h2>`, with **`New project`** on the same line at the
   trailing edge. This heading is load-bearing, not decoration: the leaf's own header is
   hidden, so it is the only title the pane has, and it anchors the heading order the
   accessibility scan checks.
2. **The filter line.** A single input across the pane, quiet at rest, with the count at its
   trailing edge.
3. **`Continue`** — zero or one row, in its own group, present only when a stored context
   resolves to something that still exists.
4. **`Projects`** — every active project, one row each, most recently worked first.
5. **`Completed`** — a collapsed group with its count, holding `COMPLETE` and `AS_BUILT`.
6. **The foot line.** The key legend at the leading edge, `New asset` at the trailing edge,
   both quiet.

### SIGNATURE INTERACTION

**A query that matches nothing offers to become a project.** When the filter excludes every
row, the last thing in the list region is a create action carrying the typed text —
`New project named "Cellar conversion"` — which opens `NewProjectForm` with the name
pre-filled. The dead end becomes the fastest path to the thing the user was looking for and
did not have. This is the direction earning its form: it is what a launcher is *for*, and no
other dealt structure could have produced it.

### FORM

The launcher, index 4 of seven ordered grounded candidates; seed key `37af950b`, dealt
indices 3 · 1 · 4, locked by the user against the leading card. Code-led: no image generation
was available, so the ambition rides in this document and is audited in behaviour.

---

## 4. Scope and boundaries

### In scope

The list state of `RenovationProjectView` in every state it can be in: loading, failed,
partially failed, empty, populated, filtered, and filtered-to-nothing. The Continue
affordance, its persistence and its validation. The row's anatomy and its narrow-pane
composition. The relocation of the `New asset` action. The keyboard model and the focus model.

### Out of scope, and untouched

- **The detail state.** `ProjectDetail`, `ProjectDetailState`, `PlanList` and the plans
  region are design slice 21's and stay as they are. This surface hands off to them and
  learns nothing about them.
- **The navigation mechanism.** Which project is open lives in Obsidian's own view state, the
  view remounts per navigation (`sync`), and `ViewStateResult.history` makes the pane's back
  and forward arrows walk it. Nothing here introduces a second authority for that fact and
  nothing here puts a selection in Pinia.
- **The error-surface policy.** `surfaceFor`, `viewHydrationOrigin` and `ViewFailure` keep
  their present division, including the rule that a `session-failure` is offered no retry.
- **`DialogHost`'s position**, mounted once in `ViewRoot` so a navigation cannot leave a
  dialog with nowhere to open.
- **`ProjectList`'s emit-don't-dispatch division.** The list emits an id; the view decides
  what that means.

### Anti-goals

- **No cross-project number, ever** — no combined budget, no portfolio, no "4 projects,
  €61,000 planned". The decision note above forbids it and this is where it would first
  appear.
- **No project cards with invented metrics.** The A.4 wireframe's `€42,300 planned · 32%
  complete` is not available and is not to be approximated.
- **No status carried by colour.** `PRODUCT.md`'s accessibility section and SDD §85 both
  refuse it, and the concept mocks' own rule — *colour reinforces, it never carries* — is the
  house form of it.
- **No autofocus.** A pane that steals the caret on open hijacks the user's typing. Section 7
  gives the launcher its keyboard entry without it.
- **No modal.** Obsidian's quick switcher is modal; this is a pane and stays one.
- **No plan thumbnails.** That was a different candidate and is not what was locked.

---

## 5. Regions

| # | Region | Present when |
|---|---|---|
| 1 | Header — title + `New project` | status is `ready` **and** the vault holds at least one project |
| 2 | Filter line | status is `ready` **and** the vault holds at least one project |
| 3 | `Continue` group | a stored context resolves to a project that still exists |
| 4 | `Projects` group | at least one project is not `COMPLETE`/`AS_BUILT` and passes the filter |
| 5 | `Completed` group | at least one project is `COMPLETE`/`AS_BUILT` and passes the filter |
| 6 | Partial-read notice | `unreadable > 0` |
| 7 | Foot line — key legend + `New asset` | always, including the empty state |
| — | Empty state | status is `ready`, no projects, nothing unreadable |
| — | Failure | status is `failed` |
| — | Loading | status is neither |

Regions 1–5 do not render during loading or failure. Region 6 is **additive** and sits above
the groups, never replacing them — a partial read still shows what loaded, which is the rule
`ViewRoot` already keeps.

**Region 1 is absent from the empty state, and that is a ruling rather than an omission.** The
empty state's own action already *is* `New project` — it is the verb of its sentence, per slice
14's registry — so a header carrying a second one puts two identical actions on a pane that has
exactly one thing to do. The vault-holds-at-least-one-project condition on regions 1 and 2 is
what states this; an implementation has one authoritative behaviour and there is no state in
which both buttons render.

Region 7 is present in **both** the empty state and the populated state, which is the change
that removes today's duplication: `ProjectList`'s header button and `ViewRoot`'s
`.rp-view-aside` are two independently-decided homes for one action, and they become one.

---

## 6. The row

### Anatomy

```
┌─────────────────────────────────────────────────────────────────────────┐
│ House Renovation 2026            2 plans · EUR   Design ▪▪▪▫▫▫▫▫▫▫      │
└─────────────────────────────────────────────────────────────────────────┘
  ├─ name ─────────────────────┤  ├─ facts ──────┤  ├─ status ──────────┤
     grows, truncates, title=      fixed, drops     never shrinks
                                   first at narrow
```

Reading order and flex behaviour, in one sentence each:

- **Name** — `--text-normal`, takes all slack (`flex-grow: 1; min-width: 0`), truncates with
  an ellipsis and carries the full name in `title`. It is the half that gives way; this is
  already the shipped rule and the reason for it is recorded in `styles/forms.css`.
- **Facts** — `--text-muted`, `--font-ui-smaller`, `flex-shrink: 0`. The extensible slot;
  section 8 governs what may appear here.
- **Status** — word plus mark, `flex-shrink: 0`, always last, never truncated.
- **Warning** — the §83 library-overlap marker, unchanged from
  `styles/project-list-overlap.css`: a drawn triangle plus a translated sentence, at full
  weight, never the item that shrinks. When present it sits after the status.

### Status: a word and a position

`ProjectStatus` has **ten** members, and they are a lifecycle arc rather than a flat category
(`IDEA → SURVEY → DESIGN → ESTIMATE → PROCUREMENT → READY → EXECUTION → INSPECTION →
COMPLETE → AS_BUILT`). A badge treats them as ten unrelated labels and throws away the one
fact a renovator actually wants: how far along this is.

**The status renders as the translated stage word plus a ten-step tick strip** — ten cells
drawn from `currentColor`, cells up to and including the current stage at `--text-normal`,
the rest at `--text-faint`. No hue, so a themed vault keeps its theme and no colour literal
enters the sheet. The strip is `aria-hidden`; the word is the accessible name, in full, so
the strip is an *enhancement* and never the second channel a11y depends on — the word already
is that channel.

**The strip is dropped at narrow.** The word alone is complete and conformant, so nothing is
lost; a ten-cell strip in a 460px row is the ceremony this direction's own recorded risk warns
about.

An unrecognised status renders as its raw value with no strip — the fallback `statusLabel`
already implements, for a note this build cannot fully make sense of.

### Narrow composition (container query)

Below the pane width at which the one-line row can hold name, facts and status without the
name truncating past readability, the row becomes **two lines**:

```
┌───────────────────────────────────┐
│ House Renovation 2026             │
│ Design · 2 plans · EUR            │
└───────────────────────────────────┘
```

A **container query**, never a media query. This is a measured finding of this project, not a
preference: the concept mocks record that the editor's width is its pane's, so a media query
asks the wrong element. The threshold is chosen from a capture at 460px, not from a round
number.

German is the binding case for the threshold: `Bestandsaufnahme` (SURVEY) is 16 characters
against `Survey`'s 6, and the concept mocks already measured German labels deciding a rail's
width. A threshold validated only in English is not validated.

---

## 7. Interaction

### Pointer

- A row press **navigates** into the detail state — `context.navigate(id)`, unchanged from
  design slice 21. A row does not open `Project.md`; that is the detail header's `Open note`.
- The whole row is the target. Hit height is at or above WCAG 2.5.8's 24px floor
  (`--size-4-6`, already the shipped value), and the two-line narrow row exceeds it.
- Middle-click and modifier-click open the project's note, matching the keyboard accelerator
  below. Undiscoverable on their own — the key legend is where they are discovered.

### Keyboard

The launcher's grammar, without the autofocus that would make it hostile:

| Key | Where | Does |
|---|---|---|
| any printable character | list has focus | moves focus to the filter and seeds it with that character |
| `↓` / `↑` | filter or list | moves DOM focus through visible rows |
| `↵` | a row | opens the project (navigate) |
| `Mod+↵` | a row | opens the project's note |
| `Esc` | filter, with a query | clears the query, focus stays |
| `Esc` | filter, empty | returns focus to the first row |
| `Mod+N` | anywhere in the pane | opens `New project` |

**Roving `tabindex` applies to the row lists and to nothing else.** Its purpose is to bound an
*unbounded* set, not to minimise stops: a vault of thirty projects must not cost thirty tabs to
walk past, and everything else on this surface is a small bounded set that has no such problem.

So the tab sequence, in DOM order, is every independent action plus one stop per row list:

`New project` → the filter → `Continue` → `Open` → the `Projects` list *(one stop, arrows
move within it)* → the `Completed` `<summary>` → the `Completed` list, when expanded *(one
stop)* → `New asset`.

In the filtered-to-nothing state the two list stops are replaced by `Clear filter` and
`New project named "…"`, which are ordinary stops like any other action.

**Every visible control is reachable by Tab alone.** `Mod+N` and the arrow keys are
accelerators over that sequence and never a substitute for part of it — a control reachable
only by a shortcut fails `PRODUCT.md`'s full-keyboard-support requirement, which this document
binds itself to. An earlier draft of this section said "three tab stops, not thirty" and was
exactly that failure: it left the header's `New project`, the `Completed` `<summary>` and both
Continue actions off the sequence while the same document promised a visible focus indicator at
every stop.

The Continue row's two actions are ordinary tab stops rather than members of a roving group,
which is the other half of why that row sits **outside** the `Projects` list rather than at the
top of it: a roving list whose first item contains two of its own controls is the composite
that would force a grid pattern onto everything below it.

Rows stay ordinary `<button>` elements. A `role="listbox"` was considered and refused: a
listbox option may not contain its own controls, and the row's facts and warning are content
a listbox would flatten into one string. Roving `tabindex` over buttons gets the same
navigation with none of that cost.

### The filter

- Matches the project **name** only. Substring, case- and diacritic-insensitive
  (`Intl.Collator` at `sensitivity: 'base'`, seeded from Obsidian's `getLanguage()` — a German
  vault must match `Küche` when the user types `kuche`).
- The matched run in each name renders at `var(--font-semibold)`. **Weight, not colour** —
  the house rule applied to a highlight, and a second channel by construction.
- Filtering **does not animate**. Rows appear and disappear immediately. A reordering
  animation over thirty rows is noise that costs frames and tells the user nothing.
- The count at the line's trailing edge is the state: `4 projects` at rest,
  `2 of 4` while filtering. It is a `role="status"`, announced politely, and the announcement
  is debounced so a five-character query announces once rather than five times.
- The query is **not persisted**. It resets on remount, which is every navigation.

### Continue

`Continue` is a row in the same armature as every other row, distinguished by its group
heading and by carrying a **second action** — never by being a different shape. A raised card
above a flat list is the composition this direction did not lock.

```
Continue
┌─────────────────────────────────────────────────────────────────────────┐
│ House Renovation 2026 · Kitchen › Work        14 Aug   [Continue] [Open]│
└─────────────────────────────────────────────────────────────────────────┘
```

- **`Continue`** restores the stored leaf state. **`Open`** always opens the project's detail
  state, which is A.4's own distinction and the one thing the usability script in
  `renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md` §13 is written to test.
- **The group renders only when the stored context resolves to something that still exists.**
  With no stored context, or one pointing at a deleted project or plan, the group is *absent*
  — not a placeholder, not a disabled button. The most-recently-worked project is then simply
  the first row of `Projects`, which is where it would be anyway. This is what removes the
  Continue-first structure's recorded risk without adopting its composition.
- The project also appears in `Projects` below. A duplicate is correct here: `Continue` is an
  action, `Projects` is the index, and hiding a project from the index because it happens to
  be resumable makes the index lie.
- Validation is a **read**, not a subscription: resolve the stored ids against the project
  index at hydrate time, and if either misses, the group does not render. Nothing redirects,
  nothing announces, nothing is retracted later.

---

## 8. Content, and what may be shown

The governing rule, from the confirmed brief: **the row must look complete today, not like a
card with holes.** A slot with nothing in it renders nothing — no dash, no `—`, no skeleton,
no "not yet calculated". Its neighbours close up.

### Available now, from `ProjectSummaryDto`

`id`, `name`, `status`, `currency`, `libraryOverlap`. The currency is display-only and already
carries a locale key (`view.project.currency`).

### Commissioned by this spec

Two fields, both cheap, both truthful, both required before this surface can be built as
specified:

1. **`planCount: number`** — how many plans this project has. The project index already
   indexes plan notes and already knows their project; this is a count over data in memory.
   Renders in the facts slot as `2 plans`. It is the fact that makes a row say something
   beyond its own name, and it is the one that tells a stranger what a project even contains.
2. **`lastWorked: string | null`** — ISO date, the most recent modification time across the
   project's own notes, taken from `TFile.stat.mtime` on paths the index already holds. It
   **orders the list** and it is what `Continue` dates itself by.

Both are facts about the read that produced them, exactly like `libraryOverlap`, and both are
**required rather than optional** on the DTO for the reason `libraryOverlap`'s own docblock
gives: an absent field and a zero read identically at the site that renders them, so every
producer states the answer.

`lastWorked` renders as an **absolute short date** via `Intl.DateTimeFormat(language,
{ dateStyle: 'medium' })`, not a relative time. Relative time needs a live ticker, makes every
test time-dependent, and `Last opened yesterday` is a wireframe's nicety rather than a
requirement.

#### Freshness is part of the commission, and the two fields answer differently

A field the surface never re-reads is a field that lies. `createProjectListChangeSource`
today subscribes to `ProjectIndexRebuilt` and `ProjectCreated`, and admits
`ProjectIndexEntryChanged` **only** where the changed entry's `entityType` is
`renovation-project` — so a plan created in another leaf, or a plan note arriving through
sync, reaches the index and not this list. Commissioning the two fields without commissioning
their invalidation would ship a count and an order that go stale in ordinary use.

The filter is not the bug, and widening it wholesale would be. That module's own docblock
records why it exists: without it "a synced plan or a burst of zone notes would make this view
re-read every project note in the vault, once per note". The two fields therefore get two
different answers, and the difference follows from what each one is:

- **`planCount` is invalidated by events.** Add `PlanCreated` and `PlanDeleted` to the
  category list, and admit `plan` beside `renovation-project` in the entry filter. Bounded on
  purpose: a project has a handful of plans and a user creates them one at a time, so this is
  nothing like the zone burst the filter was written against. Zones, assets and requirements
  stay excluded, and a builder may not widen the filter past `plan` to make some other number
  work.
- **`lastWorked` is captured at hydrate and the order is frozen for the life of the mount.**
  It moves on *every* write to *any* owned note, which is precisely the burst no subscription
  should carry — and re-sorting a list under a user's cursor because a background leaf saved a
  zone is worse than a date that is a few minutes old. The view remounts per navigation, so
  returning from a project re-reads and re-orders; a rebuild and a create already re-read
  through the existing subscription. **Ordering must not change without a re-mount or one of
  those events**, which makes the staleness bounded and visible rather than a race.

This is the one place the spec asks for a change to an existing application-layer module. It is
named here so it is scheduled with the fields rather than discovered by whoever builds the row.

### Reserved, and not to be invented

The facts slot is specified to receive, in this order, when and only when a query supplies
them: **planned budget** and **planning progress**. Both are `Project dashboard and
navigation`'s V1 outcome. Until a per-project query exists that derives them from real
requirements and real costs, they render nothing at all. A builder may not approximate either,
and may not add a third fact to this slot without amending this document.

### Ordering

`lastWorked` descending; ties and nulls fall back to name ascending through the same
`Intl.Collator`. Stable, so a re-hydrate never reshuffles equal rows.

`Completed` (`COMPLETE`, `AS_BUILT`) is a separate collapsed group at the foot with its count
in the heading, collapsed by default, its expanded state **not persisted**.

---

## 9. States

| State | What the pane draws |
|---|---|
| **Loading** | The existing centred `.rp-view-message` line. No header, no filter, no foot line. |
| **Failed (retryable)** | `ViewFailure` with the mapped sentence for the error's own code and `Try again`. |
| **Failed (session)** | `ViewFailure` with no retry — re-running a query that was never wired is the live control that does nothing. Unchanged from slice 17. |
| **Empty** | The `renovationProject.noProjects` empty state with its action, **plus the foot line** so a fresh vault can still build a catalogue. No header, no filter. |
| **Partial read** | The `.rp-view-notice` strip above the groups, additive; the list draws every project that loaded. |
| **Empty list, unreadable > 0** | The list header and its groups draw with no rows, beside the notice. Never the "no projects yet" empty state — `selectRenovationProjectEmptyState` already answers `null` here, and this surface keeps that. |
| **Filtered to nothing** | Groups are empty; the list region holds the no-match line and two actions: `Clear filter`, and `New project named "<query>"`. |
| **One project** | Everything renders. The filter is present and states `1 project`; it is the count line, so it has a job at every vault size. |

**Ranges to design and prototype against:** 0, 1, 4 (typical), 30 (the stress case for tab
stops, ordering and scroll), and one project whose name overruns the pane at 460px — the
fixture that already found two defects in this surface.

---

## 10. Visual contract

The visual world is **fixed and inherited**. It is not open for this surface, and this section
states only what follows from it.

- **Every colour is an Obsidian variable.** `scripts/styles-assemble.mjs` fails the build on a
  literal at any nesting depth, a bare colour word included. No exceptions and no
  custom properties holding literals.
- **The accent appears only where WCAG 1.4.11's 3:1 non-text threshold is the applicable
  bar** — which on this surface means focus rings and nothing else.
- **`New project` is not a filled accent button.** `--text-on-accent` over
  `--interactive-accent` measures **3.43:1** in Obsidian's light default, under AA for text.
  Primacy is carried by position and weight, and Obsidian's own default button styling is what
  it wears. This is a measured ruling, not a preference, and it is the single most likely thing
  for a builder to get wrong by reflex.
- **Focus rings are stated per control**, `2px solid var(--interactive-accent)`, because
  Obsidian's global `:focus { outline: none }` reaches every control and its own
  `:focus-visible` shadow measures **2.29:1** dark and **1.88:1** light — both under the 3:1
  floor. Offset is positive on inset controls and negative on edge-to-edge rows, which is the
  distinction `styles/forms.css` already draws.
- **Every rule that competes with Obsidian's `button:not(.clickable-icon)` is written with a
  descendant selector.** That rule is (0,1,1) and sets `background-color`, `color` and
  `box-shadow`; a single class is (0,1,0) and loses silently.
  `tests/build/buttonSpecificity.test.ts` refuses the loss.
- **One spacing rhythm**, on Obsidian's own `--size-*` scale, with more space above a group
  heading than below it.
- **Motion**: the row's hover and focus background, and nothing else. No list transitions, no
  entrance animation, and whatever exists respects `prefers-reduced-motion`.

**No `<style>` block, ever.** `vue/no-restricted-block` fails one. Rules go in a `styles/`
partial, imported from `index.css`, under the 400-line cap.

---

## 11. Accessibility

Binding target **WCAG 2.2 AA**, per `PRODUCT.md`.

- **Heading order**: `<h2>` for the pane title, `<h3>` for each group heading — the level
  `ProjectDetail` already uses for an embedded region, so the two surfaces agree.
- **The filter input has a real accessible name** through a visually-hidden `<label>`. A
  placeholder is not a label and does not become one.
- **The count is `role="status"`**, polite, debounced.
- **A row's accessible name is its whole text** — name, facts, status word, warning — because
  all of it is the button's own content. The tick strip is `aria-hidden` and adds nothing.
- **The `Completed` group is a native `<details>`/`<summary>`** with its count in the summary,
  so disclosure state is announced by the host rather than reimplemented with ARIA.
- **A visible focus indicator at every stop**, including the rows the roving `tabindex`
  reaches, per the product's own canvas-derived requirement.
- **No status by colour alone**, at any breakpoint, including the one where the tick strip is
  dropped.

**What no gate here can check, and where it is checked instead.** `tests/harness/accessibility.
test.ts` scans `contentEl` in jsdom: it cannot measure contrast, focus visibility or hit-target
size, and it does not reach a `Notice`, which renders on `document.body`. Contrast, the focus
ring's visibility and the 24px floor are verified in a live vault via `npm run test-build`,
and the manual case owed by this surface is where they are written down.

---

## 12. Localization

Every string resolves through `t(language, key, params?)`. English is the complete table and
derives `StringKey`; German is partial and falls back per string. `en.ts` is linted for
sentence case; German noun capitalization sits outside that rule.
`tests/presentation/i18n/strings.test.ts` checks that a key's German translation names the
same interpolation holes as its English one, so every `{param}` below must appear in both.

**Keys owed by this surface.** Existing: `view.project.list-title`, `view.project.create`,
`view.project.currency`, `view.project.library-overlap`, `view.project.some-unreadable`,
`view.project.loading`, `view.project.failed.headline`, `view.session-failure.headline`,
`view.failure.retry`, `view.asset.create`, and the ten `form.new-project.status.*` labels.

New:

| Key | English |
|---|---|
| `view.project.filter.label` | Filter projects |
| `view.project.count-one` | 1 project |
| `view.project.count-many` | {count} projects |
| `view.project.filter.matches` | {shown} of {total} |
| `view.project.filter.none` | No project matches “{query}”. |
| `view.project.filter.clear` | Clear filter |
| `view.project.create-named` | New project named “{query}” |
| `view.project.group.continue` | Continue |
| `view.project.group.projects` | Projects |
| `view.project.group.completed` | Completed ({count}) |
| `view.project.continue.resume` | Continue |
| `view.project.continue.open` | Open |
| `view.project.plans-one` | 1 plan |
| `view.project.plans-many` | {count} plans |
| `view.project.keys` | ↵ open · {mod}↵ open note · {mod}N new project |

**`t` has no plural machinery**, so a count that can be one gets **two keys** and the component
picks by `count === 1`. English and German are both two-form languages, so this is complete for
the current locales and is the point at which a third locale would force a real plural
mechanism — recorded here so that arrival is a decision rather than a discovery.

`{mod}` is `⌘` on macOS and `Ctrl` elsewhere, resolved at the call site, never baked into a
locale string.

**The status tick strip must not be described in words anywhere**, because the word beside it
already is the description; a locale string like "stage 3 of 10" would be a second name for
the same fact and would drift from the enum.

---

## 13. Constraints a builder must not invent

1. **Where the Continue context is stored.** It is **plugin-local, not vault data**, and it
   does **not** go in a project note: writing a visit into a note makes opening a project dirty
   the vault and produces a sync conflict between the desk and the site. It also does not go
   through `settingsFrom`, which is a trust boundary that drops keys this version does not
   declare. It needs its own persisted key in the plugin's own data, with its own parse-and-
   fall-back-to-absent rule, and it is **device-local** — a consequence worth stating plainly:
   Continue does not follow the vault to the phone.
2. **`lastWorked`'s exact derivation.** "Most recent mtime across the project's own notes" is
   the intent; whether that means every indexed note or only `Project.md` is a cost question
   for whoever holds the index, and it must be decided once, in the query, not per caller.
3. **The narrow threshold's value.** It comes from a capture at 460px with the German status
   words in place, not from a round number.
4. **Nothing writes to the vault outside `infrastructure/`**, and `presentation/dialogs/` may
   not import `application/`, `infrastructure/`, `plugin/` or the event bus. The layer bans are
   lint, not convention.
5. **The `New asset` action's exit condition**: it leaves this surface when Epic 6's catalogue
   surface exists, which is where a creation action for a vault-wide catalogue entry belongs.
   Until then it is here, quiet, at the foot, in one place rather than two.

---

## 14. Open decisions

- **Does the filter also match the status word?** Typing `design` finding every project in the
  Design stage is useful and is one line; it also makes the count ambiguous about what matched.
  Recommended: name only for now, and revisit when a vault has enough projects for stage
  filtering to be the faster path.
- **`Mod+N` may collide with a user's own hotkey.** Obsidian binds hotkeys to command ids;
  a pane-local key handler does not go through that registry and cannot be rebound. Either
  register a real command for `New project` and let the legend read whatever the user bound,
  or drop the accelerator. Recommended: register the command — it also puts the action in the
  palette, which is where the stranger looks.
- **Whether `Continue` survives an Obsidian restart.** The stored leaf state is durable; the
  *leaf* is not. Restoring into a leaf Obsidian has already restored differently is a
  behaviour question this document does not settle.

---

## 15. Build order

Nothing here is built by this document. When it is:

1. **Prototype first**, in `src/prototypes/`, against the real assembled stylesheet — the
   standing requirement `Prototype a screen in the harness before it is built`. A
   template-only mock composing the real row is enough to answer the layout questions.
2. **Capture and look.** Two commands, and they are not interchangeable:

   - `npm run harness-shot` — the fixed set, which already includes the project surface in
     both schemes plus `?phone`.
   - `npm run harness-shot prototype:<id> -- --width=460` — the narrow capture. **The entry id
     is required**: `resolveShots` throws `--width applies to a named entry, and the fixed
     shots carry their own` for a bare `--width`, and the `--` separator is required because
     npm otherwise claims the flag as its own config and captures at the default width
     silently, with two PNGs written and exit 0.

   The narrow capture is the one that matters here and `?phone` does not substitute for it:
   `?phone` is a **body class**, answering what the plugin does when it believes it is on a
   phone, while section 6's narrow row is a **container query** on the pane's own width. They
   are different questions and only the second is this surface's.

   Spacing, wrapping, overflow, hit size and the tick strip's legibility are measurements no
   gate in this repository performs; a capture read by eye is the only instrument that reaches
   them. Every layout defect this surface has ever had was found this way and by nothing else.
3. **Commission the two DTO fields** before the row is built to this spec, so the row is never
   built against placeholders it then has to be rebuilt around.
4. **Write the manual case** for what only a live vault can verify — contrast, the focus ring,
   the 24px floor, `Mod+↵`, and whether `Continue` restores what it claims — and run it in
   `npm run test-build`.
5. **Then** the impeccable finish pass: build, one batched inspection round at both widths,
   one fix batch, one confirming round, and stop.

---

## Sources

`PRODUCT.md`; `docs/user-experience/renovation-project-workspace-UXD.md` §§2, 3, 7, 8, 21,
23, 24; `renovation-project-workspace-wireframes.md` A.4;
`renovation-project-workspace-PROTOTYPE-DESIGN-SPEC.md` §§8, 11, 12, 13;
`docs/user-experience/concepts/README.md` (the contrast findings, the weight ladder, the
container-query finding, and the *colour reinforces, it never carries* rule);
`docs/requirements/The project surface.md`;
`docs/issues/The vault holds many projects, and selecting one is not a portfolio.md`;
`src/presentation/views/ProjectList.vue`, `ViewRoot.vue`, `ProjectDetail.vue`,
`statusLabel.ts`, `projectStatusLabels.ts`; `src/presentation/read-models/PlanDto.ts`;
`styles/forms.css`, `list-row.css`, `project-list-overlap.css`, `view.css`, `chrome.css`,
`empty-state.css`, `editor.css`; SDD §§47, 60, 84, 85.
