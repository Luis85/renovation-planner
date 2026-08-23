# Design Slice 1 — Plugin Bootstrap & Composition Root: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between what this repository already has and design slice 1's Definition of Done: a `Logger` port with a console adapter, a composition root the plugin holds instead of a bare settings field, a settings read failure that never becomes a write, and the Vue lifecycle (an isolated app per `ItemView`) with every gate that makes Vue actually checked.

**Architecture:** Nothing here invents structure. The layer directions are already lint-enforced (`eslint.config.mjs`), so this plan adds files into layers that already have bans waiting for them: the port goes in `application/ports/`, its one implementation in `infrastructure/logging/` (the directory the `no-console` carve-out already names and no file yet occupies), the composition root in `plugin/`, and the Vue root component in `presentation/`. The seam every later slice extends is `createCompositionRoot(settings, logger)` — extended by a field, never relocated.

**Tech Stack:** TypeScript 6 (`strict`), Obsidian API 1.13.0 (pinned to the floor exactly), Vite 8, Vitest 4 + v8 coverage, ESLint 10 + oxlint + `eslint-plugin-obsidianmd`, fallow. Arriving in this plan: `vue`, `pinia`, `@vitejs/plugin-vue`, `@vue/test-utils`, `vue-tsc`, `eslint-plugin-vue`, `vue-eslint-parser`.

**Spec:** [`docs/tasks/01-plugin-bootstrap-and-composition-root.md`](../../tasks/01-plugin-bootstrap-and-composition-root.md) — read its Design and Definition of Done sections before Task 1. This plan argues from that document and **narrows two of its statements**; each narrowing is called out at the task that makes it, per the repository's "write the guarantee to the check, never ahead of it" rule.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `CLAUDE.md` and the spec.

- **Definition of done is one command:** `npm run check` = `npm run build && npm run lint && npm run test:coverage && npm run analyze`. All four must pass before any commit.
- **Indentation is TABS** in `.ts`, `.vue`, `.json` and `.css` here. Every code block below uses tabs; keep them.
- **No inline lint suppression, anywhere.** `linterOptions.noInlineConfig: true` refuses both `eslint-disable` directives and the block-comment rule-configuration form; `tests/build/suppressions.test.ts` scans for oxlint's. A rule that does not fit is turned off in `.oxlintrc.json` or in a per-directory `eslint.config.mjs` block, with the reason written down.
- **`obsidian` is pinned to `1.13.0` exactly** — not a range. `tests/release/manifest.test.ts` holds the pairing with `minAppVersion`. Do not raise either in this plan.
- **`engines.node` is `^22.22.2 || ^24.15.0 || >=26.0.0`.** Every dependency added here must be a `semver.subset` of that range or `tests/build/engines.test.ts` fails. This is the check most likely to red on a fresh install — read its output before assuming a version conflict is elsewhere.
- **All user-visible text goes through `tr()`** from `src/presentation/i18n/strings.ts`, with the English key added to `src/presentation/i18n/locales/en.ts` (sentence case, linted) and a German string in `de.ts`. `I18N_LITERAL_BAN` fails a literal at `.setText(...)` and at the `text:` option of `.createEl/.createDiv/.createSpan`.
- **Nothing writes to the vault outside `infrastructure/`.** No task here writes to the vault at all: plugin `data.json` via `loadData`/`saveData` is the only persistence this slice touches.
- **Size and complexity budgets:** `src/` files ≤ 400 lines, functions ≤ 100 lines, complexity ≤ 16, depth ≤ 4, params ≤ 5. `tests/` files ≤ 450 lines.
- **No hard-coded colours in `styles/`** — an Obsidian CSS variable instead; the build fails on a literal colour at any nesting depth.
- **Coverage floors only ever rise**, and only to what a *finished* increment measures, with one covered unit of headroom. Do not touch `vitest.config.ts`'s `thresholds` before Task 6.
- **`npm run analyze` (fallow) fails on an installed dependency nothing imports**, so every dependency in this plan lands in the same commit as the file that imports it.
- **A view type and a command id are DATA.** `'renovation-project'` and `'open-project'` do not change in this plan.

## Before Task 1: the working tree

The branch `docs/review-fixes-2026-08-23` currently carries ~60 modified files under `docs/`. Commit or stash that work first, then branch for the implementation:

```bash
git status --short | head -5      # confirm what is in flight
git switch main && git pull
git switch -c feat/slice-1-bootstrap-and-composition-root
```

The plan document itself is committed on whichever branch it was written on; it is not part of the implementation branch's diff.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/application/ports/Logger.ts` | The `Logger` port and `LogLevel` — an interface with no imports. First occupant of `application/`. |
| `src/infrastructure/logging/consoleLogger.ts` | The one implementation. Maps four levels onto three console methods and carries the level in the line's own text. First occupant of the `no-console` carve-out. |
| `src/plugin/composition-root.ts` | `CompositionRoot` + `createCompositionRoot`. The seam later slices extend by a field. |
| `src/presentation/views/ViewRoot.vue` | The Vue root component. Renders the view's single root element; no content yet. |
| `tests/infrastructure/logging/consoleLogger.test.ts` | The adapter against a stubbed console — the one suite that touches one. |
| `tests/helpers/logger.ts` | A recording `Logger` plus the `vi.mock` factory for the console adapter's module, shared by two suites. |
| `tests/plugin/settings/unrecovered.test.ts` | The settings-read-failure boundary: both writers refused, and the fresh-install contrast beside it. |
| `tests/presentation/views/viewRoot.test.ts` | The component in isolation via `@vue/test-utils` — also what proves the Vitest Vue plugin is wired (an SFC import fails at parse without it). |
| `tests/build/vue-rules.test.ts` | Each Vue lint rule and each architecture ban proven by a fixture that violates exactly one of them, read by reported rule id. |

**Modified:**

| File | Change |
| --- | --- |
| `src/plugin/RenovationPlannerPlugin.ts` | Holds `root: CompositionRoot`; constructs the logger first; `saveSettings` takes the next settings and refuses while unrecovered. |
| `src/plugin/settings/SettingsTab.ts` | Reads and writes through `plugin.root.settings`; returns no definitions while unrecovered and renders the `display()` fallback. |
| `src/presentation/views/RenovationProjectView.ts` | `onOpen` mounts an isolated Vue app into `contentEl`; `onClose` unmounts it. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | One new key for the unrecovered-settings message. |
| `tests/helpers/obsidian-mock.ts` | `Plugin.loadFailure` (so `loadData` can reject); `PluginSettingTab.containerEl` (so `display()` has somewhere to draw). |
| `tests/helpers/plugin.ts` | `loadedPlugin` gains a second argument for the rejection. |
| `tests/helpers/eslint.ts` | A `lintText` helper, so a fixture can be linted at a path inside `src/` without a file on disk. |
| `tests/plugin/registration.test.ts` | Assertions move to `plugin.root.settings`; adds the logger-identity and bootstrap-logging cases. |
| `tests/plugin/settings/settingsTab.test.ts` | Assertions move to `plugin.root.settings`. |
| `tests/presentation/views/renovationProjectView.test.ts` | Adds the mount/unmount lifecycle cases. |
| `package.json` | Dependencies; `vue-tsc -noEmit` in `build` **and** `test-build`. |
| `tsconfig.json` | `include` gains `src/**/*.vue`. |
| `vite.config.ts`, `vite.harness.config.ts`, `vitest.config.ts` | `@vitejs/plugin-vue`; the last also widens `coverage.include`. |
| `eslint.config.mjs` | Every `src/` block gains a `.vue` counterpart, `eslint-plugin-vue` plus six named rules. |
| `.fallowrc.json` | `display` joins `PluginSettingTab`'s `usedClassMembers`. |
| `docs/tasks/01-plugin-bootstrap-and-composition-root.md` | Two corrections and the DoD ticked. |

---

### Task 0: Verify the Vue toolchain before four tasks assume it (SPIKE — throwaway)

**Files:** none committed. Work in a state you can revert completely.

**Interfaces:**
- Consumes: nothing.
- Produces: an answer — the three versions that work together, or a blocker to report.

**Why:** `vue-tsc` tracks TypeScript releases and this repository pins `typescript: ~6.0.3`; `@vitejs/plugin-vue` tracks Vite majors and this is Vite 8. If either lags, Task 4's "`vue-tsc` is the only command-line type gate an SFC gets" is not available and the slice needs a different answer — much cheaper to learn now than after `ViewRoot.vue` exists.

- [ ] **Step 1: Ask npm what is installable against this repository's constraints**

```bash
npm view vue version
npm view @vitejs/plugin-vue version peerDependencies
npm view vue-tsc version peerDependencies
npm view eslint-plugin-vue version peerDependencies
npm view @vue/test-utils version peerDependencies
npm view pinia version peerDependencies
```

Expected: `@vitejs/plugin-vue` declares a `vite` peer including 8; `vue-tsc` declares a `typescript` peer including `~6.0.3`; `eslint-plugin-vue` declares an `eslint` peer including 10.

- [ ] **Step 2: Install for real and watch for peer and engine failures**

```bash
npm install vue pinia
npm install -D @vitejs/plugin-vue @vue/test-utils vue-tsc eslint-plugin-vue vue-eslint-parser
npx vitest run tests/build/engines.test.ts
```

Expected: install succeeds with no `ERESOLVE`, and `engines.test.ts` passes — it compares the whole declared range against every installed package with npm's own `semver.subset`, so a dependency that excludes Node 23 or raises the floor reds here and nowhere else.

- [ ] **Step 3: Prove `vue-tsc` type-checks an SFC under this `tsconfig.json`**

Create `src/presentation/views/Spike.vue` with a deliberate type error:

```vue
<script setup lang="ts">
const n: number = 'not a number';
</script>

<template>
	<div>{{ n }}</div>
</template>
```

Add `"src/**/*.vue"` to `tsconfig.json`'s `include` (Task 4 does this for real), then run: `npx vue-tsc -noEmit`

