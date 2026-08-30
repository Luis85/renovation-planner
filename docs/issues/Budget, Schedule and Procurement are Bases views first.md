---
type: Issue
parent: "[[User Interface]]"
order: 50
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

# Budget, Schedule and Procurement are Bases views first

A decision taken, recorded with what it rejected. It was [[Sitemap]]'s open question 1, which
that note called "the single largest unknown in this note".

## The question

Budget, Schedule and Procurement are each named **twice** in the received documents and the
relationship is never stated: SDD §11 lists them in its *future* workspace views, and SDD §13
lists them among its Bases views. PRD §41 lists them too. Read one way there are six workspace
views; read the other there are three, and the other three are tables. [[Sitemap]]'s inventory
carries both readings as duplicate rows because neither could be dropped.

## The decision

> **Bases views in V1. A workspace view for any of the three arrives only with a named trigger
> — something the product needs that Bases cannot express — and SDD §11's future list is read
> as a list of candidates rather than a plan.**

Triggers, named now so the rule is falsifiable rather than a way of saying no:

| Candidate | Trigger | Present today |
| --- | --- | --- |
| Schedule | A timeline, which is not a table. PRD §21 lists `timeline`, `trade timeline` and `construction section timeline`; SDD §53 says *"a future Gantt renderer remains an adapter"* | **yes** |
| Budget | None. Cost items with rollups are a table, and rollups are derived along their axis | no |
| Procurement | None | no |

Schedule's trigger being already visible is what makes this a rule rather than a deferral: it
predicts that Schedule gets a workspace view and the other two do not, and it can be wrong.

## Why

- **It is the shape this repository already uses for absence.** `CLAUDE.md`'s *Deliberately
  absent* section gives every omission a trigger rather than a schedule, and the reason is that
  a trigger can be checked against reality while a plan cannot. Six workspace views with no use
  case behind three of them is the same defect as a dependency nothing imports.
- **It follows from the decision taken beside it.** Since
  [[The alternative list route is a Bases view]] makes Bases the canvas-free route, these three
  need Bases views regardless — for mobile and for §44. So the Bases half is not a choice; only
  the workspace half was ever in question.
- **`PRODUCT.md` principle 4 is host-deferential**, and a table over vault data is the case
  where the host's own answer is complete.
- **It is honest about staging.** All three are V1. Deciding now that each gets two surfaces
  commits V1 to three views nothing in `docs/requirements/` has a use case for, which
  [[Cross-cutting concerns]] would have to justify and cannot.

## Alternatives rejected

**Both, with the relationship stated as data-versus-composition** — the Bases view is the
table over entities, the workspace view is a composed surface doing rollups, variance and
charts that Bases cannot assemble. This was the most attractive alternative and reads well: it
honours SDD naming both, and the distinction is real. Rejected because it commits to three
workspace views before one has a use case, and because the distinction is *derivable* — if a
composition is needed, that need is exactly the trigger this decision asks for. Taking the
same answer via a trigger costs nothing and refuses the two surfaces nobody has asked for.

**Workspace views only, reading SDD §13's rows as the same surfaces named twice.** Rejected on
a direct collision: Budget has to be readable on Obsidian mobile, and the canvas-free route is
Bases. Dropping the Bases rows would leave the mobile scope with no surface at all.

**Leaving it open and recording only the alternatives.** Legitimate where evidence is
genuinely insufficient, and rejected because it is not: the evidence is sufficient once the
alternative-route decision is taken, design slice 05 is blocked on the inventory, and
[[User Interface]]'s own Outcome claims every surface has a name and a place decided *before*
it is drawn. An inventory ambiguous by three rows makes that Outcome false.

## Consequences

- [[Sitemap]]'s inventory loses three duplicate rows. Budget, Schedule and Procurement appear
  once each, as Bases views, and SDD §11's future list is annotated as candidates with
  triggers.
- V1 builds three Bases views and no new workspace views. Schedule's timeline is expected and
  is not yet scheduled.
- Dashboard, the fourth name in SDD §11's future list, is untouched by this decision: it has no
  Bases counterpart, so it was never named twice. It stays a future workspace view.
- A future author wanting a workspace view has to name the trigger here first, which is a
  one-line edit and the point of the mechanism.

## Revisit when

Any of the three needs something Bases cannot express. Schedule's timeline is expected to be
the first, and when it lands, this note gains a row rather than being replaced.

## References

- PRD §18 (Epic 7 — Cost & Budget Engine), §21 (Epic 10 — Schedule), §24 (Epic 13 —
  Procurement & Shopping), §41 (Bases integration), §48–§49 (MVP and V1 scope).
- SDD §11 (workspace views — the future list this note reinterprets), §13 (Bases integration),
  §53 (scheduling architecture).
- `PRODUCT.md` — principle 4, and the staged scope placing all three in V1.
- `CLAUDE.md` — *Deliberately absent*, the trigger-not-a-plan shape this decision borrows.
- [[Sitemap]] — its open question 1 and its inventory.
  [[The alternative list route is a Bases view]] — the decision this one rests on.
  [[Information Architecture]] — the naming register, including why a view label is plural.
