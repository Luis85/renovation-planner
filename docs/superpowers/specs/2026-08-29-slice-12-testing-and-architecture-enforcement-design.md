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

- a layer **group** `g` becomes three globs — `**/${g}`, `**/${g}/*`, `**/${g}/**/*` — which are
  **not independent**. Measured through ESLint's matcher on real specifiers: `**/${g}` alone
  matches the barrel form, and all three match the nested forms, so the barrel glob is the only
  one protecting a distinct import shape.
- a **package** `name` becomes two entries that ARE independent — a `paths` entry for the bare
  specifier and a `patterns` entry `${name}/*` for subpaths.

The failure this closes is concrete: delete `...packages.map((name) => \`${name}/*\`)` and a bare
`import { ref } from 'vue'` probe still reports, while `import x from 'vue/dist/y'` becomes
allowed in `core/`, `domain/` and `application/` with the suite green. So the probes enumerate
**import shapes**, not config entries — the distinction the mutation section below turns on, and
no total is derived here by hand.

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

**Three config blocks carry bans that no layer path reaches, and the probe set covers them
explicitly.** `PROTOTYPES_GROUP` appears not only inside each `forbidden(layer, …)` call but in
the **root** block (matching files directly under `src/`, e.g. `src/main.ts`) and the
**catch-all** block (matching subtrees no `forbidden()` call names) — both spelled from outside
`forbidden()`'s machinery. A probe set built only from (layer, extension) pairs reaches neither,
so dropping the barrel or deep prototype spelling from either block would leave both the
existing suite and this matrix green. `prototypes-one-way-door.test.ts` drives both blocks today
but only at the one-level spelling. So the enumeration includes a root path and an
unnamed-subtree path for each distinct prototype import shape, beside the layer pairs.

**And the extension dimension applies to those blocks too, which is the CROSS-PRODUCT the
previous fixes missed.** Block kind and extension were each brought into scope in their own
round, and neither round crossed them: the root, catch-all and `presentation/dialogs` blocks
each declare their own `files` expansion over `SRC_EXTENSIONS`, so removing `.jsx`, `.mjs` or
`.cjs` from one of *those* blocks changes nothing a layer-path probe can see. The existing suite
covers only root `.ts`/`.js`, catch-all `.vue` and dialogs `.vue`. The enumeration is therefore
over **(block × extension × import shape)**, not over layers with two dimensions bolted on —
fixing each dimension separately is what left their product open twice.

**One cell of that product cannot be filled, and it is recorded as a gap with its OWN cause.**
The catch-all block × `.ts` has no probeable path: a nonexistent `.ts` is the `PARSE_ERROR` case
measured above; the only real `.ts` outside the six layer subtrees is `src/main.ts`, which
selects the **root** block rather than the catch-all; and `src/prototypes/` — the only unnamed
subtree — holds five `.vue` files and one `.md`, measured, no `.ts` at all. Any layer or
`presentation/dialogs` `.ts` selects a later overriding block.

The three ways out are all refused for stated reasons: adding a benign real `src/` module
contradicts this slice's own scope and would ship in the bundle; widening
`parserOptions.projectService` is the "bigger, unrelated fix" already recorded for
`.tsx`/`.mts`/`.cts`; and quietly dropping the cell is what the whole cross-product exists to
prevent.

**Its cause is deliberately NOT filed with the `.tsx`/`.mts`/`.cts` gap**, though the symptom is
identical. Those three fail because no block grants them parser services; this one fails because
no real file of that extension exists in an unnamed subtree. Round nine's lesson was that a
limitation attributed to the wrong cause sends the next reader to do work that cannot help —
widening parser options would fix those three and not this one, and adding a file would fix this
one and not those three. Raised by
a review bot, and it is the same finding as the prototype-spelling one applied to the two blocks
that finding's fix did not reach.

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

So the probes cover each *parseable* shippable extension — `.ts` (at a real path), `.vue`, `.js`,
`.jsx`, `.mjs` and `.cjs`, all measured to report `no-restricted-imports` — and the ones that
cannot be probed are **recorded rather than silently skipped**.