Expected: a type error naming `Spike.vue`. If `vue-tsc` reports nothing, the `include` edit did not take. If `vue-tsc` refuses to run against TypeScript 6 at all, **stop and report**: the options are pinning TypeScript back (which costs `typescript-eslint`'s peer range) or shipping SFCs with no command-line type gate, and that is the user's decision, not the implementer's.

- [ ] **Step 4: Revert everything**

```bash
rm -f src/presentation/views/Spike.vue
git checkout -- package.json package-lock.json tsconfig.json
rm -rf node_modules
npm ci
```

- [ ] **Step 5: Report** the three versions that work together and any peer warning, as a recommendation. No commit. Nothing from this task survives except the answer.

---

### Task 1: The `Logger` port and its console adapter

**Files:**
- Create: `src/application/ports/Logger.ts`
- Create: `src/infrastructure/logging/consoleLogger.ts`
- Test: `tests/infrastructure/logging/consoleLogger.test.ts`

**Interfaces:**
- Consumes: nothing. This is the first file in `application/` and the first in `infrastructure/logging/`.
- Produces:
  - `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`
  - `interface Logger` with `debug(event: string, context?: Record<string, unknown>): void`, `info` and `warn` identical, and `error(event: string, context?: Record<string, unknown> & { cause?: unknown }): void`
  - `function createConsoleLogger(minLevel: LogLevel): Logger`

**Two facts that are not obvious:**

1. `infrastructure/logging/**` is *already* carved out of `no-console` in both linters, and `tests/build/logging-carve-out.test.ts` already resolves a configuration for the path `src/infrastructure/logging/consoleLogger.ts` — a file that does not exist yet. This task is what puts a file under that glob. **Do not touch either linter's configuration.**
2. `console.info` and `console.log` fail `eslint-plugin-obsidianmd` even *inside* the carve-out, which is why `info` maps onto `console.debug`. That is the whole reason the level is carried in the emitted *line*: a test that only checked which console method was called could not tell an `info` from a `debug`.

- [ ] **Step 1: Write the failing test**

Create `tests/infrastructure/logging/consoleLogger.test.ts`:

```typescript
/**
 * The console sink, against a stubbed console — the one suite in this repository that
 * touches one at all.
 *
 * The subject is not "does it call the console": it is that four levels reach three
 * methods without becoming indistinguishable. `info` maps onto `console.debug` because
 * `eslint-plugin-obsidianmd` fails `console.info` and the marketplace bot lints with its
 * own config, so the level has to survive in the line's own text or level filtering
 * downstream rests on nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConsoleLogger } from '../../../src/infrastructure/logging/consoleLogger';

let debug: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
	warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** The first argument of one call — the line a person actually reads. */
const lineOf = (spy: ReturnType<typeof vi.spyOn>, call = 0): string => String(spy.mock.calls[call][0]);

describe('the threshold', () => {
	it('drops debug and emits the other three at info', () => {
		const logger = createConsoleLogger('info');

		logger.debug('plugin.load.started');
		logger.info('index.rebuilt');
		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(debug).toHaveBeenCalledTimes(1);
		expect(lineOf(debug)).toContain('index.rebuilt');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledTimes(1);
	});

	it('drops warn as well at error', () => {
		const logger = createConsoleLogger('error');

		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(warn).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(1);
	});
});

describe('the level in the line', () => {
	/**
	 * The case a method assertion cannot make: both of these reach `console.debug`, so if
	 * the level were carried only by which function was called, these two lines would be
	 * the same line. Asserted as "the level word appears", not as a full format — a later
	 * change to spacing or ordering is not a regression.
	 */
	it('tells a debug line from an info line although they share a method', () => {
		const logger = createConsoleLogger('debug');

		logger.debug('plugin.load.started');
		logger.info('index.rebuilt');

		expect(debug).toHaveBeenCalledTimes(2);
		expect(lineOf(debug, 0)).toContain('debug');
		expect(lineOf(debug, 1)).toContain('info');
	});

	it('names the level on warn and error too', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated');
		logger.error('settings.load.failed');

		expect(lineOf(warn)).toContain('warn');
		expect(lineOf(error)).toContain('error');
	});
});

describe('what it passes through', () => {
	// Untouched, not stringified at the boundary: whoever reads the console wants the
	// Error with its stack, not this adapter's idea of how to print one.
	it('forwards a cause by identity', () => {
		const cause = new Error('data.json is a directory');
		const logger = createConsoleLogger('info');

		logger.error('settings.load.failed', { cause });

		expect((error.mock.calls[0][1] as { cause: unknown }).cause).toBe(cause);
	});

	it('passes context alongside the line', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated', { path: 'Geometry/plan.rpgeo' });

		expect(warn.mock.calls[0][1]).toEqual({ path: 'Geometry/plan.rpgeo' });
	});

	// A reader should not be shown `undefined` for a call that had no context.
	it('emits one argument when there is no context', () => {
		const logger = createConsoleLogger('info');

		logger.warn('sidecar.regenerated');

		expect(warn.mock.calls[0]).toHaveLength(1);
	});
});

/**
 * The marketplace constraint, asserted at the forbidden thing rather than by reading a
 * config: the obsidianmd ruleset fails `console.log` and `console.info` and the review bot
 * lints with its own configuration, so no level may reach either method.
 */
it('never touches console.log or console.info', () => {
	const logger = createConsoleLogger('debug');

	logger.debug('a');
	logger.info('b');
	logger.warn('c');
	logger.error('d');

	expect(log).not.toHaveBeenCalled();
	expect(info).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/infrastructure/logging/consoleLogger.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/infrastructure/logging/consoleLogger"`.

- [ ] **Step 3: Write the port**

Create `src/application/ports/Logger.ts`:

```typescript
/**
 * The logging port — SDD §67's four levels, and the whole of it.
 *
 * It lives in `application/ports/` and not in `infrastructure/logging/`, which is where the
 * IMPLEMENTATION lives (SDD §7.4): a port down there would force every application-layer
 * caller to import `infrastructure/`, the one direction §8 forbids. And not in `core/`
 * either, deliberately — a port in `core/` is reachable from `domain/`, and domain code
 * here does not log. A pure entity returns a `Result` and its caller decides what to record.
 *
 * `event` is a stable dot-delimited key (`'settings.load.failed'`), not a sentence: it is
 * what a reader greps for and what a test asserts on, while `context` carries the values.
 * Slice 11's rules for which level a given event takes attach to this interface without
 * changing it.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
	debug(event: string, context?: Record<string, unknown>): void;
	info(event: string, context?: Record<string, unknown>): void;
	warn(event: string, context?: Record<string, unknown>): void;
	error(event: string, context?: Record<string, unknown> & { cause?: unknown }): void;
}
```

- [ ] **Step 4: Write the adapter**

Create `src/infrastructure/logging/consoleLogger.ts`:

```typescript
import type { LogLevel, Logger } from '../../application/ports/Logger';

/**
 * The only `Logger` implementation this slice builds, and the only file in the repository
 * allowed to name the console — `eslint.config.mjs` and `.oxlintrc.json` both carve
 * `no-console` off for this directory and nothing else.
 *
 * Two properties earn a console sink over a file-backed one, and both matter at bootstrap:
 * it keeps "no Vault access of any kind in this slice" true, and its construction cannot
 * fail — which matters precisely because it is constructed first, and a logger that needed
 * I/O to exist could fail at the one moment a failure most needs reporting.
 *
 * **`info` maps onto `console.debug`, and that is a marketplace constraint rather than a
 * preference.** The obsidianmd ruleset fails `console.log` and `console.info` while passing
 * `console.debug`, `console.warn` and `console.error` — measured — and the rule is
 * deliberately left ON inside the carve-out because the review bot lints a submission with
 * its own configuration, so a local override would not travel. The level therefore rides in
 * the emitted line's own text, which is what a reader greps for anyway. The cost, named
 * rather than glossed: `console.debug` lands in devtools' Verbose channel, hidden at the
 * default filter, so an `info` line is invisible until a user widens it. Slice 11's "copy
 * diagnostics" work is where a channel that does not depend on a devtools filter belongs.
 *
 * Returns void and never throws: a call site that had to handle a logging failure would
 * have two failures to report and no way to report either.
 */
const ORDER: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** One prefix, so a vault console with several plugins in it can be filtered to this one. */
const PREFIX = 'renovation-planner';

export function createConsoleLogger(minLevel: LogLevel): Logger {
	const floor = ORDER.indexOf(minLevel);

	const emit = (level: LogLevel, event: string, context?: Record<string, unknown>): void => {
		if (ORDER.indexOf(level) < floor) return;

		// Read off `console` at CALL time, through three static call sites: a reference
		// captured into a map at module load would not see a stubbed console (which is how
		// the suite drives this), and a computed `console[name]` would hide the method
		// being called from the obsidianmd rule that has to see it.
		const line = `${PREFIX} ${level} ${event}`;
		const args: [string, Record<string, unknown>?] = context === undefined ? [line] : [line, context];

		if (level === 'warn') console.warn(...args);
		else if (level === 'error') console.error(...args);
		else console.debug(...args);
	};

	return {
		debug: (event, context) => emit('debug', event, context),
		info: (event, context) => emit('info', event, context),
		warn: (event, context) => emit('warn', event, context),
		error: (event, context) => emit('error', event, context),
	};
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/infrastructure/logging/consoleLogger.test.ts`
Expected: PASS, every case.

- [ ] **Step 6: Run the whole gate**

Run: `npm run check`

Expected: all four steps pass. Two findings are plausible here and neither is a licence to add an exception:
- `npm run analyze` reporting `src/application/ports/Logger.ts` as dead — it is imported by the adapter as a type-only import, which fallow does follow. A report means the path or filename is wrong, not that a fallow entry is needed.
- `tests/build/logging-carve-out.test.ts` failing — it asserts `no-console` is `off` under this directory and `error` outside it. A failure here means the new file landed outside `src/infrastructure/logging/`.

- [ ] **Step 7: Commit**

```bash
git add src/application/ports/Logger.ts src/infrastructure/logging/consoleLogger.ts tests/infrastructure/logging/consoleLogger.test.ts
git commit -m "feat: add the Logger port and its console adapter"
```

---

### Task 2: The composition root, and the plugin holding it

**Files:**
- Create: `src/plugin/composition-root.ts`
- Create: `tests/helpers/logger.ts`
- Modify: `src/plugin/RenovationPlannerPlugin.ts`
- Modify: `src/plugin/settings/SettingsTab.ts`
- Modify: `docs/tasks/01-plugin-bootstrap-and-composition-root.md` (one signature correction)
- Test: `tests/plugin/registration.test.ts` (extend), `tests/plugin/settings/settingsTab.test.ts` (update three assertions)

**Interfaces:**
- Consumes: `Logger`, `LogLevel`, `createConsoleLogger` from Task 1; `RenovationPlannerSettings`, `settingsFrom`, `DEFAULT_SETTINGS` from `src/plugin/settings/settings.ts` (already exist, unchanged).
- Produces:
  - `interface CompositionRoot { readonly settings: RenovationPlannerSettings; readonly logger: Logger }` — **widened to `RenovationPlannerSettings | null` by Task 3, not here** (see the note below).
  - `function createCompositionRoot(settings: RenovationPlannerSettings, logger: Logger): CompositionRoot`
  - `RenovationPlannerPlugin.root: CompositionRoot` — the field a view, the settings tab and every later slice read persisted state through.
  - `RenovationPlannerPlugin.saveSettings(next: RenovationPlannerSettings): Promise<void>` — **a changed signature**; see below.
  - From `tests/helpers/logger.ts`: `lines: Line[]`, `levels: LogLevel[]`, `recorder: Logger`, `consoleLoggerMock()`, `resetRecorder()`.

**Why the nullable settings type is Task 3's and not this task's.** The spec's `CompositionRoot` declares `settings: RenovationPlannerSettings | null`. Introducing that here would add a `null` branch that nothing can take until Task 3 writes the failure path — an uncovered branch, on a denominator where one branch is 8.3 percentage points. Every commit in this plan stays fully covered, so the type widens in the same commit as the code that can produce `null`.

**The spec contradiction this task resolves.** `docs/tasks/01`'s *Interfaces & Contracts* block declares both `readonly settings` on `CompositionRoot` and `saveSettings(): Promise<void>` with no parameter. Those two cannot both hold: `SettingsTab.setControlValue` today does `this.host.settings = settingsFrom(...)`, and a `readonly` field forbids exactly that, leaving a no-argument `saveSettings` nothing to save. The resolution is `saveSettings(next: RenovationPlannerSettings)`, with the plugin replacing its root rather than mutating through it — one read path (`plugin.root.settings`), one write path (`plugin.saveSettings`). **The spec line is the bug and this task fixes it**, because a plan that quietly implemented something else would leave the next reader trusting the document.

Replacing the whole root on a settings write is deliberate and cheap while the root holds two fields. It is also the thing slice 4 must revisit: once the root composes repositories and an index from a *folder path*, recomposing them because a display preference changed is waste, and NOT recomposing them when a path changes is a bug. Slice 4 decides which; this slice must not pre-solve it.

- [ ] **Step 1: Write the failing tests**

Create `tests/helpers/logger.ts`:

```typescript
import type { LogLevel, Logger } from '../../src/application/ports/Logger';

/**
 * A `Logger` that records instead of printing, plus the `vi.mock` factory that makes the
 * plugin construct it.
 *
 * Bootstrap logging is asserted on the PORT, never on a console: what the adapter does with
 * a call is `tests/infrastructure/logging/consoleLogger.test.ts`'s subject, and a suite that
 * asserted on console methods here would be testing the adapter twice and the wiring never.
 *
 * There is no injection seam in the plugin for this, on purpose — `onload` constructs its
 * own logger, which is the property Task 2 asserts by identity. So the ADAPTER's module is
 * mocked instead. Vitest gives each test file its own module registry, so `recorder` below
 * is one instance per file and identity assertions mean what they say.
 */
export interface Line {
	level: LogLevel;
	event: string;
	context?: Record<string, unknown>;
}

/** Every line the code under test logged, in order. */
export const lines: Line[] = [];

/** Every `minLevel` the code under test asked the adapter factory for — one per construction. */
export const levels: LogLevel[] = [];

const record =
	(level: LogLevel) =>
	(event: string, context?: Record<string, unknown>): void => {
		lines.push({ level, event, context });
	};

export const recorder: Logger = {
	debug: record('debug'),
	info: record('info'),
	warn: record('warn'),
	error: record('error'),
};

/** What `vi.mock` should return for `src/infrastructure/logging/consoleLogger`. */
export const consoleLoggerMock = (): { createConsoleLogger: (minLevel: LogLevel) => Logger } => ({
	createConsoleLogger: (minLevel: LogLevel): Logger => {
		levels.push(minLevel);
		return recorder;
	},
});

export const resetRecorder = (): void => {
	lines.length = 0;
	levels.length = 0;
};
```

Then add to `tests/plugin/registration.test.ts` — the `vi.mock` call goes at the top, beside the imports, and `vi` joins the `vitest` import:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levels, lines, recorder, resetRecorder } from '../helpers/logger';

