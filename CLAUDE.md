# Renovation Planner — agent guide

An Obsidian plugin for planning a renovation: plans and zones, assets and quantities, costs,
trades, work packages and a schedule. The target architecture is
[`docs/sdds/obsidian-renovation-planner-SDD.md`](docs/sdds/obsidian-renovation-planner-SDD.md)
and the product intent is in `docs/prds/`. **Read the SDD before proposing structure**: it
has already refused things that look obvious from the code alone, and where this guide and
the SDD disagree, the SDD is the authority and this file is the bug.

Today the repository is a scaffold with two surfaces wired: the build, the gates, the
browser harness and the release pipeline work; the **Renovation project** view is
registered with a ribbon button and a command opening it; and the settings pane offers the
one setting there is. The view draws an empty mount point — that div is where the Vue app
goes (SDD §12), and nothing outside the view will know it is Vue. Requires Obsidian
1.13.0+.

**The settings pane is DECLARATIVE** (`getSettingDefinitions`, plus `getControlValue` /
`setControlValue`), which is what 1.13 renders from and what it indexes for the settings
search; `display()` is deprecated, is called only when the definitions are empty, and
`eslint-plugin-obsidianmd` fails the build for a tab with neither — a suppression is not
available, since the ruleset also forbids disabling its own rules inline. A setting is
added by returning one more definition; the read and write overrides are keyed generically
and need no branch per field.

**Both ends of a setting go through `settingsFrom`.** `data.json` is a file the user can
edit, so it is a trust boundary: a value outside the vocabulary falls back to the default
and a key this version does not declare is dropped, on the way in AND on the way out. A
cast at either end would be a second answer to what a setting is.

## Definition of done

```bash
npm run check   # build + lint + coverage-thresholded tests + fallow
```

All four must pass before committing; CI runs the same `npm run check`, verbatim, across
four legs — the same one command every one of them has to survive. Three are **Ubuntu**,
one per `engines.node` range this package declares (`^22.22.2 || ^24.15.0 || >=26.0.0`):
a declared range nobody actually executes on is the same defect `engines.node` itself
exists to catch, moved to a different file, so 22/24/26 all ride CI. The fourth is
**Windows**, at the floor only — a full OS × Node cross product would be six jobs for what
this earns, so the newer ranges ride the faster Ubuntu leg rather than tripling the slow
Windows one, while Windows still runs the version every platform must support. Paths and
line endings are the only things that differ between the two PLATFORMS, and both have
already produced a defect the project this harness came from could not see on one alone.

What each step refuses, because a step whose purpose is vague gets skipped:

- **build** — `tsc` first, then Vite. Also the stylesheet: the build fails on a partial no
  entry file imports, a line in `styles/index.css` the assembler cannot resolve, a partial
  over the 400-line cap, or a hard-coded colour — SDD §84 asks for an Obsidian CSS variable
  instead, so a themed vault stays themed. That check runs on `lightningcss`'s own parsed
  tree (already a devDependency, already used to minify this sheet), not on source text, so
  it sees every literal colour a declaration's VALUE resolves to, at any nesting depth,
  regardless of what a selector, an at-rule prelude, a comment or a quoted string contains —
  hex, `rgb`/`hsl`/`hwb`/`lab`/`lch`/`oklab`/`oklch`/`color()`, and (because the parser
  resolves a CSS NAMED colour to the identical node a hex literal produces) a bare word like
  `red`, on any property lightningcss's grammar fully parses. `device-cmyk()` is the one
  colour function the parser does not fold into that shape, so it is refused by name
  instead — the one function-specific case, not the general rule. What the check still
  cannot see: a bare colour WORD inside a raw token stream the parser leaves unresolved —
  a custom property's own value (`--accent: red;`) or an unresolved function's fallback —
  where a hex or `rgb()`-shaped literal is still caught generically but a bare word is just
  an identifier. `scripts/styles-assemble.mjs` carries the full account.