**`.tsx`, `.mts` and `.cts` are the gap, and the first draft attributed it to the wrong cause.**
It said they have no real file in `src/`, implying a future fixture would close it. That is
false, and `eslint.config.mjs` had already measured and written down why — in a comment this
document's author had not read far enough to find. `eslint-plugin-obsidianmd` applies
`recommendedTypeChecked` to `**/*.{ts,cts,mts,tsx}`, while the only block granting
`parserOptions.projectService` is scoped to `files: ['**/*.ts']`; the other three get no parser
services and throw `@typescript-eslint/await-thenable`. That config comment records the decisive
measurement: **a nonexistent path and a REAL file written to `src/` and then removed throw the
identical error**, which is what proves the gap is the missing `parserOptions` rather than a
project-service "file not found" — the mechanism that *did* explain the absent `.ts` path
earlier in this section.

So the prerequisite for probing those three is widening the parser-options scope, "a bigger,
unrelated fix" in that comment's words — not adding a fixture. Attributing a limitation to the
wrong cause is worse than leaving it undescribed: it tells the next reader to do work that will
not help. The claim is written to the measurement that exists.

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

**Batching, and the unit is a (layer, extension) PAIR — not a layer.** CLAUDE.md records six
`tests/build/` files timing out under Windows file-parallelism, each booting a type-aware ESLint,
and states that "a test file's CPU cost is part of its correctness when anything in the suite
waits in ticks", so the shape of this file is a correctness question rather than a tidiness one.

**The previous draft contradicted itself and a review bot caught it in the round it appeared.**
It kept "one `lintText` call per layer, ~12 calls" from before the extension dimension existed,
while the paragraph above had just committed to probing every parseable shippable extension.
Those cannot both hold: `lintText(code, filePath)` takes ONE path, and the extension in that path
is what selects the applicable `files` globs, so imports combined into one synthetic module
cannot exercise `.js`, `.jsx`, `.mjs`, `.cjs` and `.vue` at once. Implementing the stated 12
calls would have left most of the extension dimension untested and a deleted entry in
`SRC_EXTENSIONS` still green — the promise made one paragraph earlier, unkept by the plan
directly below it.

So one call per (layer, extension) pair, each carrying that layer's every forbidden import in
every spelling, plus an allowed counterpart per pair. Six layers × six parseable extensions ×
two directions is on the order of **70 calls**, not 12.

**That number is less alarming than it looks, and the reason is worth stating rather than
leaving to be rediscovered.** `tests/helpers/eslint.ts` records the shape of this cost directly:
the first call in a worker is ~3s idle and was seen at 17.8s under full-suite load, while *every
call after it is 7–30ms*. The first type-aware `.ts` path additionally builds the project-service
program, ~1.4s locally and ~5.1s under coverage instrumentation. Both are **once**, and
`warmUpEslint` already exists to pay them in `beforeAll`. Seventy cached calls at 30ms is about
two seconds — so the dominant cost is the boot this file would pay at any call count, and going
from 12 calls to 70 changes the total far less than the count suggests.

It is still **measured before the file is committed** rather than trusted to that arithmetic; if
it does prove heavy, the fallback is unchanged — fold the cases into an existing ESLint-booting
file rather than adding a seventh.

**Batching and per-spelling mutation are in tension, and resolving it needs the helper widened.**
`lintText` returns an array of rule IDs and nothing else, so a batched probe asserting
`toContain('no-restricted-imports')` passes when ANY of its imports reports. A spelling that
becomes allowed is then invisible — the other imports in the same module still produce that rule
ID — and the narrow mutations above stay green, which is the exact vacuity this file exists to
refuse. The design held both requirements without noticing they contradict; a review bot named
it.

So the probe asserts **one diagnostic per planted import, matched by line**, through a second
helper export returning `(ruleId, line)` pairs. A new export rather than a change to `lintText`,
because five existing test files consume its current shape and none of them needs the detail.
Asserting the COUNT alone was the cheaper option and is rejected: it survives one import going
silent while another reports twice, which is precisely the compensating-error case a count
cannot see.

**Both directions, always.** Each layer also gets an allowed-imports call asserting *no*
finding — `domain` reaching `core`, `infrastructure` naming `obsidian`, `presentation`
naming `vue`, `plugin` reaching everything. The negative half is what proves the rule is
keyed on the layer rather than firing everywhere; without it a rule that banned every
import in every layer would pass.

**Watched failing, per SPELLING.** Per this repository's standing rule, each assertion is
watched red by mutating the config and restored. The first draft said "removing a group from
one `forbidden(...)` call", which is the coarse mutation: it reddens everything that group bans
at once and so cannot tell a suite that probes one import shape from a suite that probes three.
The mutations are the narrow ones — drop `**/${g}`, drop the `${name}/*` patterns line while
leaving `paths` intact — because a mutation coarser than the defect it stands for is the vacuity
this file exists to refuse.

