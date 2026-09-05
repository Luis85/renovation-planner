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

**Amended 2026-09-04, after the surface was built.** The captures section 10 asked for exist —
seven fixed shots, `home-stress`, `home-stress-light`, `home-stress-de`, `home-whole`,
`home-stress-narrow`, `home-no-match-narrow` and `home-filter-focus` — and reading them found
defects no gate could see, three of which changed sentences in this document.
**`docs/tests/cases/Find and resume a project.md` enumerates them and is the only place that
does**: this paragraph carried a COUNT and that case carried a LIST, they disagreed by one in
the commit that wrote both, and the missing one was the resting filter field — which is
precisely what that case's step 1 sends a runner to inspect. A number and a list of the same
thing in two documents is a disagreement waiting to happen; there is one list now. Every
amendment below carries its date and says what it replaced rather than overwriting it, because
a criterion that quietly keeps its old wording is how the gap between promise and check
reopens. **Two limits ride with every measured figure quoted here**: those captures were taken
with a **substitute Chromium**, not the pinned build, and through a stylesheet carrying
Obsidian's **default** palette only. Nothing in this document has been seen in Obsidian, and
`docs/tests/cases/Find and resume a project.md` is the instrument for what that leaves — it is
written and **has not been run in a vault**.

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

  **Amended 2026-09-04, and NARROWED to what ships.** The sentence above described a promise
  that the first eleven tasks did not keep: exactly one edge aligned across rows — the tick
  strip's right edge, and only because it is last in a right-packed cluster — so `4 plans · EUR`,
  `EUR` and `One plan · EUR` each began and ended wherever that row's own name length left them,
  and so did every status word. Task 12's captures are where that was finally seen; Task D closed
  the part of it that CSS can close, and this is the honest account of the rest.

  **What aligns.** On the wide row, the facts slot and the status word each carry a reserved
  `min-width` in `ch`, measured against the longest string in that slot across `en.ts` and
  `de.ts` and recorded at the rule. So four edges are columns: the facts slot's left edge, every
  facts string's right edge, every status word's right edge, and the tick strip's right edge —
  the outer rule, which it already was. Measured on the built surface at 1280, in both locales:
  one distinct x for each of those four, across every unmarked row.

  **What does not, and why the full promise was refused.** The NAME is not a column; it takes
  the remaining slack and truncates with an ellipsis, which is the shipped division `forms.css`
  argues for. A row carrying PRD §83's library-overlap marker is outside all four columns,
  because the marker takes the tail — already true of the strip before this. And at NARROW there
  are no columns at all: the row is two lines and the reservation is released, because a column
  armature across wrapped rows aligns nothing a reader can follow.

  **The Continue row is outside the columns too**, and that is the one exception a reader is most
  likely to meet, because it sits directly above them. Its tail is two buttons rather than a tick
  strip, so there is no width it could reserve that would put its status where the list's is:
  measured in the shipped capture at 1280, its status word ends at x=1115 against the column's
  1210 — **95px off**. Its date lands within a pixel of the facts column, and that is this
  fixture's coincidence rather than an alignment. §7 already says that row is "in the same
  armature as every other row, distinguished by … carrying a second action"; that is true of its
  padding, its height and its name, and it is not true of these columns.

  Two remedies were rejected, and the reasons matter more than the choice:

  - **A grid across the list** (`display: grid` on the `<ul>`, rows `display: contents`) is the
    only CSS that sizes columns to the widest content ACROSS ROWS with no magic number — and it
    requires destroying the row's own box. The row is a `<button>`; `display: contents` takes its
    background, its hover, its focus ring and its hit target with it, and the whole keyboard
    model rests on that button being a real box.
  - **Fixed pixel widths per slot** are brittle in exactly the direction this surface already
    pays for: German status words are far longer than English, which is why the container
    threshold was measured in German rather than guessed. `ch` scales with the font the host
    gives us, for the same reason the threshold is in `rem`.

  **What the reservation costs, measured rather than predicted.** Every row now occupies the
  widest row's trailing width, so the container threshold rose from 36rem to 41rem and one
  50-character name in the 30-row stress fixture truncates from 657px to 715px where before it
  truncated at no width at all. One row of thirty, in a 59px band, degrading as a long name is
  designed to degrade. It is a band rather than a cliff: at its tightest width the second-longest
  name has 117px of headroom. `styles/project-list-narrow.css` carries the derivation, and states
  why shrinking the reserved slot would WIDEN that band rather than narrow it.
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
| 1 | Header — title + `New project` | status is `ready` **and** the empty state does not apply |
| 2 | Filter line | status is `ready` **and** at least one project loaded |
| 3 | `Continue` group | a stored context resolves to a project that still exists |
| 4 | `Projects` group | at least one project is not `COMPLETE`/`AS_BUILT` and passes the filter |
| 5 | `Completed` group | at least one project is `COMPLETE`/`AS_BUILT` and passes the filter |
| 6 | Partial-read notice | `unreadable > 0` |
| 7 | Foot line — key legend + `New asset` | status is `ready`, including the empty state |
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
`.rp-view-aside` are two independently-decided homes for one action, and they become one. It is
**not** present during loading or failure, and an earlier draft of this row said `always`, which
contradicted §9's own loading row two sections down. `ready` is what it always meant: a foot
line under a `ViewFailure` would offer to create a catalogue entry in a session that could not
read the vault, and one under a loading line would be the only thing on screen.

