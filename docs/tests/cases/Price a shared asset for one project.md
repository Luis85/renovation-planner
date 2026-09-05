---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 58
sources:
  - PRD §72
  - PRD §89
  - SDD §12
  - SDD §59
  - SDD §66
status: Ready
---

# Price a shared asset for one project

Current project-entry expectations were updated on 2026-09-05; see the [execution record](../../user-experience/renovation-planner-project-specs/implementation/execution-record.md). Earlier capture descriptions below are historical. This update records no new live-vault pass.


The per-project price override increment in a real vault: the **price section** on the project
detail state, where a project sets its own price for a shared catalogue asset, and the Plan
Editor Inspector's **three-figure block**, where a requirement shows the library price, the
project's own, and the price its cost was actually derived from.
`docs/tasks/20-the-currency-the-pipeline-is-told.md`'s Amendment 4 records what the runs find
and points here.

Run [[Navigate into a project and back]] first, or at least its steps 1–2, so the detail state
is familiar: this case opens the dedicated Project prices subsection from that surface.

**Why a vault is the sole instrument for most of this, stated precisely rather than as a
slogan.** Two claims here are drawn by nothing in this repository:

- **The Inspector's three-figure block has never been RENDERED anywhere.** The container this
  increment was built in held no pinned Chromium at all, and the browser harness draws the
  Requirements panel empty — [[Assign an Asset and Delete a Referenced Zone]] records that a
  populated requirement row's layout has no instrument here either, and this increment adds a
  third `dt`/`dd` pair to a row that already carried two. Which of those cells are DRAWN is a
  different question and the node suite answers it (step 14); what they look like beside each
  other in a 17rem panel is what only a vault can show.
- **The price section's captures were taken with a SUBSTITUTE Chromium.** `npm run harness-shot`
  writes `project-detail-prices` at 1280 and `project-detail-prices-narrow` at 460, and both
  measured real things — the section really is reachable only by scrolling `.rp-project-detail__body`,
  and the row really is a wrapping flex whose field block takes a fixed `14rem` basis. But
  `scripts/chromium.mjs` prints its own *approximate* caveat when a build other than the pinned
  one is named through `RP_CHROMIUM_EXECUTABLE`, and that is what those pictures were taken with.
  Read them as approximate; this case is where they are confirmed.

Everything else — the commands, the refusals, the DTO, the precedence — is asserted by the node
suite against in-memory repositories. What a vault adds to THOSE is the same thing it has added
four times before: a fake accepting what Obsidian refuses.

## Preconditions

```bash
npm run test-build      # builds into .obsidian/plugins/ — this repository IS a vault
```

Then, in the vault:

1. **Settings → Renovation Planner → Default currency → `GBP`.** The default is `EUR`, and this
   case's central scenario is a GBP project pricing an EUR catalogue asset — the two-currency
   dead end the increment exists to close. Set it BEFORE creating the project: the currency is
   copied onto the project note at creation and this setting never reaches an existing one.
2. **`Create sample renovation project`** from the palette. It seeds a project, a plan and five
   zones through the real commands, and **no asset and no requirement** — exactly three commands,
   which `src/plugin/sampleProject.ts` states and this case depends on.
3. **Two catalogue asset notes, written BY HAND.** Hand-written fixtures make the currency scenario reproducible. Put
   both under `Renovation/Library/Assets/` (the `libraryFolder` default, and the folder slice 19
   moved the catalogue to), with any non-empty `id`:

   ```yaml
   ---
   type: renovation-asset
   schema-version: 1
   id: asset-manual-tile
   revision: 0
   name: Porcelain terrace tile
   category: material
   supplier: null
   sku: null
   unit-cost: "48.00"
   currency: EUR
   unit: m2
   waste-factor-default: null
   notes: null
   ---
   ```

   The second differs only in `id`, `name` and `unit-cost` — call it `Oak skirting`, `12.75`,
   `unit: m`. Two rows rather than one, because a single row cannot show that the field, the
   button and the two figures form COLUMNS, which is the whole of step 4.

**If the price section says "The library has no assets yet"**, the notes are the thing that is
missing, not the section. Reload the vault: the Project Index scans at `onLayoutReady`.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and
what they do not claim.

