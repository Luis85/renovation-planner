# Asset Library gap closure — design

Date: 2026-09-08 · Branch: `codex/asset-library-gap-closure` off `origin/main` at `ec342370`.

## Why this exists

The `docs/user-experience/asset-library-delivery` package shipped in PR #70 and its eighteen
PBIs were adopted into `docs/requirements/`. Two audits taken on 2026-09-08 (spec screens
AL00–AL11 and interaction rules against `src/presentation/library/`, and every open record the
project still carries) found the residue below. This design closes the residue that is bounded
and reconciles the records; it deliberately leaves out real-vault acceptance, the Bases route
(`What discharges the catalogue's Bases access is undecided`), close-veto and undo (withdrawn by
EN-02 and D11), and unknown-category preservation (its own PBI, `status: New`, a parser change).

Decisions already taken with the user: the specification's wording wins for the four labels
that differ; the `‹` chevron is a spec inconsistency and the spec is corrected, not the code.

## Scope

Four work packages cut by file ownership so that four agents can work in parallel with no
shared file. Each item names the spec sentence it answers and the code it changes.

### WP-A Styles

Files: `styles/asset-shelf.css`, `styles/asset-library.css`, `styles/asset-library-inspector.css`,
`src/presentation/library/AssetShelves.vue`, `src/presentation/library/AssetRow.vue`,
`src/presentation/views/assetLabels.ts`, locale files for the new unit symbols.

1. **Price column alignment** (browse case step 2, "Known to FAIL"). The row grid gains a
   separate unit column. The amount cell is right-aligned with `font-variant-numeric:
   tabular-nums`; `Money.round` already fixes two decimals, so right alignment aligns the
   decimal point. The unit prints a short SYMBOL rather than the raw key or the long label:
   a new `MEASUREMENT_UNIT_SYMBOLS: Record<MeasurementUnit, StringKey>` beside
   `MEASUREMENT_UNIT_LABELS` in `assetLabels.ts`, resolved through `tr`, with `en` and `de`
   entries (m², m, m³, and localized words for piece, hour, day, fixed). This also closes the
   row half of browse case step 4 (raw `m2` beside a translated shelf label).
2. **Column headings and cells leave together** (interaction rules §10, D02). Today the
   heading row disappears at `< 40rem` and the cost and waste cells at `< 32.5rem`. Both move
   under ONE `@container` rule. The agent captures the shelves at 560 and 720 to choose the
   threshold, starting from 40rem; whichever is chosen, headings and cells share it and the
   choice is written into the CSS comment with the measurement.
3. **Headings reachable by assistive technology** (gap 15). `.rp-al-columns` loses
   `aria-hidden="true"`. Above the threshold the heading row is read once as context for the
   rows below; below it, headings and cells are both `display: none` and neither is announced.
4. **Used-in row at the 240px rail** (browse case step 12, "Known to FAIL"). `.rp-al-used__row`
   gains `flex-wrap: wrap`; `.rp-al-used__name` becomes `flex: 1 1 auto; min-width: 0;
   overflow-wrap: normal`; the override mark is `white-space: nowrap; flex: 0 0 auto`. The name
   keeps whole words and the mark drops to its own line when the rail cannot hold both.
5. **Repair strip columns** (browse case step 15, "Partially FAILS"). `.rp-al-repair li`
   becomes a grid `minmax(0, 1fr) max-content max-content` so the reason's left edge is a column
   across the strip. The existing path truncation rules keep working inside the first column.

Verification: jsdom cannot measure any of this. The agent regenerates the AL10 captures at
460, 560, 720 and 1440 in both schemes with `npm run harness-shot`, replaces the files under
`docs/user-experience/asset-library-delivery/captures/`, updates `manifest.json` with the new
commit and the substitute-browser caveat if one applies, and records the measured price-edge
spread and used-in row height before and after in the delivery record. Structural changes
(the unit column, the removed `aria-hidden`, the symbol map) get jsdom tests in
`tests/presentation/library/assetRow.test.ts` and `assetShelf.test.ts`.

