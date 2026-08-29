---
name: Toast
medium: dom
region: overlay
slice:
  - "[[13-notifications-and-save-state-surfaces]]"
partOf: "[[Design System]]"
sources:
  - PRD §44
  - PRD §67
  - SDD §30
  - SDD §64
  - SDD §66
type: component
image: "[[toast.png]]"
---

# Toast

A transient message about something that **already happened**. Not a question, and not a failure
the user has to act on — those are [[Modal]]'s and [[Inline field error]]'s. The narrowest
definition available is the useful one here, because a toast is what every other surface's
failure gets routed to when nobody decided where it belonged.

## Specimen

![Toast, and the states it owes, in Obsidian's default light and dark](toast.png)

A drawing of the proposal, not a screenshot of anything built — `src/` is a scaffold.
Obsidian's **default** light and dark, so a themed vault differs; shot from
[`component-gallery.html`](component-gallery.html) by `npm run concept-shots`.

## Anatomy

- **A message**, already translated and already user-facing.
- **Optionally one action** — undo, retry, reveal.
- **A dismiss**, always, and a timeout for the benign case.

## States

| State | Notes |
| --- | --- |
| Entering | Motion, and the one place this component has any |
| Present | Visible, counting down or waiting |
| Leaving | Dismissed, timed out, or superseded |

It has **no focus state and takes no focus**. A toast that steals focus interrupts the thing the
user was doing to tell them about the thing they already did.

Severity is a variant rather than a state, and each variant owes a mark as well as a colour —
[[Design System]]'s *Error* row applies to the failing one.

## Contract

**Given** a user-facing message that was already mapped at the application boundary. SDD §66 is
the pipeline: infrastructure exception, application error mapping, typed result, presentation,
user message. A toast that received an `Error` object and formatted it would be doing the
application layer's job in a view.

**Emits** a dismiss, and its action where one exists.

**It does not decide that it is the right surface.** That is slice 17's whole purpose — which of
SDD §64's eight categories becomes a toast, which an inline error, which a blocking modal, which
a persisted [[Status badge]]. A component that routed to itself would make that table
unenforceable.

## Where it appears

Any surface. `region: overlay` because it genuinely overlays rather than displacing content —
the distinction that separates it from [[Empty state]] and [[Status badge]], which are `in-flow`.

## Accessibility

`role="status"` for the benign, `role="alert"` for the failing, and **neither on a container that
appears**. A live region that is already in the DOM and gains a child announces reliably; one
that is inserted along with its content often does not. That is a mechanism detail, and it is the
one that decides whether this component works at all for the users it exists for.

The timeout is the other half: a message that disappears before it can be read is inaccessible in
a way no ARIA attribute fixes.

## Settled

**Obsidian's `Notice` is the container primitive.** Open question 1 was slice 13's to answer and
slice 13 answered it, so it is recorded here rather than left standing as a question the code has
already decided.

The argument that decided it is a division of labour rather than a preference. `Notice` already
offers four of the six things this component owes — manual dismiss (`hide()`), persist until
dismissed (`duration: 0`), real DOM to write severity markup and a dismiss control into
(`messageEl` / `containerEl`), and in-place replacement for a repeat count (`setMessage`). It
offers neither hover-pause of the auto-dismiss timer nor a visible-slot cap with promotion, and
both fall out of one choice: every notice is constructed with `duration: 0` and the plugin owns
the timer. Both handles are `@since 1.8.7` and `manifest.json` declares `minAppVersion: 1.13.0`,
so neither is a bet. The alternative — a second Vue app with a plugin-global Pinia — would have
needed an exception to SDD §12 and given the plugin two toast surfaces instead of one.

**The consequence this note already predicted holds, and it is the price.** A `Notice` renders
outside the view's DOM, so it is outside `contentEl` — and `tests/harness/accessibility.test.ts`
scans `contentEl`. The surface carrying the most new ARIA in slice 13 is therefore the one
surface no axe scan reaches: the roles and `aria-live` values below, and the dismiss control's
accessible name, are asserted by jsdom tests one attribute at a time and graded by no
accessibility instrument. Its markup also stays Obsidian's to change.
`docs/tests/cases/Notices and save state.md` is where that gap is worked, and a vault is the
only instrument.

## Open

1. **Whether a toast may carry an undo.** SDD §30's undoable editor commands make it possible; PRD §67
   does not ask for it, and an undo that expires with a timeout is a promise with a clock on it.

## Sources

PRD §44 · PRD §67 · SDD §30 · SDD §64 · SDD §66, in
[`docs/prds/obsidian-renovation-planner.md`](../prds/obsidian-renovation-planner.md) and
[`docs/sdds/obsidian-renovation-planner-SDD.md`](../sdds/obsidian-renovation-planner-SDD.md).
