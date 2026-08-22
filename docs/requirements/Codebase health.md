---
type: Epic
order: 210
status: ""
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Codebase health

The twenty epics in the PRD say what the plugin does for whoever installs it. Nothing in
them says what keeps it changeable long enough to deliver all twenty, and that is not a
detail of any one of them: a rule about a quantity, a cost or a zone can only be asked of
a function rather than of a screen because the layering holds, and the layering holds
because `eslint.config.mjs` refuses a violation instead of a reviewer noticing one.

The evidence this rests on is the harness that is already here and the record of what it
was built against. `npm run check` runs four steps — build, lint, coverage-thresholded
tests, fallow — and CI runs that same command, verbatim, on Ubuntu and Windows. Every rule
those steps enforce was broken in the project this harness came from, several of them
inside the change that was fixing the previous instance: a fake DOM helper kinder than
Obsidian shipped a dead drag target while every test and the browser harness drew it
happily; six of ten findings on one pull request were comments precisely stating the rule
the code beside them broke; two flat-config blocks matching one file silently dropped
every shared selector. Those are measurements, not opinions, and they are the argument for
this epic existing rather than the harness being treated as finished infrastructure.

It is not finished. `src/` measures 100% of all four coverage metrics today at a very
small denominator, so the floors below it are worth a few percentage points and will be
worth less every increment. `npm run docs` is not adopted, and nothing in `npm run check`
reads `docs/` at all — the honest statement is that every rule in this folder rests on
whoever writes the note. `npm run perf` has no render cost to argue about yet and the
harness has no icon renderer, both waiting on a trigger rather than on a decision. Each of
those is work, and this is where it is ranked against the product rather than done in the
gaps between features.

The scope is the harness and the rules it holds: the gates, the coverage ratchet, the
architecture lint, the browser harness and the live-vault checks, the release pipeline. It
is not a licence to refactor. A change here answers a measurement.

## Definition of done

An item beneath this epic is done when:

- It opened with a measurement rather than an opinion. "This module is 480 lines and three
  callers duplicate its guard" is evidence; "this feels messy" is not.
- The instrument that produced the measurement can see the whole set, and was tested
  first. A grep for `foo(` misses `foo<T>(`, and both have already been used as the
  evidence for a decision that was therefore wrong.
- Any invariant it asserts in prose has a test that fails without it, and the test was
  watched failing: revert the fix, run it, see red, restore. A confident paragraph is
  evidence of intent and of nothing else.
- Whatever it adds runs identically on Ubuntu and Windows, because CI runs one command on
  both and the two cannot be allowed to drift.
- A new gate either joins `npm run check` or is recorded as deliberately absent with the
  trigger that would add it. `npm audit` is the precedent for the second: an advisory with
  no patched version is a red nobody can clear, and a gate people learn to ignore protects
  nothing.
- Coverage floors only rise, and they rise to what a finished increment measures — never to
  what the current partial one happens to reach.
- The guarantee is written to the check rather than ahead of it. Where a step cannot reach
  the whole claim, the sentence is narrowed instead of the wider one being left standing.
