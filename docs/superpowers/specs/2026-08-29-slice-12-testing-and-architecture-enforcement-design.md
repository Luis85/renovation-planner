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
factory. Transcribed from those calls, the forbidden matrix is **35 cells**:

| Layer | Forbidden groups | Forbidden packages |
| --- | --- | --- |
| `core` | domain, application, infrastructure, presentation, plugin (5) | vue, pinia, konva, vue-konva, obsidian (5) |
| `domain` | application, infrastructure, presentation, plugin (4) | the same five (5) |
| `application` | infrastructure, presentation, plugin (3) | the same five (5) |
| `infrastructure` | presentation, plugin (2) | vue, pinia, konva, vue-konva (4) — `obsidian` is its job |
| `presentation` | infrastructure, plugin (2) | none declared |
| `plugin` | none | none |

The `prototypes` group is deliberately **excluded** from that count: measured, not assumed —
`tests/build/prototypes-one-way-door.test.ts` already drives it across all six layers with
`it.each(LAYERS)`.

**Exactly one of the 35 is driven today**: `vue-rules.test.ts`'s "refuses a component
importing infrastructure directly", and only for a `.vue` path. `network-boundary.test.ts`
touches `core`/`domain` once, but through `no-restricted-globals` (a `fetch` global), which
is a different rule from the one this matrix is about.

So CLAUDE.md's headline claim — "`eslint.config.mjs` enforces that with per-directory
`no-restricted-imports`, so a violation fails `npm run lint` rather than waiting for
review" — currently rests on 34 cells that have never been fired. That is the exact shape
this repository's own rule refuses: *a category invariant is checked at the forbidden
thing, not by listing the places*.

## 1. `tests/build/layer-boundaries.test.ts`

**Instrument.** `tests/helpers/eslint.ts` already exports `lintText(code, filePath)`,
`warmUpEslint` and `ESLINT_BOOT_MS` — the harness the slice document specifies, already
built for the network and prototype rules. Nothing new is needed to drive ESLint.

**Synthetic paths, never files on disk.** `lintText`'s `filePath` decides which flat-config
blocks apply and need not exist. A fixture on disk under `src/domain/` would red the real
`eslint .` run, and the usual escape — adding it to `ignores` — would make the meta-test
lint a file ESLint skips and pass vacuously, which is precisely the failure the test exists
to prevent. Nothing enters `ignores`, so `tests/build/suppressions.test.ts`'s
no-suppressions claim stays whole.

**The matrix is transcribed from the SDD's layering statement, not read out of
`eslint.config.mjs`.** Deriving the expectations from the configuration under test would be
the self-declared-list defect CLAUDE.md already names — "a category check that compares a
SELF-DECLARED list is the shape it was written to replace". The test states the SDD's rule;
the config is the subject, not the source.

**Batching, because cost is a correctness concern here.** CLAUDE.md records six
`tests/build/` files timing out under Windows file-parallelism, each booting a type-aware
ESLint, and states that "a test file's CPU cost is part of its correctness when anything in
the suite waits in ticks". So the file makes **one `lintText` call per layer**, its code
carrying every forbidden import for that layer at once, asserting each is reported — about
12 calls rather than 35. The cost is to be **measured before the file is committed**; if it
is still heavy, the fallback is folding the cases into an existing ESLint-booting file
rather than adding a seventh.

**Both directions, always.** Each layer also gets an allowed-imports call asserting *no*
finding — `domain` reaching `core`, `infrastructure` naming `obsidian`, `presentation`
naming `vue`, `plugin` reaching everything. The negative half is what proves the rule is
keyed on the layer rather than firing everywhere; without it a rule that banned every
import in every layer would pass.

**Watched failing.** Per this repository's standing rule, each assertion is watched red by
mutating the config — removing a group from one `forbidden(...)` call — and restored. A
green assertion over a rule that cannot fail is the thing being replaced.

## 2. The four remaining meta-tests

Taken from the slice document's Testing Strategy, unchanged in intent:

- **The node environment fires on an indirect violation.** A fixture module where `domain/`
  reaches a DOM global through a helper — no direct import in the domain file — is imported
  inside a node test, which asserts the import fails. This proves the node default catches
  what a per-file lint rule cannot see. It does **not** stand in for the indirect *package*
  import gap slice 1 names; that stays open and is recorded as open.
- **A contract suite fails on a broken fake.** A repository fake whose `save()` silently
  drops the zone's `name` is run through `zoneRepositoryContract`; the test asserts the
  suite fails. This proves the contract suites discriminate rather than pass against any
  object with the right method names.
- **`broken-references/` degrades gracefully.** Loaded through the real bootstrap path,
  asserted to leave the rest of the plugin usable. This is a real test rather than a gate
  meta-test, so it sits at `tests/plugin/` — its mirrored home — not under `tests/build/`.
  It simultaneously proves the fixture exercises the failure mode it claims to, rather than
  accidentally being a valid project file.
- **CI actually invokes the checks.** A test over the workflow definition confirming
  `npm run check` runs on every PR on both Ubuntu and Windows. Catches the case where the
  scripts pass locally but were never wired in, and the case where the two platforms drift
  by invoking different commands.

## 3. The Integration Test Vault

`tests/vault/` with the four cases the slice document names, plus `openFixtureVault(caseName)`
returning a disk-backed `FixtureVaultAdapter` implementing only the subset of the
`Vault`/metadata surface the repositories actually call.

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

**`large-project/` asserts an operation count, not a clock.** The slice document calls it "a
performance fixture", but this repository deliberately has no `npm run perf`, and a
wall-clock budget across Ubuntu 22/24/26 and Windows is a flake generator. `FakeVault.operations`
is already recorded in CLAUDE.md as "the instrument for asserting how MANY reads a repository
call costs — a count is otherwise invisible, because a correct answer arrives either way",
and it already caught `listByPlan` re-reading the whole sidecar once per zone. So the
assertion is that an index rebuild over N notes costs O(N) reads rather than O(N²) —
deterministic, no clock, and it catches the shape that actually bit this codebase. The
adapter carries the same recorder for that reason.

## 4. One item folded in

A check that no `tests/**/*.spec.ts` exists and every `*.test.ts` on disk is collected.
`vitest.config.ts`'s `include` is `['tests/**/*.test.ts']`, so a `.spec.ts` file under
`tests/` is a suite that never runs and nothing says so. Measured: zero such files exist
today under either `tests/` or `src/`, which is what makes this a cheap lock rather than a
cleanup.

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