### WP-B Form

Files: `src/presentation/library/definitionDraft.ts`, `useDefinitionDraft.ts`,
`AssetInspectorFields.vue`, `AssetInspector.vue` (only the guard call), `libraryDraftGuard.ts`,
`src/presentation/views/NewAssetForm.vue`, `newAssetDialog.ts`, `ViewRoot.vue` (only the
dialog outcome), new `src/presentation/library/decimalInput.ts`, locale files for the hint.

6. **Comma decimal separator** (interaction rules §5). `decimalInput.ts` exports
   `normalizeDecimalInput(raw: string): string`: trim, and when the string holds exactly one
   comma and no dot, replace the comma with a dot. Anything else passes through trimmed, so
   `1,000.5` and `1,2,3` still fail at `Decimal` as they do today. `validateDefinition` and
   `definitionChanges` parse `unitCost`, `waste` and `height` through it, and `NewAssetForm`'s
   price field parses through the same function.
7. **Untrimmed unit-cost comparison** (issue `The unit-cost draft comparison is untrimmed while
   its parse and its siblings trim`). `definitionChanges` compares
   `normalizeDecimalInput(draft.unitCost) !== before.unitCost`, the same shape `waste` and
   `height` already use. The issue note is closed by WP-D with a pointer to the test.
8. **Undeclared category or unit stays visible** (D04, gap 1). `options(key)` in
   `AssetInspectorFields.vue` appends the baseline's own value when it is not in the declared
   list, labelled with the raw value. Because an unchanged field is never part of
   `definitionChanges`, saving another field leaves the note's category as written. This is
   presentation only; parser acceptance of unknown categories stays with its own PBI.
9. **Keep editing returns to the edited field** (AL05). `useDefinitionDraft` records
   `lastEdited: keyof DefinitionDraft | null` on every input. `useLibraryDraftGuard.leave`
   takes an optional second argument `{ onKeep?: () => void }` and calls it when the answer is
   not `confirm`. `AssetInspectorFields` registers an `onKeep` that focuses the control for
   `lastEdited`, falling back to the first field when nothing was edited. `DialogHost`'s own
   restore still runs first; `onKeep` runs after it and wins.
10. **Similar-name hint on create** (AL03 "A similar name is a hint linking to existing results,
    not an automatic merge"). `NewAssetDialogDeps` gains an optional
    `findExisting?: (name: string) => { assetId: AssetId; name: string } | null`. The library
    root supplies it from the store's entries (case-insensitive, trimmed equality; no fuzzy
    matching); `ViewRoot` supplies nothing and sees no hint. While the name field holds a match
    the form draws a hint below it, `role="status"`, saying an asset with that name already
    exists, with a button labelled with a new key to show it. Pressing it resolves the dialog
    with `{ assetId, created: false }` and creates nothing. The dialog's outcome type widens
    from `AssetId | null` to `NewAssetOutcome = { assetId: AssetId; created: boolean } | null`;
    the library root skips the post-create catalogue refresh when `created` is false and
    selects the id either way; `ViewRoot` opens the id either way.

Verification: TDD in `tests/presentation/library/definitionDraft.test.ts`,
`assetInspectorFields.test.ts`, `assetDraftProtection.test.ts`, and
`tests/presentation/views/newAssetForm.test.ts` and `viewRootCreateAsset.test.ts`. Each new behaviour has a failing test first.

### WP-C List and navigation

Files: `src/presentation/library/AssetLibraryRoot.vue`, `AssetLibraryBody.vue`,
`src/presentation/i18n/locales/en-assetLibrary.ts`, `de-assetLibrary.ts` (label rows only),
`docs/user-experience/asset-library-delivery/specification/screens/AL10-narrow-and-theme.md`
and `interaction-rules.md` §7 for the chevron.

