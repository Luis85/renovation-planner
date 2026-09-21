# RESUME — session ten's hand-off

**Rewritten 2026-09-21, replacing session nine's packet wholesale**, for the reason that file gave
for doing the same: a hand-off that is appended to goes stale in a way a reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230), still **DRAFT** — the user has not
been asked to make it ready and nobody should on their own initiative.

**Correction to every previous packet about where `main` is.** They said *"main is untouched at
`f3a8864a9`"*. That is false: `git merge-base --is-ancestor f3a8864a9 ed5c50b76` answers YES, so
`f3a8864a9` is an ANCESTOR. `origin/main` is at **`ed5c50b76`** — PR #229 merged into it — and the
`main` ref in this checkout is stale at `f3a8864a9`. Fetch before you read it. This branch's merge
base with `origin/main` IS `origin/main`, so the branch contains all of main and nothing needs
rebasing.

## Two exit-code traps, and I fell into the second one twice

**Read the analyze section of a PASSING leg**, and do not read a `✗` on the duplication summary as a
gate: `duplicates.threshold` defaults to `0`, which fallow documents as "no limit". Read the
`N above threshold` count. This correction is three sessions old and has caught three sessions.

**NEW, and this one cost me two false greens in one session.** This recipe is wrong:

```bash
cmd > log 2>&1; ec=$?; echo "EXIT=$ec"
```

The compound's own status is the **echo's**, which is always 0. In the foreground you see the printed
line and are fine; **backgrounded, the runner reports the echo's 0 and the notification says "exit
code 0" whatever the gate did.** I reported a green gate twice on a run that exited 1. What works:
read `$?` with nothing between, or `${PIPESTATUS[0]}` after a pipe, and in every case **read the
log's own `Test Files` line** rather than any exit code.

## Wave 12 — the unreachable guard. ONE card, merged, CI green on all six.

| | |
|---|---|
| Base | `82838abe3` |
| Candidate | `078e3dc84` |
| Fix round | `871802a74` |
| Integrator repair | `9dc85914b` |
| Ledger | `9db772339` — CI run `35573801811`, all jobs success |

`DesignerInspector.vue`'s `showUnscaledDimensions` is now `props.design.dimensionsUnscaled` alone.
The first term was unreachable and the docblock had said so for a wave while keeping it.

**The wave started as TWO cards and the second was WITHDRAWN before dispatch** under ruling
**AD18-R7**, not narrowed. AD18's `placement(s)` bullet asks for a change the code argues against in
writing: `en/assetDuplicate.ts`'s header says the `(s)` spelling is house convention copied from a
real precedent, and refuses a plural mechanism because `t` has none. The bullet is wrong twice — it
says *untranslated* where German has `Platzierung(en)`, and it names one member of a three-key
convention as though it stood alone. **A card asking for the wrong thing cannot be closed by testing
harder.**

### The lesson worth inheriting from wave 12

**A past-tense claim that reads as present-tense is a defect, and "it was false" is the wrong fix.**
`assetDimensions.test.ts` and `AssetDesignerRoot.vue` both said *"`DesignerInspector` was the ONLY
reader of `dimensionsUnscaled`"*. The session-nine hand-off called it stale; the integrator told the
card it was false; the card wrote *"It was false"* into the tree; the independent reviewer then
called the second copy *"verified false"* — **four readers, four wrong answers, reached
independently**.

`git log -S` puts both sentences in `d852733bd`, and at that commit's parent
`git grep -n "dimensionsUnscaled" d852733bd^ -- src/` prints the producer twice, one locale comment
and **one reader**. The claim was EXACT. It stopped holding inside the very commit that wrote it,
twelve lines below itself. Both copies now name `d852733bd`, carry the misreading as the diagnosis,
and give a command instead of a count. `AssetDesignerRoot.vue`'s is KEPT, because it is true.

**When you meet an "only" that looks stale, run `git log -S` before you call it false.**

## Wave 13 — harness fixtures for the three unrendered glyphs. ONE card, merged.

| | |
|---|---|
| Base | `758e91d56` |
| Candidate | `129dcbfb8` |
| Fix round | `25aad5294` |
| Ledger | `58da44576` — CI run `35584286453` |