- **lint** — TWO linters in one step, because they refuse different things and neither
  subsumes the other. **ESLint** is where the architecture lives: the layer rule below is
  `no-restricted-imports`, and `no-restricted-syntax` carries the write boundary and
  `I18N_LITERAL_BAN` (`eslint.config.mjs` — `docs/requirements/Multilanguage.md`'s rule) —
  not prose. `I18N_LITERAL_BAN` is narrower than "every user-visible string": it refuses a
  literal at exactly FOUR call sites — `.setText(...)`, and the `text:` option of
  `.createEl(...)`/`.createDiv(...)`/`.createSpan(...)` — and passes a call to `t`/`tr`
  untouched, since that is a `CallExpression`, not a `Literal`, at the position it checks.
  It does not reach `new Notice('…')`, `addCommand({ name: '…' })`,
  `addRibbonIcon(icon, 'title', …)`, a `title` or `attr:` value, `el.textContent = '…'`, or
  a literal held in a variable first — today's actual UI text (settings `name`/`desc`, the
  command name, the ribbon title, `getDisplayText`) reaches none of those four call sites,
  so it is compliant by convention rather than by this gate — the same way the write
  boundary below names the spellings its selectors see and the ones they cannot, rather
  than claiming to see more. It also runs the Obsidian plugin guidelines
  and the size and complexity budgets. Warnings fail too (`--max-warnings 0`) — the
  mobile-safety rule reports as a warning, and `isDesktopOnly: false` is a promise.
  `manifest.json` itself is linted
  (`obsidianmd/validate-manifest`), so the marketplace naming rules are a gate, not a
  submission surprise. The ruleset is also kept ON inside the `no-console` carve-out for
  `src/infrastructure/logging/**`, which is what still fails `console.log`/`console.info`
  in the one directory `no-console` is off for. Switching it off there was available and is
  refused for a reason worth stating, because the obvious one is wrong: not that the
  ruleset forbids disabling its own rules, but that **the marketplace review bot lints
  with its own configuration**, so a local override would not travel and the rejection
  would arrive at submission rather than at `npm run check`. That guarantee rests on a
  wrapper (`rule-custom-message`) matching ESLint's own message text verbatim and
  reporting NOTHING on a miss, so `tests/build/logging-carve-out.test.ts` pins the two
  against each other — a reworded upstream message would otherwise turn the marketplace
  check off silently. **oxlint** runs first, in milliseconds, and adds the broad
  wrong-code ruleset ESLint never turned on, over a WIDER tree: the Obsidian ruleset is
  type-aware, so `eslint.config.mjs` stops it at `src/` and ignores `scripts/` and the
  root configs outright — which left `tests/` on 24 rules and the build scripts on none.
  Warnings fail here too (`--deny-warnings`), for the same reason. It is an ADDITION and
  not a migration: oxlint has no `no-restricted-syntax` at all (a config naming that rule
  is rejected outright, measured), no port of `eslint-plugin-obsidianmd`, and nothing
  type-aware. It does have `no-restricted-imports` and the budgets, so the layer bans are
  the one part that could move, and they stay where the rest of the architecture is.
  `.oxlintrc.json` carries which categories are on and what the other four cost, plus 29
  rules named one at a time out of the categories left off — a category is a bundle whose
  worst member decides whether the bundle is usable, and those four each hide a few rules
  about being WRONG behind a majority about being written differently. It also gives
  `scripts/` and the root configs the size and complexity budgets they had none of — the
  numbers `src/` already lives under, reaching the rest of the repository. **A rule is
  adopted while it reports nothing**: 27 of the 29 did, which is what made them one line
  each instead of a cleanup nobody schedules.
  It also mirrors ESLint's **`no-console`** and its `infrastructure/logging/**` carve-out,
  which is the one policy rule ESLint owned alone with nothing to notice its removal —
  and the mirror is what puts it in the EDIT LOOP, since `scripts/lint-edited.mjs` runs
  oxlint and only oxlint. Scoped to `src/**` by measurement rather than taste: at the root
  it reports nine findings across `scripts/`, where a build script printing to the console
  is correct. The mirror is not total, and the sentence has to say so — inside the carve-out
  ESLint still fails `console.log`/`console.info` through the obsidianmd wrapper, oxlint has
  no port of that ruleset, so exactly that case is invisible to the edit loop and is caught
  by `npm run check` and `tests/build/logging-carve-out.test.ts`.
  Two things about it are claims rather than rules, so both have checks. Its SCOPE: an
  `ignorePatterns` edit that drops a directory makes the gate quieter rather than redder,
  so `tests/build/lint-scope.test.ts` asks oxlint itself which files it lints and compares
  that against the tree. And its REACH: **no comment in a linted file turns a rule off.**
  Two halves, because the two linters read comments differently. ESLint takes
  `linterOptions.noInlineConfig`, which refuses the whole class — the disable directives
  AND the rule-CONFIGURATION form, a block comment reading `eslint some-rule: off`, which
  carries no directive keyword. That form was the real exposure: `no-restricted-syntax`
  and `no-restricted-imports` are ESLint-only, so one comment turned the write boundary
  off and oxlint could not have backstopped it. oxlint's half is a scan of the files it
  lints (`tests/build/suppressions.test.ts`) plus `reportUnusedDisableDirectives`, since
  nothing in ESLint's configuration reaches oxlint's directive handling. A rule that does
  not fit is turned off in `.oxlintrc.json`, where the reason is written down and review
  sees it.
