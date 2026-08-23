---
type: Deliverable
parent: "[[User Experience]]"
order: 10
status: New
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

# Disclosure ladder

The artifact, **derived**, citing its sources, expected to change as the design is refined —
and a refinement that contradicts a source names the section it refines and lands here rather
than in `docs/prds/` or `docs/sdds/`.

It answers **which of the fifteen steps are visible at which model density, and what promotes
a rung**. Which surfaces exist is [[Sitemap]]'s; what they are called is
[[Information Architecture]]'s; what a control is made of is [[Design System]]'s. None of
those three can state an order, which is why this note exists.

## What this note may not restate

Four boundaries, and the fourth is the one that would otherwise be crossed by accident.

- **[[Sitemap]]** owns the inventory and the routes. This note names a rung's *home surface*
  by pointing at a row there; it never adds a surface, and a rung is not a surface.
- **[[Information Architecture]]** owns the naming register and the six groups. This note uses
  those groups and adds nothing to them: IA says what is in *Place*, this note says when
  *Place* is all there is.
- **[[Design System]]** owns what a revealed control looks like. A rung has no appearance.
- **[[Onboarding and example project]]** owns PRD §93, §94 and §95 — and the line is a test
  rather than a topic:

> **Hidden means absent. Empty means present-but-unfilled.**
>
> If the renovator could navigate to it, what they find is §94's empty state and belongs
> there. If they could not navigate to it at all, its absence is this note's.

A hidden rung therefore has no copy, no placeholder, no greyed tab and no "coming soon" — it
is not on the surface. The moment something exists for a renovator to arrive at, this note is
finished with it. That keeps one PRD section under one owner, which `docs/README.md` requires
because a rule stated twice becomes one rule and one stale copy the day either is edited.

## The five sequences this note reconciles

None of the five is wrong and all five are received, so the reconciliation lives here.

| Source | Steps | What it is actually describing |
| --- | --- | --- |
| PRD §3.5 | 4 | The smallest path to value. Not a journey — a floor |
| PRD §93 | 6 | Getting the plugin to that floor from a cold install. [[Onboarding and example project]]'s |
| SDD §3.7 | 6 | The MVP's own scope, read as a sequence |
| PRD §53 | 9 | A cycle. The only one of the five that returns to its start |
| PRD §5 | 15 | Every step the product will ever have, drawn as a straight line |

They differ because they answer different questions, and the register had been reading them
as five drafts of one drawing. PRD §5 is the **superset**; PRD §3.5 is **rung 1**; PRD §53 is
what the ladder looks like once every rung is unlocked and the renovator is going round rather
than forward. That reading is this note's contribution, and it is a refinement rather than a
citation: no source says any of it.

## The ladder

Each rung names the [[Information Architecture]] group it opens, the PRD §5 steps it contains,
and the fact that promotes it. Rung 1 is PRD §3.5's four steps and `PRODUCT.md` principle 3's
promise, restated as a floor nothing may sink below.

| Rung | Opens | PRD §5 steps | Promoted by |
| --- | --- | --- | --- |
| **1 — A measured plan** | *Place* | 1–4 | A [[Project]] exists |
| **2 — A costed plan** | *Things*, *Money* | 6, 9, 10 | The first [[Zone]] exists |
| **3 — Organised work** | *Work* | 5, 7, 8, 11 | The first [[Cost item]] exists |
| **4 — Time** | *Work*, the schedule half | 12 | The first [[Work package]] exists |
| **5 — Execution** | *Record* | 13–15 | The first dated [[Task]] exists |
| **6 — Alternatives and change** | *Watch* | — | Open, below |

What each rung means concretely:

1. **A measured plan.** [[Plan]], calibration, [[Zone]]. A renovator who stops here has a
   scaled drawing with named extents on it and has received the product's whole thesis — the
   plan is the spatial index — without meeting a single number they did not ask for.
2. **A costed plan.** [[Asset]], [[Quantity]], [[Cost item]]. This is where geometry starts
   producing project information, which `PRODUCT.md` calls the claim a competitor cannot copy.
   It is deliberately rung 2 and not rung 4: the terrace times the waste factor times the
   unit price is the demonstration, and burying it behind trades and work packages would
   demonstrate it to nobody.
3. **Organised work.** [[Construction section]], [[Trade]], [[Work package]], [[Task]].
4. **Time.** The schedule, [[Milestone]], [[Dependency]].
5. **Execution.** Progress, actual costs, [[Document]], [[Photo]]. This is where PRD §53's
   cycle closes and *Update Plan* points back at rung 1.

**Rung 3 contradicts PRD §5's order, and this is the section it refines.** §5 puts *Define
Construction Sections* at step 5, before *Place Assets* at step 6. The ladder puts sections in
rung 3, after costs. The reason is the promotion rule below rather than taste: a construction
section is a grouping, and a renovator with one zone and no costs has nothing to group. §5 is
a list of everything in dependency order, not a claim about when a surface should appear, and
it draws no arrow back — so reading it as a reveal order is reading it for something it does
not say.

## The promotion rule

One rule, two halves, and each half refuses a specific tempting alternative:

> **A rung is promoted by the existence of the entity the previous rung produces — never by a
> count, never by a setting, and never by elapsed time. A promoted rung never demotes.**

