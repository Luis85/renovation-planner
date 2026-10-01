# Task report — AD15 / wave 8 card W8-B

Outcome: **implemented**
Owner / worktree / branch: worker agent · `.worktrees/ad10` (reused, carries `node_modules`) · `ad15-w8-container-query`
Base commit / candidate commit: `07d961321` / `6d0bb73c1`, fix round `265b3505`
Accepted contract revision: `r1`
Allowed scope and shared-file leases: CREATE one new `*.test.ts` under `tests/presentation/designer/`.
No other file, in `tests/` or `src/`. Test-only.

Closes the blind spot `designerResponsiveShell.test.ts` names in its own header: **jsdom applies no
`@container` query and computes no used width**, so nothing in the suite could see the designer's
compact layout at all.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `tests/presentation/designer/designerNarrowQueryResolved.test.ts` | New. Resolves `styles/designer-narrow.css`'s `@container rp-designer (width < 35rem)` by hand and applies the surviving rules to the real mounted designer | yes |

## The honesty condition, which was part of the lease

**The blind spot is EMPTY and the file says so unhedged.** The narrow block declares
`flex-direction`, `flex`, `width` and four `border-*` properties and contains no `display`,
`visibility` or `content-visibility` at all. The lease required the card's report and docblock to
state that rather than imply a discovery, and required the worker to STOP and say so if the
assertion would be theatre.

It is met. The header reads *"The blind spot is EMPTY today and this file found no defect… the
claim here is a GUARD against a future hiding declaration, not a discovery"*, and the reviewer
confirms nothing in the file implies otherwise.

## Acceptance coverage

| Criterion | Result | Exact evidence | Remaining issue |
|---|---|---|---|
| The container block is resolved, not just read | **met** | `stylesheetRules` gives the parsed condition; `satisfies()` evaluates container name + width range with `rem`→px at a 16px root; selectors are matched with **jsdom's own `querySelectorAll`** against the mounted designer | none |
| It is not `designerStyles.test.ts`'s question | **met** | That file reads what the block DECLARES and never mounts; this applies those rules to a rendered tree. Reviewer confirmed `designerStyles.test.ts` has zero `mount` occurrences | none |
| The instrument proves it resolved something | **met** | Four independent no-op detectors: the block is found; the condition discriminates (520/559 true, 560/900 false); every admitted rule matches ≥1 mounted element; the admitted rules reach ≥1 named control | The reach assertion is over the UNION of four rules, so three could stop reaching controls and it stays green — stated in the file |
| A renamed container is caught | **met, after a resolver fix** | See below | A CONSISTENT rename of both halves still passes; `designerStyles.test.ts` pins the literal, and the header points there |

### The card's own premise was wrong, and the worker fixed the RESOLVER rather than the sentence

The first version resolved only the WIDTH. Retitling the block to `@container rp-other` — while the
root still declares `container-name: rp-designer` — left **all eighteen cases green**, although in a
browser the block had stopped reaching the designer entirely. A header claiming "rename the
container and it goes red" would have been a false measurement.

`satisfies()` now resolves the NAME as well, via `containerNames(css)` reading the sheet's own
`container-name` declarations. The reviewer verified this with its own `lightningcss` probes rather
than taking it on trust: `container-name` parses as `{"type":"names","value":["rp-designer"]}`,
`satisfies`'s `parsed[2]` is the name string, and `null` for an unnamed block correctly skips the
check. The discrimination is load-bearing in both directions **inside one run** — one case requires
`names.has('rp-other') === false` and another requires `names.has('rp-designer') === true` — so a
resolver that read the name wrongly fails one or the other.

### The strength inversion, reasoned by the reviewer and then MEASURED by the worker

`takes no control away from a leaf at the narrow width` is **strictly weaker** than `declares no
display, visibility or content-visibility in the narrow block`, and the first draft's header
presented it the other way round.

