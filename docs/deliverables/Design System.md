---
type: Deliverable
parent: "[[User Interface]]"
order: 30
status: Open
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Design System

The artifact, **derived**, citing its sources, expected to change as the design is refined — a
refinement that contradicts a source names the section it refines and lands here rather than in
`docs/prds/` or `docs/sdds/`.

It answers **what a control is made of and what its states are**. Which surface a given
failure *gets* is [[Shared UI vocabulary]]'s — the routing rules and the five slices that build
them — and this note is cited by it rather than restating it. What things are called is
[[Information Architecture]]'s; which surfaces exist is [[Sitemap]]'s.

## The founding rule, and the two defects it has to survive

SDD §84 is three lines: use Obsidian CSS variables where practical, avoid hard-coded global
palettes, support light, dark and custom themes. `styles/view.css` already says the same thing
in a comment — *every colour comes from an Obsidian variable, so a themed vault stays themed*.

> **A value the host declares is read, never restated. A value the host does not declare is
> declared once, here, and read the same way.**

Two different defects break that, and they are not caught by the same instrument — which is
the part worth writing down, because one of the two instruments does not exist yet:

| Defect | Caught by |
| --- | --- |
| Reading a variable nothing declares — `var(--size-4-3)` where the name is misspelled or absent, which draws a box with no padding and screenshots as deliberate | **`tests/harness/cssVars.test.ts`**, today. It sweeps every `var(--x)` in `styles/**` against the declarations of the three sheets the harness page links, Obsidian's vendored `app.css` among them |
| Writing a literal where a variable exists — a hex colour, a pixel spacing step | **Nothing, today.** A hardcoded `#3b82f6` in a partial declares nothing and reads nothing, so the sweep above passes it |

`cssVars.test.ts` states its own ceiling and this note repeats it rather than widening it: it
reads *declarations*, not the cascade, so a name declared in a block no state reaches still
counts; it ignores the scheme, so a value declared only under `.theme-dark` passes and draws
nothing in light; and `var(--x, fallback)` counts as a read of `--x`, because a fallback is a
branch rather than permission for the name to be missing.

The missing instrument is a `no-restricted-syntax` rule over `styles/**` refusing a colour or
spacing literal, in the shape `WRITE_BOUNDARY` and `SVG_CLASS_TOKENS` already use in
`eslint.config.mjs`, naming the spellings its selector sees. Until it exists, that half is held
by review, and this note says so rather than implying the sweep covers both.

## What the plugin must decide for itself

Obsidian declares nothing for a canvas. These are the places a variable cannot be borrowed, so
they are the actual content of a design system here rather than the deferrals:

