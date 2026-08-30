# Slice 12 Architecture Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the architecture-enforcement harness and the Integration Test Vault for slice 12's infrastructure half, so that CLAUDE.md's claim "a violation fails `npm run lint` rather than waiting for review" is checked at the forbidden thing rather than asserted in prose.

**Architecture:** Every deliverable is a test or a test helper under `tests/`. Nothing is added to `src/`, so the shipped bundle and the coverage denominator are both untouched. The layer-boundary meta-test drives the real ESLint through `tests/helpers/eslint.ts` against synthetic code at real and synthetic paths; the fixture vault adds a disk-backed adapter beside the existing `FakeVault` rather than replacing it.

**Tech Stack:** TypeScript, Vitest 4.x, ESLint 10 flat config (`eslint.config.mjs`), typescript-eslint project service, fallow (`npm run analyze`), Node `^22.22.2 || ^24.15.0 || >=26.0.0`.

**Spec:** `docs/superpowers/specs/2026-08-29-slice-12-testing-and-architecture-enforcement-design.md` — read it alongside this plan. Every task below cites the section it implements; where this plan and the spec disagree, the spec is the authority and this plan is the bug.

## Global Constraints

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests + fallow. All four pass before every commit. CI runs the same command verbatim on Ubuntu 22/24/26 and Windows 22.
- **Branch:** `claude/next-slice-planning-gzjphh`. Never push to another branch.
- **No model identifier** in commit messages, PR titles or bodies, code comments, or any other repository artifact.
- **Coverage floors** are 99/99/99/98 (statements/functions/lines/branches). Everything this slice builds lives under `tests/`, outside `vitest.config.ts`'s coverage `include` of `src/**/*.{ts,vue}`, so it enters neither numerator nor denominator. Read the live floors with `npm run test:coverage`; never trust a figure quoted in a document.
- **`ESLINT_BOOT_MS` is `60_000`**, exported from `tests/helpers/eslint.ts`. Every new `tests/build/` file that drives ESLint uses it on its `beforeAll`.
- **A warm-up is two calls, not one.** `warmUpEslint()` resolves configuration only; the first type-aware `.ts` `lintText` call additionally builds the project-service program (~1.4s locally, ~5.1s under coverage instrumentation). Both go in the same `beforeAll`.
- **Vitest collects `tests/**/*.test.ts` only**, with `environment: 'node'` as the default and jsdom opted in per file by docblock.
- **Nothing enters ESLint's `ignores`.** `tests/build/suppressions.test.ts` asserts no file suppresses a rule; a fixture added to `ignores` would make a meta-test lint a file ESLint skips and pass vacuously.
- **An invariant asserted in a comment gets a test that fails without it**, and the test is watched failing: mutate, run, see red, restore. Every task below that adds an assertion names its mutation.
- **Which mutation to write is decided by the fix's own SHAPE.** `CLAUDE.md` states two variants and this plan's review added a third, each learned by a suite passing while a defect stood:
  - a fix that is a **refusal** → write the WIDENED refusal and run it; the suite tends to cover the thing refused and not the thing still allowed.
  - a fix that is an **ordering** → write the PARTIAL reordering and run it; moving a call part of the way passes the reported case and leaves its sibling live.
  - a fix that guards **one level of a nested structure** → ask what the ENCLOSING level can express. Task 7's step-condition assertion was written to close a hole and reopened it one level up: GitHub supports `jobs.<job_id>.if` as well as a step's, so gating the job leaves the guarded step perfectly intact and unrun. The same applies to a config block inside a block, a matrix inside a job, and a glob inside a glob.
  - and the variant running through every one of them: a fix that guards **one of several** things → drop the other arms and run it.
- **A failure assertion is vacuous unless it discriminates the CAUSE of the failure.** Every test in this plan that asserts something failed also asserts *why*.
- **No `.spec.ts` file** is created anywhere. Fixtures that must not be collected use `*.fixture.ts`.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `tests/helpers/eslint.ts` | Modified: add `lintDetailed` returning `(ruleId, line)` pairs | 1 |
| `tests/helpers/eslint.test.ts` | New: the helper's own discrimination test | 1 |
| `tests/build/layer-boundaries.test.ts` | New: block discovery, membership pin, probe matrix, both directions | 2, 3, 4 |
| `tests/build/spec-files.test.ts` | New: no `.spec.ts` under `tests/` or `src/`; every `*.test.ts` collected | 5 |
| `tests/build/test-environments.test.ts` | New: effective-environment guard over the inner layers and contract callers | 6 |
| `tests/build/ci-invokes-check.test.ts` | New: CI workflow invokes `npm run check` on both platforms and both triggers | 7 |
| `tests/build/fixtures/indirectDom.fixture.ts` | New: a `domain`-shaped module reaching a DOM global through a helper | 8 |
| `tests/domain/nodeEnvironment.test.ts` | New: importing that fixture under node throws the planted `ReferenceError` | 8 |
| `tests/build/fixtures/brokenFake.fixture.ts` | New: a `save()` that drops `name`, run through `zoneRepositoryContract` | 9 |
| `tests/build/fixtures/vitest.brokenFake.config.ts` | New: minimal child config whose `include` names `*.fixture.ts` | 9 |
| `tests/build/contractDiscriminates.test.ts` | New: spawns the child run, asserts exit code, collected count, case name, failing assertion | 9 |
| `.fallowrc.json` | Modified: declare the fixture and its config as a seventh `entry` kind | 9 |
| `tests/helpers/fixtureVault.ts` | New: `FixtureVaultAdapter` + `openFixtureVault` returning a fixture repository stack | 10 |
| `tests/helpers/fixtureVault.test.ts` | New: the three hardening rules as adapter conformance cases | 10 |
| `tests/vault/broken-references/` | New: fixture content; a zone whose `plan` names a plan that does not exist | 11 |
| `tests/plugin/brokenReferences.test.ts` | New: index builds fully, planted read refuses, healthy record still loads | 11 |
| `tests/vault/legacy-schema/` | New: fixture content at the version below a test-only step | 12 |
| `tests/infrastructure/persistence/migration/legacyFixture.test.ts` | New: a test-only step applies, is idempotent, leaves a current note alone | 12 |
| `tests/vault/valid-project/` | New: fixture content, no consumer this slice | 13 |
| `docs/tasks/12-testing-and-architecture-enforcement-infrastructure.md` | Modified: record what is open and what is withdrawn, never ticked | 13 |

---

## Task 1: `lintDetailed` — one diagnostic per planted import

Implements the spec's "Batching and per-spelling mutation are in tension" paragraph. `lintText` returns rule IDs and nothing else, so a batched probe asserting `toContain('no-restricted-imports')` passes when *any* of its imports reports — a spelling that goes silent is invisible. A new export rather than a change to `lintText`, because five existing test files consume its current shape and none needs the detail.

**Files:**
- Modify: `tests/helpers/eslint.ts` (append after the existing `lintText` export)
- Test: `tests/helpers/eslint.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export interface Diagnostic { readonly ruleId: string; readonly line: number }` and `export const lintDetailed: (code: string, filePath: string) => Promise<Diagnostic[]>`. Tasks 2–4 consume both. `ruleId` carries the same `PARSE_ERROR` / `NOT_LINTED` sentinels `lintText` uses; `line` is `0` for a diagnostic ESLint reports without one.

- [ ] **Step 1: Write the failing test**

Create `tests/helpers/eslint.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintDetailed, warmUpEslint } from './eslint';

/**
 * One `beforeAll` for ESLint's boot AND for the first type-aware program build —
 * `warmUpEslint` resolves configuration only and never invokes the parser, so without the
 * second call the program build lands in whichever test body runs first, against vitest's
 * 5s default.
 */
beforeAll(async () => {
	await warmUpEslint();
	await lintDetailed('export const probe = 1;\n', 'src/core/identity/generateId.ts');
}, ESLINT_BOOT_MS);

const CORE = 'src/core/identity/generateId.ts';

describe('lintDetailed', () => {
	it('reports one diagnostic per planted import, each carrying its own line', async () => {
		const found = await lintDetailed(`import '../../domain';\nimport { ref } from 'vue';\n`, CORE);
		const restricted = found.filter((d) => d.ruleId === 'no-restricted-imports');

		expect(restricted.map((d) => d.line)).toEqual([1, 2]);
	});

	it('discriminates a silent spelling from a reporting one, which a rule-id array cannot', async () => {
		const found = await lintDetailed(`import '../../core/identity/generateId';\nimport { ref } from 'vue';\n`, CORE);
		const restricted = found.filter((d) => d.ruleId === 'no-restricted-imports');

		// Line 1 is `core` reaching itself — allowed. Only line 2 may report.
		expect(restricted.map((d) => d.line)).toEqual([2]);
	});

	it('names a parse failure rather than reporting an absent rule id', async () => {
		const found = await lintDetailed('export const broken = ;\n', CORE);

		expect(found.map((d) => d.ruleId)).toContain('PARSE_ERROR');
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/helpers/eslint.test.ts`
Expected: FAIL — `lintDetailed` is not exported from `./eslint`.

- [ ] **Step 3: Add the export**

Append to `tests/helpers/eslint.ts`, below `lintText`:

```ts
/** One reported diagnostic: which rule fired, and on which line of the linted text. */
export interface Diagnostic {
	readonly ruleId: string;
	readonly line: number;
}

/**
 * `lintText` with the LINE kept — the shape a batched probe needs.
 *
 * A probe that plants several forbidden imports in one module and asserts
 * `toContain('no-restricted-imports')` passes when ANY of them reports, so a spelling that
 * silently becomes allowed is invisible while its neighbours still fire. Matching one
 * diagnostic per planted line is what tells those two worlds apart. Asserting the COUNT
 * alone was the cheaper option and is not enough: it survives one import going silent while
 * another reports twice.
 *
 * A separate export rather than a widening of `lintText`, because five existing test files
 * consume that array-of-ids shape and none of them needs the detail.
 *
 * `line` is `0` for a diagnostic ESLint reports without one, so the field is always a
 * number and a caller never has to narrow it.
 */
export const lintDetailed = async (code: string, filePath: string): Promise<Diagnostic[]> => {
	const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });

	if (result === undefined) return [{ ruleId: 'NOT_LINTED', line: 0 }];

	return result.messages.map((message) => ({
		ruleId: message.ruleId ?? 'PARSE_ERROR',
		line: message.line ?? 0,
	}));
};
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/helpers/eslint.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Watch the discrimination case fail against the weaker helper**

Temporarily change the second test's assertion to `expect(restricted.length).toBeGreaterThan(0)` and confirm it passes with `line` ignored — that is the vacuity being replaced. Restore the `toEqual([2])` assertion.

This step produces no commit. It is the "watched failing" rule applied to the helper itself: a helper built to discriminate is worth nothing until you have seen the weaker assertion pass in the same place.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add tests/helpers/eslint.ts tests/helpers/eslint.test.ts
git commit -m "Report lint diagnostics with their lines, so a batched probe can discriminate"
```

---

## Task 2: Discover the blocks, and pin the set by exact membership

Implements the spec's "WHICH blocks exist is read from the config; WHAT each must forbid comes from an independent oracle". The block list was hand-written three times in the design and was short every time. Discovery cannot be self-declaration — but *which blocks exist* is a fact about the config, and only *what each forbids* comes from the SDD.

**Measured before writing this task, and it corrects the spec's figure:** the config declares `no-restricted-imports` in **13** blocks, not eleven. Two of them set the rule to `"off"` — they come from the shared JS/TS base configs and match `**/*.{js,cjs,mjs,jsx}` and `**/*.{ts,cts,mts,tsx}`. Eleven blocks declare an actual ban, which is where the spec's figure comes from. Both `off` blocks are ordered *before* the layer blocks, so the layer bans win the override; an `off` block reordered *after* them would silently disable every layer ban at once, which is exactly why the pin records all 13 with their severity rather than only the eleven that ban something.

**Files:**
- Create: `tests/build/layer-boundaries.test.ts`

**Interfaces:**
- Consumes: `lintDetailed`, `Diagnostic`, `warmUpEslint`, `ESLINT_BOOT_MS` from Task 1.
- Produces: `const BAN_BLOCKS: readonly BlockProbe[]` — the eleven ban-declaring blocks, each `{ key, path, extensions, forbidden, allowed }` — consumed by Tasks 3 and 4 in the same file. `key` is the block's first `files` glob, which is what the membership pin is keyed on.

- [ ] **Step 1: Write the failing test**

Create `tests/build/layer-boundaries.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { dirname, relative, sep } from 'node:path';
import eslintConfig from '../../eslint.config.mjs';
import { ESLINT_BOOT_MS, lintDetailed, warmUpEslint } from '../helpers/eslint';

/**
 * The layer boundary, checked AT THE FORBIDDEN THING.
 *
 * CLAUDE.md's headline claim is that `eslint.config.mjs` enforces the SDD's layering "so a
 * violation fails `npm run lint` rather than waiting for review". Before this file, six of
 * the 35 declared cells had ever been fired — five of them only at the two `networkFree`
 * paths, whose whole purpose is restating a parent ban — so that claim rested on reading the
 * config rather than on driving it.
 *
 * Two things are deliberately kept apart, and conflating them is what this file refuses:
 * WHICH blocks exist is discovered from the config, because a hand-written block list was
 * short three times running; WHAT each block must forbid is transcribed from an independent
 * oracle, because deriving expectations from the config under test is the self-declared-list
 * defect this repository already names.
 */
beforeAll(async () => {
	await warmUpEslint();
	await lintDetailed('export const probe = 1;\n', 'src/core/identity/generateId.ts');
}, ESLINT_BOOT_MS);

/** Every block declaring the rule, keyed by its first `files` glob, with its severity. */
const declaringBlocks = (): Map<string, string> => {
	const found = new Map<string, string>();
	for (const block of eslintConfig as readonly { files?: unknown; rules?: Record<string, unknown> }[]) {
		const rule = block.rules?.['no-restricted-imports'];
		if (rule === undefined) continue;
		const files = Array.isArray(block.files) ? block.files : [block.files];
		const key = String(files[0]);
		found.set(key, rule === 'off' ? 'off' : 'error');
	}
	return found;
};

describe('the blocks declaring no-restricted-imports', () => {
	/**
	 * Pinned by EXACT membership, the way `guardCategory.test.ts` and `entityRef.test.ts`
	 * pin their own sets: a block appearing or disappearing fails here instead of quietly
	 * changing the probe set below.
	 *
	 * The two `off` entries are the shared JS/TS base configs disabling the base rule. They
	 * are pinned WITH their severity because ordering is what makes them harmless: both sit
	 * before the layer blocks, so the layer bans win the override. An `off` block reordered
	 * after them would disable every layer ban at once.
	 */
	it('is exactly this set, with exactly these severities', () => {
		expect(Object.fromEntries(declaringBlocks())).toEqual({
			'**/*.{js,cjs,mjs,jsx}': 'off',
			'**/*.{ts,cts,mts,tsx}': 'off',
			'**/src/**/*.ts': 'error',
			'**/src/core/**/*.ts': 'error',
			'**/src/domain/**/*.ts': 'error',
			'**/src/application/**/*.ts': 'error',
			'**/src/infrastructure/**/*.ts': 'error',
			'**/src/presentation/**/*.ts': 'error',
			'**/src/plugin/**/*.ts': 'error',
			'**/src/*.ts': 'error',
			'**/src/presentation/dialogs/**/*.ts': 'error',
			'**/src/application/queries/**/*.ts': 'error',
			'**/src/infrastructure/logging/**/*.ts': 'error',
		});
	});

	it('has one probe entry per ban-declaring block', () => {
		const banning = [...declaringBlocks()].filter(([, severity]) => severity === 'error').map(([key]) => key);

		expect(BAN_BLOCKS.map((block) => block.key).sort()).toEqual([...banning].sort());
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL — `BAN_BLOCKS` is not defined.

- [ ] **Step 3: Add the probe table**

Insert above the `describe` block, below the `declaringBlocks` helper:

```ts
/** One planted import: the specifier, and the shape it exercises. */
interface Planted {
	readonly specifier: string;
	readonly shape: 'barrel' | 'one-level' | 'nested' | 'package' | 'package-subpath';
}