**Amended 2026-09-04 — the empty state's foot line carries `New asset` and NOT the key
legend, and the region table's `key legend + New asset` was true of one of its two states.**
The row above names both halves and the condition says "including the empty state", which
read as a promise that both halves appear in both. They do not, and the build is right: in the
empty state there is no list to arrow through and no note to open, so a legend reading
`↵ open · Mod↵ open note` would advertise two keys that do nothing on the one screen whose
whole job is to say there is exactly one thing to do — which is the live-control-that-does-
nothing failure slice 14's own amendment refuses, in copy rather than in a button.

So region 7 is **one region with two compositions**: `New asset` in both, the key legend only
where there are rows for those keys to act on. Stated here rather than left in
`ViewRoot.vue`'s comment alone, because a divergence from a region table that lives only in
the code it diverges from is a divergence no reader of this document can find.

**Nothing asserted the absence until this amendment, which is what made the divergence
invisible from both ends.** The populated foot's legend has a case; the empty foot had one for
`New asset` and nothing at all about the half it drops, so a build that started drawing the
legend there would have made this paragraph wrong with every test green.
`viewRootCreateAsset.test.ts`'s empty-vault case pins it now, watched failing against a planted
legend. What is still checked by nothing is the sentence-to-markup direction — no gate reads
this table.

**Regions 1 and 2 have different conditions, and the difference is the unreadable-only state.**
Region 1's condition is the *empty state*, not the project count, because what it exists to
prevent is two identical `New project` actions on a pane with one thing to do — and the empty
state is precisely what `selectRenovationProjectEmptyState` declines when `unreadable > 0`. So a
vault whose only projects are ones this build cannot read draws the header: there is no second
`New project` to collide with, and creating one is a real thing to do. Region 2 is conditioned on
a project having *loaded*, because a filter over nothing is furniture and its count line would
have to read `0 projects` about a vault that demonstrably holds some — a false statement in the
one region whose whole job is to state the truth about how many there are.

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
drawn from ~~`currentColor`~~ **two named Obsidian tokens (amended 2026-09-04)**, cells up to
and including the current stage at `--text-normal`, the rest at `--text-faint`. No hue, so a
themed vault keeps its theme and no colour literal enters the sheet.

**Amendment 2026-09-04 — `currentColor` was the MECHANISM this section named and it cannot
deliver the two states the same sentence asks for.** The original wording said both things at
once, and only one of them survives contact with the cascade: `currentColor` resolves to a
single inherited colour, so it produces the strip's SHAPE and not its reached/unreached
distinction. These cells sit inside `.rp-project-list__status`, which `forms.css` sets to
`--text-muted`, so an inheriting strip would draw every cell that one muted grey and a reached
cell would have to be told apart by an opacity — dimmer than the `--text-normal` this section
asks for at one end, bearing no relation to `--text-faint` at the other, and measured at
**1.50:1** in dark by the table two paragraphs down. `styles/project-list.css` names the two
tokens directly and states the refusal where the code is.

**The PROPERTY this section was reaching for still holds, which is why this is an amendment and
not a retraction**: a `var()` on an Obsidian token is exactly what SDD §84's colour check asks
to see, so no literal enters the sheet and the strip follows the theme either way. The gate is
not what decides between the two spellings; the two states are. The strip is `aria-hidden`; the word is the accessible name, in full, so
the strip is an *enhancement* and never the second channel a11y depends on — the word already
is that channel.

**The strip is dropped at narrow.** The word alone is complete and conformant, so nothing is
lost; a ten-cell strip in a 460px row is the ceremony this direction's own recorded risk warns
about.

**Amended 2026-09-04 — the cell SIZE, which this section never stated and which decided whether
any of the above was readable.** It shipped at 3px cells with 1px gaps and the first picture of
it read as one filled bar: a proportion, which is the one thing this section argues the strip is
not. It is 4px at a 2px gap now (58px against 39px), and the ten cells can be counted in both
schemes. Ten stays: five larger cells would read better and would be a lie about the arc.

**Raising the unreached cells to `--text-muted` was proposed for the same finding, built, and
measured worse.** The argument was that `--text-faint` measures 2.30:1 on the light scheme and
this branch had just deleted it from the foot line for that. What it misses is which distinction
matters: the unreached cells are a track, and what a reader has to see is reached AGAINST
unreached. Measured in a real browser — `--text-faint` gives 6.93:1 light and 4.11:1 dark for
that distinction; `--text-muted` gives 2.38:1 and **1.50:1**, which is not a difference, in
Obsidian's own default scheme. The cell-size fix is what actually closed the finding. The two
tokens this section names are what ships; `styles/project-list.css` holds the full table.

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