**The user walked a real vault and the strongest open risk in this package is DISCHARGED.** All five
icon-only buttons draw a glyph in Obsidian — `rectangle-horizontal`, `squircle`, `circle`, `minus` in
the Add rail, `anchor` on the toolbar. `HostIcon` never substitutes and the rail is icon-only at every
width, so an unanswered name would have been a blank button with no text behind it. **Narrow it: the
Obsidian VERSION was not recorded**, so it is one installed catalogue, one machine, one date.

They then asked for the fixtures. The three SVGs were fetched **by the integrator, not the card** —
provenance is a shared-file concern — from the Lucide revision the fixture README pins
(`2bfb9bb1bae5d74f6a9f81640ddd8bccc2c71860`), verified byte-identical in the candidate with `cmp`, and
checked for LF / no BOM / trailing newline because `tests/build/encoding.test.ts` refuses a BOM.

**The card proved the "grant both or neither" rule instead of repeating it**: with all three SVGs on
disk and no node-map entries, the old missing-set assertion was still GREEN. The SVG half alone
renders nothing. That claim had been prose since session nine and had never been demonstrated.

### The lesson worth inheriting from wave 13 — the best finding of the session

**Inverting an assertion can remove the last positive producer of the thing it asserts.**

`designerIconToolbar.test.ts` asserted the exact missing set `['anchor','circle','squircle']`. The
card inverted it to the empty set, correctly — but that case was the **last place under `tests/`
asserting `data-icon-missing` is ever produced.** Every other occurrence is a negative
(`toBeUndefined()`, `exists()).toBe(false)`).

The reviewer found it by exhaustive grep and, being read-only, said plainly it could not execute the
proof. **The integrator executed it**: deleting `parent.dataset.iconMissing = canonicalName;` from
`tests/helpers/obsidianIcons.ts` left **10 files and 197 tests GREEN** while turning eight cases
vacuous at once.

**The card then refused the forwarded suggestion and argued a better site**, which is what a fix
round is for. The guard went in `tests/helpers/obsidianIcons.test.ts`, beside the module that WRITES
the marker, rather than in the node-map file — because the hole opened precisely because the only
positive statement lived in a CONSUMER that a later wave was right to empty, and another consumer
repeats the shape. Same mutation after the fix: 1 failed of 198, and the failure is the new guard.

**An unrequested test file was kept on merit, not waved through.** `tests/helpers/editorIconNodes.test.ts`
compares every map entry against its SVG, closing a gap the README's *"mechanically transcribed"* left
open — there is no generator (`grep -rn editorIconNodes scripts/` prints nothing). The reviewer was
asked to judge it and did, with measurements; one of its cases was DELETED as redundant against its
own neighbour.

### What the suite cannot do and was done by hand

`npm run harness` plus the in-app browser at the merge: **14 icon bearers, ZERO `data-icon-missing`**,
and the three new ones carrying the right node shapes. Cloned into a 72px probe and screenshotted,
the five draw a rectangle, a rounded square, a circle, a dash and an anchor. A test proves the entry
is reached and reproduces the upstream nodes; **it cannot prove the picture is a circle.** Both the
card and the reviewer named that as the sharpest gap. It is closed. Server stopped afterwards.

**One measurement stopped reproducing because of this wave.** Wave 11 explained a 3px difference as
the harness rendering the word `squircle` where it had no fixture — correct then, unobservable now.
`W11-A-add-rail.md` carries a dated amendment. **Found by the reviewer reading for stale claims
OUTSIDE its own diff**, which is the part of the review brief that keeps earning its place.

## Gates

- Wave 12 at `9db772339`: CI run `35573801811`, `verify` ×4 plus `audit`, all success, read by run id.
- Wave 13 at `58da44576`: CI run `35584286453`, read by run id — `headSha` matched, `verify` ×4 plus
  `audit` all success, and `gh pr checks 230` shows all **six** pass including GitGuardian.
- Local `check:fast` at `58da44576` exited **1** with three failures, **all timeouts**:
  `tests/build/lint-edited.test.ts` twice (68951ms and 62552ms against a 60000ms budget) and
  `tests/presentation/editor/rotationInspectorRoutes.test.ts` (5149ms against 5000ms). Re-run ALONE:
  `lint-edited` 11 passed exit 0, `rotationInspectorRoutes` 2 passed exit 0 with tests 3.77s.
  Contention. **Nothing quarantined, no budget raised.**
