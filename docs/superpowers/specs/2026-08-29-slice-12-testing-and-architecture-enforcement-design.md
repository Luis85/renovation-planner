---
type: Design
slice: 12
status: proposed
date: 2026-08-29
---

# Slice 12, infrastructure half: the architecture harness and the Integration Test Vault

## Why this now

Slice 16 is in flight on PR 25. Slice 17 `dependsOn` 16 and slice 20 `dependsOn` 19, so
both are blocked. Slice 19 is unblocked but shares PR 25's exact files — `en.ts`, `de.ts`,
`composition-root.ts`, `persistence/index/`, `mappers/projectMapper.ts` and
`tests/helpers/vault.ts`. Slice 12 `dependsOn` slice 1 alone, and its remaining work is
almost entirely new files.

This document covers slice 12's **infrastructure half**. The §92 phase gate is not in
scope and cannot be — its own text says it "cannot be verified true until they all exist".

## The measurement this design rests on

`eslint.config.mjs` builds one block per layer from a `forbidden(layer, { groups, packages })`
factory. Transcribed from those calls, the layer and package bans are **35 cells** — read as a
description of the config's arguments, not as the size of the probe set, which the section below
enumerates in code and which also includes the `prototypes` group:

| Layer | Forbidden groups | Forbidden packages |
| --- | --- | --- |
| `core` | domain, application, infrastructure, presentation, plugin (5) | vue, pinia, konva, vue-konva, obsidian (5) |
| `domain` | application, infrastructure, presentation, plugin (4) | the same five (5) |
| `application` | infrastructure, presentation, plugin (3) | the same five (5) |
| `infrastructure` | presentation, plugin (2) | vue, pinia, konva, vue-konva (4) — `obsidian` is its job |
| `presentation` | infrastructure, plugin (2) | none declared |
| `plugin` | none | none |

**A cell is not a probe: each cell is several SPELLINGS**, raised by a review bot on the second
round and verified by reading `forbidden()`. Each banned entry expands to several independent
glob/path forms, and a probe of one says nothing about the others:

- a layer **group** `g` becomes three globs — `**/${g}` (the barrel spelling),
  `**/${g}/*` (one level) and `**/${g}/**/*` (any depth). 16 cells × 3 = **48**.
- a **package** `name` becomes two entries — a `paths` entry for the bare specifier and a
  `patterns` entry `${name}/*` for its subpaths. 19 cells × 2 = **38**.

The failure this closes is concrete: delete `...packages.map((name) => \`${name}/*\`)` and a
bare `import { ref } from 'vue'` probe still reports, while `import x from 'vue/dist/y'`
becomes allowed in `core/`, `domain/` and `application/` with the suite green. Same for a
group whose barrel form is dropped while its deep form survives. So the probes enumerate
spellings, not cells, and the mutation is per SPELLING rather than per group.

**The `prototypes` group is NOT excluded any more, and the reason it was is the same error as
the one above.** The first two drafts excluded it on the grounds that
`tests/build/prototypes-one-way-door.test.ts` already drives it across all six layers — true
about LAYERS, false about SPELLINGS, which is finding 5 repeated on the group finding 5 was
used to justify skipping. `PROTOTYPES_GROUP` is `['**/prototypes', '**/prototypes/*',
'**/prototypes/**/*']`, and every probe in that file imports `../prototypes/ZoneSummary.vue` —
the one-level form alone. Deleting `**/prototypes` or `**/prototypes/**/*` leaves that suite
green. So the barrel and deep spellings are this slice's, at each layer and at the root and
catch-all blocks that carry `PROTOTYPES_GROUP` from outside `forbidden()`.

**And the grand total is no longer computed by hand in this document.** A count derived in prose
has been wrong twice here — once about how many cells were driven, once about cells-versus-
spellings — and a third hand-derivation would be the same defect a third time. The probe set is
**enumerated in code** from the SDD's layering statement (layers × forbidden groups × the three
glob forms, plus packages × the two entry forms), and the count is whatever that enumeration
yields. The numbers that stay in prose are the ones with a check under them: three glob forms
per group, two entry forms per package, and the six cells measured as already driven — the
16/19 cell split above is likewise a reading of `forbidden()`'s arguments, not a derived total.

The `48` and `38` above therefore describe the layer and package groups *as the config declares
them*; they are not the size of the probe set, which the enumeration computes and which includes
the prototypes spellings this section just added back.

