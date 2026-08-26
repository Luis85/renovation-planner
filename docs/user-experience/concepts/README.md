# concepts — HTML mocks

Drawings of the design, openable in a browser. Not backlog items and not implementations.

**This folder takes no new pages.** New prototyping happens in `src/prototypes/`, against the
plugin's real assembled stylesheet, per
[`Prototype a screen in the harness before it is built`](../../requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md).
The six pages here stay, frozen, as the record of what was proposed and of the six findings
below — several of which no other instrument could have produced. A record that gets rewritten
stops being one, which is why this is a boundary rather than a migration.

Most of them draw [`docs/components/`](../../components/) and SDD §60. `renovation-canvas.html`
draws [the concept & interaction design spec](../renovation-canvas-concept-interaction-design.md)
instead, and proposes a **different shell for the same view** — see *Two shells* below before
reading the two against each other.

| File | Shows |
| --- | --- |
| `plan-editor.html` | SDD §60's layout assembled: working, first run, trouble, and German. Each editor is a **draggable pane** with a live readout |
| `plan-editor-solo.html` | The same editor, scenario 1 only, **filling the window** and nothing else — no banner, no nav, no toggle, no way back but the browser's. The page for looking rather than for reading. Scheme follows the OS |
| `renovation-canvas.html` | The **other** shell: [the concept & interaction design spec](../renovation-canvas-concept-interaction-design.md)'s property tree, canvas and context inspector, in four scenarios. It **disagrees** with `plan-editor.html` on purpose — see below |
| `component-gallery.html` | One specimen per component note, with every state it owes |
| `disclosure-ladder.html` | The six rungs as six surfaces, plus the order as a matrix |
| `settings.html` | The one setting that exists, and what a hand-edited `data.json` renders as |
| `concept.css` | The **proposal** — the canvas visual language, and each component's rules |
| `canvas.css` | What the renovation-canvas concept adds and `concept.css` has no answer for: property tree, `+ Add` menu, canvas pins, guidance block, planning meter, decision card, precision chooser. A second sheet, not more of the first — its header says why |
| `page.css` | The page's own furniture. Nothing here styles a component |
| `shots/` | One PNG per specimen in `component-gallery.html`, light beside dark, embedded in the matching note in [`docs/components/`](../../components/). Written by `npm run concept-shots`. **Nothing checks the pairing** — see below |

## What the mocks measured

Six findings the pages produced rather than asserted. The last two came out of
**screenshots** rather than out of reading the files, and the first came out of trying to
CAPTURE one — which is the argument for looking at a drawing as well as writing one, and for
looking at it twice.

- **A theme class only works on `<body>`, and the both-schemes panel has been showing one
  scheme twice.** Found while building `concept-shots`, whose first version cloned each
  specimen into two nested frames carrying `.theme-light` and `.theme-dark` — the shape the
  gallery's own last section uses. Both halves came out light. The vendored sheet declares
  `--background-primary` **once**, as `var(--color-base-00)`, and redeclares only the BASE
  variables per theme; a custom property substitutes at the element that DECLARES it, so
  `--background-primary` computes on `<body>` in the body's scheme and inherits down already
  resolved. Measured inside the gallery's `.theme-dark` panel: `--color-base-00` is `#1C1C1C`
  while `--background-primary` is `#ffffff`, and the panel's computed background is white.
  So the capture script sets the class where Obsidian sets it and shoots each specimen twice.
  **The gallery's last section is still wrong** — its caption claims those two panels "differ
  by nothing but the theme class", and in the body's own scheme they differ by nothing at all.
  Recorded rather than fixed: nesting cannot produce it, so that section needs two documents
  or a narrower caption, which is a design decision.
- **A pane is not a page, and the rails now answer to it.** Fixed at 210 + 252px, the
  canvas got 67% of a 1440px pane and **29% of a 680px one** — the only region that matters
  paying for both rails, in a split pane that is routinely that narrow. A container ladder
  on the assembled editor now narrows the inspector first and the rail second, which takes
  a 720px pane's canvas from **257px to 336px**. A CONTAINER query and not a media query,
  and that distinction is the finding rather than an implementation note: the editor's width
  is its pane's — the window minus both Obsidian sidebars minus whatever is split beside it.
  [[Design System]]'s open question 2 is answered for the tightening case and deliberately
  left open for the other: **nothing collapses a rail.** Below roughly 620px the three
  columns still crowd each other, and a rail that can be shut and reopened is a disclosure
  control rather than a width — a design decision, and one that has to keep product
  principle 5, that nothing is canvas-only. An icon strip with no way to open it would
  break that principle to buy pixels.