- **test:coverage** — the suite plus the coverage floors. `src/` measures 100% of all four
  metrics today; the floors sit a covered unit below that, which at this denominator is
  several percentage points. `vitest.config.ts` carries the arithmetic and the ratchet
  policy: floors only rise, and they rise to what a FINISHED increment measures. The suite
  includes `tests/harness/accessibility.test.ts` — axe-core driven in jsdom against the
  real mounted view (`mountHarness`, not a fixture), checking roles, accessible names,
  form labels, heading order and ARIA attribute validity. Read its header before trusting
  the word "accessibility" any wider than that: it does NOT verify colour contrast, a
  visible focus indicator or hit-target size (jsdom has no rendering engine to measure any
  of the three), nor page-wide structural rules like duplicate ids or landmark uniqueness —
  and those two are not the same mechanism: `duplicate-id` is deprecated and disabled by
  default in this axe-core version, so it is invisible here independent of scope — it
  fires correctly at BOTH `contentEl` and whole-document scope once force-enabled, so
  scoping is not why it is missed today. The landmark rules (`region`, `document-title`,
  `html-has-lang`, …) are the ones actually scope-dependent, needing whole-page context
  this file cannot give them because it scans `contentEl`, the plugin's own subtree, not
  the whole document. A live vault (`npm run test-build`) remains the only place
  appearance is verified.
- **analyze** — fallow: dead files and exports, duplication, complexity against coverage,
  and dependency hygiene.

`npm audit` is deliberately NOT in `check`: an advisory with no patched version is a red
nobody can clear, and a gate people learn to ignore protects nothing. It is its own CI job.

Obsidian itself cannot run here. Three commands stand in, and none replaces another:

- `npm run harness` — a Vite dev server drawing the real view against the real stylesheet
  and **Obsidian's own app.css**, in a browser, with no Obsidian. Faithful about markup,
  spacing, hierarchy and Obsidian's DEFAULT colours — including the leaf chrome Obsidian
  nests around every view (`.workspace-leaf-content[data-type]` → `.view-header` +
  `.view-content`), which the fake `ItemView` in `tests/helpers/obsidian-mock.ts` nests the
  same way, checked against the real selector `styles/chrome.css` declares by
  `tests/harness/harness.test.ts` rather than assumed. Not faithful about a themed vault's
  colours, its accent, or any element default the vendored sheet's reduction dropped — it
  was reduced against another plugin's driven states. Say so honestly rather than letting
  "faithful" read wider than it is.
- `npm run harness-shot` drives that same page headlessly (`playwright-core`, a Chromium
  binary resolved from disk rather than a hard-coded revision) and writes a PNG per colour
  scheme plus `?phone` to a gitignored `harness-shots/` folder — a look at rendered layout,
  which jsdom cannot produce at all and which is how a real defect (the view collapsing to
  a sliver of its pane, invisible to a suite that draws nothing) was found in this plan.
  It draws and asserts nothing itself and there is no baseline to diff against, so like
  `npm run harness` it is deliberately outside `npm run check` and outside CI.
- `npm run test-build` — builds into `.obsidian/plugins/<id>/` in this repository, which IS
  a vault. Naming this is a shorter ask than "please set up a vault", and it is the only
  way appearance and any assumed API get verified.

## Architecture

The SDD's layers (§8), and each may reach anything below it and nothing above:

```
presentation → application → domain → core
infrastructure → application (its ports) → domain → core
plugin/ composes all of them, and is the only layer that may
```

