---
type: Issue
parent: "[[Quantity, cost and the end-to-end loop]]"
order: 30
status: New
started: ""
finished: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
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
between an invariant and a convention.

**It does not, on its own, catch a currency changed after the fact.** An earlier version of
this paragraph claimed the refusal would be reached on the next read, which blocker 2 above
rules out: slice 10 persists the calculated cost and does not re-invoke the pipeline while
reading it, and the provenance it compares holds `zoneArea`, `unitCost` and `assetUnit` and no
currency. Detection after a currency change needs an invalidation path or currency in the
persisted provenance — part of what any answer here has to settle, not something this proposal
delivers by itself.

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

## The answer (2026-09-01), and why this note stays open

The closing question — whether a supplied override **replaces** the proposed refusal or merely
**satisfies** it — is answered: **it satisfies it.** The check belongs to the pipeline and stands
for every caller; an override is how a project *passes* that check, not a way around it. A design
in which supplying an override removed the refusal would put the invariant back where this note
already refused to leave it, at one caller's discretion.

**What has shipped, and it is the refusal half only.**
`CostPipelineInput.expectedCurrency` is **required** and `computeEstimatedCost` refuses a mismatch
with a `CalculationError` coded `cost.currency-mismatch`, **before any arithmetic** — which is the
proposal at the top of this note, taken in its non-optional form for the reason the open
sub-question named: *an invariant a caller can omit is one a caller can silently bypass.* All
three blockers are cleared, each differently from what was expected:

1. **A `Project` has a `currency`**, defaulted from a new `defaultCurrency` plugin setting. It
   arrives through a **schema redefinition rather than a migration**: the project schema stays at
   version 1 with an optional key, and a note that states none follows the setting until something
   saves it.
2. **A currency change is caught by the read-model backstop, with no new persisted field.** This
   note's blocker 2 said the provenance holds no currency; it holds one after all —
   `calculatedFrom.unitCost.currency` **is** the project's currency at calculation time once the
   invariant above holds, because the requirement note carries one `currency:` key for the
   calculated cost, the override and the calculated-from unit cost alike. So
   `inputsStillMatch` gained one comparison and nothing else. Narrow claim, unchanged from the
   proposal: it reads **stale**, it is not recalculated.
3. **`Requirement.estimatedCost` still is not optional, and it did not need to become one.** The
   pairing refuses before a Requirement is constructed, so there is never a Requirement with no
   value to be constructed with — the "require the override up front" option, minus the override.

**Of the three withdrawn attempts recorded above, one is withdrawn a second time.** *Refuse at
`AssignAssetCommand`* was re-proposed by slice 20's design as a **third** check, in front of the
pipeline's, and it did not ship: `AssignAssetCommand` builds its figures through
`deriveRequirementFigures`, which **is** the pipeline, so it already fails on a mismatch and a
second guard buys wording rather than protection — at the price of two codes, two categories and
two surfaces for one failure. It propagates instead. The wording it would have bought is smaller
than it looks anyway: `toUserMessage` takes no params, so the user-facing sentence cannot name the
two currencies whatever raises it, and both codes live in the developer-English `message`.

**Why this note is answered and NOT closed.** The answer above is a decision, and it is recorded
here rather than only in a slice document — which is what this note was owed. The *implementation*
the answer describes is half-written: the refusal exists and the override does not, so the sentence
"an override is how a project passes the check" names a mechanism a user cannot yet reach. In a
two-currency vault the refusal is therefore a **dead end**, with no way to price a shared asset in
the project's own currency. Closing this note over that would be closing it over code nobody has
written, which is the failure its own status guard exists to prevent.

## Revisit when

**The per-project price override lands**, giving a user the way to pass the check that this note's
answer names. That is the override increment, split out of
[20 — The Currency the Pipeline Is Told](../tasks/20-the-currency-the-pipeline-is-told.md) and
enumerated in that document's Amendment 1, item 7: `AssetPriceOverride` and its two repositories,
`AssetPriceOverrideChanged` and its project-narrowed cascade, the duplicate-pair diagnostic, the
Inspector's three figures, and the affordance itself, which waits on the catalogue screen.

**Close this note then, and the specific thing to assert first** is the pair this note's question
is actually about: an assign that refuses on a currency mismatch, then a price override in the
project's currency, then the *same* assign succeeding — satisfaction demonstrated rather than
asserted. Until that pair is green, the answer above is a decision without an end-to-end witness.

The first half — the refusal, the project's currency, the setting and the staleness backstop —
landed on 2026-09-01 and is recorded in that document's Amendment 1.

## References

- PRD §59 (as amended 2026-08-26 — the shared catalogues), §72 (a project's currency), §89
  (manual overrides).
- `docs/tasks/09-quantity-and-cost-engine.md` — `CostPipelineInput` as it currently stands,
  which is the **baseline this proposal would change**, not a contract it violates: that slice
  specifies no expected currency and the code provides none, so the two agree.
  `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md` — where the question is named,
  and the override gap it is entangled with.
- `src/domain/cost/costPipeline.ts` — the shipped interface, and `pricedPer?` as the template.
  `tests/domain/cost/costPipeline.test.ts` — the only callers.
- [[A mismatched unit or currency is an error, not a coercion]] — the rule, and the reason it
  did not reach this case. [[Work belongs to one project, catalogues belong to the vault]] —
  why an Asset's price is not the project's to begin with.
