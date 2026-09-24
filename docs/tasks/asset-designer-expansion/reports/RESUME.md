# RESUME — session sixteen's hand-off, for the manual-walk session

**Rewritten 2026-09-24, replacing session fourteen's packet wholesale.** An appended hand-off goes
stale in a way its reader cannot detect.

Branch `renovation-planner-asset-designer-bc5539`, worktree
`D:\Projects\renovation-planner\.claude\worktrees\renovation-planner-asset-designer-bc5539`.
PR [#230](https://github.com/Luis85/renovation-planner/pull/230) is still a **DRAFT**. **Nobody marks it
ready, tags it or publishes it without asking the user.**

| | |
|---|---|
| HEAD | **A hand-off cannot name its own sha.** Confirm it yourself: `gh run list --branch renovation-planner-asset-designer-bc5539 --limit 1 --json databaseId,headSha,status`, then `gh run view <id> --json status,conclusion,jobs`. The tree was clean and pushed when this was written |
| Last sha confirmed green | **`16c00093a`**, run [`35936599580`](https://github.com/Luis85/renovation-planner/actions/runs/35936599580) attempt 2, `verify` ×4 plus `audit`, all success. It carries every `src/`, `styles/` and test change of this round. Read it by run id: `git diff --name-only 16c00093a..HEAD` should show only `docs/` files |
| `origin/main` | Merged into the branch mid-session at `0d9cdb142`, which brought main's `126f79589`: the `tests/build` → `tests/gates` rename, vitest 5 and fallow 3.26. Fetch and check `git merge-base HEAD origin/main` before assuming nothing has moved since |

## The next session's job: the manual vault walk

**Everything agent-closable in this package is done.** What is left is the deferred terminal pass,
which a person does in a real Obsidian vault (`npm run test-build` builds into this repository,
which IS a vault).

- **The index is [`MANUAL-PASS.md`](MANUAL-PASS.md): 182 human steps across seven cases.** It went
  from 145 to 182 this session. **Do not trust that number: run the command the index prints.** Last
  run, it gave `Design an Asset 82 · Take an asset from the library into a plan 19 · Compose an asset
  from parts 3 · Calibrate a sheet and reserve space 20 · Recover an asset design rather than lose it
  33 · Two designers on one asset 8 · Browse the asset library 17`.
- `Browse the asset library` is **newly counted**, because the Library Grid (AD18-R18) is the first
  change this package has made to it. `Notices and save state.md` had four rows rewritten for the
  relative save time and is **not** in the count, because it is a Plan Editor case.
- **A walk decides nothing on its own.** A step that fails against correct code is a step to fix, and
  a step that passes a defect is worse. Every expectation added this session was checked against
  source by an independent reviewer, but a reviewer of text is not a vault.

## What this session shipped (rulings AD18-R17, R18, R19)

A fresh audit of the harness against both concept boards, at 1280 and 460 px in both themes. It was
put to the user in two batched rounds: **fifteen of sixteen gaps were approved and `Preview in plan`
was declined**. Then eleven tasks, each implemented and independently reviewed, a final whole-round
review, and a fix wave. The plan is [`AD18-parity-round-2-plan.md`](AD18-parity-round-2-plan.md).

- **Three AD18-R16 defects the audit found**, fixed without a ruling:
  - the Placement `Custom` label broke mid-word at 1280;
  - the asset-card thumbnail drew a 0.07 px stroke;
  - resting dimension labels overlapped in 5 pairs at 460.
- **Toolbar:** icon-only at every width (one row at 1280 with a part selected, down from two), with
  magnifier zoom icons.
- **Context menu:** one separator. Group, Ungroup, Duplicate and Delete keys now work from any
  **selected** Parts row, never while typing.
- **Group re-nesting bug fixed:** group and detail ids are recycled, so a regrouped id used to be
  born collapsed (and a new graphic born hidden). Collapse, hide and lock state is now pruned for
  every id the design no longer has.
- **Selection inspector:**
  - a rounded rectangle **keeps its radius through a typed Width/Depth**, in the Inspector AND on a
    canvas dimension label;
  - a radius slider;
  - paired Position X|Y and Size W|D rows;
  - `Appearance` and `Order` folds;
  - a gap between number and unit on every field.
- **Front-direction picker** (Top, Right, Bottom, Left, plus a disabled `Custom`) with a mini preview,
  and a read-only **Source & scale** block ("Authored in millimetres", "Dimensions set").
- **Canvas key:**
  - a scale bar under the legend;
  - legend detail `Clearance (N mm)`, shown ONLY when all four sides are equal;
  - `Placement point (back centre | centre | custom)`;
  - the legend follows the drag preview.
- **Clearance:**
  - a `Show clearance` switch. Off hides the layer, presses on it, its right-click menu and its legend
    row, but Shift+1 fit still includes it;
  - an `All sides` field and an `Advanced` fold;
  - tracing a clearance, applying a preset or pressing Generate re-shows it.
- **Dimension lines:** arrows and extension lines. The overall width and depth stand OUTSIDE the
  footprint wherever the canvas has room, labels carry `mm`, there are zero resting overlaps at
  1280/760/580/460, and labels paint above the key.
- **Relative save time on BOTH surfaces** (AD18-R19): `Saved just now`, then `Saved N min ago`, then
  `Saved at HH:MM`. A screen reader hears `Saved` only.
- **Library Grid view BESIDE List** (AD18-R18):
  - List stays the default;
  - a category sidebar (all declared categories) that filters both views;
  - a funnel button, a `Create your own` card, a filter-aware count and empty state, and aria-label
    tooltips;
  - Amendment 7 to the library DESIGN-SPEC.
- **Harness knobs:** `?view=asset-designer&preset=<id>&stale` and `?view=asset-library&layout=grid`,
  with harness-shot entries and an axe scan over the Grid.

**Carved OUT by AD18-R17, as they would need a stored field or a schema change:** the `Shape` dropdown,
`Show direction in plan` and `Mark as needs verification`. **Declined:** `Preview in plan`.

## Known behaviour: the walk must NOT file these as new defects

Each is written into the manual pass as known behaviour, or as a "record what you see" step:

- **A canvas HANDLE resize of a rounded rectangle still drops its radius.** Typed edits keep it; the
  handle drag previews a non-uniform scale. This is an open item, deliberately outside AD18-R17.
- **A clearance comes back hidden** after a redo, an undo of its removal, or an external refresh while
  `Show clearance` is off. Switching it off mid-trace also keeps the commit hidden.
- **A hidden but selected clearance keeps its selection outline and handles**, and a handle drag
  still resizes it.
- **A hidden part that is deleted and then undone comes back visible.** Hiding is leaf-local view
  state.
- **`Saved at HH:MM` carries no date**, so past midnight it reads as today.
- **On Windows, arrow keys on a closed `<select>`** fire one edit per step. This applies to the front
  picker and every house select.
- **Dimension labels may travel up to about 133 px** from what they measure when crowded, measured by
  model. Judge on screen whether one still reads as attached.
- **At the zoomed-out default camera**, the overall depth label touches detail-1's width. The floor is
  set at the fit camera.

## Things only the walk can settle (no gate here can)

- **How the bare `<select>`s look in a themed vault.** The harness sheet styles none.
- **Screen-reader silence on the save indicator's minute tick** (NVDA or VoiceOver), and that the
  designer header announces only `Saved`.
- **Group focus after a successful Group from a Parts row.** The harness refuses every write, so it
  was never observed.
- **The two-line tile-name clamp and the 460 px toolbar** in a real theme.
- **Obsidian's own Ctrl+G** (graph view) against the designer's Group key.

## Still open, recorded rather than fixed

These come from the final review's triage; none blocks the walk:

- the `setTool` wrapper checks the requested tool id, not the tool that actually became active;
- the prune watcher could be `flush: 'sync'`;
- duplicated test helpers (`handed()`, `rightClick`, `VAULT_FAILED`), which fallow cannot see between
  test files;
- `DesignerSelectionInspector.vue` is at 403 raw lines and `dimensionFigures.ts` holds three placement
  rules;
- the German `Ankerpunkt` / `Platzierungspunkt` split predates this round;
- the `shape === null` arms in the clearance helper may be unreachable;
- `AssetLibraryContext.browse` is optional only for a test helper.

The full ledger is `.superpowers/sdd/progress.md` (gitignored, in this worktree).

## CI, and one flake worth knowing

Every task was pushed and read **by run id**, never by `gh run watch`'s exit code. Once, the Windows
leg alone went red on `tests/gates/network-boundary.test.ts` ("does not reach a repository outside the
two directories", a 5000 ms timeout). That is a main-owned gate that boots ESLint, and the commit it
failed on changed only comments. `gh run rerun <id> --failed` is the remedy, as CLAUDE.md's
ESLint-boot note predicts. **A red Windows leg on that file is not evidence about the change under
it.**

The one real red this round was **fallow health**: a template's cognitive complexity went to 16, over
the threshold. In fallow's output, the `Failed:` line and the `N above threshold` count are the gate.
The duplication `✗` and the "start with <file>" hint are not.

## This machine

7.8 GB RAM, **shared**. Check WHAT node processes are running before starting anything; the Codex
`cua_node` processes are not ours.

- Prefix every node-spawning command with `export TEMP=D:/tmp-claude TMP=D:/tmp-claude`.
- The harness (`preview_start "harness"`) must be **restarted after a card creates a new file**,
  because Vite caches a failed import resolve. A cold start takes 60–90 s before `.rp-plan-canvas`
  exists, so probes must wait for it and throw when a selector misses.
- The browser pane's screenshots time out when the window is hidden. Measure with
  `getBoundingClientRect` through `javascript_tool`. For a multi-selection or a save, drive the Pinia
  store: `document.querySelector('.renovation-asset-designer-view').__vue_app__.config.globalProperties.$pinia._s.get('assetDesign' | 'rp-save-state')`.
- **Never `git stash`.** The stack is shared across sessions.
- When two agents share this worktree, each stages **by explicit path only**.

## The rule this session paid for

**The integrator's browser measurement overturned a card's premise four times.**
- "There is no room outside the footprint": there were 30 px.
- A 40 px preview "works": it could not be read.
- Tile names "fit": three overflowed on Obsidian's `button { white-space: nowrap }`.
- "The sidebar is hidden only by width": it is hidden in List at any width.

**The reviews overturned a card's own tests twice.**
- A sweep that tested anchors the component no longer produced.
- A focus assertion that could not fail.

In every case the gates were green. **Measure what draws, and ask whether the test tests what ships.**
