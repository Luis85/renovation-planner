---
type: PBI
parent: "[[Professional response reconciliation]]"
order: 30
status: New
horizon: "V1"
release: "[[Mighty Dragon]]"
dependsOn: "[[Capture assumptions exclusions and commercial terms]]"
---

# Reconcile a returned scope and quote with the plan

## Actor

[[Private renovator]] comparing professional responses and deciding what to do next.

## Main flow

1. The plugin compares each returned response with the canonical scope snapshot in the package it
   answered.
2. It groups matched items, omissions, additions, substitutions, assumptions, exclusions,
   allowances and unresolved questions.
3. Price remains attached to the returned quote lines; coverage and price are shown separately so
   the lowest total cannot look complete by implication.
4. The renovator follows any difference to the current plan, work, quantity, decision or evidence
   authority and records the intended resolution there.
5. Selecting a response creates or updates a canonical decision and commitment through their
   existing authorities; it does not rewrite the issued package or competing quotes.
6. If the resolution changes the request baseline, the plugin offers a new package issue with an
   explicit delta for affected recipients.

## Extensions

- **1a** — A response cannot be mapped confidently. It stays unmatched and is surfaced for manual
  clarification rather than assigned by text similarity alone.
- **2a** — Two responses use different work breakdowns. Each is compared with the common package
  scope, not normalized into a fabricated shared quote structure.
- **4a** — A professional alternative is preferred. The choice and rationale enter the decision
  authority before the current plan changes.
- **5a** — Selection or commitment persistence fails. No quote is displayed as selected and the
  structured comparison remains read-only.

## Guarantee

Comparison is against the issued plan/scope baseline and preserves every original response;
selection is an explicit decision, not a side effect of viewing or matching.

## Out of scope

- Automatically selecting a contractor or declaring an offer best.
- Inferring scope coverage from price alone.
- Mutating an issued package, returned quote or canonical plan during a read-only comparison.

## Acceptance criteria

1. Each response is compared with the exact package issue it answered.
2. Coverage categories and monetary amounts remain separate dimensions.
3. Unmatched and ambiguous items are visible and never auto-linked without confidence.
4. Original response evidence and quote lines remain unchanged.
5. Selection routes through the canonical decision and commitment authorities.
6. A baseline-changing resolution identifies affected issued packages and can seed a new issue.

## Sources

- [[Quote comparison]].
- [[Decisions and alternatives]].
- Product Capability Map §§14 and 23.
- Competitive landscape Opportunities 4–5 and 7.