- **German labels fit at 210px — and 210px is why.** *Konstruktionsabschnitte* is 23
  characters beside a visibility toggle and a lock toggle, against *Construction sections*
  at 21, and that is what sets the rail's width. So the ladder leaves the rail alone until
  its last step and spends the inspector instead, whose labels sit above their values and
  therefore clip nothing a translator wrote. At the last step the rail reaches 192px and
  that one label truncates by about 11px while the English one still fits — the cost,
  stated, with a `title` on every rail row name to recover it. **German names never fit and
  are not meant to:** a label is bounded by a translator, a name by nobody. At an 878px pane
  nothing else overflows — not the toolbar, not the status bar, not the inspector actions,
  and *Nicht gespeicherte Änderungen* survives at 29 characters against English's 15.
  Recorded in [[Left rail]].
- **Contrast.** Measured across four pages and both schemes. See below — the canvas now
  carries a weight ladder of its own, and two rungs of it sit **deliberately** under WCAG's
  3:1 non-text threshold. `plan-editor-solo.html` is not a fifth measurement: it introduces
  no colour value the four already carry, so the finding reaches it by construction rather
  than by re-measuring.
- **The areas did not follow from the polygons.** Solving the four drawn zones for a scale
  gave four different answers — 22.1, 17.3, 16.7 and 21.7 mm per unit — so no single
  calibration could have produced the set of areas the pages displayed. In a product whose
  whole claim is that geometry produces the number, a derived value that is not derived is
  the one lie these files could not afford, and it stayed invisible because nobody
  multiplies a polygon by hand. One scale now, **1 unit = 20mm**, with every area, the
  perimeter, the dimension and the waste-factor quantity recomputed from it:

  | Zone | Geometry | Area |
  | --- | --- | --- |
  | Kitchen | 230×160 less an 86×66 notch | 12.45 m², perimeter 15.60 m |
  | Living room | 348×160 | 22.27 m² |
  | Bathroom | 230×118 | 10.86 m² |
  | Hallway | 348×118 | 16.43 m² |

  The dimension is the hallway's inner width, 348 units → 6.96 m, and *Oak plank floor* is
  the kitchen's 12.45 m² times the 1.08 waste factor → 13.45 m². That last one was already
  right in spirit — 14.7 × 1.08 rounded to the 15.9 the first version showed — so the
  relation survived the recalculation rather than being invented by it.
- **The grid did not obey the scale beside it.** It was a CSS background on the canvas
  element at a fixed 24px pitch while the plan scaled to fit its pane, so the lattice and
  the `1 : 50` readout six inches away disagreed at every width but one — decoration in a
  ruler's clothes, in the one product where that is not a small lie. It is now drawn inside
  the drawing, in plan space, as a **metre grid** (50 units to the metre, a major line every
  5 m), and the toolbar states the pitch next to the scale rather than leaving a reader to
  infer it. Two things fell out of that which were not the point and are worth keeping:
  scenario 3's uncalibrated garden has **no grid at all**, because a grid is a measurement
  and that plan has none; and scenario 2's first-run canvas is clean ground rather than a
  lattice sitting behind *No plan imported*.

## Two shells, and which is which

`plan-editor.html` draws **SDD §60**: a layers rail, a row of drawing tools, an inspector.
`renovation-canvas.html` draws the **concept spec**: a property tree where the layers were, one
`+ Add` where the tools were, and Work, Problem and Decision as objects that live on the canvas.
They are two answers to the same view and they cannot both be built.

The SDD is the authority, so §60 is the RECORD and the canvas page is the PROPOSAL. Neither page
changes the other and neither changes the SDD. Keeping both is the point: a proposal that replaced
what it wants to succeed leaves a reviewer nothing to compare it against.

## What the canvas mock measured

