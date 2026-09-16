# Renovation Planner — first beta handoff

Prepared on 16 September 2026 for continuing the plan-editor improvement work in another implementation session.

## Files

| File | Purpose |
|---|---|
| [01-improvement-plan.md](01-improvement-plan.md) | Full plan: evidence, scope, 16 work packages including baseline and optional export, dependencies, implementation contracts, risks, release gates, and sources. |
| [02-next-session-prompt.md](02-next-session-prompt.md) | Ready-to-paste kickoff and resume prompts for a code-capable session. |
| [03-execution-tracker.md](03-execution-tracker.md) | Editable package, session, decision, device, candidate, and go/no-go records. |
| [04-beta-acceptance-matrix.md](04-beta-acceptance-matrix.md) | Release-level acceptance scenarios and BDD examples, to map onto the existing test catalogue. |

Recommended repository location: `docs/releases/first-beta-readiness/`. Reuse an equivalent existing location if current repository conventions require it.

Start with the plan and kickoff prompt. The implementation session must reconcile current code before acting: the original review baseline was `f826956`; this handoff rechecked selected critical sources at `d77e7c5`. The plan distinguishes reverified findings from findings carried forward from the earlier review.

No code changes, local tests, native acceptance, device checks, or release actions were performed in preparing this package. Every execution field starts honestly as unperformed or unassigned. The optional snapshot is not part of the default beta scope. No publication is authorized by the handoff.
