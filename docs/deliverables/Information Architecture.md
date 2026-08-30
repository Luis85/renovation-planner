---
type: Deliverable
parent: "[[User Interface]]"
order: 10
status: Active
started: ""
finished: ""
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

# Information Architecture

This note is the artifact, not a promise of one: it is **derived**, it cites the sections it
was read from, and it is expected to change as the design is refined. A refinement that
contradicts a source names the section it refines and lands here, never in `docs/product/prds/` or
`docs/development/sdds/`.

It answers two questions and deliberately not a third. **Where does a given fact belong,
and what is it called?** Which surfaces exist and how someone moves between them is
[[Sitemap]]'s; what a control is made of is [[Design System]]'s.

## What this note may not restate

`docs/entities/` already holds thirty-four notes saying what each business object *is*,
where it is persisted, what it relates to and which rules hold for it.
`docs/product/business-rules/` holds twenty-seven saying what must be true of them. Neither answers
where a fact is *seen*, and this note answers only that.

The test is the one `docs/README.md` applies to a business rule: **could the entity note
state it without lying by omission?** [[Zone]] can say it owns geometry and exposes a
derived area without mentioning a screen. It cannot say which panel that area appears in,
or that the number must not appear twice with two roundings. The first belongs there; the
second belongs here.

## The naming register

Received documents disagree about names, both are verbatim, so the resolution has to live
somewhere. It lives here, with the reason, because a name chosen twice is the defect this
whole Feature exists to prevent.

| On screen | Not | Why |
| --- | --- | --- |
| **Assets** (panel) | `Library` (PRD §39) | The entity is [[Asset]]. "Asset library" is the catalogue *concept* of PRD Epic 6; the panel showing it takes the object's own noun, so a user reading the panel and the note reads one word. |
| **Plan canvas** (region) | `Plan` (PRD §39) | [[Plan]] is an entity. A region named with a bare entity noun makes the word mean two things in one sentence — "open the plan" then becomes ambiguous between a note and a viewport. SDD §60 already wrote the longer form. |
| **Zone** | `Area`, "Space" | [[Zone]] is the noun a user ever sees for a planned extent. `Area` is a branch of [[Spatial object]] in PRD §34 and stays internal — it collides with *area* the measurement in m², which is the one word a renovator uses most. [[Space]] is a fact about the building, not a thing you draw, and its own note explains why merging them would make "this room is untouched" unsayable. |
| *(never shown)* | `Spatial object` | A supertype persisted in a sidecar. A user meets its branches — a zone, a measurement, a marker — never the abstraction. |
| **Risks** (a view) | `Risk` (SDD §13) | A view lists many, so its label is plural; the entity note stays singular, per `docs/README.md`'s convention that keeps `entities/` from colliding with `requirements/`. |

**The rule the table is an instance of.** A user-facing label is the entity's own noun
wherever one exists, a region or view gets a compound (`Plan canvas`, `Zone list`) rather
than borrowing that noun bare, and an internal supertype never surfaces. A new surface adds
a row here before it adds a string to `locales/en.ts`.

## The grouping

Thirty-four entities is not a menu. The grouping below is the one a renovator can hold, and
each group is the answer to a question they actually ask; the [[Sitemap]] assigns surfaces to
these groups rather than to the entity list.

| Group | The question | Entities |
| --- | --- | --- |
| **Place** | Where? | [[Site]], [[Building]], [[Floor]], [[Space]], [[Outdoor area]], [[Plan]], [[Zone]], [[Spatial object]], [[Layer]] |
| **Work** | What has to be done, in what order? | [[Construction section]], [[Trade]], [[Work package]], [[Task]], [[Milestone]], [[Dependency]] |
| **Things** | What goes in, how much? | [[Asset]], [[Requirement]], [[Quantity]] |
| **Money** | What does it cost, and where is it now? | [[Cost item]], [[Money]], [[Supplier]], [[Quote]], [[Procurement item]], [[Order]], [[Invoice]] |
| **Record** | What was decided, and what proves it? | [[Document]], [[Photo]], [[Decision]], [[Scenario]], [[Plan revision]] |
| **Watch** | What could go wrong? | [[Risk]], [[Issue]], [[Constraint]] |

[[Project]] is in no group: it is the root the *work* above resolves to, which is a business rule
(*work belongs to one project, catalogues belong to the vault*) before it is an architecture.

**Three of the entities in those groups resolve to no project at all** — [[Asset]] under *Things*,
[[Supplier]] under *Money* and [[Trade]] under *Work* are shared catalogues living in the vault's
library (§59, amended 2026-08-26), referenced by every project and owned by none. They stay in the
groups above, because a renovator asking *what goes in, how much?* is asking about assets whoever
owns them; grouping answers a user's question and ownership answers a repository's, and this note
is about the first. But the sentence above used to say *every one* of them resolves to Project, and
that is the kind of claim a surface gets designed against — a picker scoped to one project would
have hidden the shared library it was supposed to show.

