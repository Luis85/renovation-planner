---
kind: system
name: Coding agent
standing: builder
sources:
  - requirements/Prototype a screen in the harness before it is built
  - CLAUDE.md
  - setup/quality-harness
type: actor
---

# Coding agent

An LLM-driven agent writing code in this repository — the thing that turns a designer's
description into a mock, and much else besides. A **system** actor rather than a human one, and
`standing: builder` for the same reason as [[Designer]]: it makes the product rather than using
it. It is listed because it has real constraints the codebase has to respect, and because a
constraint nobody wrote down gets designed against by accident.

**The defining constraint is that it cannot see.** It has a filesystem, a shell and the
repository; it has no browser and no eyes. Everything a human developer verifies by glancing at
a screen, this actor verifies by running something that writes a file it can then read — or
does not verify at all. `CLAUDE.md` records four defects that only a rendered screenshot found,
every one of which passed the whole of `npm run check`; those are exactly the defects this
actor is blind to by default.

It is also **stateless between sessions**. What it knows is what the repository says, which is
why this project writes its reasons down in the code and its rules into gates rather than into
anybody's memory.

## What it does to the plugin

- **Writes the mocks a designer iterates on.** A template-only SFC needs no runtime to author,
  so this is work the agent can do well: it is markup, and markup is text.
- **Reads the gates as the specification.** `npm run check` is what tells it whether it is done.
  A rule that lives only in prose is a rule it will break politely and confidently, which is why
  `eslint.config.mjs` carries the architecture rather than a style guide carrying it.
- **Trusts a fake exactly as far as the fake is honest.** Every "kind fake" defect recorded in
  `CLAUDE.md` — the synchronous `MetadataCache`, the `FakeVault` that created files in absent
  folders — is a case where an agent's green suite meant nothing, and it had no independent way
  to know.
- **Multiplies whatever the loop costs.** A verification step that takes a human ten seconds of
  looking either becomes a command this actor can run, or becomes a step that silently stops
  happening.

## What the plugin owes it

- **An eye it can use.** `npm run harness-shot <entry>` writing a PNG per scheme is what turns
  "the agent drew something" into "the agent looked at what it drew". Without it, every layout
  judgement is deferred to a human and every round costs one.
- **Addressability.** A screen reachable only by clicking a row in an index cannot be captured,
  scripted or diffed. Every index entry owes a URL for this reason, and the URL is the machine's
  route while the index is the human's.
- **Discovery over registration.** A step that must be remembered is a step this actor will
  forget across sessions — `import.meta.glob` over a tree cannot go stale, and a hand-kept
  manifest can.
- **Fakes that refuse what the real thing refuses.** This is owed to the test suite generally and
  is listed here because this actor is the one with no other way to find out.
- **Gates that fail loudly and locally.** `scripts/lint-edited.mjs` exists because a finding
  several turns later arrives after the reasoning that produced it is gone. It reports as a tool
  error rather than as user-visible stderr for exactly that reason.

## Sources

Derived from this repository rather than from the received documents — the PRD and SDD describe
a product for renovators and say nothing about who builds it.

[`requirements/Prototype a screen in the harness before it is built.md`](../requirements/Prototype%20a%20screen%20in%20the%20harness%20before%20it%20is%20built.md) ·
[`CLAUDE.md`](../../CLAUDE.md) ·
[`setup/quality-harness.md`](../setup/quality-harness.md).

**Checked by** — not yet, and partly uncheckable: "the agent can verify its own output" is a
claim about a workflow rather than about code. The closest thing to a check is
[[Prototype a screen in the harness before it is built]]'s criterion 4 — every index entry
reachable by `harness-shot` as well as by the index — which is unbuilt.
