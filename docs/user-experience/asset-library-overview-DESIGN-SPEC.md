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

One collapsible band per `AssetCategory`, in `ASSET_CATEGORY_LABELS`'s declaration order — the same
order `NewAssetForm`'s own control renders, so the category a user picked in the form is in the
position they picked it from. Seven bands, always all seven, including empty ones.

**A shelf with zero assets still draws its header, greyed and non-interactive, with the count `0`.**
This is deliberate and it is the structure's main risk answered rather than dodged: a library of six
assets under one heading and six empty ones reads as a system with room in it, where six headings
silently omitted read as a system that has decided what you are allowed to own. It is also what makes
the seven categories learnable, which is the *find by recognition* claim the structure was chosen for.

Shelf header anatomy:

- an `<h3>` containing a `<button aria-expanded>` — the whole header row is the target, per WCAG 2.5.8's 24px floor;
- a disclosure mark (a triangle, rotated, CSS-drawn, `aria-hidden`);
- the category label;
- the count, right-aligned, muted, `tabular-nums`.

Rows sit in a `<ul>` per shelf, one `<li>` each. Within a shelf, **rows sort by name**, locale-aware
(`localeCompare` under the resolved language), because the only other candidate — most recently
edited — answers a question about the vault rather than about the renovation.

### 3.3 The row

A dense row of five slots. **No column header row**, and that is a decision with two reasons: seven
shelves would repeat one seven times, and every value here is self-describing — the cost carries its
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
radiator; a tile reads as a square; a shrub reads as whatever the user drew. It is the product's
claim — *geometry produces project information* — visible at row scale, and it is not an icon: no
asset gets a picture of its category, because a picture of a category is decoration and this is data.

Four states, each a **printed mark** and none of them a colour. Every one differs from every
other in KIND rather than in weight, and that is a correction the prototype forced rather than
a rule this section always held — see §12:

| State | Drawn as |
| --- | --- |
| Footprint, measured | the outline, solid hairline stroke, fitted with a 2px inset |
| Footprint, **unscaled** | the **same outline, dashed**. The proportions are real and the scale is not, which is exactly what a provisional stroke over true geometry says |
| Not yet read | **three dots**, centred. Not a shape at all, so no footprint can collide with it, and it is already the printed mark for *still coming* |
| No shape yet | **nothing**. An empty slot is the one thing no other state can be mistaken for, and a drawn box for *there is no shape* is scaffolding pretending to be data |

The third state is not a skeleton animation; it is what the row draws before its shape arrives,
and it has to be distinct from *no shape yet* or the surface asserts an absence it has not
checked. The 20px column is held by the `<svg>` element, which renders in every state including
the empty one — removing it would let the grid pull every later slot one column left.

The clearance boundary, the anchor and the facing are **not** drawn at 20px — they are mush at
that size, and they belong to the inspector.

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
   existing `UpdateAsset` / `SetAssetHeight`. A rejected commit keeps what the user typed and shows
   a persistent inline error under the field it is about — never reverts, per slice 16's rule.
   `routeError` maps `UpdateAsset`'s codes to fields; `asset.unit-kind-referenced` (a unit
   edit crossing `UNIT_KIND` while a Requirement still references the asset) routes to the **unit**
   field, because that is the field that is wrong.
2. **Shape** — `1200 × 800 mm` when a footprint exists, the unscaled warning when it is owed, the
   spec sheet's name when one is picked, and **Open designer**.
3. **Used in** — the per-project groups, loaded **on selection** (§5.2). One row per project:
   project name, requirement count. `Not used in any project` when there are none, which is the
   sentence that makes a deletion safe to reason about.
4. **Actions** — `Open designer` · `Open note` · `Delete`.