interface BlockProbe {
	/** The block's first `files` glob — the key the membership pin above is keyed on. */
	readonly key: string;
	/** A REAL `.ts` file in the block's scope. A nonexistent `.ts` path cannot be parsed. */
	readonly path: string;
	/** Every parseable shippable extension this block's `files` expansion covers. */
	readonly extensions: readonly string[];
	/** What the oracle says this block forbids. */
	readonly forbidden: readonly Planted[];
	/** One import the block must NOT report, keyed on the layer rather than firing always. */
	readonly allowed: string;
	/**
	 * Whether this block also bans the network GLOBALS. A separate flag because they report
	 * under a different rule key — `no-restricted-globals`, measured — so the matrix's
	 * `no-restricted-imports` assertions cannot see them at all.
	 */
	readonly networkGlobals?: boolean;
}

/**
 * Every parseable shippable extension. `.tsx`, `.mts` and `.cts` are absent and the reason
 * is NOT that no fixture exists for them: `eslint-plugin-obsidianmd` applies
 * `recommendedTypeChecked` to `**\/*.{ts,cts,mts,tsx}` while the only block granting
 * `parserOptions.projectService` is scoped to `**\/*.ts`, so those three get no parser
 * services and throw `@typescript-eslint/await-thenable`. `eslint.config.mjs`'s own comment
 * records the decisive measurement: a nonexistent path and a real file written to `src/` and
 * then removed throw the IDENTICAL error. The prerequisite is widening the parser-options
 * scope, not adding a fixture.
 */
const EXTENSIONS = ['ts', 'vue', 'js', 'jsx', 'mjs', 'cjs'] as const;

/**
 * How a file at `path` spells its way back up to `src/` — DERIVED, never hand-written.
 *
 * Four entries in the first draft of this table carried a hand-written depth and all four
 * were wrong, in BOTH directions: `presentation/dialogs`, `application/queries` and
 * `infrastructure/logging` sit two levels below `src/` and were given three, while the
 * `infrastructure` probe at `persistence/dto/planGeometry.ts` sits three levels down and was
 * given two. A review bot caught one of the four and read the rest as the same off-by-one;
 * they are not one error, they are a per-file fact got wrong four times by eye.
 *
 * The verdicts were unaffected — measured: `no-restricted-imports` matches the raw specifier
 * text, so `**\/application` matches `../../application` and `../../../application` alike, and
 * every cell reported identically at either depth. What was wrong is FIDELITY: a probe
 * spelling `../../../application` from a dialog exercises an import no dialog could contain,
 * since it resolves outside the repository. A matrix that fires on a specifier production
 * cannot write is testing a spelling nobody uses.
 *
 * Derived rather than corrected, because correcting four values leaves the fifth to be got
 * wrong by the next author.
 */
const toSrc = (path: string): string => `${relative(dirname(path), 'src').split(sep).join('/')}/`;

/** Every shape a group glob can protect. `**\/${g}` alone matches the barrel. */
const layerShapes = (layer: string, depth: string): readonly Planted[] => [
	{ specifier: `${depth}${layer}`, shape: 'barrel' },
	{ specifier: `${depth}${layer}/thing`, shape: 'one-level' },
	{ specifier: `${depth}${layer}/nested/thing`, shape: 'nested' },
];

/** Both entry forms a banned package expands to, which ARE independent of each other. */
const packageShapes = (name: string): readonly Planted[] => [
	{ specifier: name, shape: 'package' },
	{ specifier: `${name}/sub`, shape: 'package-subpath' },
];
```

- [ ] **Step 4: Add the eleven entries, transcribed from the oracle**

Append below `packageShapes`. Every `forbidden` list is transcribed from the source named in its comment — never read out of `eslint.config.mjs`.

```ts
const PKG = ['vue', 'pinia', 'konva', 'vue-konva', 'obsidian'] as const;

/**
 * What `networkFree(...)` adds ON TOP of its parent layer's ban — slice 11's Definition of
 * Done item 7, transcribed from there rather than read out of the config.
 *
 * Probing these is not optional and the reason is the override mechanic: two blocks matching
 * one file OVERRIDE `no-restricted-imports`, so if an extension were dropped from either
 * network block the PARENT layer block still matches and still reports every layer-shaped
 * import planted here. The layer probes would stay green while network access became allowed
 * in that extension — and `network-boundary.test.ts` would not see it either, since it drives
 * `.ts` paths only. The extension matrix promises this and only these probes deliver it.
 */
const NETWORK_MODULES = ['node:https', 'https', 'node:net', 'electron'] as const;
const networkShapes = (): readonly Planted[] => [
	...NETWORK_MODULES.map((name) => ({ specifier: name, shape: 'package' as const })),
	// Subpaths are a separate `patterns` entry, independent of the `paths` one above.
	{ specifier: 'node:https/agent', shape: 'package-subpath' },
];
const PROTOTYPES = (depth: string): readonly Planted[] => [
	{ specifier: `${depth}prototypes`, shape: 'barrel' },
	{ specifier: `${depth}prototypes/ZoneSummary.vue`, shape: 'one-level' },
	{ specifier: `${depth}prototypes/nested/Thing.vue`, shape: 'nested' },
];

/**
 * SDD §8 for the six layers; slice 15's Definition of Done for `presentation/dialogs`;
 * slice 11's Definition of Done item 7 for the two `networkFree` subtrees; and
 * `src/prototypes/README.md`'s one-way-door rule for the prototypes group. Four sources,
 * because `presentation/dialogs` forbids more than the SDD's layering statement does —
 * transcribing from the SDD alone could not produce those cases.
 */
