# Asset Library delivery record

## Inspected baseline and instructions

Integration baseline: `origin/main`, commit `d00e9993`; implementation branch:
`codex/asset-library-delivery`, isolated at `.worktrees/asset-library-delivery`.
The main checkout was ahead by three local documentation commits and already modified; it was
left intact. Neither `AGENTS.md` nor `.codex/` exists at the integration baseline. The user's
worktree/verification/PR instructions apply. The SDD, production Vue contracts and the supplied
delivery plan informed implementation; planning-document role assignments and estimates were
not treated as additional user instructions.

## EN-01: baseline delta and evidence map

Paths below are relative to `src/` or `tests/`. Existing behavior was retained unless a delta is named.
All UI writes remain application commands; none reaches a repository directly.

| PBI | Baseline delta | Concrete implementation and evidence |
| --- | --- | --- |
| 01 | Fulfilled | `library/AssetLibraryView`, root and persisted leaf state; `plugin/assetLibraryWiring`, `library/assetLibraryViewState` |
| 02 | Adaptation | `AssetShelves`, `AssetShelf`, `AssetRow`: shared comparison header; ID selection and ticketed reads retained; shelf/row/selection-store tests |
| 03 | Adaptation | `AssetLibraryStore`: category joins name/supplier/SKU search; matching groups expand; inspector explains excluded selection; `assetLibraryRoot`, `assetDraftProtection` |
| 04 | Adaptation | `AssetInspectorFields`: explicit currency, mm and percentage; shape preview from actual `GetAssetDesign`; field/shape tests |
| 05 | Missing | `useDefinitionDraft`, `definitionDraft`, conditional `UpdateAsset`: one explicit Save/Discard; `assetInspectorFields`, `assetDefinitionCommit` |
| 06 | Missing | `libraryDraftGuard`, root/inspector: DialogHost Keep editing or Discard; search, groups and narrow Back retain draft; `assetDraftProtection`, keyboard tests |
| 07 | Adaptation | Same Money and UpdateAsset event path; only changed fields submitted; existing `assetCascadeWithOverrides`, `assetPriceOverrideCascade`, override/domain tests retained |
| 08 | Adaptation | UI percent converted with Decimal to fraction; finite bounds; referenced dimension-kind refusal remains at unit field; `assetInspectorFields`, existing asset command tests |
| 09 | Adaptation | `NewAssetForm` starts with blank price; explicit zero permitted; create still guards duplicate/partial geometry writes; root reads/selects result rather than opening designer; form/root-door tests |
| 10 | Adaptation | `AssetInspectorUsedIn` precedes definition and names both price sources; real referencing groups and override IDs retained; used-in and selection tests |
| 11 | Missing project action | `assetLibraryDeps` reuses `renovationProjectOpenProject`; note/designer/project actions guard draft; missing-note refresh retained; inspector/plugin tests |
| 12 | Adaptation | `AssetInspectorShape` uses `AssetMark` with real footprint, units and unscaled warning; damaged shapes keep designer unavailable; shape tests |
| 13 | Adaptation | Catalogue refresh retains last successful rows and warning; initial failures remain failures; local shape/usage retry buttons; library and selection-store tests |
| 14 | Missing | Expected version from catalogue, conflict differences, rejected/confirmed-read-failed/unknown states; no retry write after ambiguous fault; field and vault commit tests |
| 15 | Adaptation | Existing container ladder retained; wider proportional inspector, sticky form actions; Back preserves selected ID and draft; keyboard tests and AL10 captures |
| 16 | Adaptation | Native form submission, labelled controls, existing focus trap and arrow keys; Escape keeps draft; `assetLibraryKeyboard`, `assetDraftProtection`, accessibility suite |
| 17 | Fulfilled with draft integration | `deleteAssetFlow`, current reference query, locked command check, compensation and focus restoration retained; `assetDelete`, reference refusal/compensation suites |
| 18 | Documentation adaptation | [Native notes and Bases recipe](native-access.md), restricted to actual frontmatter; existing open-note adapter and repository tests |