`eslint.config.mjs` enforces that with per-directory `no-restricted-imports`, so a violation
fails `npm run lint` rather than waiting for review. It also bans **`vue`, `pinia`, `konva`
and `obsidian` by name** in `core/`, `domain/` and `application/` — the SDD's §3.4, and the
architecture test its §76 asks for. `infrastructure/` may name `obsidian`; that is its job.

Two rules that follow from it and are worth stating because breaking them is cheap:

- **A type belongs with the code that PRODUCES it, not the code that consumes it.** A type
  placed with its consumer makes the pure layer depend on the effectful one.
- **Nothing writes to the vault outside `infrastructure/`.** The layer bans already keep
  `obsidian` out of the inner layers, so `no-restricted-syntax` rules on the write calls
  (`WRITE_BOUNDARY` in `eslint.config.mjs`) catch the case they cannot see: a write from a
  view, a Bases adapter or the composition root, bypassing the repository that owns the
  file format. The config names the spellings those selectors see and the ones they cannot.
- **One action, every input.** A ribbon click, a command and whatever a toolbar adds later
  call ONE function — `revealView` is the first of them. Adding an input means calling that
  function, never re-deciding beside it; a second entry point with its own activation looks
  correct alone and opens a duplicate tab the moment a user uses both. `infrastructure/`
  takes the view type as a STRING for the same reason it takes anything: it may not reach
  `presentation/`, and the composition root is what knows which view it is wiring.
- **A view type and a command id are DATA, not text.** Obsidian persists the first in the
  workspace layout and binds a user's hotkey to the second, so renaming either orphans
  something a user has. The display names beside them are text.

There is deliberately no list of modules here. `src/` is the list and it cannot go stale.

Build artifacts go to `dist/` and nothing is written to the repository root — `vite.config.ts`
says why, and it is a real constraint rather than taste. Everything `npm run` invokes lives in
`scripts/`, except the configuration files a tool finds by NAME at the root — the eslint,
vitest, Vite (build and harness), TypeScript, fallow, npm and editor configs — and every
script resolves its paths from the WORKING DIRECTORY rather than from its own location.

## The linter in the edit loop

`.claude/settings.json` runs `scripts/lint-edited.mjs` after every Edit and Write, which
lints THAT ONE FILE and hands the agent whatever oxlint says. About 90ms, against
`npm run check` several turns later — and by then the reasoning that produced the defect
is gone, which is the whole reason to move the cheap half earlier.

**It does not prevent the edit and it does not roll one back**, and every description of it
has to say so. `PostToolUse` runs AFTER the tool has written the file — Claude Code's own
table reads "Shows stderr to Claude; the tool already ran". Only `PreToolUse` blocks, and
only for a payload it can lint before the write: a `Write` carries its whole content, an
`Edit` carries a fragment whose result would have to be reconstructed first. That is the
trigger for revisiting the mechanism; it is not a reason to describe this one as more than
it is. (This paragraph exists because the first version of it claimed otherwise, and a
review bot caught it against the reference in `.claude/skills/impeccable/`.)

Three properties it is built to have, each with a test in `tests/build/lint-edited.test.ts`:

- **It exits 2, not merely non-zero.** Neither code stops anything here, but 1 shows stderr
  to the USER and lets the agent carry on unaware, while 2 hands the findings over as a
  tool error the agent has to answer for. That is who gets told, not whether it happened.
- **It fails OPEN on its own bugs** — unreadable input, no file, a missing linter. A hook
  that failed closed would answer every edit in the session with an error about the hook
  rather than about the code, and the gate still catches what the hook missed.
- **The wiring is checked, not assumed.** The hook only runs because the settings name it;
  a renamed script leaves that pointing at nothing and edits silently stop being checked.

It sees ONE file, so it cannot see a layer violation's other end, a type error, a dead
export or anything ESLint owns. `npm run check` is still the definition of done, and
nothing here is allowed to read as if it were.

## Testing

`tests/` mirrors `src/`. Pure logic gets node tests — a rule about a quantity, a cost or a
zone is asked of a function, never of a screen, which is the whole return on the layering.
DOM code gets jsdom, per file. The `obsidian` module is aliased to one small mock that the
suite, the harness and nothing else share.