const BAN_BLOCKS: readonly BlockProbe[] = [
	{
		key: '**/src/core/**/*.ts',
		path: 'src/core/identity/generateId.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('domain', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('application', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('infrastructure', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('presentation', toSrc('src/core/identity/generateId.ts')),
			...layerShapes('plugin', toSrc('src/core/identity/generateId.ts')),
			...PKG.flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/core/identity/generateId.ts')),
		],
		allowed: '../geometry/operations',
	},
	{
		key: '**/src/domain/**/*.ts',
		path: 'src/domain/requirement/Requirement.errors.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('application', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('infrastructure', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('presentation', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...layerShapes('plugin', toSrc('src/domain/requirement/Requirement.errors.ts')),
			...PKG.flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/domain/requirement/Requirement.errors.ts')),
		],
		allowed: `${toSrc('src/domain/requirement/Requirement.errors.ts')}core`,
	},
	{
		key: '**/src/application/**/*.ts',
		path: 'src/application/editor/WriteLedger.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('infrastructure', toSrc('src/application/editor/WriteLedger.ts')),
			...layerShapes('presentation', toSrc('src/application/editor/WriteLedger.ts')),
			...layerShapes('plugin', toSrc('src/application/editor/WriteLedger.ts')),
			...PKG.flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/application/editor/WriteLedger.ts')),
		],
		allowed: `${toSrc('src/application/editor/WriteLedger.ts')}domain`,
	},
	{
		key: '**/src/infrastructure/**/*.ts',
		path: 'src/infrastructure/persistence/dto/planGeometry.ts',
		extensions: EXTENSIONS,
		// `obsidian` is this layer's job and is deliberately absent from the ban.
		forbidden: [
			...layerShapes('presentation', toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
			...layerShapes('plugin', toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
			...(['vue', 'pinia', 'konva', 'vue-konva'] as const).flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/infrastructure/persistence/dto/planGeometry.ts')),
		],
		allowed: 'obsidian',
	},
	{
		key: '**/src/presentation/**/*.ts',
		path: 'src/presentation/editor/deleteZoneFlow.ts',
		extensions: EXTENSIONS,
		forbidden: [...layerShapes('infrastructure', toSrc('src/presentation/editor/deleteZoneFlow.ts')), ...layerShapes('plugin', toSrc('src/presentation/editor/deleteZoneFlow.ts')), ...PROTOTYPES(toSrc('src/presentation/editor/deleteZoneFlow.ts'))],
		allowed: 'vue',
	},
	{
		key: '**/src/plugin/**/*.ts',
		path: 'src/plugin/RenovationPlannerPlugin.ts',
		extensions: EXTENSIONS,
		// The composition root may reach every layer. Only the prototypes door stays shut.
		forbidden: PROTOTYPES(toSrc('src/plugin/RenovationPlannerPlugin.ts')),
		allowed: `${toSrc('src/plugin/RenovationPlannerPlugin.ts')}infrastructure/logging/diagnosticsLedger`,
	},
	{
		key: '**/src/*.ts',
		path: 'src/main.ts',
		extensions: EXTENSIONS,
		// The ROOT block, spelled from outside `forbidden()`'s machinery.
		forbidden: PROTOTYPES(toSrc('src/main.ts')),
		allowed: `${toSrc('src/main.ts')}plugin/RenovationPlannerPlugin`,
	},
	{
		key: '**/src/presentation/dialogs/**/*.ts',
		path: 'src/presentation/dialogs/dialog-store.ts',
		extensions: EXTENSIONS,
		// Slice 15's Definition of Done: dialogs reach neither application nor infrastructure
		// nor plugin nor the event bus. More than SDD §8 forbids, which is why the oracle is
		// four documents rather than one.
		//
		// `core/events` is the half a first draft of this table omitted while its own comment
		// named it — the oracle says "nor the event bus" and the array did not carry it.
		// Measured: `../../../core/events` and `../../../core/events/bus` both report from
		// this path, while plain `../../../core` does not. `vue-rules.test.ts` exercises one
		// `.ts` spelling of it, so dropping the barrel restriction or an extension would have
		// left the promised matrix green.
		forbidden: [
			...layerShapes('application', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('infrastructure', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('plugin', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...layerShapes('core/events', toSrc('src/presentation/dialogs/dialog-store.ts')),
			...PROTOTYPES(toSrc('src/presentation/dialogs/dialog-store.ts')),
		],
		// `core` itself, deliberately — the SHARPEST negative available here, because it
		// proves the ban is keyed on `core/events` rather than on the whole of `core`. `vue`
		// would pass against a build that banned all of `core` from dialogs.
		allowed: `${toSrc('src/presentation/dialogs/dialog-store.ts')}core`,
	},
	{
		key: '**/src/application/queries/**/*.ts',
		path: 'src/application/queries/GetPlan.ts',
		extensions: EXTENSIONS,
		// Slice 11 item 7: the parent APPLICATION ban restated, because two blocks matching
		// one file override rather than merge. A group dropped from the parent goes quiet here.
		forbidden: [
			...layerShapes('infrastructure', toSrc('src/application/queries/GetPlan.ts')),
			...layerShapes('presentation', toSrc('src/application/queries/GetPlan.ts')),
			...layerShapes('plugin', toSrc('src/application/queries/GetPlan.ts')),
			...PKG.flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/application/queries/GetPlan.ts')),
			...networkShapes(),
		],
		// The only two blocks with a network ban, so the only two carrying `networkGlobals`.
		networkGlobals: true,
		allowed: `${toSrc('src/application/queries/GetPlan.ts')}domain`,
	},
	{
		key: '**/src/infrastructure/logging/**/*.ts',
		path: 'src/infrastructure/logging/diagnosticsLedger.ts',
		extensions: EXTENSIONS,
		forbidden: [
			...layerShapes('presentation', toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...layerShapes('plugin', toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...(['vue', 'pinia', 'konva', 'vue-konva'] as const).flatMap(packageShapes),
			...PROTOTYPES(toSrc('src/infrastructure/logging/diagnosticsLedger.ts')),
			...networkShapes(),
		],
		// The only two blocks with a network ban, so the only two carrying `networkGlobals`.
		networkGlobals: true,
		allowed: 'obsidian',
	},
	{
		key: '**/src/**/*.ts',
		// The CATCH-ALL block: subtrees no `forbidden()` call names. `src/prototypes/` is the
		// only one, and it holds five `.vue` files and one `.md` — no `.ts` at all, measured.
		// So this block is probed at a nonexistent `.vue` path and NOT at `.ts`; see the
		// recorded gap in the extension loop below.
		path: 'src/nowhere/Fixture.vue',
		extensions: ['vue', 'js', 'jsx', 'mjs', 'cjs'],
		forbidden: PROTOTYPES(toSrc('src/nowhere/Fixture.vue')),
		allowed: `${toSrc('src/nowhere/Fixture.vue')}core`,
	},
];
```

- [ ] **Step 5: Run the two discovery tests**

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Watch the membership pin fail**

Temporarily delete the `'**/src/presentation/dialogs/**/*.ts': 'error'` line from the expected object and re-run.
Expected: FAIL, naming the missing key. Restore it.

Then temporarily comment out the `networkFree('infrastructure/logging', …)` call in `eslint.config.mjs` and re-run.
Expected: FAIL on both tests — the pin loses a key and `BAN_BLOCKS` has an entry the config no longer declares. Restore it.

- [ ] **Step 7: Commit**

```bash
npm run check
git add tests/build/layer-boundaries.test.ts
git commit -m "Discover the blocks declaring the layer ban, and pin the set by exact membership"
```

---

## Task 3: Fire every cell — the positive direction

Implements the spec's `(block × extension × import shape)` matrix. Fixing each dimension separately is what left their product open twice: the root, catch-all and `presentation/dialogs` blocks each declare their own `files` expansion over `SRC_EXTENSIONS`, so removing `.jsx`, `.mjs` or `.cjs` from *one of those* changes nothing a layer-path probe can see.

**Files:**
- Modify: `tests/build/layer-boundaries.test.ts`

**Interfaces:**
- Consumes: `BAN_BLOCKS`, `Planted`, `EXTENSIONS`, `lintDetailed` from Task 2.
- Produces: `const probe: (block: BlockProbe, extension: string) => Promise<Diagnostic[]>` — Task 4 reuses it for the negative direction.

- [ ] **Step 1: Write the failing test**

Append to `tests/build/layer-boundaries.test.ts`:

```ts
/**
 * `lintText` takes ONE path, and the extension in that path is what selects the applicable
 * `files` globs — so imports combined into one synthetic module cannot exercise `.js`,
 * `.jsx`, `.mjs`, `.cjs` and `.vue` at once. One call per (block, extension) pair, each
 * carrying that block's every forbidden import in every shape.
 */
const sourceFor = (block: BlockProbe, extension: string): string => {
	const body = block.forbidden.map((planted) => `import '${planted.specifier}';`).join('\n');
	if (extension !== 'vue') return `${body}\n`;
	return `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n`;
};

/** The `.ts` probe uses the block's REAL path; every other extension is synthetic. */
const pathFor = (block: BlockProbe, extension: string): string =>
	extension === 'ts' ? block.path : block.path.replace(/[^/]+$/u, extension === 'vue' ? 'Fixture.vue' : `fixture.${extension}`);

/** An SFC's script block starts on line 3, so a planted import's line is offset. */
const lineOffset = (extension: string): number => (extension === 'vue' ? 2 : 0);

const probe = (block: BlockProbe, extension: string): Promise<Diagnostic[]> =>
	lintDetailed(sourceFor(block, extension), pathFor(block, extension));

describe.each(BAN_BLOCKS)('$key', (block) => {
	describe.each(block.extensions)('.%s', (extension) => {
		it('reports one diagnostic for every forbidden import, on its own line', async () => {
			const found = await probe(block, extension);
			const reported = found
				.filter((d) => d.ruleId === 'no-restricted-imports')
				.map((d) => d.line - lineOffset(extension))
				.sort((a, b) => a - b);

			// One per planted line, in order. A COUNT alone survives one import going silent
			// while another reports twice; matching the lines does not.
			expect(reported).toEqual(block.forbidden.map((_, index) => index + 1));
		});

		it('does not pass vacuously on a parse failure', async () => {
			const found = await probe(block, extension);

			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});

		/**
		 * The network GLOBALS, which the assertions above cannot reach.
		 *
		 * They report under `no-restricted-globals`, a different rule KEY — measured — so a
		 * matrix built entirely on `no-restricted-imports` is blind to them however many
		 * cells it has. Slice 11's diagnostics-stay-on-the-device claim rests on both halves,
		 * and only the import half had a probe.
		 *
		 * Skipped for every block that declares no network ban, rather than asserted absent:
		 * `no-restricted-globals` also carries `eslint-plugin-obsidianmd`'s own list (`app`,
		 * `fetch`, `localStorage`) across all of `src/`, so "this block does not ban fetch" is
		 * not a true statement about any block and a negative case here would assert
		 * something false.
		 */
		it.runIf(block.networkGlobals === true)('reports the network globals under their own rule', async () => {
			const body = `export const reach = () => fetch('https://example.invalid');`;
			const source =
				extension === 'vue' ? `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n` : `${body}\n`;
			const found = await lintDetailed(source, pathFor(block, extension));

			expect(found.map((d) => d.ruleId)).toContain('no-restricted-globals');
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});
	});
});
```

- [ ] **Step 2: Run and read the failures**

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: most cells PASS immediately — the config is correct today, so this matrix is measuring existing behaviour rather than driving new code. Any cell that fails is either a wrong `path`, a wrong specifier depth in `BAN_BLOCKS`, or a genuine hole in the config.

Fix `BAN_BLOCKS` entries until every cell passes. Do **not** relax an assertion to make a cell pass: if a forbidden import genuinely does not report, that is the finding this file exists to produce — record it in the task document under Task 13 and leave the cell red only if the spec says so.

- [ ] **Step 3: Record the one unfillable cell**

Add above the `describe.each`:

```ts
/**
 * The catch-all block × `.ts` has NO probeable path, and its cause is deliberately not
 * filed with the `.tsx`/`.mts`/`.cts` gap above though the symptom is identical.
 *
 * Those three fail because no block grants them parser services. This one fails because no
 * real `.ts` file exists in an unnamed subtree: a nonexistent `.ts` is refused by the project
 * service; the only real `.ts` outside the six layer subtrees is `src/main.ts`, which selects
 * the ROOT block; and `src/prototypes/` — the only unnamed subtree — holds five `.vue` files
 * and one `.md`, measured, no `.ts` at all.
 *
 * Widening parser options would fix those three and not this one; adding a file would fix
 * this one and not those three. Attributing a limitation to the wrong cause sends the next
 * reader to do work that cannot help.
 *
 * The three ways out are refused for stated reasons: a benign real `src/` module contradicts
 * this slice's scope and would ship in the bundle; widening `parserOptions.projectService` is
 * the bigger unrelated fix already recorded; and dropping the cell quietly is what the whole
 * cross-product exists to prevent.
 */
const RECORDED_GAPS = ['**/src/**/*.ts × ts', 'every block × tsx', 'every block × mts', 'every block × cts'] as const;

it('records the cells it cannot fire rather than skipping them', () => {
	const catchAll = BAN_BLOCKS.find((block) => block.key === '**/src/**/*.ts');

	expect(catchAll?.extensions).not.toContain('ts');
	expect(RECORDED_GAPS).toHaveLength(4);
});
```

- [ ] **Step 4: Watch the barrel spelling fail**

In `eslint.config.mjs`, inside `forbidden()`, change the group expansion from

```js
...groups.flatMap((g) => [`**/${g}`, `**/${g}/*`, `**/${g}/**/*`]),
```

to drop the barrel form:

```js
...groups.flatMap((g) => [`**/${g}/*`, `**/${g}/**/*`]),
```

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL on every layer block — the barrel-shaped planted import stops reporting and the line list is short. Restore the config.

This is the narrow mutation, not the coarse one. Removing a whole group from a `forbidden(...)` call reddens everything that group bans at once and cannot tell a suite that probes one import shape from one that probes three.

- [ ] **Step 5: Watch the package subpath fail**

In `eslint.config.mjs`, inside `forbidden()`, delete the patterns line for package subpaths:

```js
...packages.map((name) => `${name}/*`),
```

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL — the `package-subpath` planted import stops reporting while the bare `package` one still does. That is the exact failure the spec names: a bare `import { ref } from 'vue'` probe stays green while `import x from 'vue/dist/y'` becomes allowed in `core/`, `domain/` and `application/`. Restore the config.

- [ ] **Step 6: Watch an extension fail**

In `eslint.config.mjs`, remove `'mjs'` from `SRC_EXTENSIONS`.

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL on every block's `.mjs` cell with `NOT_LINTED` — a file matching no block's `files` is not linted at all under flat config. Restore the constant.

**What is NOT required, because it is impossible: a mutation per config PATTERN.** `**/${g}/*` and `**/${g}/**/*` are redundant, so deleting either alone changes no observable behaviour, and demanding a test catch it is demanding a test detect a no-op. The mutation list is "one per import shape a pattern uniquely protects", not "one per pattern".

- [ ] **Step 6b: Watch the network override fail**

The narrow mutation, not `SRC_EXTENSIONS` — dropping an extension there reddens every block and so cannot tell the network probes apart from the layer ones. In `eslint.config.mjs`, narrow `networkFree`'s returned `files` to `.ts` alone (`['**/src/application/queries/**/*.ts']` and `['**/src/infrastructure/logging/**/*.ts']`), so the override stops covering the other five extensions while the parent layer blocks still cover all of them.

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL on those two blocks' `.vue`, `.js`, `.jsx`, `.mjs` and `.cjs` cells — the network module imports and the `fetch` global stop reporting there — while every LAYER-shaped import in the same cells still reports, because the parent `application`/`infrastructure` block still matches. That asymmetry is the whole finding: without the network probes, this mutation leaves the matrix green and network access allowed in five extensions.

Confirm `tests/build/network-boundary.test.ts` also stays green under the mutation, since it drives `.ts` paths only. Restore the config.

- [ ] **Step 7: Measure the wall cost before committing**

Run: `npx vitest run tests/build/layer-boundaries.test.ts --reporter=verbose 2>&1 | tail -20`

Record the file's total duration. CLAUDE.md records six `tests/build/` files timing out under Windows file-parallelism, each booting a type-aware ESLint, and states that a test file's CPU cost is part of its correctness when anything in the suite waits in ticks. The boot dominates; roughly 130 cached calls at the 7–30ms range is 0.9–3.9 seconds on top of it.

If the file proves heavy, the fallback is unchanged: fold the cases into an existing ESLint-booting file rather than adding a seventh. Do not raise a timeout to make it fit.

- [ ] **Step 8: Run the gate and commit**

```bash
npm run check
git add tests/build/layer-boundaries.test.ts
git commit -m "Fire every block, extension and import shape of the layer ban"
```

---

## Task 4: The negative direction

Implements the spec's "Both directions, always". Without it, a rule that banned *every* import in *every* layer would pass the whole of Task 3. The negative half is what proves the rule is keyed on the layer.

**Files:**
- Modify: `tests/build/layer-boundaries.test.ts`

**Interfaces:**
- Consumes: `BAN_BLOCKS`, `probe`, `pathFor`, `lineOffset` from Tasks 2–3.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe.each(BAN_BLOCKS)` / `describe.each(block.extensions)` nesting, beside the two cases from Task 3:

```ts
		it('stays silent on an import this block allows', async () => {
			const body = `import '${block.allowed}';`;
			const source =
				extension === 'vue' ? `<template><div /></template>\n<script setup lang="ts">\n${body}\n</script>\n` : `${body}\n`;
			const found = await lintDetailed(source, pathFor(block, extension));

			expect(found.map((d) => d.ruleId)).not.toContain('no-restricted-imports');

			// The discriminator, and it matters MOST here. On a positive case a parse error
			// fails the assertion anyway, the rule id simply being absent. On this one it
			// makes the test pass VACUOUSLY — the same `ignores`-vacuity defect wearing a
			// different hat.
			expect(found.map((d) => d.ruleId)).not.toContain('PARSE_ERROR');
			expect(found.map((d) => d.ruleId)).not.toContain('NOT_LINTED');
		});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: PASS. If a block's `allowed` specifier reports, the specifier is wrong for that block's depth — fix `BAN_BLOCKS`, not the assertion.

- [ ] **Step 3: Watch it fail against a rule that fires everywhere**

In `eslint.config.mjs`, inside `forbidden()`, add `'core'` to every layer's forbidden groups by changing the `patterns` group array to include `'**/core'`, `'**/core/*'` and `'**/core/**/*'` unconditionally.

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL on `domain`'s and `application`'s negative case — their `allowed` import reaches `core`. That is the proof the negative half discriminates. Restore the config.

- [ ] **Step 4: Watch the vacuity guard fail**

Temporarily change one block's `path` to a nonexistent `.ts` path (`src/domain/__planted__.ts`).

Run: `npx vitest run tests/build/layer-boundaries.test.ts`
Expected: FAIL on that block's negative `.ts` case with `PARSE_ERROR` present — and note that **without** the `PARSE_ERROR` assertion the same case would have PASSED, because no rule id is reported at all. Confirm that by commenting the `PARSE_ERROR` line out and re-running: the case goes green against a path the parser cannot read. Restore both.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add tests/build/layer-boundaries.test.ts
git commit -m "Assert the layer ban is keyed on the layer, and cannot pass on a parse failure"
```

---

## Task 5: No `.spec.ts`, and every `*.test.ts` is collected

Implements spec §4. `vitest.config.ts`'s `include` is `['tests/**/*.test.ts']`, so a `.spec.ts` anywhere is a suite that never runs and nothing says so. Measured: zero such files exist today under either tree, which makes this a cheap lock rather than a cleanup.

The `src/` half is the one that matters more, because it is **build input**: an uncollected `.spec.ts` under `tests/` is dead weight, while one under `src/` is unexecuted test code inside the shipped tree.

**Files:**
- Create: `tests/build/spec-files.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

Create `tests/build/spec-files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { startVitest } from 'vitest/node';
import { REPO } from '../helpers/oxlint';

const walk = (dir: string): string[] => {
	const found: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name.startsWith('.')) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) found.push(...walk(full));
		else found.push(full);
	}
	return found;
};

const posix = (path: string): string => relative(REPO, path).split(sep).join('/');

describe('test file naming', () => {
	/**
	 * Both trees, because measuring a set and then guarding a subset of it is this
	 * repository's recurring failure in its smallest form. `src/` is the half that matters
	 * more: an uncollected `.spec.ts` under `tests/` is dead weight, while one under `src/`
	 * is unexecuted test code inside the SHIPPED tree.
	 */
	it.each(['tests', 'src'])('has no .spec.ts anywhere under %s/', (tree) => {
		const offenders = walk(join(REPO, tree))
			.map(posix)
			.filter((path) => path.endsWith('.spec.ts'));

		expect(offenders).toEqual([]);
	});

	/**
	 * And no `*.test.ts` under `src/` either, which neither rule above can see.
	 *
	 * The naming rule matches `.spec.ts` only, and the collection oracle below enumerates
	 * `tests/` only — so `src/foo.test.ts` is invisible to both while being exactly the case
	 * the `.spec.ts` rationale calls the one that matters most: build input, inside the
	 * shipped tree, never collected and never run. Reported by a review bot against a
	 * paragraph of mine arguing precisely why `src/` is the more important half.
	 *
	 * Rejecting it is the right rule rather than widening the collection oracle to `src/`,
	 * because the slice's own layout requirement is that every test of a `src/` module sits
	 * at its module's MIRRORED path under `tests/`. A collected `src/foo.test.ts` would
	 * satisfy an oracle and still violate the layout.
	 */
	it('has no .test.ts under src/, where a test file would be build input', () => {
		const offenders = walk(join(REPO, 'src'))
			.map(posix)
			.filter((path) => path.endsWith('.test.ts'));

		expect(offenders).toEqual([]);
	});

	/**
	 * The other half: a `*.test.ts` that exists on disk and is NOT collected is a suite
	 * nobody runs, which the naming rule alone cannot see. Asked of Vitest itself rather
	 * than by re-implementing the `include` glob, so a config change is answered by the
	 * thing that actually decides.
	 *
	 * `*.fixture.ts` is deliberately outside both rules: it is neither `.spec.ts` nor
	 * `.test.ts`, which is what lets Task 9's deliberately-failing fixture exist without
	 * either breaking the gate it is part of or colliding with this one.
	 */
	it('collects every *.test.ts on disk', async () => {
		const onDisk = walk(join(REPO, 'tests'))
			.map(posix)
			.filter((path) => path.endsWith('.test.ts'))
			.sort();

		const vitest = await startVitest('test', [], { run: true, watch: false, dir: 'tests' }, undefined, {
			stdout: process.stdout,
			stderr: process.stderr,
		});
		const collected = (vitest?.state.getFiles() ?? []).map((file) => posix(file.filepath)).sort();
		await vitest?.close();

		expect(collected).toEqual(onDisk);
	});
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/build/spec-files.test.ts`
Expected: the naming cases PASS. The collection case may need adjustment — `startVitest` runs the whole suite, which is far too expensive to nest inside one test.

- [ ] **Step 3: Replace the collection mechanism with a non-executing one**

Replace the `it('collects every *.test.ts on disk')` body with a collection-only query, which asks the same question without running anything:

```ts
	it('collects every *.test.ts on disk', async () => {
		const onDisk = walk(join(REPO, 'tests'))
			.map(posix)
			.filter((path) => path.endsWith('.test.ts'))
			.sort();

		const { createVitest } = await import('vitest/node');
		const vitest = await createVitest('test', { watch: false, dir: 'tests' });
		const specs = await vitest.globTestSpecifications();
		await vitest.close();

		const collected = [...new Set(specs.map((spec) => posix(spec.moduleId)))].sort();

		expect(collected).toEqual(onDisk);
	});
```

Remove the now-unused `startVitest` import.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/build/spec-files.test.ts`
Expected: PASS, 3 tests.

If `globTestSpecifications` is not available on the installed Vitest, read the API off the installed package (`node -e "import('vitest/node').then(m => console.log(Object.keys(m)))"`) and use whatever enumerates specifications without running them. Do **not** fall back to re-implementing the `include` glob in the test: a glob copied out of the config would agree with a typo in the config, which is the self-declared-list defect.

- [ ] **Step 5: Watch both halves fail**

```bash
printf "import { it } from 'vitest';\nit('x', () => {});\n" > src/nowhere.spec.ts
npx vitest run tests/build/spec-files.test.ts   # expect: the src/ naming case FAILS
rm src/nowhere.spec.ts

printf "import { it } from 'vitest';\nit('x', () => {});\n" > src/nowhere.test.ts
npx vitest run tests/build/spec-files.test.ts   # expect: the src/ .test.ts case FAILS
# and confirm it is the ONLY case that reddens: the .spec.ts rules and the collection
# oracle all stay green, which is why this needed a rule of its own rather than a wider glob.
rm src/nowhere.test.ts

printf "import { it } from 'vitest';\nit('x', () => {});\n" > tests/helpers/uncollected.test.ts
# temporarily narrow vitest.config.ts include to ['tests/build/**/*.test.ts']
npx vitest run tests/build/spec-files.test.ts   # expect: the collection case FAILS
# restore vitest.config.ts
rm tests/helpers/uncollected.test.ts
```

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add tests/build/spec-files.test.ts
git commit -m "Refuse a .spec.ts in either tree, and require every test file to be collected"
```

---

## Task 6: The inner layers execute in node — asked as the effective environment

Implements spec §5's replacement for the withdrawn two-project split. `environment: 'node'` is already the default with jsdom opted in per file, and *forgetting* a docblock fails loudly. The hole is the other direction: any test under `tests/domain/` or `tests/core/` can write `@vitest-environment jsdom` and silently switch off the indirect-DOM enforcement that counts as one of §8's two mechanisms. Measured: zero inner-layer tests use jsdom today, so the hole is latent rather than live.

**This predicate was corrected six times in design** — allowlist too far, denylist too short, `jsdom` named instead of "not node", one directive spelling of two, a directory wider than its invariant, and directives instead of the effective environment. Only this version asks the property directly. A **seventh** correction is the signal that the property cannot be stated at this seam and the structural split is the answer after all; §4a of the spec records that as the reversal condition.

**Two measurements taken before writing this task, both load-bearing:**
- Vitest 4 removed `environmentMatchGlobs` entirely — verified against the installed package. So the only two routes to a non-node environment are the per-file docblock and the project a spec belongs to, and `spec.project.config.environment` plus the docblock together *are* the effective environment.
- The directive regex Vitest matches with, read out of the installed `vitest` rather than assumed: `` /@(?:vitest|jest)-environment\s+([\w-]+)\b/ ``. The `-options` variants carry no environment name and are not a door. Note the `)` between the two words — a `grep` for the literal `jest-environment` in `node_modules/` comes back empty and means nothing.

**Files:**
- Create: `tests/build/test-environments.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

Create `tests/build/test-environments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { REPO } from '../helpers/oxlint';

/**
 * The inner layers execute in bare node — asked as the EFFECTIVE environment, not as a
 * text scan for one of the ways to change it.
 *
 * The node default is one of the two mechanisms SDD §8 credits with enforcing the layer
 * boundary, and it is the only one that catches an INDIRECT DOM reach: a `domain/` module
 * touching a DOM global through a helper has no import for a per-file lint rule to see.
 * Forgetting a jsdom docblock fails loudly — the DOM test dies under strict node — so the
 * hole this guards is the opposite one: ADDING a docblock where it does not belong, which
 * switches the backstop off with every gate green.
 *
 * A DENYLIST, not an allowlist. An allowlist says "jsdom is permitted here and nowhere
 * else", a claim about the whole tree that nothing needs and that goes stale every time a
 * legitimate DOM-touching helper appears somewhere new — measured, it rejects
 * `tests/helpers/obsidian-mock.test.ts` and `tests/build/entryDrawn.test.ts`, both of which
 * legitimately need jsdom. The subject is narrower: the inner layers' node enforcement.
 *
 * Not `jsdom` by name but "not node", because a rule with an implicit `else` claims
 * everything it never thought about.
 */
const PROTECTED_DIRECTORIES = ['tests/core/', 'tests/domain/', 'tests/application/'] as const;

/** The regex Vitest itself matches with, read out of the installed package, not assumed. */
const ENVIRONMENT_DIRECTIVE = /@(?:vitest|jest)-environment\s+([\w-]+)\b/u;

const posix = (path: string): string => relative(REPO, path).split(sep).join('/');

/**
 * Relative import specifiers — STATIC and DYNAMIC both, because both are graph edges.
 *
 * A first draft matched `(?:from|import)\s+['"]` only, which requires whitespace after the
 * keyword and so cannot see `await import('../x')` or `const m = import('../x')`. That is not
 * a hypothetical form in this repository: `tests/plugin/persistence-wiring.test.ts:35` reaches
 * the composition root exactly that way. A collected test reaching a contract through a helper
 * that imports it dynamically would have been classified as not-protected, free to select
 * jsdom with this guard green — the transitive hole closed one round earlier, reopened by the
 * matcher underneath it.
 *
 * What it still cannot see, written down rather than implied, because a matcher over source
 * text is partial by construction: a COMPUTED specifier (`import(someVariable)`), a
 * `require()`, and a re-export chain that leaves the relative tree and comes back. The first
 * is the one that would matter, and nothing in `tests/` writes one today — measured. If that
 * changes, the fix is not a longer regex but Vitest's own resolved module graph, which is the
 * only authority that cannot be partial.
 */
const importsOf = (file: string): string[] => {
	const source = readFileSync(file, 'utf8');
	const statik = [...source.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/gu)];
	const dynamic = [...source.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]/gu)];
	return [...statik, ...dynamic].map((match) => match[1] ?? '');
};

const resolveSpecifier = (from: string, specifier: string): string | null => {
	const base = resolve(dirname(from), specifier);
	for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
		try {
			readFileSync(candidate, 'utf8');
			return candidate;
		} catch {
			continue;
		}
	}
	return null;
};

/**
 * Whether a COLLECTED file reaches `tests/contracts/` through the import graph.
 *
 * Transitive rather than one hop, and the distinction is not academic: Vitest selects an
 * environment for the collected file, so a test reaching a contract through a helper has no
 * direct import from `tests/contracts/` and a one-hop predicate never classifies the file
 * whose environment actually decides. Today all six callers import directly — measured — so
 * a one-hop test happens to hold, which is exactly the kind of accident that stops holding
 * without telling anyone.
 */
const reachesContracts = (entry: string): boolean => {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		if (posix(file).startsWith('tests/contracts/')) return true;
		for (const specifier of importsOf(file)) {
			const target = resolveSpecifier(file, specifier);
			if (target !== null && !seen.has(target)) queue.push(target);
		}
	}
	return false;
};