## Data ownership and field/command matrix

Asset ID is vault-wide, persisted in its Markdown note through `ObsidianAssetRepository`.
`AssetShape` belongs to that asset but lives in the `.rpgeo` sidecar through `AssetGeometryStore`.
`Requirement` has its own ID and project/zone/asset references. `AssetPriceOverride` is a separate
project/asset price record; changing an Asset never rewrites an override. The library query
joins no project ID into Asset. Catalogue DTOs now carry the repository's opaque `EntityVersion`.

| Field | Read/source | Commit/type and limits | Failure and recovery |
| --- | --- | --- | --- |
| Name | `ListCatalogueEntries` / note `name` | `UpdateAsset`, trimmed nonempty string | `asset.empty-name`, correct field |
| Category | same / `category` | `UpdateAsset`, existing `ASSET_CATEGORIES` | `asset.unknown-category`; unreadable note shown, never coerce |
| Supplier, SKU, notes | same / nullable string properties | `UpdateAsset`, empty input means null; only changed keys | Version/persistence error remains in form |
| Library price | same / decimal `unit-cost` plus `currency` | `UpdateAsset`, Money in unchanged currency, finite nonnegative | Parse/negative-unit-cost error; correct field; no currency conversion |
| Unit | same / `unit` | `UpdateAsset`, `UNIT_KIND` vocabulary | `asset.unit-kind-referenced`; reassign references before changing kind |
| Waste | same / decimal fraction `waste-factor-default` | `UpdateAsset`, Decimal percentage divided by 100, 0–100% | Nonfinite/range error, correct field |
| Height | same / nullable mm `height` | `UpdateAsset` now includes height in the same conditional note save | Invalid/negative height; entire candidate rejected |
| Background/spec sheet | catalogue / existing background fields | Read-only here; existing designer command | Missing source handled by navigation adapter |
| Footprint/clearance | `GetAssetDesign` / actual sidecar geometry | Read-only here, existing designer commands | Local read refusal and Retry; no fabricated rectangle |
| Usage and price source | `ListRequirementsReferencing`, `ListOverridingProjects` | Read-only; project navigation | Usage failure blocks delete; retry section |

All definition changes validate through `Asset.withChanges`; unrelated fields, note body and
unknown frontmatter are preserved by the existing repository update path. `AssetUpdated` keeps
the existing Requirement cascade. A changed height also publishes `AssetDesignChanged` so the
designer reads its note-backed height again. No sidecar is part of the definition commit.

## EN-02: commit and conflict decision

Extend the existing `UpdateAssetInput` with optional `expected` and `changes.height`. The library
always supplies the version it displayed when the draft began. Existing immediate callers may
omit it and retain their command-read expectation. `ListCatalogueEntries` supplies the exact
revision and observation token, never a UI-derived revision or timestamp.

All nine fields fit in **one Asset note write**. No sequence coordinator and no migration are
needed. Domain validation runs before the save. A unit-kind change still acquires the existing
reference locks and re-reads under the lock; the original form expectation is presented even
after that read. The repository's conditional save protects the final write window. This is not
a transaction across Requirements, overrides or the geometry sidecar.

| State | UI and permitted recovery |
| --- | --- |
| Clean | Save disabled; reads may replace baseline |
| Dirty | Local values; no blur/change writes; explicit Save or Discard |
| Saving | Single dispatch; controls and abandonment blocked |
| Validation rejection | Field error, values retained; correct and save |
| Version conflict | Existing refusal or observed difference list; draft retained; explicitly discard to adopt current data |
| Confirmed | Read through catalogue query, then show saved state |
| Confirmed / read-back failure | Retain submitted values, show saved/refresh-needed; Save disabled; retry read |
| Unknown technical fault | Show unconfirmed outcome; block repeat save; inspect current note/read before explicit abandonment |

A successful Asset write makes no promise that every downstream project cost recalculated.
The existing event bus isolates and reports downstream failures. No Undo is shown because the
library has no reversible whole-definition history contract. Normal Obsidian `onClose` does not
provide a cancellation result; the plugin cannot promise closure veto, settings-rebind recovery
or forced-termination recovery. Draft protection covers the actions the library owns.