// Hoisted above the imports by vitest, which is why the factory imports the helper itself
// rather than closing over a module-scope binding that would not exist yet.
vi.mock('../../src/infrastructure/logging/consoleLogger', async () => (await import('../helpers/logger')).consoleLoggerMock());
```

and extend the existing `beforeEach` and add one `describe`:

```typescript
beforeEach(async () => {
	resetRecorder();
	({ plugin, workspace } = await loadedPlugin());
});

describe('the composition root', () => {
	/**
	 * ONE logger, asserted by identity rather than by shape: two different loggers both
	 * satisfy a shape assertion, and "one instance, reached through one path" is the
	 * property every later slice inherits from this seam.
	 */
	it('holds the logger onload constructed', () => {
		expect(levels).toEqual(['info']);
		expect(plugin.root.logger).toBe(recorder);
	});

	/**
	 * The threshold is an argument to the adapter, not a setting: `debug` compiles and emits
	 * nothing in a released build, while the levels slice 11 adds still reach it.
	 */
	it('is reached through one field rather than a bare settings field', () => {
		expect(plugin.root.settings).toEqual({ units: 'metric' });
	});

	/**
	 * "Console noise: logging that is not an actual error path" is one of the marketplace
	 * rejections only a human reviewer catches, so a released build must be silent unless
	 * something failed. Invisible to a test that only counts calls, which is why the levels
	 * are filtered rather than the length asserted.
	 */
	it('emits nothing above debug on a successful load', () => {
		expect(lines.filter((line) => line.level !== 'debug')).toEqual([]);
	});
});
```

Update the two existing settings assertions in the same file to read through the root:

```typescript
	it('loads the default settings on a fresh install', () => {
		expect(plugin.root.settings).toEqual({ units: 'metric' });
	});

	it('loads stored settings over the defaults', async () => {
		const { plugin: withStored } = await loadedPlugin({ units: 'imperial' });

		expect(withStored.root.settings).toEqual({ units: 'imperial' });
	});
```

And in `tests/plugin/settings/settingsTab.test.ts`, three assertions move off the bare field. Written as whole-object comparisons rather than `plugin.root.settings.units`, so Task 3's nullable type does not force a second edit here:

```typescript
	it('writes a change through to data.json', async () => {
		const { plugin, tab } = await withStored(null);

		await tab.setControlValue('units', 'imperial');

		expect(plugin.root.settings).toEqual({ units: 'imperial' });
		expect(plugin.saved).toEqual([{ units: 'imperial' }]);
	});

	it('refuses to persist a value outside the vocabulary', async () => {
		const { plugin, tab } = await withStored(null);

		await tab.setControlValue('units', 'furlongs');

		expect(plugin.root.settings).toEqual({ units: 'metric' });
		expect(plugin.saved).toEqual([{ units: 'metric' }]);
	});

	it('keeps the other settings when one is written', async () => {
		const { plugin, tab } = await withStored({ units: 'imperial' });

		await tab.setControlValue('currency', 'EUR');

		expect(plugin.root.settings).toEqual({ units: 'imperial' });
	});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/plugin`
Expected: FAIL — `Cannot find module '../../src/infrastructure/logging/consoleLogger'` is resolvable (Task 1 created it), so the failures are `plugin.root is undefined` on every new and updated case.

- [ ] **Step 3: Write the composition root**

Create `src/plugin/composition-root.ts`:

```typescript
import type { Logger } from '../application/ports/Logger';
import type { RenovationPlannerSettings } from './settings/settings';

/**
 * The ONE place dependencies are composed (SDD §10). At this slice it composes two things,
 * and the commented members are not a wish list — they are the promise this seam makes:
 * every later slice adds a FIELD and a constructor parameter here, and never a second
 * wiring point somewhere else in the plugin.
 *
 * `plugin/` is the only layer allowed to import from every other one, which is the entire
 * reason the inner layers can stay ignorant of Obsidian: something has to know how to build
 * a `ZoneRepository` from an `App`, and it is this file rather than `domain/zone/`.
 */
export interface CompositionRoot {
	readonly settings: RenovationPlannerSettings;
	/**
	 * Not one of §10's five members, and held here because slice 11 states the wiring as a
	 * contract: the `Logger` is injected via the composition root like any other Application
	 * port. If the root did not hold it from its first version, the injection point would
	 * have to MOVE later — and this seam is extended by a field, never relocated.
	 */
	readonly logger: Logger;
	// readonly eventBus: EventBus;                — arrives with slice 2 (Core Primitives)
	// readonly repositories: RepositoryRegistry;  — arrives with slice 4 (Persistence Layer)
	// readonly services: ApplicationServices;     — arrives with slice 4 / slice 9
	// readonly queries: QueryServices;            — arrives with slice 4
}

/**
 * The logger is a PARAMETER rather than something this function constructs: it has to exist
 * before the settings load that may fail, and that load happens before this call.
 */
export function createCompositionRoot(settings: RenovationPlannerSettings, logger: Logger): CompositionRoot {
	return { settings, logger };
}
```

- [ ] **Step 4: Wire it into the plugin**

In `src/plugin/RenovationPlannerPlugin.ts`, add the imports, replace the `settings` field with `root`, and put the logger ahead of everything:

```typescript
import type { LogLevel } from '../application/ports/Logger';
import { createConsoleLogger } from '../infrastructure/logging/consoleLogger';
import { createCompositionRoot, type CompositionRoot } from './composition-root';
import { settingsFrom, type RenovationPlannerSettings } from './settings/settings';
```

```typescript
/**
 * The threshold is an argument to the adapter, not a setting: this slice's `debug` calls
 * compile and emit nothing, while the levels slice 11 adds still reach a released build
 * where they are worth having. A user-facing switch belongs with slice 11's diagnostics
 * work — "copy diagnostics" and "turn on verbose logging" are the same conversation — and
 * this slice does not add a settings field no feature reads yet.
 */
const LOG_LEVEL: LogLevel = 'info';

export default class RenovationPlannerPlugin extends Plugin {
	/**
	 * One field, not a bare `settings` one: a view or the settings tab reaches persisted
	 * state through `plugin.root.settings` — one path in, not two that could drift.
	 * Definitely assigned in `onload`, which Obsidian calls before anything can read it.
	 */
	root!: CompositionRoot;