describe('the inner layers execute in node', () => {
	it('resolves the effective environment of every collected file to node where it is protected', async () => {
		const { createVitest } = await import('vitest/node');
		const vitest = await createVitest('test', { watch: false });
		const specs = await vitest.globTestSpecifications();
		await vitest.close();

		const offenders: string[] = [];
		for (const spec of specs) {
			const path = posix(spec.moduleId);
			const protectedByDirectory = PROTECTED_DIRECTORIES.some((dir) => path.startsWith(dir));

			// The rule is STRUCTURAL: a file that invokes a repository contract runs in node.
			// Naming the six callers instead would be a list that goes stale — the allowlist
			// defect one level down — and a directory-wide ban on `tests/infrastructure/`
			// reaches past its own justification, since that layer may legitimately touch
			// the DOM.
			if (!protectedByDirectory && !reachesContracts(spec.moduleId)) continue;

			const declared = ENVIRONMENT_DIRECTIVE.exec(readFileSync(spec.moduleId, 'utf8'))?.[1];
			const effective = declared ?? spec.project.config.environment;
			if (effective !== 'node') offenders.push(`${path}: ${effective}`);
		}

		expect(offenders).toEqual([]);
	}, 120_000);
});
```

- [ ] **Step 2: Run it and watch it pass green on the tree as it stands**

Run: `npx vitest run tests/build/test-environments.test.ts`
Expected: PASS. Zero files under those directories use a non-node environment today, so it lands green.

- [ ] **Step 3: Watch it fail on the directory half**

```bash
# prepend a jsdom docblock to an inner-layer suite
sed -i '1i /** @vitest-environment jsdom */' tests/domain/*/*.test.ts
npx vitest run tests/build/test-environments.test.ts   # expect: FAIL, naming those files
git checkout -- tests/domain/
```

- [ ] **Step 4: Watch it fail on the contract-caller half, and on the JEST spelling**

```bash
sed -i '1i /** @jest-environment jsdom */' tests/infrastructure/obsidian/repositories/contract.test.ts
npx vitest run tests/build/test-environments.test.ts   # expect: FAIL, naming that file
git checkout -- tests/infrastructure/obsidian/repositories/contract.test.ts
```

Both halves matter: the contract callers sit in `tests/infrastructure/`, which is *not* one of the three protected directories, so only the structural predicate finds them. And `@jest-environment` is honoured by Vitest for Jest compatibility, so a guard that matched one spelling would leave the other door open.

- [ ] **Step 5: Watch the transitive half fail**

```bash
cat > tests/helpers/contractRelay.ts <<'EOF'
export { zoneRepositoryContract } from '../contracts/zone-repository.contract';
EOF
# point one contract caller at the relay instead of the contract, and add a jsdom docblock
```

Edit `tests/infrastructure/persistence/in-memory/inMemoryZoneRepository.test.ts` to import `zoneRepositoryContract` from `../../../helpers/contractRelay` and prepend `/** @vitest-environment jsdom */`.

Run: `npx vitest run tests/build/test-environments.test.ts`
Expected: FAIL, naming that file — the graph walk crosses the relay. Confirm the discrimination by temporarily replacing `reachesContracts` with a one-hop check (`importsOf(entry).some(...)`): the case goes GREEN with the defect present, which is the accident this predicate exists to survive.

Restore everything: `git checkout -- tests/` and `rm tests/helpers/contractRelay.ts`.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add tests/build/test-environments.test.ts
git commit -m "Resolve the effective environment of every protected suite, not its directives"
```

---

## Task 7: CI actually invokes the checks

Implements the last bullet of spec §2. Catches the case where the scripts pass locally but were never wired in, and the case where the two platforms drift by invoking different commands.

**Both triggers, not "every PR".** An earlier draft of the design said "on every PR", which leaves `push: branches: [main]` free to be removed or narrowed with the test still green — and direct commits to `main` would then bypass every architecture gate this slice builds. §8's wording is "every push/PR".

**Files:**
- Create: `tests/build/ci-invokes-check.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

Create `tests/build/ci-invokes-check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { REPO } from '../helpers/oxlint';

interface Workflow {
	readonly on: { readonly push?: { readonly branches?: readonly string[] }; readonly pull_request?: unknown };
	readonly jobs: Record<
		string,
		{
			readonly strategy?: { readonly matrix?: { readonly include?: readonly { os: string }[] } };
			// `if` is part of the shape at BOTH levels deliberately: the unconditional-execution
			// case below reads them, and a type that omitted either would make that assertion
			// unwritable. The JOB-level one is the half a first draft missed — see that case.
			readonly if?: string;
			readonly steps?: readonly { run?: string; if?: string }[];
		}
	>;
}

