# RESUME — session eleven's hand-off

**Rewritten 2026-09-21, replacing session ten's packet wholesale**, for the reason every packet
before it gave for doing the same: a hand-off that is appended to goes stale in a way a reader
cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT** — the user has
not been asked to make it ready and nobody should on their own initiative. The user was asked
directly whether the beta was ready and said **"not ready, keep working"**.

| | |
|---|---|
| HEAD | `4bc2ba5b7` — pushed, tree clean |
| Gates | CI run `35632664115` on `4bc2ba5b7`: `verify` ×4 plus `audit` plus GitGuardian, **all success**, read by run id |
| `origin/main` | `ed5c50b76`. The **local `main` ref is stale at `f3a8864a9`** — fetch before reading it. Merge base with `origin/main` IS `origin/main`, so nothing needs rebasing |

## What session eleven did, and the one thing it did NOT do

The user authorized, in these words, *"do both, start with the 10 rows"*. The ten rows shipped as
wave 14. **The second half was this session: write the T12 and U05 manual cases and hand the user a
walk.** Both cases are written, reviewed, fix-rounded and merged. **The walk was handed over and has
NOT been walked.** Nothing in this session moved a matrix row on evidence from a vault, and both new
cases say so in their Runs tables and their reports.

**ALL MANUAL CHECKS ARE NOW DEFERRED TO ONE TERMINAL PASS**, by the user's decision at the end of
this session. No wave asks for a walk while agent-closable work remains.
[`MANUAL-PASS.md`](./MANUAL-PASS.md) is the index: 84 human steps across six cases, which rows each
discharges, the two reductions that already apply, and the gate inside it. **Do not hand the user a
walk before the agent-closable work is done.**

The per-step checklist this session produced lives in its transcript rather than in a file, and does
not need rebuilding until the terminal pass — at which point it is rebuilt from the cases'
`obsidian`, `desktop` and `judgement` rows, which is what `MANUAL-PASS.md` points at.

## Wave 15 — two cards, two cases, merged

| | |
|---|---|
| Base | `098067d3c` (the lease table is IN it) |
| Candidates | `25d8d3c3f` (A) / `755aa0cd5` (B) |
| Fix rounds | `3c06a6f4d` / `30d280d41` |
| Merged | `e691028e1` / `ba9962549` |
| Integrator | `4bc2ba5b7` — census, `## Cases`, matrix, ledger |

`docs/tests/cases/Two designers on one asset.md` (order 84, 16 steps) and
`docs/tests/cases/Recover an asset design rather than lose it.md` (order 87, 36 steps).
Disjointness verified across the **fix-round** shas, not only the candidates: four paths, two per
card, `uniq -d` empty.

**These are documentation-only changes, so all six gates are green BY CONSTRUCTION** — `npm run
check` never reads `docs/`. The two independent reviews were the only quality control this wave
had, and they earned it: between them they caught two pass conditions that would have made the
walker report defects that are not real, a citation claiming coverage its test does not give, and a
count that was false when written.

## The finding worth inheriting: a refusal that turned back into a procedure

W15-B first **refused** half of U05, arguing that `GetAssetDesign` reads exactly two resources and
every geometry write reads both of them first, so no fault can break the read-back without having
already refused the write. That argument is correct about every obvious fault and was falsified by
an asymmetry: **nothing on the WRITE path derives what the READ path derives.**
`validateAssetShape` calls `dimensionsOf` zero times; `GetAssetDesign` derives it twice. So a
schema-valid clearance whose SPAN is not representable is written happily and refused on the way
back.

**Three corrections travelled upward inside that one item, which is the shape to expect rather than
the exception:**

1. The **reviewer** found the asymmetry the card had dismissed, and named a suite spike it could
   not run read-only.
2. **The spike already existed as a test.** `getAssetDesign.test.ts` carries *"refuses a clearance
   whose span overflows rather than reporting Infinity"* with the exact needle fixture, and its
   docblock names the trap a hand-built spike would have fallen into — an axis-aligned rectangle
   spanning ±1e308 trips `asset.degenerate-clearance` one guard earlier and never reaches
   `dimensionsOf`. So CLAUDE.md's **run-`ls`-before-believing-a-gap rule caught a REVIEWER this
   time, not a card** — a reviewer's honest *"I cannot settle this read-only"* is still a claim
   about the tree and wants checking.
3. **The integrator then got it wrong and the CARD corrected it.** The integrator's spike result
   said a drag would land the write. It will not: after a failed refresh the store still holds the
   previous design, so `createEditShape` passes a stale `geometryVersion` as `expected` and every
   drag, arrow key and Inspector field is refused as `external-modification` — C08's
   *refused/conflicted* outcome, already covered elsewhere in the case. The write lands only through
   a door supplying **no** expected version: `runForward` reads `this.input.expected ?? version` and
   `dispatchBackground` supplies none, which makes the gesture **Remove reference**. Steps 12a–12d
   use it.

**Nobody has executed that sequence.** The rows are written so that *"the write did not land"* is a
recordable finding, and the case, its Runs table and its report all say so.

## Matrix corrections made this session

- **T12 cited the wrong file.** `designerCrossLeaf.test.ts` has six cases across two describes — bus
  delivery, per-asset filtering, a closed leaf, listener disposal, repeated open/close — and **no
  conflict case at all**; its only two matches for `conflict|expected` sit inside a docblock about
  leaked Konva stages. Reached independently by the card, its reviewer and the integrator, each by
  listing every `it(`. The behaviour **was** asserted all along, in `designerWriteChain.test.ts` and
  `designerSelectTool.test.ts`. **True about a behaviour, wrong about a file** — the same shape wave
  14 recorded for T30, one wave later.
