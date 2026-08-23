---
type: Epic
order: 10
status: Active
started: 2026-08-23
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Cross-cutting concerns

The PRD scopes twenty epics, and each of them owns one part of the product: the plan
editor, the cost engine, the schedule. Several requirements in it belong to none of them.
§44 asks for keyboard support, visible focus, no colour-only status encoding and an
alternative list view of anything spatial; §44 again names six typed error categories that
every one of those epics can raise; §83 puts units, currency, folders and editor
preferences in one settings model; §68 wants one undo stack rather than twenty. None of
that is the plan editor's work, and none of it is the cost engine's.

Written into whichever epic reaches it first, a concern like that gets decided twenty
times and differently — the twentieth screen learns the convention from whichever of the
nineteen its author happened to read. This epic is where a concern that every product epic
must honour is decided once, so that a use case three levels down inside Epic 7 has
something to be argued against rather than a precedent to imitate.

A Feature belongs here when no single product epic could own it: it appears in all of
them, or it is the thing they are all measured by. Localization is the clearest case and
is why this epic exists — every screen has text. Accessibility, error presentation and the
settings model are the others the PRD already names. A capability that merely sits between
two epics is not cross-cutting; it belongs to one of them, or it is its own epic.

The evidence is the PRD's own shape: §§12–31 are the twenty epics, and §44, §68, §83 and
§90 are lists that sit outside all of them without an owner.

## Definition of done

An item beneath this epic is done when:

- The concern is stated in one place, and a use case in a product epic cites it rather
  than restating it. Two statements of one rule are one rule and one stale copy.
- Its guarantee holds for code not yet written. A category invariant — "no screen does X"
  — is checked at the forbidden thing, with a lint rule or a spy on the call itself, never
  by driving the paths somebody thought of. The next path is the one that breaks it.
- The check that holds it names the spelling it actually sees, and the claim is narrowed to
  what that check can reach. A sentence promising more than lint and the suite deliver is
  the same defect as a comment nothing tests, and harder to notice because it reads as
  settled.
- It respects the layer rule. A cross-cutting concern that needs an Obsidian API lives in
  `infrastructure/`; `core/`, `domain/` and `application/` may not name `obsidian`, and
  `eslint.config.mjs` refuses it rather than review catching it.
- Where it cannot be checked outside Obsidian — appearance under a community theme, a
  hotkey actually firing — a `Test case` note says what to walk in a live vault, and
  carries its cadence.