- `rotationInspectorRoutes.test.ts` timed out under load in BOTH waves. It is the first file to
  suspect under contention and it has never failed alone.
- **`lint-edited.test.ts`'s two SFC cases are the ones to watch.** CLAUDE.md calls that 60s budget
  *"the instrument for whether this hook is still cheap enough to sit in the edit loop at all"*, and
  they now exceed it under load. Alone the whole file is 86.72s of test time for 11 cases. Not acted
  on; recorded because the trend is the signal, not the timeout.

## Wave 14 — seven AD15 rows that needed no vault. THREE cards, merged.

| | |
|---|---|
| Base | `7069a3d8b` |
| Candidates | `bf6ac792d` / `c6561b3e6` / `8fc9d34a8` |
| Fix rounds | `25b79d72b` / `2ef0f85ed` / `548141a60` |
| Merged | `ae48ce810` / `d7cce7f42` / `c2fa762d2` |
| Regrade + ledger | `8deda6182` — CI run `35619780998` |

**Ten AD15 rows moved and only five needed a test.** T07, T30, T41, F08 and T16 to `passed`;
T21, T28, T37 and T20 to `structural`; T01 to `passed`; T13 `partial` with its sentence narrowed.
**Every card refused at least one row.** A wave that had dutifully written ten tests would have
written five that certify gaps.

**Disjointness was checked across FIX-ROUND shas, not just candidates** — and that mattered: W14-C
gained two paths from a mid-wave lease extension. Eleven non-docs paths, `uniq -d` empty.

### The three findings worth inheriting, all against DOCUMENTS rather than code

- **A row can be true about a FILE and false about a BEHAVIOUR.** T30 said *"`assetShapeConfig.test.ts`
  has no OPEN-graphic case"* — true — and concluded the plan renderer's handling *"is unasserted"* —
  false. `placedOpenGraphic.test.ts` had asserted more of it since AD11, four directory entries away,
  importing the same helper. The card's own diagnosis is the durable part: **"I read the file the
  lease named and never ran `ls` on its directory."**
- **Check the REQUIREMENT, not the matrix's paraphrase of it.** W14-B dropped half of T41 calling §6
  a heap measurement; `ACCEPTANCE-AND-QA.md` line 168 asks for *"No monotonic retained-listener/**observer**
  growth"*, and `connectedObservers()` already existed in `tests/helpers/layout.ts` with six callers,
  in a file the card already imported from. The card reached that misquote **by correcting the
  integrator's lossy brief with the matrix** — right to push back, one rung short of the source.
- **A fixture asserted only on its defaults is the tidied-fixture trap it claims to close.** W14-C's
  first round left `footprintOrigin`, `facing`, `anchor` and `calibration` free to drift. Each case
  now asserts `snapshot.document` WHOLE with `toEqual`, so a new `AssetShape` field turns all three
  red — the brittleness is the property wanted.

### Two corrections that ran UPWARD, to the integrator

- Reviewer W14-A caught that the `detailPolyline` docblock fix landed in **one of three** places and
  credited the card with a finding **the suite already held** (`assetPlacement.test.ts` since
  `f1cbe86ef`). Both were right; `e06d9346b` finishes the grep the first commit should have run.
- W14-A corrected the integrator's predicted mutation count: **2 failed, not 3** — a case counts once
  however many assertions inside it fire.

### CRLF: 20 files, and it will break a scripted edit

`git ls-files --eol` says `i/lf w/crlf` for about twenty files under `src/` and `tests/`. **The index
is LF and git normalises on commit, so nothing ships wrong** — but an exact-string replacement written
with `
` silently fails on those files, which cost two failed edits before anyone looked. Read with
`newline=''`, detect `
`, and build the replacement with the newline the file actually uses.

## Carried forward — each verified against the tree TODAY, not inherited

- **`Show grid` defaults off** — unowned, unauthorized, and **bigger than AD18's bullet implies**:
  `WorkspaceStore.ts`'s `const gridVisible = ref(false)` is ONE field shared with the Plan Editor, and
  `DesignerCanvas.vue` says so in its own comment. Flipping the default flips the Plan Editor too;
  designer-only means decoupling shared state. Also, half the bullet's argument ("no scale reference
  AND no zoom readout") was discharged when item 1 shipped the zoom readout. Re-read it, do not
  inherit it.