**Four of these verdicts moved on a second reading, and the direction is worth stating because
it is the opposite of the one this case's own header sets up.** Steps 12, 15 and 16 read as
`browser` — a pointer gesture and two layout claims — and are `obsidian`, because the harness
composes a refusal bundle and draws the Requirements panel empty: a browser cannot reach a
populated Inspector row at any width, and it cannot show that one click produced one write.
Step 14 went the other way, to `suite`: its pass condition is which `data-price` cells are drawn
and which carries the mark, which is DOM state the node suite already reaches. A verdict names
the cheapest instrument that could discharge the step AS WRITTEN, and tagging a step `browser`
because it is *about* layout would promise an instrument that does not exist here.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `suite` | Open the sample project, then select **Project prices** | A dedicated price subsection retains the project header and GBP currency, with scope disclosure and catalogue rows | Prices are independently reachable from the project details |
| 2 | `suite` | Read the sentence under the heading | It says a price set here applies to **every requirement in this project** that uses the asset | The project-wide disclosure that justifies this affordance living on the project surface rather than on a requirement row. It is drawn ONCE for the section; `I18N_LITERAL_BAN` fires at a literal and never at an absent one, so nothing but one jsdom case can see whether it is present |
| 3 | `browser` | Scroll the price subsection, then use its Back button | Rows scroll beneath the project header; Back returns to details and plans | One body scroller and a distinct host subsection |
| 4 | `browser` | Compare two rows at full width | Names, currency-labelled figures and inputs align; **Remove project price** appears only for a saved override | Readable rows without an action for an absent override |
| 5 | `browser` | Read the field label beside the EUR library amount | The input says **Set a price (GBP)**; the library amount retains EUR and is identified as foreign currency | Different currencies must not imply a usable fallback |
| 6 | `suite` | Type `41.50`, blur the field, then select Apply or press Enter | Blur performs no write; Apply saves **This project: 41.50 GBP** beside the library price | Explicit commit only |
| 7 | `obsidian` | Look in the vault's file tree for the note it wrote | A note under the project's own **`Asset Prices/`** folder, named by its id, carrying `type: renovation-asset-price`, the project, the asset, `unit-cost: "41.50"` and `currency: GBP` | Where the note lands, which is a decision rather than a detail: the ASSET is the vault's and lives under the library, and the price this project pays for it is the project's. `Asset Prices/<id>.md`, never the illustrative `Asset Prices/<asset name>.md` an earlier draft of the design carried |
| 8 | `suite` | Type `19,50` in the other row and press Enter | The project price saves as 19.50 GBP | Decimal comma is normalized before validation |
| 9 | `suite` | Type `1,234.50` and Apply; then correct to `19.50` | Mixed separators are rejected without writing and retain the draft; correction clears the error | Grouping and mixed decimal notation are not silently guessed |
| 10 | `suite` | Select **Remove project price** on the terrace tile | The saved project price and note disappear; the EUR library price remains visible with its foreign-currency warning | Clearing does not make a foreign library price applicable to GBP |
| 11 | `suite` | Inspect the row after removing its override | The Remove button is absent | No clear action on an absent override |
| 12 | `obsidian` | Save an override, type another draft, then click **Remove project price** | One clear command removes the persisted override; the draft never produces an intervening set | Pointer blur cannot commit a draft |
| 13 | `suite` | Set a price on the terrace tile again, then open the plan and assign that asset to a zone through the Inspector | The requirement's cost is derived from the PROJECT's price, not the library's | The precedence itself: `resolveEffectiveUnitCost` replaces an INPUT, and this is the assign path reading it. Before this increment a GBP project assigning an EUR asset was refused outright with no way to fix it — the dead end the whole increment exists to close |
| 14 | `suite` | Look at that requirement's row in the Inspector | **Library price** and **Project price** are both drawn, each with its figure and currency, and only the project's carries the **In force** mark | §89 at the INPUT level, and the precedence rule: the mark is decided by PRECEDENCE, never by equality. A project price that happens to EQUAL the library's is still the price in force, and marking every figure equal to the resolved one would claim two figures are being used at once |
| 15 | `obsidian` | Hand-edit the price note from step 7 in the vault — change `unit-cost` to `35.00` — then look at the Inspector row again, reloading if the pane has not caught up | **THREE** figures: Library price, Project price (In force) at the edited figure, and **Derived from** at the figure the cost was actually calculated with. The third carries no In force mark | Decision 6's "three numbers in the worst case", in the one state a user can actually hold it in: a hand edit publishes no `AssetPriceOverrideChanged`, so no cascade runs and the recorded provenance stays behind. **This is the layout claim nothing here has ever drawn** — a third `dt`/`dd` pair in a 17rem panel whose row already carried two |
| 16 | `obsidian` | Narrow the pane to a sidebar's width and look at both surfaces again | The price row's input and its button drop to their own line rather than crushing the asset's name; the Inspector's three figures stack rather than truncating | 460 is the width an Obsidian sidebar leaf actually has, and the row's `14rem` field basis is what decides the wrap. Measured headlessly for the price section with a substitute build; NOT measured anywhere for the Inspector |
| 17 | `obsidian` | Delete one of the two library asset notes while its project still holds a price for it, then reload | That asset's row is still in the section, LAST, saying **This asset is no longer in the library** — with its price input DISABLED and **Remove project price** still live | The orphan row, and why the two disabled states are not one. The row exists so the user can get rid of the stranded override; a set against it would refuse every time, which is the live-control-that-does-nothing slice 14's amendment refuses |
| 18 | `obsidian` | Break the OTHER asset note's body — keep `type` and `id`, corrupt a required key such as `unit-cost` — and reload | That row says **could not be read** instead, also last, also with a disabled input and a live Clear — and the rest of the section is unaffected | The state that used to collapse into the orphan row, which would have deleted a perfectly good override on a false diagnosis. Two sentences, two classes, two opposite remedies: one names a deletion, the other a note the user can still fix |
| 19 | `obsidian` | Switch Obsidian to German and repeat steps 1, 6, 8 and 9 | Labels and messages render in German; decimal comma succeeds and mixed separators are refused | Localized instructions agree with the parser |
| 20 | `obsidian` | Reload the vault and revisit both surfaces | Every price, mark and row state from the steps above is exactly as it was | The round trip through real notes and a real `MetadataCache`, which is where three of the first four defects this suite ever found actually lived |