**What is NOT required, because it is impossible: a mutation per config PATTERN.** `**/${g}/*`
and `**/${g}/**/*` are redundant, so deleting either alone changes no observable behaviour, and
demanding a test catch it is demanding a test detect a no-op.

**Dropping the barrel glob is a different case and IS observable** — spelled out because a
review round misread the paragraph above as forbidding that mutation too. Measured through
ESLint's own matcher on real import specifiers, rather than on the bare directory names the
earlier table used:

| specifier | all three patterns | `**/${g}` dropped | `**/${g}/*` dropped |
| --- | --- | --- | --- |
| `../domain` | reports | **silent** | reports |
| `../../domain` | reports | **silent** | reports |
| `../domain/Zone` | reports | reports | reports |
| `../../domain/zone/Zone` | reports | reports | reports |

Only `**/${g}` matches the bare barrel specifier, so removing it frees exactly that import shape
and the barrel probe goes red. That is why it is in the mutation list and the other two are not:
the list is not "one mutation per pattern", it is "one mutation per import shape a pattern
uniquely protects". An earlier draft required exactly that, and its per-spelling mutation list
silently omitted the one-level case — because no such mutation exists. Probes and mutations are
defined over **semantically distinct import shapes** (barrel `../domain`, one level
`../domain/X`, nested `../domain/a/b`), never over config entries.

A green assertion over a rule that cannot fail is the thing being replaced; so is a red
requirement no rule can satisfy.

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
| broken-fake contract | the child config's `include` is wrong, the fixture fails to import, vitest collects nothing, **or that case fails in setup, in repository construction, or on an unexpected `save()` throw** (all exit non-zero; the last three also report the right case name) | a non-zero exit **plus** a collected-test count above zero **plus** the expected case named **plus** the child's output identifying the round-trip mismatch on `name` — the ASSERTION that failed, not merely which case did |
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

  **And the same choice collides with a SECOND gate, which "resolved after checking Vitest
  collection" never looked at.** `npm run analyze` is part of `npm run check`, and fallow seeds
  ordinary `*.test.ts` files through its vitest plugin. A `.fixture.ts` reachable only through a
  spawned child's `include` glob is seeded by nothing and imported by nothing, so fallow reports
  it — and the dedicated child config — as unused files, failing the very gate this slice exists
  to satisfy. `.fallowrc.json` already carries six kinds of exactly this shape under `entry`
  ("process entry points, not import roots": `scripts/lint-edited.mjs`, the two `*.test-d.ts`
  files, `src/prototypes/**/*.vue`, and the rest), each declared with its reason. The fixture and
  its config are a seventh kind, declared there the same way and for the same reason.

  The general shape: checking a new file against the gate it was designed around says nothing
  about the other three in `npm run check`. This extension choice had to satisfy vitest's
  collection, §4's own naming rule **and** fallow's reachability — and two rounds of this design
  weighed only the first two.
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

`tests/vault/` with four cases, plus `openFixtureVault(caseName)`
returning a disk-backed `FixtureVaultAdapter` implementing the subset of the host surface the
repositories actually call — **`Vault`, `MetadataCache` AND `FileManager`**, not the first two.
An earlier draft said "the `Vault`/metadata surface", copying the slice document's shorthand
rather than reading `NoteVaultDeps`, which declares `fileManager: FileManager`; the repositories
reach `processFrontMatter` on every write and `trashFile` on every delete (all three of
`ObsidianZoneRepository`, `ObsidianPlanRepository`, `ObsidianProjectRepository`). Without it
`openFixtureVault` cannot supply runnable dependencies for the `save()`/`delete()` contract cases
§3 exists to run.

**Three host surfaces are still not a repository stack, which the `FileManager` fix did not
reach.** `NoteVaultDeps` declares **eight** members — `vault`, `fileManager`, `metadataCache`,
`index`, `echo`, `migrations`, `logger`, `ledger` — and `ObsidianZoneRepository` takes a
`PlanGeometryStore` as a *second constructor argument* beside them. So a function returning
host APIs alone cannot stand up a repository however many of them it returns, and naming a third
surface was answering "what is missing" with one more item off a list instead of reading the
constructor.

