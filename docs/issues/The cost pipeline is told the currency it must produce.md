---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 30
status: Ready
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# The cost pipeline is told the currency it must produce

A decision taken, and the implementation it owes, recorded together because the second is the
part that can be forgotten. It came out of sharing the [[Asset]] catalogue across projects
(§59, amended 2026-08-26), and it was found by review rather than by any gate.

## The question

An [[Asset]]'s default price carries its own currency, since the catalogue is shared and
[[Project]] denominates its [[Money]] in a currency two projects may legitimately disagree
about (§72). So an EUR-priced Asset can be assigned to a Zone in a GBP project. What stops the
estimate being computed anyway, in the wrong currency?

The obvious answer — [[A mismatched unit or currency is an error, not a coercion]] — turns out
not to reach this case, and *why* is the whole content of this note. That rule is enforced by
`core/money`'s `add`/`subtract`/`compare`, which refuse a mismatch **between two** `Money`
values. An initial cost calculation has only one: the price. Nothing is present to disagree
with it, so the pipeline succeeds, returns a well-formed estimate denominated in the
catalogue's currency, and clears the Requirement's stale marker.

**A rule that cannot fire is not a check**, and this one could not fire at the one point that
now needs it.

## The decision

> **`CostPipelineInput` gains `expectedCurrency`, and `computeEstimatedCost` refuses with a
> `CalculationError` when `unitPrice.currency` differs from it, before any arithmetic.**

`RecalculateRequirementCommand` supplies it from the owning [[Project]], which is why that
command reads a third entity where it previously read two.

## Why here rather than at the call site

The rule is the pipeline's already. Giving it the second operand means every future caller
inherits the check instead of each one remembering to perform it — which is the difference
between an invariant and a convention. It also puts the refusal where
[[A derived value is recomputed on read, not persisted]] puts the computation, so a currency
changed after the fact is caught on the next read rather than never.

## What is owed, and is not done

`src/domain/cost/costPipeline.ts` is **shipped without this field**. `CostPipelineInput`
declares `quantity`, `unitPrice`, `pricedPer?`, `discount?`, `shipping?`, `surcharge?` and
`taxRate?`, and `computeEstimatedCost` derives the result currency from `unitPrice` with no
check against anything. Passing an EUR price where GBP is expected returns a successful EUR
estimate today.

So `docs/tasks/09-quantity-and-cost-engine.md` currently specifies a guarantee the code does
not provide. That is the defect `CLAUDE.md` names — *write the guarantee to the check, never
ahead of it* — and this note exists so the gap is tracked rather than resting in a contract
nobody has read against the source.

The work is small and has an exact template beside it: **`pricedPer?` is the same shape** — an
optional field whose own comment reads *"Omitted, no basis check runs"* — so `expectedCurrency`
should be optional in the same way, buying a check when supplied and changing nothing when not.
The only callers today are `tests/domain/cost/costPipeline.test.ts`, so nothing in production
needs updating with it.

## Alternatives rejected

**Refuse at `AssignAssetCommand`.** Immediate feedback at the moment the renovator acts.
Rejected because a project's currency is a setting they may change afterwards, so an
assign-time refusal sits on the wrong side of the fact it depends on — and because the check
would then live with one caller rather than with the rule.

**Leave it undetected until the per-project price override lands.** Smallest change. Rejected
because the failure is silent: the estimate is a well-formed number that no later check
distinguishes from a correct one, which is precisely what the mismatch rule exists to prevent.

**Convert between currencies.** Rejected outright and elsewhere: this product has no exchange
rate and no date to read one at. [[Asset]] records that refusal.

## Consequences

- `RecalculateRequirementCommand` reads the owning [[Project]]. Stated because an earlier
  version of slice 10 claimed no new dependency was needed, which made the design look cheaper
  than it is.
- A Requirement pairing a Zone with an Asset priced in another currency is **created and then
  fails to recalculate**, staying `recalculationStatus: "stale"` and visible in the Inspector,
  without blocking its siblings.
- Such a Requirement is not costable until the **per-project price override** exists, which
  [[Asset library]]'s definition of done requires and no slice yet defines. That is a separate
  gap, named in slice 10.

## Revisit when

The override lands and a project can supply its own price for a shared definition — at which
point the question becomes whether a supplied override replaces `expectedCurrency`'s refusal or
merely satisfies it.

## References

- PRD §59 (as amended 2026-08-26 — the shared catalogues), §72 (a project's currency), §89
  (manual overrides).
- `docs/tasks/09-quantity-and-cost-engine.md` — `CostPipelineInput`, the contract this note
  says is ahead of its code. `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md` —
  `RecalculateRequirementCommand`, and the named override gap.
- `src/domain/cost/costPipeline.ts` — the shipped interface, and `pricedPer?` as the template.
  `tests/domain/cost/costPipeline.test.ts` — the only callers.
- [[A mismatched unit or currency is an error, not a coercion]] — the rule, and the reason it
  did not reach this case. [[Work belongs to one project, catalogues belong to the vault]] —
  why an Asset's price is not the project's to begin with.