## Decisions D01–D14

Engineering decisions for this implementation (no invented assignees or delivery dates):
D01 retains production shelves; D02 adds shared headings at widths showing their columns;
D03 replaces old specification §3.5 blur commits with the above form contract; D04 retains the
production taxonomy; D05 uses actual geometry; D06 moves usage above the definition and labels
both price sources; D07 includes height and notes; D08 shows the asset currency; D09 requires an
intentional creation price; D10 retains checked reference resolution; D11 omits unsupported
Undo; D12 supplies the native recipe; D13 leaves the small closed taxonomy's empty groups inert;
D14 leaves damaged-sidecar repair to a separate dependency, with local retry and no dead designer door.

Unknown-category parser support and damaged-sidecar repair are separate dependencies, not hidden
migrations. The React demo's categories, prices, automatic zero, image and array-snapshot undo
were not adopted. Search §6.1 now retains category groups. Narrow Back hides detail without
clearing the selection, preserving drafts and the return context.

## Verification and remaining acceptance

See [capture manifest](captures/manifest.json) for fixture, baseline commit, dirty-worktree flag,
viewport, browser and state of each generated image. These are real production Vue components
in the existing harness. The fixture's writes deliberately refuse; actual persistence is proved
separately by `assetDefinitionCommit.test.ts`. The custom palette capture exercises CSS variables,
not an installed third-party Obsidian theme. Browser OS mobile support is not claimed.

The final PR records exact build, lint, test/coverage and analysis outcomes. Visual captures are
engineering evidence, not a claim of Product Owner sign-off or completed acceptance in a user's
real vault. Code rollback restores the old UI with no data migration or deletion.

The full gate exposed stale archive paths already present at `d00e9993`. The three executable paths (analysis CSS entries, concept capture paths and the project-list specification test) are corrected to their existing archive destinations, matching the narrow path correction in local commit `6ada6f3d` without importing its unrelated edits.


### Initial static-analysis baseline comparison (e04c392c)

Fallow 3.19.0 was run both on this branch and on a `git archive` snapshot of `d00e9993`,
with the same installed dependencies made available to the snapshot. Baseline dead-code analysis:
17 findings (three unreachable archived CSS files, seven store members, six archived HTML stylesheet
references, one prototype prop). Branch: 14 findings, with the three archived CSS entry points repaired.
The remaining findings name unchanged files. Duplication: 13 groups on both trees; reported duplicate
lines decrease from 389 to 361. No suppressions or thresholds were relaxed.

The changed-file audit (`fallow audit --base HEAD`, before the implementation commit) passes with no
new dead-code or complexity findings, one warning for the existing NewAssetForm dialog composition
shared with ViewRoot, and advisory CSS findings. Its cached snapshots warn that dependency discovery
is incomplete; the separate baseline analysis above supplies the comparison with installed dependencies.
The whole-project `npm run analyze` remains nonzero because of those existing findings; `npm run check`
is therefore not claimed green. Real-vault acceptance and this pre-existing analysis debt remain explicit
review limitations.


### Initial verification (2026-09-05, Node 24.19.0)

| Check | Result |
| --- | --- |
| `npm run build` | Passed: Vue/TypeScript check and production bundle |
| `npm run lint` | Passed: oxlint and ESLint, zero warnings |
| `vitest run --project=suite --coverage --maxWorkers=2 --testTimeout=30000 --coverage.reportOnFailure` | 421 files passed; 5,375 tests passed, 5 platform cases skipped |
| Coverage, unchanged global thresholds | Statements 99.22% (10100/10179); branches 98.05% (5392/5499); functions 99.23% (2742/2763); lines 99.54% (8830/8870) |
| Library/plugin targeted run | 17 files, 214 tests passed |
| Isolated encoding, test-environment and draft-navigation recheck | 3 files, 8 tests passed; the earlier encoding/environment timeouts did not recur |
| Build-lint project | 399 passed, 65 skipped; one unchanged lint-hook test exceeded its explicit 60-second timeout |
| Isolated lint-hook retry | The same timeout recurred (83.43 seconds); no timeout budget was relaxed |
| Captures and documentation | 16 production-component states; no page errors; all local links in this delivery package resolve |
| `git diff --check` | Passed |