const workflow = parse(readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8')) as Workflow;

describe('CI invokes the definition of done', () => {
	/**
	 * BOTH triggers. "On every PR" leaves the push trigger free to be removed or narrowed
	 * with this test still green, and direct commits to `main` then bypass every
	 * architecture gate. SDD §8's wording is "every push/PR"; this matches it.
	 */
	it('runs on pull requests and on pushes to main', () => {
		expect(workflow.on.pull_request).toBeDefined();
		expect(workflow.on.push?.branches).toContain('main');
	});

	/**
	 * `npm run check` VERBATIM, not a re-enumeration of its steps. A workflow that spelled
	 * out `build && lint && test` would drift silently the day `check` changes.
	 */
	it('runs npm run check on both platforms, as one command', () => {
		const verify = workflow.jobs['verify'];
		const platforms = (verify?.strategy?.matrix?.include ?? []).map((leg) => leg.os);
		const commands = (verify?.steps ?? []).map((step) => step.run).filter((run): run is string => run !== undefined);

		expect(platforms.some((os) => os.startsWith('ubuntu'))).toBe(true);
		expect(platforms.some((os) => os.startsWith('windows'))).toBe(true);
		expect(commands).toContain('npm run check');
	});

	/**
	 * One command for every leg. Two platforms invoking DIFFERENT commands is the drift this
	 * job exists to prevent, and a per-platform `run` would be invisible to the case above.
	 */
	it('gives every leg the same command, so the two platforms cannot drift', () => {
		const runs = (workflow.jobs['verify']?.steps ?? [])
			.map((step) => step.run)
			.filter((run): run is string => run !== undefined && run.includes('npm run'));

		expect(new Set(runs)).toEqual(new Set(['npm run check']));
	});

	/**
	 * And it runs UNCONDITIONALLY on every leg, which the three cases above cannot see.
	 *
	 * They are independent: the platform lookup asks the matrix, the command lookup asks the
	 * steps, and neither asks whether the step is gated. So `if: matrix.os !=
	 * 'windows-latest'` on the check step passes all three — Windows is still in the matrix
	 * and `npm run check` is still in the job — while the gate never runs there at all. A
	 * test claiming both platforms invoke the definition of done has to read the condition.
	 *
	 * Any `if` is a finding rather than only a matrix-narrowing one: a condition this test
	 * has to interpret is a condition it will interpret wrongly, and there is no legitimate
	 * reason for the definition of done to be conditional.
	 */
	it('runs it unconditionally, on every leg the matrix includes', () => {
		const verify = workflow.jobs['verify'];
		const check = (verify?.steps ?? []).find((step) => step.run === 'npm run check');

		expect(check).toBeDefined();
		expect(check).not.toHaveProperty('if');

		// The JOB's condition too, which the step's cannot see. GitHub supports
		// `jobs.<job_id>.if`, so `verify.if: github.event_name == 'push'` leaves both declared
		// triggers, every matrix leg AND this unconditional step intact while skipping all PR
		// verification. A first draft of this case checked the step alone — the same defect it
		// was written to fix, one level up, which is why the two assertions live together
		// rather than in separate cases somebody could satisfy one at a time.
		expect(verify).not.toHaveProperty('if');
	});
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/build/ci-invokes-check.test.ts`
Expected: PASS, 3 tests. If `yaml` is not already a dependency, check first — `node -p "require('./package.json').devDependencies.yaml"`. If it is absent, read how `tests/release/manifest.test.ts` reads this same workflow file and use the same mechanism rather than adding a dependency; a dependency nothing else imports fails `npm run analyze`.

- [ ] **Step 3: Watch all three fail**

```bash
# 1. narrow the trigger
# edit .github/workflows/ci.yml: delete the `push:` block
npx vitest run tests/build/ci-invokes-check.test.ts   # expect: the trigger case FAILS
git checkout -- .github/workflows/ci.yml

# 2. drop the Windows leg
# edit ci.yml: remove the `- os: windows-latest` matrix entry
npx vitest run tests/build/ci-invokes-check.test.ts   # expect: the platform case FAILS
git checkout -- .github/workflows/ci.yml

# 3. re-enumerate the steps
# edit ci.yml: replace `npm run check` with `npm run build && npm run lint`
npx vitest run tests/build/ci-invokes-check.test.ts   # expect: the command cases FAIL
git checkout -- .github/workflows/ci.yml
```

- [ ] **Step 4: Run the gate and commit**

```bash
npm run check
git add tests/build/ci-invokes-check.test.ts
git commit -m "Assert CI invokes the definition of done on both platforms and both triggers"
```

---

## Task 8: The node environment fires on an INDIRECT violation

Implements spec §2's first bullet. This is the mechanism a per-file lint rule cannot replace: a `domain/`-shaped module reaching a DOM global *through a helper* has no import for `no-restricted-imports` to see.

**It does not stand in for the indirect *package* import gap** slice 1 names. That stays open and is recorded as open in Task 13.

**Files:**
- Create: `tests/build/fixtures/indirectDom.fixture.ts`
- Create: `tests/domain/nodeEnvironment.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed later. The fixture is `*.fixture.ts`, so Task 5's naming rule leaves it alone and Vitest does not collect it.

- [ ] **Step 1: Write the fixture**

Create `tests/build/fixtures/indirectDom.fixture.ts`:

```ts
/**
 * A `domain`-shaped module reaching a DOM global INDIRECTLY — through a helper, with no
 * import of its own.
 *
 * This is the shape the per-file lint rule cannot see: `no-restricted-imports` reads
 * imports, and there is no import here to read. The node default environment is what
 * catches it, at module evaluation, which is why SDD §8 counts the environment as one of
 * the two enforcement mechanisms rather than as a convenience.
 *
 * `*.fixture.ts` rather than `*.test.ts`: Vitest's `include` is `tests/**\/*.test.ts`, so
 * this is never collected, and `tests/build/spec-files.test.ts`'s naming rule bans
 * `.spec.ts` rather than this extension.
 *
 * It shares a directory with Task 9's `brokenFake.fixture.ts`, which is why that task's child
 * vitest config names its own fixture EXACTLY rather than globbing `*.fixture.ts`: a glob
 * would collect this module too, and this module throwing at evaluation would put a second,
 * unrelated cause into a run whose whole purpose is discriminating one.
 */
const reachDocument = (): string => (globalThis as { document?: { title: string } }).document!.title;

/** Evaluated at import, so importing this module under bare node throws. */
export const plantedTitle = reachDocument();
```

- [ ] **Step 2: Write the failing test**

Create `tests/domain/nodeEnvironment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('the node default environment', () => {
	/**
	 * The discriminator, and it is the whole point of the case: "the import threw" is
	 * equally true of a mistyped fixture path, a transform error, or a module that fails
	 * for any other reason. A failure assertion is vacuous unless it discriminates the
	 * CAUSE — so this asserts the expected `ReferenceError` for the planted global, not
	 * merely that something went wrong.
	 */
	it('rejects an indirect DOM reach with the ReferenceError for the planted global', async () => {
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(TypeError);
	});
});
```

- [ ] **Step 3: Run it and read what actually throws**

Run: `npx vitest run tests/domain/nodeEnvironment.test.ts`

Under bare node, `globalThis.document` is `undefined`, so `document!.title` throws a **`TypeError`** ("Cannot read properties of undefined"), not a `ReferenceError`. The spec's wording says "the expected `ReferenceError` for the planted global"; make the *code* produce that instead of weakening the assertion, because a `ReferenceError` for an unqualified global is the sharper discriminator — a `TypeError` about reading a property of undefined could come from many unrelated bugs in the fixture.

Change the fixture's `reachDocument` to reach the global unqualified:

```ts
// Unqualified, so bare node throws a ReferenceError naming `document` — a sharper
// discriminator than a TypeError about reading a property of undefined, which many
// unrelated fixture bugs could also produce.
const reachDocument = (): string => document.title;
```

`document` is not declared in a node-typed file, so add the one declaration the fixture needs directly above it:

```ts
declare const document: { title: string };
```

- [ ] **Step 4: Tighten the assertion to the discriminator**

Replace the test body:

```ts
	it('rejects an indirect DOM reach with the ReferenceError for the planted global', async () => {
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(ReferenceError);
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(/document/u);
	});
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run tests/domain/nodeEnvironment.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch it fail both ways**

```bash
# 1. the mechanism is real: under jsdom the fixture imports cleanly
sed -i '1i /** @vitest-environment jsdom */' tests/domain/nodeEnvironment.test.ts
npx vitest run tests/domain/nodeEnvironment.test.ts   # expect: FAIL — nothing rejects
sed -i '1d' tests/domain/nodeEnvironment.test.ts

# 2. the discriminator is real: a wrong path also rejects, but not with this cause
# temporarily change the import to '../build/fixtures/doesNotExist'
npx vitest run tests/domain/nodeEnvironment.test.ts   # expect: FAIL on the ReferenceError assertion
```

The second half is the one worth watching. `rejects.toThrow()` with no argument passes for **both** worlds; only the cause assertion tells a working mechanism from a broken fixture path.

Note that step 6's first mutation also proves this file must never gain a jsdom docblock — which is precisely what Task 6's guard enforces for `tests/domain/`, so the two tasks hold each other.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add tests/build/fixtures/indirectDom.fixture.ts tests/domain/nodeEnvironment.test.ts
git commit -m "Prove the node default catches an indirect DOM reach no lint rule can see"
```

---

## Task 9: A contract suite fails on a broken fake

Implements spec §2's second bullet. A repository fake whose `save()` silently drops the zone's `name` is run through `zoneRepositoryContract`, and the test asserts the suite fails — which is what proves the contract suites discriminate rather than pass against any object with the right method names.

**It must run in a CHILD vitest process, and the reason is mechanical:** `zoneRepositoryContract(make)` calls `describe(...)` at invocation and returns `void`. Called from inside a test it registers cases in the *current* run, so a broken fake would make `npm run check` fail rather than producing a failure an outer assertion can catch — the meta-test would be indistinguishable from a genuine regression.

**Three gates had to be satisfied at once, and two rounds of design weighed only the first two:**
1. Vitest's collection — a `*.test.ts` under `tests/` is collected by the outer run, which then fails before the meta-test can read the child's exit code.
2. Task 5's naming rule — `.spec.ts` is banned outright.
3. **fallow's reachability** — a `.fixture.ts` reachable only through a spawned child's `include` glob is seeded by nothing and imported by nothing, so `npm run analyze` reports it and its config as unused files, failing the very gate this slice exists to satisfy.

`*.fixture.ts` plus a `.fallowrc.json` `entry` declaration satisfies all three.

**Files:**
- Create: `tests/build/fixtures/brokenFake.fixture.ts`
- Create: `tests/build/fixtures/vitest.brokenFake.config.ts`
- Create: `tests/build/contractDiscriminates.test.ts`
- Modify: `.fallowrc.json`

**Interfaces:**
- Consumes: `zoneRepositoryContract` and `ZoneFixture` from `tests/contracts/zone-repository.contract.ts`; `InMemoryZoneRepository` from `src/`.
- Produces: nothing consumed later.

- [ ] **Step 1: Read the contract's fixture shape**

Run: `sed -n '1,40p' tests/contracts/zone-repository.contract.ts`

`ZoneFixture` requires `repository`, `makeZone(projectId, planId, name?)`, `touch(id)`, `otherParents()` and `otherProject()`. Read an existing caller for a working construction:

Run: `sed -n '1,60p' tests/infrastructure/persistence/in-memory/inMemoryZoneRepository.test.ts`

- [ ] **Step 2: Write the fixture**

Create `tests/build/fixtures/brokenFake.fixture.ts`, modelled on that caller, wrapping its repository so `save()` drops `name`:

```ts
/**
 * A DELIBERATELY FAILING spec. It exists to be run by a CHILD vitest process and to fail
 * there, which is what `tests/build/contractDiscriminates.test.ts` reads.
 *
 * `*.fixture.ts` rather than `*.test.ts`, and the choice had to satisfy three gates at
 * once — two rounds of design weighed only the first two:
 *
 *  1. Vitest's collection. `include` is `tests/**\/*.test.ts`, so a `.test.ts` here would be
 *     collected by the OUTER `npm run check`, which would then fail before the meta-test
 *     could interpret the child's exit code — the fixture would break the very gate it is
 *     part of.
 *  2. `tests/build/spec-files.test.ts`, which bans `.spec.ts` outright. That is not the
 *     escape either.
 *  3. `npm run analyze`. A file reachable only through a spawned child's `include` glob is
 *     seeded by nothing and imported by nothing, so fallow reports it and the child config
 *     as unused files. Both are declared in `.fallowrc.json`'s `entry` list for that reason,
 *     the same way the two `*.test-d.ts` files and `scripts/lint-edited.mjs` already are.
 *
 * Stated here so a later reader does not "tidy" this into a `.test.ts` and rediscover all
 * three by breaking the build.
 */
import type { ZoneRepository } from '../../../src/application/ports/ZoneRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { zoneRepositoryContract } from '../../contracts/zone-repository.contract';
import { makeZone } from '../../helpers/entities';
import { createPlanId, type PlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../src/domain/project/ProjectId';

function fresh<T>(used: Set<T>, mint: () => T): T {
	let id = mint();
	while (used.has(id)) {
		id = mint();
	}
	used.add(id);
	return id;
}

zoneRepositoryContract(() => {
	const inner = new InMemoryZoneRepository();

	/**
	 * The one mutation this fixture exists to be caught by: `save` silently blanks the
	 * zone's `name`, so the contract's round-trip case sees a different entity come back
	 * than it put in.
	 *
	 * DELEGATION, not `{ ...inner }`. Spreading a class instance copies its OWN properties
	 * only — every method lives on the prototype — so the spread form hands the contract an
	 * object with no `getById` at all, and the run then fails for the wrong reason: a
	 * TypeError during construction rather than a round-trip mismatch. That failure exits
	 * non-zero and names the same case, which is exactly what the parent's collected-count
	 * and failure-text discriminators exist to tell apart.
	 */
	const repository: ZoneRepository = {
		getById: (id) => inner.getById(id),
		listByPlan: (planId) => inner.listByPlan(planId),
		delete: (id, expected) => inner.delete(id, expected),
		save: (zone, expected) => inner.save({ ...zone, name: '' }, expected),
	};

	const usedPlans = new Set<PlanId>();
	const usedProjects = new Set<ProjectId>();
	return {
		repository,
		makeZone: (projectId, planId, name = 'Living room') => makeZone({ projectId, planId, name }),
		touch: (id) => inner.poke(id),
		otherParents: () => ({
			projectId: fresh(usedProjects, createProjectId),
			planId: fresh(usedPlans, createPlanId),
		}),
		otherProject: () => fresh(usedProjects, createProjectId),
	};
});
```

`ZoneRepository`'s real member list comes from `src/application/ports/ZoneRepository.ts` — read it and match it exactly; the four above are what `InMemoryZoneRepository` exposes today. A member missing from the delegation object is a compile error, which is the point of annotating the constant rather than casting it.

Run the fixture directly once to confirm it fails for the *intended* reason:

Run: `npx vitest run --config tests/build/fixtures/vitest.brokenFake.config.ts` (after Step 3)
Expected: a failing assertion naming `name`, not a construction error.

- [ ] **Step 3: Write the child config**

Create `tests/build/fixtures/vitest.brokenFake.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

/**
 * The child run's config. `include` names `*.fixture.ts` so the deliberately failing spec
 * is collected HERE and nowhere else; the repository root is kept as `root` so the
 * fixture's repo-relative imports of the contract keep resolving, which an out-of-tree
 * temporary directory would not.
 *
 * No coverage, no reporters beyond the default: this run's only output is an exit code and
 * the failure text the parent parses.
 */
export default defineConfig({
	test: {
		root: process.cwd(),
		environment: 'node',
		// NAMED EXACTLY, never globbed. `tests/build/fixtures/*.fixture.ts` also collects
		// Task 8's `indirectDom.fixture.ts`, which reads `document` at module evaluation and
		// therefore throws a `ReferenceError` under this run's node environment — so every
		// child run would carry an unrelated second failure, the direct-run expectation of an
		// assertion-only failure would be false, and the parent's discriminators would be
		// reading a run with two causes in it. A glob absorbs the next fixture and tells
		// nobody, which is the reason `.fallowrc.json`'s own comments give for naming files
		// one at a time.
		include: ['tests/build/fixtures/brokenFake.fixture.ts'],
	},
});
```

- [ ] **Step 4: Write the failing meta-test**

Create `tests/build/contractDiscriminates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { REPO } from '../helpers/oxlint';

/**
 * ONE child process, not one per case.
 *
 * CLAUDE.md records six ESLint-booting child processes costing 3.76s in synchronous bursts
 * on a two-core runner, and timing out a sibling file's cold Vite transform. A spawn per
 * case is what turns a green suite red on the busiest machine, so the child runs once in a
 * `describe`-level constant and every `it` reads the result back.
 */
const child = spawnSync(
	process.execPath,
	['node_modules/vitest/vitest.mjs', 'run', '--config', 'tests/build/fixtures/vitest.brokenFake.config.ts', '--reporter=json'],
	{ cwd: REPO, encoding: 'utf8', timeout: 120_000 },
);

const output = `${child.stdout ?? ''}${child.stderr ?? ''}`;

describe('the repository contract discriminates', () => {
	/**
	 * FOUR assertions, and each closes a way this case would otherwise pass vacuously. A
	 * non-zero exit is true of a wrong `include`, a fixture that fails to import, a vitest
	 * that collected nothing, a failure in setup, a failure in repository construction, and
	 * an unexpected `save()` throw — every one of them looks identical to the defect being
	 * watched for.
	 */
	it('exits non-zero', () => {
		expect(child.status).not.toBe(0);
	});

	it('collected something, so the run was not empty', () => {
		expect(output).toMatch(/"numTotalTests":\s*[1-9]/u);
	});

	it('names the case that failed', () => {
		expect(output).toMatch(/name/iu);
	});

	/**
	 * The ASSERTION that failed, not merely which case did — this is what tells a broken
	 * round trip from a fixture that threw during construction inside the same case.
	 */
	it("reports the round-trip mismatch on the zone's name", () => {
		expect(output).toMatch(/AssertionError|expected/iu);
		expect(output).not.toMatch(/Cannot find module|Failed to load|ERR_MODULE_NOT_FOUND/u);
	});
});
```

- [ ] **Step 5: Run it and tighten the third and fourth assertions**

Run: `npx vitest run tests/build/contractDiscriminates.test.ts`

Read the child's actual JSON output and replace the two loose regexes with the exact case title and the exact failure text the contract produces. `/name/iu` matches almost anything and is a placeholder to be removed in this step — a regex that broad is the vacuity this file exists to refuse.

Expected after tightening: PASS, 4 tests.

- [ ] **Step 6: Watch every discriminator fail**

```bash
# 1. the fixture is not broken: remove the `name: ''` mutation
#    expect: the exit-code case FAILS (the child now passes)

# 2. the include is wrong: change the child config's include to 'tests/build/fixtures/*.nope.ts'
#    expect: the collected-count case FAILS while the exit-code case still PASSES
#    — which is exactly why the count assertion exists

# 3. the fixture cannot import: break its import of the contract
#    expect: the fourth case FAILS on the ERR_MODULE_NOT_FOUND guard while the first
#    three still pass
```

Run each mutation, confirm the named case reddens, restore. Mutation 2 is the important one: it passes the obvious assertion and fails only the one added for it.

- [ ] **Step 7: Declare both files to fallow**

Add to `.fallowrc.json`'s `entry` array, and extend the comment block above it with a seventh paragraph:

```json
		"tests/build/fixtures/brokenFake.fixture.ts",
		"tests/build/fixtures/vitest.brokenFake.config.ts"
```

Comment to add above the `"entry"` key, in the style of the six already there:

```
	// `tests/build/fixtures/brokenFake.fixture.ts` and its `vitest.brokenFake.config.ts` are a
	// seventh kind: a deliberately failing spec run by a SPAWNED CHILD vitest, reachable only
	// through that child's own `include` glob. Nothing imports either and no npm script runs
	// them — `tests/build/contractDiscriminates.test.ts` spawns the child and reads its exit
	// code — so fallow's import graph reaches neither and reports both dead. Named rather than
	// globbed `tests/build/fixtures/**`, for the reason `dynamicallyLoaded`'s own comment gives:
	// a glob absorbs the next fixture and tells nobody.
```

- [ ] **Step 8: Run the gate — all four steps, and analyze is the one at risk**

```bash
npm run check
```

Expected: green. If `npm run analyze` reports either file, the `entry` declaration is wrong — fix the declaration, not the file's name.

- [ ] **Step 9: Commit**

```bash
git add tests/build/fixtures/brokenFake.fixture.ts tests/build/fixtures/vitest.brokenFake.config.ts tests/build/contractDiscriminates.test.ts .fallowrc.json
git commit -m "Prove the repository contract fails on a fake that drops a field"
```

---

## Task 10: `openFixtureVault` — a disk-backed fixture repository stack

Implements spec §3's adapter half. Three host surfaces are **not** a repository stack: `NoteVaultDeps` declares **eight** members — `vault`, `fileManager`, `metadataCache`, `index`, `echo`, `migrations`, `logger`, `ledger` — and `ObsidianZoneRepository` takes a `PlanGeometryStore` as a *second constructor argument* beside them. So `openFixtureVault` returns the disk-backed host surfaces **plus** the collaborators the repositories are constructed with, mirroring what `createRepositoryStack` already does for `FakeVault`.

**A writable CLONE, never the checked-in directory.** The contract suites and every vault-change test call `save()` and `delete()`, so an adapter pointed at `tests/vault/<caseName>` would mutate the baseline in place, leave a dirty worktree after a serial run, and let concurrent cases observe each other's writes under vitest's default file parallelism.

**The three hardening rules get CONFORMANCE TESTS, not a header comment.** With the contract repoint deferred, all three in-slice consumers are READ paths — bootstrap degradation, index rebuild, the migration runner — so nothing else exercises `create` with a missing parent, the read-after-create metadata window, or folder resolution. A new adapter could violate all three with `npm run check` green.

**Files:**
- Create: `tests/helpers/fixtureVault.ts`
- Create: `tests/helpers/fixtureVault.test.ts`

**Interfaces:**
- Consumes: `RepositoryStack` shape from `tests/helpers/vault.ts` (read it; do **not** modify that file — see the packaging note at the end of this plan).
- Produces:
  - `export interface FixtureStack extends Omit<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'> { vault: FixtureVaultAdapter; fileManager: FixtureFileManager; metadataCache: FixtureMetadataCache; root: string; dispose(): void }`
  - `export const openFixtureVault: (caseName: string) => Promise<FixtureStack>`
  - Tasks 11 and 12 consume `openFixtureVault` and `FixtureStack`.

- [ ] **Step 1: Read what a stack must contain**

```bash
sed -n '300,403p' tests/helpers/vault.ts
sed -n '1,60p' src/infrastructure/obsidian/repositories/NoteVaultDeps.ts
```

Write down the eight `NoteVaultDeps` members and each repository's constructor arity before writing any code. Naming a third host surface was how the design answered "what is missing" with one more item off a list instead of reading the constructor.

- [ ] **Step 2: Write the failing conformance test**

Create `tests/helpers/fixtureVault.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TFile, TFolder } from 'obsidian';
import { openFixtureVault, type FixtureStack } from './fixtureVault';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

describe('the fixture vault adapter', () => {
	/**
	 * A writable CLONE. Every contract case calls `save()` and `delete()`, so an adapter
	 * pointed at the checked-in directory would mutate the baseline in place, leave a dirty
	 * worktree after a serial run, and let concurrent cases observe each other's writes.
	 */
	it('hands back an isolated copy, leaving the checked-in tree untouched', async () => {
		open = await openFixtureVault('valid-project');
		const before = readFileSync(join('tests/vault/valid-project', 'Project.md'), 'utf8');

		await open.vault.create('Scratch.md', 'written by a test');

		expect(open.root).not.toContain('tests/vault/valid-project');
		expect(readFileSync(join('tests/vault/valid-project', 'Project.md'), 'utf8')).toBe(before);
		expect(existsSync(join('tests/vault/valid-project', 'Scratch.md'))).toBe(false);
	});

	/**
	 * Hardening rule 1. Obsidian refuses a create whose parent folder does not exist;
	 * making the old fake refuse turned 86 tests red. A fake kinder than the real thing
	 * turns a shipped crash into a green suite.
	 */
	it('refuses a create whose parent folder does not exist', async () => {
		open = await openFixtureVault('valid-project');

		await expect(open.vault.create('NoSuchFolder/Note.md', 'x')).rejects.toThrow();
	});

	/**
	 * Hardening rule 2. Obsidian populates `MetadataCache` ASYNCHRONOUSLY, so a note read
	 * back in the tick it was created has no cache entry at all — the defect that made
	 * `create-sample-project` report a migration failure on a note it had just written
	 * correctly. Making the old fake honest turned 65 tests red across 12 files.
	 *
	 * Keyed on the cache ENTRY, not on `entry?.frontmatter`: `getFileCache` answers `null`
	 * for "never parsed" and an object with no `frontmatter` for "parsed, and the user
	 * deleted it". Collapse those two and a note whose frontmatter was deleted is served
	 * this plugin's own stale bytes forever.
	 */
	it('populates the metadata cache asynchronously, with the create-window fallback', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Fresh.md';

		await open.vault.create(path, '---\nid: fresh\ntype: zone\n---\n');

		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))).toBeNull();
		open.metadataCache.catchUp();
		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))?.frontmatter).toMatchObject({ id: 'fresh' });
	});

	/**
	 * A note already on disk when the vault opened is visible IMMEDIATELY — no seeding pass,
	 * because the cache parses current bytes rather than a snapshot. This is the case that
	 * would have failed against the snapshot design without its seeding call, and it is why
	 * that call could be retired rather than kept alongside.
	 */
	it('reads a checked-in note without any seeding pass', async () => {
		open = await openFixtureVault('valid-project');
		const file = open.vault.getAbstractFileByPath('Project.md');

		expect(open.metadataCache.getFileCache(file)?.frontmatter).toBeDefined();
	});

	/**
	 * Save then read. The snapshot design returned the PRE-SAVE frontmatter here: nothing
	 * invalidated the entry, and `frontmatterOf` falls back to the echo window only when the
	 * cache answers `null`. Reported by a review bot against that design; this case is what
	 * keeps the on-demand answer from regressing back into a cached one.
	 */
	it('reflects a modify immediately, rather than serving the bytes from before it', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Project.md';
		const file = open.vault.getAbstractFileByPath(path);

		await open.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter['status'] = 'changed-by-this-test';
		});

		expect(open.metadataCache.getFileCache(file)?.frontmatter).toMatchObject({ status: 'changed-by-this-test' });
	});

	/**
	 * Three answers, not two. A parsed file with NO frontmatter answers an object whose
	 * `frontmatter` is undefined, while a file Obsidian has never seen answers `null`.
	 * Collapsing them makes "never seen" and "the user deleted the frontmatter"
	 * indistinguishable — the conflation `frontmatterOf` must not make.
	 */
	it('tells a file with no frontmatter apart from a file it has never seen', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Plain.md';
		await open.vault.create(path, 'no frontmatter here\n');
		open.metadataCache.catchUp();

		expect(open.metadataCache.getFileCache(open.vault.getAbstractFileByPath(path))).toEqual({});
		expect(open.metadataCache.getFileCache(null)).toBeNull();
	});

	/** Hardening rule 3. Obsidian answers a folder object for a folder, never `null`. */
	it('answers a folder object for a folder', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.vault.getAbstractFileByPath('')).not.toBeNull();
	});

	/**
	 * Hardening rule 4, and it is the one a first draft got wrong in the direction that
	 * hides a defect: Obsidian's `Vault.create` refuses an EXISTING path, and so does
	 * `FakeVault` (vault.ts:118). A `writeFileSync` that silently truncates would let
	 * repository code choosing `create` where it should choose `modify` pass every gate here
	 * and destroy a note in a real vault.
	 */
	it('refuses a create whose path already exists', async () => {
		open = await openFixtureVault('valid-project');
		const path = 'Twice.md';
		await open.vault.create(path, 'first');

		await expect(open.vault.create(path, 'second')).rejects.toThrow(/already exists/u);
		expect(readFileSync(join(open.root, path), 'utf8')).toBe('first');
	});

	/**
	 * Vault-relative and forward-slashed, on every platform.
	 *
	 * The Windows CI leg is what this protects: `path.join` there produces backslashes, and a
	 * `TFile.path` carrying one is parsed by `parentOf` (which searches for `/`) as having no
	 * parent at all — so an indexed project derives the vault root as its folder and every
	 * later write targets the wrong directory, with Ubuntu green throughout. Asserted rather
	 * than left to that leg to discover: a defect only one of four legs can see is worth
	 * failing fast and locally.
	 */
	it('gives every file a vault-relative, forward-slashed path on any platform', async () => {
		open = await openFixtureVault('valid-project');
		await open.vault.createFolder('Nested');
		await open.vault.create('Nested/Deep.md', 'x');

		const file = open.vault.getAbstractFileByPath('Nested/Deep.md') as TFile;

		expect(file.path).toBe('Nested/Deep.md');
		expect(file.path).not.toContain('\\');
		expect(file.path).not.toContain(open.root);
		expect(file.basename).toBe('Deep');
	});

	/**
	 * The narrowing every repository actually performs. `grep -rn "instanceof TFile" src/`
	 * prints eleven sites, so an adapter answering its own wrapper class makes all eleven
	 * false in tests while true in the app — every fixture note reads as MISSING with the
	 * types still satisfied. Asserted against the mock module's classes directly, because
	 * "not null" is equally true of the wrong class.
	 */
	it('answers the mock module TFile and TFolder, which is what the repositories narrow on', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.vault.getAbstractFileByPath('Project.md')).toBeInstanceOf(TFile);
		expect(open.vault.getAbstractFileByPath('')).toBeInstanceOf(TFolder);
	});

	/** The stack is a REPOSITORY stack, not three host surfaces. */
	it('hands back constructed repositories, not just host APIs', async () => {
		open = await openFixtureVault('valid-project');

		expect(open.zones).toBeDefined();
		expect(open.plans).toBeDefined();
		expect(open.projects).toBeDefined();
		expect(open.assets).toBeDefined();
		expect(open.requirements).toBeDefined();
		expect(open.store).toBeDefined();
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/helpers/fixtureVault.test.ts`
Expected: FAIL — `./fixtureVault` does not exist.

- [ ] **Step 4: Write the adapter**

Create `tests/helpers/fixtureVault.ts`. Model every method on `FakeVault`, `FakeFileManager` and `FakeMetadataCache` in `tests/helpers/vault.ts` — same signatures, same refusals — but backed by `node:fs` under a temporary directory rather than by an in-memory map. Then build the stack exactly as `createRepositoryStack` does.

Header comment, which is documentation *beside* the conformance tests rather than a substitute for them:

```ts
/**
 * A disk-backed vault adapter over `tests/vault/<caseName>` — SDD §75's Integration Test
 * Vault, as a fixture REPOSITORY STACK rather than as three host surfaces.
 *
 * `NoteVaultDeps` declares eight members and `ObsidianZoneRepository` takes a
 * `PlanGeometryStore` beside them, so a function returning host APIs alone cannot stand up
 * a repository however many of them it returns.
 *
 * Three hardening rules this adapter inherits from `FakeVault` BY CONSTRUCTION, each with a
 * conformance case in `fixtureVault.test.ts` — a header comment is not the mechanism, and
 * with the contract repoint deferred all three in-slice consumers are READ paths, so
 * nothing else would exercise any of them:
 *
 *  1. `create` refuses a path whose parent folder does not exist. Obsidian refuses one;
 *     making the old fake refuse turned 86 tests red.
 *  2. The metadata cache is populated ASYNCHRONOUSLY, with the create-window fallback.
 *     Making the old fake honest turned 65 tests red across 12 files.
 *  3. `getAbstractFileByPath` answers a folder object for a folder, never `null`.
 *
 * Every caller gets an isolated writable CLONE; the checked-in tree is read-only input.
 */
```

Then the adapter itself. `FakeVault`'s method set is the contract to match — read
`tests/helpers/vault.ts` lines 24–307 and mirror every signature, changing only the backing
store:

```ts
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { TFile, TFolder } from 'obsidian';
import { parseFrontmatter, serializeFrontmatter } from './vault';

/**
 * `getAbstractFileByPath` answers the MOCK MODULE's own `TFile`/`TFolder`, constructed and
 * populated — never a wrapper class of this file's own.
 *
 * `tests/helpers/obsidian-mock.ts`'s header states the rule and the reason: the real
 * `TFile`/`TFolder` are CLASSES and the repositories narrow with `instanceof`, so a fake
 * that answers anything else makes every one of those checks false in tests while true in
 * the app. `grep -rn "instanceof TFile\|instanceof TFolder" src/` prints ELEVEN sites —
 * `NoteVaultDeps.fileAt`, `noteIo.openNoteById` and `folderExists`, `PlanGeometryStore`
 * (twice), `VaultChangeAdapter` (three times), and two presentation call sites.
 *
 * A first draft of this file declared its own `FixtureFile`/`FixtureFolder` pair, which
 * would have made every fixture note read as MISSING — Task 11 could have loaded neither the
 * planted record nor the healthy one — while the stack still type-checked. Exactly the defect
 * the mock's own header exists to prevent, introduced one directory away from it.
 */
/** `path` is VAULT-RELATIVE and forward-slashed — never an OS path. See `absolute()`. */
const fileAt = (path: string): TFile => {
	const segments = path.split('/');
	const file = new TFile();
	file.path = path;
	file.name = segments.at(-1) ?? '';
	file.basename = (segments.at(-1) ?? '').replace(/\.[^.]+$/u, '');
	file.extension = path.includes('.') ? (path.split('.').at(-1) ?? '') : '';
	return file;
};

const folderAt = (path: string): TFolder => {
	const segments = path.split('/');
	const folder = new TFolder();
	folder.path = path;
	folder.name = segments.at(-1) ?? '';
	return folder;
};

export class FixtureVaultAdapter {
	/**
	 * `root` is the NATIVE absolute path of the clone. Every path this class hands out or
	 * accepts is VAULT-RELATIVE and forward-slashed, and `absolute()` is the only place the
	 * two meet.
	 *
	 * That separation is required rather than tidy, and the leg that proves it is Windows —
	 * one of the four `npm run check` runs, and the one this repository keeps because paths
	 * and line endings are the only things that differ between platforms. `path.join` there
	 * produces backslashes, so an adapter storing the native path in `TFile.path` hands the
	 * repositories something they parse with `/`: `parentOf` searches for a forward slash and
	 * finds none, so an indexed project derives the VAULT ROOT as its folder and every
	 * subsequent plan and zone write targets the wrong directory. `name` and `basename` come
	 * out malformed in the same stroke. Ubuntu would have stayed green throughout.
	 *
	 * `TFile.path` is an Obsidian vault-relative path in production — never an OS path — so
	 * this is fidelity to the real type as much as a platform fix.
	 */
	constructor(readonly root: string) {}

	/**
	 * Hardening rule 1: Obsidian REFUSES a create whose parent folder does not exist, and so
	 * does this. Making the old fake refuse turned 86 tests red — a precondition only ever
	 * checked in production is a precondition nothing checks.
	 */
	async create(path: string, data: string): Promise<TFile> {
		if (!existsSync(dirname(this.absolute(path)))) {
			throw new Error(`Folder does not exist: ${dirname(path)}`);
		}
		// Obsidian's `Vault.create` REFUSES an existing path, and so does `FakeVault`
		// (vault.ts:118). `writeFileSync` silently truncates, which is kinder than the real
		// thing in the direction that hides a defect: repository code choosing `create` where
		// it should choose `modify` would pass here and destroy a note in a vault.
		if (existsSync(this.absolute(path))) {
			throw new Error(`File already exists: ${path}`);
		}
		writeFileSync(this.absolute(path), data, 'utf8');
		this.cache.enqueue(path, data);
		return fileAt(path);
	}

	/** Hardening rule 3: a folder answers a folder OBJECT, never `null`. */
	getAbstractFileByPath(path: string): TFile | TFolder | null {
		const absolute = this.absolute(path);
		if (!existsSync(absolute)) return null;
		return statSync(absolute).isDirectory() ? folderAt(path) : fileAt(path);
	}

	// …`read`, `modify`, `delete`, `createFolder`, `getFiles`, `getMarkdownFiles`, each
	// mirroring `FakeVault`'s signature over `node:fs` under `this.root`.
	//
	// TWO of those owe the cache a call and neither is optional, so they are named here rather
	// than left inside the ellipsis:
	//   `modify` calls `this.cache.forget(path)` — a modify makes the path cache-visible,
	//     exactly as `FakeVault.modify` deletes from `unparsed` (vault.ts:136). Without it a
	//     note created and then modified in the same run stays invisible to the cache forever.
	//   `modify` also REFUSES a path that does not exist (`No file to modify: <path>`,
	//     vault.ts:130), which is the mirror of `create` refusing one that does.
	// `delete` needs no cache call: `readOrUndefined` answers `undefined` for a path that is
	// gone, and `getFileCache` turns that into `null` on its own.

	/**
	 * The current bytes, or `undefined` for a path that does not exist — the door
	 * `FixtureMetadataCache` parses through, mirroring `FakeMetadataCache` reading
	 * `vault.entries` directly.
	 *
	 * Synchronous and separate from the async `read` the repositories take, because the cache
	 * is answering "what does Obsidian believe is here" rather than performing a vault read.
	 * `undefined` rather than a throw, because "no such file" is an ANSWER at this door and the
	 * cache's three-way result depends on telling it apart from an empty file.
	 */
	readOrUndefined(path: string): string | undefined {
		const absolute = this.absolute(path);
		return existsSync(absolute) && !statSync(absolute).isDirectory() ? readFileSync(absolute, 'utf8') : undefined;
	}

	/**
	 * The ONE boundary between a vault-relative path and the filesystem. `join` reintroduces
	 * the native separator here and nowhere else, so nothing above this line can leak one
	 * into a `TFile`.
	 */
	private absolute(vaultPath: string): string {
		return join(this.root, ...vaultPath.split('/'));
	}
}
```

The metadata cache is the one that carries hardening rule 2:

```ts
export class FixtureMetadataCache {
	/** Paths this adapter created that Obsidian has not parsed yet, with the exact bytes. */
	private readonly unparsed = new Map<string, string>();

	constructor(private readonly vault: FixtureVaultAdapter) {}

	enqueue(path: string, data: string): void {
		this.unparsed.set(path, data);
	}

	/** A modify makes the path cache-visible, exactly as `FakeVault.modify` does. */
	forget(path: string): void {
		this.unparsed.delete(path);
	}

	/**
	 * Parsed ON DEMAND from the vault's CURRENT bytes — never from a snapshot map.
	 *
	 * A first draft held a `parsed` Map populated at open and on create, which is a design
	 * `FakeMetadataCache` does not have and it introduced a staleness the real fake cannot
	 * express: a repository writing through `processFrontMatter` and reading back got the
	 * bytes from before its own save, because nothing invalidated the entry and
	 * `frontmatterOf` falls back to the echo window only when the cache answers `null`.
	 * Reported by a review bot, which proposed adding invalidation on modify. Parsing on
	 * demand is taken instead: it makes the stale state UNREPRESENTABLE rather than
	 * refreshed on one more event, which is this repository's own stated preference and the
	 * lesson `pointerWorld` already paid for.
	 *
	 * It also retires `seedExisting`. With on-demand parsing a checked-in note is visible
	 * the moment the clone lands, so the seeding pass added one round earlier has nothing
	 * left to do — said plainly rather than deleted quietly, because it was defended in
	 * review and its disappearance is a consequence of a better fix, not a reversal.
	 *
	 * Three answers, not two, and the third is the one a draft collapsed. `null` means
	 * Obsidian has no entry for the file — never parsed, or inside the create window. A file
	 * it parsed and found NO frontmatter in answers an OBJECT whose `frontmatter` is
	 * undefined. Conflating those makes "never seen" and "the user deleted the frontmatter"
	 * indistinguishable, which is the exact conflation `frontmatterOf` must not make: collapse
	 * them and a note whose frontmatter was deleted is served this plugin's own stale bytes
	 * forever.
	 *
	 * What this models and what it does NOT: the window after a CREATE, where Obsidian has no
	 * entry at all — the one that produced a real defect, `create-sample-project` reporting a
	 * migration failure on a note it had just written correctly. It does not model the parse
	 * lag after a MODIFY, where Obsidian holds a STALE entry rather than none. That is a
	 * different failure, `FakeVault` does not model it either, and neither claims to.
	 */
	getFileCache(file: TFile | TFolder | null): { frontmatter?: Record<string, unknown> } | null {
		if (file === null) return null;

		const asCreated = this.unparsed.get(file.path);
		if (asCreated !== undefined && asCreated === this.vault.readOrUndefined(file.path)) return null;

		const text = this.vault.readOrUndefined(file.path);
		if (text === undefined) return null;
		if (!text.startsWith('---\n')) return {};
		return { frontmatter: parseFrontmatter(text).frontmatter };
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.unparsed.clear();
	}
}
```

And the stack, mirroring `createRepositoryStack`'s construction exactly:

```ts
export const openFixtureVault = async (caseName: string): Promise<FixtureStack> => {
	const root = mkdtempSync(join(tmpdir(), 'rp-vault-'));
	cpSync(join('tests/vault', caseName), root, { recursive: true });

	const vault = new FixtureVaultAdapter(root);
	const metadataCache = new FixtureMetadataCache();

	// No seeding pass: `FixtureMetadataCache` parses on demand from the vault's current
	// bytes, so every checked-in note is visible the moment the clone lands. An earlier draft
	// seeded a snapshot map here and had to, because that map was the only thing the cache
	// could answer from — see the cache's own header for why the snapshot went instead.
	const fileManager = new FixtureFileManager(vault);
	// `FixtureFileManager` mirrors `FakeFileManager` (tests/helpers/vault.ts:250) — the
	// repositories reach `processFrontMatter` on every write and `trashFile` on every
	// delete, all three of ObsidianZoneRepository, ObsidianPlanRepository and
	// ObsidianProjectRepository. Without it `openFixtureVault` cannot supply runnable
	// dependencies at all. Write it in this file, over `FixtureVaultAdapter`, with the same
	// two members and the same signatures.
	// …`index`, `echo`, `logger`, and `migrations` from the PLUGIN's own MIGRATION_SET —
	// never a local copy. One table with two importers cannot drift; two tables had nothing
	// to notice them drifting.
	// …then the five repositories and the PlanGeometryStore, constructed exactly as
	// `createRepositoryStack` constructs them.

	return { /* …the eight deps, the six collaborators, */ root, dispose: () => rmSync(root, { recursive: true, force: true }) };
};
```

Fill every `…` from `tests/helpers/vault.ts`'s `createRepositoryStack` and from each
repository's constructor. Do **not** modify `tests/helpers/vault.ts`: PR 25 edits that file,
and this task creates a sibling rather than a shared seam — see the packaging table.

- [ ] **Step 5: Run the conformance tests until green**

Run: `npx vitest run tests/helpers/fixtureVault.test.ts`
Expected: PASS, 5 tests. `valid-project/` does not exist yet — create the minimum content this task needs (a `Project.md` with valid frontmatter) and let Task 13 finish it.

- [ ] **Step 6: Watch each hardening rule fail**

Mutate the adapter one rule at a time and confirm exactly one case reddens each time:
1. Make `create` succeed for a missing parent → the second case fails.
2. Make the metadata cache populate synchronously → the third case fails on its first assertion.
3. Make `getAbstractFileByPath` return `null` for a directory → the fourth case fails.
4. Point the adapter at the checked-in directory → the first case fails.

Restore after each. A rule whose mutation reddens nothing is a rule this file only claims to have.

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add tests/helpers/fixtureVault.ts tests/helpers/fixtureVault.test.ts tests/vault/valid-project/
git commit -m "Open a fixture vault case as an isolated disk-backed repository stack"
```

---

## Task 11: `broken-references/` degrades gracefully — asserted on all three halves

Implements spec §2's third bullet and §3's first fixture row. Architecture Completion Criterion 13: "a broken project file does not prevent the entire plugin from loading."

**The bootstrap cannot produce a rejection, which took the design three rounds to see.** The index scan does not validate references: `collectNotes` copies `project` and `plan` through `stringField(...)` with no referential check, so a note pointing at a missing entity is indexed exactly like its neighbours. That is deliberate — `negatives.test.ts` has a describe block titled "the index scan does not run the fail-closed gate". So a test that bootstraps and asserts a refusal count asserts something bootstrapping never produces.

**And the fixture pins the exact broken EDGE**, because "an unresolved reference" is not enough: `ObsidianPlanRepository.getById` never resolves the owning project, and a zone's `projectId` is not resolved on load either — so a plan or zone whose `project` is missing produces **no refusal at all**.

**Measured for this plan, and this is the assertion's target:** the planted record is a zone whose `plan` names a plan that does not exist. `getById` calls `loadOne(id, (planId) => this.geometry.read(planId))`, which takes `parsed.value.plan` and reads that plan's geometry sidecar. With no indexed sidecar path for that plan, `PlanGeometryStore.read` refuses with `plan-geometry.path-unresolved`, which `loadOne` wraps as **`zone.sidecar-unreadable`** carrying that refusal as its cause.

**Files:**
- Create: `tests/vault/broken-references/` (fixture content)
- Create: `tests/plugin/brokenReferences.test.ts`

**Interfaces:**
- Consumes: `openFixtureVault`, `FixtureStack` from Task 10.
- Produces: nothing consumed later.

- [ ] **Step 1: Build the fixture**

Create `tests/vault/broken-references/` holding a valid project, a valid plan with its geometry sidecar, one healthy zone on that plan, and **one planted zone whose `plan` frontmatter names a plan id that appears nowhere**. Mirror the folder layout `createRepositoryStack`-backed tests produce; read an existing test's serialized output for the exact frontmatter keys.

Add `tests/vault/broken-references/README.md` naming the planted edge precisely:

```markdown
# broken-references

One planted record: **a zone whose `plan` frontmatter names a plan that does not exist.**

Named as that exact edge rather than as "a broken reference", because not every dangling
reference is validated on a read. `ObsidianPlanRepository.getById` never resolves the owning
project (`plan.project-folder-unresolved` is raised on a WRITE path), and a zone's
`projectId` is not resolved on load either — so a plan or zone whose `project` is missing is
genuinely broken and produces no refusal at all, leaving an assertion about a refusal
unsatisfiable against a fixture that looks correct by description.

This edge fails on a path the read actually walks: `ObsidianZoneRepository.getById` calls
`loadOne(id, (planId) => this.geometry.read(planId))` with `parsed.value.plan`, and no
sidecar path is indexed for a plan that does not exist.

`Kitchen` is the healthy zone in the same fixture. Both are load-bearing: the plugin still
working is equally true of a fixture that has quietly become valid.
```

- [ ] **Step 2: Write the failing test**

Create `tests/plugin/brokenReferences.test.ts`.

**Through the REAL bootstrap, not the fixture's own helper.** `openFixtureVault` hands back a
`rebuildIndex()` convenience, and calling it here would test the helper rather than the
plugin — a regression where plugin startup opens the poisoned record, or fails after the index
is built, would leave the case green. §2 says "loaded through the real bootstrap path" and
means it. `tests/helpers/plugin.ts` exports `loadedPlugin(surface)`, whose `VaultSurface` is
`Pick<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'>` — exactly the three members
`FixtureStack` carries — so the fixture drives the real `onload`/`onLayoutReady` with no new
seam. Mirror `tests/plugin/persistence-wiring.test.ts` for how it reaches the composition
root's repositories afterwards; that file is the existing precedent for both halves.

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { openFixtureVault, type FixtureStack } from '../helpers/fixtureVault';
import { expectErr, expectOk } from '../helpers/domain';
import { createZoneId } from '../../src/domain/zone/ZoneId';

installObsidianDom();

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

/** The real startup, over the fixture's three host surfaces. */
const bootstrap = async (): Promise<{ stack: FixtureStack; plugin: Awaited<ReturnType<typeof loadedPlugin>> }> => {
	const stack = await openFixtureVault('broken-references');
	const plugin = await loadedPlugin({
		vault: stack.vault,
		fileManager: stack.fileManager,
		metadataCache: stack.metadataCache,
	} as never);
	return { stack, plugin };
};

/**
 * Architecture Completion Criterion 13 — "a broken project file does not prevent the entire
 * plugin from loading" — and its §92 half about a poisoned note refusing "only when something
 * OPENS it".
 *
 * THREE assertions, and the first is the one criterion 13 is actually about. An earlier draft
 * claimed the degradation half alone "simultaneously proves the fixture exercises the failure
 * mode it claims to". It does not: *the rest of the plugin still works* is equally true of a
 * fixture that has quietly become VALID — a schema edit, a fixture typo — so the criterion
 * could sit untested behind a green suite. A test asserting an ABSENCE passes in both worlds
 * when neither world can produce the thing.
 */
describe('a broken project file does not stop the plugin loading', () => {
	it('completes the real bootstrap and builds the index fully, dropping nothing', async () => {
		const { stack } = await bootstrap();
		open = stack;

		// The index scan deliberately does NOT run the fail-closed gate: `collectNotes` copies
		// `project` and `plan` through `stringField(...)` with no referential check, so the
		// poisoned note is indexed exactly like its neighbours. Asserting a refusal HERE would
		// be asserting something bootstrapping never produces.
		//
		// "Fully built, nothing dropped" is the poisoned note present BESIDE the healthy one.
		// `InMemoryProjectIndex` exposes no `size` — measured — and a count would be the weaker
		// claim anyway: criterion 13 is about the poisoned note not taking the vault down with
		// it. Reaching startup at all is the other half, and it is why this runs through
		// `loadedPlugin` rather than the fixture's own `rebuildIndex()` helper.
		const zones = stack.index.getIdsByType('zone');
		expect(zones).toContain('kitchen');
		expect(zones).toContain('zone-with-missing-plan');
	});

	it('refuses the planted record when something opens it, with the code its edge produces', async () => {
		const { stack } = await bootstrap();
		open = stack;

		const failure = expectErr(await stack.zones.getById(createZoneId('zone-with-missing-plan')));

		expect(failure.code).toBe('zone.sidecar-unreadable');
		expect((failure.cause as { code?: string } | undefined)?.code).toBe('plan-geometry.path-unresolved');
	});

	it('still loads a healthy record from the same fixture', async () => {
		const { stack } = await bootstrap();
		open = stack;

		const loaded = expectOk(await stack.zones.getById(createZoneId('kitchen')));

		expect(loaded?.entity.name).toBe('Kitchen');
	});
});
```

- [ ] **Step 3: Run it, and correct the ids and codes to what the fixture actually produces**

Run: `npx vitest run tests/plugin/brokenReferences.test.ts`

Correct the zone ids to the fixture's own, and — if the measured refusal differs from `zone.sidecar-unreadable` / `plan-geometry.path-unresolved` — assert what the fixture actually produces and update the README's explanation to match. Do **not** weaken an assertion to `toBeDefined()`: the code is the discriminator.

- [ ] **Step 3b: Watch the bootstrap half fail**

Corrupt the fixture's `Project.md` frontmatter so the schema refuses it, and run the file.

Expected: the FIRST case fails — either `loadedPlugin` rejects, or the index comes back
without both zones. That is what says this case exercises startup rather than the fixture
helper. Confirm the discrimination by temporarily replacing `bootstrap()`'s `loadedPlugin`
call with `stack.rebuildIndex()`: the case goes GREEN against the corrupted fixture, which is
the hole a review bot found in the earlier draft. Restore both.

- [ ] **Step 4: Watch the middle assertion fail against a valid fixture**

Temporarily repair the planted zone's `plan` frontmatter to name the real plan.

Run: `npx vitest run tests/plugin/brokenReferences.test.ts`
Expected: the second case FAILS — no refusal is produced. The first and third still pass, which is precisely the point: **the degradation half alone cannot tell a working fixture from a quietly-valid one.** Restore the fixture.

- [ ] **Step 5: Watch the healthy half fail**

Temporarily corrupt the healthy zone's frontmatter.

Run: `npx vitest run tests/plugin/brokenReferences.test.ts`
Expected: the third case FAILS. Neither half alone discriminates; both are required.

- [ ] **Step 6: Run the gate and commit**

```bash
npm run check
git add tests/vault/broken-references/ tests/plugin/brokenReferences.test.ts
git commit -m "Assert a poisoned note refuses on a read while the plugin and its neighbours load"
```

---

## Task 12: `legacy-schema/` — a test-only migration step, and a narrow claim

Implements spec §3's third fixture row. The consumer needed narrowing the round after it was added, and the reason is worth keeping: it was written as "a migration test asserting the runner is deterministic and idempotent", which **cannot be implemented against this codebase**. Every array in `MIGRATION_SET` is empty, so `latest` derives to 1 for all six kinds, and `MigrationRunner`'s loop is `while (version < latest)`. A version-1 fixture iterates **zero times** — nothing migrates and nothing is proven — while a version-0 fixture finds no step from 0 and throws `migration.chain-gap` before either assertion runs.

**What this proves is stated narrowly:** that the RUNNER applies a step, reaches the same state when run twice, and leaves a note already at the current version untouched. It proves nothing about any production migration, because there are none — and that is the honest reading of Architecture Completion Criterion 9 ("migrations *can be introduced* without redesign"), which is a claim about the mechanism accepting one, not about any migration existing. Adding a real migration is not this slice's to do: slice 12 owns no schema.

**Files:**
- Create: `tests/vault/legacy-schema/` (fixture content)
- Create: `tests/infrastructure/persistence/migration/legacyFixture.test.ts`

**Interfaces:**
- Consumes: `openFixtureVault` from Task 10; `createMigrationRunner` and the migration step type from `src/infrastructure/persistence/migration/`.
- Produces: nothing consumed later.

- [ ] **Step 1: Read the runner's step shape**

```bash
sed -n '1,80p' src/infrastructure/persistence/migration/MigrationRunner.ts
grep -rn "MIGRATION_SET" src/ | head
```

Note the exact `fromVersion`/`toVersion` contract: the loop refuses a step whose `toVersion !== version + 1`.

- [ ] **Step 2: Build the fixture**

Create `tests/vault/legacy-schema/` with a valid project and plan, plus **one zone note whose `schema-version` frontmatter is 1** and which carries a field the test-only step will rename. Add `tests/vault/legacy-schema/README.md`:

```markdown
# legacy-schema

One zone note at `schema-version: 1`, carrying a `legacy-label` field that this fixture's
consumer migrates to `name` through a TEST-ONLY migration step.

Test-only, and the reason is mechanical rather than stylistic: every array in
`MIGRATION_SET` is empty, so `latest` derives to 1 for all six kinds and
`MigrationRunner`'s `while (version < latest)` loop iterates ZERO times for a version-1
note — nothing migrates and nothing is proven. A version-0 note finds no step from 0 and
throws `migration.chain-gap` before any assertion runs.

So the consumer registers a step in a test-local runner and proves the RUNNER: that it
applies a step, reaches the same state when run twice, and leaves a note already at the
current version untouched. It proves nothing about any production migration, because there
are none. That is the honest reading of Architecture Completion Criterion 9 — a claim about
the mechanism accepting a migration, not about one existing. Slice 12 owns no schema.
```

- [ ] **Step 3: Write the failing test**

Create `tests/infrastructure/persistence/migration/legacyFixture.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { createMigrationRunner } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

/**
 * A TEST-LOCAL step, registered in a test-local runner. The production `MIGRATION_SET` is
 * empty for all six kinds, so there is no production migration to exercise and none may be
 * added here: slice 12 owns no schema.
 */
const renameLabel = {
	fromVersion: 1,
	toVersion: 2,
	migrate: (raw: Record<string, unknown>): Record<string, unknown> => {
		const { 'legacy-label': label, ...rest } = raw;
		return { ...rest, name: label };
	},
};

describe('the migration runner accepts a step', () => {
	it('applies it to a note at the version below', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });

		const migrated = runner.migrateNote('zone', { 'schema-version': 1, 'legacy-label': 'Kitchen' });

		expect(migrated).toMatchObject({ name: 'Kitchen', 'schema-version': 2 });
		expect(migrated).not.toHaveProperty('legacy-label');
	});

	it('reaches the same state when run twice', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });

		const once = runner.migrateNote('zone', { 'schema-version': 1, 'legacy-label': 'Kitchen' });
		const twice = runner.migrateNote('zone', once as Record<string, unknown>);

		expect(twice).toEqual(once);
	});

	it('leaves a note already at the current version untouched', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });
		const current = { 'schema-version': 2, name: 'Kitchen' };

		expect(runner.migrateNote('zone', { ...current })).toEqual(current);
	});
});
```

- [ ] **Step 4: Run it and correct the runner's real API**

Run: `npx vitest run tests/infrastructure/persistence/migration/legacyFixture.test.ts`

`migrateNote`'s real signature, the version frontmatter key and the step shape all come from the source read in Step 1 — correct the test to the actual API rather than inventing one. If `createMigrationRunner` takes a differently-shaped table, match it.

Expected after correction: PASS, 3 tests.

- [ ] **Step 5: Wire the fixture in, or drop the dependency honestly**

As written, `openFixtureVault('legacy-schema')` is opened and never read — the fixture content is not actually exercised, which is the "instrument reaches nothing" shape this slice exists to refuse.

Change each case to read the planted note **through the fixture** rather than from an object literal: load its frontmatter with the stack's metadata cache, then pass that to the runner. If the fixture cannot be reached that way with the runner's real API, **delete the `openFixtureVault` calls from this file entirely** and record `legacy-schema/` as a fixture with no consumer in Task 13, beside `valid-project/`. Do not leave a fixture opened for appearance's sake: a fixture nothing reads is indistinguishable from correct fixture content.

- [ ] **Step 6: Watch it fail**

```bash
# 1. the step really is applied: change renameLabel.migrate to the identity function
#    expect: the first case FAILS
# 2. the version guard is real: change renameLabel.toVersion to 3
#    expect: the runner refuses with migration.chain-gap and the first case FAILS
```

- [ ] **Step 7: Run the gate and commit**

```bash
npm run check
git add tests/vault/legacy-schema/ tests/infrastructure/persistence/migration/legacyFixture.test.ts
git commit -m "Prove the migration runner accepts a step, without claiming a migration exists"
```

---

## Task 13: Record what is open, what is withdrawn, and what was dropped

Implements spec §5 and §4a. This is the honesty half, and it deserves its own gate: a Definition of Done ticked over a fixture nothing exercises is exactly what this slice exists to refuse.

**Nothing in this task is ticked.** Every item below is written as open, withdrawn, or deferred, with its reason.

**Files:**
- Create: `tests/vault/valid-project/README.md` (the fixture content itself was created in Task 10)
- Modify: `docs/tasks/12-testing-and-architecture-enforcement-infrastructure.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Name `valid-project/`'s status where the fixture lives**

