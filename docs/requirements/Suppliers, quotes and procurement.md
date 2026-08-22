---
type: Epic
order: 130
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

# Suppliers, quotes and procurement

The PRD splits this in two — §22 for suppliers and quotes, §24 for procurement and shopping —
and the split does not survive contact with the thing being modelled. §33's financial lifecycle
is one chain: an estimate becomes a quote, a quote becomes an order, an order becomes a delivery
and then an actual cost. §37 lists Supplier, Quote, Order and Invoice together as note entities
and §36 files them as neighbours. Kept apart, the two epics would each need the other's half of
the chain, and the join — a quote item that becomes an ordered quantity — would be specified
twice and agree by luck. So they are one epic here, and this note is the record of that
decision.

What it is for is the gap between a number in a plan and a number on an invoice. A renovator
collects three quotes for the bathroom and needs them comparable *against the plan* rather than
against each other in a mail folder. Then the ordering arithmetic starts, and it is not
arithmetic anybody enjoys doing twice: 41 m² of tile is fourteen boxes because of a package size,
the delivery slips a fortnight, and the two boxes left over are §76's inventory that the next
room should be allowed to consume.

The quantity chain in §75 is shared with [[Asset library]], which owns the requirement end of it.
This epic owns everything from purchase quantity onward.

Derived from PRD §22 (Epic 11) and §24 (Epic 13), with the financial lifecycle from §33, quantity
semantics from §75, inventory from §76 and dependencies from §77.

## Definition of done

An item beneath this epic is done when:

- A quote item links to the asset or work package it prices (§22), so a comparison is against
  the plan rather than between two PDFs.
- An estimate, a quote, an ordered amount and an actual cost stay four distinguishable values
  (§33). Overwriting the estimate with the quote destroys the only evidence of how good the
  planning was.
- Purchase quantity is derived from required quantity by package size and minimum order quantity
  (§24, §75), and the derivation is visible rather than an unexplained rounded number.
- The procurement lifecycle is exactly §24's eight states, `partially-delivered` included — it is
  the state that makes the model honest about how deliveries actually arrive.
- Remaining material becomes inventory a later requirement can consume (§76) instead of vanishing
  from the model at delivery.
- An expired quote is visibly expired (§22) and never silently used in a total.
- Delivery dates reach [[Schedule]] by reference; there is no second store of dates here.