**Six of the 35 are driven today, and the first draft of this document said one.** The
correction came from a review bot, and it is recorded rather than quietly folded in because the
error was the same species this design exists to fix: a count taken over the files somebody
thought to look at. `network-boundary.test.ts`'s "the parent layer ban survived the override"
table drives five — application→infrastructure, application→vue, application→plugin,
infrastructure→presentation, infrastructure→konva — and `vue-rules.test.ts` drives the sixth,
presentation→infrastructure.

**Read those five narrowly, because their paths are not ordinary ones.** They are linted at
`src/application/queries/GetDiagnosticsSnapshot.ts` and
`src/infrastructure/logging/diagnosticsLedger.ts` — the two `networkFree()` subtrees, whose
whole purpose is restating the parent layer's ban so it survives the flat-config override. They
do cover those cells: `networkFree` composes `forbidden`'s own output from the same
`APPLICATION_LAYER.ban` / `INFRASTRUCTURE_LAYER.ban` object, so a group dropped from the parent
goes quiet in both. What they do not do is exercise those cells at an ordinary path in the layer.

So **29 cells have never been fired**, and CLAUDE.md's headline claim — "`eslint.config.mjs`
enforces that with per-directory `no-restricted-imports`, so a violation fails `npm run lint`
rather than waiting for review" — rests on them. That is the exact shape this repository's own
rule refuses: *a category invariant is checked at the forbidden thing, not by listing the
places*. The number moved; the argument did not.

## 1. `tests/build/layer-boundaries.test.ts`

**Instrument.** `tests/helpers/eslint.ts` already exports `lintText(code, filePath)`,
`warmUpEslint` and `ESLINT_BOOT_MS` — the harness the slice document specifies, already
built for the network and prototype rules. Nothing new is needed to drive ESLint.

**Synthetic code, never a fixture file on disk.** A file under `src/domain/` violating a rule
on purpose would red the real `eslint .` run, and the usual escape — adding it to `ignores` —
would make the meta-test lint a file ESLint skips and pass vacuously, which is precisely the
failure the test exists to prevent. Nothing enters `ignores`, so
`tests/build/suppressions.test.ts`'s no-suppressions claim stays whole.

**But the PATH has to be one the parser can resolve, and the first draft of this document got
that wrong.** It specified `src/domain/__planted__.ts`, which does not exist. Measured against
the real config after a review bot raised it, rather than reasoned about:

| Fixture | Result |
| --- | --- |
| nonexistent `src/domain/__planted__.ts` | `PARSE_ERROR` — "was not found by the project service"; `no-restricted-imports` never runs |
| nonexistent `src/core/__planted__.ts` | `PARSE_ERROR`, the same |
| **real** `src/domain/zone/Zone.ts`, synthetic violating code | `no-restricted-imports` reports |
| nonexistent `src/domain/Fixture.vue`, wrapped in an SFC | `no-restricted-imports` reports (plus `vue/multi-word-component-names`) |

The ruleset is type-aware, so typescript-eslint's project service refuses a `.ts` path with no
file behind it. Both surviving shapes have precedent here — `network-boundary.test.ts` lints
synthetic code at the paths of two **real** files, and `prototypes-one-way-door.test.ts` wraps
its script in `sfc()` at a nonexistent `.vue` path across all six layers.

**This design takes the real-`.ts`-path shape**, one existing file per layer. A `.vue` under
`core/` or `domain/` is a file kind those layers can never hold, so it would prove the rule
fires for a shape that will never occur there, while a `.ts` proves it for the shape that
actually lives there. Every layer has a real `.ts` to point at.

**A third dimension: the EXTENSION, because `files` is a matcher too.** Raised on the sixth
round. `srcFiles(layer)` is `SRC_EXTENSIONS.map((ext) => \`**/src/${layer}/**/*.${ext}\`)`, and
`SRC_EXTENSIONS` is nine entries — `ts, tsx, mts, cts, vue, js, jsx, mjs, cjs`. Every ban is
therefore matched per extension, so probing `.ts` alone leaves the file-matcher half of the
boundary untested: drop `mjs`, `cjs` or `jsx` from that constant and a shippable file in any
layer bypasses every package and sibling-layer ban with this matrix green. `.vue` and `.js` are
already driven by `prototypes-one-way-door.test.ts`; the rest are nobody's.

