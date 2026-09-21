# The deferred manual pass

**Decision, 2026-09-21 (session eleven), taken by the user: every vault check in this package is
deferred to ONE terminal pass.** No wave asks for a walk while agent-closable work remains. This
file is the index of what that pass will be; it is deliberately **not** a copy of any step, because
a second copy of a procedure is one that disagrees with the first.

## Why batch them

A walk costs user time and nothing else can buy it. Spending it mid-package pays for a picture of a
tree that later waves then change — U04's walk on 2026-09-21 confirmed seven steps against a build
three integration SHAs old, and every one of them has to be read as a fact about that build. Batched
at the end, one walk grades a tree nobody is still editing.

The cost of NOT batching is real too and is named here rather than glossed: a defect a walk would
have found survives longer, and this repository's record is that its sharpest defects were fakes
accepting what Obsidian refuses, with every gate green. **That trade was made deliberately, not
overlooked.**

## What the pass consists of

**84 human steps across six cases**, measured rather than remembered:

```bash
for f in "Design an Asset" "Take an asset from the library into a plan" \
         "Compose an asset from parts" "Calibrate a sheet and reserve space" \
         "Recover an asset design rather than lose it" "Two designers on one asset"; do
  printf "%-46s %s\n" "$f" \
    "$(grep -cE '^\| [0-9]+[a-z]? \| `(obsidian|desktop|judgement)` \|' "docs/tests/cases/$f.md")"
done
```

| Case | Human steps | Of total | Discharges |
|---|---|---|---|
| [[Design an Asset]] | 19 | 65 | U01 (with the next row) |
| [[Take an asset from the library into a plan]] | 19 | 28 | U01, T34 |
| [[Compose an asset from parts]] | 2 | 38 | U02, U03 (its Repeat section) |
| [[Calibrate a sheet and reserve space]] | 9 | 36 | U04 — **7 already confirmed**, see below |
| [[Recover an asset design rather than lose it]] | 27 | 36 | U05 |
| [[Two designers on one asset]] | 8 | 16 | T12 |

**Two reductions apply and both are already recorded in the cases themselves.** U04's steps 3, 7, 9,
12, 13, 14 and 34 were confirmed in a live vault on the `test-build` of `c69ec364d`, so only its
step 32 (needs a screen reader) and its seven `browser` steps remain — and those seven are
structurally unreachable while `tests/harness/assetDesigner.ts` sets `background: null`. And
**[[Two designers on one asset]] step 11 is the same walk as [[Recover an asset design rather than
lose it]] step 17** — walk one, not both.

## The gate inside the pass

**[[Two designers on one asset]] step 1 decides how much of that case exists.** No control this
plugin owns opens a second designer leaf on one asset, so whether Obsidian will give a walker a pair
at all is unverified by anything. That step names exactly which rows survive if it fails. **Walk it
first**; it costs two minutes and it decides eight steps.

## Rows this pass cannot reach, and who can

- **U06** is REFUSED as written, not merely unrun — there is no freeze/issue workflow to exercise.
  It needs a product decision, not a walker.
- **AD16 item 1** (benchmarks) needs the F12 fixture family, which does not exist at any size. **An
  agent can build the fixtures; only the measurement needs a host**, so that split belongs to a wave
  before this pass, not inside it.
- **AD16 item 2** (accessibility) is partly reachable and deliberately not claimed: the jsdom axe
  scans verify no colour contrast, no visible focus indicator and no hit-target size, because jsdom
  has no rendering engine for any of the three.
- **AD16 item 3** (moderated novice usability) needs people. Not fakeable and not faked.

## The three `src/` findings this pass looks at

Recorded as holes by the user's decision rather than fixed, so the pass is where they are
**observed** rather than where they are closed. Each names its steps:

1. The designer's header reads `Saved` beside its own out-of-date strip, and
   `save-state.saved-refresh-needed` cannot be produced on that surface at all — **B9, B11** of
   [[Recover an asset design rather than lose it]]. Against C08's *"Saved must not imply that a
   stale canvas is current"* this is the sharpest open question in the package.
2. `unrecoveredWrite` is set by the designer and drawn nowhere — **B19, B20**.
3. `runtime.ts`'s `writesBlocked` premise contradicts `assetDesignStore.stale`. A comment, not
   behaviour, and no step observes it.

## What a walker records

Each case carries its own **Runs** table and its own **Outcome** section; fill those, in the case
file, rather than anywhere else. **An aggregate "looks good to me" is not a filled Runs table** —
the 2026-09-19 walk produced exactly that and the matrix had to say so. What moved a row on
2026-09-21 was a per-step checklist with one expected result each, walked against the file.