`openFixtureVault(caseName)` therefore returns a **fixture repository stack** — the disk-backed
host surfaces *plus* the collaborators the repositories are constructed with — mirroring what
`createRepositoryStack` already does for `FakeVault` in `tests/helpers/vault.ts`. That is also
the honest reason the `valid-project/` repoint is deferred rather than merely awkward: it is not
one adapter, it is a second composition root for tests, and the existing one is in the file PR 25
is editing.

**`openFixtureVault` hands back a writable CLONE, never the checked-in directory** — omitted
from the first draft and raised by a review bot. The slice document already requires it
("written to disposable copies"), and the failure without it is not subtle: the contract suites
and every vault-change test call `save()` and `delete()`, so an adapter pointed at
`tests/vault/<caseName>` would mutate the baseline in place, leave a dirty worktree after a
serial run, and let concurrent cases observe each other's writes under vitest's default file
parallelism. Each caller gets an isolated temporary copy, with cleanup defined; the checked-in
tree is read-only input. That the fixture is the *only* Vault-shaped data any test touches and
that no test *writes* to the shared copy are two separate claims, and this is the second one.

**Each case is named here with its consumer, because two of the four had none.** The first
drafts said "the four cases the slice document names" and then specified assertions for only
`broken-references/` and `large-project/` — so `valid-project/` and `legacy-schema/` appeared
nowhere in this document at all. Fixture content that nothing reads is indistinguishable from
correct fixture content: the valid baseline could be malformed and the legacy fixture could
silently carry the CURRENT schema, with `npm run check` green either way. That is this
document's own "an instrument that reaches nothing looks exactly like a clean tree", applied to
data rather than to code, and it is the fourth appearance of that shape here. Raised by a review
bot.

| Case | Consumer | Status |
| --- | --- | --- |
| `broken-references/` | the bootstrap-degradation test (§2), asserting an observable rejection *and* a healthy record still loading | in this slice |
| `large-project/` | the index-rebuild operation-count assertion, via the shared recorder | in this slice |
| `legacy-schema/` | a migration test over a **test-only migration step**, scoped below — the production set has none to exercise | in this slice, narrowly |
| `valid-project/` | the Obsidian arm of the repository contracts — which is exactly the repoint deferred below | **OPEN, not delivered** |

**The `legacy-schema/` consumer needed narrowing the round after it was added, and the reason
is worth keeping.** It was written as "a migration test asserting the runner is deterministic
and idempotent", which cannot be implemented against this codebase: every array in
`MIGRATION_SET` is empty, so `latest` derives to 1 for all six kinds, and `MigrationRunner`'s
loop is `while (version < latest)`. A version-1 fixture iterates **zero times** — nothing
migrates and nothing is proven — while a version-0 fixture finds no step from 0 and throws
`migration.chain-gap` before either assertion runs. The scope was added in one round without
checking the mechanism could carry it, and a review bot caught it in the next.

So the test registers a **test-only migration step** in a test-local runner, with
`legacy-schema/` carrying a note at the version below it, and **what it proves is stated
narrowly**: that the RUNNER applies a step, reaches the same state when run twice, and leaves a
note already at the current version untouched. It proves nothing about any production
migration, because there are none — and that is the honest reading of Architecture Completion
Criterion 9 ("migrations *can be introduced* without redesign"), which is a claim about the
mechanism accepting one, not about any migration existing. Adding a real migration is not this
slice's to do: slice 12 owns no schema.

**So the four-case vault is NOT claimed as delivered.** Three cases get consumers; `valid-project/`
ships as content whose only intended reader is the deferred contract repoint. Saying that plainly
is the alternative to a Definition-of-Done item ticked over a fixture nothing exercises — and the
`legacy-schema/` row is a genuine addition to scope rather than a re-description, because no
earlier draft had a migration test in it.

**Scope decision: additive now, repoint later.** New tests point at the fixture vault. The
existing Obsidian contract arm keeps running against `FakeVault`, and repointing it is a
recorded carry-forward rather than this slice's work — that arm lives in
`tests/helpers/vault.ts`, which PR 25 edits. Consequently §7's sentence "the only
Vault-shaped data any automated test touches" is **not** true when this lands, and the slice
document is narrowed to say so rather than left standing while false.

