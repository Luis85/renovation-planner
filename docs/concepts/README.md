# concepts — HTML mocks

Drawings of the design in [`docs/components/`](../components/), openable in a browser.
Not backlog items and not implementations.

| File | Shows |
| --- | --- |
| `plan-editor.html` | SDD §60's layout assembled: working, first run, trouble, and German. Each editor is a **draggable pane** with a live readout |
| `plan-editor-solo.html` | The same editor, scenario 1 only, **filling the window** and nothing else — no banner, no nav, no toggle, no way back but the browser's. The page for looking rather than for reading. Scheme follows the OS |
| `component-gallery.html` | One specimen per component note, with every state it owes |
| `disclosure-ladder.html` | The six rungs as six surfaces, plus the order as a matrix |
| `settings.html` | The one setting that exists, and what a hand-edited `data.json` renders as |
| `concept.css` | The **proposal** — the canvas visual language, and each component's rules |
| `page.css` | The page's own furniture. Nothing here styles a component |
| `shots/` | One PNG per specimen in `component-gallery.html`, light beside dark, embedded in the matching note in [`docs/components/`](../components/). Written by `npm run concept-shots`. **Nothing checks the pairing** — see below |

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

## What these are not

- **Not screenshots of the product.** `shots/` does hold screenshots — of these mocks, which
  is what the component notes embed. `src/` is a scaffold; none of this is built, and a PNG of
  a drawing is still a drawing.
- **Not a checked pairing.** `npm run concept-shots` shoots the specimens it finds and writes
  what it shot. A note with no specimen, a specimen whose heading was renamed, an embed
  pointing at a file that no longer exists, a PNG orphaned by a rename — nothing reports any
  of them, here or in `npm run check`. Keeping the notes, the specimens and the files in step
  is a reader's job at review time, deliberately.
- **Not faithful about a themed vault.** They link `tests/harness/obsidian.css` — Obsidian's
  real app.css, *reduced* — so they show Obsidian's **default** appearance, not a community
  theme's, not a user's accent, and not an element default the reduction dropped.
- **Not a check.** `npm run check` reads no file in `docs/`. Contrast, focus visibility and
  hit-target size are verified in a live vault (`npm run test-build`) and nowhere else.
- **Not real data.** Every room, area, price and supplier is invented, per `PRODUCT.md` —
  there is no real renovation project. Each page carries that label in its banner.

## Icons

**Lucide 1.33.0, vendored verbatim** — the set Obsidian ships and `setIcon` resolves against.
The sprite is inlined in each page rather than linked, because `<use href="file.svg#id">`
is blocked cross-origin over `file://` and every `file://` document is its own origin.

Generated, never hand-drawn. The first draft of these pages approximated the paths from
memory and `eye-off` came out as bare lash-marks with no crossed eye — a fake kinder than
the real thing, invisible until someone looked at it at 14px.

One sprite, 31 icons, substituted into all five pages from a single generated file, so no
page can carry a copy that drifts from the others. `plan-editor-solo.html` carries it **whole**
rather than subset to the icons it happens to use, for the same reason: a trimmed copy is a
copy that can disagree.

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
