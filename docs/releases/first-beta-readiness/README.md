# Renovation Planner — first beta handoff

Prepared on 16 September 2026 for continuing the plan-editor improvement work in another implementation session.

## Where the beta stands

This folder is the one place the first beta's status is kept; `README.md`, `RELEASING.md` and
the user guides link here rather than restating it.

- **Status** — the [tracker](03-execution-tracker.md)'s package register, its gate state (G0–G5)
  and its go/no-go record. No go/no-go decision has been made and no publication is authorised.
- **Candidate acceptance** — only the tracker's
  [candidate identity record](03-execution-tracker.md#candidate-identity-record), executed against
  the [acceptance matrix](04-beta-acceptance-matrix.md) on that candidate's own built assets. No
  candidate has been named yet.
- **Decisions and accepted limitations** — the tracker's "Decisions and explicit limitations"
  table and [05-owner-decisions.md](05-owner-decisions.md). What they mean for a person trying
  the plugin is written out in [Known limitations](../../known-limitations.md).

**Older evidence is history, not acceptance.** Every release, acceptance or evidence record
written before a candidate is named — the ledgers under
`docs/user-experience/*/implementation/`, the asset-library and project-specs delivery records,
and the dated run rows the cases under `docs/tests/cases/` record — describes the build it names. None
of it is acceptance of a beta candidate.

## Files

| File | Purpose |
|---|---|
| [01-improvement-plan.md](01-improvement-plan.md) | Full plan: evidence, scope, 16 work packages including baseline and optional export, dependencies, implementation contracts, risks, release gates, and sources. |
| [02-next-session-prompt.md](02-next-session-prompt.md) | Ready-to-paste kickoff and resume prompts for a code-capable session. |
| [03-execution-tracker.md](03-execution-tracker.md) | Editable package, session, decision, device, candidate, and go/no-go records. |
| [04-beta-acceptance-matrix.md](04-beta-acceptance-matrix.md) | Release-level acceptance scenarios and BDD examples, to map onto the existing test catalogue. |
| [04-lifecycle-contract.md](04-lifecycle-contract.md) | BP-03's contract for pending edits and commands at lifecycle boundaries. |
| [05-owner-decisions.md](05-owner-decisions.md) | The owner questions before the beta, their options, and the choices taken. |
| [10-interaction-capability-matrix.md](10-interaction-capability-matrix.md) | BP-05's record of which interactions the tests drive. |
| [11-q1-stamp-census.md](11-q1-stamp-census.md) | The Q1 measurement of where a write incident can be raised. |
| `05-session-3-prompt.md` to `09-session-7-prompt.md` | Kickoff prompts for later sessions, kept as written. |

Recommended repository location: `docs/releases/first-beta-readiness/`. Reuse an equivalent existing location if current repository conventions require it.

Start with the plan and kickoff prompt. The implementation session must reconcile current code before acting: the original review baseline was `f826956`; this handoff rechecked selected critical sources at `d77e7c5`. The plan distinguishes reverified findings from findings carried forward from the earlier review.

No code changes, local tests, native acceptance, device checks, or release actions were performed in preparing this package. Every execution field starts honestly as unperformed or unassigned. The optional snapshot is not part of the default beta scope. No publication is authorized by the handoff.