	async onload(): Promise<void> {
		// The logger is deliberately AHEAD of §9's first step rather than inside its list:
		// it is not one of the things bootstrap sets up, it is what the setup steps report
		// through, and the step below is the first one that can fail.
		const logger = createConsoleLogger(LOG_LEVEL);
		logger.debug('plugin.load.started');

		// Settings first of the steps — the SDD's stated onload order (§9) — so everything
		// registered below may read them. The merge is pure (`settingsFrom`); only the
		// `loadData` call lives here, in the layer allowed to name it.
		this.root = createCompositionRoot(settingsFrom(await this.loadData()), logger);
		this.addSettingTab(new SettingsTab(this));

		this.registerView(RENOVATION_PROJECT_VIEW, (leaf) => new RenovationProjectView(leaf));

		this.addRibbonIcon(RENOVATION_PROJECT_ICON, tr('command.open-project'), () => {
			void this.openProject();
		});

		this.addCommand({
			id: 'open-project',
			name: tr('command.open-project'),
			callback: () => {
				void this.openProject();
			},
		});

		// A `debug` line rather than an `info` one, and that is the publishing guidance
		// rather than taste: a plugin that announces itself on every start is the plainest
		// instance of the "console noise" rejection. What survives as `info` is RARITY —
		// something that happened once and would be worth having in a support thread.
		logger.debug('plugin.loaded');
	}

	/**
	 * The one write path for settings, so no control has to know how they are persisted.
	 * `saveData` replaces the whole file, which is why this takes the complete next settings
	 * object rather than a patch — and why the root is REPLACED rather than mutated: its
	 * fields are readonly, so there is exactly one way state changes here.
	 */
	saveSettings(next: RenovationPlannerSettings): Promise<void> {
		this.root = createCompositionRoot(next, this.root.logger);
		return this.saveData(next);
	}
```

If `root!:` trips a linter (a definite-assignment complaint from oxlint's TypeScript rules), do **not** reach for a suppression — `noInlineConfig` forbids it anyway. Initialise the field instead, constructing the logger at field-initialiser time (`root: CompositionRoot = createCompositionRoot(DEFAULT_SETTINGS, createConsoleLogger(LOG_LEVEL))`) and have `onload` reuse `this.root.logger`. That keeps "one logger, constructed before the first step that can fail" true — a field initialiser runs at `new`, which is strictly earlier — and the identity test in Step 1 passes unchanged.

- [ ] **Step 5: Point the settings tab at the root**

In `src/plugin/settings/SettingsTab.ts`, both overrides read through the root and the write goes through the new signature:

```typescript
	getControlValue(key: string): unknown {
		return this.host.root.settings[key as keyof RenovationPlannerSettings];
	}

	setControlValue(key: string, value: unknown): Promise<void> {
		// Through `settingsFrom` — the same gate `loadData` passes through — so an
		// unrecognised value falls back to the default instead of reaching the file, and a
		// key this version does not declare is dropped rather than persisted forever.
		return this.host.saveSettings(settingsFrom({ ...this.host.root.settings, [key]: value }));
	}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run tests/plugin`
Expected: PASS, including the three updated `settingsTab` cases.

- [ ] **Step 7: Correct the spec's signature line**

In `docs/tasks/01-plugin-bootstrap-and-composition-root.md`, *Interfaces & Contracts*, change `saveSettings(): Promise<void>;` to `saveSettings(next: RenovationPlannerSettings): Promise<void>;` and add one sentence beneath the block:

```markdown
`saveSettings` takes the next settings rather than reading a mutable field: `CompositionRoot`'s
members are `readonly`, so the tab cannot assign through the root, and the plugin replaces its
root instead. One read path (`plugin.root.settings`), one write path (`plugin.saveSettings`).
```

- [ ] **Step 8: Run the whole gate**

Run: `npm run check`
Expected: all four pass. `npm run analyze` is the one to read carefully: `createCompositionRoot` and `CompositionRoot` must both show as used, and `saveSettings` is reached from `SettingsTab` rather than from Obsidian, so it needs no `usedClassMembers` entry.

- [ ] **Step 9: Commit**

```bash
git add src/plugin/composition-root.ts src/plugin/RenovationPlannerPlugin.ts src/plugin/settings/SettingsTab.ts tests/helpers/logger.ts tests/plugin docs/tasks/01-plugin-bootstrap-and-composition-root.md
git commit -m "feat: compose the plugin's dependencies in one root"
```

---

### Task 3: A settings read failure that never becomes a write

**Files:**
- Modify: `src/plugin/composition-root.ts` (widen the type)
- Modify: `src/plugin/RenovationPlannerPlugin.ts` (catch the rejection; refuse to write)
- Modify: `src/plugin/settings/SettingsTab.ts` (no definitions, and a `display()` fallback)
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `tests/helpers/obsidian-mock.ts`, `tests/helpers/plugin.ts`
- Modify: `.fallowrc.json`
- Modify: `docs/tasks/01-plugin-bootstrap-and-composition-root.md` (the `CompositionRoot` block)
- Test: `tests/plugin/settings/unrecovered.test.ts` (new)

**Interfaces:**
- Consumes: everything Task 2 produced.
- Produces:
  - `CompositionRoot.settings: RenovationPlannerSettings | null` — `null` means *could not be READ*, never *absent*.
  - `RenovationPlannerPlugin.saveSettings(next)` makes no `saveData` call while `root.settings === null`.
  - `SettingsTab.getSettingDefinitions()` returns `[]` while unrecovered; `SettingsTab.display()` renders the reason.
  - Test helpers: `loadedPlugin(stored?: unknown, loadFailure?: unknown)`; `Plugin.loadFailure` on the mock; `PluginSettingTab.containerEl` on the mock.
  - One string key: `settings.unrecovered`.

**The distinction the whole task turns on, because the two look alike from inside `onload`:** `loadData()` **resolving** `null` is a fresh install — `settingsFrom(null)` returns defaults and the plugin is fully configured. Only a **rejection** is unrecovered. A single test that drove "no settings" would treat the two identically, which is the confusion the boundary exists to prevent.

**And why `null` rather than defaults**, since defaults are tempting and are harmless *today*: the only setting is `units`, and a display preference falling back to metric costs nothing. It stops being harmless at slice 4, which puts a **location** in settings — the project folder, which per ADR-011 is also what a plan's geometry sidecar path derives from. Defaults are then not a degraded version of the user's configuration, they are a different place on disk: an index built on them scans folders the projects are not in, so existing work reads as missing, and anything written lands in a parallel tree beside it. A setting that names a path is not a preference.

- [ ] **Step 1: Teach the fakes what a failure is**

In `tests/helpers/obsidian-mock.ts`, add to `class Plugin`:

```typescript
	/**
	 * When set, `loadData` REJECTS with it. A RESOLVED null is a fresh install and stays
	 * `data`'s job — the two are different outcomes and a fake that could only express one
	 * would make the suite unable to tell them apart.
	 */
	loadFailure: unknown = undefined;

