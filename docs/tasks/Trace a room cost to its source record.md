---
type: Task
parent: "[[Understand room costs and follow them to their authority]]"
order: 20
status: New
horizon: "V1"
release: ""
---

# Trace a room cost to its source record

## Evidence

M13 links room costs to work, material, quote, document and supplier relationships. The editor's
core model treats the canvas as another navigation path through one project model.

## Why it matters

A total that cannot be followed to its source is no more trustworthy than a spreadsheet cell with
an unexplained formula.

## Approach

Return typed source references with each authoritative cost row. Let row selection reveal related
spatial/work context and offer an open action for the owning cost, material, quote, invoice,
document or supplier record.

## Acceptance criteria

1. Every readable cost row identifies its authoritative source type and stable id.
2. Selecting a linked row reveals its related work or spatial target when one exists.
3. Open actions navigate to the owning record rather than copying it into the Inspector.
4. A missing source remains an explicit broken relationship and does not invalidate unrelated
   readable rows.

## Risks

- A generic untyped link could route the same id to the wrong authority.
- Missing sources could be silently dropped and make totals impossible to reconcile.

## Outcome

A homeowner can move from any room cost to the record that authorizes it.
