---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 30
status: New
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

## The shape most likely to be right

> **`CostPipelineInput` gains `expectedCurrency`, and `computeEstimatedCost` refuses with a
> `CalculationError` when `unitPrice.currency` differs from it, before any arithmetic.**

Written as a proposal rather than a decision, because it cannot be implemented yet — see
*What blocks it* below.

**Whether the field is optional is an open sub-question**, and both sides are worth keeping.
`pricedPer?` in that same interface is the optional precedent — supplied, it buys a check;
omitted, nothing changes — which makes an optional field the smaller edit and leaves existing
callers untouched. Against that: an invariant a caller can omit is one a caller can silently
bypass, and a currency check is exactly the kind whose absence is invisible, since the result
is a well-formed number either way. It only becomes decidable once a [[Project]] has a
currency to require. It is recorded because three attempts at this question were drafted
in one pull request and each was withdrawn, and losing the reasoning would mean a fourth
attempt starting from nothing.

## What blocks it — three absences, each verified against the current tree

1. **A [[Project]] has no currency.** Neither slice 3's property table nor
   `src/domain/project/Project.ts` declares one; only `budget` carries a currency, and it is
   nullable, so it cannot stand in. There is nothing to pass as `expectedCurrency`.
2. **Nothing invalidates a Requirement when a project's currency changes.** The only
   invalidation subscribers are `ZoneGeometryChanged` and `AssetUpdated`, and
   `calculatedFrom` snapshots `zoneArea`, `unitCost` and `assetUnit` — no currency. A
   Requirement therefore stays `"current"` indefinitely holding an estimate in a currency
   the project has since stopped using, and the read model sees no mismatch to report.
3. **`Requirement.estimatedCost` is not optional.** It is a `DerivedValue<Money>`, so a
   Requirement whose cost cannot be computed has no valid initial value: storing the
   Asset-currency figure breaks the project-currency invariant, and inventing a
   project-currency figure is not a calculation. "Create it and let recalculation fail" is
   unavailable without changing that shape.

Any answer has to settle all three, which is why this is an Issue rather than a paragraph
in a slice.

## Why here rather than at the call site

The rule is the pipeline's already. Giving it the second operand means every future caller
inherits the check instead of each one remembering to perform it — which is the difference
between an invariant and a convention. It also puts the refusal where
[[A derived value is recomputed on read, not persisted]] puts the computation, so a currency
changed after the fact is caught on the next read rather than never.

## What is owed once the blockers are cleared

`src/domain/cost/costPipeline.ts` is **shipped without this field**. `CostPipelineInput`
declares `quantity`, `unitPrice`, `pricedPer?`, `discount?`, `shipping?`, `surcharge?` and
`taxRate?`, and `computeEstimatedCost` derives the result currency from `unitPrice` with no
check against anything. Passing an EUR price where GBP is expected returns a successful EUR
estimate today.

**Slice 9 no longer specifies otherwise, and that is deliberate.** A version of this branch
did add `expectedCurrency` to that contract, which put a guarantee ahead of its code — the
defect `CLAUDE.md` names — and it was withdrawn. So there is **no slice-9 promise to repair**:
the pipeline as specified checks currency only among the monetary operands actually handed to
it, which is exactly what it implements. What is missing is a *proposal*, carried here, not a
contract violation to go and fix.

The work is small and has an exact template beside it: **`pricedPer?` is the same shape** — an
optional field whose own comment reads *"Omitted, no basis check runs"* — so `expectedCurrency`
*could* take the same shape, buying a check when supplied and changing nothing when not —
which is one side of the open sub-question above, not a conclusion. Whichever way that
settles, the only callers today are `tests/domain/cost/costPipeline.test.ts`, so no
production call site changes with it.

## What was tried, and why each was withdrawn

Recorded because each looked correct until the next fact arrived, and a reader who does not
know that will try them again in the same order.

- **Refuse at `AssignAssetCommand`.** Withdrawn: a project's currency is a setting the user
  may change afterwards, so the refusal sits on the wrong side of the fact it depends on.
- **Let recalculation catch it.** Withdrawn: the rule is enforced by `add`/`subtract`/
  `compare`, which need *two* `Money` values, and an initial calculation has one. The rule
  could not fire.
- **Give the pipeline `expectedCurrency`.** Withdrawn from that pull request: the contract
  would have been written ahead of shipped code, and blockers 1 and 3 above make it
  unimplementable regardless.

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

These follow from the proposal *if it is adopted*, and none of them is settled today.

- Something has to read the owning [[Project]] for its currency, so whichever command does
  gains a dependency it does not have. Worth stating because an earlier draft claimed no new
  dependency was needed, which made the design look cheaper than it is.
- **What happens to a Requirement whose price is in another currency is undecided**, and
  deliberately left so. An earlier draft said it is created and left `"stale"` — which
  blocker 3 above rules out, since a non-optional `estimatedCost` gives such a Requirement no
  value to be constructed with. Refusing before creation, a missing/error estimate
  representation, and requiring the override up front are all still on the table; naming an
  outcome here would be re-making the mistake this Issue exists to record.
- Whatever is chosen interacts with the **per-project price override** that
  [[Asset library]]'s definition of done requires and no slice defines. The two are not
  separable: an override supplied at creation is also an answer to the question above.

## Revisit when

The override lands and a project can supply its own price for a shared definition — at which
point the question becomes whether a supplied override replaces the proposed refusal or
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
