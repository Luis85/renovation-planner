---
type: Epic
order: 150
status: ""
started: ""
finished: ""
horizon: "V1"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Progress and site documentation

§27 states the purpose in five words: support execution, not only planning. The plan stops
matching the site in about week one — a wall is not where the drawing says, the tiles are
discontinued, the electrician finds knob-and-tube. A planner with nowhere to record what actually
happened becomes a document nobody opens by the second month, and then the budget in it is
fiction.

This epic is kept separate from [[Documents, photos and evidence]] on purpose. That epic owns
storing and linking an artefact; this one owns the *measurement* — planned against actual, and
what evidence closed a piece of work. A progress photo is that epic's mechanism used by this
epic's question.

Planned versus actual is also the pair that makes [[Reporting and project cockpit]] possible at
all: a forecast needs a real actual, not a re-estimate.

Derived from PRD §27 (Epic 16), with the financial lifecycle from §33 and derived data from §88.

## Definition of done

An item beneath this epic is done when:

- Planned and actual are two stored values, never one field overwritten (§27, §33). Overwriting
  the plan with reality is how a project loses the ability to learn anything.
- Progress above task level is derived from what the thing contains (§88) rather than typed at the
  top.
- A progress photo reuses [[Documents, photos and evidence]] and adds its date and subject; there
  is no second photo store.
- The site log is append-only and readable as ordinary Markdown, because it is the part somebody
  will want years later.
- Completion evidence is what closes a work package, and a package closed without it is visibly
  closed without it.