**Amended 2026-09-04 — the threshold is `41rem`, and the two sentences above each need one
correction.** It is not *chosen from a capture at 460px*: 460 is the width the row is
INSPECTED at, and a threshold read off one capture is a number somebody picked. It is
DERIVED, from a rule stated with the rule — *the name must keep at least as much room as the
trailing group beside it* — over a trailing group of **314.5px**, giving
`W ≥ 16 + 8 + 2 × 314.5 = 653px → 40.8rem → 41rem`.

**That 314.5 is the ARITHMETIC total of the reserved components, not a measurement — and this
amendment's own first draft said "measured on the built surface at 314.5px".** The two numbers
are close and they are not the same claim: the components sum to 314.5px (a 12ch facts slot,
an 8px gap, a 20ch status word, a 4px gap and a 58px strip, at `1ch = 7.641px`), while the
trailing group **measured** on the built surface at 1280 is **314.30px in both locales**, the
0.2px being `ch` rounding. `styles/project-list-narrow.css` records both and treats the
measurement as a CHECK on the sum rather than as its source. Corrected rather than smoothed
over, because two paragraphs below this one the same amendment makes *"count characters to make
the argument and MEASURE to size a slot, because the two numbers are not the same one"* its own
lesson — and then broke it, about the very number that lesson multiplies into the threshold.

`styles/project-list-narrow.css` carries the arithmetic, and **three** cases in
`projectListNarrowStyles.test.ts` hold it: every recorded sum must balance, the derivation's
final `→ Nrem` must equal the container query's own number, and **the number THIS DOCUMENT
states — here and again at §13's constraint 3 — must equal it too.** That third one is the
reason a reader can trust the `41rem` in this sentence: until it existed, the spec stated the
threshold a third time and nothing compared it to anything, on a number that has already moved
three times and been transcribed by hand into a document no gate reads. It is the first test in
this repository's suite that reads `docs/`, and its own docblock states the rule that bends and
why a design contract is not the fixture that rule was written about.

