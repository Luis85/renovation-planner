# Setup guide — test and quality harness

Audience: an AI agent that must build this project's quality harness from nothing.
Source: the harness in `product-backlog-view`, reduced to what transfers.

The goal is **one command that is the definition of done**, and five gates under it that
each refuse a different kind of defect. Read the whole file before you write anything: the
last section is the part that makes the rest hold, and it is the part usually skipped.

Assumed stack: TypeScript on Node 22+, npm, vitest. Where the stack differs, the
**adapt** notes say what the rule is about, so you can keep the rule and change the tool.

---

## 0. The shape

```
npm run check   # build + lint + coverage-thresholded tests + dead code + docs
```

Five steps, one command, no step optional and no step allowed to warn instead of fail.
CI runs the same five steps and nothing else, so "green locally" and "green in CI" mean
the same thing. Anything that cannot be satisfied by the commit being written — an
`npm audit` advisory with no patched version, for example — is **not** in `check`. It is
its own CI job, because a red nobody can clear teaches people to ignore red.

Build these in order 1 → 5. Each step is useful alone; stop wherever the value stops.

---

## 1. The gate and CI

`package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsc -noEmit -skipLibCheck && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "analyze": "fallow",
    "docs": "node scripts/docs-check.mjs",
    "audit": "npm audit --omit=dev --audit-level=critical",
    "check": "npm run build && npm run lint && npm run test:coverage && npm run analyze && npm run docs"
  }
}
```

Rules that go with it:

- **Everything `npm run` invokes lives in `scripts/`.** The exceptions are the files a
  *tool* finds by name at the root (`eslint.config.mjs`, `vitest.config.ts`, `vite.config.ts`).
- **Every script resolves paths from the working directory**, not from its own location.
  npm scripts and vitest both run from the repository root. State this once, in the one
  script where the difference bites.
- Pin a host-platform devDependency to the **floor exactly** if you compile against its
  API. A range over the floor lets the compiler accept an API your published minimum does
  not promise.
- `@types/node` tracks the `engines` floor, never npm's newest.

`.github/workflows/ci.yml` — two jobs:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false          # both legs report; you need to know WHICH platform failed
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run analyze
      - run: npm run docs

  audit:
    runs-on: ubuntu-latest      # one platform: an advisory is a fact about the lockfile
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm run audit
```

**Two operating systems is not caution, it is coverage.** Path separators and line
endings are the only things that differ, and both have produced a defect the source repo
could not see on one platform: a checker that reported `docs\adrs\…` where its corpus
expected `/`, and the same checker reading a CRLF checkout as a file with no frontmatter
at all. With one entry in the matrix, neither was visible.

---

## 2. Tests and the coverage ratchet

`vitest.config.ts` at the root:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],        // registration glue that needs the real runtime
      reporter: ['text-summary', 'json', 'lcov'],
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
});
```

Set the four thresholds to the **first measured run**, then treat them as a ratchet.

The policy, which matters more than the numbers:

1. **Thresholds only ever go up.** Never lower one to accommodate a change. If a change
   drops coverage, the change is missing a test or is carrying dead code.
2. **Record what the FINISHED increment measures, not a mid-flight figure.** A number
   taken in passing fails the next run, because refactoring later in the same increment
   deletes covered branches and moves the ratio.
3. **Set each floor at least one covered unit BELOW the measurement.** A floor set to the
   exact measured figure fails on a legitimate change that removes one branch — the
   numerator and the denominator fall together, so deleting fully covered code lowers the
   ratio. Compute one unit per metric: `1 / total * 100`.
4. **A coverage failure is first a question about which branch nothing can take.** Look
   for the dead branch before you write the test. Deleting an unreachable arm raises the
   figure on a smaller denominator.
5. **Expect the figure to be non-reproducible in the last hundredth**, and do not chase it
   with run counts. In the source repo, runs on an unchanged tree differed by exactly one
   covered statement and one covered branch, and the two CI platforms differed the same
   way. Four agreeing runs is not evidence a 1-in-3 flake is gone. Put the floor under the
   **lowest** figure any environment has reported.