Create `tests/vault/valid-project/README.md`:

```markdown
# valid-project

The healthy baseline. **Its intended consumer does not exist yet** and this slice does not
add one.

That consumer is the Obsidian arm of the repository contracts, repointed off `FakeVault`
onto this fixture. The repoint is deferred: it is not one adapter but a second composition
root for tests — `NoteVaultDeps` declares eight members and `ObsidianZoneRepository` takes a
`PlanGeometryStore` beside them — and the existing one lives in `tests/helpers/vault.ts`.

Read by `tests/helpers/fixtureVault.test.ts` only, as the case its conformance tests open.
So this fixture is exercised as *a directory the adapter can open*, and not as project
content anything asserts about. Said plainly rather than implied, because fixture content
that nothing reads is indistinguishable from correct fixture content.
```

- [ ] **Step 2: Update the slice's Definition of Done**

In `docs/tasks/12-testing-and-architecture-enforcement-infrastructure.md`, edit the infrastructure-specific Definition of Done. Leave every box **unticked** and append the status to each item this slice touched:

- The `tests/{contracts,fixtures,vault}` layout item — append: `tests/vault/` now exists with three of four cases carrying a consumer.
- The `vitest.config.ts` two-project split item — replace the item body with the **withdrawal**, paired with its check:

```markdown
- [ ] ~~`vitest.config.ts` runs the node-default / jsdom-opt-in split~~ — **WITHDRAWN**,
      paired with `tests/build/test-environments.test.ts`. `environment: 'node'` is already
      the default with jsdom opted in per file, and forgetting a docblock fails loudly. The
      split would introduce a hazard the current design does not have — a file matched by
      neither project silently never running — which is why the original item pairs it with
      a union check: a guard invented to cover a risk the split itself creates.

      The hole the default really has is the opposite one: ADDING a jsdom docblock where it
      does not belong switches off the indirect-DOM enforcement the node default is credited
      with. The replacement check resolves the EFFECTIVE environment of every collected file
      in `tests/core/`, `tests/domain/`, `tests/application/` and anything reaching
      `tests/contracts/` through the import graph, and requires `node`.

      Read the withdrawal narrowly: without that check the honest status of this item is
      "outstanding", not "withdrawn". The predicate was corrected six times before it stopped
      being a paraphrase of the property; a seventh correction is the signal that the split
      is the answer after all.
```