**And the German example is the wrong one, in the direction that makes the argument bigger.**
The longest German status word is not `Bestandsaufnahme` but **`Bestandsdokumentation`**
(AS_BUILT, **21** characters against `As built`'s 8). `Bestandsaufnahme` is merely the longest
that appears in the **`Projects`** group, AS_BUILT living in the collapsed `Completed` one —
which is a distinction worth keeping, because the reserved status slot is sized for the whole
vocabulary while the rows a user usually sees are drawn from part of it.

**Count characters to make the argument and MEASURE to size a slot, because the two numbers
are not the same one.** `Bestandsdokumentation` is 21 characters and **19.145ch** — a `ch` is
the advance of `0`, and these are lowercase letters — against `Bestandsaufnahme`'s 15.213ch and
`Procurement`'s 10.037ch. The slot is `20ch`, which is the measured figure rounded up and not
the character count; reading 21 characters as 21ch would over-reserve nearly a whole
character's width on every row in the list, and reading it the other way would clip.

**And *which word won* is now a test rather than three prose copies of one derivation.** It was
stated in this section, in `project-list.css`'s rule comment and in
`project-list-narrow.css`'s threshold — and `grep -rln Bestandsdokumentation tests/` printed
nothing, on a premise that multiplies into the 20ch slot and through it into the 41rem
threshold. §15's own amendment names the exposure in as many words: *a status label
retranslated longer would move the 41rem threshold and nothing would show it.*
`projectListStyles.test.ts` takes the longest of the ten German stage labels the shipped table
actually holds and requires the sheet's recorded winner to be that word, plus that the recorded
width still fits the slot. **What it deliberately does not claim**: it compares CHARACTER
COUNTS, jsdom measures no text, and a new winner still needs a human to measure its `ch` width.
The case is what tells them to — which is the whole of what a capture nobody takes could not do.

**Three ways that derivation can be wrong, and only two of them have an instrument** — written
here because the number moved three times (34rem provisional → 36rem measured → 41rem after
the reserved slots) and twice for a reason no arithmetic checker sees. A wrong **sum** is
caught by the balancing case. A wrong **transcription** between the derivation and the shipped
rule is caught by the arrow case. A wrong **model** — the 42rem the reservation first shipped
as, whose overhead double-counted a gap the trailing group already contained — balances
perfectly, transcribes correctly, agrees with the container query, and is caught only by a
reader re-deriving it from the layout. That is how it was actually found.

---

## 7. Interaction

### Pointer

- A row press **navigates** into the detail state — `context.navigate(id)`, unchanged from
  design slice 21. A row does not open `Project.md`; that is the detail header's `Open note`.
- The whole row is the target. Hit height is at or above WCAG 2.5.8's 24px floor
  (`--size-4-6`, already the shipped value), and the two-line narrow row exceeds it.
- Middle-click and modifier-click open the project's note, matching the keyboard accelerator
  below. Undiscoverable on their own — the key legend is where they are discovered.
- **The modifier is the platform's own and no other**, which is a rule about the keys this
  surface *declines* as much as the one it claims. `⌘` on macOS, `Ctrl` elsewhere — the legend
  says which — and a press carrying any OTHER modifier does **neither** thing: not the note, and
  not the navigation either. Falling back to the plain navigation is the failure this rule exists
  to name: on macOS `Ctrl+click` **is** the secondary-click gesture, so a user reaching for a
  context menu would be moved into a project instead. `Alt` and `Shift` are declined on the same
  ground — this surface has not been asked to define them, so they mean nothing here.
- **The Continue row's `Open` takes the same vocabulary**, being a target for the same
  destination. Its `Continue` does not: that restores a *context*, and a note is not one.

### Keyboard

The launcher's grammar, without the autofocus that would make it hostile:

| Key | Where | Does |
|---|---|---|
| any printable character **except `Space`** | list has focus | moves focus to the filter and seeds it with that character |
| `↓` / `↑` | filter or list | moves DOM focus through visible rows |
| `↵` | a row | opens the project (navigate) |
| `Mod+↵` | a row | opens the project's note |
| `Esc` | filter, with a query | clears the query, focus stays |
| `Esc` | filter, empty | returns focus to the first row |
| ~~`Mod+N`~~ | ~~anywhere in the pane~~ | ~~opens `New project`~~ — **WITHDRAWN 2026-09-04, see below** |

**`Mod+N` is withdrawn as a pane-local key and shipped as a registered COMMAND instead**, which
is §14's second open decision taken. `New project` is `addCommand({ id: 'new-project' })`, so
it is in the palette — where §1's stranger looks — and bindable in **Settings → Hotkeys** to
whatever the user chooses.

**It carries no default hotkey, and that is the decision rather than an omission.** Declaring
one would claim `Mod+N` on every install over whatever the user had already bound there, on a
surface that is one pane of a note-taking app. So the accelerator exists exactly when a user
asks for it.

**The consequence is that the key legend loses a clause it cannot honour** — §12's amendment
is the other half of this one. A legend reading `{mod}N new project` would advertise a key
that does nothing on a fresh install; reading back what the user actually bound is not
available either, because Obsidian's hotkey registry is internal and this plugin may not reach
the global `app`, which the marketplace rules refuse. A legend whose every clause is true on a
fresh install is the only honest one, so it names the two pane-local accelerators and stops.

Both halves of this are `docs/tests/cases/Find and resume a project.md` step 9's subject: the
command in the palette, the binding in Settings, and the legend NOT naming it.

**`Space` is carved out of the type-to-filter rule, and the carve-out is load-bearing rather
than tidy.** `Space` is a printable character, and the rows are ordinary `<button>` elements —
which this section requires two paragraphs down — whose native keyboard activation is `Enter`
*and* `Space`. Seeding the filter from it would either suppress that activation or do both at
once: open the project *and* leave a space in the field. A keyboard user pressing `Space` on a
focused row would get behaviour no other button on the surface has. `Space` on a row therefore
does what a button does, and the filter is unreachable by it — which costs nothing, since a
query never usefully *begins* with a space.

**Roving `tabindex` applies to the row lists and to nothing else.** Its purpose is to bound an
*unbounded* set, not to minimise stops: a vault of thirty projects must not cost thirty tabs to
walk past, and everything else on this surface is a small bounded set that has no such problem.

**Both row lists are roving groups, not just `Projects`.** The tab sequence below names
`the Completed list, when expanded (one stop)`, and a group is only one stop if something makes
it one: without its own roving controller, every completed project keeps `tabindex="0"` and a
vault with twenty finished projects costs twenty tabs to walk past — the exact cost this
mechanism exists to remove, reintroduced in the group most likely to be long. Each list clamps
its own controller against **its own** row count, never against the filter's total match count:
those differ the moment a query matches a completed project and not an active one.

So the tab sequence, in DOM order, is every independent action plus one stop per row list:

`New project` → the filter → `Continue` → `Open` → the `Projects` list *(one stop, arrows
move within it)* → the `Completed` `<summary>` → the `Completed` list, when expanded *(one
stop)* → `New asset`.

In the filtered-to-nothing state the two list stops are replaced by `Clear filter` and
`New project named "…"`, which are ordinary stops like any other action.

**Every visible control is reachable by Tab alone.** The arrow keys, type-to-filter and
`Mod+↵` are accelerators over that sequence and never a substitute for part of it — a control
reachable only by a shortcut fails `PRODUCT.md`'s full-keyboard-support requirement, which this
document binds itself to. *(This sentence named `Mod+N` until the amendment above withdrew it;
the property it states is what made that withdrawal cheap — `New project` was already the first
Tab stop on the pane, so removing the accelerator cost discoverability and not access.)* An
earlier draft of this section said "three tab stops, not thirty" and was
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
- **Amended 2026-09-04: the count sits INSIDE the field's own border, not beside it.** §3's
  teletext raise says the field *is* the pane's count line at rest, and the first capture of the
  populated surface showed the opposite — a full-pane-width empty rectangle with `10 projects`
  floating outside it to the right, which is the "search field as furniture" risk this direction
  records, shipped by the region written to answer it. The input and the count are one bordered
  control: the border moves off the `<input>` onto a wrapper, the input keeps no chrome of its
  own, and the focus ring is drawn on the wrapper (`:focus-within`) so a focused field is one
  ring rather than a rectangle inside a rectangle.
- **A placeholder gives the verb, beside the visually-hidden label and never instead of it.** A
  placeholder disappears on the first keystroke, so a field named only by one has no name for
  exactly the user who most needs it — the `<label>` stays. The count is deliberately NOT
  implemented as the placeholder: a placeholder vanishes on input, and this count's whole value
  is that it changes *while* you type.
- The query is **not persisted**. It resets on remount, which is every navigation.

### Continue

`Continue` is a row in the same armature as every other row, distinguished by its group
heading and by carrying a **second action** — never by being a different shape. A raised card
above a flat list is the composition this direction did not lock.

```
Continue
┌─────────────────────────────────────────────────────────────────────────┐
│ House Renovation 2026 · Kitchen               14 Aug   [Continue] [Open]│
└─────────────────────────────────────────────────────────────────────────┘
```

**Amended 2026-09-04 — the third segment is gone, and it is this document breaking its own
rule.** The wireframe drew `House Renovation 2026 · Kitchen › Work`, and there is no field
behind `› Work`: `ContinueContext` is `{ projectId, planId }` and has no section, because this
surface's whole out-of-scope list starts at the detail state and nothing here knows what a
project's sections are. §2's honesty rule — *no field renders a number the read model cannot
supply* — was written against invented metrics and applies exactly as well to an invented
breadcrumb segment. What ships is project · plan, with the plan half **absent rather than
blank** when the stored context names no plan, per §8's content rule. Found by a reviewer
comparing the diagram against the type, not by any gate: a wireframe is prose, and nothing
here reads one.

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

  **Amended 2026-09-04 — `PlanDeleted` DOES NOT EXIST, and the deletion case is carried by the
  entry arm instead.** This document commissioned a name rather than an event: there is no
  `PlanDeleted` anywhere in the tree and no delete-plan command to raise one, so adding it to a
  subscription list would have been a list naming something nothing publishes — correct-looking,
  inert, and invisible to every gate, because subscribing to an event nobody fires fails
  nothing. What ships is `['ProjectIndexRebuilt', 'ProjectCreated', 'PlanCreated']` in the
  category list, and the deletion rides the SECOND list: `VaultChangeAdapter.announce` runs on
  `index.remove` as well as on upsert — its call sits directly after the removal, reading the
  entry's `type` before dropping it — so admitting `renovation-plan` to the entry filter covers
  a plan note created by hand, modified, copied in, arriving through sync **or deleted**, in one
  arm. The bound this bullet states is unchanged and so is the refusal to widen past
  `renovation-plan`.

  **The general shape, since this is the one place the spec asked for something that does not
  exist:** the remedy for a commissioned event with no producer is not to add the name, and it
  is not to write the producer either — it is to find which arm already carries the case and
  say so where the list is. `projectListChangeSource.ts`'s own docblock is where that is
  written down, because a subscription list is exactly where the next reader will look for a
  missing name and conclude it was forgotten.
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
| **Empty list, unreadable > 0** | The header, the notice and the foot line. **No filter and no group headings** — a group heading over nothing is the card-with-holes §8 refuses, and a count line reading `0 projects` about a vault that demonstrably holds some is false in the one region whose job is to state that number. Never the "no projects yet" empty state — `selectRenovationProjectEmptyState` already answers `null` here, and this surface keeps that. |
| **Filtered to nothing** | ~~Groups are empty~~ **The `Projects` and `Completed` groups are empty; `Continue` is NOT (amended 2026-09-04)**; the list region holds the no-match line and two actions: `Clear filter`, and `New project named "<query>"`. |
| **One project** | Everything renders. The filter is present and states `One project` (amended 2026-09-04 from `1 project` — §12 carries the lint measurement that decided the numeral); it is the count line, so it has a job at every vault size. |

**Amendment 2026-09-04 — "Groups are empty" claimed a group the filter does not own.**
`Continue` survives a query matching nothing, and that is the behaviour rather than a gap: it
is an **ACTION**, not a member of the index the filter searches. Filtering it would mean the
one control that answers *take me back to where I was* disappearing precisely while the user is
searching for something — and its own row names its project, so nothing about it is ambiguous
beside a no-match line. §7's placement already says as much from the other side: the row sits
OUTSIDE the `Projects` list rather than at the top of it, which is exactly what makes the filter
not its business. The two groups the filter DOES own are named now, so the row this table row
never meant to claim is no longer inside its wording.

**Found by a capture** — the Continue row sitting above *"No project matches …"* — which is the
one of the final review's two amendments that a picture caught rather than a reading.

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

**Amended 2026-09-04 — that case is `docs/tests/cases/Find and resume a project.md`, and it
has not been run.** Steps 2, 3 and 4 are the three above; step 6 is the one this paragraph did
not anticipate, because it is not about measurement at all. `Space` on a focused row is a
printable character and a `<button>`'s native activation at once, and **jsdom dispatches no
native activation**, so the collision the type-to-filter carve-out exists to prevent cannot be
observed anywhere in this repository. Nothing here is a substitute for the case; the case is
not a substitute for having run it.

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
| `view.project.filter.placeholder` | Filter by name |
| `view.project.count-one` | ~~1 project~~ → **One project** (amended 2026-09-04) |
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
| `view.project.plans-one` | ~~1 plan~~ → **One plan** (amended 2026-09-04) |
| `view.project.plans-many` | {count} plans |
| `view.project.keys` | ~~↵ open · {mod}↵ open note · {mod}N new project~~ → **↵ open · {mod}↵ open note** (amended 2026-09-04) |

**Amendment 2026-09-04, the two singular keys: the ENGLISH numeral is spelled out, and only
the English one.** `obsidianmd/ui/sentence-case-locale-module` treats a leading bare digit as
non-content — its emoji-stripping check matches ASCII digits too — so `1 project` reads to that
rule as sentence-initial and it demands a capital on the noun that follows. Measured, not
guessed. Capitalising instead (`1 Project`) passes the same rule and is wrong on the page: it
sits beside `{count} projects`, so the count line's capitalisation would flip with the count in
the one region whose whole job is to state the truth about how many there are. Spelling the
numeral out keeps every word correct without coercing one. **German needs neither fix and gets
neither** — `1 Projekt` and `1 Plan` are what ships there, because `Projekt` and `Plan` are
capitalised nouns whatever numeral precedes them. A locale table is not obliged to make the
same choice in every language, and this is the first key here where it does not.

**Amendment 2026-09-04, `view.project.keys`: THREE clauses to TWO.** The third named a key
this build does not ship — see §7's own withdrawal above for why `New project` is a registered
command with no default hotkey, and why the binding a user chooses cannot be read back. The
legend's rule is now stated as a rule rather than as a list: **every clause must be true on a
fresh install.** That is what refuses a fourth clause on the same ground, whoever proposes it,
and it is checked by nothing — a locale string is data, and no gate asks whether a sentence
about a key is true.

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

   **Amended 2026-09-04 — "the plugin's own data" would NOT have been device-local, and the
   store uses Obsidian's own per-device door instead.** A file under the plugin's manifest
   directory sits inside `.obsidian/`, the vault's configuration tree, and Obsidian Sync can be
   configured to carry community-plugin settings — so that file MAY follow the vault to another
   device and two devices would then overwrite each other's last-visit context. The constraint's
   own final clause is what the mechanism had to be chosen to keep, and the mechanism first
   written for it would have quietly narrowed it away. `App.loadLocalStorage` /
   `App.saveLocalStorage` are promised at this plugin's `minAppVersion` floor (`@since 1.8.7`
   against 1.13.0), are per device by construction, and serialize for the caller — so
   `ContinueContextStore` holds no `JSON.parse`, and the key is prefixed with the manifest id
   because that API is vault-scoped rather than plugin-scoped. **Both doors are synchronous**,
   which is also why there is no write queue here where `SequenceMarkerFileStore` one directory
   over has one: two calls made without awaiting between them cannot interleave, so a queue
   would have nothing to guard and no way to be tested.

   **What is verified and what is inferred**, stated separately because they read alike: that
   the two members exist at the pinned floor is read off `obsidian.d.ts`; that a real Obsidian
   keeps this off Sync is the vendor's documented behaviour and is checked by nothing here.
   `docs/tests/cases/Find and resume a project.md` step 11 is the restart half; the two-device
   half has no instrument in this repository at all.
