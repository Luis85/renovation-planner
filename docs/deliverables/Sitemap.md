---
type: Deliverable
parent: "[[User Interface]]"
order: 20
status: Open
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Sitemap

The artifact, **derived**, citing its sources, expected to change as the design is refined —
and a refinement that contradicts a source names the section it refines and lands here rather
than in `docs/product/prds/` or `docs/development/sdds/`.

It answers **which surfaces exist and how someone gets between them**. What each is called
and where a fact belongs is [[Information Architecture]]'s; what a control is made of is
[[Design System]]'s.

## The inventory

Every surface the received documents name. `Registered` is what `src/` actually has today,
which is one thing.

| Surface | Kind | Source | Stage | Mobile | Registered |
| --- | --- | --- | --- | --- | --- |
| Renovation Project | Workspace view | SDD §11 primary | MVP | read | **yes** — `renovation-project` |
| Plan editor | **Mode** of `renovation-project` | SDD §11 primary | MVP | no | no |
| Dashboard | Workspace view | SDD §11 future | V1 | read | no |
| Renovation Plan | Bases view | PRD §41, SDD §13 | V1 | read | no |
| Budget | Bases view | PRD §41, SDD §13 | V1 | read | no |
| Assets | Bases view | PRD §41, SDD §13 | V1 | read | no |
| Procurement | Bases view | PRD §41, SDD §13 | V1 | read | no |
| Schedule | Bases view | PRD §41, SDD §13 | V1 | read | no |
| Risks | Bases view | PRD §41, SDD §13 (as `Risk`) | V2 | read | no |
| Work Packages | Bases view | **PRD §41 only** | V1 | read | no |
| Settings | Settings tab | PRD §83, declarative | MVP | read | **yes** — one setting |
| Confirmation and deletion dialogs | Modal | PRD §64, slice 15 | MVP | n/a | no |
| Toasts and save-state indicator | Chrome | PRD §67, slice 13 | MVP | n/a | no |

**Not in the table, and deliberately: three candidates with triggers.** Budget, Schedule and
Procurement are named twice in the sources — SDD §11's future workspace views and SDD §13's
Bases views. [[Budget, Schedule and Procurement are Bases views first]] resolves that to their
Bases rows above, and a workspace view for any of the three is a candidate that arrives only
with a named trigger. Schedule's already exists (PRD §21's three timelines; SDD §53's *"a
future Gantt renderer remains an adapter"*); Budget's and Procurement's do not. A candidate is
not a surface, so it gets no row — which is the whole difference between this note being an
inventory and being a wish list.

**Three things the table records rather than smooths over.**

*Work Packages is in PRD §41 and not in SDD §13.* A view the product document names and the
design document omits is product intent the design missed, not a view that was refused, so it
is listed. `Risk` versus `Risks` is settled in [[Information Architecture]]'s naming register.

*The Plan editor is a row and not a surface.* SDD §11 lists it as a second primary workspace
view; [[The plan editor is a mode, not a second view]] makes it a mode of the first, persisted
through `getState()`. It keeps its row because a renovator goes there and it needs a route —
but it registers no view type, holds no layout entry of its own, and takes no second hotkey.
The `Kind` column is where that distinction lives, and it is the only row that uses it.

*Thirteen rows, two registered.* The gap is the Feature's evidence, not a defect. It was
sixteen before the three decisions below: three duplicate workspace rows became candidates,
and the count fell without a single surface being refused.

## Entry points, and the rule about them

**One action, every input.** A ribbon click, a command palette entry and whatever a toolbar
adds later call **one** function — `revealView` today — and adding an input means calling
that function rather than re-deciding beside it. A second entry point with its own activation
looks correct alone and opens a duplicate tab the moment a user uses both. `CLAUDE.md` states
this as an architecture rule; it is repeated here because a sitemap is exactly where somebody
would otherwise draw a second arrow.

A **view type and a command id are data**: Obsidian persists the first in the workspace layout
and binds a user's hotkey to the second, so a route in this note that names either is naming a
value that cannot be renamed for tidiness. The display names beside them are text, and
translatable.

## The routes

```text
                                    ┌─ renovation-project ──────────────┐
  ribbon ─┐                         │                                   │
 command ─┼─→ revealView(type) ─────┼→ mode: project ⇄ mode: editor     │
 toolbar ─┘                         │        ▲              │           │
                                    └────────┼──────────────┼───────────┘
   note (wikilink) ───────────────────────────┘              ▼
   Bases row ────────────────────────────────┘          zone / object
   search hit ───────────────────────────────┘               │
                                                             ▼
                                            note · inspector · Bases view
```

One box, two modes, and the mode is persisted rather than chosen on every open — which is why
the diagram has no second `revealView` target and no second arrow into the editor. The mode
default is [[Disclosure ladder]]'s, not this note's: `editor` once a calibrated plan exists,
`project` before that, and the renovator's own last choice outranks both.

Four routes carry the product's own requirements rather than convenience:

1. **Note → plan.** PRD §40 requires a domain object to be findable from a note, a Bases row,
   a list or a dashboard and navigable *to its place in the plan*. This is the route that makes
   the plan an index rather than a picture, so it is the one route no surface may omit.
2. **Plan → note.** The inverse, and the cheaper half: a selected object reaches its note in
   one move. SDD §59 routes selection through an inspector DTO, so the inspector is where the
   link lives.
