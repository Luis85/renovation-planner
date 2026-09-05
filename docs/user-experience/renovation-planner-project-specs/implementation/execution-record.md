# Project experience implementation record

Baseline: `d00e9993` on `origin/main`, 2026-09-05. Topic: `codex/project-experience`.

The implementation follows WP-00–05 as one project-entry increment. The difference from the reconciliation baseline `7b6bb2b2` consists of the design documentation commit, not changed runtime contracts. No repository AGENTS.md or .codex workflow directory was present. PRODUCT.md, the SDD, the workspace PRD, and the repository gate in CLAUDE.md were reconciled with the selected scope.

## WP-00 decisions and data contracts

| Visible information | Authority and implemented treatment |
| --- | --- |
| Project name, lifecycle and currency | Existing Project mapper/frontmatter schema 1 → project query → ProjectSummaryDto → header/list. No schema change. |
| List count and last worked | Existing index facts through ProjectSummaryDto. ContinueContext supplies no timestamp. |
| Plans | Existing ListPlansByProject projection of ID/name. No fabricated plan dates, floor area or previews. An unreadable region retains the project header and its independent actions. |
| Catalogue and saved project prices | Existing ListProjectAssetPrices joins readable catalogue entries and versioned overrides, retaining orphan/unreadable rows. No unit label without a projection. |
| Applicable price | Existing resolver prefers the override to the catalogue amount (`resolveEffectiveUnitCost`); cost calculation refuses foreign currency. Display identifies a foreign-currency candidate and absence of a usable price, with no conversion or invented zero. |
| Budget, location, progress, schedule | Omitted. Domain properties alone are not evidence of persisted/query-visible facts. |
| Search, completed group, focus, scroll and guidance | Leaf-owned session object, independent of frontmatter and other leaves; survives Vue remounts. Guidance is a session preference, not completion tracking. |
| Current project and prices subsection | Existing Obsidian view state. Project-ID-only states still select details. No router or independent history stack. |

Interaction decisions adopted for this increment:

1. A successful CreateProject dispatch supplies the destination ID. Duplicate names cannot affect navigation. The form retains its current validation, busy, and error behavior.
2. Plain Open selects details. Opening the same project preserves its saved plan reference; another project starts a project-only context.
3. `openPlan` returns `opened` only after host leaf creation/reveal succeeds, or `failed`. This confirms an opened editor, **not successful asynchronous plan hydration**. The editor's existing missing/read-error state remains authoritative if a file disappears after validation. The last target changes only after the confirmed opening result. Older opening responses cannot replace newer intent.
4. Resume revalidates on click. Indexing, missing project, missing plan, and unreadable/open failure have explicit messages. Missing plan offers its project without choosing a substitute; failure never deletes the stored target.
5. Project price rows deliberately replace blur saving with Apply/Enter and Cancel/Escape. The shared useFieldCommit contract is unchanged. No typing or blur writes. Pending rows are locked; Cancel is not undo.
6. Decimal comma and canonical decimal point are accepted for an unsigned amount with at most two fractional digits; negatives, grouping, mixed separators and exponent notation are refused. Zero is a real price. Clear acts only on persisted override identity/version and remains available on orphan/unreadable rows.
7. The initial edit freezes optimistic concurrency. Conflicts retain the draft and captured version, with no automatic retry against newer data. A successful write with failed refresh reports that distinction; retry refresh performs only a query, and editing is disabled until refreshed.
8. Internal project state changes and note/plan departure consult a dirty-draft guard. Pending writes block departure; dirty drafts offer Stay/Discard. The host ItemView API exposes `onClose(): Promise<void>` rather than a cancellable close contract: forced leaf closure, replacement by another view type, settings-triggered remount, reload and plugin teardown can discard unsaved session state. No durable recovery or lossless close promise is made.
9. `Platform.isMobile` controls read-only presentation, independently of width. Narrow desktop retains editing. Mobile project surfaces disable editor launching and creation while keeping note access and readable lists. The Asset Library's shared hook, field names and persistence commands remain authoritative; no unvalidated library redesign is included.

## Delivery state

| Package | Implementation | Verification |
| --- | --- | --- |
| WP-00 | Reconciled above; persisted schema unchanged | Source inspection; targeted contract tests |
| WP-01 | Retained launcher functions, leaf-local filter/group/scroll and stable focus | Automated journeys and browser harness |
| WP-02 | Direct created-ID entry, optional guidance, regional plan errors and core actions | Automated creation/detail tests and harness |
| WP-03 | Explicit opening outcomes, revalidation and recovery | Opening/resume tests; real Obsidian behavior still requires host run |
| WP-04 | Dedicated host subsection, explicit drafts, versioned writes and guarded departure | Price/concurrency tests and harness |
| WP-05 | Automated verification and handover recorded below | Live host acceptance remains blocked |