2. **`lastWorked` is the most recent mtime across EVERY note the index holds for that project**
   — its own `Project.md`, its plans, its zones and its requirements alike — decided once, in
   the query, never per caller.

   An earlier draft of this constraint left "every indexed note or only `Project.md`" open as a
   cost question, which §8 two sections up had already closed in the other direction: that
   section requires the maximum across the project's own notes and says the value moves on every
   owned-note write. `Project.md` alone contradicts both, and it fails the case the field exists
   for — a project whose whole afternoon went into drawing zones would never move to the top of
   a list ordered by when it was last worked on.

   The cost that made it look like a question is not real at the scale it is paid: one walk of
   the index answers both commissioned facts for every project at once, so the read is
   proportional to the number of notes in the vault rather than to notes × projects.
3. **The narrow threshold's value.** It comes from a capture at 460px with the German status
   words in place, not from a round number.

   **Amended 2026-09-04 — it is `41rem`, and it comes from a DERIVATION checked against a
   capture rather than from the capture.** 460px is the width the row is inspected at; the
   threshold is the output of a stated rule over a measured trailing group, and
   `styles/project-list-narrow.css` carries both. The constraint is unchanged in what it
   refuses — a round number — and is narrowed in what it asks for: a builder may not move this
   number without moving the derivation it is the output of, which two cases in
   `projectListNarrowStyles.test.ts` now hold together. §6's amendment names the third way a
   derivation goes wrong that neither case can see.