- **Existence, not a count.** "Reveal the schedule at five work packages" needs somebody to
  defend five, and nobody can. Existence is a fact the model already holds, it is queryable by
  the same Bases machinery the alternative route uses
  ([[The alternative list route is a Bases view]]), and it is the same shape as
  [[Information Architecture]]'s *a fact with no owning surface yet is not homeless, it is
  unplanned*.
- **Not a setting.** A disclosure level in `data.json` would be a preference the renovator has
  to understand before they have seen the thing it hides — and every setting on that file is a
  trust boundary `settingsFrom` has to defend. The model already knows where the renovator is.
- **Never demotes.** A renovator who deletes their last work package does not want the
  schedule to vanish; a surface that disappears is worse than one that was always there,
  because it cannot be looked for. Once revealed, a rung stays and shows §94's empty state —
  which is the boundary test above, doing work: deletion moves a rung from *hidden* to
  *empty*, and hands ownership to [[Onboarding and example project]] permanently.

## The home surface, and IA's first open question answered

[[Information Architecture]]'s open question 1 asks whether the renovator's home surface is
plan-first or project-first, and says it needs PRD §93's onboarding sequence walked. **It does
not**, and that clause is the mis-derivation this note corrects: §93 describes getting to
rung 1 once, from a cold install. The home surface is a rung-1 question and is asked again
every session for months afterwards.

> **Project-first to create, plan-first thereafter.** The home surface is the plan from the
> moment a calibrated one exists. Before that, it is the project, because there is nothing
> else it could be.

PRD §1's thesis (*the plan is the index*) and PRD §5's first step (*Create Project*) were
never in conflict — one is about steady state and the other about a single transition. And
because [[The plan editor is a mode, not a second view]] settles that both are modes of one
view type, this resolves to a default mode rather than to a choice of surface: `renovation-project`
opens in `editor` once a calibrated [[Plan]] exists, and in `project` before that, with the mode
persisted through `getState()` so the renovator's own last choice outranks the default.

## What is open

Stated rather than invented.

1. **Rung 6's existence.** *Watch* ([[Risk]], [[Issue]], [[Constraint]]) and the V2 set
   ([[Scenario]], [[Plan revision]], as-built) are all V2, and
   [[Information Architecture]]'s open question 2 already doubts whether *Watch* survives as
   a group. A rung that opens a group that may not exist is not a rung yet, and it has no
   promotion fact for the same reason. That note records the same doubt from its own side.
2. **Whether rung 3's contradiction of PRD §5 should instead be an ADR.** It is a refinement
   of a received document recorded in a derived one, which `docs/README.md` permits — but it
   changes a dependency order the cost engine may read, and if a slice ends up depending on it
   the decision outgrows this note.
3. **Is the ladder per project or per vault?** A renovator with two projects — which
   [[Start a renovation project]] lists as an unsettled precondition — could be at rung 5 in
   one and rung 1 in the other. Per project is the obvious answer and nothing has decided it.
4. **Does rung 2 need a plan at all?** Someone pricing a renovation before drawing anything
   would want *Money* without *Place*, which the ladder currently forbids by making rung 1
   universal. Whether that renovator exists is a product question, and `PRODUCT.md` confirms
   there is no real user to ask.
5. **What the density fixture should contain.** [[User Experience]] names it as the next
   check; the numbers it names — forty zones, two hundred cost items — are invented to be
   plausible, and nothing has measured a real project because
   `PRODUCT.md`'s **Evidence on Hand** confirms none exists.

## References

- PRD §1 (the thesis — the plan as index), §3.5 (progressive complexity, the four steps),
  §5 (core user journey, fifteen steps), §6 and §8 (the entities each rung opens), §39 (the
  surface a rung is revealed on), §48–§50 (MVP, V1 and V2 scope — why rung 6 is doubted),
  §53 (core product loop, the nine-step cycle), §93 (installation and onboarding — cited as
  the boundary, not as content), §94 (empty states — the other side of that boundary),
  §95 (example project).
- SDD §3.7 (progressive complexity as MVP scope), §11 (workspace views), §61 (responsive
  strategy). `obsidian@1.13.0` `View.getState()` / `setState()` and the persisted `ViewState`
  interface, for the mode default above.
- `PRODUCT.md` — principle 3 (depth available, never required), the purpose statement, the
  staged scope, and **Evidence on Hand** for why every number in this note is invented.
- `docs/README.md` — the derived-versus-received rule, the Deliverable contract, and the
  one-owner-per-rule test the boundary section applies.
- [[User Experience]] — the Feature, its single actor, and what holds this note (review and
  `Test case` notes, plus a density fixture that does not exist).
- [[Information Architecture]] — the six groups and the naming register; its first open
  question is answered above, and what is now its open question 2 is why rung 6 is not settled.
- [[Sitemap]] — the surface inventory a rung's home is a row in.
- [[Design System]] — what a revealed control is made of.
- [[Onboarding and example project]] — PRD §93, §94, §95.
- [[The plan editor is a mode, not a second view]],
  [[The alternative list route is a Bases view]],
  [[Budget, Schedule and Procurement are Bases views first]] — the three decisions this note
  leans on.
