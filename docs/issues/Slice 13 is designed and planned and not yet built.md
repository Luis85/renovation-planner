---
type: Issue
parent: "[[Shared UI vocabulary]]"
order: 10
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

# Slice 13 is designed and planned, and not yet built

Design slice 13 was brainstormed, specified and planned on 2026-08-28 as parallel work
alongside slice 16, and then deliberately parked before implementation. This note is what
lets it be picked up cold.

## The question

Not whether to build it — that is settled, and slice 17 cannot start without it. The question
is what will have gone stale by the time somebody does, because the plan addresses code by
line number in four places and assumes a tree that slice 16 is concurrently changing.

## What is true today

Two documents are committed on `slice/13-notifications-and-save-state-surfaces` (PR #21), and
no code has been written:

- [`docs/superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md`](../superpowers/specs/2026-08-28-slice-13-notifications-and-save-state-design.md)
- [`docs/superpowers/plans/2026-08-28-slice-13-notifications-and-save-state.md`](../superpowers/plans/2026-08-28-slice-13-notifications-and-save-state.md) — fifteen tasks, each with its own test cycle and commit.

**The slice document itself has not been corrected yet.** That is task 15 of the plan, so
until the work runs, `docs/tasks/13-notifications-and-save-state-surfaces.md` still carries
three claims measured false on 2026-08-28:

1. It calls the notification app the plugin's first thing needing disposal. `onunload` has
   existed since Konva's global earned it, and it is a `disposers` list that catches each
   entry independently — so this slice pushes one entry rather than writing teardown.
2. Its "carried forward" note says `reportFault` prints a raw `Error.message`. Slice 11
   replaced it with `notifyFault`, which maps, logs and prints the mapped copy.
3. It specifies a plugin-global Vue app replacing Obsidian's `Notice`, written before
   `presentation/notices/notify.ts` existed. Measured against the pinned typings, `Notice`
   answers three of its four stated objections — `hide()`, `duration: 0`,
   `messageEl`/`containerEl`, `setMessage` — so the spec builds on it instead, and the
   departure from SDD §12 buys nothing.

Read the spec before the slice document, not after.

## What will go stale while this sits

Each of these is a place the plan points at something that moves, and each is cheap to
re-measure but silent if it is not:

- **`eslint.config.mjs:527`** — `NOTICE_DOOR`. Task 7 widens it. Address it by the constant
  name, never by the line.
- **`src/presentation/editor/runtime.ts:461-478`** — where task 14 nests
  `withSaveStateTracking` between `withEditorStateRefresh` and `wrapDispatcher`. The nesting
  is the requirement; the line numbers are not.
- **The coverage floors** (99 / 99 / 99 / 98, branches with roughly two branches of
  headroom). Task 15 ratchets only to what a finished increment measures. Never copy a figure
  out of the plan — run `npm run test:coverage`.
- **`styles/editor.css` against the assembler's 400-line cap.** Task 13 appends two rules to
  it and says to check the count first, because that file has already been split once for
  crossing the cap.
- **`src/presentation/i18n/locales/en.ts` and `de.ts`.** This is the one real collision with
  slice 16: both slices add keys to both files, and slice 16 is the branch this was run in
  parallel with. Whichever lands second resolves a merge in two files, which is trivial —
  but a key added twice under different names is not, so read what the other slice added
  before adding `notice.*` or `save-state.*`.

## Why it matters

Slice 17 `dependsOn` 13, 14, 15 and 16. Fourteen and fifteen have landed, so slice 13 and
slice 16 are the last two things between the tree and the presentation-layer error routing
that gives every other surface its policy. Parking slice 13 parks slice 17 with it.

There is also a smaller, live cost: `runtime.ts` already prints every refusal through
`notifyError`, at no severity, with no dismiss control and no live region. That surface is
what this slice makes accessible, so until it runs, the plugin's only user-facing error
channel fails SDD §85's "status not colour-only" and has no keyboard-operable dismissal.

## What closes it

Executing the plan, in its own task order — it front-loads the risk deliberately, and task 1
is the one to budget for: widening the `Notice` fake, which has been drawing nothing at all.
This repository's ledger records the two previous fake-widenings of that kind turning 65 and
86 tests red, and those reds were the finding rather than the obstacle.

Two departures from the spec are already settled in the plan and should not be re-litigated:
severity carries a translated label and a colour but **no icon** (this plugin has never called
`setIcon`, the harness has no icon renderer pending the first call, and a text label satisfies
§85 alone), and `withSaveStateTracking` imports slice 8's existing `RefreshedHistory` rather
than declaring the spec's `TrackedHistory` beside it.

## References

- [`docs/tasks/13-notifications-and-save-state-surfaces.md`](../tasks/13-notifications-and-save-state-surfaces.md) — the slice document, three of whose claims the spec supersedes.
- [`docs/tasks/17-presentation-layer-error-surfacing.md`](../tasks/17-presentation-layer-error-surfacing.md) — what this unblocks.
- `src/presentation/notices/notify.ts` — the existing door this slice grows rather than replaces.
- [[The German gate checks two terms, not the language]] — why the eight strings this slice adds to `de.ts` are read by no gate beyond completeness.