So the probes cover each *parseable* shippable extension, and the ones that cannot be probed are
**recorded rather than silently skipped** — the same treatment the fixture-path finding got.
`.tsx`, `.mts` and `.cts` have no real file anywhere in `src/`, and a type-aware path with no
file behind it is exactly the `PARSE_ERROR` case measured above, so those three are written down
as a known limitation of the harness with the reason, not left as an unexplained gap.

**`PARSE_ERROR` is asserted absent, and it matters most where it looks least urgent.** On a
positive case a parse error fails the assertion anyway, the rule id simply being absent. On a
**negative** case — the allowed-import half, asserting `not.toContain('no-restricted-imports')`
— a parse error makes it pass *vacuously*, which is this repository's own `ignores`-vacuity
defect wearing a different hat. `lintText` already returns a `PARSE_ERROR` sentinel for exactly
this, and the negative cases assert against it explicitly.

**The matrix is transcribed from the SDD's layering statement, not read out of
`eslint.config.mjs`.** Deriving the expectations from the configuration under test would be
the self-declared-list defect CLAUDE.md already names — "a category check that compares a
SELF-DECLARED list is the shape it was written to replace". The test states the SDD's rule;
the config is the subject, not the source.

**Batching, because cost is a correctness concern here.** CLAUDE.md records six
`tests/build/` files timing out under Windows file-parallelism, each booting a type-aware
ESLint, and states that "a test file's CPU cost is part of its correctness when anything in
the suite waits in ticks". So the file makes **one `lintText` call per layer**, its code
carrying every forbidden import for that layer *in every spelling* at once, asserting each is
reported — about 12 calls however many spellings the enumeration yields. The expansion costs
import LINES, not
calls, which is why it does not change this shape: one synthetic module per layer simply
carries a dozen or so import statements instead of a handful. The cost is to be **measured
before the file is committed**; if it is still heavy, the fallback is folding the cases into an
existing ESLint-booting file rather than adding a seventh.

**Both directions, always.** Each layer also gets an allowed-imports call asserting *no*
finding — `domain` reaching `core`, `infrastructure` naming `obsidian`, `presentation`
naming `vue`, `plugin` reaching everything. The negative half is what proves the rule is
keyed on the layer rather than firing everywhere; without it a rule that banned every
import in every layer would pass.

**Watched failing, per SPELLING.** Per this repository's standing rule, each assertion is
watched red by mutating the config and restored. The first draft said "removing a group from
one `forbidden(...)` call", which is the coarse mutation: it reddens every spelling of that
group at once and so cannot tell a suite that probes one spelling from a suite that probes
three. The mutations are the narrow ones — drop `**/${g}` alone, drop `**/${g}/**/*` alone,
drop the `${name}/*` patterns line while leaving `paths` intact — because a mutation coarser
than the defect it stands for is the vacuity this file exists to refuse. A green assertion
over a rule that cannot fail is the thing being replaced.

## 2. The four remaining meta-tests

**One rule governs all of them, and it is stated here once rather than rediscovered per test.**
Every meta-test in this section asserts that something FAILED — a lint rule reported, an import
threw, a child run exited non-zero, a fixture was rejected. *A failure assertion is vacuous
unless it discriminates the CAUSE of the failure*, because the infrastructure of the test can
fail in ways that look identical to the defect it is watching for.

This was raised three times by review before it was written down as a class, which is the
lesson: round two fixed it for `broken-references/` alone, and round four found the same shape
in two more tests I had written in between. "I fixed the case in the report" is not "I fixed the
class" — CLAUDE.md's own words, and this document walked into it.

So each test names its discriminator:

| Test | Would pass vacuously if… | Discriminator |
| --- | --- | --- |
| layer-boundary probes | the path fails to parse | `PARSE_ERROR` asserted absent, and the *rule id* asserted present |
| node environment | the fixture's import path is wrong, or its module throws for any other reason | the rejection is the expected `ReferenceError` for the planted global — not a resolution or transform error |
| broken-fake contract | the child config's `include` is wrong, the fixture fails to import, or vitest collects nothing (all exit non-zero) | a non-zero exit **plus** a collected-test count above zero **plus** the expected contract case named in the child's output |
| `broken-references/` | the fixture has quietly become valid | an observable rejection by count and code, **plus** a healthy record in the same fixture still loading |

Taken from the slice document's Testing Strategy, unchanged in intent:

