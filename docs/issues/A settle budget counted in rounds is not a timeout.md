---
type: Issue
parent: "[[Prototype a screen in the harness before it is built]]"
order: 90
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

# A settle budget counted in rounds is not a timeout

`settleUntil` bounds how many times it asks, not how long it waits, and the two come apart on
a loaded machine — which is where the one CI failure this helper has produced came from.

## The question

`tests/helpers/editor.ts` gives `settleUntil` a budget of `SETTLE_ROUNDS = 50`. One round is
four microtasks and one `setTimeout(resolve, 0)`. What that buys in wall-clock is unbounded and
machine-dependent, and the helper's own header says so: it exists because a background image
decode is "real work whose duration depends on the machine", after a case failed once in a full
suite run "while a PDF test was rasterizing two million pixels beside it" and passed on every
isolated run.

So the budget is stated in the one unit that does not describe what is being waited for. The
work is a decode measured in milliseconds; the bound is a count of event-loop turns.

The consequence is not that the number is too small. It is that **a failure cannot distinguish
"the code under test is wrong" from "this machine was busy"** — the message reads
`Timed out after 50 settle rounds waiting for: …` either way, which is exactly the shape the
header calls "the signature of a fixed-tick wait rather than of a defect in the code under
test".

## What is true today

- `SETTLE_ROUNDS` is one number for every caller, deliberately: the header records that the
  slice-8 rig grew a second copy of the loop with its own budget and its own failure text, and
  that "a flake fixed by raising the budget here has to reach every caller".
- **Measured, once.** `verify (ubuntu-latest, 26)` timed out on
  `tests/harness/accessibility.test.ts` at commit `33fa9e2`, at a `settleUntil` waiting for an
  entry arriving through a cold Vite transform. The other three legs were green on that commit,
  and the same leg has passed on every commit since — through the whole of PR #17, 49 review
  rounds and six CI runs on 27 August alone.
- Raising the budget was **not** done, and the reason is worth keeping: it did not reproduce, so
  a larger number would have been a guess dressed as a fix.

## The alternatives

- **Raise `SETTLE_ROUNDS`.** Rejected above: nothing measured says what the right number is, and
  the next slower machine moves it again.
- **Make the loop unbounded.** Refused in the helper's own header, correctly — "an unbounded loop
  turns a real regression into a hung suite".
- **A wall-clock deadline beside the round budget**, whichever comes first, with the failure text
  naming which one expired. This is the proposal, and its virtue is diagnostic rather than
  numeric: a run that exhausts 50 rounds in 4ms was starved of turns, and one that exhausts 2
  seconds was waiting on something that never happened. Those are different defects and the
  message would say which.
- **Do nothing.** Defensible while it is one failure in months. Recorded here so the second one
  is read as a pattern rather than re-diagnosed from scratch.

## Why it matters

The harness suite is where this bites hardest, because `accessibility.test.ts` waits on a real
Vite transform rather than on a resolved promise — the slowest thing any `settleUntil` caller
waits for, and the one whose duration is least under this repository's control.

A gate that fails for a reason its message cannot name is a gate people learn to re-run. This
repository refuses that trade elsewhere: `npm audit` is outside `npm run check` precisely
because "a gate people learn to ignore protects nothing".