- **German `Vorlage` means BOTH reference sheet and shape preset** — `grep -rn Vorlage src/` prints
  **21 hits across 7 files** today (the session-nine figure of 18/6 was low). Needs a German-language
  decision on which meaning keeps the word before any card.
- **`tests/harness/assetDesigner.ts` binds neither `openLibrary` nor `usePlan`** — verified still
  unbound. No capture can photograph the full header. Touching it means touching that fixture's
  deliberate `background: null` posture, so it needs a ruling, not just a card.
- **Item 8, the vanity fixture** — assigned to AD15, not AD18. Confirm ownership before touching.
- At a 460px leaf the toolbar is 65.9px on ONE button row; a second visual row is taken by something
  unidentified and recorded as unexplained in the CSS. **Do not assert a cause.**
- 80rem is 1280px of LEAF, not window, so the labelled toolbar state is effectively unreachable in a
  real vault. Nobody has decided whether that is fine.
- `designer-object.css` still carries the dead `.rp-designer-inspector .rp-designer-asset-name` rule
  (verified present) and a stale header; W8-B's declaration case wants moving to
  `designerStyles.test.ts`; `designerDrawDetails.test.ts` has a third `held` clone;
  `designerSelectMarquee.test.ts` says twice that EditorSurface routes "a release outside the leaf"
  to `abandonGesture`, wrong in the third item of each list only.

**Discharged this session, so do NOT carry them forward again**: the three unrendered glyphs and
whether Obsidian answers them; `assetDimensions.test.ts`'s stale "only"; the unreachable guard in
`DesignerInspector.vue`; AD18's `placement(s)` bullet.

## Nothing is authorized

Every AD18 item the user authorized has shipped. **AD18's "deliberately absent" table lists ten board
elements that must NOT be implemented back** — implementing one is worse than doing nothing. Propose,
get a decision, then plan a wave. The unowned candidates are the carried-forward list above.

## This machine

7.8 GB RAM, SHARED. Check WHAT is running, not how many:

```
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | Format-List"
```

- Prefix every node-spawning command: `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`
- `check:fast` locally, full `npm run check` in CI. Four sessions running.
- Workers run narrow `npx vitest run <paths>` only. `check` / `test:coverage` / `analyze` are the
  integrator's. Run `test:coverage` BEFORE `analyze`.
- **Never dispatch a worker into a worktree a gate is reading**, and never edit one either.
- Watch CI **by run id**: `gh run view <id> --json status,headSha,conclusion,jobs`.
- A scripted edit is invisible to `scripts/lint-edited.mjs`. Run `npx oxlint` and `npx eslint` by
  hand; **oxlint prints NOTHING on a clean run** — read the exit code.
- **The in-app browser is the ONLY instrument here that applies layout**, and it settled a question no
  gate could for the fourth session running. `npm run harness` + `preview_start`. Kill the server after.
  Trap met this session: `navigate` dropped the query string, and the icon probe returned `count: 0` —
  **an instrument that reaches nothing looks exactly like a clean result.** Assert it found something.
- Do NOT run `npx playwright install chromium`; it emptied `node_modules` once. No pinned Chromium.
- `.fallowrc.json` is JSONC; `JSON.parse` and python's `json` both choke on it. Grep it as text.
- Worktrees under `.worktrees/` carry `node_modules` and are reusable with `git switch -c`: `ad07`,
  `ad08r`, `ad10` (wave 12), `ad11` (wave 13), `ad13b`, `ad13c`, `ad14`, `adq`.
- **`SendMessage` works and is the right tool for a fix round.** Four sessions running, sending
  findings back to the card's ORIGINAL worker has beaten dispatching a fresh agent — and twice this
  session the card pushed back and was right.

## The one rule this session paid for twice

**Corrections must travel upward, and the integrator is not exempt.** The card corrected the
integrator's brief about how many cases pin an invariant, and was right. The integrator corrected the
hand-off, the card AND the reviewer about the `only reader` sentence — having been the one who told
the card it was false. The reviewer withdrew one of its own findings mid-report. The integrator
reported a green gate twice from a defective exit-code capture and corrected itself both times.

**A wave where corrections only flow downward is one where nobody below is reading.**