`hiddenControls` reports only a hiding rule whose subject CONTAINS a focusable control.
`.rp-designer-canvas` contains none — it renders `EditorSurface` → `VStage`, seven `<canvas>`
elements and an overlay. The worker confirmed it rather than accepting the argument: adding
`display: none` on `.rp-designer-canvas` to the narrow block in a scratch run left **the mounted
guard green and reddened only the declaration case**. So the single worst regression this layout can
suffer is invisible to the case that looked like the point of the file.

Both case docblocks are reversed now. The declaration case is named as the one that actually guards
the sheet; the mounted case states outright that it is weaker and names what it does buy — a failure
message identifying the control, the per-rule `unmatched` check, and unconditional rules
`narrowOnly` excludes.

## Executed checks

| Command or manual action | Commit / environment | Exit code or observed result | Evidence |
|---|---|---|---|
| `npx vitest run` over the new file | `265b3505` | 0 — **19/19** | worker; reviewer reproduced 19/19 at `6d0bb73c1` |
| `npx vitest run tests/presentation/designer` | `265b3505` | 0 — **65 files, 904 tests** | worker; reviewer reproduced exactly at `6d0bb73c1` (96.8s) |
| `npx oxlint` / `npx eslint` on the file | `265b3505` | 0 | worker and reviewer independently, the latter with `--deny-warnings` / `--max-warnings 0` |
| `npx vue-tsc -noEmit` over the tree | `265b3505` | 0 | worker only |
| Independent review | `6d0bb73c1` | **APPROVE conditional on five docblock narrowings, no code change** | below |
| Integrator finding, sent separately | `6d0bb73c1` | header cited a command the script refuses | below |
| Fix round, both sets in one commit | `265b3505` | applied; 488 insertions, one file | `git diff --name-only 07d961321..265b3505` names that file alone |

### The five review conditions

1. **`CONTROLS`** — *"everything a user can put the focus on"* was false; the selector is six element
   kinds and omits `[tabindex]`, `[contenteditable]`, `audio`/`video[controls]`, `iframe`,
   `area[href]`. The designer does carry `tabindex` elements; they happen to be `<button>`s today,
   so the list was adequate **by accident of the current markup**. Now names the six and the five.
2. **`HIDING`** — *"the three ways a declaration takes a control off the screen"* sat above a
   four-entry list and read as exhaustive. Now "the three PROPERTIES this file recognises, at four
   values", naming `opacity: 0`, a zero size, off-screen positioning and `clip-path` as unrecognised.
3. **`containerNames`** — claimed to be what decides whether a `@container` block reaches anything.
   A browser resolves against an ancestor of the matched element declaring the name AND carrying
   `container-type`; this looks at neither. Now states it is an approximation that **over-admits**,
   which is the safe direction for a guard.
4. **`satisfies`** — *"anything else THROWS"* has one exception: `stylesheetRules` joins nested
   at-rule conditions with `' and '`, so a doubly-nested rule reaches `JSON.parse` as non-JSON and
   fails with `SyntaxError` instead. Still fail-closed. The `?? 0` length fallback is now marked as
   the one silent path, pointing at `narrow.length > 0` as its backstop.
5. **The strength inversion** — above.

### The integrator's own finding

The header cited `npm run harness-shot -- --width=460` as *"the only instrument here that measures a
rendered layout"*. **That invocation does not run**: `scripts/entryShots.mjs`'s `resolveShots` throws
`--width applies to a named entry, and the fixed shots carry their own`, verified at the throw
itself. The same bare form had already been recorded as false once — `RESUME.md` lists it as the
first of four things that turned out FALSE last session, after a hand-off gave it as an instruction
and the next session ran it.

The header now names the FIXED designer shots instead: `harness-shot.mjs`'s `SHOTS` carries
`asset-designer-narrow` and siblings at `width: 460`, written by a bare `npm run harness-shot`, and
**460 is under the 560px threshold this file resolves**, so those captures are this block applied by
a real engine. It records that both were read, not run.

