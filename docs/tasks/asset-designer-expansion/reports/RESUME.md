# Resume packet - asset-designer expansion

Rewritten 2026-09-17 at the end of the SECOND execution session, replacing the first session's
packet. Per the runbook's section 9 rule: a handover, not a completion claim.

## Where the work is

**Branch:** `renovation-planner-asset-designer-bc5539` (worktree
`.claude/worktrees/renovation-planner-asset-designer-bc5539`). **Nothing has been pushed, merged or
tagged. `main` is untouched.**

Five worker worktrees remain under `.worktrees/` (`ad07`, `ad08r`, `ad10`, `ad11`, `ad12`), each on
its own branch with its candidate history intact. They are gitignored and safe to remove once the
branch is merged; keeping them is what makes every review boundary re-readable.

## What this session did

| Card | Status | Integrated | Review |
|---|---|---|---|
| AD07 presets, measurements, reference entry paths | integrated | `f8c565590` + `b4869f3b1` | REQUEST CHANGES, then fixed |
| AD08 remainder (marquee) | integrated | `1896123c0` + `187b1de5d` | REQUEST CHANGES, then fixed |
| AD10 grouping, align, distribute, repeat | integrated | `ca6bce144` + `c107b2bda` | REQUEST CHANGES, then fixed |
| AD11 open lines and rounded shapes | integrated | `1940aad0e` + `97ca96ff9` | REQUEST CHANGES, then fixed |
| AD12 reference, clearance, placement | integrated | `e50fe6f22` + `8825bfb76` | APPROVE, seven findings |

**Execution mode: genuinely delegated.** Five implementation workers and five independent reviewers,
each in its own worktree on its own branch, each given the package's own worker or reviewer prompt
verbatim plus an exact lease. Every card was reviewed by an agent that did not write it. **All five
came back with findings, and four came back REQUEST CHANGES.**

## The gates, on the final tree

| Gate | Result |
|---|---|
| `npm run build` | **0** |
| `npx oxlint --deny-warnings` | **0** |
| `npx eslint . --max-warnings 0` | **0** |
| `npx vue-tsc -noEmit` | **0** |
| `npm run analyze` | **0**, zero above threshold |
| `npm run test:coverage` | **0**, 99.22 / 98.04 / 99.28 / 99.67 against 99/98/99/98 |

The suite went green **in one run with no timeouts**, which had not happened once before on this box
this session. Do not read that as the machine being fixed; read it as the machine being quiet.

## What the reviews caught that the gates could not

Recorded because it is the argument for keeping the review step when it is expensive:

- **A keyboard user could not see focus on the selected preset** - a `box-shadow` rule over a host
  focus ring that IS a `box-shadow`. A red gate, reproduced independently before acting.
- **The sticky select-multiple control did not apply to the marquee at all**, so the one route C05
  requires in order to avoid a modifier did not work for the new gesture.
- **`lockedGraphics` shipped optional with a permissive default and the root never bound it**, so
  AD10's locked-part rule could never fire. Invisible to all four gates.
- **A no-op align wrote a revision and pushed an undo entry** that appeared to do nothing.
- **Three selection-mode buttons were inert on an open graphic** on the very first gesture AD11
  delivers - the exact shape this package had already refused once, in AD12-R1.

## Three rulings issued, all in `contracts/DECISIONS.md`

`r1` remains settled and untouched; these APPLY it rather than revise it.

- **AD08-R1** - the Parts panel IS C05's overlap alternative; no chooser is built. Trigger: a leaf
  too narrow to draw the panel.
- **AD10-R1** - a spatial composition refuses a selection mixing measured and pending graphics;
  grouping does not; an all-pending selection is not mixed. **Amended the same day**: it named five
  operations where only four can be bound, and pointed at a fix site shared with the path it
  exempts. Read the amendment, not only the rule.
- **AD12-R1** - "lock reference" is already true by construction, so no control is owed. Opacity is
  a real gap and is queued.

## The next dependency-ready tasks

**AD13** (library to designer to plan), then **AD14** (historical output). AD13's prerequisites
AD05, AD07 and AD12 are all integrated. AD14 needs AD13.

Before dispatching AD13, read `execution/INTEGRATION-QUEUE.md`. It carries four obligations nobody
can currently discharge, two of which AD13 meets head-on:

- **A persisted review state is OWED** (AD01 section 1, S09 names AD12 as its owner) and is
  unbuildable in any current lease: it needs the aggregate, the DTO schemas, the mappers, a schema
  version, and a representation C07 delegated to AD01 which AD01 never chose. **It needs a ruling
  first and a card second.** The AD12 report originally called it "not owed"; that wording would
  have lost it.
- **Clearance under resize (AD12 criterion 4) is NOT met.** `scaleDesign` scales a clearance
  unconditionally; r1 parks only the refusal arm, and only for a pending clearance.
- **There is no door to DELETE a reference** - `SetAssetBackgroundInput.path` is a bare string.
- **Background opacity** is a real gap in nobody's lease (runtime, canvas, view menu).

## The blocker that does not go away with more time

**No Obsidian and no pinned Chromium.** Unchanged from the first session, and now much more
consequential: this session built **five surfaces nobody has ever looked at** - a fourteen-thumbnail
preset gallery in a dialog, three stacked overlay buttons on an empty state, a fifteen-button
Arrange block, a reference and clearance column, and two new toolbar tools with a one-button mode
group beside them.

Layout is what a capture measures and no layout engine in this repository does. This project's
captures have caught **ten defects `npm run check` could not**. None of that instrument ran.
`-- --width=460` is the one to take first: it is also AD08-R1's own stated trigger for ever
revisiting the overlap chooser.

**AD15 and AD16 stay `blocked` and must stay blocked from here.** Runbook section 10: implemented
work and exact remaining verification may be handed over, but the beta may not be labelled ready.

## Three things this session learned that the next one should not relearn

1. **A fallow CRAP finding is meaningless without knowing when the coverage under it was written.**
   Learned twice in one sitting: three findings cleared themselves once the suite had run, and then
   a refactor shifted line numbers and made the map stale again for exactly the file it touched.
2. **Never generalise from a truncated log.** A real assertion failure spent an hour disguised as a
   load timeout because a coverage run had been piped through `tail`, so only two of three failures
   were ever visible.
3. **A rule whose instrument enumerates what it refuses teaches the next author that anything
   unenumerated is allowed.** The German register check listed ten verbs; this wave wrote seven
   du-form strings and it caught one. A later worker then read the invisible neighbours and matched
   them deliberately, reasoning the repository had no house register. Widening the list found an
   eighth violation that predated the whole expansion.
