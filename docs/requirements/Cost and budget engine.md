---
type: Epic
order: 90
status: ""
started: ""
finished: ""
horizon: Later
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
release: "[[MVP]]"
---

# Cost and budget engine

This is the epic the spatial premise exists to serve. §1 and §2 put the renovator's real
question plainly — what should change where, and what does that cost — and the MVP question in
§48 is the same sentence. Everything drawn, calibrated, zoned and catalogued upstream is
instrumentation for this answer.

§9 to §11 make the answer derivable rather than typed, and that is the whole distinction from a
spreadsheet. A spreadsheet is a place to record a number somebody worked out; this is a place
where changing the plan changes the number. The failure mode it has to refuse is a hybrid: a
figure that looks derived and was actually typed, which is why §89's overrides have to be
visible rather than merged in.

It is also the epic where floating-point sloppiness turns into a wrong answer about money. The
SDD names currency safety as a concern of its own, and the reason is that a contingency
percentage applied to a rounded subtotal is not the same number as one applied before rounding.

Derived from PRD §18 (Epic 7), with the cost model from §9–§11, price components from §74,
currency from §72, tax from §73 and overrides from §89.

## Definition of done

An item beneath this epic is done when:

- Costs derive from quantities and geometry (§9), and a figure typed over a derived one is
  stored and displayed as an override (§89) rather than mixed into the derived total.
- €/piece, €/m and €/m² all work, because §48 puts all three in the MVP.
- Money is not held as a float where rounding can accumulate, and the rounding point is chosen
  once and tested, not left to whichever expression happens to evaluate first.
- Waste factor and contingency stay separate named steps (§18, §74), never one combined fudge
  percentage. A renovator has to be able to argue with each of them separately.
- Aggregation follows §10's hierarchy, and one figure is never computed two ways in two places.
- Tax support stays optional and labelled as planning support, not accounting or tax advice
  (§73).
- No amount is ever shown without the currency the project defines (§72).