**Known limits of the fakes**, so nothing trusts them wider than they are: the module mock
models only the members something drives, and its `getLanguage()` always answers `'en'` —
a call site resolving the language wrongly is invisible to the suite, which is why `t` is
pure and driven per locale directly. `FakeLeaf`/`FakeWorkspace` RECORD asks rather than
behave. The DOM helpers install only `createEl`, `createDiv`, `empty`, `setText`. And
nothing type-checks `tests/**` (vitest transpiles without checking; tsconfig covers `src/`
only), so an `implements` there binds the editor, not the gate.

- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. On one pull request in the
  source project, six of ten review findings were comments precisely stating the rule the
  code beside them broke. A confident paragraph is evidence of intent and of nothing else.
- **A fake must not be kinder than the real thing — and not thinner either.** A DOM helper
  that accepted what Obsidian rejects shipped a dead drag target while every test and the
  browser harness drew it happily; too kind. A fake `ItemView` that never nested a
  `.view-header` inside `.workspace-leaf-content` the way Obsidian does left
  `styles/chrome.css`'s own selector nothing to match and the harness's growth chain
  nothing to key its `:last-child` rule off, collapsing the browser harness to a sliver of
  its pane — too thin, and invisible to the suite either way, since neither defect touches
  a property jsdom draws or an assertion checked. Where a fake cannot be made strict, ban
  the tolerated spelling at the call site — `SVG_CLASS_TOKENS` in `eslint.config.mjs` is
  that shape. Where a fake is too thin, the fix is a fake that actually nests what the real
  thing nests — `ItemView` in `tests/helpers/obsidian-mock.ts`, since the harness-collapse
  fix.
- `tests/**` has a larger line budget than `src/**`, not none. The one suite without a cap
  is the one that grows into the place tests hide.

## Claims, and the checks under them

Every rule here was broken in the project this harness came from, several inside the change
that was fixing the previous instance.

- **Write the guarantee to the check, never ahead of it.** When a check cannot reach the
  whole claim, narrow the sentence rather than leaving the wider one standing. A guide that
  promises more than lint and the suite deliver is the same defect as an unchecked comment,
  and harder to catch because it reads as settled. If narrowing makes the sentence ugly, the
  sentence has become honest and the ugliness is the information.
- **A category invariant is checked at the forbidden thing, not by listing the places.**
  "Nothing does X" cannot be verified by driving the paths someone thought of; the next path
  is the one that breaks it. Put the check on the call — a lint rule, or a spy on the call
  itself — so it holds for code not yet written, and name the spelling it does see.
- **Measure a set with an instrument that can see all of it, and test the instrument
  first.** A grep for `foo(` misses `foo<T>(`. Both happened there, and both times the wrong
  count was already being used as the evidence for a decision.
- **Address code by name, not by position.** Selectors, symbols and paths survive an edit;
  line numbers are correct until the next insertion above them.
- **A table that enumerates code goes stale; a table that states a rule does not.** Name a
  module only where the sentence is *about* that module.

## Gotchas

- The `obsidian` devDependency is pinned to the FLOOR **exactly** (`1.13.0`), not to npm's
  newest and not to a range over it, so the compiler refuses an API `minAppVersion` does not
  promise. `tests/release/manifest.test.ts` holds that pairing. Raise both or neither.
- **`engines.node` is a RANGE, and a measurement rather than a decision.** Every dependency
  renegotiates it silently. `>=22` was already false before oxlint arrived, and the obvious
  repair — raise the floor — was still wrong at the other end: eighteen installed packages
  support `^22.x` and `>=24` while excluding Node 23, so any unbounded floor claims a
  runtime the toolchain refuses. **A bound is not a range**, and a check that reads one
  bound only finds the defects living at that end.
  `tests/build/engines.test.ts` compares the whole declared range against every installed
  package with npm's own `semver.subset` — the instrument that decides this in reality is
  the one that should decide it here. What it cannot see: a constraint stated anywhere but
  `engines.node`, and a package this platform did not install.
- `@types/node` tracks the `engines` floor, never npm's newest — as closely as npm allows,
  which is not exactly: the floor is `22.22.2` and `@types/node` stops at `22.20.1` on the
  22 line, so `^22.20.1` is the nearest thing that exists. TypeScript upgrades are
  bounded by what `typescript-eslint` declares as a peer — losing lint is the cost.
