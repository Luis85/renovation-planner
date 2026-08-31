---
type: Issue
parent: "[[User Interface]]"
order: 60
status: Done
started: 2026-08-23
finished: 2026-08-23
horizon: Now
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
---

# The plan editor is a mode, not a second view

A decision taken, recorded with what it rejected. It was [[Sitemap]]'s open question 3, and it
blocked design slice 05 — which cannot register a view without knowing whether there is one or
two.

## The question

SDD §11 lists **Renovation Project** and **Plan Editor** as its two primary workspace views and
says nothing about their relationship. `src/` registers only `renovation-project`, and it draws
an empty div. A view type is *data* — Obsidian persists it in the workspace layout and binds a
user's hotkey to the command that opens it — so this is not a decision that can be taken
loosely and corrected later without orphaning something a user has.

## The decision

> **One view type, `renovation-project`, with the plan editor as a mode inside it. The mode is
> persisted in the view's own state, so the workspace restores into it.**

Its default is settled by [[Disclosure ladder]] rather than here: `editor` once a calibrated
[[Plan]] exists, `project` before that, and the renovator's own last choice outranks the
default.

## Why

- **Sitemap's stated cost for this option was false, and this note is where that is recorded.**
  [[Sitemap]] wrote that one view type "means a mode the workspace cannot restore into". The
  `obsidian@1.13.0` typings — the pinned floor, so this is an API `minAppVersion` actually
  promises — carry `View.getState()` and `View.setState()` and a persisted `ViewState`
  interface. A mode *is* restorable. The alternative was rejected against a cost it does not
  have, which is the kind of error that is only findable by reading the typings rather than the
  prose, and the note that made the claim is corrected in the same change as this one.
- **It keeps one entry point genuinely one.** `CLAUDE.md`'s *one action, every input* exists
  because "a second entry point with its own activation looks correct alone and opens a
  duplicate tab the moment a user uses both". Two view types means a second `revealView` target,
  a second command id, a second hotkey and two things to keep consistent — every one of which is
  a place the rule can be broken by an author who never read it.
- **The mode becomes a rung rather than a surface**, which is what [[User Experience]] now owns.
  A renovator with no plan is not looking at a locked second view; the editor mode simply is not
  where they are. That is the disclosure ladder's *hidden means absent* doing real work instead
  of being a slogan.
- **Two persisted view types are two liabilities forever.** A view type cannot be renamed for
  tidiness once a workspace layout holds it. Declining the second one costs nothing today and
  cannot be un-declined expensively later — whereas adding it later is a normal registration.

## Alternatives rejected

**Two separate view types.** SDD §11 does list both as primary, and this is the reading closest
to the received document. It buys one thing the mode cannot: **both surfaces open side by side**,
canvas on the left and project overview on the right. Rejected because nothing in
`docs/requirements/` asks for that, and the cost is paid immediately and permanently — two
persisted layout entries, two hotkeys, two commands, and the standing temptation for the second
to acquire its own activation. Recording the benefit precisely is the point: this is the
alternative most likely to be right later, and the trigger below is exactly its benefit.

**Mode now, a second view type when side-by-side is asked for.** Rejected as a distinction
without a difference: it is this decision, with the trigger stated as a plan instead of a
trigger. Naming it in *Revisit when* is the same commitment without leaving the inventory's
second row conditional — and [[Sitemap]] cannot carry a row that may or may not be a surface.

## Consequences

- [[Sitemap]]'s inventory drops the Plan editor row as a surface and gains it as a mode of the
  first row. The count of unregistered workspace views falls by one.
- Slice 05 registers no new view type. It adds a mode to the existing one and a `getState()`
  contract for it — which is new work the slice did not previously have, and smaller than a
  registration.
- `renovation-project` gains persisted state, so the settings-style trust question arrives with
  it: a restored state naming a mode this version does not know must fall back rather than
  throw. That is the same argument `settingsFrom` makes about `data.json`, and it now has a
  second instance. Whether it shares a mechanism is not decided here.
- The two cannot be viewed simultaneously. This is the accepted loss, stated plainly rather
  than left to be discovered.

## Revisit when

A use case needs the canvas and the project overview visible at the same time. That is the
rejected alternative's one real benefit, and when somebody writes the use case, the second view
type is the answer.

## References

- SDD §11 (workspace views — the two primaries, and their unstated relationship), §12 (one Vue
  app per view, mounted per view), §60 (UI layout).
- `obsidian@1.13.0` typings: `View.getState()`, `View.setState()`, the `ViewState` interface —
  the pinned floor, so an API `minAppVersion` promises.
- `CLAUDE.md` — *one action, every input*; a view type and a command id are data, not text; and
  `settingsFrom` as the shape a trust boundary on persisted state takes.
- [[Sitemap]] — its open question 3, and the false restoration claim this note corrects.
  [[Disclosure ladder]] — which mode is the default, and why that is a rung question.
  [[User Experience]] — the Feature that owns when a surface appears.
  [[Architecture and Software Design]] — the slices, and slice 05.
