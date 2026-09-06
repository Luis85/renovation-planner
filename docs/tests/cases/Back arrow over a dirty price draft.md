---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 59
sources:
  - docs/superpowers/specs/2026-09-05-whole-tree-review-findings.md (P2)
  - SDD §12
status: Ready
---

# Back arrow over a dirty price draft

The improvement-and-polish pass's P2 finding in a real vault: whether the leaf's own back and
forward arrows walk a navigation `RenovationProjectView.setState` refused, once a dirty price
draft is standing and the confirm dialog is what refused it. `RenovationProjectView.setState`
now assigns `result.history` before its one `await` rather than after it, so that a caller
reading `history` off the same call — synchronously, before the returned promise settles —
sees the right answer either way; whether Obsidian's own arrows read it at that point, or only
once the promise resolves, is not something this repository can ask of anything but a vault.

Run [[Navigate into a project and back]] first, or at least its steps 1–3, so the detail state
and the back arrow are familiar: this case adds the one interaction that state's own steps do
not exercise — a REFUSED navigation, over a leaf that already has history either side of it.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and at
least one renovation project with a price section that has at least one asset to price.
`Create sample renovation project` seeds a project and a plan but no asset — set up a project
with a priced asset first (`docs/tests/cases/Price a shared asset for one project.md` covers
that setup) if the vault has none.

## Why a human is the only instrument for this

`renovationProjectView.test.ts` and `projectExperience.test.ts` both assert that `setState`
sets `result.history` to the right boolean — `false` for a refused, changed state, `true` for
an accepted one — and nothing more. Whether the leaf's own back and forward arrows actually
walk the entries that boolean is supposed to control is a fact about Obsidian's host, not about
this plugin:

- **`FakeLeaf` records asks rather than behaving.** It stores what `setViewState` was called
  with and keeps no navigation stack of its own, so no suite assertion can tell "the arrow
  worked" from "we recorded that it should".
- **The order this task changed is only observable from OUTSIDE the awaited promise.** The
  whole reason `result.history` moved before the `await` is that a caller might read it before
  `setState`'s own promise settles; a suite that only ever awaits the promise before reading the
  field — which is all `projectExperience.test.ts` can do — cannot tell the new ordering from
  the old one. Only Obsidian's own `leaf.setViewState`, which nothing here can see the inside
  of, can say whether it ever reads that early.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open a project, then its **Project prices** section | The price section draws with at least one asset row | The setup every later step needs |
| 2 | `obsidian` | Type a new value into one price field, without pressing Enter or blurring it | The field shows the typed value | The dirty draft this whole case is about |
| 3 | `obsidian` | Press the leaf's own **back** arrow | A confirm dialog appears asking to discard the draft, offering **Stay** and **Discard** | `canLeave()`'s confirm arm, gating the navigation the arrow asked for |
| 4 | `obsidian` | Choose **Stay** | The dialog closes, the pane is still on the price section, and the field still shows the typed value | The refusal: `session.canLeave()` answered `false`, `result.history` was corrected back to `false`, and nothing navigated |
| 5 | `obsidian` | Press the leaf's **forward** arrow | Nothing happens — there is no forward entry to walk to, because the refused back press recorded none | The half no suite can see: a `history` left `true` from an optimistic early read would let Obsidian believe a navigation happened that never did, which forward could then walk to a state the pane was never actually in |
| 6 | `obsidian` | Press **back** again, and this time choose **Discard** | The dialog closes, the draft is gone, and the pane returns to wherever back was supposed to go (the project detail's own section, or the list) | The accepted arm: `session.canLeave()` answered `true`, `result.history` stayed `true`, and the arrow's navigation actually happened |
| 7 | `obsidian` | Press **forward** | The pane returns to the price section it just left | The other end of the entry step 6 actually recorded — proof that a genuine navigation still gets a working forward arrow, which is the case step 5 is a refusal of |

## Deliberately NOT checked

- **Whether Obsidian reads `result.history` synchronously or only after the promise settles.**
  The code comment states the reasoning for assigning it early regardless of which is true; this
  case can observe only the CONSEQUENCE (whether the arrows walk correctly), not which of
  Obsidian's two possible reading strategies produced it.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |

Not yet run in a vault. Every row above is an expectation derived from `RenovationProjectView`'s
own source and from `docs/superpowers/specs/2026-09-05-whole-tree-review-findings.md`'s P2
entry, never from memory of either.