- **T12** → `partial — a written case now exists, unwalked`. **U05** → `not-run — a written case now
  exists`, with its post-write-refresh clause graded **discharged by a procedure rather than
  narrowed**.
- U05's old reason said it needed *"two real leaves"*. It does not — the case works in one leaf
  throughout, and T12 owns the two-leaf scenario.

## Two stale counts found by re-deriving the census, and how they differed

The suite's step census was re-run by grep on the merged tree: **557** steps, `suite` 207,
`browser` 75, `obsidian` 243, `desktop` 15, `judgement` 17. The prediction matched on every row,
which is the additive check that says neither card edited a verdict outside its own new file.

**Every step figure was exactly right. Both case counts beside them were wrong.** The census
sentence said *"across 47 cases"* and matched none of the three populations it could have meant —
48 case files, 31 bullets, 26 carrying a verdict. And the triage paragraph's *"twenty cases whose
steps are a table"* was wrong in its **value** and in its stated **derivation**, which claimed to be
`ls` minus one and therefore counted the 22 files that carry no verdict column at all. The two greps
get re-run; the numbers beside them did not. Both are derived now, each with its command written
beside it, and the table-form loop was **executed as the document prints it** and answered 27.

## Three `src/` findings, surfaced and deliberately NOT fixed

The user was asked before dispatch and chose **"record in the cases only"** — no ruling opened, no
`src/` change. They are here so a later session does not rediscover and re-propose them.

1. **The designer's header reads `Saved` while its own strip says the canvas may be out of date.**
   `DesignerHeader.vue` mounts `SaveStateIndicator`, which derives `saved-refresh-needed` from
   `useProjectStore().stale` and `planningReadState`; `AssetDesignerView` gives the designer its own
   Pinia where neither is ever hydrated. That component's docblock says it reads *"THIS Plan
   Editor's own store"*. **`save-state.saved-refresh-needed` cannot be produced by the asset
   designer at all** — a case expecting it would be wrong about the build rather than finding a
   defect in it. Against C08's *"Saved must not imply that a stale canvas is current"* this is the
   sharpest open question in the package. **B9 and B11 are the steps that look at it.**
2. **`unrecoveredWrite` is set by the designer and drawn nowhere.** Eight readers — six Plan Editor,
   two in the Renovation project view's work surface, one of which draws it as a `role="alert"`
   paragraph — and nothing under `src/presentation/designer/`. **B19 and B20.**
3. **A comment rather than behaviour:** `runtime.ts`'s `writesBlocked` premise says this surface has
   *"no re-read that can go stale over an asset's own design"*, contradicted by
   `assetDesignStore.stale` and the notice that draws from it. The behaviour is correct and pinned
   by `designerRefresh.test.ts`; the sentence is the bug. One sentence, unowned.

## Carried forward — verify against the tree, do not inherit

Everything on session ten's list that was not discharged is still open and still unowned:
`Show grid` defaulting off (one field shared with the Plan Editor, so flipping it flips both);
German `Vorlage` meaning both reference sheet and shape preset; `tests/harness/assetDesigner.ts`
binding neither `openLibrary` nor `usePlan` and its deliberate `background: null`; item 8's
ownership; the 460 px toolbar's unexplained second row; 80rem being 1280px of LEAF; and
`designer-object.css`'s dead rule with the three smaller test-hygiene items beside it.

**Added this session:** `reversibleAssetDesignWindows.test.ts` is the strongest two-leaf evidence in
the repository and **is claimed by no matrix row** — worth a row rather than a card.

## Nothing is authorized

AD18's **"deliberately absent"** table lists ten board elements that must NOT be implemented back;
implementing one is worse than doing nothing. The carried-forward list is candidates, not a queue.
Propose, get a decision, then plan a wave.

## This machine

7.8 GB RAM, SHARED. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- `check:fast` locally, full `npm run check` in CI. **Six sessions running.**
- Workers run narrow `npx vitest run <paths>` only. `check` / `test:coverage` / `analyze` are the
  integrator's. Run `test:coverage` BEFORE `analyze`.
- Watch CI **by run id**: `gh run view <id> --json status,headSha,conclusion,jobs`. Do not push
  repeatedly in quick succession; it cancels in-flight runs.
- The exit-code trap still stands: `cmd > log; ec=$?; echo ...` reports the ECHO's status. Read
  `$?` with nothing between, and read the log's own `Test Files` line.
- CRLF: about twenty files under `src/` and `tests/` are `i/lf w/crlf`; `docs/` is LF throughout,
  checked this session with `git ls-files --eol` before every scripted edit. A shell heredoc is a
  poor instrument for a long document with backticks and quotes in it — this file was written with
  an editor tool after a heredoc failed on its own content.
- Worktrees under `.worktrees/` carry `node_modules` and are reusable with `git switch -c`: `ad07`
  (wave 15 A), `ad08r`, `ad10` (wave 15 B), `ad11`, `ad13b`, `ad13c`, `ad14`, `adq`.
- **`SendMessage` to the card's ORIGINAL worker is still the right tool for a fix round.** Five
  sessions running. Both cards pushed back this session and both were right — W15-A rejected the
  integrator's *"steps 5–13 are unwalkable"* range because four of those rows survive off step 14,
  and W15-B corrected the integrator's spike outright.

## The rule this session paid for

**An instrument that already exists looks exactly like a gap when you read the file instead of the
directory** — and that is not a rule about cards. It caught a reviewer this time, on the single
highest-consequence claim in the wave, and the integrator only found it by grepping `tests/` before
building the spike it had been asked for.