- The Integration Test Vault item — replace with:

```markdown
- [ ] The Integration Test Vault exists with all four cases, and is the only Vault-shaped
      data any automated test touches. — **PARTLY MET, and not ticked.** TWO cases have a
      consumer this round — `broken-references/` and `legacy-schema/`. `valid-project/`
      ships as a directory the adapter opens and nothing asserts about.
      `large-project/` is **DROPPED from this round**: its
      assertion was revised four times, it proves only single enumeration and linear
      metadata-cache I/O, and the shared operation recorder it needs is the one edit in this
      slice that cannot proceed in parallel with PR 25. Its design is kept in the spec so a
      later round with a real performance question picks it up rather than rediscovering it.

      The second clause is **false as this lands** and is recorded rather than left standing:
      the existing Obsidian contract arm still runs against `FakeVault`. Repointing it is a
      carry-forward, not this slice's work.
```

- The Architecture Test Rules item — append the meta-tests that now exist, and the gap that does not close:

```markdown
      Both mechanisms now have a planted-violation meta-test under `tests/build/`:
      `layer-boundaries.test.ts` fires every (block × extension × import shape) cell of the
      ESLint rule, and `tests/domain/nodeEnvironment.test.ts` proves the node default catches
      an indirect DOM reach no per-file lint rule can see. `ci-invokes-check.test.ts` asserts
      both run inside the single `npm run check` CI invokes on both platforms and on both
      triggers.

      Four cells are **recorded as unprobeable rather than skipped**, and their two causes are
      deliberately kept apart because a limitation attributed to the wrong cause sends the
      next reader to do work that cannot help. `.tsx`, `.mts` and `.cts` have no
      `parserOptions.projectService`, so the prerequisite is widening that scope, not adding
      a fixture. The catch-all block × `.ts` has no probeable path at all: `src/prototypes/`
      is the only unnamed subtree and holds no `.ts` file.

      **The indirect PACKAGE-import gap stays open**, as slice 1 already records. The
      node-environment test catches a DOM global at runtime, not an import graph.
```

