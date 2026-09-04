---
type: Task
parent: "[[Consolidate the current and target editor data models]]"
order: 60
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Establish the editor migration and compatibility contract

## Evidence

WP0 requires an explicit preserve-or-migrate decision for existing fixtures, while WP7 and the
vertical-slice coverage matrix require every accepted version transition and legacy fixture to
have a tested, documented path.

## Why it matters

A schema change can appear correct on newly created notes while losing stable identity,
user-owned Markdown or recoverability for an existing vault.

## Approach

Define one compatibility contract for note and sidecar schemas. Inventory accepted transitions,
their version boundaries and recovery behavior; require deterministic migration and idempotence
where a transition may be retried; bind each transition to representative legacy fixtures and
round-trip assertions. Require every schema-changing PBI to link the fixtures it preserves or
migrates before implementation begins.

## Acceptance criteria

- Every accepted source-to-target schema transition has explicit versions and one migration path.
- Re-running any retryable transition is deterministic and idempotent; transitions that are not
  retryable state and enforce that precondition.
- Interrupted or refused transitions leave a documented recovery route and do not report
  uncertain data as current.
- Legacy fixtures exercise each accepted transition and the no-migration path for supported
  current data.
- Fixture assertions preserve stable entity IDs, references, user-owned Markdown bodies and
  unknown fields allowed by the accepted storage rule.
- Note metadata and sidecar geometry are checked as one logical compatibility boundary where a
  transition affects both.
- Every schema-changing PBI links its source fixtures, expected migrated fixtures and recovery
  evidence.

## Risks

Synthetic fixtures can prove the mapper while missing mixed-version, interrupted-write and
user-edited note shapes found in real vaults.

## Outcome

Schema evolution is a versioned, fixture-backed and recoverable contract rather than a migration
decision made independently by each feature.

## Amendments

**2026-09-03** — the plan editor foundation's first increment recorded the NO-CHANGE decision
(spec §2.4, consolidation report §5) and gave the no-migration path a fixture-backed contract
test, `tests/infrastructure/persistence/editorRoundTrip.test.ts`, which is the second half of
criterion 4 and the whole of criterion 5 — stable ids, references and the user-owned Markdown
body are each asserted. The transition criteria — 1, 2, 3, 6 and 7 — have no subject: this
increment accepted no source-to-target transition, and every registered migration table is
empty — `rg -n '_MIGRATIONS: (readonly )?Migration\[\] = \[\];' src/infrastructure/persistence/migration`
prints one line per table and every one ends `= [];` (seven at `bc6ca060`, stated as a rule
rather than a count) — so `MigrationRunner` remains unproven on a real chain. ADR-SV, which
decides when an additive change may stay at v1 and when a bump is owed, is recorded as DEFERRED
(report §6).

**2026-09-04** — see [[The migration amendment counts a pre-merge tree]], closed: the count above
was fixed at six against the pre-merge tree; the amendment now states the property (every table
empty) rather than an ordinal, so a later branch adding an eighth entity kind does not make this
paragraph false again.