The lint-hook timeout is in `tests/build/lint-edited.test.ts`, case “tells the agent what ESLint found
in an SFC, which oxlint cannot see at all”. Large concurrent test runs on this 8 GB host accompanied
the timeouts; that observation is not a claim that the test passed. The full gate is not green because
of this timeout and the baseline analysis findings above. The implementation is submitted as a draft
PR for review with these limitations visible.

### CI repair follow-up (2026-09-05)

The initial limitations above describe e04c392c. GitHub run 33971992875 passed all
463 test files in each of the four platform/Node variants; only Fallow analysis
failed. The local lint-hook timeout did not recur in that CI run.

The follow-up repairs six archived HTML stylesheet paths, removes the unused
prototype `stale` prop, shares the assigned-requirement fixture and extracts the
identical editor/designer button defaults into `editor-button-primitives.css`.
Original selectors, specificity and local state overrides are preserved.

Seven narrowly placed `unused-store-member` annotations document actual consumers
that Fallow cannot trace through the injected editor and room-draft stores. Eight
`code-duplication` annotations retain intentionally separate domain adapters,
event payload guards, repository hydration, view lifecycle/composition and
production/prototype geometry contracts. Each annotation explains its local
reason; no global analysis gate or threshold is disabled or lowered.

Local follow-up verification: build, lint and whole-project analysis pass;
115 targeted test files / 1,598 tests pass. A headless Edge comparison confirms
identical computed styles for all 55 button/state combinations (11 selectors,
normal/focus/hover/disabled/pressed), including borders and interactive states.
The PR records the subsequent remote CI outcome. Real-vault and installed-theme
acceptance remains open.


### Integration with the editor trust-path delivery

Merged `origin/main` at `ce990bcb` after PR #72. Overlapping analysis repairs now
use main's event subscription/disposal helpers, shared geometry extent scan,
requirement fixture and component-local button rules. The earlier shared button
partial and superseded local analysis annotations are removed in this merge.
Main's editor write-blocking and recovery changes remain intact.

The library now calls main's `openNewAssetDialog` helper, while retaining its own
draft guard and post-create catalogue refresh/selection. It does not regain the
older automatic designer navigation. The shared helper's documentation reflects
both callers. The PR records verification of this integration commit.

Integration verification: production build, lint and whole-project analysis pass.
Targeted regression run: 139 files / 1,832 tests passed. Staged diff check passes.

### PR review recovery fixes

Review findings 3941094351, 3941151581 and 3941151586 are addressed together:
project-opening outcomes reach the inspector and a missing project refreshes Used in;
price validation and construction use the same trimmed Money input, rejecting unsupported
literal syntax before dispatch; conditional-write conflicts require a successful catalogue
refresh before Save can resume. Local values survive both conflict rejection and a failed
refresh. A changed baseline still requires explicit discard before a subsequent edit/save.

Regression coverage includes missing/opened/failed project outcomes, whitespace and
non-decimal prices, both write-conflict codes, failed refresh and fresh-version submission.

Verification: build and lint pass; 17 library/wiring files (221 tests) pass.
Whole-project analysis passes after relocating an existing reviewed CSS-clone annotation
to the reported declaration; no CSS values or global analysis thresholds changed.

### Localized search and named draft confirmation

Review findings 3941231348 and 3941231351 are addressed: category search includes
the translated label displayed by the shelves, retaining raw category matches and
unknown-category fallback. The abandonment dialog interpolates the registered
baseline asset name in English and German, so clearing or editing the name field
does not remove the subject of the discard decision.

Regression tests cover German and English category labels, raw/unknown categories,
and confirmation of the original asset after clearing its draft name.