Seven more findings. Five came out of a **screenshot** rather than out of reading the file —
the same argument the six above make, made again by a page written by someone who had just read
them.

- **A flex child was crushed, and the container reported itself as fitting.** `.rp-inspector` is a
  flex column, so `.rc-calc` shrank below its content and its own `overflow: hidden` clipped the
  labour line and the total out of the middle of a cost breakdown. The inspector's `scrollHeight`
  still equalled its `clientHeight` throughout — the instrument being used to check for clipping
  could not see this kind of clipping. `flex: 0 0 auto`, on every block the concept adds.
- **`text-align` was not the problem; `align-items` was.** The count grid and the level-1 space
  blocks rendered CENTRED with `text-align` computing to `left` — measured. app.css sets
  `align-items: center` on every `button`, and on a `flex-direction: column` button that is the
  horizontal axis, so the spans were centred as flex items before their own text-align was
  consulted. Third instance of the trap `concept.css`'s button reset documents, and the first the
  reset does not cover.
- **Selection lost to kind, because it was declared first.** A selected problem pin kept the
  warning rim and lost the accent — both rules are (0,3,0), so source order decided, and the bold
  label still applied because nothing competed for it, which made it look deliberate. Measured as
  `rgb(224, 172, 0)` on the one pin its whole frame is about. The rule is now an ORDER: whatever a
  pin's kind says, selection is declared afterwards.
- **The comment explained the failure the rule beside it was committing.** `+ Add` carried a
  paragraph on why a filled accent button fails AA — and then set an accent LABEL on the page
  ground, which axe measured at 3.42:1 light and 4.00:1 dark. Same defect class as an unchecked
  invariant in a comment, in a stylesheet. The label is `--text-normal` now and the accent rides
  the border and the icon. `.rp-empty .rp-action` in `concept.css` still does the original thing
  and measures the same 3.42:1 — recorded, not edited, because it belongs to the other proposal.
- **A drawing refused the argument it was drawn to make.** Scenario 3 exists to argue that a
  decision belongs docked over the plan rather than in a modal. At a real pane width the canvas is
  about 456px and the card is 248 of them, and the first placement — bottom right, written down as
  "the emptiest corner" — landed on the Hallway and clipped the very pin the card belongs to. It
  now sits in the emptiest corner it actually has, and the underlying question, whether a decision
  is an inspector surface, is left open on the page rather than quietly settled.
- **A side-tab accent border, and the host had already answered it.** The guidance block was
  a card with a 2px accent border down its left edge — the design hook named it as the
  most recognisable tell of a generated interface. Checking beat arguing: Obsidian's own
  `.callout`, in the vendored app.css, sets `--callout-border-width: 0px` and carries its
  emphasis in `color-mix(in oklch, var(--callout-color) 10%, transparent)`. No border at
  all, let alone one on a single side. So the block is a 10% tint now, which is both the
  fix and the more faithful drawing — rule 1 reaching a SHAPE rather than a value.
- **Chip widths were guessed, and one state hid the miss.** Three of ten pin labels overflowed
  their chip, and the SELECTED one overflowed by more than the rest because selection makes it
  bold — a defect present in exactly one state. The authored widths are now what `getBBox`
  measured, and the page re-fits every chip to its own text at load, so an edited label cannot
  reintroduce it.

## Accessibility, and what it is worth here

`renovation-canvas.html` is the first of these pages run through **axe-core**, in both schemes.
That found and fixed four things: an `<svg role="img">` whose pins were focusable — a graphic
announced as one atomic image with a tab order running through it — `aria-selected` on a
`role="button"` and on a bare `<div>`, and a `<ul>` carrying `role="none"` children. The property
tree is now a real ARIA tree (`role="tree"`, `role="treeitem"`, `aria-level`, `aria-expanded`, one
tab stop), which is also what makes `aria-selected` legal on those rows.

Three contrast pairs survive and **none is this concept's**: `--interactive-accent` as a link
colour and as `.rp-empty .rp-action`'s label, and `--text-faint` on a hidden layer's name. All
three are host tokens on components that already existed, and the section above records the
figures.