Test layout — `tests/` mirrors `src/` directory for directory:

- Pure logic gets **node** tests: a rule about ranking, scope or placement is asked of a
  function, never of a screen. That is what makes a pure layer worth having.
- DOM code gets **jsdom** tests, and each such file installs its own environment.
- The platform module (an SDK, `vscode`, a host app) is **aliased to a small mock** in
  `vitest.config.ts` `resolve.alias`. Keep the mock minimal; extend it when new API
  surface is used.
- `tests/helpers/` holds the fakes: the platform mock, a fake filesystem or vault that
  records writes, and one shared view harness (`makeView`, `refresh`, `fixture`, `drag`,
  `key`, `flush`) that every view test imports.
- **A fake must not be kinder than the real thing.** The source repo's SVG helper accepted
  a space-separated class string where the real API throws; the suite and the browser
  harness both drew the broken markup happily, and it shipped a dead drag target in a real
  install. When a fake cannot be made strict, ban the tolerated spelling at the call site
  with a lint rule — a faithful fake only catches a path some test drives.
- Write down the harness's known limits where an agent reads them — this repository keeps
  them in the Testing section of the root `CLAUDE.md` — and keep them honest. Example that
  cost a deleted test: such a note claimed for months that the fake caches were static,
  when in fact a write was visible to the rebuilt model.
- `tests/**` gets a **larger** line budget than `src/**`, not none. The one suite without a
  cap is the one that grows into the place tests hide.

**adapt:** jest or `node:test` instead of vitest changes nothing above. The ratchet, the
fake-strictness rule and the mirror layout are the content.

---

## 3. Lint as architecture

Lint is where **category invariants** live: "nothing does X" cannot be checked by driving
the paths someone thought of, because the next path is the one that breaks it. Put the
check on the forbidden thing itself.

`eslint.config.mjs` at the root. Three kinds of rule:

**a. Layering.** Declare the layers, then make each one's forbidden imports a rule:

```js
const forbidden = (layer, groups, reason) => ({
  files: [`src/${layer}/**/*.ts`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{ group: groups.flatMap((g) => [`**/${g}/*`, `**/${g}/**/*`]), message: reason }],
    }],
  },
});
```

Outermost first; each layer may reach anything below it and nothing above. A layering
documented only in prose is one commit away from being wrong.

**b. Boundary bans.** Name the calls that may appear in exactly one directory, and ban
them everywhere else with `no-restricted-syntax`:

```js
{
  selector: "MemberExpression[property.name='processFrontMatter']",
  message: 'Writes belong in storage/. See src/storage/CLAUDE.md.',
}
```

"Everything that puts bytes on disk is in one directory" is only a fact if a rule says so.
Reading the directory shows what is inside it, never that nothing outside writes.

**c. Budgets**, on `**/*.ts`:

```js
'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
complexity: ['error', 16],
'max-depth': ['error', 4],
'max-params': ['error', 5],
```

`tests/**` overrides `max-lines` to 450. A pure data file — a message catalog — may switch
`max-lines` off; nothing else may.

Two traps in flat config:

- **Two blocks matching one file OVERRIDE `no-restricted-syntax`, they do not merge.** A
  per-directory block silently drops every ban from the general `src/**` block. Compose
  the selector lists in JS and spread them into each block.
- Anchor `files`/`ignores` patterns on `**/` (`'**/tests/**'`), not on the repository root.
  Patterns match against the linter's base path, and an editor's ESLint server need not
  put that where the CLI does. A type-aware rule then meets a file the tsconfig does not
  cover.

Type-aware rulesets that are about *shipped* code stop at `src/`. The test doubles exist
precisely to do what those rules forbid.

**adapt:** any linter with per-path config and an AST selector rule works. Without AST
selectors, a small grep gate in `scripts/` is the fallback — but state honestly which
spellings it can see, and test the gate itself.

---

## 4. Dead code, duplication, complexity, dependencies

`npm i -D fallow`, then `.fallowrc.json`:

```json
{
  "entry": ["src/main.ts"],
  "dynamicallyLoaded": ["styles/**/*.css"],
  "health": { "coverage": "coverage/coverage-final.json", "ignore": ["tests/**"] },
  "rules": {
    "unused-dev-dependencies": "error",
    "unused-optional-dependencies": "error",
    "unused-class-members": "error",
    "private-type-leaks": "warn"
  },
  "overrides": [{ "files": ["tests/**"], "rules": { "unused-class-members": "off" } }]
}
```

It runs after `test:coverage` in `check` because it reads the coverage file to compute
CRAP — complexity weighed against coverage.

- **A framework-invoked member is declared, not suppressed.** A `usedClassMembers` entry
  (`{ "extends": "BasesView", "members": ["type"] }`) says "the platform calls this"; an
  inline suppression says "ignore this finding" and will hide a genuinely dead one later.
- Know the resolver limit: a member reached only through `const x = ctx.host` reports as
  unused, because resolution follows an **explicit type annotation** and not a property
  access. Annotate the local (`const host: HostType = ctx.host`) rather than reaching for
  the allowlist.

**adapt:** knip covers the same ground for dead exports and dependencies; it does not give
you CRAP. If you drop this step, nothing else in the gate notices dead code.

---

## 5. The docs register gate

This is the step most projects skip and the one that pays back on a long-lived codebase.
`docs/` is a real backlog of notes — requirements, tasks, issues, bugs, ADRs — and
`scripts/docs-check.mjs` gates it the way lint gates code.

What it checks, in rising order of value:

1. **Every wikilink resolves**, and every source path a *current* note names still exists.
2. **The index's hierarchy and sibling orders match the notes' own frontmatter.**
3. **The note shapes hold** — a use case has its sections, an ADR has its frontmatter.
4. **Every module in `src/` is *specified* by at least one note** — named in a use case's
   `## Where it lives` or an ADR's `## Decision`. A mention anywhere else counts for
   nothing. This is the rule that finds *missing* notes rather than wrong ones.
5. **Opt-in claim citations.** A note may write ``**Checked by** `tests/x.test.ts` — "the
   test name"``, and the gate verifies the file exists and still contains that name. It
   does **not** verify the claim; nothing in a Markdown validator can. What it buys is the
   step where the author opens the check. The claim it was built for was written the same
   day a test asserting its opposite landed, and the gate was green on both sides of it.
   State the delivery narrowly: **a citation that has rotted fails the build; a claim
   nobody cited is exactly as unchecked as before.**
   Cite a **check**, never an implementation — a citation to the code a claim describes is
   the claim restated, not evidence for it. A lint rule is a legal citation.

Three implementation rules learned the hard way:

- **Parse Markdown, do not pattern-match it.** Use `mdast-util-from-markdown` plus the GFM
  table extension. A marker must be a parsed `strong` node, so a document *showing* the
  convention inside a code span, an HTML comment or a fence differs from one *using* it.
  Read headings through the same parser, and reuse that helper anywhere else you need
  heading boundaries — a changelog section, generated release notes.
- **A rule that quietly does nothing on input it cannot parse is worse than no rule**,
  because it reads as a check. An unparseable marker is a failure, never a skip. Bound
  every scan by its block **and** by the next marker, or a malformed citation reaches
  forward and adopts the next one's evidence — which is what happens in the ordinary shape
  of the convention, two citations in a row.
- **`tests/` is deliberately outside rule 4.** Naming a path is not describing it, so
  applying the rule there buys an index edit per new test file and nothing else.

**Gate the gate.** `tests/docs/checkerAccepts.test.ts` and `checkerRejects.test.ts` write a
whole miniature repository (`docs/`, `src/`, `tests/`) to a throwaway directory and run the
**real script as a subprocess** — the way CI runs it, not refactored into something
importable, because a seam built for the test is the thing that would get tested. One
valid tree (`baseRegister()`), and every case is a single delta against it, so a failure
names a rule instead of a document. Test **both** directions: a rule quietly lost fails a
test, and a legal form the gate starts refusing fails one too. That second direction is
the one that blocks a contributor.