Verification: build, lint, whole-project analysis and diff check pass; 18 library,
store and localization test files / 264 tests pass.

### Gap closure captures (2026-09-08)

Regenerated with `scripts/asset-library-shots.mjs` at `8e954c2879f5e17e838baffc243f0e7193a9774a`;
browser `151.0.7922.34` (pinned Chromium — no substitute was needed).
Price column: amount right-edge spread `0px` at 1440 (was 22.3px, browse case step 2; 5.22px
after the previous fix round). The `.rp-al-row--on` selected-row rule set `font-weight` on the
whole row, and the row's fixed `ch`-unit grid tracks resolve per-element, so the bold row
measured its own tracks a few px differently than every regular-weight sibling. Moving the
font-weight onto `.rp-al-row__name` alone (fix round, 2026-09-08) removed that difference —
0px is exact, not "below 1px".
`7.97px` remains at 720 and 560, and it is a DIFFERENT defect from the one above, not a
residue of it: at those widths the shelf pane's container is under 40rem, so
`.rp-al-shelf .rp-al-row`'s amount and unit tracks are both `auto` rather than fixed `ch` —
each row is its own independent grid, so each row's amount column is sized to fit that row's
OWN content. The unit symbol ("m", "m²", "pcs", "fixed", …) varies in character count row to
row, and the unit track sits to the amount track's right, so a longer unit symbol pushes that
row's amount column — and therefore its right edge — left of a row with a shorter one,
regardless of any row's selection state or font-weight (confirmed by direct measurement:
unselected rows differ from each other by the same few px the selected row differs from them).
Not fixed here: giving the narrow layout's amount/unit tracks a fixed width would need a
figure sized for the longest unit string across both locales (German `pauschal`, 8 characters)
in a breakpoint already tuned to the pixel against overflow (17rem/272px, this file's other
recorded finding) — a design call for whoever asked for "below 1px at 720/560" to make
deliberately, not one to fold into this fix round unannounced.
Used-in rows at 460: heights `[52.09, 50.59, 35.5]` (was 51.8px against 19.6px, step 12) —
no longer collapsing onto one another. Read `AL10-460-dark.png` directly (fix round): rows 1
and 2 are a project name plus a disambiguating folder-path line (two different "Flat
renovation" projects, different folders); row 3 is a single line because "Garden studio" is
unique and needs no path line. No word breaks mid-word or per character anywhere in the list.
Repair strip: reason and action in grid columns (step 15). Headings and waste cell share the
`17rem` threshold, and the supplier heading now leaves WITH its cell at 40rem (fix round,
2026-09-08) — the heading span gained its own class (`rp-al-columns__supplier`) and is hidden
in the same container-query block that hides `.rp-al-row__supplier`, closing a gap where the
heading used to keep printing over a column the row itself had already dropped.

**Found while regenerating, not while looking for it**: the merged heading/waste block's own
`.rp-al-columns { display: none }` rule never actually fired, at any container width, because
the plain `.rp-al-columns { display: grid; … }` rule was declared AFTER both `@container`
blocks in `styles/asset-shelf.css` — same specificity, later source order, so the base rule
always won the cascade regardless of the container query's condition. jsdom cannot render a
container query, so nothing before this task's real-browser capture could have caught it; the
AL10-720 capture (container width 440px, under the 32.5rem/520px threshold the block shipped
with) still showed the full heading row, which is what exposed it. Moved the base rule before
both `@container` blocks (source order now matches the intended override) and re-measured the
threshold from scratch, since 32.5rem never actually applied within the widths a selected asset
renders at (440px at 720, 320px at 560 — both already under 32.5rem, so that value would have
hidden the heading row at every capture width once the ordering bug was fixed, failing the
"present at 720" requirement). 17rem (272px) is the real number: the heading's own "Unit cost"
label is the row's one span that cannot shrink, and it first overflows its track under 260px
(measured `scrollWidth` 263px against a forced 260px `clientWidth`) while staying clean at
280px — 17rem sits in that margin, under both AL10-720's and AL10-560's measured containers.