**The three hardening rules get CONFORMANCE TESTS, not a header comment** — and the first draft
gave them a header comment, which is the defect this repository's guide names before any other:
*an invariant asserted in a comment gets a test that fails without it*. A review bot pointed out
what makes it acute here: with the contract repoint deferred, all three in-slice consumers are
READ paths — bootstrap degradation, index rebuild, the migration runner — so nothing exercises
`create` with a missing parent, the read-after-create metadata window, or folder resolution. A
new disk-backed adapter could violate all three requirements with `npm run check` green, which
is the same "instrument reaches nothing" shape as the recorder and the unread fixtures. So each
rule below is a focused adapter conformance case, and the header documents them rather than
substituting for them.

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
metadata cache. The last is the load-bearing one: enumeration happens once per rebuild, so the per-entity
metadata lookup is where a rebuild that re-enumerates or re-reads per entity shows up.

**What the count proves is narrower than "linear rather than quadratic", and the wider claim
stood for three rounds.** It proves **single enumeration and linear metadata-cache I/O** — and
nothing about in-memory work. The counter-example is concrete: `joinSidecars` currently resolves
each sidecar through `entries.get(planId)`, a Map lookup; replace that with a scan of all entries
per sidecar and the rebuild becomes quadratic while `getFiles`, `getMarkdownFiles` and
`getFileCache` retain **exactly** the planned counts. Instrumenting in-memory lookups to close
that is out of scope — it means recording inside the code under test rather than at a seam — so
the claim is narrowed to what the instrument can see.

**This is the fourth revision of this one assertion**: a wall clock, then a count, then a count
on the wrong object, then a shared recorder, and now a narrowed claim. Each round the instrument
got closer and the sentence describing it stayed one step ahead of it. Which is the argument for
question 4 being answered deliberately: an assertion that has needed four corrections before
anything was built is not obviously worth its place this round.

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
- **The vitest two-project split** — *withdrawn*, but the withdrawal argument had a hole and the
  corrected version costs one extra check. `environment: 'node'` is already the default with
  jsdom opted in per file, and forgetting a docblock **fails loudly** — the DOM test dies under
  strict node. A two-project split would introduce a hazard the current design does not have, a
  file matched by neither project silently never running, which is why the Definition of Done
  pairs it with a union check: a guard invented to cover a risk the split itself creates.

  **What the first two drafts argued wrongly**, raised by a review bot: they defended the
  default against *forgetting* a docblock, which is the safe direction, and said nothing about
  *adding* one where it does not belong. Any test under `tests/domain/` or `tests/core/` can
  write `@vitest-environment jsdom` and silently switch off the very indirect-DOM enforcement
  the node default is credited with — the transitive case the per-file lint rule cannot see, and
  the whole reason the environment counts as a mechanism in §8. "The default delivers the
  enforcement" was therefore true of the failure mode I was picturing and false of the one that
  matters. Measured: **zero** inner-layer tests use jsdom today, so the hole is latent rather
  than live.

  The remedy is neither the split nor the bare default, but a check on the jsdom opt-in — and
  the FIRST version of that remedy was wrong too, in a way worth keeping because it is the same
  error one level down. It was written as an ALLOWLIST: reject `@vitest-environment jsdom`
  outside presentation, plugin and harness. Measured, that rejects two existing legitimate
  suites — `tests/helpers/obsidian-mock.test.ts`, which constructs and inspects DOM-backed
  `Notice` elements, and `tests/build/entryDrawn.test.ts`, which drives a DOM readiness
  predicate. Neither can run under the node default, so the check would have reddened
  `npm run check` the day it landed.

  The shape was wrong, not only the list. An allowlist says "jsdom is permitted here and nowhere
  else", which is a claim about the whole tree that nothing in slice 12 needs and that goes stale
  every time a legitimate DOM-touching helper is added somewhere new. The rule's actual subject
  is narrower: **the inner layers' node enforcement**. So it is a DENYLIST — reject
  **any environment directive whose value is not `node`, under EITHER supported spelling** — in
  `tests/core/`, `tests/domain/`, `tests/application/` and `tests/infrastructure/`, and saying
  nothing about anywhere else. The check matches what Vitest itself matches, read out of vitest
  4.1.11 rather than assumed: `` /@(?:vitest|jest)-environment\s+([\w-]+)\b/ ``. So
  `@jest-environment jsdom`, honoured for Jest compatibility, is refused exactly like the Vitest
  spelling. The `-options` variants carry no environment name and are not a door. Measured: zero
  files under those four directories use a non-node environment today, so it lands green.

  The fourth directory was missing from the first denylist and a review bot caught it. The
  repository contracts are invoked from mirrored files under
  `tests/infrastructure/{persistence/in-memory,obsidian}/` — six call sites, measured — which the
  parent slice requires to run in bare node, and none of which sits in the three directories the
  denylist first named. Adding a jsdom docblock to any contract caller would have disabled the
  indirect-DOM check with the guard still green. Same defect as the allowlist one round earlier,
  from the other side: there the rule reached too far, here not far enough, and both came from
  naming directories by intuition instead of by asking which files the mechanism actually
  protects.

  **Four boundary errors in this one check, and the fourth nearly survived a bad measurement.**
  The allowlist reached too far; the denylist too short; the predicate named `jsdom` rather than
  "not node"; and it then named one directive spelling out of two. On that last one a
  `grep -rl "jest-environment" node_modules/` came back empty and I nearly answered that the
  finding did not reproduce — the literal substring is absent because the source reads
  `(?:vitest|jest)-environment`, with a `)` between the two words. This repository's own rule
  states the trap exactly: *measure a set with an instrument that can see all of it, and test the
  instrument first — a grep for `foo(` misses `foo<T>(`*. The correct instrument was to find the
  regex Vitest matches with and read it, which is what the check is written against now.

  This is the same correction as `panButtonOf`'s in CLAUDE.md, one level down: a rule with an
  implicit `else` claims everything it never thought about. It is cheap, it structurally
  guarantees what the split was wanted for, and it introduces no uncollected-file hazard. The withdrawal stands *paired with that check* — without it, the
  honest status of this item is "outstanding", not "withdrawn". Narrowing the item to what is
  actually checked is this repository's own rule: *write the guarantee to the check, never ahead
  of it* — a rule the first version of this very entry broke.