3. **Object → Bases view.** Every spatial surface owes a second, non-spatial way to the same
   facts (PRD §40, §44; SDD §85), and that way is a Bases view — decided in
   [[The alternative list route is a Bases view]], once for every spatial surface rather than
   nineteen times.
4. **Anywhere → settings.** Obsidian owns this one. The plugin adds no settings entry of its
   own, because 1.13 renders and indexes the declarative definitions and a second door would
   be a second answer to what a setting is.

## The alternative route, and why it is also the mobile story

The alternative-list requirement looked like it roughly doubled the surface count, and the
received documents never said what kind of surface it was. **It adds none.**

The observation this note contributed is what settled it: **the alternative-list route and the
mobile read-only scope are one problem.** `PRODUCT.md` fixes the canvas as desktop and mobile
as readable; SDD §61 optimises the MVP for desktop while preserving read-only options. PRD §41
and SDD §13 already put Bases views over the same vault data, and Bases is Obsidian's own —
localized, themed, keyboard-navigable, and working on mobile. A Bases view satisfying PRD §44's
alternative access therefore *is* the mobile surface, and building the route as anything else
would have built the mobile story twice.

[[The alternative list route is a Bases view]] takes that decision and records what it rejected
— a workspace view per spatial surface, an in-editor pane, and a Bases-plus-optional-pane
compromise whose word *optional* was the reason it failed. The consequence for this note is
that the Bases rows in the inventory are doing two jobs each, and the price is stated rather
than hidden: **nothing plugin-specific can live in a row**, so no drawn state and no canvas
selection is reflected there. That price is paid on every spatial surface.

## Answered since, and where

Three of this note's four open questions are closed, each by an `Issue` recording its rejected
alternatives, because a decision that says only what was done leaves the next reader to
re-derive them.

| Was open | Answer | Recorded in |
| --- | --- | --- |
| Is Budget (and Schedule, Procurement) a workspace view, a Bases view, or both? | Bases views in V1; a workspace view needs a named trigger | [[Budget, Schedule and Procurement are Bases views first]] |
| What kind of surface is the alternative route? | A Bases view, once for every spatial surface | [[The alternative list route is a Bases view]] |
| Is the Plan editor a separate view or a mode? | A mode of `renovation-project`, persisted in `getState()` | [[The plan editor is a mode, not a second view]] |

**One correction this note owes, rather than one it received.** Its third question weighed the
mode option against a cost that does not exist: it said one view type "means a mode the
workspace cannot restore into". The `obsidian@1.13.0` typings — the pinned floor, so an API
`minAppVersion` actually promises — carry `View.getState()`, `View.setState()` and a persisted
`ViewState` interface. **A mode is restorable.** The claim was written from the prose rather
than from the typings, it is exactly the shape `CLAUDE.md` warns about under *an assumed API*,
and the alternative it argued against was nearly rejected on it.

## Open, and not decided here

1. **Where does onboarding live?** PRD §93 sequences install → create project → choose folder
   → import plan → calibrate → first zone, across at least two surfaces and a modal. That is
   [[Onboarding and example project]]'s to answer — **not** [[User Experience]]'s, which an
   earlier version of this line said. §93, §94 and §95 are claimed by name in that note, and
   [[Start a renovation project]] already defers to it twice. This note gains the row once it
   answers. [[User Experience]] owns when a surface appears at rung *n*, which is a different
   question asked every session rather than once.
2. **Does the Dashboard survive as a workspace view?** It is the one name in SDD §11's future
   list with no Bases counterpart, so the trigger rule in
   [[Budget, Schedule and Procurement are Bases views first]] never reached it — it was never
   named twice. Whether a project cockpit (PRD §28) is a view or a mode of
   `renovation-project` is the same question that note answered for the editor, asked about a
   surface nobody has scoped.

## References

- PRD §39 (the one surface with a layout), §40 (search and navigation — routes 1 and 2), §41
  (Bases views, seven of them), §44 (alternative list/table access), §64 (deletion semantics —
  the modal), §67 (autosave states — the chrome), §83 (settings model), §85 (the command
  model), §93 (installation and onboarding), §94 (empty states).
- SDD §11 (workspace views), §13 (Bases integration, six views), §53 (scheduling — Schedule's
  trigger), §59 (inspector — route 2), §60 (UI layout), §61 (responsive strategy — desktop MVP,
  mobile read-only preserved), §85 (accessibility, alternative data access).
- `obsidian@1.13.0` typings — `View.getState()`, `View.setState()`, `ViewState`. Read rather
  than assumed, which is how the correction above was found.
- `PRODUCT.md` — desktop-first with mobile read-only, confirmed, which bounds the Mobile
  column above.
- `CLAUDE.md` — one action every input; a view type and a command id are data, not text; and
  *an assumed API gets verified in a live vault*, which is the rule the correction above broke.
- [[Information Architecture]] — the naming register these rows use, and the grouping surfaces
  are assigned to. [[Disclosure ladder]] — which mode is the default, and at which rung a
  surface appears at all.
- [[The alternative list route is a Bases view]],
  [[Budget, Schedule and Procurement are Bases views first]],
  [[The plan editor is a mode, not a second view]] — the three decisions that closed three of
  this note's four open questions. [[Onboarding and example project]] — the owner of the
  fourth.
- [[User Interface]] — the Feature, and the honest statement that nothing checks this
  inventory against `src/` until `npm run docs` exists.
