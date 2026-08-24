---
name: Status badge
medium: dom
region: in-flow
slice:
  - "[[17-presentation-layer-error-surfacing]]"
partOf: "[[Design System]]"
sources:
  - PRD §30
  - PRD §44
  - SDD §64
  - SDD §66
type: component
image: "[[status-badge.png]]"
---

# Status badge

A **persisted** condition, shown where the thing it is about lives. The surface for a state that
is neither transient (a [[Toast]]), nor blocking (a [[Modal]]), nor about one field (an
[[Inline field error]]) — which is a definition by exclusion, and that is deliberate: this
component exists because slice 17 needed a fourth answer and the other three were all wrong.

## Specimen

![Status badge, and the states it owes, in Obsidian's default light and dark](status-badge.png)

A drawing of the proposal, not a screenshot of anything built — `src/` is a scaffold.
Obsidian's **default** light and dark, so a themed vault differs; shot from
[`component-gallery.html`](component-gallery.html) by `npm run concept-shots`.

## Anatomy

- **A short label**, which is the component. `recalculationStatus` from slice 10 is the worked
  case and its values are words.
- **A mark**, secondary. The label carries the meaning; the mark makes it findable.

## States

It is a state's *display*, so its variants are whatever vocabulary it is given. Two families
exist in the sources and **they are not the same thing**:

| Family | Values | Owned here? |
| --- | --- | --- |
| **Health** | Stale, recalculating, failed | Yes |
| **Object state** | PRD §30's existing, to-remove, to-retain, planned, in-progress, installed | No — see open question 1 |

Keeping them apart matters because health is about whether the plugin is telling the truth, and
object state is about the building. A single badge showing either would make *failed* and
*to-remove* the same kind of fact.

## Contract

**Given** a status value and the vocabulary it belongs to. **Emits** nothing, or a retry request
where the status is a recoverable failure.

**A value this version does not know renders as itself.**
[[A type this version does not know survives a round trip verbatim]] is a persistence rule, and
it reaches the display: a badge that rendered an unrecognised value as blank has made the round
trip look lossy to the one person who could report it.

The related rule is [[A derived value is recomputed on read, not persisted]] — which is what makes
a *stale* badge meaningful at all. If derived values were stored, staleness would be invisible;
because they are recomputed, a recalculation that has not run yet is a real condition with a real
name.

## Where it appears

Anywhere an entity is shown — and **not** inside a Bases row. [[Design System]] already records
the price of [[The alternative list route is a Bases view]]: nothing plugin-specific travels into
that row, so a badge in a Bases table is Obsidian's, not this component's.

That gives a status two answers that will not match, the same way *selected* already has two. It
is accepted rather than overlooked.

`region: in-flow`.

## Accessibility

**Never colour alone**, and here the label *is* the second channel — which makes this the
easiest component in the inventory to get right and the one most likely to be shipped as a
coloured dot anyway, because a dot fits in a table cell and a word does not.

PRD §44 and SDD §85 both name colour-only status encoding, and this is the component they are
most obviously about.

## Open

1. **Are health and object state one component with two vocabularies, or two components?**
   PRD §30's six object states are *state visualization*, which no design slice builds — so inventing
   its vocabulary here would be designing a component's states from a diagram. Named rather than
   decided.
2. **Whether a badge may be the only report of a failure.** Slice 17's table decides which
   category lands where, and a persisted badge that nothing ever announced is a failure a user
   discovers by accident.

## Sources

PRD §30 · PRD §44 · SDD §64 · SDD §66, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
