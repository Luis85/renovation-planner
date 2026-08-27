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

`tests/helpers/editor.ts` gives `settleUntil` a budget of `SETTLE_ROUNDS = 50`. A round is one
evaluation of the predicate, then four microtasks and one `setTimeout(resolve, 0)`. What that
buys in wall-clock is unbounded and machine-dependent, and the helper's own header says so: it
exists because a background image decode is "real work whose duration depends on the machine",
after a case failed once in a full suite run "while a PDF test was rasterizing two million pixels
beside it" and passed on every isolated run.

**The predicate is the unbounded part, and it is awaited INSIDE the loop.** `if (await
condition())` runs before `settle()`, and the signature permits `Promise<boolean>` deliberately —
the header says the slice-8 rig waits on vault reads. Two callers really do:
`canvasPointerRouting.test.ts` and `editorFaults.test.ts` both pass an `async` predicate that
awaits `zonesRepo.listByPlan`. So a round is not a fixed quantity of anything: a slow read makes
it long, and a read that never settles stops the counter advancing at all.

So the budget is stated in the one unit that does not describe what is being waited for. The
work is a decode measured in milliseconds; the bound is a count of event-loop turns.

The consequence is not that the number is too small. It is that **the failure reports a unit
nobody can act on**: `Timed out after 50 settle rounds waiting for: …` says how many times it
asked and nothing about how long that took, so the same message covers a run that gave up in
milliseconds and one that spent seconds. Neither the message nor the budget can say whether the
machine was busy or the code is wrong — and no arrangement of the two budgets can, which the
alternatives below are explicit about.

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
- **Report the elapsed time in the failure text**, and optionally bound it with a wall-clock
  deadline, naming which limit expired.

  **A deadline checked BETWEEN rounds is not a bound**, which a review established after the first
  draft proposed one. The loop awaits the predicate before it does anything else, so a predicate
  that hangs — an awaited repository read that never settles — never returns control for a
  between-rounds check to run in. To bound the wall-clock the deadline has to race the predicate
  itself (`Promise.race` against a timer), and anything less should be described as bounding the
  *settling*, not the call.

  **A first draft of this note claimed more than that and was wrong.** It said the pair would
  separate a starved loop from a defect — "50 rounds in 4ms was starved of turns, 2 seconds was
  waiting on something that never happened". Both halves invert: 50 `setTimeout(0)` rounds
  completing in 4ms means the loop supplied turns *quickly*, and a two-second deadline is exactly
  what a busy machine produces. A review caught it. The pair bounds runtime and says which limit
  fired; it does not diagnose the cause, and the note may not promise that it does.

  What survives is smaller and still worth having. `Timed out after 50 settle rounds` reports a
  number with no relation to the thing being waited for, so a person reading a CI log cannot tell
  a 4ms failure from a 4-second one. Elapsed time is one line and makes the next failure
  legible **to a human**, which is a different claim from making it self-diagnosing.
- **Do nothing.** Defensible while it is one failure in months. Recorded here so the second one
  is read as a pattern rather than re-diagnosed from scratch.

## Why it matters

The harness suite is where this bites hardest, because `accessibility.test.ts` waits on a real
Vite transform rather than on a resolved promise — the slowest thing any `settleUntil` caller
waits for, and the one whose duration is least under this repository's control.

A gate that fails for a reason its message cannot name is a gate people learn to re-run. This
repository refuses that trade elsewhere: `npm audit` is outside `npm run check` precisely
because "a gate people learn to ignore protects nothing".