**adapt:** with no register yet, start with rules 1–2 over whatever `docs/` holds. Rule 4
needs the convention to exist first. Exempt generated folders (specs, plans) explicitly,
so a tool writing prose into `docs/` does not have to satisfy backlog frontmatter.

---

## 6. Looking at the UI without the host app

**Built.** `npm run harness` starts a Vite dev server on `tests/harness/` and opens it: the
real view, the real assembled stylesheet, and Obsidian's own app.css, in a browser, with no
Obsidian. It draws and asserts nothing, and it is deliberately outside `check`.

A server rather than a static bundle, which is a change from the source project: there the
page was an IIFE opened over `file://`, because a `file://` page cannot load ES modules —
every file is its own opaque origin. Over http that constraint is gone, the entry is a plain
module, and a partial edit reloads the page. What was lost with it is a folder a headless
browser can screenshot with no server running; add a `vite build` to the harness config the
day something needs one.

How the pieces fit, since the order is load-bearing:

| | |
| --- | --- |
| `vite.harness.config.ts` | `root: 'tests/harness'`, `obsidian` aliased to the same mock the suite uses (one mock, three consumers), and the assembled-styles plugin below. |
| `scripts/vite-assembled-styles.mjs` | One plugin, both configs. On build it emits `styles.css` into `dist/`; on serve it answers `/styles.css` from `styles/` per request, so the page shows the CSS on disk right now and a partial edit reloads it. It re-runs the assembler rather than caching, because the assembler is what refuses an unimported partial. |
| `tests/harness/index.html` | Links the three sheets in the order that matters, and says why in a comment beside them. |
| `tests/harness/obsidian.css` | Obsidian's **real app.css**, vendored and reduced. Linked **first**, so real element defaults — button chrome included — are what the plugin's own resets have to strip, exactly as in a vault. |
| `tests/harness/theme.css` | The harness's **own chrome only**: the leaf frame, the scheme switch, the missing-icon marker. It may restate nothing app.css already says, and every selector in it must name something the harness itself draws. |
| `tests/harness/mount.ts` | Installs Obsidian's DOM prototype extensions (`createEl`, `addClass`, `setCssProps` — a browser has none of them), builds the leaf the app would supply, constructs the real view against the fake workspace and runs its first draw. Shared with the suite, so a test drives the same mount a browser gets. |
| `tests/harness/page.ts` | The entry: `?theme=light`, `?phone`. For markup no code produces yet, add a second `.html` beside it and point the browser at it — the dev server serves any file under its root, so a mock needs no config. Keep it uncommitted; `npm run analyze` is right to call it dead. |

Two rules the vendored sheet lives under, both learned by breaking them:

- **`theme.css` loads second, so anything it restates WINS** — and a copy that wins can
  only ever be equal or wrong. In the source project it held a full copy of the palette:
  twelve values were already wrong, and the rest stood ready to draw stale colours over the
  next vendored app.css, silently. Declare nothing Obsidian declares.
- **The reduction is derived from the driven states of the project it came from.** A rule
  this plugin needs and that one never exercised is simply absent, so an element default
  can be missing here and present in a vault. Re-derive from a local app.css when a layout
  reads right here and wrong in Obsidian.

What checks it: `tests/harness/harness.test.ts` (it still mounts, the frame is there, the
DOM extensions are installed, the scheme classes switch), `tests/harness/platform.test.ts`
(its own file, because the ordering rule it holds is invisible in any file that has already
installed the extensions), and `tests/harness/cssVars.test.ts` (every `var(--x)` the
partials and the chrome read is declared by one of the two linked sheets — declarations
only, scheme-blind, and it says so).

Not built: `npm run perf`. In the source project it runs the same page in headless Chromium
and prints the stopwatch the page keeps — a way to **read** numbers where there is no
display, not a benchmark in the gate. Add it when there is a render cost to argue about,
and remember that a delta between overlapping spreads is environment drift, which has twice
been mistaken for a finding.