## Verification evidence and limitations

The Windows Computer Use runtime could not initialize: `failed to write kernel assets: Das System kann den angegebenen Pfad nicht finden. (os error 3)`. The same error persisted after resetting the JavaScript kernel and retrying. Therefore no real-Obsidian journey, host back/forward, custom-theme plugin compatibility, split-leaf synchronization or file-removal observation is claimed as passed.

Browser captures use locally installed Microsoft Edge, explicitly different from the Playwright-pinned Chromium. The matrix covers English/German, default light/dark, a custom token palette with green accent, narrow desktop, mobile read-only and 200% CSS zoom. CSS zoom and simulated host tokens are bounded approximations of real Obsidian zoom and custom themes.

Outstanding host scenario: open this worktree as the development vault after `npm run test-build`; exercise overview → creation → details → note/editor → return; host history and split leaves; delete a last plan/project; induce a read failure; edit prices in two leaves; confirm conflict retention and read-only retry after saved/refresh failure. Close a dirty leaf to verify the documented loss boundary. WP-05 remains incomplete until these host observations are recorded.

## Integration and adoption follow-through

The implementation started from `d00e9993` and was fast-forwarded to `53e7845a` before final verification. The four intervening commits add the adoption ledger/PBIs and repair archived paths and hook references; they do not alter the production project contracts. The duplicated archived-design path fix is now supplied by main.

The new canonical PBIs are Active with evidence links. Their broader guarantees are not silently declared complete: full editor hydration confirmation (including palette entry), clearing a missing-project context, and plugin-wide mobile disabled-with-reason behavior remain open. The project plan’s chosen scope is the contracts recorded above. The shared Apply issue records the project-price decision while leaving the shared hook and other surfaces’ policy intact.

The user requested another integration after main advanced: the topic was fast-forwarded to `ce990bcb` (PR #72 and the user-journey documentation) and its changes reapplied without conflicts. The shared `openNewAssetDialog` extraction and the editor trust-path contracts remain intact. Final validation is against this combined tree. The earlier Fallow baseline findings were independently reproduced on `53e7845a`; main subsequently supplied their cleanup.

## Final automated verification on ce990bcb

- Production build: passed (`npm run build`), 958.11 kB bundle / 288.08 kB gzip; no dependency or schema change.
- Full coverage suite: **469 files passed; 6,539 tests passed, 70 skipped** (6,609 total). Command: `VITEST_MAX_WORKERS=1 npm run test:coverage -- --testTimeout=30000 --retry=1 --coverage.reportOnFailure` (PowerShell environment equivalent). Duration: 860.43 seconds. The single worker and timeout/retry options accommodate local resource contention; no assertions, coverage floors, or repository configuration were relaxed. This is the complete suite, not a changed-files subset. A single default `npm run check` run is not claimed.
- Coverage: statements **99.33% (10236/10305)**; branches **98.20% (5620/5723)**; functions **99.18% (2789/2812)**; lines **99.62% (8948/8982)**. All repository floors pass.
- New component boundaries keep the prices subsection and Resume recovery independently readable; their behavior is exercised through the integrated journey tests. A pre-existing reviewed CSS clone in main needed its existing decision attached to the duplicate's actual inner start line in `styles/designer.css`; no clone threshold or global exclusion changed.
- Manual procedures for creation, finding/resuming, project return, and pricing now describe the delivered interactions. Their live-vault run tables remain unexecuted.

Logs are retained locally under `node_modules/.cache/project-experience-logs/` (ignored), with the full-suite report in `integrated-coverage.log` and machine-readable coverage under `coverage/`. Browser captures are under `harness-shots/` (ignored). These local artifacts are not represented as CI or native-host evidence.

Final follow-through: `npm run test-build`, `npm run lint`, and `npm run analyze` all exited 0 after the complete suite. Fallow reports no dead-code issues, no duplicate groups and no above-threshold complexity. `git diff --check` passed. The final browser run used Edge **152.0.4191.62**: **12 captures, zero findings**, including list-filter restoration and Stay/Discard journeys. A 320px German price capture was also visually inspected after the run. The development plugin is built into this worktree's `.obsidian/plugins/renovation-planner`; enabling it in the test vault does not constitute a live-host acceptance pass.