- **The plan canvas's own visual language** — zone fill and stroke, the selected and hovered
  states of a drawn object, transform handles, snap guides (SDD §21), the measurement label
  (PRD §39's Measure tool), the calibration affordance, and the layer states PRD §39 names:
  hidden, visible, locked.
- **Density inside a three-column editor.** SDD §60's toolbar, two rails, canvas and status bar
  have to hold on a laptop pane, which Obsidian's own spacing scale was not asked to solve.
- **The state vocabulary** below, because it must be consistent across a DOM control and a
  Konva shape that share no styling mechanism at all.

Each of those still takes its *colour* from a host variable wherever one has the right meaning
— accent for selection, the error colour for an invalid polygon — so a themed vault stays
themed. What is decided here is which variable means what on the canvas, and that mapping is
this note's, not each tool's.

## The component inventory

Named here so a second author does not invent a second name — and **each row is now a note**.
`docs/components/` holds one per component, so this table is the **index** and the notes are the
content: what each is made of, what it is handed, where it appears, and what is still open about
it. `Slice` is the design slice that builds it, where one exists; the rest are named by a source
and unbuilt.

Three rows split on the way out, because a bundle is not a note: the toolbar from its button, the
modal from the confirmation *use* of it, and the three transient canvas overlays from each other.
That is fifteen rows becoming seventeen notes with nothing added — the count moved because the
granularity did.

| Component | Medium | Source | Slice |
| --- | --- | --- | --- |
| [[View shell]] (`.renovation-planner-view`) | dom | SDD §12, `styles/view.css` | 01 |
| [[Toolbar]] | dom | PRD §39, SDD §60 | 05 |
| [[Tool button]] | dom | PRD §39, SDD §56, SDD §57 (six initial tools) | 05, 06 |
| [[Left rail]]: Layers · Objects · Assets | dom | SDD §60, PRD §39 | 05 |
| [[Layer toggle]] — visibility and lock | **both** | PRD §39, SDD §15, SDD §17 | — |
| [[Plan canvas]] | **both** | SDD §16–§19, SDD §60 | 05 |
| [[Selection handle]] | canvas | SDD §19, SDD §20 | 06 |
| [[Snap guide]] | canvas | SDD §19, SDD §21 | 07 |
| [[Measurement label]] | canvas | PRD §39, PRD §71, PRD §82 | 07 |
| [[Inspector]]: Properties · Relations | dom | SDD §59, PRD §39 | 06 |
| [[Status bar]]: selection · measurements · save state | dom | PRD §39, SDD §60, PRD §67 | 13 |
| [[Save-state indicator]] (Saved · Saving · Unsaved · Save error) | dom | PRD §67 | 13 |
| [[Toast]] | dom | PRD §67, SDD §64, SDD §66 | 13 |
| [[Empty state]] | dom | PRD §94 | 14 |
| [[Modal]], and the confirmation dialog as a *use* of it | dom | PRD §64, PRD §39 inspector actions | 15 |
| [[Inline field error]] | dom | SDD §59, SDD §64, SDD §65 | 16 |
| [[Status badge]] (e.g. `recalculationStatus`) | dom | slice 10, slice 17 | 17 |
| ~~List row, for the alternative route~~ — **not this note's**, see open question 3 | — | Bases owns it | — |

`Medium` is the notes' own classifying key — `dom`, `canvas` or `both` — and it is in this table
because it is the column that predicts which of the section below's problems a component has. The
two `both` rows are the hybrids: [[Plan canvas]] is a DOM element hosting a drawn scene, and
[[Layer toggle]] is a DOM control whose entire effect is on the canvas.

**What stays here rather than moving into those notes** is the state vocabulary below. Every
component names *which* of those states it has and what is specific to it; none of them
redefines what `Focus` means, because a state redefined per component is ten states pretending
to be one. A component note that restates the channel is the defect this split exists to
prevent.

Everything in the DOM half is a Vue component because ADR-004 said so, mounted per view per
SDD §12 — not a decision this note makes, and `docs/setup/vue-conventions.md` carries the
contract for the day Vue arrives.

## States, and the second channel each one owes

[[Accessibility]] owns the requirement that status is never colour-only. This note owns the
answer: every state below names the non-colour channel that carries it, because a state
defined as "the blue one" is a state that disappears for one reader in twelve and under one
theme in three.

| State | Second channel |
| --- | --- |
| Default | — |
| Hover | Cursor, and elevation or fill shift |
| Focus (`:focus-visible`) | A ring with its own thickness, never colour alone |
| Active / pressed | Position or inset shift |
| Selected | Border weight plus handles on the canvas; a checked mark in a list |
| Disabled | Reduced opacity **and** a non-interactive cursor, plus `aria-disabled` |
| Loading | A moving indicator, and text |
| Error | An icon and a message, per slice 16 |
| Empty | Copy and an action, per slice 14 |
| Locked / hidden | An icon, per PRD §39's object states |

## The canvas is not the DOM, and that is a design-system constraint

Konva draws to one `<canvas>` element, so a zone has no DOM node. It cannot take a CSS focus
ring, it has no accessible name, and its hit target cannot be measured by anything that reads
the layout. Three consequences belong here rather than in each tool:

1. **Every canvas state needs a drawn equivalent** of the channel the table above gives a DOM
   control — a focus indicator that is painted, not inherited.
2. **A minimum handle size is a world-to-screen decision**, not a CSS one: a handle that is 8
   screen pixels at one zoom is not 8 at another, and **SDD §85's** "adequate hit targets" is a
   claim about the screen. (Cited as PRD §44 until [[Selection handle]] was written against the
   actual heading: PRD §44's accessibility list has five items and hit targets is not one of
   them — the phrase is SDD §85's alone.)
3. **The canvas cannot be the only route to anything.** This is the same conclusion
   [[Sitemap]] reaches from the mobile side and [[Accessibility]] reaches from §44 — three
   arguments, one requirement, which is why it is stated in each and owned by none.

## Mechanism, as it already stands

- **Partials under `styles/`**, one per concern, assembled by `scripts/styles-assemble.mjs`
  into `dist/styles.css`. The build fails on a partial no entry file imports, an unresolvable
  import, or a partial over 400 lines. `styles/index.css` holds imports and comments only, and
  the import order is behaviour rather than organisation.
- **One entry class per view.** `.renovation-planner-view` is the stylesheet's only way into
  that view, and a new surface takes one class the same way.
- **No inline styles**, refused by `eslint-plugin-obsidianmd` — a marketplace rule that is
  already a gate here rather than a review surprise.
- **Icons** come from `setIcon` and Obsidian's own set. `RENOVATION_PROJECT_ICON` is one
  exported fact for the tab and the ribbon so the two cannot drift. The browser harness
  deliberately renders no icons yet, so **an icon choice cannot be verified in this
  repository** — every icon would be an invisible gap in the tool built for looking, and the
  renderer arrives with the first real `setIcon` call.

## What holds this note

- **`tests/harness/cssVars.test.ts`** — every variable the partials read is declared. Ceiling
  as stated above.
- **`tests/harness/accessibility.test.ts`** — axe against the real mounted view, semantics
  only. It states its own ceiling precisely, and this note does not widen it: contrast, focus
  visibility and hit-target size are **not** checked there — `color-contrast` throws inside
  axe under jsdom, `target-size` reports a false pass because jsdom answers zero for every
  box, and axe has no focus-indicator rule at all.
- **`npm run harness`** — faithful about markup, spacing, hierarchy and Obsidian's *default*
  colours. Not faithful about a themed vault's colours, its accent, or any element default the
  vendored sheet's reduction dropped.
- **`npm run test-build`** into this repository's own vault — the only place appearance,
  contrast, focus visibility and hit targets are actually verified, which makes each of those
  a `Test case` note with a cadence rather than a claim here.
- **Missing:** the literal-refusing lint rule above. Named as the next check, not as a fact.

## Open, and not decided here

1. **Which Obsidian variable means what on the canvas.** The mapping is this note's to make and
   it needs the vendored `app.css` read per scheme, which `cssVars.test.ts` explicitly does not
   do — its own comment names the per-scheme reference walk as worth porting the day a partial
   reads a variable declared in one scheme only. That day is the day this mapping is written.
2. **A spacing scale of the plugin's own, or Obsidian's throughout?** Undecided until the
   three-column editor is measured in a real pane; deciding it from the diagram would be
   deciding it from a drawing that two documents already disagree about.
3. **The list row — answered, and the answer removes it from this note.**
   [[The alternative list route is a Bases view]] settles [[Sitemap]]'s open question 2, so
   **Bases owns the row** and this note owns nothing about it: not its states, not its hit
   targets, not its density. One decision decided two notes' contents, as both predicted, and
   this note's share of it is a component it no longer has to define, translate or keep
   consistent.

   The price is worth stating where a design system will feel it: nothing plugin-specific can
   appear in that row, so no drawn state, no canvas selection and nothing this note styles
   travels there. A spatial object's *selected* state therefore has two answers — the canvas
   one in the table above, and Obsidian's inside a Bases row — and they will not match. That
   is accepted rather than overlooked, and it is the reason the state table's *Selected* row
   already names two channels instead of one.

## References

- PRD §39 (panels, tools, inspector actions, keyboard shortcuts, object states), §44
  (accessibility qualities, error categories — **not** hit targets, which is SDD §85's),
  §64 (deletion semantics),
  §67 (autosave states), §94 (empty states).
- SDD §12 (one Vue app per view), §16–§21 (spatial rendering, scene structure, interaction,
  selection and transformation, snapping), §57 (initial editor tools), §59 (inspector), §60
  (UI layout), §64–§66 (error model, result pattern, error boundary), §84 (CSS and theme
  integration), §85 (accessibility). ADR-004 (Vue), ADR-005 (Pinia), ADR-003 (Konva).
- `styles/index.css`, `styles/view.css`, `scripts/styles-assemble.mjs`, `eslint.config.mjs`
  (`WRITE_BOUNDARY`, `SVG_CLASS_TOKENS` as the shape the missing rule takes),
  `tests/harness/cssVars.test.ts`, `tests/harness/accessibility.test.ts`.
- `CLAUDE.md` — the harness's honest limits, the stylesheet's build-time refusals, and why
  there is no icon renderer yet. `docs/setup/vue-conventions.md` for the day Vue lands.
- `docs/components/` — one note per row of the inventory above: seventeen of them, each stating
  its anatomy, the states it has, what it is handed and emits, where it appears, and what is open.
  This note stays the index and the state vocabulary.
- [[Shared UI vocabulary]] — which surface a failure gets, and slices 13–17.
- [[The alternative list route is a Bases view]] — the decision that removed the list row from
  this note's inventory, and what it rejected.
- [[Disclosure ladder]] — when a control this note defines is on the surface at all. A component
  defined here has no rung; a surface that shows it does.
- [[User Interface]] — the Feature, and what it claims about checks.