11. **Clear-search control on the field** (AL02). A `<button type="button">` inside
    `.rp-al-search`, rendered only while the search text is non-empty, labelled with
    `empty.asset-library.no-matches.action` ("Clear search"), the key the no-matches empty
    state already uses. Pressing it clears the
    store's search and returns focus to the input. The empty state's own action is unchanged.
12. **Back restores scroll position** (AL10). The root holds a template ref to
    `.rp-al-shelves` (through `AssetLibraryBody`'s exposed element) and a `savedScrollTop`.
    When `showingSelection` becomes true at a narrow width the root records `scrollTop`; when it
    becomes false the root restores it after `nextTick`, because `.rp-al-body` is
    `display: none` while the inspector owns the pane and a hidden element's scroll offset is
    lost. jsdom keeps an assigned `scrollTop`, so the test sets one, walks into the inspector
    and back, and reads it.
13. **Four labels** in both locales:
    `empty.asset-library.no-assets.action` → "Create first asset";
    `view.asset-library.unselected` → "Select an asset to view its definition.";
    `view.asset-library.open-designer` → "Edit shape";
    `view.asset-library.used-in.overridden` → "Project-specific price".
    German equivalents are written by the agent and reviewed for sentence case.
14. **Chevron**: the spec's §7 table loses `‹`; the code's "Back to library" stands. Browse case
    step 18 is rewritten as settled.

Verification: `assetLibraryRoot.test.ts`, `assetLibraryKeyboard.test.ts`, and the locale
sentence-case test that already exists under `tests/build/`.

### WP-D Records

Files: `docs/user-experience/asset-library-delivery/enablers/EN-01.md`, `EN-02.md`,
`specification/decision-register.md`, `delivery-record.md`, `README.md`,
`docs/reviews/2026-09-05-design-package-adoption.md`, the eighteen PBI notes under
`docs/requirements/`, `docs/requirements/Asset library.md`,
`docs/tests/cases/Browse the asset library.md`, and the issue note named in item 7.

15. EN-01 and EN-02: each task box ticked with a one-line pointer to the delivery-record
    section or test that discharged it. A box no evidence discharges stays unticked and says
    why.
16. PBI notes: the fifteen whose delivery-record row is "Fulfilled" or "Adaptation" with named
    tests move to `status: Done`, `finished: 2026-09-08`. The two `New` notes (unknown
    category, Bases route) and the Bases-recipe note stay as they are.
17. Decision register: a "Resolved by" column citing the delivery-record decision line or this
    design's item for each of D01–D14; the "outstanding visual verification" paragraph is
    rewritten to name the captures that now exist.
18. Adoption review: the PBI-05, PBI-06, PBI-14 and EN-02 rows are corrected to the shipped
    draft (`useDefinitionDraft`), with a dated amendment rather than a silent rewrite.
19. Browse case: steps 2, 4, 12, 15 and 18 rewritten to the new expectation, each keeping a
    "was" clause; the Runs table still says not yet run in a vault.
20. The epic's definition-of-done stays as it is: both unmet criteria are outside this design.

## Sequencing

WP-A, WP-B and WP-C run in parallel from the same worktree; their file sets are disjoint. WP-D
runs after the three have landed, because it records their evidence. Each agent runs
`npm run check:fast -- <its test paths>` before reporting; the full `npm run check` runs once,
by the integrator, before the commit. One gate at a time, per `CLAUDE.md`.

## Out of scope, and why

- Real-vault acceptance: needs a person in Obsidian; every manual case keeps its "not yet run"
  row.
- Unknown-category parser acceptance: `kebabEnum(ASSET_CATEGORIES)` refuses it in the
  repository layer; the PBI exists and is `New`.
- Bases route: blocked on its own issue note.
- Close veto and undo: withdrawn by EN-02 and D11 with reasons recorded.
- Missing-versus-zero price in the catalogue DTO (gap 14): D09 chose an intentional creation
  price instead; no change.
