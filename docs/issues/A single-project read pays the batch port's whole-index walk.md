---
type: Issue
parent: "[[The project surface]]"
order: 30
status: New
started: ""
finished: ""
horizon: Next
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

# A single-project read pays the batch port's whole-index walk

`ProjectListFacts` exists so that one pass over the Project Index answers both commissioned
facts for every project at once. The project detail state asks it for one id, and still pays the
whole pass.

## The question

The facts port's own design argument, recorded when it was commissioned, is that the cost is not
real at the scale it is paid: *one* walk of the index answers `planCount` and `lastWorked` for
every project, so the read is proportional to the notes in the vault rather than to notes ×
projects. That reasoning is about the **list**. What does the detail state pay?

## What is true today

`src/presentation/read-models/renovationProjectQueries.ts` calls
`facts.factsFor([found.value.entity.id])` inside `getProject` — a batch call with one member.
`IndexProjectListFacts.factsFor` iterates `index.entries()` in full regardless of how many ids
it was asked about, because that is the shape the list needs.

The detail state hydrates on mount and on four subscriptions (plans, catalogue, prices, index),
so a project with an open detail pane walks the whole vault index once per hydrate for two
fields.

Asking rather than fabricating is the right call and the code says so — the alternative is the
constant-supplying shape recorded in
[[The Plan Editor's project read fabricates three fields nothing stops it rendering]]. This note
is about the cost, not the correctness.

## Why it matters

Not at today's vault sizes, and the note says so plainly rather than implying urgency. It
matters because the port's justification is a statement about *amortisation* — one walk serving
many rows — and this call site takes the walk without the amortisation. That inverts the reason
the port was accepted, in the one caller nobody measured when accepting it.

The cost scales with the vault, not with the project, so it grows in exactly the direction a
long-running renovation vault grows.

## What closes it

A by-id door on the port — `factsFor` keeps the batch contract for the list, and a single-id
member answers without the full pass. That is a port change, and it is the kind of change that
should be taken when something else is already open in that file rather than on its own.

Whoever takes it should check whether the detail state needs both fields at all: if it renders
neither `planCount` nor `lastWorked` today, the cheaper close is for `getProject` to stop asking
— which would then need the guard the sibling note above describes, so that a later author
adding one of those fields to the detail header gets a compile error rather than a zero.