4. **Nothing writes to the vault outside `infrastructure/`**, and `presentation/dialogs/` may
   not import `application/`, `infrastructure/`, `plugin/` or the event bus. The layer bans are
   lint, not convention.
5. **The `New asset` action's exit condition**: it leaves this surface when Epic 6's catalogue
   surface exists, which is where a creation action for a vault-wide catalogue entry belongs.
   Until then it is here, quiet, at the foot, in one place rather than two.

---

## 14. Open decisions

**All three are CLOSED as of 2026-09-04**, taken during the build and recorded here with the
answer and who took it rather than left reading as open. Each keeps its original wording above
the answer, because a decision whose question is edited away cannot be re-argued by anyone who
comes to disagree with it.

- **Does the filter also match the status word?** Typing `design` finding every project in the
  Design stage is useful and is one line; it also makes the count ambiguous about what matched.
  Recommended: name only for now, and revisit when a vault has enough projects for stage
  filtering to be the faster path.

  **ANSWER: name only, the recommendation taken as written.** Taken at the plan, before any
  code, and never contested by the build. `matchesQuery` reads `project.name` and nothing else,
  and `view.project.filter.placeholder` says **`Filter by name`** out loud — which is the half
  that makes the narrowing honest rather than merely small: the resting field now states the
  field it matches, so a user typing a status word into it learns why nothing came back. The
  revisit condition is unchanged, and a builder widening this owes the count line a way to say
  what matched.

