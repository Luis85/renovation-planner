---
name: Save-state indicator
medium: dom
region: chrome
slice:
  - "[[13-notifications-and-save-state-surfaces]]"
partOf: "[[Design System]]"
sources:
  - PRD §44
  - PRD §66
  - PRD §67
  - SDD §85
type: component
image: "[[save-state-indicator.png]]"
---

# Save-state indicator

Which of PRD §67's four states the document is in: **Saved**, **Saving**, **Unsaved Changes**,
**Save Error**. Four values, and they are the component's entire content — which is what makes
it the canonical case for the rule that status is never colour alone.

## Specimen

![Save-state indicator, and the states it owes, in Obsidian's default light and dark](save-state-indicator.png)

A drawing of the proposal, not a screenshot of anything built — `src/` is a scaffold.
Obsidian's **default** light and dark, so a themed vault differs; shot from
[`component-gallery.html`](component-gallery.html) by `npm run concept-shots`.

## Anatomy

**A mark and a word.** Both, always, never one. The mark is what a user reads at a glance and
the word is what makes it readable at all — and this is the component where the temptation to
ship a coloured dot is strongest, because the dot works perfectly for the author who built it.

## States

Exactly the four, and each maps onto a row of [[Design System]]'s state table rather than
inventing a channel:

| State | Second channel |
| --- | --- |
| Saved | A settled mark, and the word |
| Saving | Design System's *Loading*: a moving indicator **and** text |
| Unsaved Changes | A distinct mark, and the word — not the absence of the saved one |
| Save Error | Design System's *Error*: an icon **and** a message |

*Unsaved Changes* being a mark rather than an absence is the row worth defending. An indicator
that shows nothing when there is unsaved work is indistinguishable from one that has crashed.

## Contract

**Given** the save state. **Emits**, in the Save Error case only, a retry request.

**It does not save.** PRD §66's save strategy and the repository own that; PRD §67's autosave
fires after completed commands and debounced property edits, and this component observes the
result. [[Only a completed domain action persists]] is the rule behind the first of those two
triggers, and this indicator is where a user learns it held.

## Where it appears

[[Status bar]], third region, per SDD §60. It has no other home today — and if the bar turns out
not to exist in project mode, this component needs one, because autosave does not stop when the
mode changes.

## Accessibility

**This is the canonical "status not encoded only by colour" case** — PRD §44 lists it, SDD §85
lists it, and [[Accessibility]] owns the requirement. Every one of the four states above names a
word precisely so that this component cannot be built as three coloured dots.

It is also a live region, and unlike [[Status bar]] as a whole its changes are all meaningful:
four discrete transitions, none of them continuous. *Saving* is the exception worth care — a
fast save that flickers through Saving to Saved announces twice for one event.

## Open

1. **Does Save Error also raise a [[Toast]], or is it the indicator's alone?** This is
   [[Shared UI vocabulary]]'s slice 17 question — which error category gets which surface — and
   this note deliberately does not answer it. A failure reported twice is the exact defect that
   group of slices exists to prevent.
2. **Whether *Saving* is shown at all for a save fast enough to be invisible.** A state that
   flashes for 30 ms is motion without information.

## Sources

PRD §44 · PRD §66 · PRD §67 · SDD §85, in
[`docs/product/prds/obsidian-renovation-planner.md`](../product/prds/obsidian-renovation-planner.md) and
[`docs/development/sdds/obsidian-renovation-planner-SDD.md`](../development/sdds/obsidian-renovation-planner-SDD.md).