Three things to write down and keep saying:

- **Name the limits of the substitute every time you use it.** A control centred and boxed
  correctly in the harness shipped wrong in a real install, because the harness stylesheet
  had no baseline for a bare `<button>`. Improving the stub narrows the gap; it never
  closes it, so a real smoke test is still owed.
- **Offer the mock before the implementation, not after.** A type, a state vocabulary or a
  column set added to the fixtures file is drawn by the real view against the real
  stylesheet — so a layout can be argued about before a module exists to argue with.
  Markup no code produces yet gets its own uncommitted bundle entry, which the dead-code
  gate is right to reject if committed.
- **Keep a handover command** (`npm run test-build`) that installs the build where a human
  can open it. Naming it is a shorter ask than "please set up an environment".

---

## 7. Version and changelog rules

- `CHANGELOG.md` gains a dated `## [x.y.z]` section in the **same pull request** as every
  version bump, as a **second commit** — `npm version` refuses a dirty tree.
- A test asserts that pairing, using the same Markdown parser as the docs gate.
- `[Unreleased]` entries are added by the PR that earns them, never invented at release
  time.
- Release tags equal the manifest version with no prefix (`.npmrc`:
  `tag-version-prefix=""`), and the release workflow rejects a mismatch.
- Declaring a `permissions:` block in a workflow sets every unlisted scope to `none`. List
  the scope beside the step that needs it, in the same edit that adds the API call —
  release time is the one moment there is no cheap retry.

---

## 8. The part that makes all of it hold

The gates above catch what a machine can see. These rules are what the source repo learned
from **reviews**, and every one of them was broken there first — several inside the change
that was fixing the previous instance. Copy them into this project's agent guide.

- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore. On one pull request, six of
  ten review findings were comments precisely stating the rule the code beside them broke.
  A confident paragraph is evidence of intent and of nothing else. Twice, watching the test
  fail was what showed it asserted less than it read as.
- **Write the guarantee to the check, never ahead of it.** When a check cannot reach the
  whole claim, narrow the sentence rather than leaving the wider one standing. A guide that
  promises more than lint and the suite deliver is the same defect as an unchecked comment,
  and harder to catch because it reads as settled. If narrowing makes the sentence ugly,
  the sentence has become honest and the ugliness is the information.
- **A category invariant is checked at the forbidden thing, not by listing the places.** A
  lint rule, or a spy on the call itself, holds for code not yet written. Where the rule
  cannot see every spelling, name the spelling it does see.
- **Measure a set with an instrument that can see all of it, and test the instrument
  first.** A grep for `foo(` silently misses `foo<T>(`. A search for one heading misses the
  notes that spell it differently. Both happened, and both times the wrong count was
  already being used as the evidence for a decision.
- **Address code by name, not by position.** Selectors, symbols and paths survive an edit;
  line numbers are correct until the next insertion above them.
- **A table that enumerates code goes stale; a table that states a rule does not.** Do not
  write an index of the tree into the guide — `src/` is that list, and it cannot go stale.
  Name a module only where the sentence is *about* that module.
- **Read the register before reasoning from the code.** Code answers *what is*; only a note
  answers *what was decided*. A proposal that looks obvious from the source alone is the
  one most likely to have been considered and refused already.
- **Layer-specific rules live beside the layer they govern** — one `CLAUDE.md` per
  directory, loaded when work happens there — so nothing is read as one wall of text.

---

## Order of work

1. `package.json`, `tsconfig.json`, `vite.config.ts`, the CI matrix. → `check` runs with
   two steps.
2. vitest, `tests/helpers/`, the first tests, thresholds at the first measured figure.
3. `eslint.config.mjs`: budgets first, then the layer bans once layers exist, then boundary
   bans as each boundary appears.
4. fallow.
5. The `docs/` conventions, then `scripts/docs-check.mjs`, then the two tests over it.
6. The browser harness, when there is something to look at.

Skip nothing in section 8. It costs no code, and it is the half that decays first.