What axe cannot see in a headless shot is what it cannot see in jsdom either — a visible focus
indicator, hit-target size, and the landmark rules that need whole-page context. And nothing in
`npm run check` reads what is *in* these files, so **none of this is a gate**: it was run by hand,
once, and rerunning it is a reader's job at review time. (`npm run analyze` does see the files
themselves — see *What these are not* below.)

`plan-editor.html` and `component-gallery.html` have **not** been through it, and they carry the
same `aria-selected`-on-a-`<div>` pattern the canvas page had to fix. That is a known finding about
the existing pages, deliberately left rather than fixed in the change that found it.

## What these are not

- **Not screenshots of the product.** `shots/` does hold screenshots — of these mocks, which
  is what the component notes embed. `src/` is a scaffold; none of this is built, and a PNG of
  a drawing is still a drawing.
- **Not a checked pairing.** `npm run concept-shots` shoots the specimens it finds and writes
  what it shot. A note with no specimen, a specimen whose heading was renamed, an embed
  pointing at a file that no longer exists, a PNG orphaned by a rename — nothing reports any
  of them, here or in `npm run check`. Keeping the notes, the specimens and the files in step
  is a reader's job at review time, deliberately.

  **And "nothing reports it" reached the script itself.** Moving these files from
  `docs/concepts/` left `concept-shots.mjs` pointing at the old path, so every run died
  navigating to a page that no longer existed. Nothing caught it, because nothing runs it:
  it is deliberately outside `npm run check` and outside CI, which is the same property that
  makes it cheap and makes it rot. Fixed, and verified by watching it fail on the old path
  and then write all 17 specimens on the new one.

  The PNGs in `shots/` were last written by the commit that MOVED these files — the same one
  that broke the script — so nothing has regenerated them since. The only change to
  `component-gallery.html` after that point added icons to the shared sprite without
  altering any specimen, so they are believed current; that is an argument, not a
  measurement, and the first person with the pinned Chromium should re-run the script and
  see whether anything moves.
- **Not faithful about a themed vault.** They link `tests/harness/obsidian.css` — Obsidian's
  real app.css, *reduced* — so they show Obsidian's **default** appearance, not a community
  theme's, not a user's accent, and not an element default the reduction dropped.
- **Not a check — with ONE exception, and it was found the hard way.** Nothing in
  `npm run check` reads what is *in* these files: no linter, no test, no renderer. But
  `npm run analyze` walks the whole repository for unreachable files, so a stylesheet added
  here that `.fallowrc.json` does not declare is a **dead file**, and the gate goes red on a
  change that touched nothing but `docs/`. That is exactly what happened when `canvas.css`
  arrived — all four CI legs, on a documentation-only commit. The sentence used to read
  "`npm run check` reads no file in `docs/`" and it was simply false; a claim that survives
  because nobody has yet done the thing that disproves it is the defect this README is
  otherwise about.

  Contrast, focus visibility and hit-target size are still verified in a live vault
  (`npm run test-build`) and nowhere else.
- **Not real data.** Every room, area, price and supplier is invented, per `PRODUCT.md` —
  there is no real renovation project. Each page carries that label in its banner.

## Icons

**Lucide 1.33.0, vendored verbatim** — the set Obsidian ships and `setIcon` resolves against.
The sprite is inlined in each page rather than linked, because `<use href="file.svg#id">`
is blocked cross-origin over `file://` and every `file://` document is its own origin.

Generated, never hand-drawn. The first draft of these pages approximated the paths from
memory and `eye-off` came out as bare lash-marks with no crossed eye — a fake kinder than
the real thing, invisible until someone looked at it at 14px.

One sprite, **45 icons**, substituted into all six pages from a single generated file, so no page
can carry a copy that drifts from the others — checked by hashing the block in each file, which is
also how the fourteen the canvas concept needed (house, chevrons, hammer, camera, signpost,
brick-wall, door, blinds, trees, sticky-note, euro, square-dashed, ellipsis) were confirmed to be
ADDITIONS: regenerating produced a pure insertion and the existing 31 came back byte-for-byte.

That check earned its keep immediately. Four of those 31 lucide names, guessed from the glyph, were
wrong — `asset` is `package`, `box` is `box`, `annotate` is `type`, `derived` is `sigma` — and the
diff is what said so, rather than a reading of the paths. Guessing them right was never the point;
having an instrument that could tell was.

