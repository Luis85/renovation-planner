---
rule: BR-QTY-006
kind: constraint
name: An asset's unit kind must match the dimension its requirement is derived from
area: quantity
sources:
  - PRD §32
  - SDD §48
type: business-rule
---

# An asset's unit kind must match the dimension its requirement is derived from

**The rule.** A [[Zone]]'s derived area is a valid input only for an **area**-kind [[Asset]].
Assigning an asset priced by the metre to a requirement calculated from an area is refused at
assignment, and the same edit is refused from the other side: changing a referenced asset's unit
out of its current kind is rejected while any [[Requirement]] still points at it.

The check is on the *kind* (`UNIT_KIND[asset.unit] === "area"`), not on the string `"m2"` — a
check written against the symbol would silently stop working the day a second area unit is added.

**Why.** There is no correct quantity to recalculate *to*, because a zone's area is not a length.
Enforcing this only at creation would leave the state reachable by update: a `m2 → m` edit on a
referenced asset would manufacture exactly the link the assignment path refuses to create — an
invariant enforced where things are made and abandoned where they are changed.

**Where it holds.** `AssignAssetCommand` refuses the assignment; `UpdateAssetCommand` refuses the
unit change, holding the asset's reference lock from before the reference lookup through the save.
The lock is the rule's other half: an update that observes zero referents can otherwise be
overtaken by an assignment that creates one, and a guard that only *usually* holds is not an
invariant. Changes *within* a kind stay allowed and cascade normally, as does any unit change on
an asset nothing references yet.

**Checked by.** Not yet. Slice 10 states the guard, the lock window and the read-model backstop
(`calculatedFrom.assetUnit`) that covers the paths a command cannot police.

**Sources.** PRD §32 · SDD §48 · slice 10
([`docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`](../../tasks/10-assets-requirements-and-the-end-to-end-loop.md)).