	loadData(): Promise<unknown> {
		return this.loadFailure === undefined ? Promise.resolve(this.data) : Promise.reject(this.loadFailure);
	}
```

and to `class PluginSettingTab` — the element Obsidian gives a tab, which nothing needed until the `display()` fallback:

```typescript
	/**
	 * The element Obsidian hands a tab. Only the `display()` fallback draws into it (1.13
	 * calls `display()` only when `getSettingDefinitions()` is empty), which is why this
	 * arrives now rather than earlier: a fake member nothing exercises cannot be caught
	 * drifting.
	 */
	readonly containerEl: HTMLElement = document.createElement('div');
```

In `tests/helpers/plugin.ts`:

```typescript
export async function loadedPlugin(stored: unknown = null, loadFailure?: unknown) {
	const workspace = new FakeWorkspace();
	const plugin = new RenovationPlannerPlugin({ workspace } as never, {});
	plugin.data = stored;
	plugin.loadFailure = loadFailure;
	await plugin.onload();
	return { plugin, workspace };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/plugin/settings/unrecovered.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * What happens when `data.json` cannot be READ — and, beside it, what happens when there
 * simply is none.
 *
 * The two are one line apart in `onload` and produce opposite outcomes: a rejection is
 * unrecovered and must never be written over, while a resolved `null` is a fresh install
 * that loads defaults and saves normally. Both writers are asserted independently, because
 * either one alone still overwrites the file the user still has.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { lines, resetRecorder } from '../../helpers/logger';
import { loadedPlugin } from '../../helpers/plugin';
import { RENOVATION_PROJECT_VIEW } from '../../../src/presentation/views/RenovationProjectView';
import { t } from '../../../src/presentation/i18n/strings';
import type { SettingsTab } from '../../../src/plugin/settings/SettingsTab';

vi.mock('../../../src/infrastructure/logging/consoleLogger', async () => (await import('../../helpers/logger')).consoleLoggerMock());

installObsidianDom();

const CAUSE = new Error('data.json is a directory');

const unrecovered = async () => {
	const { plugin, workspace } = await loadedPlugin(null, CAUSE);
	return { plugin, workspace, tab: plugin.settingTabs[0] as unknown as SettingsTab };
};

beforeEach(() => {
	resetRecorder();
});

describe('a read that failed', () => {
	// Asserted as null SPECIFICALLY: a test written against "defaults are present" passes
	// against the version that hands a wrong folder path to slice 4.
	it('leaves the settings unrecovered rather than defaulted', async () => {
		const { plugin } = await unrecovered();

		expect(plugin.root.settings).toBeNull();
	});

	it('logs exactly one error, naming the event and forwarding the cause', async () => {
		await unrecovered();

		const errors = lines.filter((line) => line.level === 'error');

		expect(errors).toHaveLength(1);
		expect(errors[0].event).toBe('settings.load.failed');
		expect(errors[0].context?.cause).toBe(CAUSE);
	});

	// The plugin still loads and the view still opens; the failure is visible in the one
	// place a user would look for it.
	it('registers the view and the command anyway', async () => {
		const { plugin } = await unrecovered();

		expect([...plugin.views.keys()]).toEqual([RENOVATION_PROJECT_VIEW]);
		expect(plugin.commands.map((command) => command.id)).toEqual(['open-project']);
	});
});

describe('the two writers, refused independently', () => {
	it('makes no saveData call for the whole session', async () => {
		const { plugin } = await unrecovered();

		await plugin.saveSettings({ units: 'imperial' });

		expect(plugin.saved).toEqual([]);
	});

	/**
	 * The second guard, and the one that makes the first hold for a control nobody has
	 * written yet: the tab writes on every control change, so while unrecovered it offers
	 * no control that could.
	 */
	it('declares no settings for Obsidian to render', async () => {
		const { tab } = await unrecovered();

		expect(tab.getSettingDefinitions()).toEqual([]);
	});

	it('renders the reason through the display fallback', async () => {
		const { tab } = await unrecovered();

		tab.display();

		expect(tab.containerEl.textContent).toContain(t('en', 'settings.unrecovered'));
	});

	it('answers nothing for a control key', async () => {
		const { tab } = await unrecovered();

		expect(tab.getControlValue('units')).toBeUndefined();
	});

	it('persists nothing even if a control writes', async () => {
		const { plugin, tab } = await unrecovered();

		await tab.setControlValue('units', 'imperial');

		expect(plugin.saved).toEqual([]);
	});
});

describe('a fresh install, which is the opposite outcome', () => {
	it('loads the defaults, saves normally and renders its controls', async () => {
		const { plugin } = await loadedPlugin(null);
		const tab = plugin.settingTabs[0] as unknown as SettingsTab;

		expect(plugin.root.settings).toEqual({ units: 'metric' });
		expect(tab.getSettingDefinitions()).toHaveLength(1);

		await plugin.saveSettings({ units: 'imperial' });

		expect(plugin.saved).toEqual([{ units: 'imperial' }]);
	});

	it('logs no error', async () => {
		await loadedPlugin(null);

		expect(lines.filter((line) => line.level === 'error')).toEqual([]);
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/plugin/settings/unrecovered.test.ts`
Expected: FAIL — the unhandled rejection from `loadData()` propagates out of `onload`, so the first cases fail with `data.json is a directory` rather than with an assertion. That is the right failure: nothing yet catches it.

- [ ] **Step 4: Widen the root's type**

In `src/plugin/composition-root.ts`:

```typescript
export interface CompositionRoot {
	/**
	 * `null` when `data.json` could not be READ — not when it is absent, which is a fresh
	 * install and loads defaults normally. Deliberately not "defaults on failure": once
	 * slice 4 puts folder paths in here, a default is a different LOCATION, not a milder
	 * version of the user's, so an index built on it scans folders the projects are not in.
	 *
	 * Every consumer therefore has to face the case, which is the point rather than a cost:
	 * code wanting a default for a display preference writes `?? DEFAULT_SETTINGS` and is
	 * visibly choosing it, while code needing a folder path cannot be handed a plausible
	 * wrong one.
	 */
	readonly settings: RenovationPlannerSettings | null;
	readonly logger: Logger;
}

export function createCompositionRoot(settings: RenovationPlannerSettings | null, logger: Logger): CompositionRoot {
	return { settings, logger };
}
```

Add the sentence slice 4 will need, beneath the function:

```typescript
// When slice 4 adds repositories, the index and the query services, this function composes
// them only when `settings !== null` — a service that reads or writes a configured location
// has no correct behaviour without the configuration that names it.
```

- [ ] **Step 5: Catch the rejection and refuse the write**

In `src/plugin/RenovationPlannerPlugin.ts`, replace the settings line in `onload` and guard `saveSettings`:

```typescript
		this.root = createCompositionRoot(await this.loadSettings(logger), logger);
```

```typescript
	/**
	 * `loadData()` RESOLVING null is a fresh install, not a failure: `settingsFrom(null)`
	 * returns defaults and the plugin is fully configured. Only a REJECTION is unrecovered,
	 * and recovery is a reload rather than a repair UI — fixing or removing `data.json` and
	 * toggling the plugin re-runs this. Nothing here re-reads on a timer and nothing writes a
	 * replacement file, because both amount to guessing at data the user still has.
	 */
	private async loadSettings(logger: Logger): Promise<RenovationPlannerSettings | null> {
		try {
			return settingsFrom(await this.loadData());
		} catch (cause) {
			logger.error('settings.load.failed', { cause });
			return null;
		}
	}

	saveSettings(next: RenovationPlannerSettings): Promise<void> {
		// Refused for the whole SESSION, not only at bootstrap: a transient read failure
		// must not stamp defaults over a `data.json` that is sitting there intact. The tab
		// is the other writer and is guarded independently (`getSettingDefinitions`).
		if (this.root.settings === null) return Promise.resolve();

		this.root = createCompositionRoot(next, this.root.logger);
		return this.saveData(next);
	}
```

`Logger` joins the type imports: `import type { LogLevel, Logger } from '../application/ports/Logger';`

- [ ] **Step 6: Guard the tab's two halves**

In `src/plugin/settings/SettingsTab.ts`:

```typescript
	getSettingDefinitions(): SettingDefinitionItem[] {
		// Empty while the settings could not be read, which is exactly the case 1.13 falls
		// back to `display()` for. The tab writes on every control change, so offering no
		// control is what keeps a failed read from becoming a write through a control nobody
		// has written yet.
		if (this.host.root.settings === null) return [];

		return [
			// … the units definition, unchanged …
		];
	}

	/**
	 * Called by Obsidian ONLY when `getSettingDefinitions()` is empty — so this is the
	 * unrecovered path and nothing else. Deprecated in 1.13 for the declarative contract
	 * above, and kept for exactly this fallback.
	 */
	display(): void {
		this.containerEl.empty();
		this.containerEl.createEl('p', { text: tr('settings.unrecovered') });
	}

	getControlValue(key: string): unknown {
		return this.host.root.settings?.[key as keyof RenovationPlannerSettings];
	}
```

`setControlValue` needs no guard: spreading `null` yields `{}`, `settingsFrom` returns defaults, and `saveSettings` refuses — one guard, at the writer, rather than two that could disagree.

- [ ] **Step 7: Add the string, in both locales**

`src/presentation/i18n/locales/en.ts`:

```typescript
	'settings.unrecovered': 'Settings could not be read. Fix or remove data.json in the plugin folder, then reload Obsidian.',
```

`src/presentation/i18n/locales/de.ts`:

```typescript
	'settings.unrecovered': 'Einstellungen konnten nicht gelesen werden. data.json im Plugin-Ordner reparieren oder entfernen, dann Obsidian neu laden.',
```

If the obsidianmd locale rule objects to the capitalised `Obsidian` mid-sentence in `en.ts`, reword rather than suppress — "…then reload the app." — and say so in the commit message.

- [ ] **Step 8: Tell fallow that Obsidian calls `display()`**

In `.fallowrc.json`, extend the `PluginSettingTab` entry — nothing in `src/` calls `display()`, so without this fallow reports a dead member:

```json
		{ "extends": "PluginSettingTab", "members": ["getSettingDefinitions", "getControlValue", "setControlValue", "display"] }
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `npx vitest run tests/plugin`
Expected: PASS — the new file and every earlier `tests/plugin` case, which is what says the whole-object assertions from Task 2 survived the type widening.

- [ ] **Step 10: Correct the spec's `CompositionRoot` block**

`docs/tasks/01`'s *Interfaces & Contracts* still shows `readonly settings: RenovationPlannerSettings;` while its own Design section argues for `| null`. Make the block match the Design section (both the interface and `createCompositionRoot`'s parameter).

- [ ] **Step 11: Run the whole gate**

Run: `npm run check`
Expected: all four pass. Watch for two things: the `?.` in `getControlValue` adds a branch, and the test in Step 2 covers both sides of it; and `npm run analyze` should report no dead member now that `display` is declared.

- [ ] **Step 12: Commit**

```bash
git add src/plugin src/presentation/i18n tests/helpers tests/plugin .fallowrc.json docs/tasks/01-plugin-bootstrap-and-composition-root.md
git commit -m "feat: refuse to write settings that could not be read"
```

---

### Task 4: Vue arrives — the mount lifecycle and every gate that makes it checked

**Files:**
- Create: `src/presentation/views/ViewRoot.vue`
- Create: `tests/presentation/views/viewRoot.test.ts`
- Modify: `src/presentation/views/RenovationProjectView.ts`
- Modify: `tests/presentation/views/renovationProjectView.test.ts`
- Modify: `package.json`, `tsconfig.json`, `vite.config.ts`, `vite.harness.config.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–3. This task is independent of them and could be reviewed alone.
- Produces:
  - `ViewRoot.vue` — a `<script setup lang="ts">` component whose root element carries `class="renovation-planner-view"`.
  - `RenovationProjectView.onOpen()` mounts `createApp(ViewRoot)` with its own Pinia into `contentEl`; `onClose()` unmounts it.

**Read this before the first edit.** Adding Vue is not one line in one config. Every item below is a gate that silently does nothing until it is wired, and each omission is invisible in a *different* place: the `vite.config.ts` one at `npm run build`, the `vite.harness.config.ts` one at `npm run harness`, the `vitest.config.ts` one at `npm test`, the `vue-tsc` one at neither (a build that reports success over code nothing type-checked), and the `coverage.include` one at the gate that still prints a number. They land in one commit for that reason.

**One design decision worth stating, because it makes the diff much smaller than it looks.** The app mounts onto `contentEl` **directly**, and `ViewRoot`'s own root element carries `renovation-planner-view` — the class the view used to create itself. So the rendered DOM is exactly what it was: `contentEl > .renovation-planner-view`. `styles/view.css` is unchanged, its `height: 100%` chain is unbroken, the harness is unchanged, and the three existing view tests keep passing as written. A wrapper div between `contentEl` and the component would have broken the height chain and needed a new CSS rule to repair it.

- [ ] **Step 1: Install, in one command each so the lockfile records the split correctly**

```bash
npm install vue pinia
npm install -D @vitejs/plugin-vue @vue/test-utils vue-tsc
```

`vue` and `pinia` are **dependencies**, not devDependencies: they are imported by `src/`, which is production code, and fallow's `dev-dependencies-in-production` rule exists to catch exactly that mistake. `@vueuse/core` is **not** installed — nothing in this slice or any later one imports it yet, and fallow fails an installed dependency with no importer.

- [ ] **Step 2: Wire all three configs that transform source**

`vite.config.ts` — add the import and put the plugin first:

```typescript
import vue from '@vitejs/plugin-vue';
```
```typescript
	plugins: [vue(), assembledStyles()],
```

`vite.harness.config.ts` — the same two edits. This is the surface with no gate in `npm run check`; it is proven in Step 9 by a screenshot.

`vitest.config.ts` — the same two edits, plus the coverage include:

```typescript
import vue from '@vitejs/plugin-vue';
```
```typescript
export default defineConfig({
	plugins: [vue()],
```
```typescript
			// `.vue` as well as `.ts`: the floors are ratcheted and they are one of the four
			// gates, so an SFC outside this include is a file whose untested branches cost
			// nothing — component tests run, the numbers do not move, and the gate passes
			// over code it never measured.
			include: ['src/**/*.{ts,vue}'],
```

- [ ] **Step 3: Make the type gate see SFCs**

`tsconfig.json`:

```json
  "include": ["src/**/*.ts", "src/**/*.vue"]
```

`package.json` — `vue-tsc` replaces `tsc` in **both** scripts. `test-build` is the easy one to miss because it is not in `check`, and missing it leaves the one command that produces a loadable vault build failing on the first SFC:

```json
		"build": "vue-tsc -noEmit && vite build",
		"test-build": "vue-tsc -noEmit && vite build --mode development && node scripts/test-build.mjs",
```

- [ ] **Step 4: Write the failing component test**

Create `tests/presentation/views/viewRoot.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The view's root component, in isolation.
 *
 * This file's EXISTENCE is one of the checks: without `@vitejs/plugin-vue` in
 * `vitest.config.ts`, importing an SFC fails at parse — before any assertion runs and
 * before coverage can measure anything — so the proof that the plugin is wired is that
 * this suite executes at all, not an assertion inside it.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';

describe('the view root', () => {
	/**
	 * The one class `styles/view.css` keys off, and the one the view used to create itself
	 * before the component existed. Asserted here so a rename cannot silently strip the
	 * stylesheet's only entry point into this view.
	 */
	it('renders the element the stylesheet keys off', () => {
		const wrapper = mount(ViewRoot);

		expect(wrapper.classes()).toContain('renovation-planner-view');
	});
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npx vitest run tests/presentation/views/viewRoot.test.ts`
Expected: FAIL — `Failed to resolve import ".../ViewRoot.vue"`.

- [ ] **Step 6: Write the component**

Create `src/presentation/views/ViewRoot.vue`:

```vue
<script setup lang="ts">
/**
 * The Vue root of the Renovation Project view — one isolated app per Obsidian `ItemView`
 * (ADR-004, SDD §12).
 *
 * It draws nothing yet, and that is the increment's success criterion rather than an
 * omission: "an empty Renovation Planner view opens reliably inside Obsidian". What this
 * proves is the LIFECYCLE — mount on open, unmount on close — before slice 5 gives it a
 * canvas to draw.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled
 * into one sheet. The class below is that sheet's only entry point into this view.
 */
</script>

<template>
	<div class="renovation-planner-view" />
</template>
```

- [ ] **Step 7: Run it and watch it pass**

Run: `npx vitest run tests/presentation/views/viewRoot.test.ts`
Expected: PASS. If it fails with a parse error mentioning `<script setup>`, the `vitest.config.ts` plugin edit in Step 2 did not take.

- [ ] **Step 8: Write the failing lifecycle test**

Add to the top of `tests/presentation/views/renovationProjectView.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Both modules are wrapped rather than replaced: the real `createApp` and `createPinia`
 * run, and the wrapper records what they returned. That is what lets the two claims ADR-004
 * actually makes be checked — that the app created on open is the one unmounted on close,
 * and that each view gets its OWN Pinia rather than a shared singleton. Neither is visible
 * in the DOM: an app left mounted and an app unmounted leave the same empty pane behind.
 */
const { apps, pinias } = vi.hoisted(() => ({ apps: [] as { unmount: () => void }[], pinias: [] as unknown[] }));

vi.mock('vue', async (importOriginal) => {
	const vue = await importOriginal<typeof import('vue')>();

	return {
		...vue,
		createApp: (...args: Parameters<typeof vue.createApp>) => {
			const app = vue.createApp(...args);
			apps.push(app);
			return app;
		},
	};
});

vi.mock('pinia', async (importOriginal) => {
	const pinia = await importOriginal<typeof import('pinia')>();

	return {
		...pinia,
		createPinia: () => {
			const store = pinia.createPinia();
			pinias.push(store);
			return store;
		},
	};
});
```

Extend the existing `beforeEach` and add the cases:

```typescript
	beforeEach(() => {
		apps.length = 0;
		pinias.length = 0;
		subject = makeView();
	});
```

```typescript
describe('the Vue lifecycle', () => {
	it('mounts one app into the content pane on open', async () => {
		await subject.onOpen();

		expect(apps).toHaveLength(1);
		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * ADR-004's actual claim: an isolated app per `ItemView`, not one long-lived app shared
	 * across views. A shared Pinia would let two open leaves mutate each other's state,
	 * which is invisible until the second leaf exists.
	 */
	it('gives each view its own Pinia instance', async () => {
		await subject.onOpen();
		await makeView().onOpen();

		expect(pinias).toHaveLength(2);
		expect(pinias[0]).not.toBe(pinias[1]);
	});

	// Unmount, not merely empty: an app left mounted keeps its effects and watchers alive
	// against a tree nobody can see, and both outcomes leave the same empty pane.
	it('unmounts the app it created on close', async () => {
		await subject.onOpen();
		const unmount = vi.spyOn(apps[0], 'unmount');

		await subject.onClose();

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(subject.contentEl.children).toHaveLength(0);
	});

	// Obsidian may close a leaf whose view never opened; nothing here may throw on it.
	it('does nothing when closed without having opened', async () => {
		await expect(subject.onClose()).resolves.toBeUndefined();

		expect(apps).toEqual([]);
	});
});
```

Run: `npx vitest run tests/presentation/views/renovationProjectView.test.ts`
Expected: FAIL — `expect(apps).toHaveLength(1)` gets 0; the view still creates a div itself.

- [ ] **Step 9: Mount the app**

In `src/presentation/views/RenovationProjectView.ts`:

```typescript
import { ItemView } from 'obsidian';
import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import ViewRoot from './ViewRoot.vue';
import { tr } from '../i18n/strings';
```

```typescript
	/**
	 * The app this view mounted, held only so `onClose` can unmount the same one. `null`
	 * between a close and the next open — Obsidian keeps the leaf and reuses the view.
	 */
	private app: VueApp | null = null;

	onOpen(): Promise<void> {
		this.contentEl.empty();
		// One isolated app per ItemView with its OWN Pinia (ADR-004, SDD §12) rather than a
		// shared singleton. Mounted onto `contentEl` directly — not `containerEl`, which
		// carries Obsidian's own view chrome — so the component's root element IS the
		// `.renovation-planner-view` the stylesheet keys off, with no wrapper in the height
		// chain.
		const app = createApp(ViewRoot);
		app.use(createPinia());
		app.mount(this.contentEl);
		this.app = app;
		return Promise.resolve();
	}

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep its
	 * effects alive against a detached tree and the next open would stack a second one.
	 * Emptying afterwards is what makes a re-open start from a clean pane; detaching the
	 * leaf instead would lose the user's layout, which is a recurring review rejection.
	 */
	onClose(): Promise<void> {
		this.app?.unmount();
		this.app = null;
		this.contentEl.empty();
		return Promise.resolve();
	}
```

Delete the old `createDiv('renovation-planner-view')` line and the comment above it — the component owns that element now. Update the class docblock's "When Vue lands…" paragraph, which is now describing the past.

- [ ] **Step 10: Run the view tests and watch them pass**

Run: `npx vitest run tests/presentation`
Expected: PASS — the four new cases and the three that existed before them ("draws one mount point", "does not stack a second tree when reopened", "empties the content pane on close"), unchanged. Those three passing untouched is what says the rendered markup did not move.

- [ ] **Step 11: Prove the type gate by its effect, not by reading the config**

Introduce a deliberate type error in `ViewRoot.vue` — inside the `<script setup>` block:

```typescript
const n: number = 'not a number';
```

```bash
npm run build          # expect: FAIL, error naming ViewRoot.vue
npm run test-build     # expect: FAIL, the same error
```

Both must fail. If `build` fails and `test-build` passes, the second `vue-tsc` substitution is missing. Remove the error afterwards and re-run both to green. Record in the commit message that this was verified — it is a one-time proof, and the standing protection is that a build cannot compile an SFC at all without the plugin.

- [ ] **Step 12: Prove the coverage include by its effect**

```bash
npm run test:coverage
```

Note the four numbers. Then add an untaken branch to `ViewRoot.vue`'s script block — `const unused = Math.random() > 2 ? 'a' : 'b';` — re-run, and confirm the branch figure **moves**. A config assertion would have passed while the file was invisible to the gate. Remove the branch and re-run to green.

- [ ] **Step 13: Prove the harness config by looking at it**

```bash
npm run harness-shot
```

Expected: PNGs written to `harness-shots/` for each colour scheme plus `?phone`, each showing the leaf chrome and an empty view pane — the same as before Vue, since the markup is unchanged. A blank page or a console error in the run means `@vitejs/plugin-vue` is missing from `vite.harness.config.ts`.

This surface has no gate inside `npm run check` — `npm run harness` and `harness-shot` are deliberately outside it. Optionally add a cheap tripwire to `tests/build/config-alias.test.ts` asserting both `vite.harness.config.ts` and `vitest.config.ts` name `@vitejs/plugin-vue`; label it in the test as a tripwire rather than a proof, since reading a config is exactly what Step 11 and Step 12 refuse to rely on.

- [ ] **Step 14: Run the whole gate**

Run: `npm run check`

Expected: all four pass. Three plausible reds, each with its own fix — and none of them is a suppression:
- **`npm run analyze` cannot resolve `./ViewRoot.vue`.** If fallow does not parse SFCs, add the import to `ignoreUnresolvedImports` in `.fallowrc.json` with a comment saying fallow's resolver, not the code, is the limitation. Do **not** add the file to `dynamicallyLoaded` — it is imported, and that key would be a false statement.
- **`npm run lint` reports nothing about the new `.vue` file.** That is expected here and is Task 5's whole subject: today's blocks are `.ts`-scoped, so the file is unlinted. Do not fix it in this commit.
- **oxlint or `tests/build/lint-scope.test.ts` behaving differently on `.vue`** — also Task 5's.

- [ ] **Step 15: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vite.harness.config.ts vitest.config.ts src/presentation/views tests/presentation/views
git commit -m "feat: mount an isolated Vue app per view"
```

---

### Task 5: The lint gate learns `.vue` — and every rule is proven by a fixture

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `tests/helpers/eslint.ts`
- Modify: `tests/build/lint-scope.test.ts` (only if the measurement in Step 1 says so)
- Create: `tests/build/vue-rules.test.ts`
- Modify: `package.json` (two devDependencies)

**Interfaces:**
- Consumes: `ViewRoot.vue` from Task 4 — the first `.vue` file, and the reason this task exists now rather than later.
- Produces:
  - `tests/helpers/eslint.ts`: `lintText(code: string, filePath: string): Promise<string[]>` — the rule ids ESLint reports for that text at that path.
  - An `eslint.config.mjs` in which every `src/` block has a `.vue` counterpart.

**Why now.** Every `src/` block in `eslint.config.mjs` is `.ts`-scoped, which was fine while `src/` was all TypeScript and stopped being fine the moment Task 4 landed: a rule set that ends at `.ts` exempts precisely the layer whose imports the dependency rule constrains most, and a component is the likeliest place for both a direct repository import and a stray `console.warn`.

**The one block easiest to leave out, and the reason it fails inward.** The logging carve-out (`**/src/infrastructure/logging/**`) must widen too. Widen the ban without widening the carve-out and the sink's own `.vue` files become the one place a `.vue` file cannot use the console — the exact inverse failure, and the harder one to diagnose, because the config *looks* correctly configured.

**A narrowing of the spec, stated rather than glossed.** The spec asks for every `src/` block to match `**/*.vue`, and the budgets block carries a **type-aware** rule (`@typescript-eslint/no-floating-promises`) via `parserOptions.projectService`. Type-aware linting of SFCs needs `extraFileExtensions: ['.vue']` and a real file the project service can resolve, and it makes the fixture technique in Step 3 (linting text at a path with no file on disk) throw rather than report. So the `.vue` block carries the **non-type-aware** rules — the budgets, `no-console`, the layer bans, the write boundary, the DOM globals ban — and `no-floating-promises` stays on `.ts` only. Write that limit into the config comment, and add the trigger: **the first SFC with an async call site is when type-aware linting of `.vue` gets wired**, with `extraFileExtensions` and a fixture that exists on disk. A guide that promised more than the check delivers would be the same defect as an unchecked comment.

- [ ] **Step 1: Measure what oxlint does with a `.vue` file before configuring anything**

```bash
npx oxlint --deny-warnings
node -e "const {lintedFiles}=await import('./tests/helpers/oxlint.ts')" 2>/dev/null || npx vitest run tests/build/lint-scope.test.ts
```

Read `tests/build/lint-scope.test.ts`'s `LINTED` regex before deciding anything: it lists the extensions the test *walks*, and its own comment says the list must not be narrower than what the tool parses. Two outcomes, two different edits:
- **oxlint lints `.vue`** — add `vue` to `LINTED` so the test measures the whole tree, and confirm the suite still passes.
- **oxlint does not lint `.vue`** — leave `LINTED` alone and add one sentence to its comment saying `.vue` is deliberately absent because oxlint does not parse it, so ESLint is the only linter that reaches SFCs. That also means the edit-loop hook (`scripts/lint-edited.mjs`, oxlint only) does not see a `.vue` file; note it there too, since the hook's whole value is being in the loop.

Whichever it is, record the measurement in the commit message. This is the step that keeps a claim from being written ahead of its check.

- [ ] **Step 2: Install the two lint dependencies**

```bash
npm install -D eslint-plugin-vue vue-eslint-parser
```

- [ ] **Step 3: Write the failing test**

First add the helper to `tests/helpers/eslint.ts`:

```typescript
/**
 * The rule ids ESLint reports for `code` treated as `filePath`.
 *
 * `lintText` resolves the REAL flat config for that path — the same globs, the same
 * per-directory blocks, the same parser — without a file on disk, which is what makes a
 * fixture possible at all: a conforming-except-one-rule `.vue` file committed under `src/`
 * would fail `npm run lint` for the whole repository, and a fixture parked outside `src/`
 * would be linted by different blocks than the ones under test.
 *
 * Rule IDS rather than the exit code, deliberately: a bare exit code cannot tell six rules
 * apart, so a fixture that went red for its own unrelated reason would read as a pass.
 */
export const lintText = async (code: string, filePath: string): Promise<string[]> => {
	const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });

	return result.messages.map((message) => message.ruleId ?? 'PARSE_ERROR');
};
```

Then create `tests/build/vue-rules.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { lintText } from '../helpers/eslint';

/**
 * The Vue half of the lint gate, proven by fixtures rather than by reading the config.
 *
 * A rule present in a flat config but scoped to files it never matches reports nothing and
 * looks correct — which is the failure this whole file is about, and the reason each
 * assertion reads the reported RULE ID rather than a pass/fail. Six rules, six fixtures,
 * each violating exactly one of them and otherwise conforming; plus the architecture blocks,
 * which are the ones that were `.ts`-scoped until the edit this file guards.
 *
 * `PARSE_ERROR` in a result means `vue-eslint-parser` is not configured for the block —
 * a distinct failure from a rule being absent, and worth reading as such.
 */
const COMPONENT = 'src/presentation/views/Fixture.vue';
const SINK = 'src/infrastructure/logging/Fixture.vue';

const conforming = (script: string, template = '<div class="x" />'): string =>
	`<script setup lang="ts">\n${script}\n</script>\n\n<template>\n\t${template}\n</template>\n`;

describe('the six named rules flat/recommended does not enable', () => {
	// An Options-API component is also the natural place to write a plain `<script>` block,
	// so this one fixture carries two violations — and that is fine: it still fails with
	// either rule absent or misscoped, which is the silence being gated against. What the
	// assertions must not do is confuse the two, which reading rule ids is what prevents.
	it('refuses the Options API and a script block with no lang', async () => {
		const reported = await lintText('<script>\nexport default { name: "Fixture" };\n</script>\n\n<template>\n\t<div />\n</template>\n', COMPONENT);

		expect(reported).toContain('vue/component-api-style');
		expect(reported).toContain('vue/block-lang');
	});

	it('refuses a runtime-object defineProps', async () => {
		const reported = await lintText(conforming('const props = defineProps({ title: String });\nvoid props;'), COMPONENT);

		expect(reported).toContain('vue/define-props-declaration');
	});

	it('refuses a runtime-array defineEmits', async () => {
		const reported = await lintText(conforming("const emit = defineEmits(['change']);\nvoid emit;"), COMPONENT);

		expect(reported).toContain('vue/define-emits-declaration');
	});

	// This project's override of Vue's scoped-styles guidance: the marketplace rejects
	// inline styles, so the plugin's CSS lives in `styles/` and an SFC may not carry any.
	it('refuses a style block', async () => {
		const reported = await lintText(`${conforming('')}\n<style>\n.x { display: block; }\n</style>\n`, COMPONENT);

		expect(reported).toContain('vue/no-restricted-block');
	});

	it('refuses a kebab-case component tag', async () => {
		const reported = await lintText(conforming('', '<view-root />'), COMPONENT);

		expect(reported).toContain('vue/component-name-in-template-casing');
	});

	// This one flat/recommended DOES carry, in its essential tier — asserted anyway,
	// because what is being checked is that the tier reaches `.vue` files here at all.
	it('refuses a single-word component name', async () => {
		const reported = await lintText(conforming(''), 'src/presentation/views/Root.vue');

		expect(reported).toContain('vue/multi-word-component-names');
	});
});

describe('the architecture blocks, now that they match .vue', () => {
	it('refuses a component importing infrastructure directly', async () => {
		const reported = await lintText(conforming("import { createConsoleLogger } from '../../infrastructure/logging/consoleLogger';\nvoid createConsoleLogger;"), COMPONENT);

		expect(reported).toContain('no-restricted-imports');
	});

	it('refuses a console call in a component', async () => {
		const reported = await lintText(conforming("console.warn('mounted');"), COMPONENT);

		expect(reported).toContain('no-console');
	});

	/**
	 * The inverse failure, and the one the DoD used to omit: a carve-out narrower than the
	 * ban it carves out of makes the sink's own `.vue` files the single place a `.vue` file
	 * cannot use the console.
	 */
	it('allows a console call inside the logging sink', async () => {
		const reported = await lintText(conforming("console.warn('sink');"), SINK);

		expect(reported).not.toContain('no-console');
	});
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run tests/build/vue-rules.test.ts`
Expected: every case FAILS — the reported ids are empty (no block matches `.vue` at all), or `PARSE_ERROR` appears because no parser handles `<template>`.

- [ ] **Step 5: Widen the config**

In `eslint.config.mjs`:

1. Import the plugin and the parser at the top:

```javascript
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
```

2. **One helper for the per-subtree globs**, so a layer block cannot be widened by half:

```javascript
/**
 * Both extensions for one `src/` subtree. A block widened to `.vue` on the ban but not on
 * its carve-out fails INWARD — the sink's own `.vue` files would be the one place a `.vue`
 * file could not use the console — so the two are spelled by the same function.
 */
const srcFiles = (subtree) => [`**/src/${subtree}/**/*.ts`, `**/src/${subtree}/**/*.vue`];
```

The blocks keyed to a subtree take it: `forbidden(...)` (item 3), `**/src/infrastructure/obsidian/**`, `**/src/core/**` + `**/src/domain/**`, and the logging carve-out. The whole-`src/` write-boundary block lists its two globs literally rather than routing a `'**'` through the helper, because `**/src/**/**/*.ts` is a needlessly clever spelling of the same set. **What actually catches a forgotten block is the test in Step 3, not this helper** — it exercises a layer ban, `no-console` and the carve-out through real `.vue` paths.

3. `forbidden(...)`'s own `files` key takes both extensions:

```javascript
	files: [`**/src/${layer}/**/*.ts`, `**/src/${layer}/**/*.vue`],
```

4. The write-boundary block, the `infrastructure/obsidian/` block, the DOM-globals block and the logging carve-out each take their `.vue` counterpart. **Repeat the shared selectors** in any block that sets `no-restricted-syntax` — two flat-config blocks matching one file override that rule rather than merging it, which the config's own comments already warn about.

5. Add the Vue blocks — `eslint-plugin-vue`'s flat configs, then this project's named rules, then the parser wiring:

```javascript
	...pluginVue.configs['flat/recommended'],
	{
		files: ['**/src/**/*.vue'],
		languageOptions: {
			parser: vueParser,
			// The TypeScript parser INSIDE the SFC, so `<script setup lang="ts">` parses.
			// Deliberately without `projectService`: type-aware linting of SFCs needs
			// `extraFileExtensions` and a file the project service can resolve, which the
			// fixture technique in tests/build/vue-rules.test.ts cannot supply. So
			// `@typescript-eslint/no-floating-promises` stays on `.ts` only, and the first
			// SFC with an async call site is the trigger to wire the type-aware half.
			parserOptions: { parser: tsparser },
		},
		rules: {
			// Each of these six is the CHECK under a rule in docs/setup/vue-conventions.md,
			// and `flat/recommended` enables none of them.
			'vue/component-api-style': ['error', ['script-setup']],
			'vue/block-lang': ['error', { script: { lang: 'ts' } }],
			'vue/define-props-declaration': ['error', 'type-based'],
			'vue/define-emits-declaration': ['error', 'type-based'],
			// This project's override of Vue's scoped-styles guidance: the marketplace
			// rejects inline styles and the plugin's CSS is assembled from `styles/`.
			'vue/no-restricted-block': ['error', 'style'],
			'vue/component-name-in-template-casing': ['error', 'PascalCase'],
			// The budgets and the console ban the `**/*.ts` block gives every other file.
			// Repeated rather than inherited: that block is `.ts`-scoped by design, since
			// its parser options are.
			'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
			'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
			complexity: ['error', 16],
			'max-depth': ['error', 4],
			'max-params': ['error', 5],
			'no-console': 'error',
		},
	},
```

The logging carve-out block must come **after** this one, and its `files` must include `**/src/infrastructure/logging/**/*.vue`, or the last-block-wins ordering leaves the sink banned.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run tests/build/vue-rules.test.ts`
Expected: PASS, all nine cases. A `PARSE_ERROR` anywhere means the parser block does not match that path; an empty result for one rule means that rule is in a block whose `files` do not reach `.vue`.

- [ ] **Step 7: Run the whole gate**

Run: `npm run check`
Expected: all four pass, with `ViewRoot.vue` now actually linted. If `flat/recommended` reports formatting complaints on `ViewRoot.vue`, fix the component — not the ruleset.

- [ ] **Step 8: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json tests/helpers/eslint.ts tests/build
git commit -m "feat: extend every src lint block to Vue single-file components"
```

---

### Task 6: Close the slice — ratchet the floors, then verify in a real vault

**Files:**
- Modify: `vitest.config.ts` (the `thresholds` block and the measurement comment above it)
- Modify: `docs/tasks/01-plugin-bootstrap-and-composition-root.md` (tick the Definition of Done; record the narrowings)

**Interfaces:**
- Consumes: every task above.
- Produces: nothing new in code. This task turns a finished increment into the floor the next one is held to, and answers the one question no gate here can — whether it works in Obsidian.

**Why the ratchet is last.** A mid-increment figure is not the increment's figure: refactoring later in the same branch deletes covered branches and moves the number. Raising a floor to a number measured before Task 5 would make the next legitimate deletion a choice between a test gymnastic and lowering a floor — and a floor never comes down.

- [ ] **Step 1: Measure**

Run: `npm run test:coverage`

Write down all four figures **as fractions, not percentages** — the summary prints both, and the fraction is what the arithmetic below needs.

- [ ] **Step 2: Compute the floors, one covered unit below each measurement**

For each metric: `floor = floor(measured% − 100/total)`, where `total` is the denominator of that metric's fraction. Whole numbers only — precision at these denominators would be theatre. Then apply the two rules the config already states:

- **A floor never goes down.** If a computed value is below the current floor (97/91/95/97), keep the current floor and find out why coverage dropped before doing anything else. An uncovered branch is first a question about which branch nothing can take — deleting an unreachable arm raises the figure on a smaller denominator, which is a better answer than a test written to reach it.
- **Expect the last hundredth to be irreproducible.** Put the floor under the lowest figure any environment has reported, and do not chase it with run counts.

- [ ] **Step 3: Write the floors and the measurement note**

In `vitest.config.ts`, update `thresholds` and **replace the dated measurement paragraph** with this increment's — the date, what was in place, and all four fractions. Keep the three numbered rules and the "floors are not 100" paragraph untouched; they are policy, not measurement. Leave a line saying which increment moved which figure, so git is not the only record.

- [ ] **Step 4: Run the full gate on a clean tree**

```bash
git status --short          # expect: empty
rm -rf node_modules && npm ci
npm run check
```

Expected: all four steps pass from a clean install — which is what CI runs, verbatim, across three Ubuntu legs (one per `engines.node` range) and one Windows leg at the floor.

- [ ] **Step 5: Build into the vault and verify in Obsidian**

```bash
npm run test-build
```

Then in Obsidian, with this repository open as the vault, reload the plugin and walk the list. Every item is something no gate here can answer:

- [ ] The plugin loads with no error notice.
- [ ] The developer console shows **nothing** at the default filter level — the "console noise" rejection, checked where it actually applies. Widen to Verbose and the two `debug` lines appear.
- [ ] The ribbon icon opens the **Renovation project** view; the tab shows the hammer icon and the display name.
- [ ] The command palette entry opens the **same** leaf — no second tab. Then the ribbon again: still one tab, focused.
- [ ] The view's pane fills its leaf rather than collapsing to a sliver — the defect a suite that draws nothing cannot see, and the reason `harness-shot` exists.
- [ ] Settings → Renovation Planner shows the units dropdown; searching Obsidian's settings for "units" finds it (the declarative contract's whole point — an imperatively drawn pane is absent from that index).
- [ ] Changing units to Imperial, then reloading Obsidian, keeps Imperial and does not duplicate the leaf.
- [ ] **The failure path, in the app.** Close Obsidian, replace `.obsidian/plugins/renovation-planner/data.json` with invalid JSON (`{`), reopen: the settings pane shows the unrecovered message instead of controls, the console shows exactly one error line naming `settings.load.failed`, and the file is **unchanged** afterwards — nothing wrote defaults over it. Restore the file and reload to confirm the value comes back.

Report the result of every box. A box that cannot be checked is a finding, not a formality.

- [ ] **Step 6: Tick the spec's Definition of Done, and record what was narrowed**

In `docs/tasks/01-plugin-bootstrap-and-composition-root.md`, check the boxes this work actually completed, and amend two of them rather than ticking them as written:

- The `.vue` lint box: add that `@typescript-eslint/no-floating-promises` remains `.ts`-only, why (the project service needs `extraFileExtensions` and a file on disk, which the fixture technique cannot supply), and the trigger for wiring it (the first SFC with an async call site).
- If Task 5's Step 1 found that oxlint does not parse `.vue`: add that the edit-loop hook does not see SFCs, so a `.vue` finding arrives at `npm run check` rather than at the edit.

Then set the note's own `status` and `finished` frontmatter, using the vocabulary `docs/README.md` documents — read that section rather than guessing a value.

- [ ] **Step 7: Commit and open the pull request**

```bash
git add vitest.config.ts docs/tasks/01-plugin-bootstrap-and-composition-root.md
git commit -m "chore: ratchet the coverage floors to increment 1"
git push -u origin feat/slice-1-bootstrap-and-composition-root
gh pr create --title "Design slice 1: plugin bootstrap and composition root" --body-file -
```

The pull request body should carry the four coverage figures, the vault checklist result, the two narrowings, and the Task 0 version findings. No `CHANGELOG.md` entry: this repository adds the dated section in the release pull request, and `npm version` refuses a dirty tree.

---

## Spec coverage map

Every Definition of Done item in the spec, and where it is done. Anything missing from this table is a gap in the plan, not in the spec.

| Spec DoD item | Task |
| --- | --- |
| `onload` loads settings, builds the root, registers the view, wires ribbon + command to one `revealView` | Already in the repository; re-asserted in Task 2 through `plugin.root` |
| `composition-root.ts` exists; the plugin holds `root` rather than `settings` | Task 2 |
| Exactly one `Logger`, constructed first, exposed by identity; a successful load emits nothing above `debug` | Task 2 |
| `createConsoleLogger('info')` levels, the level named in the line, `cause` forwarded, no `console.log`/`console.info` | Task 1 |
| A `loadData()` rejection → one `error`, `root.settings === null`, view and command still registered, no write, `getSettingDefinitions() === []` | Task 3 |
| `no-console` across `src/` in both linters with the one carve-out | Already in the repository; Task 1 puts the first file under it; Task 5 extends it to `.vue` |
| Every `src/` block matches `**/*.vue`, carve-out included | Task 5 (narrowed: `no-floating-promises` stays `.ts`-only) |
| The view opens from both inputs, reuses one leaf, type/name/icon set | Already tested; verified in the vault in Task 6 |
| `onOpen` mounts an isolated Vue app into `contentEl`; `onClose` unmounts it | Task 4 |
| The Vue arrival checklist — deps, three configs, `vue-tsc` in both scripts, `tsconfig` include, coverage include, `eslint-plugin-vue` + six named rules, six fixtures proven by effect | Tasks 4 and 5 |
| Settings round-trip; the tab renders from `getSettingDefinitions()`; both ends go through `settingsFrom` | Already tested; re-pointed at the root in Task 2 |
| Layer bans present and `npm run lint` clean | Already in the repository; Task 5 for `.vue` |
| `npm run build` produces one CJS `dist/main.js` with the externals | Already in the repository; re-run in Tasks 4 and 6 |
| `npm run check` passes on a clean checkout, on both platforms in CI | Task 6 |
| Manually verified inside Obsidian | Task 6 |

## Risks, and where each one shows up

- **`vue-tsc` against TypeScript 6.** The single blocking unknown, which is why Task 0 exists. If it does not support this TypeScript, stop and report — the fallbacks (pin TypeScript back and lose `typescript-eslint`'s peer range, or ship SFCs with no command-line type gate) are the user's decision.
- **`engines.node` is renegotiated by every dependency.** Six packages arrive in this plan. `tests/build/engines.test.ts` is the only thing that will tell you, and it reads the whole declared range rather than one bound.
- **fallow and `.vue`.** If its resolver does not parse SFCs, the import shows as unresolved. Named fix in Task 4, Step 14 — and *not* `dynamicallyLoaded`, which would be a false statement about an imported file.
- **oxlint and `.vue`.** Measured in Task 5, Step 1 rather than assumed, because both outcomes require a different edit and one of them changes what the edit-loop hook can see.
- **Mocking the `vue` and `pinia` modules** (Task 4, Step 8) spreads the real namespace. If that proves flaky, the fallback is to drop the app-identity and Pinia-isolation assertions and keep the DOM ones — and then **narrow the spec's DoD line** to say the unmount call itself is unchecked. Do not leave the wider sentence standing.
- **`root!:` definite assignment** may trip a linter rule not yet exercised; the named alternative is in Task 2, Step 4, and it is not a suppression.
- **The obsidianmd locale rule** on the new English string (capitalised `Obsidian` mid-sentence). Reword rather than suppress; Task 3, Step 7.
- **`tests/harness/*` and the axe test** run against a view that now renders through Vue. The markup is deliberately identical, so they should pass untouched — if one fails, that is information about the mount, not a reason to edit the assertion.

## What this plan deliberately does not do

- **No `onunload`.** `registerView`, `addRibbonIcon` and `addCommand` are unregistered by the `Plugin` base class; a handler that only repeats that is a place for a future mistake to hide. It arrives with the first thing that genuinely needs disposing — most likely slice 4's repositories, or a file-backed log sink.
- **No `app.workspace.onLayoutReady` call.** Nothing here walks the vault, so there is nothing to defer. The rule is written down in the spec for slice 4 to obey.
- **No `@vueuse/core`, no Konva, no `vue-konva`, no zod, decimal.js or dayjs.** Each arrives with its first real import; fallow fails a dependency with no importer.
- **No `eventBus`, `repositories`, `services` or `queries` in the composition root** — commented placeholders only, so the field they will occupy is visible without anything having to be faked.
- **No error-boundary, no `AppError` mapping, no `ToUserMessage`, no diagnostics.** Slices 11 and 17. Task 3 is one call site's decision, and the thing those slices cannot add later is the refusal to write.
- **No settings field for the log threshold.** A user-facing verbose switch belongs with slice 11's diagnostics work, and this slice does not add a field no feature reads.