`plan-editor-solo.html` carries the sprite **whole** rather than subset to the icons it happens to
use, for the same reason: a trimmed copy is a copy that can disagree. So does every other page —
`renovation-canvas.html` uses 29 of the 45.

## Contrast

Measured against WCAG 2.2 AA, which `PRODUCT.md` makes binding. Two findings shaped the
design here, and the second is not fixable in this repository:

- **Ours.** The destructive action put `--text-error` on `--background-modifier-error` on
  hover: **1.00:1**, the label gone at the moment of clicking a destructive control.
- **Obsidian's.** In the light default, `--text-faint` is **2.12:1**, `--text-error` tops
  out at **4.20:1**, `--text-warning` is **2.95:1**, and `--text-on-accent` over
  `--interactive-accent` is **3.43:1**. None reaches AA for body text, and raising them
  would mean restating a host value — the one thing SDD §84 forbids.

So the rule these files follow: **colour reinforces, it never carries.** Text takes
`--text-normal` or `--text-muted`; the hue moves to the icon and the border, where WCAG's
3:1 non-text threshold applies. That is the second-channel rule from
[[Design System]] doing real work rather than being restated.

### The canvas weight ladder

Everything drawn on the canvas derives from `--text-normal` at one percentage, so the whole
set is one ladder and can be read as one. Measured against Obsidian's two defaults —
`#222222` on `#ffffff`, `#dadada` on `#1C1C1C` — rather than asserted:

| Element | Share | Light | Dark |
| --- | --- | --- | --- |
| Grid, 1 m | 18% | 1.44:1 | 1.62:1 |
| Grid, 5 m | 30% | 1.94:1 | 2.38:1 |
| Imported plan, detail | 34% | 2.07:1 | 2.59:1 |
| Zone stroke | 54% | **3.54:1** | **4.50:1** |
| Dimension line | 62% | 4.54:1 | 5.48:1 |
| Imported plan, walls | 66% | 5.17:1 | 5.98:1 |

**One of those has to clear 3:1 and does, in both schemes:** the zone stroke is the boundary
of a selectable object, which is what WCAG 1.4.11 is about. The two grid rungs are under it
on purpose, and the justification is this project's own second-channel rule pointed back at
itself — an area is stated as a **number** in four places (rail row, canvas label, inspector
field, status bar), so the grid reinforces a measurement it never carries. `.rp-scene-detail`
was already below the threshold on identical grounds before any of this, so it is an
existing category rather than a new one.

Two of these numbers are also why the zone stopped being accent-tinted. The first version
spent the accent on every zone and then distinguished the selected one by 1.25px of stroke
weight; four rooms and the selection in one hue is a state that cannot be found. The accent
now appears **once per canvas**, and the zone reads from the plan's own ink at a share that
still outranks the imported walls it sits on — a zone is the user's own work on top of
somebody else's drawing and may not be the quieter of the two.

## Two rules the mock keeps

1. **A value the host declares is read, never restated.** Colours resolve to Obsidian
   variables; a tint is `color-mix()` of one, so a themed vault re-tints it.
2. **A value the host does not declare is declared once** — the `--rp-*` block in
   `concept.css`. That block is a proposed answer to [[Design System]]'s open question 1,
   *which Obsidian variable means what on the canvas*, and it is the actual design content
   of these files.

## Demonstrable states

The gallery has to show hover and focus on a page nobody is hovering. It does **not** fake
them with inline styles — every interactive state answers to its real pseudo-class *or* to
`data-demo`, in one selector list, so a specimen and the live control cannot diverge. The
first draft restated the values inline, which is a fake kinder than the real thing.

`concept.css` is scoped entirely under `.renovation-planner-view`, and the header comment
explains why that is a cascade requirement rather than tidiness: app.css's
`button:not(.clickable-icon)` is specificity (0,1,1) and silently beats any single-class
rule, and its `button` padding collapses a small icon button's content box to zero width.
Both were live defects in the first draft of these files.

These pages also opt out of app.css's `html, body` app-shell rules — `overflow: clip` plus
`contain: strict` on `body` makes a document unscrollable, which is correct for a pane and
wrong for a page. `page.css` names the four declarations it undoes.