**The worker corrected the integrator in the same round**: `CLAUDE.md`'s `-- --width=460` sentence
sits inside its *given an entry id* paragraph, where the spelling is correct, and the worker's own
header had lifted it out of that context. The integrator's `CLAUDE.md` edit adding the second
refusal stands on its own evidence; the causal claim that the omission misled two sessions was
withdrawn in `1e6f37b6c`.

## Verification not performed

- **`npm run check`, `npm run test:coverage`, `npm run analyze`, `eslint .` over the tree** — not run
  by the worker or the reviewer, by the lease. See the integration note below for what happened to
  them, which is not what this package's earlier waves did.
- **The counterfactual reds are the worker's own and the reviewer could not reproduce them**, a
  reviewer being forbidden to edit. The reviewer reasoned each from the code instead and probed the
  parser shapes directly. The one that matters most — the strength inversion — the worker then
  measured, so it is no longer reasoning on either side.
- **Whether oxlint genuinely reported on this file** is thin evidence: it printed nothing and exit 0
  is all the reviewer had. The worker separately planted a deliberate `==`/`debugger` probe and got
  two findings and exit 1, which is the right instinct and is recorded rather than assumed.
- **Nothing here measures rendered layout.** jsdom lays nothing out, so *"not hidden by this sheet"*
  is not *"visible"*. The file's header says so.
- **`resizeTo(root, …)` is notional for the TREE.** Nothing the designer mounts reads a width to
  decide a region, so "at a 520px leaf" is real for the arithmetic and notional for the markup. The
  code comment said this; the header now does too.
- **Only `styles/designer-narrow.css` is read**, so a hiding declaration reaching these regions from
  `designer.css` or a theme is outside the file.

## Data and integration implications

Schema/migration change: **none**. Test-only.
Relevant renderer/export/revision consumers: none.
Undo/no-op/conflict/failure coverage: not applicable.
Identity/unit/quantity/calibration invariants: untouched.
Shared root/runtime/locales wiring still required: none.
Rollback/recovery considerations: none — reverting removes one new file.

## Open question carried forward, not taken

**Should the declaration case move to `designerStyles.test.ts`?** The reviewer raised it and the
worker agrees, with a caveat worth more than the move: that case is three lines, needs no DOM, reads
the same sheet `designerStyles.test.ts` already reads, and is the case that actually guards the
property — while it currently lives in a new jsdom + real-Konva file paying full per-file
environment overhead (47s cold standalone).

The worker's own honest extension: if it moves, the mounted guard is left as the weaker case
standing alone, and *"a reader could reasonably then ask whether the whole file earns its 47s"*. Its
answer, which this report records rather than settles: the **resolver** — the container-name
discrimination, the boundary arithmetic, the fixture positive controls — is the durable part of the
card, and none of it needs a mount either. Only `unmatched` and the reach check do.

**Not taken this session.** It is outside the card's lease, it is a real cost question rather than a
defect, and a file that is green, reviewed and explicit about its own weakest case is not one to
churn at the end of a wave. It is a card of its own.

## Reviewer and integrator acceptance

Reviewer outcome: **APPROVE conditional**, five findings, all docblock-only, all applied in
`265b3505`. Lease verified by the reviewer itself: `git diff --stat 07d961321..6d0bb73c1` is one
file and nothing else.

Disjointness against W8-A, verified by the integrator on the FIX-ROUND shas as well as the
candidates: `comm -12` over `git diff --name-only 07d961321..dded01474` and `…..265b3505` is
**empty**. Neither card touched `src/`, `styles/` or `docs/` — `git diff --name-only … -- src styles
docs` returns nothing for both.

`max-lines` is 450 with `skipComments: true`, so the file's 488 raw lines are inside the cap; ESLint
confirms rather than arithmetic.

Integrated commit: `ced90913c`.