- **`Mod+N` may collide with a user's own hotkey.** Obsidian binds hotkeys to command ids;
  a pane-local key handler does not go through that registry and cannot be rebound. Either
  register a real command for `New project` and let the legend read whatever the user bound,
  or drop the accelerator. Recommended: register the command — it also puts the action in the
  palette, which is where the stranger looks.

  **ANSWER: register the command — and the second half of the recommendation is REFUSED.**
  `addCommand({ id: 'new-project' })` ships, so the action is in the palette and bindable in
  Settings → Hotkeys. *"Let the legend read whatever the user bound"* cannot be built: Obsidian's
  hotkey registry is internal and reaching it needs the global `app`, which the marketplace rules
  refuse — so the legend would have had to either name a default this plugin declines to claim,
  or name nothing while pretending to name what the user chose. It names the two pane-local
  accelerators and stops. §7 and §12 carry the withdrawal. **The instructive half is that the
  recommendation was two clauses and only one of them was buildable**, which reading it as a
  single "recommended: register the command" would have hidden.

- **Whether `Continue` survives an Obsidian restart.** The stored leaf state is durable; the
  *leaf* is not. Restoring into a leaf Obsidian has already restored differently is a
  behaviour question this document does not settle.

  **ANSWER: it survives, and the question dissolved rather than being decided — because the
  premise is false.** Nothing stores a leaf state. `ContinueContext` is `{ projectId, planId }`,
  two ids and no leaf identity at all, re-resolved against the project index at every hydrate;
  `Continue` then reveals a Plan Editor through the same `revealPlanEditor` door the palette
  command uses, which finds an open leaf or makes one. So there is no leaf to restore into and
  no way to disagree with the one Obsidian restored. **A design question can be answered by
  making it unaskable, and that is usually cheaper than answering it** — storing a leaf id
  would have bought exact restoration and every failure mode this bullet was worried about.
  What it costs is stated rather than glossed: `Continue` reopens the plan, not the scroll
  position, the zoom or the selection. `docs/tests/cases/Find and resume a project.md` step 11
  is the instrument, and it has not been run.

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

   **Amended 2026-09-04 — what shipped is SEVEN entries in the fixed set, not an ad-hoc narrow
   capture, and the sentence above under-priced the difference.** `home-stress`,
   `home-stress-light`, `home-stress-de`, `home-whole`, `home-stress-narrow`,
   `home-no-match-narrow` and `home-filter-focus` are permanent shots with their own URLs, and
   the reason is this script's own recorded precedent: an ad-hoc capture is *taken once and
   never watched again*, so a status label retranslated longer would move the 41rem threshold
   and nothing would show it. Three of them exist only because the first four could not see
   something — thirty rows are taller than an 800px viewport, so the `Completed` disclosure and
   the foot line were below the fold in all four (`home-whole`); German at 1280 is the state the
   threshold is COMPUTED from and was in no shot (`home-stress-de`); and a focus ring is not on
   screen at rest, so no resting shot can watch one (`home-filter-focus`, which presses Tab
   rather than calling `page.focus()`, because only a keyboard press satisfies `:focus-visible`).

   **The last sentence above is the one to carry, and it under-states itself: a capture that
   cannot SEE what it certifies reads exactly like one that can.** The no-match shot was graded
   as proving `overflow-wrap: anywhere` while its query was hyphenated — a hyphen-minus is a
   UAX #14 break opportunity, so ordinary wrapping did the work and deleting the declaration
   produced a byte-identical PNG. De-hyphenating was **not enough**: the 47-character token that
   produced still fitted inside the 420px button, and the PNG was byte-identical again. Only a
   59-character, 453px token makes the declaration load-bearing. Two plausible fixes in a row
   looked right and proved nothing; running the mutation twice is what told them apart. **Grade
   a capture by mutating the rule it is supposed to certify, not by looking at it.**