- **The node environment fires on an indirect violation.** A fixture module where `domain/`
  reaches a DOM global through a helper — no direct import in the domain file — is imported
  inside a node test, which asserts the import fails **with the expected `ReferenceError` for the
  planted global**, per the discriminator table above: "the import threw" is equally true of a
  mistyped fixture path. This proves the node default catches
  what a per-file lint rule cannot see. It does **not** stand in for the indirect *package*
  import gap slice 1 names; that stays open and is recorded as open.
- **A contract suite fails on a broken fake** — and it has to run in a CHILD vitest process,
  which the first draft of this document missed. A repository fake whose `save()` silently
  drops the zone's `name` is run through `zoneRepositoryContract`, and the test asserts the
  suite fails; that is what proves the contract suites discriminate rather than pass against
  any object with the right method names.

  The mechanism, corrected after a review bot raised it and verified by reading the contract:
  `zoneRepositoryContract(make)` calls `describe(...)` at invocation and returns `void`. Called
  from inside a test it registers cases in the *current* run, so a broken fake makes
  `npm run check` fail rather than producing a failure an outer assertion can catch — the
  meta-test would be indistinguishable from a genuine regression. So it spawns a child vitest
  run over one fixture spec and asserts a non-zero exit.

  **The cost is named, because this repository has already been bitten by it.** CLAUDE.md
  records six ESLint-booting child processes costing 3.76s in synchronous bursts on a two-core
  runner, and timing out a sibling file's cold Vite transform. This is **one** child, not one
  per case, and it is budgeted explicitly — the whole point of that record is that a spawn per
  case is what turns a green suite red on the busiest machine.

  **And the fixture must be unreachable by the PARENT run, which the child-process fix created
  and did not solve.** Raised by a review bot on the next round, and it is a genuine
  interaction with §4 rather than a detail: a deliberately failing spec checked in as
  `*.test.ts` under `tests/` is collected by the outer `npm run check`, which then fails before
  the meta-test can interpret the child's exit code — the fixture would break the very gate it
  is part of. The child's exit code is also not enough on its own; see the discriminator table
  above, since a bad `include` and a fixture that fails to import both exit non-zero too. `.spec.ts` is not the escape either, since §4 bans that name outright. So the
  fixture is `tests/build/fixtures/brokenFake.fixture.ts`, outside `vitest.config.ts`'s
  `include` (`tests/**/*.test.ts`), and the child is invoked with a dedicated minimal config
  whose `include` names `*.fixture.ts`. That keeps repo-relative imports of the contract working,
  which an out-of-tree temporary directory would not.

  **§4's check is written to this deliberately**: it requires every `*.test.ts` on disk to be
  collected and bans `*.spec.ts`. A `.fixture.ts` is neither, so the two rules do not collide —
  and stating that here is what stops a later reader "tidying" the fixture into a `.test.ts` and
  rediscovering this by breaking the build.
- **`broken-references/` degrades gracefully — asserted on BOTH halves.** Loaded through the
  real bootstrap path, asserted to leave the rest of the plugin usable. This is a real test
  rather than a gate meta-test, so it sits at `tests/plugin/` — its mirrored home — not under
  `tests/build/`.

  The first draft claimed it "simultaneously proves the fixture exercises the failure mode it
  claims to". A review bot pointed out that it does not, and the bot is right: *the rest of the
  plugin still works* is equally true of a fixture that has quietly become **valid** — a schema
  edit, a fixture typo — so Architecture Completion Criterion 13 could sit untested behind a
  green suite. That is this repository's own recorded lesson that "a test asserting an ABSENCE
  passes in both worlds when neither world can produce the thing". The case therefore asserts an
  **observable rejection** — the expected refusal for the planted record, by count and code —
  *and* that a healthy record in the same fixture still loads. Neither half alone discriminates.
- **CI actually invokes the checks.** A test over the workflow definition confirming
  `npm run check` runs on every PR on both Ubuntu and Windows. Catches the case where the
  scripts pass locally but were never wired in, and the case where the two platforms drift
  by invoking different commands.

## 3. The Integration Test Vault

`tests/vault/` with the four cases the slice document names, plus `openFixtureVault(caseName)`
returning a disk-backed `FixtureVaultAdapter` implementing only the subset of the
`Vault`/metadata surface the repositories actually call.