## Acceptance criteria

1. Steps 1–2 draw the section and its project-wide disclosure on the project detail state.
2. Steps 3–5 leave no unreachable row, no broken column and no figure whose currency is
   unstated.
3. Steps 6, 7 and 10 set and clear a price, and the vault agrees with the screen both times.
4. Decimal comma succeeds; mixed separators fail without a write and retain the draft.
   the correction.
5. Step 11 offers no removal without an override; step 12 performs one clear and no draft save.
6. Step 13 prices a requirement at the project's own figure rather than the library's.
7. Steps 14 and 15 draw two figures and three, with exactly one In force mark in each.
8. Steps 17 and 18 tell the two unhappy rows apart, in words, and disable only what a refusal
   would meet.
9. Step 20 finds nothing changed by the reload.

## Deliberately NOT checked

- **The cascade's cost.** A price change recalculates every requirement in the project, and
  `resolveEffectiveUnitCost` records that this costs one project-wide price hydration per
  requirement. That is a recorded cost with no correctness consequence, and no step here would
  discriminate a fixed version from the current one — a stopwatch on a two-requirement vault
  measures nothing.
- **Colour contrast and hit-target size.** `tests/harness/accessibility.test.ts` grades roles,
  names, labels and ARIA validity and explicitly not those two; steps 4, 14 and 16 are claims
  about layout, not measured contrast.
- **What a THEMED vault does to the In force mark.** The mark is a translated word, so §85's
  "status not colour-only" is satisfied by the word alone and nothing here depends on the
  palette.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design document, the increment's own review and the code — including steps 3, 4 and 5, whose layout was measured in a headless Chromium that was a SUBSTITUTE build rather than the pinned one, and steps 15 and 16, whose subject nothing anywhere has drawn — step 14's content is asserted by the node suite, its layout by nothing. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