3. **Commission the two DTO fields** before the row is built to this spec, so the row is never
   built against placeholders it then has to be rebuilt around.
4. **Write the manual case** for what only a live vault can verify — contrast, the focus ring,
   the 24px floor, `Mod+↵`, and whether `Continue` restores what it claims — and run it in
   `npm run test-build`.

   **Status 2026-09-04: `docs/tests/cases/Find and resume a project.md` is written, registered
   in [[Smoke Test the Editor]], and HAS NOT BEEN RUN.** Its Runs table says so. An unrun manual
   case is a plan to find out, not a finding, and this repository has already shipped one
   outcome row reading "walked" over a case nobody had walked.
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

The first three amendments dated 2026-09-04 (§3's armature, §6's cell size, §7's filter field)
were each decided against a capture rather than a reading, and the rules they describe live in
`styles/project-list.css`, `project-list-narrow.css` and `project-filter.css`, where every
measured number carries its own derivation.

**The finish pass added ten more on the same date, and they divide by how they were found**,
which is worth stating because only one of the ten came from looking at a picture:

| § | Amendment | Found by |
|---|---|---|
| Header note | The captures exist; the two limits that ride with every figure they produced | The build |
| §5 | Region 7 is one region with two compositions — the empty state's foot omits the key legend | Reading `ViewRoot.vue` against the region table |
| §6 | The threshold is `41rem`, DERIVED rather than read off a capture; `Bestandsdokumentation` is the longest German status word, not `Bestandsaufnahme` | Measuring the vocabulary instead of quoting the example |
| §7 | The Continue wireframe's `› Work` segment has no field behind it | A reviewer comparing the diagram against `ContinueContext` |
| §7, §12 | `Mod+N` withdrawn as a pane-local key; the legend loses its third clause | Asking what Obsidian's hotkey registry is reachable from |
| §8 | `PlanDeleted` does not exist; the entry arm carries deletion | Grepping for the event this document commissioned |
| §9, §12 | `One project` / `One plan` rather than `1 project` / `1 plan`, in English only | An `eslint-plugin-obsidianmd` rule, measured |
| §11, §15 | The manual case exists, is registered, and has NOT been run | Writing it |
| §13.1 | "The plugin's own data" would not have been device-local | Reading `.obsidian/` against what Obsidian Sync carries |
| §13.3, §14 | The threshold constraint asks for a derivation, not a capture; all three open decisions closed with the answer and how it was reached | The build, recorded rather than left reading as open |

**Nine of those ten were found by reading this document against the tree**, which is the
opposite proportion to the first three, and it is the argument for a finish pass being a
separate step rather than a tidy-up. A capture answers *does this look right*; only a reading
answers *does this document still describe what was built*, and a sentence that has quietly
stopped being true fails nothing, renders nothing, and reads exactly like one that is still
true.

**Do not count these by grepping the date.** `2026-09-04` appears more often than there are
amendments, because several are marked twice on purpose — once in the table row that carries
the old wording struck through, and once in the prose that says why. The table above is the
list; the markers are navigation.

**The final whole-branch review added two more, on the same date and by a different
instrument**, kept in their own table because "the finish pass added ten" is a measured fact
about that pass and folding these into it would make the sentence wrong:

| § | Amendment | Found by |
|---|---|---|
| §6 | The tick strip is drawn from two named tokens, not `currentColor`; the property that wording was reaching for holds, the mechanism does not | Reading this section against `styles/project-list.css`, which had refused it in writing |
| §9 | The Continue group survives a filter matching nothing — it is an ACTION, not a member of the index | A capture, read against the *Filtered to nothing* row |

**Both are the failure this document's own header warns about, arriving after the pass written
to catch it.** The §6 one is the sharper of the two: the build had already refused
`currentColor` in a paragraph explaining exactly why, so the divergence was recorded on one side
and invisible from the other — and the manual case at
`docs/tests/cases/Find and resume a project.md` step 2 sent a runner to verify the mechanism
this section had stated rather than the one that shipped. A claim checked from only one side is
one the next reader resolves the wrong way.