**`openFixtureVault` hands back a writable CLONE, never the checked-in directory** — omitted
from the first draft and raised by a review bot. The slice document already requires it
("written to disposable copies"), and the failure without it is not subtle: the contract suites
and every vault-change test call `save()` and `delete()`, so an adapter pointed at
`tests/vault/<caseName>` would mutate the baseline in place, leave a dirty worktree after a
serial run, and let concurrent cases observe each other's writes under vitest's default file
parallelism. Each caller gets an isolated temporary copy, with cleanup defined; the checked-in
tree is read-only input. That the fixture is the *only* Vault-shaped data any test touches and
that no test *writes* to the shared copy are two separate claims, and this is the second one.

**Scope decision: additive now, repoint later.** New tests point at the fixture vault. The
existing Obsidian contract arm keeps running against `FakeVault`, and repointing it is a
recorded carry-forward rather than this slice's work — that arm lives in
`tests/helpers/vault.ts`, which PR 25 edits. Consequently §7's sentence "the only
Vault-shaped data any automated test touches" is **not** true when this lands, and the slice
document is narrowed to say so rather than left standing while false.

**The new adapter inherits `FakeVault`'s hardening by construction.** A fresh fake starts
without the three lessons this repository already paid for, and CLAUDE.md's rule is that a
fake kinder than the real thing turns a shipped crash into a green suite. All three go into
the adapter's header as requirements, not as history:

- `create` refuses a path whose parent folder does not exist (Obsidian refuses one; making
  the old fake refuse turned 86 tests red).
- the metadata cache is populated **asynchronously**, with the create-window fallback
  (making the old fake honest turned 65 tests red across 12 files).
- `getAbstractFileByPath` answers a folder object for a folder, never `null`.

**`large-project/` asserts an operation count, not a clock — and the recorder has to be
WIDENED first, which the first two drafts missed.** The slice document calls it "a performance
fixture", but this repository deliberately has no `npm run perf`, and a wall-clock budget across
Ubuntu 22/24/26 and Windows is a flake generator. A count is deterministic, needs no clock, and
catches the shape that actually bit this codebase.

**The instrument named in the first draft cannot see the subject**, raised by a review bot on the
third round and confirmed by reading both sides. `FakeVault.op()` is called from exactly five
methods — `create`, `modify`, `delete`, `createFolder`, `read` — while
`buildProjectIndexEntries` enumerates through `vault.getFiles()` and `vault.getMarkdownFiles()`
and reads frontmatter through the metadata cache. None of those three is instrumented. So
`operations` would have recorded **zero** for an index rebuild at every fixture size, and the
assertion would have passed against a quadratic implementation as happily as a linear one — "an
instrument that reaches nothing looks exactly like a clean tree", which is this repository's own
rule, quoted in this very document one section earlier.

**The `listByPlan` precedent was cited and does not transfer**, which is the part worth keeping.
That regression was catchable because that path performs real `vault.read` calls, and `read` is
one of the five. Reasoning "the recorder caught a cost regression once, so it can catch this
one" skipped the question of whether the new subject routes through the recorded doors at all.
A precedent is about a mechanism, not about a category of problem.

So this slice **instruments the operations the rebuild actually performs** before asserting
anything about them: `getFiles` and `getMarkdownFiles` on the vault, and `getFileCache` on the
metadata cache. The last is the load-bearing one — enumeration happens once per rebuild, so it
is the PER-ENTITY lookup whose count distinguishes linear from quadratic, and a rebuild that
re-enumerates or re-reads per entity is exactly what shows up there.

**The recorder belongs to BOTH adapters, and the previous draft put it on the wrong one.** This
is the third appearance of "the instrument does not reach the subject" in this document, and the
first two are directly above — which is what makes it worth writing down rather than quietly
correcting. The round-three fix widened `FakeVault.operations` and measured `FakeVault`'s
consumer; but §3 has `large-project/` running through the disk-backed `FixtureVaultAdapter`, and
calls made by that adapter never enter `FakeVault`'s array. The instrument was widened correctly,
on the object the subject does not use. So the recorder is **shared** — one recording seam both
adapters take — and the `large-project/` assertion consumes it from whichever adapter the case
actually runs on.

**The widening is measured as safe rather than assumed**: `.operations` has exactly one consumer
outside the helper (`tests/infrastructure/obsidian/repositories/contract.test.ts`), and it
filters for `read:` entries under `Geometry/`, so new entry kinds cannot disturb it. Recorded
because this repository's own history says a fake widening usually costs something — 86 tests
once, 65 another time — and the honest report is that this one costs nothing, the same way
slice 13's `Notice` widening turned out to cost nothing.

