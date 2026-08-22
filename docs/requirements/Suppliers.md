---
type: Feature
parent: "[[Suppliers, quotes and procurement]]"
order: 10
status: ""
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Suppliers

§22's supplier records: the merchants, trades and shops a renovation actually buys from, as notes
(§37) with stable IDs (§60). They are worth modelling because the same three names recur across a
year of quotes, orders and deliveries, and because a lead time or a delivery habit learned once
should not have to be relearned.

## Outcome

A renovator keeps one record per supplier and everything bought from them points at it.
