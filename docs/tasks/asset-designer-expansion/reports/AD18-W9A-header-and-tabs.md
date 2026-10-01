# Task report — AD18 / wave 9 card W9-A

Outcome: **implemented**
Owner / worktree / branch: worker agent · `.worktrees/ad08r` (reused) · `ad18-header-and-tabs`
Base / candidate: `0dae63514` / `82bac96d8`, fix round `b74a40f71`
Accepted contract revision: `r1`, plus rulings **AD18-R1** and **AD18-R2**, both taken by the user
before the code
Integrated: **`f0500806b`**

Two of the eight concept-fidelity gaps: **item 2**, the restrained header — which is **AD06
implementation item 1**, re-opened the same day because it had never been built — and **item 4**,
the tabbed Inspector.

**The first `src/` card in three waves**, which changed what the lease could rest on: waves 7 and 8
were test-only and both leaned on "a test adds coverage and can never subtract it". A new `v-if` is
a new branch, and the margin was about sixteen uncovered branches for the whole repository.

## Changed files and reason

| File | Purpose | Within lease? |
|---|---|---|
| `src/presentation/designer/DesignerHeader.vue` | **New.** Name, library return, save state, Use in plan | yes (CREATE) |
| `src/presentation/designer/AssetDesignerRoot.vue` | Mounts the header as a shell region | yes |
| `src/presentation/designer/inspector/DesignerInspector.vue` | Drops the name and both doors; gains the tab control | yes |
| `src/presentation/designer/inspector/DesignerUsageScope.vue` | Stale mount-site count corrected | yes — **granted mid-round** |
| `styles/designer-header.css` | **New partial.** `designer.css` was at 397 of its 400-line cap | yes (CREATE) |
| `styles/designer.css`, `styles/index.css` | Tab styling; the import the new partial requires | `index.css` **granted retroactively** — see the lease note |
| `src/presentation/i18n/locales/{en,de}/assetSymbols.ts` | New keys, both locales | yes |
| six files under `tests/presentation/designer/` | Two new suites, four amended | yes; `designerUsageScope.test.ts` **granted mid-round** |

## Acceptance coverage

| Criterion | Result | Evidence |
|---|---|---|
| A restrained header carrying all four things AD06 item 1 names | **met** | `DesignerHeader.vue`; `assetDesignerRoot.test.ts`'s `REGIONS` list gains `.rp-designer-header` |
| No account, logo, compass or marketing chrome (C12) | **met** | Four elements and nothing else |
| **AD18-R1** — the header owns the name, the Inspector drops its copy | **met** | `renders the asset's name exactly once…`, asked in rendered TEXT rather than at a class |
| AD18-R1's required check — the usage scope still reads as being about the asset | **met, and now PINNED** | See below |
| **AD18-R2** — two tabs, `Object` and `Reference`, no `Style` | **met** | `draws exactly two tabs, Object and Reference` |
| **AD18-R2's central trap** — the clearance review must stay with the clearance block | **met** | `keeps the clearance review in the same panel as the clearance block` collects EVERY `.rp-designer-clearance`, guards `length > 1` against a vacuous pass, requires all inside the object panel. The reviewer verified it is a category check rather than two remembered component names |
| `design !== null` still gates the Inspector, keeping the region empty for a loading or failed leaf | **met** | Gate unmoved on the `<DesignerInspector>` element; `leaves the inspector region empty, with no tab strip in it` drives the real root with refusing queries |
| The tab control joins the existing keyboard model | **met, with a stated cost** | Calls the shared `rovingIndex` with `horizontal: true` — the same function `DesignerPartsPanel` and `AssetPresetForm` use. See the cost below |

**AD18-R1's check is no longer prose.** The ruling obliged the mover to verify the usage-scope block
still reads as being about the asset with the name gone. The argument was correct in the template
and *nothing asserted it*, so inserting a block between the `Asset` `<h3>` and `<DesignerUsageScope />`
would have stayed green. A case now pins the previous element sibling, watched failing by wedging a
paragraph between them:

```
AssertionError: expected 'P' to be 'H3' // Object.is equality
```

## Executed checks

| Check | Commit | Result |
|---|---|---|
| `npx vitest run tests/presentation/designer tests/harness` | `b74a40f71` | 0 — **99 files, 1319 tests**, including every axe scan over the new tabpanels and the labelled header landmark |
| `npx oxlint src tests styles scripts` | `b74a40f71` | 0 |
| `npx eslint` over the touched trees | `b74a40f71` | 0 |
| `npx vue-tsc -noEmit` | `b74a40f71` | 0 |
| `node scripts/styles-assemble.mjs` | `b74a40f71` | clean |
| Scoped coverage, per changed file | `b74a40f71` | below |
| Independent review | `82bac96d8` | **APPROVE conditional** — six MUST, three decisions, several observations |
| **Rendered in a real browser** | `f0500806b` | integrator; see `AD18-concept-fidelity.md`'s own section |

### Coverage, per changed file — the claim the reviewer checked hardest

`DesignerHeader.vue` 100 % statements, functions and branches (7/7). `DesignerInspector.vue`
97.37 / 95.00 / 97.67, uncovered statement **140**, function **140**, branch **153#1**.
`AssetDesignerRoot.vue` 99.12 / 100 / 98.18, uncovered statement **266**, branches **266#0** and
**348#1**.

**All five remaining arms are pre-existing and untouched, and this was verified twice.** The
reviewer reproduced the scope independently and mapped every one against `git diff -U0` hunk
boundaries: `DesignerInspector` changed at 74–78 and 170+, so new 140/153 are old 145/158;
`AssetDesignerRoot`'s script is net-zero-shifted and its first changed line is 463. The integrator
separately confirmed none of the four source lines appears as an addition in the diff. **Nothing
added by this card is uncovered.**