`Delete` goes through the existing reference-resolution flow (slice 15's `DeleteReferenceDialog`,
slice 10's resolution): the *Used in* section the user is already looking at is literally the read
that flow performs, which is why this surface can offer the gesture without inventing a second
answer to "what does deleting this break".

### 3.6 Status bar

`54 assets · Renovation/Library`. Two facts, both otherwise invisible: how large the library is, and
where it lives — the second being a setting whose row in the settings pane is deliberately
informational, because a control on `libraryFolder` would persist a folder with no notes moved.
A user who has just moved their library needs one place that says where it landed.

---

## 4. States

| State | What draws |
| --- | --- |
| **Loading** | The shell, with a loading line in the shelves region. Never a spinner over an empty pane |
| **Empty** — no assets at all | `EmptyState` with a new registry entry `assetLibrary.noAssets`, headline, body, and an action button wired to `New asset`. Replaces the shelves region, not the shell: the toolbar and status bar stay |
| **No matches** — search returns nothing | `assetLibrary.noMatches`, with an action that **clears the search field**. An action that restores the previous view, not one that creates something |
| **Some unreadable** | The additive `.rp-view-notice` strip above the shelves, mirroring `view.project.some-unreadable`. The shelves still draw. Requires the list query to answer `{ assets, unreadable }`, the shape `ProjectListResult` already has |
| **Failed** — the whole read refused | `ViewFailure`, with a retry, except where `viewHydrationOrigin` says otherwise |
| **Failed, unrecoverable** — `settings.unrecovered` | `ViewFailure` with **no retry button**: nothing was composed to re-run, so a retry is a live control that does nothing, which is the failure mode slice 14's own amendment refuses |

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
  assetId: AssetId; name: string; category: AssetCategory;
  unit: MeasurementUnit; unitCostAmount: string; currency: Currency;
  wasteFactorDefault: string; supplier: string | null; sku: string | null;
  height: number | null; hasBackground: boolean;
}
interface CatalogueListing { entries: readonly CatalogueEntryDto[]; unreadable: number; }
```

`ListAssets` exists and answers `Asset[]` for the assign picker. It is **not** reused: it returns
domain entities, it drops the unreadable count, and a picker's read and a browsing surface's read
diverging later is cheaper than one query serving two surfaces badly. `Money` is decomposed into an
amount **string** plus a currency at this boundary, exactly as it already crosses every other one —
a float is what ADR-010 refuses.

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

An asset's shape lives in its own `.rpgeo` sidecar (ADR-0014), whose path derives from the library
folder setting rather than from any index — so **there is no index that can answer "does this asset
have a shape"**, and every mark costs a file read.

Bounded three ways:

1. Marks are fetched **per expanded shelf**, in one batched query, never for the whole catalogue.
2. A row **never waits** for its mark: it renders with the *not yet read* box and the mark fills in.
3. Collapsing a shelf cancels nothing already in flight but requests nothing further.

This is the strongest practical argument for the structure the user locked, and it was not why it was
offered: shelves make the expensive read *bounded by a gesture the user already makes*. The filtered
ledger it beat would have had to read every sidecar on open, or drop the mark.

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
user is browsing. So `setViewState` is called with `history: false`, and the tree updates in place.

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

New keys, by group:

```
view.asset-library.title            command.open-asset-library
view.asset-library.search           view.asset-library.search.results   (interpolated: {count})
view.asset-library.assets           (interpolated: {count})
view.asset-library.used-in          view.asset-library.used-in.none
view.asset-library.used-in.project  (interpolated: {name}, {count})
view.asset-library.open-designer    view.asset-library.open-note
view.asset-library.shape.none       view.asset-library.shape.unscaled
empty.asset-library.no-assets.headline / .body / .action
empty.asset-library.no-matches.headline / .body / .action
```

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
- **No category management.** Categories are a closed domain union; creating one here would put a
  vocabulary decision in a browsing surface.
- **No bulk edit and no multi-select.** `UpdateAsset` is one asset per dispatch and the reversible
  history is per gesture; a bulk price change is an increment with its own undo argument.
- **No import or export.** V2 territory.
- **No placement.** Nothing on this surface puts an asset on a plan. [[Asset placement]] is a
  separate epic that does not exist yet, and no code anywhere reads an asset's geometry from a
  plan's render path.
- **No clearance, anchor or facing in the row.** They are unreadable at 20px and they are in the
  inspector.
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
3. **What happens to a selected asset that is deleted in another leaf.** The project detail state's
   answer is a screen saying so with a way back, and nothing redirects on its own. The same answer
   probably applies to the inspector — probably is not a specification.
4. **Whether `Delete` belongs on this surface at all.** It is specified here because the *Used in*
   read the gesture needs is already on screen. The argument against is that a browsing surface with
   a destructive action one Tab from a row is a surface people will be careful on.

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

Five things the pictures said that no gate could:

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

**What the prototype does not answer.** It draws no loading, failure, unreadable or
`settings.unrecovered` state — §4 tabulates all six and drawing them needs the real query's
shapes rather than a fixture's — and nothing in it commits an edit, because the inspector's
fields belong to `useFieldCommit` over the real `UpdateAsset`. Contrast, focus-indicator
visibility and hit-target size are still settled by a live vault rather than by jsdom or by a
capture, per §9.
