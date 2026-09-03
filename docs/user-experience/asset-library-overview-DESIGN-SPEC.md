# Asset library overview — design specification

**Status:** specification. No code exists for this surface.
**Seed:** surface concept roll `140a13d1`, scope `surface`, mode `operate`. Dealt structures 7, 2, 5;
index 7 led. The user locked **index 5, category shelves**, against the lead — recorded because a
locked card that was not the lead is the roll working rather than a note about process.
**Raised by:** `rw-centre-rail-reference-setting` (**competitive** — holds product clarity, a
catalogue is a reference work; loses audience identification, and its palette and type are
unavailable to a plugin that must render in the host's variables). One discipline taken:
**every state is a printed mark, never a colour** — which is the accessibility rule PRODUCT.md
already binds, arriving as a form decision rather than as a compliance note.
`medium-native-hypercard-stack-shoebox` — **declined**; one line kept: browse and author stay one
keypress apart, so the inspector edits in place rather than handing every correction to a dialog.
The other four challengers declined with nothing this surface could carry.

---

## 1. What this surface is

The vault's asset catalogue, as a place rather than as a picker.

Since design slice 19 the catalogue is **vault-wide**: an asset carries no project id, the notes
live under the configurable library folder (§83, default `Renovation/Library`), and one definition
serves every project. Today the only ways to reach one are `open-asset-designer`'s fuzzy picker —
which requires already knowing the name — and the assign-asset control inside a Plan Editor's
Inspector. There is no surface on which the catalogue is *visible*. That absence is what this
specification closes.

### The three jobs, confirmed

1. **Find before redefining.** [[Searchable asset catalog]]: *a renovator finds the asset they
   already defined before they get round to defining it twice.* This is the surface's reason to
   exist; the other two are what a person does once they have found the thing.
2. **Maintain the definitions.** Correct a stale price, a waste factor, a supplier, a SKU. Every
   one of these is already a command (`UpdateAsset` takes eight fields, `SetAssetHeight` takes the
   ninth, `DeleteAsset` exists) — so this job needs a read model and a surface, and no new
   application-layer work at all.
3. **See where an asset is used.** Which projects lean on this definition, before its price is
   edited or it is deleted. `ListRequirementsReferencing` already answers exactly this, grouped by
   project, and it is the same read slice 15's delete-confirmation flow performs.

**Deliberately not a job: the library as money.** Assets carry their own currency and projects
carry theirs (§72), so a catalogue-wide total is not summable and any figure claiming to be one
would be a lie in the one product whose claim is that the numbers are derived. No totals row, no
aggregate, no "library value".

---

## 1a. What the epic asks, feature by feature

[[Asset library]] is an **Active MVP epic** with four features under it. This surface is not any
one of them; it is where three of the four become reachable, and reading them changed the spec in
four places rather than confirming it.

| Feature | What it asks | What this surface owes it |
| --- | --- | --- |
| [[Searchable asset catalog]] | *"A renovator finds the asset they already defined before they get round to defining it twice."* Routed explicitly through §40's search and **§41's Bases integration**, "rather than only through a picker this plugin draws" | The whole of job 1 — **and §2a below**, because that sentence is a warning about the kind of thing this surface is |
| [[Asset definitions and categories]] | Seven categories with **§84 making the list extensible**. *"The price lives on the definition and the reference stays a reference, so a price correction reaches every room it was used in"* | The shelves (§3.2) and the price edit (§3.5) — both changed by reading it |
| [[Geometry-linked quantities]] | A quantity derived from the plan's geometry, updating when the plan changes | **Nothing**, and §3.4 was overclaiming that it did |
| [[Asset placement]] | Putting a defined asset somewhere on §13's asset layer | Nothing — an anti-goal (§10), and the reason it is one was stated wrongly |

### The category vocabulary is not closed, and today's code enforces it as though it were

The epic's Definition of Done: *"Asset categories are configurable (§84) and Custom stays
available; **an unrecognised category is kept as written**."*

That is unmet, and not merely unbuilt — the current behaviour is its opposite. `assetFrontmatter.ts`
validates `category` through `kebabEnum(ASSET_CATEGORIES)`, which on an unknown value adds a schema
issue and returns `z.NEVER`, so **the whole note fails to parse**. A user who types
`category: insulation` does not get it kept as written; they lose the entire asset, which surfaces
on this very screen as a number in the some-unreadable strip (§4) and nowhere else, with nothing
saying which note or why.

Two consequences, and the first is why this section exists at all:

- **Category shelves is the composition most exposed to §84.** It puts the vocabulary on screen as
  the surface's spine. A ledger with a category *column* absorbs a growing list without noticing;
  a shelf per category does not. That is a real cost of the locked structure and it is stated
  here rather than discovered by whoever ships §84.
- **So the shelves are derived, never enumerated** — §3.2. The prototype already draws it.

**This surface does not fix the parse.** Widening `kebabEnum` for one field is a persistence change
with a schema-version question attached (§84 also names Zone, Trade, Document and Cost types, so a
one-field fix is the first of five spellings), and it is not a view's to make. What this document
does is stop specifying a composition that assumes the closed vocabulary its own epic says is going
away.

## 2. Placement

**Its own workspace surface** — a fourth registered view, `renovation-asset-library`, singleton.

| | |
| --- | --- |
| View type | `ASSET_LIBRARY_VIEW = 'renovation-asset-library'` — persisted in Obsidian's workspace layout, so it is **data** and never renamed |
| Registration | `registerView` in `RenovationPlannerPlugin`, per `registration-locality.test.ts` |
| Command | `open-asset-library` — a plain callback, not a `checkCallback`; the lesson `open-plan-editor` already paid for is that a command gated on the active note is a command absent from the palette in every vault that has none of the thing |
| Ribbon | **No second ribbon icon.** The ribbon is shared real estate across every installed plugin and this surface is reached often but not constantly. A command plus an in-app door is the whole of it |
| In-app door | `ProjectList`'s header gains an **Assets** control beside its existing `New asset` button. `ProjectList` is where a user already is when the thought "have I got a definition for this?" arrives |
| Reveal | Through `revealView(ASSET_LIBRARY_VIEW)` — the one activation function, per the *one action, every input* rule, which is also what stops a double click opening two tabs of a singleton |

`open-asset-designer`'s fuzzy picker **stays**. It is a different gesture: jump straight into
designing an asset whose name you already know. This surface is for the case where you do not.

### Why not a state of the Renovation project view

Because the catalogue is not under a project, and a third state on that view would have to answer
"whose assets" with "everybody's" — a hierarchy the surface's own back button would then contradict.
The project view's states are `list → one project`; assets are a sibling of that whole ladder.

---

## 2a. Bases, and what this surface must not become

[[Searchable asset catalog]] does not merely permit a Bases route; it names one as **the** route:
*"the catalog should be searchable through Obsidian's own machinery rather than only through a
picker this plugin draws."* The epic's Definition of Done says the same from the other side — the
catalog is reachable through Bases "**rather than only through this plugin's own views**" — PRD §41
lists *Assets* among its potential Bases views, and PRODUCT.md's fifth principle makes it a rule
for everything: nothing is canvas-only, and every object stays reachable from a list, a note or a
Bases row.

This surface is a picker this plugin draws. So it owes two commitments rather than one.

**It may not be the only route, and it does not discharge that Definition of Done item.** An asset
is a Markdown note with frontmatter; a Bases view over `type: renovation-asset` is a user's to
build and this plugin must not stand between them and it. Concretely: **no fact about an asset may
exist only in this view.** Every column §3.3 draws is a frontmatter key, every field §3.5 shows is
one, and where this surface derives something (§5.3's shape state) the derivation reads a file the
user can open. A sort order, a grouping or a filter invented here that has no counterpart in the
note is a fact Bases cannot see, and the moment one exists the epic's item is not merely unticked
but unreachable.

**What it does that Bases cannot**, which is the honest case for building it at all:

- **The geometry mark.** A Bases row cannot read a `.rpgeo` sidecar, let alone draw the polygon in
  it. This is the one thing on the surface with no Bases equivalent, and §3.4 is the argument.
- **The shape state.** Measured, unscaled, absent, unread — derived per read from a file that is
  not the note.
- **Where-used.** A roll-up across every requirement in every project (§5.2), which is a join
  Bases has no way to express.
- **Recognition over recall.** Shelves are for the user who does not know the name. A Bases table
  serves the user who does, and serves them better.

Read that list as the specification's own scope test: a feature proposed for this surface that a
Bases view would do as well belongs in Bases.

## 3. The composition

Four shell regions, which is the **Asset designer's** count rather than the Plan editor's five —
a library has nothing to layer, exactly as a single object had nothing to layer.

```
┌─────────────────────────────────────────────────────────┐
│ TOOLBAR   [search field……………]        [ New asset ]      │
├──────────────────────────────────┬──────────────────────┤
│ SHELVES (scrolls)                │ INSPECTOR (rail)     │
│                                  │                      │
│  ▾ Material                  34  │  Oak plank floor     │
│    ▢ Oak plank floor  €34.95/m²  │  ──────────────────  │
│    ▢ Wall paint, white €18.40/m² │  Category   Material │
│    …                             │  Unit       m²       │
│  ▸ Fixture                   12  │  Unit cost  €34.95   │
│  ▸ Furniture                  8  │  Waste      +8%      │
│  ▸ Plant                      0  │  …                   │
│                                  │                      │
├──────────────────────────────────┴──────────────────────┤
│ STATUS   54 assets · Renovation/Library                 │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Toolbar

One search field and one `New asset` button. Nothing else — no sort control, no view switcher, no
filter menu. The shelves *are* the filter, which is the whole argument for this structure over the
filtered ledger it beat.

`New asset` opens the existing `NewAssetForm` dialog through the existing `DialogHost`. Unchanged.

### 3.2 Shelves

**The shelf list is DERIVED, never enumerated**, and that is §1a's finding landing rather than a
style preference. Two groups, in this order:

1. **Every category the build declares**, in `ASSET_CATEGORY_LABELS`'s order — the same order
   `NewAssetForm`'s own control renders, so the category a user picked in the form is in the
   position they picked it from. All of them, empty ones included.
2. **Every category the vault actually names that the build does not declare**, after those,
   ordered by `localeCompare`. **Kept as written** — not case-normalized, not retitled, not folded
   into `custom` — because that is the epic's own words for what an unrecognised category is owed.

A configured eighth category (§84) joins group 1 the day the vocabulary declares it, with no edit
to this surface. A category somebody typed appears in group 2 with no edit either. A literal seven
is the one arrangement that could answer neither.

The two groups differ in exactly one property, and it needs saying out loud because it looks like
an inconsistency: **a declared shelf can be empty and an undeclared one cannot.** The only evidence
an undeclared category exists is an asset sitting in it, so "draw the empty ones too" applies to
group 1 alone and needs no exception written for group 2.

**A declared shelf with zero assets still draws its header, greyed and non-interactive, with the
count `0`.** This is the structure's main risk answered rather than dodged: six assets under one
heading beside six empty ones reads as a system with room in it, where six headings silently
omitted reads as a system that has decided what you are allowed to own. It is also what makes the
declared categories learnable, which is the *find by recognition* claim the structure was chosen
for.

**That rule has a ceiling and the ceiling is not specified.** It is plainly right at seven and
plainly wrong at twenty-five, where the empty headings stop reading as room and start reading as
the clutter this paragraph is defending against. Whoever ships §84's configuration surface owns
that number; §11 carries it as a decision rather than leaving it to be discovered by the first
vault with a long vocabulary.

Shelf header anatomy:

- an `<h3>` containing a `<button aria-expanded>` — the whole header row is the target, per WCAG 2.5.8's 24px floor;
- a disclosure mark (a triangle, rotated, CSS-drawn, `aria-hidden`);
- the category label;
- the count, right-aligned, muted, `tabular-nums`.

Rows sit in a `<ul>` per shelf, one `<li>` each. Within a shelf, **rows sort by name**, locale-aware
(`localeCompare` under the resolved language), because the only other candidate — most recently
edited — answers a question about the vault rather than about the renovation.

### 3.3 The row

A dense row of five slots. **No column header row**, and that is a decision with two reasons: a
header per shelf repeats one row as many times as there are categories, which is a number §3.2 has
just made variable, and every value here is self-describing — the cost carries its
unit (`€34.95 / m²`), the waste carries its sign and its percent (`+8%`). A header row would also be
the one place a German label could clip, which is the width finding `docs/user-experience/concepts/README.md`
already recorded against the left rail.

| Slot | Content | Drops at |
| --- | --- | --- |
| Mark | the asset's own footprint, drawn (§3.4) | never |
| Name | ellipsing, `min-width: 0` | never |
| Unit cost | `€34.95 / m²`, `tabular-nums`, right-aligned | never |
| Waste | `+8%`, or nothing when the default is zero | < 520px |
| Supplier | muted, ellipsing | < 640px |

`min-width: 0` on the name is load-bearing and is not a detail: `.rp-project-detail__name` already
paid for its absence at 460px, where a long name refuses to ellipse and pushes its neighbours off
the row.

A row is a flattened `<button>` in the vocabulary `styles/list-row.css` already defines for the
project and plan rows — which means it must be selected **under** its block class
(`.rp-asset-shelf .rp-asset-row`), because Obsidian's own `button:not(.clickable-icon)` is (0,1,1)
and a bare class is (0,1,0) and loses silently. `tests/build/buttonSpecificity.test.ts` is the
category check for that, and it reads every shipping sheet, so this one is inside its scope the day
it exists.

**Selection is a printed mark, not a tint.** A selected row carries a 2px filled rule at its leading
edge plus `aria-current="true"`; the background tint rides along as the third channel, never as the
only one. `aria-current` rather than `aria-selected`, which is only valid on a handful of roles
(`option`, `row`, `tab`, `gridcell`, `treeitem`) and would be an ARIA violation on a `<button>` —
the rule is drawn with an inset `box-shadow` rather than a border so it costs no layout and cannot
shift the grid by 2px against every unselected row beside it. This is the raise from the reference-setting challenger, and it is also PRODUCT.md's
"no status, state or category encoded by colour alone" arriving where it is easiest to lose.

### 3.4 The geometry mark

**The one thing on this surface that no neighbouring product could copy.** A 20×20 box at the row's
leading edge, drawing the asset's actual footprint from its geometry sidecar — the outline the user
traced in the Asset designer, fitted to the box, at its true aspect ratio. A radiator reads as a
radiator; a tile reads as a square; a shrub reads as whatever the user drew. It is not an icon: no
asset gets a picture of its category, because a picture of a category is decoration and this is data.

**Which geometry, precisely — the first draft of this paragraph was loose and reading
[[Geometry-linked quantities]] is what caught it.** There are two geometries in this product and
they do different work. The one that produces a quantity is the **zone's**: a floor area against a
tile's coverage, a perimeter against skirting sold by the metre. The one drawn here is the
**asset's own**, captured in the Asset designer, and it feeds [[Asset placement]] rather than the
cost engine — a tile's 600 × 600 footprint has no part in the m² its room needs. So the mark is
not "the moment the product's premise pays out"; that moment happens on a plan, in a requirement.
What the mark is, is the only place in the product where an asset's *definition* shows that it has
a real shape rather than only a price — and a definition that knows its own dimensions is what a
placement will need. Overclaiming it as the quantity chain would have been a small lie in the one
product whose whole argument is that its numbers are derived.

Four states, each a **printed mark** and none of them a colour. Every one differs from every
other in KIND rather than in weight, and that is a correction the prototype forced rather than
a rule this section always held — see §12:

| State | Drawn as |
| --- | --- |
| Footprint, measured | the outline, solid hairline stroke, fitted with a 2px inset |
| Footprint, **unscaled** | the **same outline, dashed**. The proportions are real and the scale is not, which is exactly what a provisional stroke over true geometry says |
| Not yet read | **three dots**, centred. Not a shape at all, so no footprint can collide with it, and it is already the printed mark for *still coming* |
| No shape yet | **nothing**. An empty slot is the one thing no other state can be mistaken for, and a drawn box for *there is no shape* is scaffolding pretending to be data |
| **Unreadable** | a **struck box** — the only state that draws a box at all, so nothing can confuse it with a square footprint. A box says something *is* there; the cross says it is spent |

The third state is not a skeleton animation; it is what the row draws before its shape arrives,
and it has to be distinct from *no shape yet* or the surface asserts an absence it has not
checked.

**The fifth arrived late and the first four were incomplete without it.** `AssetGeometryStore`
refuses a damaged sidecar rather than repairing it — `asset-geometry.unreadable`, `corrupt`,
`schema-invalid`, `asset-id-mismatch` — and a refusal is a third outcome beside *read it* and
*there is nothing there*. Neither neighbour can carry it: **`No shape yet` reports an absence
that is false**, over a file sitting on disk, and **`Not yet read` leaves a mark loading for the
rest of the session**. The table above was written as though a read could only succeed or find
nothing. Reported by a review bot. The 20px column is held by the `<svg>` element, which renders in every state including
the empty one — removing it would let the grid pull every later slot one column left.

The clearance boundary, the anchor and the facing are **not** drawn at 20px — they are mush at
that size. **The clearance's extent goes to the inspector as a number; the anchor and the facing
go to the DESIGNER**, and §3.5 carries the reason that reversal took three review rounds to
reach.

The mark is `aria-hidden`; the shape's state is written in words in the inspector, so nothing is
carried by the drawing alone.

### 3.5 Inspector

The `<dl>` in a two-column grid that `.rp-designer-inspector-fields` and
`.rp-editor-inspector-fields` both already are, with `<dt>` labels above-left and `<dd>` values.
A user moving between the Plan editor, the Asset designer and this surface must not be able to tell
that three people wrote them.

Four sections, in this order:

1. **Definition** — name, category, unit, unit cost, waste factor, supplier, SKU, notes, height.
   **Editable in place**, committed on blur or Enter through `useFieldCommit`, dispatching the
   existing `UpdateAsset` / `SetAssetHeight`.

   **A price edit here reaches every project that references the asset**, which is
   [[Asset definitions and categories]]'s whole point — *"the price lives on the definition and the
   reference stays a reference, so a price correction reaches every room it was used in"* — and it
   is what makes section 3 below load-bearing rather than informational. The blast radius of the
   field a user is about to edit is on screen above the field. That relationship is the argument
   for keeping *Used in* in this panel rather than behind a disclosure, and it is why the section
   loads on selection (§5.2) rather than on demand. A rejected commit keeps what the user typed and shows
   a persistent inline error under the field it is about — never reverts, per slice 16's rule.
   `routeError` maps `UpdateAsset`'s codes to fields; `asset.unit-kind-referenced` (a unit
   edit crossing `UNIT_KIND` while a Requirement still references the asset) routes to the **unit**
   field, because that is the field that is wrong.
2. **Shape** — everything §3.4 sends here because it is mush at 20px, which the first version of
   this list promised and then did not enumerate:

   | Row | Shows | Absent |
   | --- | --- | --- |
   | Footprint | `1200 × 190 mm`, the extent derived from the outline | omitted |
   | Clearance | its own extent, `1400 × 400 mm` | `None` |
   | Spec sheet | the file's name | omitted |

   plus **a pending warning per coordinate group**, and **Open designer**.

   **Height is NOT here, and the rule that decides it is worth stating rather than the row.**
   *Shape lists what the sidecar derives; Definition lists what the note stores and a field
   edits.* A height is on `Asset`, not on `AssetShape` — typed in millimetres, carried by the
   note, changed by `SetAssetHeight` — so it is section 1's, beside the unit cost and the SKU,
   and putting an editable field in a read-only inventory is what makes "which section owns the
   control" unanswerable. It also fails this section's own admission test: these rows are here
   *because they are mush at 20px*, and a height is not on the mark at all.

   **This row existed for exactly one round and it was an over-correction of mine.** The round
   before reported the missing *Spec sheet* row and said nothing about height; reading the Shape
   table as authoritative, I moved height into it without re-reading section 1, which already
   listed it — so the fix for one section-against-section contradiction created another, in the
   same edit. Reported by the next round. The lesson is not the row: **when a report names one
   row of a list, re-read the neighbouring list before moving a second.**

   **The anchor and the facing are NOT here, and that reverses what §3.4 promised.** They were,
   for three review rounds, and each round found the copy wrong in a different way: `Set` /
   `Not set` was unrepresentable, `Centre` was false for a traced footprint whose origin is
   wherever the canvas origin fell, and an offset needed a bounding-box computation to be true at
   all. Every fix was buildable. The question none of them asked is whether the rows serve this
   surface's jobs — and they do not: an anchor coordinate answers nothing about *finding an asset
   I already defined*, *correcting its price*, or *seeing where it is used*. They are spatial
   facts, a definition list is the wrong instrument for one, and the Asset designer **draws**
   them, one click away, where they can be read rather than parsed.

   So the narrowing is a design decision rather than a retreat from a hard fix, and this is where
   this repository's own rule lands: *write the guarantee to the check, and if narrowing makes the
   sentence ugly, the sentence has become honest.* The clearance stays because an extent is a
   number and a fitting question is the one spatial thing a catalogue reader might ask; that it
   earns its row is a weaker claim than the footprint's, and it is stated as one.

   **A pending warning belongs to its own coordinate group, not to the shape.** `AssetShape`
   carries `footprintPending`, `clearancePending` and `anchorPending` independently — one flag per
   group, which the Asset designer's own increment records as the rule — so a typed footprint can
   sit beside a clearance traced before a scale existed. A single shape-level state would then
   print `1200 × 700 mm` over placeholder-space coordinates. Each row withholds its unit and
   carries its own warning while its group is pending.

   **Two earlier versions of these rows are recorded in §12 and are NOT instructions.** They said
   `Set` / `Not set`, then `Centre` and a degree-converted facing; both are superseded by the
   removal above, and neither is a contract a builder should reconstruct. What survives from them
   is one fact worth keeping where the code is: `AssetShape.facing` is radians, so anything that
   ever prints a bearing converts.

   Reported in the round before: §3.4 and §5.3 both send these three to the inspector, this
   section listed four rows that did not include them, and §8 defined no labels — so the promise
   existed in two places and its representation in none.

   **The section has its own three states, exactly as *Used in* does** (§3.5), because it is the
   other selection-triggered read. `GetAssetDesign.execute` returns the sidecar's error rather
   than a DTO, so a corrupt sidecar leaves this section with nothing while the catalogue entry
   above it is perfectly readable:

   - **In flight** — a loading line in this section alone; the definition fields are already
     drawn from the catalogue read and stay usable.

     **Neither this state nor the refused one may state an ABSENCE**, which the first version of
     these rows got backwards: *Clearance* fell back to `None` whenever no extent was present,
     so a sidecar that refused or had not been read yet reported *this asset has no clearance
     boundary* — a claim the read never returned anything to support. Footprint and Clearance
     are drawn only once the read has ANSWERED; `None` is then true, because a succeeded read
     with no outline is a real absence. It is the distinction §3.4's mark already draws between
     `none` and `unreadable`, and this panel was drawing it the other way round one layer down.
     **The spec sheet survives both states**: its reference rides on `CatalogueEntryDto` from the
     catalogue read, which succeeded, and it is the one thing a user can act on when a shape will
     not parse.
   - **Refused** — and **which refusal decides both the wording and whether `Open designer`
     stays**, because `AssetDesignError` is `RepositoryError | ReferenceError | GeometryError`
     and only one of those three is a damaged sidecar:

     **Keyed on the CODE, never on the union arm**, and the first version of this table got that
     exactly backwards:

     | Cause | Says | `Open designer` |
     | --- | --- | --- |
     | `asset.not-found` | the asset is gone, with a way back to the list | **withdrawn** — there is nothing to open |
     | any `asset-geometry.*` — `unreadable`, `corrupt`, `schema-invalid`, `asset-id-mismatch` | §3.4's `unreadable` wording, naming the sidecar where the error carries its path | **withdrawn** — see below |
     | anything else | the vault read failed, retryable | withdrawn until a read succeeds |

     **That middle row said `Open designer` STAYS, on the grounds that "the designer is where a
     damaged shape is repaired" — a claim about the designer that I never checked, and it is
     false.** `GetAssetDesign.execute` is `if (isErr(snapshot)) return snapshot;` — a sidecar
     refusal fails the whole design read — so the designer hydrates through the same query, its
     store reaches `failed`, and `AssetDesignerRoot` renders a `ViewFailure` whose only action is
     Retry. There is no canvas, no background picker and no delete: the button sends the user to
     a screen that repeats the refusal they just left. **A live control that does nothing is the
     failure mode slice 14's own amendment refuses**, and this one is worse than inert — it costs
     a navigation to find that out.

     So it is withdrawn for these codes until the designer has a repair path. **The gap is the
     designer's rather than this surface's**, and the honest remedy — a way to replace or discard
     an unreadable sidecar — is a change to that view, not a row in this table; §11 carries it as
     a decision rather than this section inventing one. What is left for the user today is the
     `.rpgeo` file itself, which is why the wording names it where the error carries a path.
     Reported by a review bot, which read `AssetDesignerRoot` when I had only read the table.

     The union arm cannot make this distinction. `AssetGeometryStore.readUnlocked` raises all four
     sidecar failures as `PersistenceError` or `ValidationError`, and `RepositoryError` is
     `PersistenceError | MigrationError | ValidationError` — so a table with a `RepositoryError`
     row selects **exactly the damaged-sidecar cases** and withdraws the one action that repairs
     them. Meanwhile `GeometryError` reaches `GetAssetDesign` from `dimensionsOf` when an extent
     overflows, which is not a damaged file at all. Reported by a review bot citing both files.

     A single branch, which is what this started as, would have told a user whose asset had just
     been deleted that *a stored shape file could not be read*, and offered to open a designer on
     nothing.
   - **Answered** — the rows above.

   §4's failure row covers the catalogue read and cannot cover this one: replacing the whole
   panel because a sidecar will not parse would hide a name, a price and a supplier that are
   fine.
3. **Used in** — the per-project groups, loaded **on selection** (§5.2). One row per project:
   project name, requirement count, **and the project's path wherever the query supplies one**.
   `ListRequirementsReferencing.withPathsWhereAmbiguous` sets `projectPath` on exactly the groups
   whose name is not unique among the groups returned — a collision a vault legitimately holds,
   since `Project.create` trims a name and refuses only an empty one — so discarding it renders
   two identical rows for the two things the user is being asked to tell apart, immediately before
   an edit or a deletion. Shown only where the query supplies it, which is the rule that keeps a
   path off every row on the common case — and **"supplied" is tested against `undefined`, never
   against truthiness**, because `''` is a supplied answer. `projectFolderOf` is `parentOf(path)`
   and `parentOf` slices to the last `/`, so a `Project.md` at the vault root derives the empty
   string; `joinFolder`'s own docblock names that case as the one it exists for. A truthy test
   suppresses exactly the row the path was added to disambiguate and draws it identically to a
   row whose path was never supplied — the collision restored, in the one member of it that has
   no folder to name. The empty string renders a root label rather than nothing. `Not used in any project` when there are none, which is the
   sentence that makes a deletion safe to reason about, and the sentence a price edit is read
   against.

   **It is a SECOND read, so it needs its own states.** §4's failure row covers the catalogue
   read; this one can be in flight or refuse while the catalogue around it is perfectly readable,
   and the section is presented as the blast radius of an edit or a deletion — so the difference
   between *nobody uses this* and *I could not find out who uses this* is exactly the difference
   between a safe deletion and a destructive one. Three states, not one:

   - **In flight** — a loading line in this section. The definition fields above it are already
     drawn and stay usable; only this section waits.
   - **Refused** — the mapped sentence for the error's own code, in this section, plus the one
     consequence that matters: **`Delete` is unavailable while the usage read has not
     succeeded**, with the reason on the control. An edit stays available, because a price
     correction is recoverable and a deletion is the gesture this panel exists to inform.
   - **Answered** — the groups, or `Not used in any project`, which now means what it says.

   Reported by a review bot: the first version offered groups or "not used" and nothing else, so
   an unreadable usage graph rendered as an unused asset.

   **It is a SNAPSHOT taken at selection, and it does not subscribe.** That is a decision rather
   than an omission, and it took being wrong twice to reach:

   - A Plan Editor in another leaf assigning this asset publishes `RequirementCreated`, and the
     event **cannot be filtered to the selected asset**: `RequirementEventPayload` is
     `{ requirementId, projectId }` and `AssignAsset` publishes exactly those two fields.
   - **Undoing that assignment publishes nothing at all.**
     `ReversibleAssignAssetCommand.undo` calls `requirements.delete` directly, and
     `Requirement.events.ts` declares `RequirementCreated`, `RequirementInvalidated`,
     `RequirementRecalculated` and `CostEstimateChanged` — there is no `RequirementDeleted`.
   - And an unfiltered re-run is **not cheap**. `ObsidianRequirementRepository.listByAsset` calls
     `index.getIdsByType('renovation-requirement')` — every requirement id in the vault — and
     `filterLoaded` reads each note through `getById` before applying the asset predicate. It is
     O(all requirements in the vault), with a note read each.

   So subscribing would buy a vault-wide scan per assignment made anywhere, to catch one of the
   two directions this panel can go stale in. The panel reads once per selection instead, and
   **says so**: reselecting is the refresh, and the surface does not pretend to be live about
   something it cannot see half of.

   **The middle bullet is a correction of a correction, and it is the sharpest mistake on this
   branch.** An earlier draft said exactly the right thing — that re-reading on every event scans
   every requirement in the vault. The round after, I "corrected" it to *bounded by the one
   selected asset's own referents*, having read `listByAsset` as an indexed lookup because of its
   NAME rather than its body. A true statement was replaced with a false one **inside a paragraph
   arguing that an overstated cost is how a good design gets refused** — which is the same error
   in the opposite direction, and worse, because it would have shipped an expensive subscription
   under a sentence promising it was cheap. Reported by a review bot citing the file and lines.
   *A performance claim read off a method name is not a measurement.*

   The cost is not this surface's alone: `ListRequirementsReferencing` is what slice 15's delete
   flow already runs, so every asset and zone deletion pays it today. That is pre-existing and
   out of scope here, and it is what makes the §11 decision worth taking rather than routing
   around.

   **§11 carries one decision covering both gaps**: `assetId` on the requirement event payload
   and a `RequirementDeleted` sibling. **This is the second time this repository has met that
   shape** — `projectListChangeSource`'s own docblock once said "there is no `ProjectDeleted` to
   add here until something raises one", which CLAUDE.md records as reading like a survey of the
   ground while actually describing a missing publisher one layer down. One entity over, same
   sentence.

   **It shows no per-project price.** The epic's last open item is §89's override — a project
   recording its own price against a shared definition — and when it lands, the number in section 1
   is still the **shared default**, because that is the only price a vault-wide surface has any
   business asserting. An override is a fact about a project and belongs on a project's own
   surface. What is genuinely open is whether these rows should then *mark* which projects
   override, since this is the one screen where "your correction will not reach these three" could
   be said at all; §11 carries it rather than this section deciding it.
4. **Actions** — `Open designer` · `Open note` · `Delete`.

`Delete` goes through the existing reference-resolution flow (slice 15's `DeleteReferenceDialog`,
slice 10's resolution): the *Used in* section the user is already looking at is literally the read
that flow performs, which is why this surface can offer the gesture without inventing a second
answer to "what does deleting this break".

**A successful deletion must say where focus goes, and the framework has already declined to.**
`DialogHost` restores focus to whatever opened the dialog — and its own comment records that this
is *"a no-op, not a fallback, if `previouslyFocused` was removed from the DOM while the dialog was
open (the delete flows open from a control their own resolution removes) … focus is left wherever
the removal left it — typically `<body>`."* Restoring to a view root instead was explicitly
declined there as a change that task had no mandate for. So it is this surface's to answer, and
without an answer a keyboard user who deletes an asset is returned to the top of the document with
the panel they were working in gone.

**A deletion is a `back()` that cannot return to its row.** The inspector withdraws to its resting
state and focus goes to the **next row in the shelf the asset was in**, falling back in order to:

- **that shelf's header**, when the deleted asset was its last row;
- **the search field**, when the shelf itself is gone — which is reachable rather than theoretical,
  since an undeclared shelf exists only because an asset sits in it (§3.2), so deleting the last
  `insulation` asset removes the `insulation` shelf.

That is the same three-step shape `back()` already takes, and for the same reason: the destination
can be absent, and a focus rule that names one target is a rule for the case its author happened to
picture. Reported by a review bot — the **fourth** direction of this one gesture to be found by
somebody other than me, which §12 records as its own finding rather than as four incidents.

**The prototype does not draw it**, and that is consistent rather than an omission: nothing in the
mock commits an edit, because every write on this surface belongs to a real command. It is the one
focus rule here specified and unphotographed, and it is named as such in §12 rather than left to
read as covered.

### 3.6 Status bar

`54 assets · Renovation/Library`. Two facts, both otherwise invisible: how large the library is, and
where it lives — the second being a setting whose row in the settings pane is deliberately
informational, because a control on `libraryFolder` would persist a folder with no notes moved.
A user who has just moved their library needs one place that says where it landed.

---

## 4. States

| State | What draws |
| --- | --- |
| **Loading** | The shell, with a loading line in the shelves region. Never a spinner over an empty pane. **Held until the index scan has run** — see below |
| **Empty** — no assets at all | `EmptyState` with a new registry entry `assetLibrary.noAssets`, headline, body, and an action button wired to `New asset`. Replaces the shelves region, not the shell: the toolbar and status bar stay |
| **No matches** — search returns nothing | `assetLibrary.noMatches`, with an action that **clears the search field**. An action that restores the previous view, not one that creates something |
| **Some unreadable** | The additive `.rp-view-notice` strip above the shelves, mirroring `view.project.some-unreadable`. The shelves still draw. Requires the list query to answer `{ assets, unreadable }`, the shape `ProjectListResult` already has |
| **Failed** — the whole read refused | `ViewFailure`, with a retry, except where `viewHydrationOrigin` says otherwise |
| **Failed, unrecoverable** — `settings.unrecovered` | `ViewFailure` with **no retry button**: nothing was composed to re-run, so a retry is a live control that does nothing, which is the failure mode slice 14's own amendment refuses |

**An empty answer before the index has been scanned is not an empty vault, and on this surface
that mistake invites the exact duplicate the feature exists to prevent.** Obsidian restores its
leaves *before* `onLayoutReady`, and the scan runs from it — `RenovationPlannerPlugin.startPersistence`
rebuilds the index and only then sets `indexScanCompleted` and publishes `ProjectIndexRebuilt`.
`ObsidianAssetRepository.listAll()` is `this.list(index.getIdsByType('renovation-asset'))`, so
before that rebuild it enumerates nothing and answers a perfectly legitimate `ok([])`. A view
mapping that straight to the table's **Empty** row draws *no assets yet* over a full catalogue,
with a `New asset` button under it — a renovator who takes that invitation defines a second
*white wall paint*, which is [[Searchable asset catalog]]'s own stated failure. A restored
selection flashes the gone screen for the same reason.

So **the view holds Loading until `indexScanCompleted` answers true**, and re-reads on
`ProjectIndexRebuilt`. Two things make this a precedent rather than a new mechanism. It is what
the project detail state already does, for a defect **reported from a real vault** and recorded in
that code's own comment: *"a Plan Editor reopened with the app hydrated against an empty one and
said 'this plan no longer exists' about a plan that does."* And the question is whether the scan
**ran**, never whether it **found** anything — asking "is the index populated" instead hangs a
restored pane for ever in a vault whose last asset note was deleted while Obsidian was closed.

Reported by a review bot against this document. Nothing here could have caught it: the prototype
has no index, and every state above draws correctly from a fixture that is never empty by accident.

Both action-bearing empty states are **scanned by `tests/harness/accessibility.test.ts`** on the day
they ship, asserting `.rp-empty-state` and `.rp-empty-state__action` are in the scanned DOM.
`planEditor.noZones` went seven slices unscanned because the case's fixture resolved to a different
entry; a fixture is what decides which state an axe scan actually grades.

---

## 5. Data

### 5.1 What the surface reads

A new query and a new read model. Nothing else in the application layer changes.

```ts
// application/queries/ListCatalogueEntries.ts
interface CatalogueEntryDto {
  assetId: AssetId; name: string; category: string;
  unit: MeasurementUnit; unitCostAmount: string; currency: Currency;
  wasteFactorDefault: string; supplier: string | null; sku: string | null;
  height: number | null; notes: string | null;
  background: AssetBackgroundRef | null;
}
interface CatalogueListing { entries: readonly CatalogueEntryDto[]; unreadable: number; }
```

`ListAssets` exists and answers `Asset[]` for the assign picker. It is **not** reused: it returns
domain entities, it drops the unreadable count, and a picker's read and a browsing surface's read
diverging later is cheaper than one query serving two surfaces badly. `Money` is decomposed into an
amount **string** plus a currency at this boundary, exactly as it already crosses every other one —
a float is what ADR-010 refuses.

**`notes` and the whole background reference, not a boolean.** The first version of this DTO
carried `hasBackground: boolean` and no `notes` at all, while §3.5 specifies an editable notes
field and the spec sheet's *name* — so an implementation following this contract could not have
drawn the inspector it was told to draw, and nothing else in §5 supplies either. Reported by a
review bot against a document, which is the cheapest place that could ever have been caught.

**`category` is a `string`, not `AssetCategory`.** §1a: the vocabulary is extensible and an
unrecognised category is kept as written, so a DTO typed to today's closed union is a DTO that
cannot carry the value the epic asks to be preserved. The union stays the right type for a
*control* that offers a choice; it is the wrong type for a read that reports what is there.

### 5.1a The `unreadable` count needs a change below the query

**This is the one place the specification's "a new query and a new read model, nothing else"
is false**, and it took a review bot to catch because the sentence reads like diligence.
`AssetRepository.listAll()` answers `Loaded<Asset>[]`, and `ObsidianAssetRepository.list` skips a
note it could not read — recording it to the diagnostics ledger and continuing. There is no count
to return. A catalogue whose every note is unreadable would therefore arrive as
`{ entries: [], unreadable: 0 }` and draw the **no assets yet** empty state (§4), inviting the
user to create their first asset in a library that is full of them.

The adapter's own docblock says so in as many words: its shape is
`ObsidianProjectRepository.listAll`'s *"minus its `refused` count: that exists because the project
list must tell 'no projects' from 'projects I could not read', and the assign picker has no such
distinction to draw."* **This surface is the first caller that does have it to draw.** So the port
gains a listing shape carrying the count, exactly as the project repository's already does, and
that is a change to `application/ports/AssetRepository.ts` and to its two implementations rather
than something a query can paper over. It is small, it has a precedent to copy, and the reason it
belongs in this document is that a spec claiming a layer is untouched is a spec somebody plans
against.

### 5.2 What it deliberately does not read

**Where-used is loaded on selection only.** `ListRequirementsReferencing` reads every requirement in
every project; running it per row would make opening the surface O(requirements), and the figure
would go stale against another leaf's write. One read per inspection instead of N per open.

The cost is stated rather than hidden: **"which of these is unused and safe to delete" cannot be
scanned.** It must be asked asset by asset. Closing that needs the project index to carry an asset
reference, which it does not today — so it is a persistence change and a separate increment, not a
view decision. It is written here so that the next person to want an *Unused* filter knows what it
costs before they promise it.

### 5.3 Geometry, and what it costs

An asset's shape lives in its own `.rpgeo` sidecar (ADR-0014), and **the mark must resolve its path
the way every other reader does: the index first, the derivation as the repair path.**
`AssetGeometryStore.pathFor` is
`index.getGeometrySidecarPath(assetId) ?? assetSidecarPathFor(libraryFolder, assetId)`, and the
ordering is not incidental — both doors that populate that mapping record an asset's sidecar as
well as a plan's (the full scan's `joinSidecars` and `VaultChangeAdapter.processSidecar`), and the
store's own docblock records what deriving unconditionally cost when it did: a `.rpgeo` moved in
the file explorer, or arriving elsewhere through sync, **left the asset reading as shapeless** —
invisible, because an absent sidecar is the ordinary state of an undesigned asset — and the next
design write minted a second sidecar at the derived path beside the orphan. A batched mark query
that derives for itself reintroduces exactly that, on a surface whose whole point is showing which
assets have a shape.

**An earlier draft of this section said the opposite** — "there is no index that can answer 'does
this asset have a shape'" — which was true of the increment that shipped the designer and false by
the time this was written. Reported by a review bot reading the code rather than the sentence. The
correction narrows the cost claim rather than removing it: the index can say *where* the sidecar is
without touching disk, and it cannot say what is in it, so **the outline still costs a read and a
parse per row**. The bound below is unchanged; only its justification is now accurate.

**Bounded by what is ON SCREEN, not by which shelf is open**, and that is a correction rather than
the original rule:

1. A mark is requested when its row **enters the viewport**, in batches, and the answer is cached
   per asset for the life of the view. Expanding a shelf, scrolling, and running a search all
   just change which rows are in view.
2. A row **never waits** for its mark: it renders in the *not yet read* state and the mark fills
   in.
3. Nothing already in flight is cancelled when a row leaves; nothing further is requested for it.

The first version said "per expanded shelf", which had two holes and only the second was reported.
**Search replaces the shelves with a flat Results list**, so no shelf is ever expanded and every
result row would have sat in *not yet read* for ever — contradicting rule 2 one line below it —
while the obvious patch, treating Results as one expanded shelf, reads a sidecar for every match a
broad query returns, which is the bound it was meant to keep. The hole nobody reported is that a
shelf was never a good bound anyway: a Material shelf with 34 entries reads 34 sidecars to draw
the six rows a pane can show.

So the viewport is the honest bound, it needs no special case for search, and it makes rule 1
tighter than the rule it replaces. **The prototype cannot demonstrate it** — every mark there
comes from a fixture with no I/O — so this one is specified and unphotographed, which §12 records
rather than leaves implied.

**The inspector does not read through this batch, and cannot.** The shelf batch is bound to
expanded shelves and carries an OUTLINE and a state, which is all a 20px mark needs. The
inspector needs more and needs it in cases the batch never covers:

- a restored view state can name an `assetId` whose shelf is **collapsed**, so no batch has run
  for it and `CatalogueEntryDto` carries no shape data at all — the panel would draw a valid
  selection with no dimensions and no shape state;
- §3.4 sends the clearance's extent to the inspector precisely because it is mush at 20px, and an
  outline-only batch cannot supply it.

So **selection triggers its own read**, independent of shelf expansion: `GetAssetDesign`, which
already exists and already joins the note and the sidecar into one DTO — dimensions, the
`dimensionsUnscaled` flag, the calibration, the background reference and both versions. The
designer reads exactly this. Reported by a review bot; the batch and the panel were specified in
different sections and neither said which fed the other.

**And the batch settles per entry, never as a whole.** One damaged sidecar must not fail the
shelf it is in, and it must not leave the other rows loading either. So the query answers a
result *per asset id* — an outline, an absence, or a refusal — and a refusal renders §3.4's
struck box while every other row in the same batch renders normally. Stated because the
alternatives are both reachable and both wrong: a `Result` over the whole batch poisons a shelf
for one bad file, and dropping the failed entry silently degrades it into *no shape yet*, which
is the false absence §3.4 exists to refuse.

This is the strongest practical argument for the structure the user locked, and it was not why it was
offered: shelves make the expensive read *bounded by a gesture the user already makes*. The filtered
ledger it beat would have had to read every sidecar on open, or drop the mark.

### 5.4 Keeping a loaded mark honest

A mark is fetched once when its row first enters the viewport and then **held for the life of the
view** (§5.3), which is a cache, and a cache with no invalidation is a surface that quietly goes
stale. Another designer leaf editing a footprint, a calibration, a background or a height is the
ordinary case — two leaves on one vault is what
this plugin's own `WriteLedger` generation counter exists for — and an out-of-band sidecar edit
arriving through sync is the other.

**Neither reaches this surface today.** `createAssetCatalogueChangeSource` carries
`ProjectIndexRebuilt`, `AssetCreated`, `AssetUpdated`, `AssetDeleted` and a filtered
`ProjectIndexEntryChanged` — it is the *picker's* source, and a picker does not draw geometry, so
it has no reason to hear `AssetDesignChanged` or `GeometrySidecarChanged`.
`createAssetDesignChangeSource` carries both and takes an `assetId`, because the designer watches
one asset. **This surface watches many and draws their shapes**, which is a third shape neither
source has, and that is a real gap rather than a wiring detail: without it a footprint corrected
in a designer leaf goes on drawing its old outline here **for the life of the view** — collapsing
and reopening the shelf does not repair it, because the cache §5.3 specifies is not bound to the
expansion.

The contract, so a builder does not invent one:

- The library subscribes to `AssetDesignChanged` and `GeometrySidecarChanged` **unfiltered**, and
  invalidates the mark for the asset each event names.
- Invalidation is **per asset**, never per shelf and never whole-view: a shelf-wide refetch turns
  one peer's edit into a read of every sidecar in that category, which is the cost §5.3's whole
  bound exists to avoid.
- **Invalidation drops the cached value; the viewport decides when it is re-read.** A row on
  screen re-requests immediately; a row that is not — scrolled out of an expanded shelf, or in a
  shelf since collapsed — re-requests when it next enters the viewport, and never before.

  That is one rule where there were two, and the two had a hole between them. The earlier pair
  was "on screen refetches, collapsed shelf drops" — written against §5.3's old per-shelf bound —
  and a row scrolled out of a still-expanded shelf matched neither, leaving an implementer to
  choose between a stale outline held for ever and an eager offscreen read. Reported by a review
  bot; **it is §5.3's bound change not carrying into §5.4**, which is the third time this document
  has changed one section and left a neighbour describing the old one.
- The **inspector** refetches its own asset on the same events, since `dimensions` and the shape
  note come from the same read.

Whether that is a widening of `createAssetCatalogueChangeSource` or a fourth source beside it is a
decision for the increment that builds this — §11 — because the picker pays for any widening of
the source it shares.

### 5.5 Every read carries a ticket

**EVERY asynchronous read this surface makes carries a ticket, and a result whose ticket is no
longer current is DROPPED — successes and failures alike.** Stated as a rule over the category
rather than as a list of the reads, because a rule holds for the read somebody adds next and a
list does not. **The first version of this section was that list**, opening *"three reads on this
surface are asynchronous"* and enumerating them; the very next review round named the fourth,
`ListCatalogueEntries`, which two rapid `AssetUpdated` events can overlap so that the slower
earlier listing lands last and restores assets the newer one had seen deleted. This document's own
§12 had recorded *a table that enumerates goes stale; a table that states a rule does not* one
section earlier, and this section was written as the former in the same commit.

What differs per seam is only what makes two requests **the same request**:

- **The catalogue listing** is ticketed on the view — one counter, latest wins, exactly
  `RenovationProjectStore.hydrate`'s `latestHydration`. It is refreshed by events rather than by a
  gesture, so two arriving close together is the ordinary case rather than the fast-fingers one.

- **The selection reads** are ticketed on the **selected asset**. Select A, select B before A's
  design read resolves, and A's late answer lands in B's panel: the wrong dimensions under B's
  name, and — because *Used in* governs which delete flow `Delete` opens — the wrong blast radius
  behind a destructive control. A late *failure* is the same defect wearing the other face, since
  it paints §3.5's refusal state over a selection that read perfectly well.
- **The mark reads** are ticketed on a per-asset **generation**, bumped by invalidation. §5.4 has
  a replacement read start while the pre-event one is still in flight; if the replacement lands
  first, the older answer overwrites the fresh cache and the stale outline then survives *for the
  life of the view*, which is exactly the guarantee §5.4 exists to give. A dropped generation
  drops its failures too, or an old refusal paints the struck box over an outline just read.

None of this is a new mechanism. `ProjectStore.hydrate` and `RenovationProjectStore.hydrate` each
hold a request ticket for the identical reason — CLAUDE.md states it as *a store that two things
hydrate needs a ticket* — `InspectorStore` holds one too, and `WriteLedger` carries a per-entity
generation for the same question asked of writes. This surface is simply the first to hold several
at once, which is why the rule is stated over the category here rather than re-derived per store.

Every one of these was reported by a review bot against this document, across two consecutive
rounds, each against the section the round before it had just rewritten. **A section rewritten to
close one hole is not a section that has been read for the others**, which is now this document's
most frequent finding and is recorded as such in §12.

Search matches on **name, supplier and SKU** — never on notes, which is a free-text field whose
matches would be unexplainable in a row that does not show it.

---

## 6. Interaction

### 6.1 Search

Typing collapses every shelf into **one flat result list**, ordered by name across categories, each
row carrying its category as a muted slot (the shelf that would have said it is gone). Clearing the
field restores the shelves **and their prior expansion state** — a search must not cost a user the
arrangement they had.

**Searching returns the narrow composition to the shelves**, and that is not a detail: below 35rem
the inspector owns the whole pane (§7), so with the pane given to a selected asset a user typing
into the search field filtered a list they could not see and the surface appeared to ignore them.
Found in the 460px capture, which is the width that composition exists for at all.

The result count is announced: `12 matching assets` in a `role="status"` live region, so a keyboard
or screen-reader user hears the effect of typing rather than inferring it from a list they cannot see.

### 6.2 Keyboard

Every gesture reachable without a pointer, per PRODUCT.md's binding WCAG 2.2 AA target:

| Key | Does |
| --- | --- |
| `Tab` | Moves through: search, `New asset`, each shelf header, each row of an expanded shelf, the inspector's fields and actions |
| `Enter` / `Space` on a shelf header | Toggles the shelf |
| `Enter` / `Space` on a row | Selects it into the inspector |
| `↑` / `↓` within a shelf | Moves between rows, wrapping into the next shelf's header at the ends |
| `Escape` in the search field | Clears it |
| `Escape` in an inspector field | Resyncs that one field (`useFieldCommit.onCancel`) — one field, not the panel, exactly as the Plan editor's Inspector already behaves |

**Below 35rem, selecting a row MOVES focus, and `Back to library` returns it.** The narrow
composition hides the shelves outright (§7), so the button the user just activated is inside a
`display: none` subtree — focus lands on a hidden element or resets to the document, the pane
change is announced to nobody, and the next Tab starts from the top. So the swap moves focus to
the inspector's back control, and that control returns it to the row it came from.

**Whether the swap happened is asked of the DOM, not of a breakpoint.** `matchMedia` is the wrong
instrument here: §7's ladder is a CONTAINER query, so it answers about the pane's width and the
viewport's may differ — a split leaf is exactly that case. The honest test is whether the shelves
region is actually laid out after the change, which is what the browser already knows.

**The arrow-key rule is one focus manager over the shelves region, not a handler per shelf**, and
that is what makes the wrap fall out rather than be written: headers and rows already alternate in
DOM order, so *the next focusable thing in this region* IS *the next row, or the next shelf's
header when the rows run out*. A per-shelf handler would have to be told about its siblings, which
is a list, and a list goes stale where a rule does not. A collapsed shelf's rows are `v-show`n
rather than removed, so the manager filters on what is actually laid out — which jsdom cannot
report, so that filter is checked by an eye in the harness rather than by the suite. The prototype
carries it, because a mock that draws every state while silently omitting the keyboard leaves a
builder inheriting a promise nobody has tried.

Every focus stop has a visible ring. Obsidian's global `:focus { outline: none }` reaches buttons, so
each interactive class opts its own ring back in — `2px solid var(--interactive-accent)`, offset
**negative** for the edge-to-edge rows (an outside ring would be clipped) and **positive** for the
inset toolbar and inspector controls. `tests/build/buttonFocusRing.test.ts` is the check.

### 6.3 What the view remembers

Obsidian's own view state carries two things: `assetId` (`''` meaning nothing selected, the
three-way parse `projectIdFrom` already spells) and the set of expanded categories.

**Selection does not remount the Vue tree**, and this is where the surface deliberately differs from
`RenovationProjectView`. There, a navigation replaces the whole subject, so a remount makes staleness
unrepresentable and costs only a scroll position. Here a selection changes an adjacent panel, and
remounting per row click would throw away the shelves' scroll position on every click — the thing the
user is browsing. The tree updates in place.

**And no selection or expansion change is a navigation** — which is a rule the VIEW enforces, not
something the caller can ask for. An earlier draft said `setViewState` is called with
`history: false`; there is no such field on that call. Obsidian passes a `ViewStateResult` into
`setState` and the view writes `result.history` itself, which is what `RenovationProjectView.setState`
does — `if (parsed !== null && parsed.projectId !== this.projectId) result.history = true`, under a
comment noting that only an accepted, changed state is a navigation. So the specification is:

> `AssetLibraryView.setState` leaves `result.history` false for every change to `assetId` and to
> the expanded set.

Stated as an obligation on the view rather than as a call-site flag, because a build that copied
its sibling's shape would mark every changed state as a navigation and put a history entry behind
every row the user clicked. Reported by a review bot reading the API rather than the sentence, and
the correction is the sharper claim: the first version was wrong about *where* the decision lives,
and the wrong place happened to be the one that cannot enforce it.

**The difference must be written where the code is.** One plugin now has two answers to "what does a
view do when its own state changes", and a reader who finds only one of them will assume it is the
rule.

---

## 7. Responsive

**Container queries, never media queries.** The editor's own width is its pane's — the window minus
both Obsidian sidebars minus whatever is split beside it — so a media query measures the wrong box.
This is a measured finding, not a preference: fixed rails gave the plan canvas 67% of a 1440px pane
and **29% of a 680px one**.

| Container width | Composition |
| --- | --- |
| ≥ 720px | Shelves + inspector rail, rail 280px |
| 560–720px | Rail narrows to 240px; the row drops its supplier slot, then its waste slot |
| < 560px | **The rail stops being a rail.** Selecting a row replaces the shelves with the inspector in full, headed by a `‹ Back to library` control |

The last row is the honest answer to the open question the concepts README left standing — *nothing
collapses a rail* — for this surface only. At 460px, an Obsidian sidebar leaf's real width, two
columns is not a tight layout, it is two unusable ones. One pane at a time with a way back is the
move `ProjectDetailState` already makes, and reusing its vocabulary means a user meets one idea
rather than two.

**460px is a required capture width**, alongside the default. It is where the project row's name
defect was found, and where this row has four more slots to lose.

---

## 8. Copy and localization

Every string resolves through `t(language, key)`. Sentence case, plain, no exclamation — a
marketplace rule before it is a preference, linted in `en.ts`.

New keys, by group. **The list is exhaustive for visible copy, which the first version was not
while looking as though it were** — it declared the states and the actions and left every field
LABEL, the `Shape` and `Used in` headings, the back control and `Delete` with no key at all, so a
builder following it would have hard-coded English into exactly the places a German reader looks
first. Reported by a review bot. A key list that stops at the interesting strings is worse than
no list, because the gaps read as deliberate:

```
view.asset-library.title            command.open-asset-library
view.asset-library.search           view.asset-library.search.results   (interpolated: {count})
view.asset-library.assets           (interpolated: {count})
view.asset-library.used-in          view.asset-library.used-in.none
view.asset-library.used-in.project  (interpolated: {name}, {count})
view.asset-library.used-in.vault-root
view.asset-library.open-designer    view.asset-library.open-note
view.asset-library.back             view.asset-library.delete
view.asset-library.shape            view.asset-library.footprint
view.asset-library.clearance        view.asset-library.spec-sheet
view.asset-library.none             view.asset-library.shape.loading
view.asset-library.shape.gone       view.asset-library.shape.read-failed
view.asset-library.clearance.unscaled
view.asset-library.loading          view.asset-library.some-unreadable  (interpolated: {count})
view.asset-library.failed.headline
view.asset-library.new-asset        view.asset-library.results
view.asset-library.category         view.asset-library.unit
view.asset-library.unit-cost        view.asset-library.waste
view.asset-library.supplier         view.asset-library.sku
view.asset-library.height           view.asset-library.notes
view.asset-library.shape.none       view.asset-library.shape.unscaled
view.asset-library.shape.pending    view.asset-library.shape.unreadable
view.asset-library.used-in.loading  view.asset-library.used-in.failed
empty.asset-library.no-assets.headline / .body / .action
empty.asset-library.no-matches.headline / .body / .action
```

**The three §4 keys were found by sweeping that section's state table row by row**, which is how
this list should have been derived in the first place and was not. §4 tabulates six states and the
inventory carried keys for two of them — the empty ones — so *Loading*, *Some unreadable* and the
retryable *Failed* headline had no copy at all. The second of those is the one that would have
shipped wrong rather than blank: `view.project.some-unreadable` reads *"Some projects could not be
read from the vault"*, so a surface reusing it would have told a user about projects while showing
them assets. `view.asset-library.shape.unreadable` is not a substitute either — that one is about a
single geometry sidecar. *Failed, unrecoverable* needs nothing new: `view.session-failure.headline`
and `view.failure.retry` are already generic and already used by two surfaces.

**A key inventory is derived from the state and composition sections, not written alongside
them** — the derivation is the check, and this list had been assembled by looking at the screen
rather than by walking §3 and §4. Reported by a review bot, one round after the same list was found
missing a different key and patched one string at a time, which is what a patch rather than a sweep
buys.

`view.asset-library.used-in.vault-root` is the label a *Used in* row draws where the query
supplies `''` — a project whose `Project.md` sits at the vault root, so its derived folder is the
empty string. It arrived three rounds after the rendering rule it belongs to, which is the same
neighbour-section drift this document keeps recording: §3.5 gained "renders a root label rather
than nothing" and §8, two sections away and calling itself exhaustive, did not gain the key. A
list that claims to be exhaustive is a claim about every OTHER section of the document, and it
goes stale the moment one of them grows a string. Reported by a review bot.

Category and unit labels are **not** new: `ASSET_CATEGORY_LABELS` and `MEASUREMENT_UNIT_LABELS`
already map every member of both unions to a key, and a member added to either union fails to
compile until it has one.

German is checked for the two things the locale test reaches — no `Material` where the UI says
`Objekt`, and `Vault` kept untranslated — plus the per-key interpolation-hole rule: any key's German
translation names the same holes as its English one. Spelling and every other term remain unread by
any gate, which is why this file names them rather than implying they are covered.

The longest German shelf label is `Benutzerdefiniert` (17 characters). Shelf headers are full-width,
so they clip nothing — which is the second reason there is no column header row, where a translator
would have no such room.

---

## 9. Accessibility

Binding target: **WCAG 2.2 AA**.

- **Headings**: the view's own `<h2>` is the surface title; each shelf is an `<h3>`. No level is
  skipped, and axe grades heading order.
- **Disclosure**: `aria-expanded` on the shelf button, controlling the `<ul>` by `aria-controls`.
- **Selection**: `aria-current` on the row, plus the leading rule — never the tint alone.
- **Live region**: `role="status"` for the search result count.
- **Targets**: rows and shelf headers at `--size-4-6` minimum, WCAG 2.5.8's 24px. The harness index
  shipped 19.5px rows once, found by photographing the page rather than by any gate.
- **The mark is decorative to assistive technology** and its meaning is duplicated in words in the
  inspector. A drawn outline that is the only statement of a fact would be exactly the
  colour-alone failure in a different medium.
- **Contrast** against both Obsidian defaults, and legible degradation under a custom theme. Every
  colour is an Obsidian variable — the build refuses a literal, a bare `red` included.

What no gate here can settle, stated so it is not read as covered: the axe scan runs over
`contentEl` in jsdom, so it grades roles, names, labels, heading order and ARIA validity, and it
grades **no** contrast, **no** focus-indicator visibility and **no** hit-target size, because jsdom
has no rendering engine to measure any of the three. Those three are settled by a capture and by a
live vault.

---

## 10. Anti-goals

Each of these is a thing a reader will reasonably expect, refused for a stated reason.

- **No totals, no aggregate value, no "library worth".** Currencies do not sum (§72).
- **No category management.** Creating or configuring a category belongs to §84's own surface, not
  to a browsing one. Note the narrowing: this used to read "categories are a closed domain union",
  which is what the code enforces today and the opposite of what the epic asks (§1a). Browsing
  *displays* whatever vocabulary exists, declared or written by hand; it never decides it.
- **No bulk edit and no multi-select.** `UpdateAsset` is one asset per dispatch and the reversible
  history is per gesture; a bulk price change is an increment with its own undo argument.
- **No import or export.** V2 territory.
- **No quantities.** A quantity belongs to a requirement, which belongs to a zone, which belongs to
  a project — [[Geometry-linked quantities]] produces the first step of §75's chain and this
  surface is upstream of all of it. An asset definition has a unit and a price basis; how much of
  it a renovation needs is not a property of the definition.
- **No placement.** Nothing on this surface puts an asset on a plan, and no code anywhere reads an
  asset's geometry from a plan's render path. **The reason was cited wrongly and the correction
  matters**: [[Asset placement]] is not "a separate epic that does not exist yet" — it is a
  `type: Feature` under [[Asset library]], the same MVP epic this surface serves, alongside the
  three features §1a tabulates. So placement is not distant work in another epic; it is a sibling
  of this one, and the epic is not done without it. That makes the anti-goal stronger rather than
  weaker: putting a placement gesture on a vault-wide catalogue would put a project-scoped,
  plan-scoped action on the one surface that belongs to neither.
- **No clearance, anchor or facing in the row.** All three are unreadable at 20px. The clearance's
  extent is in the inspector; the anchor and the facing are the Asset designer's, which draws them
  — §3.5 carries why that took three rounds to settle.
- **No sort control.** Name within shelf, and the shelves are the only other axis. A sort menu is
  the filtered-ledger structure arriving by the back door.

---

## 11. Decisions a builder must not invent

1. **Whether the geometry mark ships in the first increment.** It is the surface's signature and it
   is also the only part that costs a file read per row. If it is deferred, the row keeps the box in
   its *not yet read* state and that reads as a bug — so deferring it means shipping **no** mark slot
   at all, not an empty one, and the row's leading edge closes up.
2. **Whether a shelf's expansion state is per leaf or per vault.** Per leaf follows Obsidian's view
   state and is what §6.3 specifies; per vault would be a setting, and settings here write through
   `saveSettings` on every change, which rebinds every view.
3. **How an unreadable asset sidecar is repaired at all.** §3.5 withdraws `Open designer` for
   every `asset-geometry.*` refusal because the designer hydrates through the same
   `GetAssetDesign` and reaches the same `failed` state with only a Retry — so today a corrupt
   `.rpgeo` is unfixable from inside the plugin, on any surface. The remedy is a designer that
   can replace or discard a sidecar it cannot read, which is a change to that view and not to
   this one. Named here because a gap this surface merely *reveals* is still a gap somebody has
   to schedule, and the withdrawal above is what makes it visible rather than what causes it.
4. **Whether `Delete` belongs on this surface at all.** It is specified here because the *Used in*
   read the gesture needs is already on screen. The argument against is that a browsing surface with
   a destructive action one Tab from a row is a surface people will be careful on.
5. **The ceiling on drawing empty shelves** (§3.2). Right at seven, wrong at twenty-five, and the
   number in between is a judgement nobody has made. It belongs to whoever ships §84's
   configuration surface, because that is the change that makes the vocabulary long enough to
   matter.
6. **Whether `Used in` marks the projects that override the price** once §89's override exists
   (§3.5). This is the only screen where *"your correction will not reach these three"* could be
   said, which is an argument for it; it is also a project-scoped fact on a vault-wide surface,
   which is the argument against. Not this document's to settle, and not a builder's to settle
   silently.
7. **Whether the geometry-event subscription widens the shared catalogue source or adds a
   fourth one** (§5.4). The picker shares `createAssetCatalogueChangeSource` and would pay for
   any widening of it — re-reading every asset note on a design event it has no use for — so the
   cheap edit is the one with a cost on a surface this document does not own.
8. **Whether the requirement event vocabulary grows** (§3.5) — `assetId` on the payload, and a
   `RequirementDeleted` sibling. Together they are what would let *Used in* be live instead of a
   snapshot; without them it can grow a row it will not lose, and the only alternative refresh is
   a vault-wide scan per assignment. A domain-layer addition with consequences past this surface,
   and not a view's to introduce.
9. **Whether this surface ships a Bases view beside it** (§2a). The epic's Definition of Done is
   not discharged by a plugin view, and *"reachable through Bases"* has at least three readings —
   a `.base` file this plugin writes, a documented recipe, or nothing at all on the grounds that a
   user's own Bases view over `type: renovation-asset` already works. Picking one is a product
   decision with a support cost attached.

---

## 12. What the prototype found

Per [[Prototype a screen in the harness before it is built]], this surface was drawn in
`src/prototypes/` against the real assembled stylesheet and photographed at 1280 and at **460px**
before any of it was wired — `AssetLibrary.vue`, `AssetShelf.vue`, `AssetInspector.vue` and
`assetLibraryFixture.ts`, interactive, with seventeen invented assets. `npm run harness-shot
prototype:AssetLibrary` and the same with `-- --width=460`.

**Read those captures as approximate.** The pinned Chromium is not on this machine, so they were
taken with the provisioned build named through `RP_CHROMIUM_EXECUTABLE`, and the script printed
that caveat above every one of them.

Six things the pictures said that no gate could — the last added when the epic's features were
read against this document and the mock was changed to match:

- **Three of the four mark states were the same picture.** §3.4's first version drew an empty box
  for both absence states, told apart by a diagonal, and a slash across an unscaled outline — so a
  measured 600 × 600 tile, an unscaled cabinet and a not-yet-read cabinet were all a square with a
  line, separated in one case by stroke pattern and in the other **by colour alone**: the exact
  failure the mark exists to avoid, specified by the spec. The vocabulary in §3.4 above is the
  rewrite, and each state now differs in kind. It only became visible once one capture held all
  four at once, which is why the mock opens the two shelves it does.
- **The supplier column truncated every supplier at 1280** with several hundred pixels of room
  beside it. A `9ch` cap, guessed. `16ch`.
- **Searching at 460px was a dead end.** Below 35rem the inspector owns the pane, so a user with
  an asset open typed into the search field and filtered a list they could not see. §6.1 carries
  the rule that came out of it.
- **An unbounded search field is a 1160px input for a word.** Capped at 22rem; in a sidebar leaf
  the cap never binds.
- **The `Used in` list's last separator dangled** under the list as a stray rule.
- **An unrecognised category needs no special case, once the shelves are derived.** After §3.2 was
  rewritten for §84 the mock builds its shelf list from the declared vocabulary union whatever the
  fixture actually holds, and one asset carrying `category: insulation` was added to drive it. It
  draws as an eighth shelf after `Custom`, lowercase, exactly as written — no bucket, no retitling,
  no marker calling it foreign, because under §84 a category outside today's seven is a configured
  one rather than a broken one. **That asset is the one entry in the fixture today's persistence
  cannot produce**, for the reason §1a gives, and the fixture says so where the data is.

Two findings about the gates rather than about the design, both fixed in the same change:

- **`.fallowrc.json` half-covered `src/prototypes/`.** `vitest.config.ts` excludes that tree from
  coverage, and fallow's CRAP score is complexity weighted by coverage — so every prototype
  function is scored against 0% and breaches by construction. Measured: an eight-line four-case
  switch scored 30.0 against a threshold of 30. It had never fired because no prototype had ever
  carried logic. `health.ignore` names the tree now, with the trade written where the key is.
- **That file also claimed a prototype "cannot" import anything.** True when written, false since
  `<script setup>` became legal in the tree, and this mock's own imports are what falsified it.
  `src/prototypes/README.md` already records the same claim going stale in three other places;
  this was the fourth.

### What a review round found that the captures had not

Codex reviewed each commit and raised thirteen findings, all P2. Two needed nothing: an
`aria-selected` on a `<button>`, invalid on that role and already corrected to `aria-current` in
§3.3 before the review landed, and a DTO typed to the closed `AssetCategory` union, which the
round before had already reopened to `string` for §1a's own reason. **The other eleven were
real**, and they sort into three kinds worth separating, because only one kind is the sort of
thing a picture can catch.

**Two were false claims about the codebase, in this document.** Both were verified against the
source before being believed, and both were confirmed by the code's own comments:

- §5.3 said an asset's sidecar path derives from the library folder "rather than from any index",
  so nothing could answer whether an asset has a shape without a file read. `AssetGeometryStore.
  pathFor` is `index.getGeometrySidecarPath(assetId) ?? assetSidecarPathFor(libraryFolder, assetId)`
  — index first, derivation as the repair path — and its docblock records what deriving
  unconditionally cost when it did that: a moved `.rpgeo` left the asset reading as shapeless and
  the next write minted a second sidecar beside the orphan. §5.3 is corrected and the cost claim
  narrowed rather than dropped.
- §5.1 said the surface needs "a new query and a new read model. Nothing else in the application
  layer changes." It needs a port change too, and the adapter's own docblock says exactly why:
  its shape is the project repository's *"minus its `refused` count: that exists because the
  project list must tell 'no projects' from 'projects I could not read', and the assign picker has
  no such distinction to draw."* This surface is the first caller that has it to draw. §5.1a.

A third was a false claim about an API. §6.3 said selection is persisted by calling
`setViewState` with `history: false`. There is no such field: Obsidian passes a `ViewStateResult`
into `setState` and the view writes `result.history` itself. The correction is the sharper claim —
the sentence was wrong about *where* the decision lives, and the wrong place happened to be the
one that cannot enforce it, so a build copying its sibling's shape would have put a history entry
behind every row the user clicked.

**Two were contracts this document could not have satisfied.** The DTO omitted `notes` and reduced
the background to a boolean while §3.5 specifies an editable notes field and the spec sheet's name;
and the *Used in* row discarded `projectPath`, which `ListRequirementsReferencing` supplies for
exactly the case where two projects share a name — rendering two identical rows for the two things
the user is being asked to tell apart, immediately before an edit or a deletion. Both fixed above.

**Six were defects in states no capture had ever drawn**, which is the honest limit of the method
§12 opens with. Four of the six live in the two states the mock rests outside of:

- the row hard-coded `€`, so any non-EUR asset reported the wrong currency — a lie about a number,
  not a cosmetic slip. The fixture now carries a currency per asset and one entry priced in CHF,
  so the resting capture draws it;
- the search result row adds a sixth child to a five-track grid, so every value after the name
  landed one column out of place. Fixed, and photographed for the first time;
- the *Results* heading rendered as a disclosure button with `aria-expanded` that could never
  collapse anything — the live-control-that-does-nothing this project's own empty-state amendment
  refuses. It is a plain heading now;
- searching on a narrow pane cleared `rp-al--inspecting` and brought the shelves back while the
  inspector went on rendering beside them, because it withdrew only when it had no asset at all.
  So the fix for §6.1's dead end drew both panes at once instead. Now photographed at 460.

The last two are the mock contradicting this document rather than itself: shelf and result order
followed the fixture rather than §3.2's locale-aware name sort, and the inspector kept its full
280px rail through §7's whole middle rung because only the `< 35rem` override had ever been
written. Both were invisible because no capture had been taken between the two widths that were.

**The pattern across all eleven**: a specification is checkable against source, and a mock is
checkable against a specification, and neither check is a picture. The captures found the mark
collision and the truncated column; they could not have found a DTO that omits a field the
inspector needs, and they did not draw the two states where four of these lived.

A fourth round on the fix commit found three more, and one of them is the most instructive
finding on this branch:

- **The narrow-search fix was a refusal that was too broad, and it broke the other half.** Round
  three's fix withdrew the inspector whenever a search was running; a user who then found an asset
  through search could not open it, because selecting a result changed `selectedId` while
  `searching` stayed true. Round two had the opposite defect. The two rounds are the same lesson
  from both sides — *when a fix is a refusal, write the WIDENED mutation and run it, because a
  refusal that is too broad is silent in a way a missing refusal is not* — and neither round's
  defect was visible in a capture, because a capture shows one resting state and this is a
  question about a sequence. It is one flag now (`pickedSinceQuery`) rather than two conditions
  that can disagree, and §6.1 carries the rule.
- **A fifth mark state**, above, for a sidecar that is there and will not parse.
- **The arrow-key navigation §6.2 specifies did not exist in the mock**, so the contract was a
  promise nobody had tried. It exists now, as the focus manager §6.2 describes.

A fifth round found four more, and the shape of one of them is worth more than the fix:

- **The narrow-pane state machine was wrong for the third round running**, this time clearing the
  search leaving a selected asset stranded behind the list — under a comment in that very block
  promising that clearing restores the panel. Rounds three, four and five each patched the
  previous patch's boolean. **The root cause was never any of the three conditions**: it was that
  the flag's name described how it got SET rather than what it MEANS. `showSelection` is the
  question the composition actually asks, and every transition then reads off it in one line.
  Three rounds is what naming a state after its trigger costs.
- **The shelf's disclosure id was derived from its label**, which is collision-free only while the
  labels are a closed set of seven — and §84 is exactly the change that opens them. A vault
  holding declared `Material` beside preserved `material` gives two shelves one id and makes both
  headers' `aria-controls` ambiguous, for precisely the open values §3.2 exists to support. It is
  `useId()` now, the way the rest of this plugin mints ids.
- **The usage read had no states of its own** (§3.5), so an unreadable usage graph rendered as an
  unused asset on the one panel presented as the blast radius before a deletion.
- **A loaded mark had no invalidation contract** (§5.4). The picker's change source carries no
  geometry events and the designer's needs an asset id; this surface watches many assets and
  draws their shapes, which is a third shape neither has.

A sixth round found three, and all three are one shape: **a section grew and its neighbour did
not.** §3.4 gained two mark states and §8's key list did not gain their copy. §5.3 bound the
geometry read to expanded shelves while §3.5 promised the inspector a clearance, an anchor and a
facing that batch could never carry — and neither section said which read fed the panel, so a
restored selection in a collapsed shelf had no shape data at all. §3.5 gained its own states in
round five and did not gain a rule for staying fresh while the asset stays selected.

That is the same defect this document keeps finding in itself, which is worth stating plainly:
**a specification is a set of promises that reference each other, and every edit to one section
is an unchecked claim about the others.** Nothing here can gate that — the gates read code — so
it is review, and after six rounds the honest summary is that the reviewer found what the author
could not, repeatedly, and that the count of rounds is a property of the method rather than a
sign it is failing.

One of the three is also a limitation rather than a defect, and it is recorded as one: undoing an
assignment publishes nothing, so `Used in` has no event for the removal half. That is the
`RequirementDeleted` gap in §11.

A seventh round found five, and two of them are this document and its prototype disagreeing
rather than either being wrong alone — **the mock is now old enough that a spec edit can leave
it behind**, which is a cost of prototyping early and is worth naming rather than resenting:

- **A rule written the round before could not be implemented.** §3.5 said the panel subscribes to
  `RequirementCreated` "filtered to the selected asset"; `RequirementEventPayload` is
  `{ requirementId, projectId }` and `AssignAsset` publishes exactly those, so nothing in the
  event says which asset was assigned. Checking the query changed the conclusion rather than
  forcing a domain change: `ListRequirementsReferencing` reads `listByAsset`, so it is bounded by
  the one selected asset and an **unfiltered** re-run is cheap. The previous draft's cost claim —
  that re-reading on every event scans every requirement in the vault — was about a different
  query and is corrected, because **an overstated cost is how a cheap correct design gets refused
  in favour of a domain change nobody needed.**
- **§8's key list looked exhaustive and was not**, declaring the states and the actions while
  leaving every field label, both section headings, the back control and `Delete` with no key —
  so a builder following it would hard-code English into exactly the places a German reader looks
  first. A key list that stops at the interesting strings is worse than no list, because the gaps
  read as deliberate.
- **The prototype had no `<h2>` at all.** §9's outline is one for the view with the shelves
  beneath it; the first heading the mock emitted was a shelf, and with nothing selected the pane
  had no level-2 heading anywhere. It is a visually hidden one now — Obsidian prints the view
  title in the leaf chrome, which is outside `contentEl`, so a visible one duplicates it while
  its absence leaves heading navigation inside the pane with nothing to land on — and the
  inspector's headings moved one level down so the outline nests rather than running in parallel.
- **`localeCompare()` with no argument sorts in the environment's locale, not the UI's**, and the
  two differ for exactly the reader this plugin ships a `de.ts` for. The round-five fix delivered
  the sort and not the language.
- **The mock could not represent `projectPath`** that the spec had required two rounds earlier,
  and keyed its rows on the project name — so two projects sharing one name rendered as two
  identical rows AND collided as one Vue key. Both fixed, and the fixture now holds a real
  collision so the branch is drawn rather than asserted.

An eighth round found three, and one of them is the sharpest mistake on this branch — **a
correction that turned a true statement false.**

Round six said re-reading the usage query on every event scans every requirement in the vault.
Round seven "corrected" that to *bounded by the one selected asset's own referents*, having read
`listByAsset` as an indexed lookup **because of its name**. It is not:
`ObsidianRequirementRepository.listByAsset` takes every requirement id in the vault and reads
each note before applying the asset predicate. So the original was right, the correction was
wrong, and the correction was written **inside a paragraph arguing that an overstated cost is how
a good design gets refused** — the same error in the opposite direction, and worse, because it
would have shipped an expensive subscription under a sentence promising it was cheap. *A
performance claim read off a method name is not a measurement.* §3.5 now makes *Used in* an
explicit snapshot and §11 carries the one domain change that would make it live.

The other two are the same shape as round six's: **a promise made in one section and represented
in none.** §3.4 and §5.3 both send the clearance, the anchor and the facing to the inspector;
§3.5 listed four rows that did not include them and §8 defined no labels, so an implementer had
nowhere to put values two sections had promised. §3.5 enumerates the Shape section now, including
the one row worth arguing — the anchor is a word rather than a coordinate pair, because a point
in millimetres means nothing without the drawing to read it against.

The third is invisible to every instrument here: the two non-interactive headings shared the
disclosure button's class, so an empty shelf and the fixed Results heading carried its pointer
cursor and hover background while clicking them did nothing — the affordance those headings exist
to remove, put back by a shared class. **No capture could have shown it**, because a cursor and a
hover state are not in a resting screenshot.

A ninth round found three, **all of them in the Shape section the round before had just added**,
and all three from one cause: that section was enumerated from what §3.4 PROMISED rather than
from what `AssetShape` actually holds.

- **`facing` is radians**, "measured anticlockwise from +x, normalised to [0, 2π)", and the row
  appended a degree sign to the stored number — so a promoted component reading the real DTO
  would have shown π/2 as `1.57°`.
- **`Not set` is unrepresentable for the anchor and the facing.** Both are mandatory on
  `AssetShape` and initialised to `{ x: 0, y: 0 }` and `0`, so nothing downstream can tell "never
  placed" from "placed at the origin" — and a guess would be wrong for exactly the users who
  chose those values deliberately. The replacement is better copy rather than a workaround, and
  it comes from the domain's own docblock: the origin means the MIDDLE of the object, so the row
  says `Centre` or an offset from it.
- **The design read had no failure states**, so a corrupt sidecar left the Shape section with
  nothing while the name, price and supplier above it were fine.

The pattern to carry: **a UI specified against a promise rather than against the model it reads
will be wrong in the model's own units, in its own absences, and in its own failures — three
ways, from one cause.** The previous round's fix for "a promise with no representation" created
three new claims and every one of them was false. Reading `AssetShape` first would have cost five
minutes.

A tenth round found three, **all in the Shape section again — the third consecutive round on one
section**, which is a signal about the section rather than about the findings. Each of the three
was a fresh way for its rows to be wrong against the model: `Centre` is false for a traced
footprint, whose origin is wherever the canvas origin fell rather than its middle (the mock's own
`box(600, 580)` proved it, anchoring at a corner and calling it the centre); the pending flags are
per coordinate group, so a clearance traced before a scale existed printed placeholder numbers as
millimetres beside a typed footprint; and `AssetDesignError` is three error kinds, so one Refused
branch told a user whose asset had just been deleted that a stored shape file could not be read,
and offered to open a designer on nothing.

All three were buildable. **The question none of the three rounds asked is whether those rows
serve this surface's jobs** — and the anchor and the facing do not: neither answers *find the
asset I already defined*, *correct its price*, or *see where it is used*. They are spatial facts,
a definition list is the wrong instrument for one, and the Asset designer DRAWS them one click
away. So they are gone, and §3.4's promise is reversed rather than patched a fourth time.

**The lesson is about when to stop fixing.** Three rounds of correct, buildable repairs to a row
that should not have existed is what it costs to keep answering *is this right?* without ever
asking *does this belong?* This repository's own rule is the one that lands: write the guarantee
to the check, and when narrowing makes the sentence ugly, the sentence has become honest.

One partial fix inside the same round, recorded because it is this file's oldest shape: the
pending-unit finding named the clearance, the footprint had it too one row up, and fixing only
the row in the report would have shipped `600 × 580 mm` over coordinates that are not millimetres.

An eleventh round found three, and two of them are the same shape as rounds six and seven: **a
section changed and its neighbours did not follow.** Narrowing the Shape section left three later
passages — §3.5's own superseded paragraph, §5.3 and §10 — still instructing a builder to render
the anchor row and a converted facing that the table above them had just removed. A contract
contradicted three sections later is one a builder finds from the wrong side, which is the defect
this document keeps catching in itself and caught again here.

The third is sharper and is a fresh kind. **The refusal table keyed on the union ARM and got the
mapping exactly backwards.** `AssetGeometryStore.readUnlocked` raises all four sidecar failures as
`PersistenceError` or `ValidationError`, and `RepositoryError` is
`PersistenceError | MigrationError | ValidationError` — so a `RepositoryError` row selects
precisely the damaged-sidecar cases and withdraws `Open designer`, the one action that repairs
them. `GeometryError`, which the table had assigned to damaged sidecars, actually arrives from
`dimensionsOf` on an extent overflow. It keys on the code now. *A type union is a shape, not a
taxonomy; the distinction a user sees usually lives in the code.*

And one hole the report found by its consequence rather than its cause: the mark bound was "per
expanded shelf", and search replaces the shelves with a flat list, so every result row would have
sat in *not yet read* for ever. Chasing it exposed a hole nobody reported — a shelf was never a
good bound anyway, since 34 Materials read 34 sidecars to draw the six rows a pane shows. §5.3
binds on the viewport now, which needs no special case for search and is tighter than the rule it
replaces. **The prototype cannot demonstrate it**: every mark there comes from a fixture with no
I/O, so that rule is specified and unphotographed.

A twelfth round found two. One is **§5.3's bound change not carrying into §5.4** — the third time
this document has changed a section and left a neighbour describing the old one. The invalidation
rule was a pair written against the per-shelf bound ("on screen refetches, collapsed shelf drops"),
and a row scrolled out of a still-expanded shelf matched neither, leaving an implementer to choose
between a stale outline held for ever and an eager offscreen read. It is one rule now, keyed on
the same viewport §5.3 keys on.

The other is a real keyboard defect no instrument here could see. Below 35rem the narrow swap
hides the shelves outright, so the row a keyboard user just activated is inside a `display: none`
subtree — focus lands on a hidden element or resets to the document, the pane change is announced
to nobody, and the next Tab starts from the top. The swap moves focus to the back control now and
the back control returns it to the row. **jsdom lays nothing out and a capture has no focus in
it**, so this one is held by reading alone.

Worth keeping from the fix: **whether the swap happened is asked of the DOM, not of a breakpoint.**
`matchMedia` is the wrong instrument, because §7's ladder is a CONTAINER query — it answers about
the pane's width, and a split leaf's viewport can be far wider. `offsetParent === null` is the
browser's own answer to *is this laid out*, which is the question actually being asked.

A thirteenth round found four, and every one of them is one section contradicting another rather
than a defect a picture could show — which is now the dominant shape of this document's findings
and is worth naming as such.

**The fix for the eleventh round's focus defect was correct in one direction and dead in the
other**, which is this repository's oldest recurring shape arriving inside a fix for it. The guard
returns early when the shelves are laid out, because at full width no swap happens and focus must
not move. Opening an asset *hides* the shelves, so that reads correctly; Back *reveals* them, so
the same check ran after the reveal, read "laid out", and returned — every time, in every layout,
so the row the user came from was never focused. The swap answer is passed in now, and `back`
takes it before it mutates anything. **When a fix guards two gestures, run the mutation for the
one you were not looking at**; the whole suite is silent about both, since jsdom lays nothing out.

**Two rows of §3.5's Shape inventory had no representation in the prototype**, one of them a row
§5.1's DTO carries a whole `AssetBackgroundRef` expressly to supply. `CatalogueAsset` had no
background field at all, so the *Spec sheet* row could not be drawn, and *Height* was drawn in
the definition list above rather than in Shape where the inventory puts it. The second was not
reported and was found by reading the inventory against the template — which is the check the
report itself models. Reading that block also turned up an orphaned docblock: the paragraph
arguing the anchor should be a word rather than a coordinate pair still sat above `clearance`,
three rounds after §3.5 removed both rows it describes. Nothing in any gate reads whether a
docblock still belongs to what follows it.

**§5.4's opening sentence still carried the per-shelf cache §5.3 replaced** — *"fetched once per
shelf expansion and then held"* — beside invalidation rules the round before had already rebound
to the viewport, and its closing clause promised that collapsing and reopening a shelf repairs a
stale outline, which under the specified cache it does not. **This is the same neighbour-section
drift as the round before it, in the section that round edited**, which makes it the fourth
instance and the sharpest: correcting a passage is exactly the moment nobody re-reads the
paragraph above it.

**And §11 carried an open item §3.5 had already closed.** *What happens to a selected asset
deleted in another leaf* was listed as unsettled — *"probably is not a specification"* — while
§3.5's refusal table normatively maps `asset.not-found` to a gone screen with a way back and
withdraws `Open designer`. A builder reading §11 would have waited for a decision that §3.5 had
made. The item is removed rather than the mapping made provisional, because the mapping follows
the project detail state's own decided answer and there is nothing left to decide.

**The pattern, stated once for whoever edits this next.** Of thirteen rounds' findings, the ones
a capture caught have stopped arriving and the ones a *reader* catches have not. A specification
is a set of promises that reference each other, and every edit to one section is an unchecked
claim about the others — no gate in this repository can see one, `npm run check` is green through
all of them, and the only instrument is somebody reading the two passages together.

A fourteenth round found four, and the first of them is the round before it, undone.

**Height was moved into the Shape inventory and belonged in Definition, and I moved it.** The
thirteenth round reported the missing *Spec sheet* row and said nothing about height; reading the
Shape table as authoritative, I moved height to match it without re-reading section 1, which
already listed it — so §3.5 named the field twice and the prototype rendered it once, leaving
which section owns the editable control unanswerable. The rule that decides it is now written
where the table is: *Shape lists what the sidecar derives; Definition lists what the note stores
and a field edits.* Height is on `Asset` rather than `AssetShape`, typed rather than derived, and
changed by its own `SetAssetHeight`. **When a report names one row of a list, re-read the
neighbouring list before moving a second** — the fix for one section-against-section contradiction
made another, inside the same edit.

**Three asynchronous reads could each be overtaken and none was ticketed.** Selecting A and then B
before A's design read resolves lands A's dimensions in B's panel, and A's *Used in* behind B's
`Delete`; a mark whose invalidation starts a replacement read can have the pre-event answer land
second and reinstate the stale outline for the life of the view, which is precisely the guarantee
§5.4 had just been rewritten to give. Both were reported against the section that rewrite touched.
§5.5 states it once for all three seams, failures included — a late failure paints a refusal over a
selection that read perfectly well, and an old generation's failure paints the struck box over a
fresh outline. **Not a new mechanism**: `ProjectStore.hydrate` and `InspectorStore` already hold
tickets and `WriteLedger` a generation; this surface is simply the first with three of them at
once.

**And the startup case, which is the sharpest of the four because its consequence is the thing
this feature exists to prevent.** Obsidian restores leaves before `onLayoutReady`, the index scan
runs from it, and `listAll()` enumerates the index — so the first read of a full catalogue answers
a legitimate `ok([])` and §4's table drew *no assets yet* with a `New asset` button under it. A
renovator taking that invitation defines a second *white wall paint*. The view holds Loading until
`indexScanCompleted`, which is what the project detail state already does for a defect **reported
from a real vault**, recorded in that code's own comment. The prototype could never have shown it:
it has no index, and its fixture is never empty by accident.

**Three of the four are the same failure at different distances**, and it is worth naming once
more because it is now this document's whole finding profile: a section rewritten to close one
hole is not a section that has been read for the others. Rounds twelve, thirteen and fourteen each
found the previous round's own edit.

A fifteenth round found three, and the first one is this document's own rule broken by the
section that quotes it.

**§5.5 was written as a list and the next round named the read it left out.** It opened *"three
reads on this surface are asynchronous"* and enumerated them — while §12, one section away, had
just recorded *a table that enumerates goes stale; a table that states a rule does not*. The
missing fourth is `ListCatalogueEntries`: two `AssetUpdated` events arriving close together start
consecutive vault-wide listings, and the slower earlier one landing last restores assets the
newer one had seen deleted. It is a rule over the category now — every asynchronous read carries
a ticket — with the seams as illustration rather than as the contract, so the read somebody adds
next is covered by a sentence already written.

**`Open designer` was kept for damaged sidecars on a claim about the designer I never checked.**
The table's reason read *"the designer is where a damaged shape is repaired"*. It is not:
`GetAssetDesign.execute` is `if (isErr(snapshot)) return snapshot;`, so a sidecar refusal fails
the whole design read, the designer's store reaches `failed`, and `AssetDesignerRoot` renders a
`ViewFailure` whose only action is Retry. The button sent the user to a screen repeating the
refusal they had just left — a live control that does nothing, which slice 14's own amendment
refuses, and worse than inert because finding out costs a navigation. Withdrawn for every
`asset-geometry.*` code. **The gap is the designer's, not this surface's** — a corrupt `.rpgeo`
is unfixable from inside the plugin on any surface today — and §11 carries it as a decision
rather than this section inventing a repair flow for a view it does not own. The reviewer read
`AssetDesignerRoot`; I had read the table.

**And `''` is a real path, which a truthiness test cannot say.** `projectFolderOf` is
`parentOf(path)` and `parentOf` slices to the last `/`, so a `Project.md` at the vault root
derives the empty string — `joinFolder`'s docblock names that case as the one it exists for. The
mock's `v-if="use.path"` therefore suppressed exactly the row the path was added to disambiguate,
drawing it identically to a row whose path was never supplied: the name collision restored, in
the one member of it with no folder to name, immediately before an edit or a deletion. Tested
against `undefined` now, with a root label for the empty string, and the fixture carries a
three-way collision whose third member sits at the root so the state is drawn rather than
described.

A sixteenth round found three, all in the prototype, and the first is §3.4's own distinction
inverted one layer down.

**The panel reported an absence after a refused read.** *Clearance* fell back to `None` whenever
no extent was present, so the unreadable fixture — a sidecar on disk that will not parse — drew
*this asset has no clearance boundary* beside a note saying its shape file could not be read. The
read never returned a shape for a clearance to be absent from; in production `GetAssetDesign`
refuses before returning one at all. It is exactly the `none`-versus-`unreadable` distinction the
row's mark is built on, made backwards in the panel. Footprint and Clearance are drawn only once
the read has ANSWERED — `none` is an answer, so `None` is true there — and the **spec sheet
survives**, because its reference rides on the catalogue read that succeeded and it is the one
thing a user can act on when a shape will not parse. The mock now also withdraws `Open designer`
in that state, which the round before had specified and only the document knew.

**Two collators in one view.** The rows are sorted with the resolved language's `Intl.Collator`
and the undeclared shelves with a bare `localeCompare()`, which orders by the environment's
locale — so a German UI on a Swedish system sorts the shelf names by one rule and the assets
inside them by another. One collator now.

**And the focus fix had a third direction nobody had walked.** Shelf expansion is per shelf and
the selection is restored from view state, so a narrow leaf reopened on a selected asset whose
category is collapsed has a row that is in the DOM and hidden — `v-show`, not `v-if` — and
`focus()` on it silently does nothing, with the inspector already withdrawn. Back now expands
that shelf, which is the honest reading of *return the user to where they came from*, with the
search field as the fallback for any target that is still not laid out. **Three rounds have now
each found one more direction of this one gesture**, which says the thing worth carrying: focus
management has as many cases as there are ways for a target to be absent, and enumerating them
from the armchair has failed three times running.

`AssetInspector.vue` crossed the 400-line cap in the course of this, so the Shape section's four
derivations moved to `assetShapeFields.ts` as pure functions of a `CatalogueAsset`. The seam is
not merely the cheapest cut: those four rules are where four consecutive rounds have landed, and
a rule that keeps being corrected is worth reading with nothing else on the screen.

A seventeenth round found one, and it is the **fourth** direction of the same gesture.

**A successful deletion left focus on `<body>`, and the framework had already said it would.**
`DialogHost` restores focus to whatever opened the dialog, and its own comment records that this
is *"a no-op, not a fallback, if `previouslyFocused` was removed from the DOM while the dialog was
open (the delete flows open from a control their own resolution removes)"* — restoring to a view
root instead was explicitly declined there as outside that task's mandate. So it was always this
surface's to answer, and §3.5 specified the gesture without answering it. §3.5 now names the
destination and its two fallbacks, in the same three-step shape `back()` already takes.

**Four rounds, four directions of one gesture, none of them found by me.** Forward swap, reverse
swap, a hidden destination, and now a destination that has been deleted. Each fix was written with
a paragraph explaining why it was complete. The honest generalisation is not *focus is hard*; it
is that **the number of ways a focus target can be unavailable is not enumerable from the
armchair**, and every rule here that names one target has turned out to be a rule for the case its
author happened to picture. What the fixes have in common is the remedy — an ordered fallback
ending at a control that cannot be absent — which is why the post-delete rule is written that way
from the start rather than as a single named target.

**This one is specified and unphotographed**, and the reason is structural rather than an
oversight: nothing in the prototype commits an edit, because every write on this surface belongs
to a real command. It is named here so it does not read as covered.

An eighteenth round found one, and it is the neighbour-section drift again, at the one section
that calls itself exhaustive.

Round fifteen gave §3.5 a **root label** for a *Used in* row whose project sits at the vault root,
and §8 — the key inventory, two sections away — did not gain a key for it. A builder following the
document would have hard-coded English into the German surface, which is the exact failure §8's own
header says the inventory exists to prevent. `view.asset-library.used-in.vault-root` is there now.

**A list that claims to be exhaustive is a claim about every other section of the document**, and
it goes stale the moment one of them grows a string — so it is the section most exposed to the
drift, not the least. That is the fifth round in seven to find one section left describing a state
another had already changed, and this one had three rounds to be noticed in.

A nineteenth round found two, and the first is the round before it, patched instead of swept.

**§8 was missing three more keys, and one would have shipped wrong rather than blank.** §4
tabulates six states; the inventory carried copy for two of them. *Some unreadable* had been
specified as *"mirroring `view.project.some-unreadable`"* — a string that reads *"Some projects
could not be read from the vault"*, so a builder taking the mirror literally tells a user about
projects while showing them assets. *Loading* and the retryable *Failed* headline had nothing at
all. Found by walking §4's rows; the round before had added one key by hand and stopped there.
**A key inventory is DERIVED from the state and composition sections, and the derivation is the
check** — this one had been assembled by looking at the screen, which is why it could be complete
about everything visible and silent about every state that is not.

**And the fifth direction of the focus gesture.** `Clear search` sits inside the no-matches state,
so clearing removes the control the user just pressed and focus falls to the document — in every
layout, which is why this move is unconditional rather than gated on a swap. It is the first of the
five that needed no new rule: clearing also restores the selection, so on a narrow pane the
inspector swaps back in and its Back control is the destination, and everywhere else that control
is not laid out and the existing fallback takes the search field. **That is the argument for the
ordered chain paying out** — the previous four each needed a fix, and this one needed a call.

**What the prototype does not answer.** It draws no loading, failure, unreadable or
`settings.unrecovered` state — §4 tabulates all six and drawing them needs the real query's
shapes rather than a fixture's — and nothing in it commits an edit, because the inspector's
fields belong to `useFieldCommit` over the real `UpdateAsset`. Contrast, focus-indicator
visibility and hit-target size are still settled by a live vault rather than by jsdom or by a
capture, per §9.
