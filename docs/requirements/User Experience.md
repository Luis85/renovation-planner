---
type: Feature
parent: "[[Cross-cutting concerns]]"
order: 20
status: Active
started: 2026-08-25
finished: ""
horizon: MVP
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# User Experience

Five documents draw this product as a sequence, and **no two of them draw the same one**.
PRD §3.5 draws four steps and calls them the simplest workflow. PRD §93 draws six and calls
them onboarding. SDD §3.7 draws six different ones and calls them the MVP. PRD §53 draws
nine and is the only one of the five called a *loop*. PRD §5 draws fifteen, in a straight
line, with no arrow returning to the top — so the document that names the core user journey
is the one document that does not describe a journey anybody repeats.

Four different lengths is not the defect. The defect is that all five are drawings of value
*arriving*, and not one of them says what happens to the steps that have not arrived yet. A
renovator on step four of fifteen is looking at a surface built for step fifteen, and
nothing in either received document, in `docs/deliverables/` or in `src/` says whether the
other eleven are hidden, greyed, empty or simply there.

## The job

A renovator four months into their own renovation, whose model has grown from one zone to
forty and from nothing to two hundred cost items, gets a surface that shows all of it every
session — and pays for it in attention rather than in staleness.

That is the situation this Feature is written for, and *tolerates* is the honest verb.
Nothing is maintained by hand, so nothing drifts and nothing is ever visibly wrong; the
renovator re-finds the four rows that matter, every time, and the cost scales with the model.
A recurring invisible cost is the kind nobody schedules a fix for, and the kind nobody
notices getting worse between month two and month four.

The actor is [[Private renovator]] and it is deliberately only that one. The sibling at
order 10 names two actors and explains why claiming one would be dishonest; this one would
be dishonest the other way round. A maintainer needs the sequence written down, but they are
not the person harmed when it is not.

## Why this is cross-cutting rather than one epic's work

The epic's admission test has two halves, and this Feature is the second one — not a concern
appearing in all twenty product epics, but **the thing they are all measured by**.

`PRODUCT.md` principle 3 is the measure: *depth is available, never required, and never a
precondition for value*, with the first useful result reachable in four steps. Read once,
that is a promise about a new install. Read against the situation above, it is a promise
about **every** session, and the register keeps it on day one and nowhere else. The
four-step path in PRD §3.5 still exists at month four; it is now buried inside the
fifteen-step one, alongside thirty-four entities in six groups. The principle holds, then
silently stops holding, and no surface is responsible for the moment it stops.

That is what makes it a Feature here rather than one screen's polish. A concern that expires
cannot be owned by whichever epic reaches it first: the epic that reaches it first is the one
where the model is still small, which is precisely the state in which the problem is
invisible.

## What it does not own

- **[[User Interface]]** owns the static system — which surfaces exist, what they are
  called, what a control is made of. A screenshot settles a question there; only a sequence
  settles one here. Where the two meet, the division is stated in both: this Feature says
  *when* a surface appears, never *what* it looks like when it does.
- **[[Onboarding and example project]]** owns PRD §93, §94 and §95 — first run, empty
  states, and the demo project. That note claims all three by name and
  [[Start a renovation project]] already defers to it twice, so this Feature owns none of
  them. The boundary is sharp rather than diplomatic, and [[Disclosure ladder]] states it as
  a test: **hidden means absent, empty means present-but-unfilled.** If a renovator could
  navigate to the surface, what they find there is §94's and not this Feature's.
- **[[Accessibility]]** owns §44's list. Progressive disclosure is not an accessibility
  mechanism and must not be used as one: hiding a rung reduces what is on screen for
  everybody, and it does nothing about keyboard reach, focus visibility or the alternative
  route, all of which are owed at every rung.
- **[[Multilanguage]]** owns every string, including the ones a revealed rung brings with it.
- **[[Shared UI vocabulary]]** owns which surface a given failure gets. A rung that cannot be
  reached is not a failure and gets no surface; a rung whose reveal fails is that PBI's.
- **[[Architecture and Software Design]]** owns the layers. A rung is a presentation concern
  and the model beneath it does not change shape when one is hidden — `core/`, `domain/` and
  `application/` cannot know a rung exists, and `eslint.config.mjs` is what refuses the
  import that would tell them.

## The deliverable, and why there is exactly one

| Deliverable | Answers |
| --- | --- |
| [[Disclosure ladder]] | Which of the fifteen steps are visible at which model density, and what promotes a rung? |

One, because one artifact is what this Feature actually owes. The three deliverables under
[[User Interface]] hold naming, routes and controls, and **not one of the three can state an
order** — an information architecture says where a fact lives, a sitemap says how to reach
it, a design system says what it is made of, and all three are true simultaneously and out
of time. A sequence has no home in this register, and that absence is the whole reason this
note exists as a Feature rather than as a paragraph inside its sibling.

It carries the Deliverable contract: it **is** the artifact, it is derived, it cites the
sections it was read from, and a refinement contradicting a source names the section it
refines and lands there rather than in `docs/prds/` or `docs/sdds/`.

## What holds this, and what does not

Written to the check rather than ahead of it. This section is shorter than its sibling's, and
the reason is not modesty.

**Checked today: nothing.** No instrument in `npm run check` reads a sequence, and none could
without being told what the sequence is — which is the deliverable, not a test.

**And the reason it is nothing is sharper than that, which is the sentence worth keeping.**
The suite and the browser harness both mount an **empty** view: `mountHarness` draws the
scaffold's one surface with no project, no plan and no zones behind it. So the single
situation this Feature is about — a model dense enough that showing all of it is the problem
— cannot be *looked at* in this repository, let alone asserted. Every existing check is blind
to it by construction rather than by omission.

**Named as the next check, and it does not exist.** A seeded density fixture — a project with
forty zones and two hundred cost items — that `npm run harness` can mount and
`npm run harness-shot` can photograph at two densities. It would draw and assert nothing, it
would have no baseline to diff, and it would stay deliberately outside `npm run check` and
outside CI, which is exactly what `harness-shot` already is: the tool built for looking, and
how the view collapsing to a sliver of its pane was found by something no assertion could
see. What the fixture still would **not** check is whether the ladder is *right* — only
whether the density it describes is real.

**Held by review, and by `Test case` notes carrying a cadence.** A rung revealing itself, a
sequence walked end to end, and whether a renovator can still reach step four at month four
are live-vault checks or they are unverified. `npm run test-build` is where they happen.

**Not claimed.** The absent fifth gate, `npm run docs`, could one day audit that every
[[Sitemap]] surface carries a rung. [[User Interface]] already rests two of its deliverables
on that gate's absence, and this note does not make it load-bearing for a third.

## Outcome

A renovator four months in still reaches the four steps that matter in four steps, because
what the model has grown into is revealed on a schedule somebody wrote down rather than all
at once by default.