- The §92 phase gate — leave all 15 boxes unticked and append one line under the heading:

```markdown
Item 13 now has a test — `tests/plugin/brokenReferences.test.ts` — but the gate as a whole
stays open: its own text defers it until every slice exists.
```

- [ ] **Step 3: Verify no box was ticked**

```bash
grep -c '^\- \[x\]\|^[0-9]*\. \[x\]' docs/tasks/12-testing-and-architecture-enforcement-infrastructure.md
```

Expected: `0`.

- [ ] **Step 4: Run the gate and commit**

```bash
npm run check
git add tests/vault/valid-project/README.md docs/tasks/12-testing-and-architecture-enforcement-infrastructure.md
git commit -m "Record slice 12's open, withdrawn and dropped items without ticking any of them"
```

---

## Packaging

One branch, `claude/next-slice-planning-gzjphh`. Tasks 1–9 are the meta-tests and land first, so the cheap high-value half is reviewable on its own even if the fixture vault needs another round. Tasks 10–13 are the vault.

**The conflict surface with PR 25 is now empty, and this is a consequence of dropping `large-project/` rather than a fact the spec states.** The spec's §6 names `tests/helpers/vault.ts` as a real overlap — but the only thing in this slice that would have edited it is the shared operation recorder, which exists solely for `large-project/`'s assertion. With Q4 dropping that fixture, nothing in this plan modifies that file: Task 10 *reads* it as a model and creates a sibling.

So the surface is:

| File | This slice | PR 25 |
| --- | --- | --- |
| `eslint.config.mjs` | driven, not modified (mutated and restored during watched-failing steps only) | edited |
| `tests/helpers/vault.ts` | **read only** — Task 10 creates a sibling | edited |
| `.fallowrc.json` | one `entry` addition (Task 9) | not edited |
| `vitest.config.ts` | untouched — the two-project split stays withdrawn | edited |
| `tsconfig.json` | untouched — no new file needs an `include` entry | edited |

`vitest.config.ts` and `tsconfig.json` stay untouched **only while the split stays withdrawn**. If Task 6's guard ever needs a seventh correction and the structural split is taken instead, this table changes and the work must be resequenced behind PR 25.

## Verification

- `npm run check` green, all four steps, after every task.
- **Cost is this slice's real gate risk, not coverage.** Everything built here lives under `tests/`, outside `vitest.config.ts`'s coverage `include` of `src/**/*.{ts,vue}`, so it enters neither numerator nor denominator; the slice adds no `src/` module at all. The one thing that could move the figure is a `src/` arm the new fixture-vault tests reach for the first time, which can only raise it. Read the live floors with `npm run test:coverage`; the ratchet policy applies unchanged.
- Three new `tests/build/` files boot a type-aware ESLint or spawn a child process. CLAUDE.md records six such files timing out under Windows file-parallelism. Measure the layer-boundary file's wall cost before committing it (Task 3, Step 7), and **re-run any `beforeAll` timeout in that directory with `--no-file-parallelism` before believing it** — that is a parallelism artifact, not a broken gate.
- The full suite runs green on all four CI legs before the branch is considered done.
