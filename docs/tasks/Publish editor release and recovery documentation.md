---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 50
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Publish editor release and recovery documentation

## Evidence

Phase 12 requires migration, recovery and backup guidance plus user documentation and release
notes. WP8 also requires entity docs, ADRs, screen traceability, changelog and implementation
status to match the accepted slice.

## Why it matters

A release is not auditable or safely recoverable when users, support and reviewers must infer its
data model, limitations and recovery steps from code or test output.

## Approach

Publish one reviewed documentation set for the fixed editor release: homeowner user guidance,
backup and recovery procedures, migration notes where applicable, release notes and changelog,
updated entity documentation, accepted ADR links, M00–M17 screen traceability and truthful
implementation status. Cross-check every claim against the candidate and the criterion-level
evidence record.

## Acceptance criteria

- User documentation covers opening the editor, creating and selecting a room, undo/redo, reload
  and the supported response to stale or failed reads.
- Backup and recovery guidance distinguishes safe read retry, interrupted-write recovery, restore
  from backup and cases requiring the user to stop editing.
- Release notes and changelog identify delivered capabilities, compatibility or migration impact,
  known limitations and recovery-relevant changes.
- Entity documentation and accepted ADR links describe the identities, ownership and persistence
  model shipped by the candidate.
- Every applicable M00–M17 screen links to current acceptance evidence, and implementation status
  distinguishes delivered, deferred, unavailable and not applicable.
- Documentation is reviewed against the same build used for release evidence; stale or unresolved
  claims block publication.

## Risks

Copying planned behavior into release documentation can publish capabilities or recovery
guarantees the candidate does not provide.

## Outcome

Users and reviewers receive a release-specific, traceable account of editor operation, data
ownership, limitations, backup and recovery.

## Amendments

**2026-09-10** — the merged editor stack, `main` at `5dcc1f20`. The implementation-status documents
this task has to make truthful disagree with each other and with the merged build. Measured in
`docs/user-experience/renovation-planner-editor-specs/implementation/`:

- `implementation-status.md` leads with `b10c3b24` passing its tests and missing the coverage gate.
  `RESUME.md` names the same `b10c3b24` state as its current reconstruction, and its next section
  says the combined quality run has not passed.
- `completion-matrix.md` and `implementation-status.md` describe the revision-430 run, made with a
  substitute browser, as the matrix pass.
- `RESUME.md`'s H2 row says 11 Add routes; `remaining-plan.md` says 13.
- `remaining-plan.md`'s native paragraph labels H1 to H4 and H6 with no H5, while `RESUME.md` and
  `completion-matrix.md` define H5.
- `RESUME.md`'s restart commands target pull request #91 and `codex/editor-plan-finalization`.
- None of the four names `22772267`, `5a244a92` or `5dcc1f20`, so none records the matrix pass on
  the current tree or the Costs Inspector fix.

Added criteria, beside the ones above:

- Each of `RESUME.md`, `implementation-status.md` and `completion-matrix.md` gains one dated
  current-state section at its top: `main` SHA, gate run, matrix pass with its provenance commit,
  and the results of the follow-up work listed below. Older sections are labelled historical, not
  rewritten.
- Every M00–M17 requirement and every shared interaction contract has a current classification,
  revision, evidence link and, where open, a concrete next action.
- The Add-route count, the H1–H6 labels and the matrix history are each stated once, and
  consistently.
- `RESUME.md`'s restart commands point at current branches, or are marked historical.
- The checks actually run are carried by the stack's pull request descriptions or by the merge
  record of pull request #119.
- `docs/using-plan-editor.md` and `docs/using-planning-recovery.md` are checked against the
  current UI.

The current-state sections wait for these results; labelling the stale sections historical can
start now:

- [[Manually accept the eighteen editor reference comparisons]]
- [[Run the six additional editor interaction drivers]]
- [[Verify reference plan scaling and photo search]]
- [[Run native Obsidian acceptance H1 to H6 in the repository vault]]
- [[Meet editor performance and cleanup budgets]]
- [[Amend the cost-group totals sentence to the single-row reading]]