## 4. One item folded in

A check that **no `.spec.ts` exists under `tests/` OR `src/`**, and that every `*.test.ts` on
disk is collected. `vitest.config.ts`'s `include` is `['tests/**/*.test.ts']`, so a `.spec.ts`
anywhere is a suite that never runs and nothing says so. Measured: zero such files exist today
under either tree, which is what makes this a cheap lock rather than a cleanup.

**The `src/` half was missing from the first draft, and the sentence that stated the measurement
is what convicts it**: it read "zero such files exist today under either `tests/` or `src/`" —
`src/` measured, then guarded in only one of the two trees. `src/` is the half that matters more,
because it is **build input**: an uncollected `.spec.ts` under `tests/` is dead weight, while one
under `src/` is unexecuted test code inside the shipped tree, and the slice's own Definition of
Done asks for exactly this ("no `.spec.ts` file exists anywhere under `src/`", lines 634–636).
Raised by a review bot. Measuring a set and then guarding a subset of it is this document's
recurring failure in its smallest form.

## 5. What is recorded as NOT met

Written into `docs/tasks/12-…md` as open or withdrawn, never ticked:

- **The §92 phase gate** (15 criteria) — open. Its own text defers it until every slice exists.
- **The vitest two-project split** — *withdrawn*, not outstanding, with the argument written
  down. `environment: 'node'` is already the default with jsdom opted in per file, which
  delivers the enforcement the split was for: domain and core tests run in node, so a DOM
  global reached through any depth of import fails. Forgetting a docblock **fails loudly** —
  the DOM test dies under strict node. A two-project split would introduce a hazard the
  current design does not have, a file matched by neither project silently never running,
  which is why the Definition of Done pairs it with a union check. That is a guard invented
  to cover a risk the split itself creates. Narrowing the item is this repository's own rule:
  *write the guarantee to the check, never ahead of it*.
- **The contract-arm repoint** onto the fixture vault — open, blocked on PR 25, with §7's
  sentence narrowed meanwhile.
- **The indirect package-import gap** — open, as slice 1 already records. The node-environment
  test catches a DOM global at runtime, not an import graph.

## 6. Packaging

One branch, `claude/next-slice-planning-gzjphh`. The meta-tests land as the early commits
and the fixture vault after, so the cheap high-value half is reviewable on its own even if
the vault half needs another round.

Conflict surface with PR 25 is `eslint.config.mjs` only, and this slice **adds no rule
there** — it drives the rules that already exist.

Measured across all 106 of PR 25's files rather than the first page of them, because the
first draft of this sentence asserted the opposite from a truncated listing: PR 25 **does**
edit `vitest.config.ts` (the coverage commentary and the thresholds block) and
`tsconfig.json` (one `include` entry). This slice touches neither — the two-project split is
withdrawn in §5, so no vitest configuration changes, and no new file needs a `tsconfig`
entry. The overlap is therefore zero rather than small, but it is zero for a reason that
would stop being true the moment either of those items came back.

## 7. Verification

`npm run check` green, all four steps.

**Coverage is close to a non-issue for this slice, and saying why is worth more than quoting
a floor.** `vitest.config.ts`'s coverage `include` is `src/**/*.{ts,vue}`. Everything this
slice builds — the meta-tests, `openFixtureVault`, `FixtureVaultAdapter`, the fixture content
— lives under `tests/`, outside that include, so it enters neither numerator nor denominator.
The slice adds no `src/` module at all. The one thing that could still move the figure is a
`src/` arm that the new fixture-vault tests reach for the first time, which can only raise it.

That is the opposite of the usual risk here, so the usual precaution does not apply: no
figure is quoted from CLAUDE.md, whose own instruction is that a number on that line is not
current and `npm run test:coverage` is the authority. The floors are read at the start of the
work, and the ratchet policy applies unchanged — floors rise only to what a finished
increment measures.

**Cost, which is this slice's real gate risk rather than coverage.** New `tests/build/` files
each boot a type-aware ESLint, and CLAUDE.md records six such files timing out under Windows
file-parallelism. The layer-boundary file's wall cost is measured before it is committed; a
`beforeAll` timeout in that directory is re-run with `--no-file-parallelism` before being
believed, per the same record.
