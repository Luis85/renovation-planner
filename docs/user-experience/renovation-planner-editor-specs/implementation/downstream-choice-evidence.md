# Native downstream choice verification

Source baseline: UI merge `4b691702206e06b38bb469103e6b54b7cb1861b2`, whose complete tree
`be4d39b9a6e20564565ccf0d283144e73ba01bf2` equals integration source
`c10910868f4da7f5a246dbed44b129db6e6f5a4d`. This contribution adds three dedicated test
files and this evidence, with no production, shared-helper, quality-gate or configuration edits.

The twelve tests mount the native Project view and forms over the production composition root
and real repositories backed by FakeVault:

- Work dates can be cleared independently; removing the final date removes the schedule.
  Native input during a held save retains the accepted dates and responsibility.
- A malformed Trade note produces a partial-catalogue explanation while a readable Trade stays
  selectable. Failed catalogue reads preserve the draft and a native Retry refreshes choices
  without writing the Plan. Late listing failures cannot restore a disposed form.
- The actual Add Trade and Add Supplier controls open their native creation forms. Validation
  and write failures retain the name; retry writes one record. Held completions after disposal
  do not emit to the closed view, including a late fault.
- Quote validity and currency edits require preview/apply. Repeated and composed Enter are
  prevented. Work and Asset links can be removed explicitly; peer-deleted references retain
  their unresolved identities and checked state until that removal. Scope changes during a
  held save are refused, preserving the persisted offer's accepted links.

## Verification, 2026-09-07

Node 24.20.0, Vitest 4.1.11, jsdom, `VITEST_MAX_WORKERS=1`:

- All 12 tests passed across `workChoiceRecovery.test.ts`, `namedCatalogueRecovery.test.ts`
  and `quoteScopeChoices.test.ts` in 43.18 seconds.
- `vue-tsc --noEmit`, whole-tree Oxlint, scoped ESLint and `git diff --check` passed.
- Fallow dead-code and duplication checks both exited zero. The existing hidden `.claude`
  warning, default test duplication ignores and one previously reviewed clone exclusion are
  unchanged. This is not a newly performed full health/coverage gate.

The focused coverage command retained the repository thresholds and selected the five assigned
choice components plus `QuoteForm.vue`. It exited 1 solely because this twelve-case subset does
not exercise their complete existing behavior: 178/226 statements, 131/173 branches, 58/74
functions and 113/131 lines. No focused or full coverage pass is claimed.

Compared with the preserved c109 full report, all six statement/function/branch maps are
identical. The new tests hit the following previously uncovered locations:

| Component | Statements | Functions | Branches |
|---|---:|---:|---:|
| NamedCatalogueForm | 2 | 1 | 4 |
| WorkResponsibilityFields | 1 | 1 | 6 |
| tradeCatalogue | 2 | 0 | 1 |
| WorkScheduleFields | 4 | 0 | 6 |
| QuoteForm | 2 | 2 | 2 |
| QuoteItemFields | 5 | 5 | 3 |

This location comparison is diagnostic, not an executed combined gate. Local reproducible
artifacts are under `harness-shots/ui-choice-coverage/` (`coverage-final.json`, `lcov.info`,
`delta-from-c109.json`) and `harness-shots/ui-choice-check.log`.

## Remaining evidence boundaries

Responsibility and Quote checkbox controls reject frozen events in the capture listener before
their inner change handlers run. Native refusal tests therefore leave those redundant inner
guards uncovered. Unresolved/unknown-option guards and a missing Trade ID fallback also remain;
the tests do not inject impossible choices or invoke component internals to hit them.
The production service guards turn the injected repository faults into Result refusals, so the
outer unexpected-exception catches in NamedCatalogueForm and tradeCatalogue remain uncovered.

Remaining QuoteForm paths, the complete combined coverage gate, the final nine browser journeys
and eighteen visual comparisons, and actual-host acceptance remain open under finalization.