## Three things the card corrected in its own record rather than defending

1. **The branch arithmetic was reported as "net down" and is net +1.** Measured with
   `git show 0dae63514:…/DesignerInspector.vue | grep -c "v-if"` → 6 against 5 now: the only `v-if`
   that left is `openLibrary`'s, because the name was a plain `<p>` and `DesignerUsePlan` had none.
   Against that the strip adds a `:tabindex` ternary and a `next === undefined` guard. The outcome
   is unaffected — every added arm is covered — but the reasoning is not what the record now says.
2. **The `<h1>` became an `<h2>`.** `grep -rn "<h1" src/` prints no element in the entire tree;
   starting at `h2` is the house convention, and `ProjectDetail.vue`, the closest analogue, names
   its own subject at `h2`. One plugin leaf claiming `h1` beside Obsidian's own markdown `h1`s is a
   divergence. Outline now: h2 asset → h2 parts → h2 inspector → h3 Asset → h4 Used in plans.
3. **Three count-and-"only" sentences** the diff itself authored were wrong and are rewritten from
   the grep output: "the four suites that mount this inspector bare" is **five** of six mount sites,
   and "this one region mounts its component unconditionally" is **two** — the toolbar does too.

## The ArrowUp/Down cost, stated rather than denied

`rovingIndex(…, horizontal: true)` consumes ArrowUp and ArrowDown as well as Left and Right and
`preventDefault`s them. The APG's horizontal tablist takes Left/Right/Home/End only, so the strip
swallows two keys it should not — on a rail whose whole problem is that it scrolls.

**It cannot be told otherwise**: the signature is `(key, from, length, horizontal)` and the flag only
ADDS Left/Right to the Up/Down it always takes. Narrowing it means a third parameter on a function
two other callers share, or a hand-rolled index here — both changes to code this card does not own.

Bounded honestly: the handler is on the tablist, so the keys still scroll from anywhere else in the
panel, and Page Up/Down, Home/End on the panel and the wheel are untouched. The new panel
`tabindex="0"` reduces it further — arrow-scrolling the rail is one Tab away. **Recorded as a cost
for a follow-up rather than smuggled in.**

## Verification not performed

- **`npm run check`, full `test:coverage`, `npm run analyze`** — not run by the worker or the
  reviewer. Another session held this 7.8 GB box with its own full gate throughout, and CLAUDE.md's
  rule is that parallel agents run narrow while the full gate runs in CI.
- **`npm run analyze` is the ONE instrument for a live question**: whether the new
  `styles/designer-header.css` flat-button block is a reportable clone at all, and whether the
  `fallow-ignore-next-line` now sits on the right line. The review found it followed the wrong one
  of this repository's two shipped directive patterns — where a leading declaration precedes the
  cloned run, the directive moves INSIDE, above the declaration where the clone starts
  (`designer.css`'s `.rp-designer-edit-dimensions` says so in as many words). It was moved. **A
  misplaced directive is reported STALE while the finding goes on counting**, so this plausibly
  reddens `analyze` twice if it is still wrong. **Confirm with one run.**
- **The mutation reds are the worker's own**; a reviewer may not edit, so it checked each for
  arithmetic consistency against the code instead.
- **`npm run harness-shot`** — no pinned Chromium (`playwright-core` pins 1234, cache holds 1223).
- **Appearance was NOT unverified in the end**, unlike every earlier card here: the integrator drew
  both surfaces in a real browser. What remains unrenderable by any instrument is the header WITH
  its two buttons, because `tests/harness/assetDesigner.ts` binds neither door — measured by
  injecting them as a probe, which proves what the layout does and does not put them in a capture.

## Found and not fixed

1. **`styles/designer-object.css` carries a dead rule** — `.rp-designer-inspector .rp-designer-asset-name`
   matches nothing now, and that file's header still describes the block as "which asset this is,
   the way back to the catalogue". Out of the card's lease; disclosed in the new partial's header.
2. **The Reference tab panel is EMPTY for an asset typed from dimensions with no sheet**, because
   `DesignerReferenceStatus`'s own `relevant` predicate draws nothing in that state. This is a
   weaker form of exactly what AD18-R2 refused a `Style` tab for. The honest fix is one muted line
   inside that component — duplicating its predicate in `DesignerInspector` would be a second answer
   to "is there a sheet" — and that file is outside the lease. **Recommend granting it to a
   follow-up card.** The panel `tabindex="0"` added this round means a keyboard user at least lands
   somewhere focusable.
3. **The header adds a row of height to the shell** and `designer-narrow.css` is untouched. Whether
   it should collapse or wrap at a sidebar leaf is a proportion question AD18 item 6 already owns.
4. **`styles/designer.css` is at 397 of the assembler's 400-line cap.** Three more lines there fails
   `npm run build` rather than a test. This card correctly created a partial instead; the next one
   must too.
5. **`designer.inspector.open-library` is now read by the header.** A locale key is not data a user
   binds to, so renaming is free, but leaving it means the next author greps `designer.inspector.`
   for the Inspector's strings and gets a header one.
6. **Seven manual steps were falsified** and are the integrator's, fixed at `d4a0cea4d`.

## Reviewer and integrator acceptance

Reviewer: **APPROVE conditional**, six MUST plus three decisions it correctly refused to take alone.
All applied in `b74a40f71`. Lease verified by the integrator: every file in the fix-round diff is
inside the grant, `docs/` untouched, worktree clean.

Integrated commit: **`f0500806b`**. AD06 returns to `integrated` with its item 1 delivered.