Two things this grouping is not. It is **not** the folder layout — folders are filing and
the hierarchy lives in frontmatter, the same rule `docs/README.md` states for this register.
And it is **not** the six MVP/V1/V2 stages: *Place* and *Things* are mostly MVP while *Money*
spans all three, so a group is a place to look rather than a release.

## Where a fact lives

One rule, and it is deliberately the same shape as the layer rule in `CLAUDE.md` — *a type
belongs with the code that produces it*:

> **A fact is shown on the surface that owns the entity producing it, and referenced
> everywhere else.**

What "referenced" means is a link to that surface, not a second copy of the number. The
consequences worth writing down, because each is a way the rule gets broken while looking
correct:

- **A derived value appears where it is derived**, with its inputs reachable in one move. A
  zone's area is the plan canvas's and the zone's own note; a cost derived from that area is
  the cost surface's. Two surfaces showing one derived number is two roundings the day one of
  them is edited — *money is rounded once, where the pipeline finalizes it*, and a second
  surface that rounds again has quietly disagreed with the engine.
- **A rollup is shown on the axis it rolls up** (section, trade, project) and never
  re-summed by a screen, because *a cost rollup is derived along its axis, never stored*.
- **An override is shown beside what it replaced**, never in place of it — the rule already
  says the override is stored that way, and a surface that shows only the final number has
  discarded the half that makes it arguable.
- **An uncalibrated measurement is not shown as a measurement.** *An uncalibrated plan never
  presents a measurement as true* is a business rule with a UI consequence, and the
  consequence is this note's: the surface owes a state, not a hidden value.
- **A fact with no owning surface yet is not homeless, it is unplanned.** It goes to the
  entity's note via Bases until a surface claims it — which is what makes the alternative-list
  requirement cheap rather than a second product.

## Answered since, and by whom

**Plan-first or project-first — answered.** This note's first open question asked whether a
renovator's home surface is the project or the plan, since PRD §5's journey starts at *Create
Project* while PRD §1's thesis says the plan *is* the index. [[Disclosure ladder]] settles it:
**project-first to create, plan-first thereafter** — the home surface is the plan from the
moment a calibrated one exists, and the project only while nothing else could be.

The clause that has to be struck rather than quietly dropped is this note's own reason for
deferring: it said the question "needs PRD §93's onboarding sequence walked, which is
[[User Experience]]'s." **Both halves were wrong.** §93 belongs to
[[Onboarding and example project]], which claims it by name; and the question does not need §93
at all — §93 describes reaching the first rung once, from a cold install, while the home
surface is asked again every session for months afterwards. The deferral pointed at the wrong
note *for* the wrong reason, and the answer turned out to be a rung question the whole time.

Because [[The plan editor is a mode, not a second view]] makes both surfaces modes of one view
type, this resolves to a default mode rather than a choice of surface — so it changes the top
of every route by changing no route at all.

## Open, and not decided here

Stated rather than answered, because inventing an answer is what the interview refused:

1. **Are [[Space]] and [[Zone]] one thing to the user?** Their entity notes are certain they
   are two objects, and that is settled. Whether a renovator who has drawn one zone per room
   ever needs to see both nouns is not, and answering it wrongly either doubles the vocabulary
   or makes "this room is untouched" unsayable.
2. **Does *Watch* survive as a group?** Its three entities are all V2. A group with nothing in
   it until V2 may be a heading, and this note should not defend one. [[Disclosure ladder]]'s
   rung 6 is the group's only reader and is unsettled for exactly this reason, so the two
   questions are one question with two homes — and it is recorded in both rather than answered
   in either.

## References

- PRD §6 (structural hierarchy), §7 and §34 (the spatial object model and its four branches),
  §8 (core entities), §36 (vault data model), §39 (the panel names this note resolves), §40
  (spatial objects reachable without the canvas), §41 (Bases views), §58 (canonical
  relationship model), §70–§75 (units, precision, currency, quantity semantics — why a derived
  number has one home).
- SDD §11 (workspace views), §13 (Bases views), §38 (Markdown entity model), §59 (inspector),
  §60 (the panel names, in their other spelling), §80 (naming conventions), §84 (theme
  integration).
- `docs/entities/` — all thirty-four, and specifically [[Zone]], [[Space]] and
  [[Spatial object]] for the distinction this note may not restate.
- `docs/product/business-rules/` — *work belongs to one project, catalogues belong to the vault*, *a derived value is
  recomputed on read, not persisted*, *a cost rollup is derived along its axis, never stored*,
  *money is rounded once, where the pipeline finalizes it*, *a manual override is stored as an
  override, beside what it replaced*, *an uncalibrated plan never presents a measurement as
  true*, *internal precision and display precision are separate*.
- `docs/README.md` — the derived-versus-received rule this note is written under, the
  singular/plural convention, and the test for whether a rule belongs to an entity.
- [[User Interface]] — the Feature, its two actors, and what holds this note (review, until
  `npm run docs` exists).