- **Vite's minifier strips every comment**, legal ones included — measured, both as
  `output.banner` and in the source. There is no source-pointer banner on the bundle for
  that reason; `vite.config.ts` says where the pointer lives instead.
- `output.exports: 'named'` in `vite.config.ts` is about Obsidian's loader, not bundling: it
  produces the `exports.default` shape esbuild gave every plugin built from the sample repo.
  Which shape Obsidian accepts cannot be checked here, so it takes the one with a record.
- Two flat-config blocks matching one file **override** `no-restricted-syntax` rather than
  merging it. A per-directory block that forgets to repeat the shared selectors silently
  drops every one of them.
- **PowerShell 5.1 writes a BOM** (`Set-Content`/`Out-File -Encoding utf8`), and
  `JSON.parse` refuses one — a BOM'd `manifest.json` broke every lint run here once, with
  an error pointing nowhere near the cause. Write files with node or an editor;
  `tests/build/encoding.test.ts` refuses the BOM either way.
- Fallow resolves an interface's members through an **explicit type annotation**, not a
  property access: annotate the local (`const x: PortType = …`) rather than reaching for
  `usedClassMembers`, which is for members a framework invokes and would hide a dead one.
- Marketplace rules (enforced by `npm run lint` plus review): sentence-case UI text, no
  special characters in the manifest description, no inline styles, `normalizePath` on user
  paths, no global `app`. The recurring rejections are listed in `docs/setup/publishing.md`.
- Release tags equal the `manifest.json` version with NO `v` prefix (`.npmrc` sets
  `tag-version-prefix=""`), and `CHANGELOG.md` gains its dated section in the same pull
  request as the bump, as a second commit — `npm version` refuses a dirty tree. Both are
  checked (`tests/release/`), and the whole procedure is [`RELEASING.md`](RELEASING.md).
  The release workflow refuses to publish a commit `main` does not contain or whose CI
  run is not green — the "Require a green CI run" step in
  `.github/workflows/release.yml`. That guard matches CI's job by the name `verify`;
  renaming the CI job means updating the guard in the same edit, or every release times
  out waiting for a check that never reports.

## Deliberately absent

Not oversights; each has a trigger.

- **Vue, Pinia, Konva, zod, decimal.js, dayjs.** Installing a dependency nothing imports
  fails `npm run analyze`, so each arrives with its first real use. `@vitejs/plugin-vue` is
  one line in EVERY config that transforms source — `vite.config.ts`,
  `vite.harness.config.ts` and the standalone `vitest.config.ts`, which is three here, not
  the two a generic project has — and `tsc` becomes `vue-tsc` in the same edit.
  [`docs/setup/vue-conventions.md`](docs/setup/vue-conventions.md) carries the conventions
  and the lint rules that enforce them, but it was written against a project with two Vite
  surfaces and names neither `test-build` nor the coverage include. The full contract for
  that arrival, as a superset of it and scoped to the gates this repository actually has,
  is design slice 1's Vue arrival checklist
  ([`docs/tasks/01-plugin-bootstrap-and-composition-root.md`](docs/tasks/01-plugin-bootstrap-and-composition-root.md)).
- **The empty layer directories the SDD draws.** Git cannot hold them and lint already
  guards them; create one when a module goes into it.
- **`eslint-plugin-oxlint`.** It switches off the ESLint rules oxlint already covers,
  which on `src/` is most of core `recommended`. Two linters agreeing is not a defect —
  one fix satisfies both, and neither list can quietly become a rule's only owner.
  Thinning one to speed up the other trades a gate for seconds. Add it when ESLint's
  runtime is a cost somebody can name.
- **`oxlint --type-aware`.** It needs `oxlint-tsgolint`, and the type-aware rules this
  project actually leans on — `no-floating-promises`, the Obsidian ruleset — already run
  under ESLint's project service. Add it for a type-aware rule ESLint does not have.
- **A `docs/` register gate** (`npm run docs` in the source project: every wikilink
  resolving, every module specified by a note, opt-in claim citations). Add it when `docs/`
  has a convention worth enforcing — see section 5 of `docs/setup/quality-harness.md`.
- **`npm run perf`** and the icon renderer in the harness. The first needs a render cost to
  argue about; the second needs the first `setIcon` call, and until then every icon would be
  an invisible gap in the tool built for looking.
