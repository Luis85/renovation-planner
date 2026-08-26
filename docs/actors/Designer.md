---
kind: human
name: Designer
standing: builder
sources:
  - requirements/Prototype a screen in the harness before it is built
  - deliverables/Design System
  - user-experience/concepts/README
type: actor
---

# Designer

The person deciding what a screen should look like before anybody commits to building it.
They judge; they do not necessarily write. On a one-person project this is the same human as
whoever writes the code, and the roles are still worth separating because the *questions* are:
"is this the right hierarchy" and "does this component mount" fail differently and are answered
at different moments.

**`standing: builder` is a new value in this folder**, and the two notes carrying it —
this one and [[Coding agent]] — are the register's first actors who *make* the product rather
than use it. Every other actor here is a renovator, a host, a store or a piece of the user's
own tooling; all eight are on the far side of the finished plugin. That is why the two section
headings below read slightly against their usual grain: for a builder, "the plugin" is the
codebase and the harness, not the thing running in somebody's vault.

## What it does to the plugin

- **Decides the visual language before it is code.** [[Design System]]'s open questions are
  theirs to close — which Obsidian variable means what on the canvas, and whether the plugin
  gets a spacing scale of its own. The second is explicitly deferred "until the three-column
  editor is measured in a real pane", which is a judgement nobody can make from a diagram.
- **Judges a prototype rather than a specification.** [[Prototype a screen in the harness before it is built]]
  exists because a design approved from a drawing is approved from something that was never
  going to ship. What they look at is a rendered screen on the real stylesheet.
- **Sets the pace of iteration.** A round is: look, say what is wrong, look again. Anything
  that makes a round slow — a mock that has to be rewritten to be seen, a component that only
  renders inside a whole view — costs rounds rather than minutes, and rounds are where the
  design actually happens.
- **Owns what is a mock and what is finished.** A template-only SFC is a statement that the
  markup is settled and the behaviour is not. Only they can say when that stops being true.

## What the plugin owes it

- **A rendered screen, not a drawing.** Every prototype and every component drawn against the
  one assembled stylesheet, so what is approved is what will exist.
- **Reproducibility.** One seeded fixture behind every entry, so the same screen looks the same
  next week and two components on it agree with each other.
- **A short round.** No registration step between saving a file and seeing it; no rewrite
  between approving a mock and having a component.
- **An honest failure.** A component that cannot mount says so and names itself, rather than
  leaving a gap the designer might read as a layout decision.
- **Nothing they draw reaching a renovator.** Prototypes are scaffolding, and the guarantee
  that none of it is ever in a built plugin is what lets them be careless in the right way.

## Sources

Derived from this repository rather than from the received documents, which is unusual in this
folder and is stated so nobody looks for a PRD section behind it — every other actor note here
cites PRD and SDD sections only, because every other actor is somebody the finished product
deals with.

[`requirements/Prototype a screen in the harness before it is built.md`](../requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md) ·
[`deliverables/Design System.md`](../deliverables/Design%20System.md) ·
[`user-experience/concepts/README.md`](../user-experience/concepts/README.md).

**Checked by** — the acceptance criteria of
[[Prototype a screen in the harness before it is built]], which is BUILT. `src/prototypes/` holds
template-only mocks, the harness index lists every prototype and component discovered from the
tree (open it with `npm run harness` and then `?index`), and one assembled stylesheet styles both
— `tests/harness/harness.test.ts` and `tests/harness/indexRealEntries.test.ts` hold that from
three directions, since no single instrument reaches every way a second sheet could arrive.

**What is NOT checked, because this actor's judgement is the part no test replaces.** Whether a
prototype LOOKS right — spacing, hierarchy, whether it reads against a real theme — is exactly
what this note exists to say a person must decide. The gates prove a prototype mounts cleanly and
pulls in no second stylesheet; they are silent on whether it is any good, and that silence is the
point rather than a gap.