- **The contract-arm repoint** onto the fixture vault — open, blocked on PR 25, with §7's
  sentence narrowed meanwhile.
- **The indirect package-import gap** — open, as slice 1 already records. The node-environment
  test catches a DOM global at runtime, not an import graph.

## 6. Packaging

One branch, `claude/next-slice-planning-gzjphh`. The meta-tests land as the early commits
and the fixture vault after, so the cheap high-value half is reviewable on its own even if
the vault half needs another round.

Conflict surface with PR 25 is `eslint.config.mjs` — where this slice **adds no rule**, only
drives the ones that exist — **and `tests/helpers/vault.ts`**, which is a genuine overlap and was
denied by earlier drafts of this section.

**That denial became false through this document's own later fixes**, which is why it is
corrected rather than quietly amended. §6 first claimed the overlap was "zero rather than small";
§3 then acquired a shared operation recorder spanning `FakeVault` and `FixtureVaultAdapter`
(round three's fix, corrected in round six), and `FakeVault` is defined in
`tests/helpers/vault.ts` — one of the files this same document lists PR 25 as editing. Injecting
or extracting a shared recording seam means editing that helper, so the two touch. A packaging
claim made early and not re-checked after four rounds of scope change is the same species as the
counts this document has already had to correct three times.

**So the recorder edit is sequenced rather than raced**: it lands after PR 25 merges, and until
then `large-project/` is the one in-slice consumer blocked on it. Which is a second reason
question 4 — whether `large-project/` earns its place this round — is worth deciding
deliberately.

Measured across all 106 of PR 25's files rather than the first page of them, because the
first draft of this sentence asserted the opposite from a truncated listing: PR 25 **does**
edit `vitest.config.ts` (the coverage commentary and the thresholds block) and
`tsconfig.json` (one `include` entry). This slice touches neither — the two-project split is
withdrawn in §5, so no vitest configuration changes, and no new file needs a `tsconfig`
entry. **That pair overlaps at zero** — and the claim is narrowed to that pair, because a
sentence generalising it stood eighteen lines below the correction above for a whole round,
saying the overall overlap was zero while the paragraph above named `tests/helpers/vault.ts` as
a real one. An implementation plan reading the later sentence would have raced the exact helper
edit the earlier one says to serialize.

The whole conflict surface is: `eslint.config.mjs` (driven, not modified),
`tests/helpers/vault.ts` (**a real overlap, sequenced after PR 25**), and nothing else —
`vitest.config.ts` and `tsconfig.json` stay untouched only while the two-project split stays
withdrawn.

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
