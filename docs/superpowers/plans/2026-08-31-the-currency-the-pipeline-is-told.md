# The Currency the Pipeline Is Told — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The cost pipeline is told which currency it must produce and refuses to produce another, so an asset priced in one currency can no longer yield an estimate in a project denominated in a different one.

**Architecture:** A branded `Currency` is minted in `core/money` by the two constructors that already validate the pattern. `Project` gains a `currency`, defaulted from a new `defaultCurrency` plugin setting by the persistence mapper rather than by a migration. `CostPipelineInput.expectedCurrency` becomes required and is refused before any arithmetic; the two commands that derive figures read the project to supply it. The read model gains one comparison so a project whose currency moved reads `stale`.

**Tech Stack:** TypeScript, Zod, decimal.js, Vue 3 + Pinia, Vitest, Obsidian plugin API.

**Spec:** [`docs/superpowers/specs/2026-08-31-the-currency-the-pipeline-is-told-design.md`](../specs/2026-08-31-the-currency-the-pipeline-is-told-design.md)

The spec is a **delta**. The full design is [`docs/tasks/20-the-currency-the-pipeline-is-told.md`](../../tasks/20-the-currency-the-pipeline-is-told.md), and the Issue [[The cost pipeline is told the currency it must produce]] records three withdrawn attempts. Read all three before Task 4; a reader who has not will try the same three things in the same order.

## Global Constraints

- **`npm run check` is the definition of done** — build + lint + coverage-thresholded tests + fallow. All four, before every commit.
- **Coverage floors are 99/99/99/98** (statements/functions/lines/branches). Measured at slice 19's close: 99.22/99.10/99.46/98.05. **Branches and functions each have ONE covered unit of headroom.** Every branch this plan adds gets its test in the same commit. There is no room to add an arm and cover it later.
- **Layer bans are lint rules.** `core/` may import nothing above it. `domain/` may import `core/`. `application/` may import `domain/` and `core/`. `infrastructure/` may import `application/`'s ports downward. `plugin/` composes everything. `vue`, `pinia`, `konva` and `obsidian` are banned by name in `core/`, `domain/` and `application/`.
- **No user-facing string literals.** UI copy comes from `t`/`tr` against a `StringKey`. Both `en.ts` and `de.ts` get every new key. German says **Objekt** and never *Material*, and leaves *Vault* untranslated — `tests/presentation/i18n/strings.test.ts` checks exactly those two terms.
- **`AppError.message` is developer English for a log line**, never user copy. User copy comes from `toUserMessage(language, error)` via the locale tables, which takes **no params** — a sentence cannot interpolate values.
- **Marketplace rules:** sentence-case UI text, no inline styles, no global `app`, `normalizePath` on user paths.
- **A new `*.test-d.ts` file must be added to `.fallowrc.json`'s `manualEntryPoints`, named individually** (never globbed). `tsconfig.json`'s `include` already covers `tests/**`, so `vue-tsc` reads it without further change.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert, run, see red, restore.
- **Every commit message is lowercase-scoped** in this repository's style (`feat(core): …`, `docs(specs): …`).

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `tests/core/money/currency.test.ts` | `parseCurrency` and `currencyOf`, both arms of each |
| `tests/core/money/currency.test-d.ts` | The brand's access rule: a bare string is not a `Currency`; a `Money`'s currency is |
| `tests/domain/cost/currencyInvariant.test.ts` | The pipeline refusal, both directions, and that nothing was computed |
| `tests/domain/cost/costPipelineInput.test-d.ts` | `expectedCurrency` is required — asserted by the compiler |
| `tests/plugin/settings/defaultCurrency.test.ts` | The setting's vocabulary gate and its `data.json` trust boundary |
| `tests/application/commands/requirement/currencyMismatch.test.ts` | Both commands read the project and pass `expectedCurrency` |
| `tests/application/queries/requirementStaleness.test.ts` | The read-model backstop's two arms, the stale one after a reload |

**Modified:**

| File | Change |
| --- | --- |
| `src/core/money/Money.ts` | `Currency`, `parseCurrency`, `currencyOf`; `Money.currency` becomes `Currency` |
| `src/domain/cost/costPipeline.ts` | `expectedCurrency` required; `currencyMismatchError` in `inputError` |
| `src/domain/project/Project.ts` | `currency` field; the budget/contingency coherence guard |
| `src/infrastructure/persistence/dto/projectFrontmatter.ts` | optional `currency` key, schema stays at version 1 |
| `src/infrastructure/persistence/mappers/projectMapper.ts` | writes `currency`; `projectFromPersistence` takes `defaultCurrency` |
| `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts` | holds `defaultCurrency`, passes it to the mapper |
| `src/application/commands/project/CreateProject.ts` | supplies `defaultCurrency` to `Project.create` |
| `src/application/commands/requirement/deriveRequirementFigures.ts` | `expectedCurrency` on the input, forwarded to the pipeline |
| `src/application/commands/requirement/AssignAsset.ts` | holds `projects`, reads the project's currency |
| `src/application/commands/requirement/RecalculateRequirement.ts` | same |
| `src/application/queries/GetRequirementsForZone.ts` | holds `projects`; `inputsStillMatch` compares the project's currency |
| `src/plugin/settings/settings.ts` | `CURRENCIES`, `defaultCurrency`, `currencyFrom` |
| `src/plugin/settings/SettingsTab.ts` | the dropdown row |
| `src/plugin/composition-root.ts` | threads `settings.defaultCurrency` into the four constructors |
| `src/presentation/read-models/PlanDto.ts` | `ProjectSummaryDto.currency` |
| `src/presentation/read-models/renovationProjectQueries.ts` | no change to signatures; `toProjectSummaryDto` already called here |
| `src/presentation/views/ProjectDetail.vue` | the currency line |
| `tests/helpers/entities.ts` | `makeProject` defaults `currency` to `EUR` — what keeps the suite compiling |
| `tests/presentation/views/projectDetail.test.ts` | its `PROJECT` const gains the field; one new case |
| `tests/domain/cost/costPipeline.test.ts` | every input gains `expectedCurrency`, each MATCHING its own case's price |
| `tests/domain/project/project.test.ts` | the coherence guard's three cases and the `withCurrency` refusal |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | four keys |
| `styles/` (project-detail partial) | `.rp-project-detail__currency` |
| `.fallowrc.json` | two new `*.test-d.ts` entries |
| `docs/tasks/20-…`, `docs/issues/The cost pipeline…`, `docs/requirements/Asset library.md`, `CLAUDE.md`, `vitest.config.ts` | Task 7 |

---

### Task 1: `Currency`, and the two doors that mint one

**Files:**
- Modify: `src/core/money/Money.ts`
- Create: `tests/core/money/currency.test.ts`
- Create: `tests/core/money/currency.test-d.ts`
- Modify: `.fallowrc.json`

**Interfaces:**
- Consumes: nothing. This is the first task.
- Produces:
  - `export type Currency = string & { readonly [currencyBrand]: true }` — assignable **to** `string`, and a `string` is not assignable to it.
  - `export function parseCurrency(raw: unknown): Result<Currency, ValidationError>` — for untrusted text (frontmatter, `data.json`).
  - `export function currencyOf(code: string): Currency` — **throws** on malformed input, for program literals. Mirrors this module's existing `createMoney`-versus-`of` split.
  - `Money.currency` is now `Currency` rather than `string`.

**Why two doors and not one:** this module already carries exactly this pair — `createMoney` answers a `Result` because its input is user data, and `of` **throws** because *"continuing without a valid `Money` would silently corrupt every downstream total — a programmer error, not a business failure (SDD §65)"*. A single `Result`-returning door would force every module-level literal (`CURRENCIES` in Task 2, `DEFAULT_SETTINGS`) to carry an **unreachable** error arm, and CLAUDE.md records that an unreachable guard is not free at this coverage margin.

- [ ] **Step 1: Write the failing test**

Create `tests/core/money/currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { currencyOf, of, parseCurrency, zero } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';

describe('parseCurrency', () => {
	it('accepts an uppercase ISO 4217 alpha-3 code', () => {
		expect(expectOk(parseCurrency('EUR'))).toBe('EUR');
	});

	it('refuses a lowercase code', () => {
		const result = parseCurrency('eur');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('money.invalid-currency');
	});

	it('refuses a non-string, because data.json holds whatever a user typed', () => {
		const result = parseCurrency(42);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('money.invalid-currency');
	});
});

describe('currencyOf', () => {
	it('answers the code for a program literal', () => {
		expect(currencyOf('GBP')).toBe('GBP');
	});

	it('THROWS rather than answering a Result, like `of` above it', () => {
		expect(() => currencyOf('gbp')).toThrow(/ISO 4217/);
	});
});

describe('a Money carries a validated Currency', () => {
	it('through `of`', () => {
		expect(of('1.00', 'CHF').currency).toBe('CHF');
	});

	it('through `zero`', () => {
		expect(zero('USD').currency).toBe('USD');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/money/currency.test.ts`
Expected: FAIL — `parseCurrency` and `currencyOf` are not exported from `Money.ts`.

- [ ] **Step 3: Add the brand and the two doors**

In `src/core/money/Money.ts`, immediately above `const moneyBrand = Symbol('Money');`:

```ts
/**
 * A validated ISO 4217 alpha-3 code. `declare const` with a `unique symbol` is type-only —
 * nothing is emitted — so the brand costs no runtime and cannot be forged outside this
 * module: an unvalidated `'eur'` does not compile where a `Currency` is wanted.
 *
 * The brand goes on the way OUT rather than on the way in, which is a narrower claim than
 * a brand usually invites: `createMoney`, `of` and `currencyOf` all refuse a
 * non-conforming code already, so branding their RESULT states a fact rather than adding
 * a hope. It stops a caller passing a bare string. It does not stop one passing the wrong
 * validated currency — nothing type-shaped can, and `computeEstimatedCost`'s refusal is
 * what catches that.
 */
declare const currencyBrand: unique symbol;
export type Currency = string & { readonly [currencyBrand]: true };
```

Change the `Money` interface's currency field:

```ts
	/** ISO 4217 alpha-3, uppercase — validated by whichever constructor built this. */
	readonly currency: Currency;
```

Add both doors immediately below `const CURRENCY_PATTERN = /^[A-Z]{3}$/;`:

```ts
/**
 * The untrusted-input door: `data.json`, note frontmatter, anything a user can type. Takes
 * `unknown` rather than `string` because both of those can hold a number or an object.
 */
export function parseCurrency(raw: unknown): Result<Currency, ValidationError> {
	if (typeof raw !== 'string' || !CURRENCY_PATTERN.test(raw)) {
		return err({
			category: 'Validation',
			code: 'money.invalid-currency',
			message: `A currency must be an uppercase ISO 4217 alpha-3 code; got "${String(raw)}".`,
		});
	}
	return ok(raw as Currency);
}

/**
 * The program-literal door, and it THROWS for the reason `of` does: a hard-coded currency
 * that does not parse is a programmer error, and a `Result` here would put an unreachable
 * error arm at every module-level literal that needs one.
 */
export function currencyOf(code: string): Currency {
	if (!CURRENCY_PATTERN.test(code)) {
		throw new Error(`A currency must be an uppercase ISO 4217 alpha-3 code; got "${code}".`);
	}
	return code as Currency;
}
```

- [ ] **Step 4: Route the existing constructors through them, rather than adding branches beside them**

This step **removes** two branches and adds none, which is what makes the coverage margin survivable. In `createMoney`, replace the `if (!CURRENCY_PATTERN.test(currency)) { … }` block with:

```ts
	const parsed = parseCurrency(currency);
	if (!parsed.ok) return parsed;
	return ok({ [moneyBrand]: true, amount, currency: parsed.value });
```

In `of`, replace its own `if (!CURRENCY_PATTERN.test(currency)) { throw … }` block with a call, and let `fromDecimal` take the branded value:

```ts
export function of(value: string | number | Decimal, currency: string): Money {
	const validated = currencyOf(currency);
	// … the amount handling below is unchanged; pass `validated` to fromDecimal.
```

Change `fromDecimal`'s signature to take the brand, since every caller now holds one:

```ts
function fromDecimal(amount: Decimal, currency: Currency, places?: number): Money {
	return { [moneyBrand]: true, amount: amount.toFixed(places ?? amount.dp()), currency };
}
```

`add`, `subtract`, `percentageOf`, `scale` and `round` all pass `a.currency` through, which is already a `Currency`, so none of them changes.

- [ ] **Step 5: Run the money suites**

Run: `npx vitest run tests/core/money/`
Expected: PASS, all four files. `parseCurrency`'s message text is byte-identical to the one `createMoney` used for a string input, so no existing message assertion moves.

- [ ] **Step 6: Write the type test**

Create `tests/core/money/currency.test-d.ts`:

```ts
/**
 * The brand's ACCESS rule, which has no runtime form: a `Currency` can only be obtained
 * from a door that validated one. Two `@ts-expect-error` directives, and an unsatisfied
 * directive is itself a build error — so widening `Currency` back to `string` fails
 * `npm run build` here rather than passing quietly.
 *
 * What this deliberately does NOT prove: that a caller passed the RIGHT currency. See the
 * brand's own docblock in `Money.ts`.
 */
import { currencyOf, of, type Currency } from '../../../src/core/money/Money';

// @ts-expect-error — a bare string literal is not a validated Currency.
const fromLiteral: Currency = 'EUR';

// @ts-expect-error — nor is an arbitrary string.
const fromString: Currency = String('EUR');

// A Money's currency IS one, and a Currency is still usable as a string.
const fromMoney: Currency = of('1.00', 'EUR').currency;
const asString: string = currencyOf('GBP');

void fromLiteral;
void fromString;
void fromMoney;
void asString;
```

- [ ] **Step 7: Register both new `.test-d.ts` files with fallow**

In `.fallowrc.json`'s `manualEntryPoints` array, add **this one line only** — individually, never as a glob, for the reason that array's own comment gives:

```json
		"tests/core/money/currency.test-d.ts",
```

Task 4 registers its own `costPipelineInput.test-d.ts` entry in the same array. Adding it here instead would name a file that does not exist yet, and fallow reports a missing entry point as an error — so each task registers only the file it creates.

Also extend that array's preceding comment, which currently counts *"The five `*.test-d.ts` files"*: it is six after this task and seven after Task 4. Update it to the count that is true when you commit — a count is a fact about the tree at the moment of the edit.

- [ ] **Step 8: Verify the type test discriminates**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

Then measure the directives rather than trusting them: temporarily change `export type Currency = string & { … }` to `export type Currency = string`, re-run, and confirm **exactly two** `TS2578: Unused '@ts-expect-error' directive` errors. Restore.

- [ ] **Step 9: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/core/money/Money.ts tests/core/money/currency.test.ts tests/core/money/currency.test-d.ts .fallowrc.json
git commit -m "feat(core): a Currency is minted by the doors that already validate one"
```

---

### Task 2: `defaultCurrency`, and the row that sets it

**Files:**
- Modify: `src/plugin/settings/settings.ts`
- Modify: `src/plugin/settings/SettingsTab.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Create: `tests/plugin/settings/defaultCurrency.test.ts`

**Interfaces:**
- Consumes: `Currency`, `currencyOf` (Task 1).
- Produces:
  - `export const CURRENCIES: readonly Currency[]` — the pane's vocabulary.
  - `RenovationPlannerSettings.defaultCurrency: Currency`.
  - `DEFAULT_SETTINGS.defaultCurrency` — `EUR`.

**Why a dropdown and not a text field, and why this list:** `setControlValue` writes through `saveSettings` on **every** change, so a text field persists every half-typed prefix and `settingsFrom` drops each one back to the default. That alone is only untidy. The deciding reason is `MINOR_UNIT_PLACES` in `Money.ts`, whose own comment says *"every currency this plugin prices in today (USD/EUR/…) has two"* — `round` finalizes at two decimal places, so a zero-minor-unit currency (JPY) rounds **wrong**. The list is currencies with two minor units, and that constraint is stated where the list is.

This is **not** the `libraryFolder` case: nothing moves and nothing is stranded, so a control is legal here.

- [ ] **Step 1: Write the failing test**

Create `tests/plugin/settings/defaultCurrency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CURRENCIES, DEFAULT_SETTINGS, settingsFrom } from '../../../src/plugin/settings/settings';

describe('defaultCurrency', () => {
	it('defaults to EUR on a fresh install', () => {
		expect(settingsFrom(null).defaultCurrency).toBe('EUR');
	});

	it('reads a value the vocabulary declares', () => {
		expect(settingsFrom({ defaultCurrency: 'GBP' }).defaultCurrency).toBe('GBP');
	});

	it('drops a value outside the vocabulary, like every other setting', () => {
		expect(settingsFrom({ defaultCurrency: 'JPY' }).defaultCurrency).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});

	it('drops a non-string, because data.json is a file the user can edit', () => {
		expect(settingsFrom({ defaultCurrency: 978 }).defaultCurrency).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});

	/**
	 * The list's whole reason: `round` finalizes at two decimal places, so a currency with
	 * a different minor unit would round wrong. A code added here without two minor units
	 * fails this case rather than shipping a quietly wrong total.
	 */
	it('offers only currencies with two minor units', () => {
		expect([...CURRENCIES]).toEqual(['CHF', 'EUR', 'GBP', 'USD']);
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/plugin/settings/defaultCurrency.test.ts`
Expected: FAIL — `CURRENCIES` is not exported and `defaultCurrency` does not exist.

- [ ] **Step 3: Add the vocabulary, the field and its gate**

In `src/plugin/settings/settings.ts`, add the import and the vocabulary above `DEFAULT_PROJECT_FOLDER`:

```ts
import { currencyOf, type Currency } from '../../core/money/Money';

/**
 * The vocabulary, and the single place it is written down — the same shape as `UNITS`.
 *
 * **Two minor units, every one of them.** `Money.round` finalizes at two decimal places
 * (`MINOR_UNIT_PLACES`), so a zero-minor-unit currency such as JPY would round every total
 * wrong. This list is the bound on the DEFAULT and not on a hand-written note: an asset
 * note's own `currency` passes `/^[A-Z]{3}$/` and is outside what this constrains.
 *
 * Minted through `currencyOf`, so the brand has exactly one origin and this file holds no
 * cast of its own.
 */
export const CURRENCIES: readonly Currency[] = ['CHF', 'EUR', 'GBP', 'USD'].map(currencyOf);
```

Add the field to `RenovationPlannerSettings`, after `libraryFolder`:

```ts
	/**
	 * The currency a NEW project starts from (§83), and the value a project note with no
	 * `currency:` key reads as. It is a default with a project counterpart, which is the
	 * test [[Settings and configuration]] states for which settings are defaults.
	 *
	 * **A project that never stated one FOLLOWS this value** until something saves that
	 * note, at which point `projectToPersistence` writes it and it stops floating. For a
	 * single-currency vault that is the feature; for a two-currency vault it is a footgun,
	 * and `GetRequirementsForZone`'s backstop is what makes it visible.
	 */
	defaultCurrency: Currency;
```

Add to `DEFAULT_SETTINGS`:

```ts
	defaultCurrency: currencyOf('EUR'),
```

Add the gate beside `unitsFrom`, and the field to `settingsFrom`:

```ts
/**
 * The one gate a currency value passes through, whether it came from `data.json` or from
 * the pane — `unitsFrom`'s shape exactly. Not `parseCurrency`: the question here is not
 * "is this a well-formed code" but "is this one of the codes this pane offers", which is
 * strictly narrower and is what keeps a JPY in `data.json` from reaching `round`.
 */
function currencyFrom(value: unknown): Currency {
	return CURRENCIES.find((code) => code === value) ?? DEFAULT_SETTINGS.defaultCurrency;
}
```

```ts
		defaultCurrency: currencyFrom(stored.defaultCurrency),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/plugin/settings/defaultCurrency.test.ts`
Expected: PASS, five cases.

- [ ] **Step 5: Add the pane row**

In `src/plugin/settings/SettingsTab.ts`, add a definition modelled exactly on the units row above it (which builds its options with `Object.fromEntries(UNITS.map(…))`), placed after the library action row and before the verbose-logging row:

```ts
			{
				name: tr('settings.default-currency.name'),
				desc: tr('settings.default-currency.desc'),
				control: {
					type: 'dropdown',
					options: Object.fromEntries(CURRENCIES.map((code) => [code, code])),
					key: 'defaultCurrency',
					defaultValue: DEFAULT_SETTINGS.defaultCurrency,
				},
			},
```

The option labels are the codes themselves and go through no `tr` — an ISO 4217 code is not translated, which is the same argument `strings.test.ts` makes for *Vault*.

Add `CURRENCIES` to the existing `settings` import at the top of the file.

- [ ] **Step 6: Add the copy, both locales**

`src/presentation/i18n/locales/en.ts`:

```ts
	'settings.default-currency.name': 'Default currency',
	'settings.default-currency.desc':
		'The currency a new project is priced in. A project that has not recorded one follows this setting.',
```

`src/presentation/i18n/locales/de.ts`:

```ts
	'settings.default-currency.name': 'Standardwährung',
	'settings.default-currency.desc':
		'Die Währung, in der ein neues Projekt kalkuliert wird. Ein Projekt ohne eigene Währung folgt dieser Einstellung.',
```

- [ ] **Step 7: Run the locale and settings suites**

Run: `npx vitest run tests/presentation/i18n/ tests/plugin/settings/`
Expected: PASS. `strings.test.ts` asserts `de.ts` translates every key `en.ts` declares, so a forgotten German key fails here.

- [ ] **Step 8: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/plugin/settings/ src/presentation/i18n/locales/ tests/plugin/settings/defaultCurrency.test.ts
git commit -m "feat(settings): a default currency, bounded to two-minor-unit codes"
```

---

### Task 3: `Project.currency`, the coherence rule, and the mapper's default

**Files:**
- Modify: `src/domain/project/Project.ts`
- Modify: `src/infrastructure/persistence/dto/projectFrontmatter.ts`
- Modify: `src/infrastructure/persistence/mappers/projectMapper.ts`
- Modify: `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts`
- Modify: `src/application/commands/project/CreateProject.ts`
- Modify: `src/plugin/composition-root.ts`
- Modify: `tests/infrastructure/persistence/mappers/projectMapper.test.ts`
- Test: `tests/domain/project/project.test.ts` (existing), `tests/infrastructure/persistence/mappers/projectMapper.test.ts`

**Interfaces:**
- Consumes: `Currency`, `currencyOf`, `parseCurrency` (Task 1); `DEFAULT_SETTINGS.defaultCurrency` (Task 2).
- Produces:
  - `Project.currency: Currency`, required in `CreateProjectProps`.
  - `Project.withCurrency(currency: Currency): Result<Project, ValidationError>` — re-validates through `create`, so the coherence guard below runs on the new value. Task 5 is its first caller.
  - `projectFromPersistence(raw: unknown, defaultCurrency: Currency): Result<Project, ValidationError>` — **the parameter is required**, so every caller is a compile error until it decides. There is one in `src/` (`ObsidianProjectRepository.ts:234`) and roughly eight in `tests/`.
  - `makeProject()` in `tests/helpers/entities.ts` defaults `currency` to `EUR`, which is what keeps the rest of the suite compiling.
  - `new ObsidianProjectRepository(deps, projectRoot, libraryFolder, defaultCurrency)`.
  - `new CreateProjectCommand(projects, events, defaultCurrency)` — check the existing parameter order in the file and append.

**Why no migration:** the spec's Decision 2. `PROJECT_MIGRATIONS` stays `[]`. Migrations here run on **read** (`migrateNote`; no save path calls it), so a migration and a schema redefinition both answer an absent key at read time — and a step supplying `defaultCurrency` cannot reach it, because `Migration.migrate(input: unknown): unknown` is pure and `MIGRATION_SET` is a module-level `const` whose single-ness is an asserted property.

- [ ] **Step 1: Write the failing tests — the coherence rule first**

Append to `tests/domain/project/project.test.ts`:

```ts
describe('a project has one currency', () => {
	it('refuses a budget denominated in another currency', () => {
		const result = Project.create({
			id: createProjectId(),
			name: 'Kitchen refit',
			currency: currencyOf('EUR'),
			budget: of('10000.00', 'GBP'),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('project.currency-mismatch');
			// The field is NAMED in the message, one code for both fields — the shape
			// `negativeAmount` beside it already uses.
			expect(result.error.message).toContain('budget');
		}
	});

	it('refuses a contingency denominated in another currency', () => {
		const result = Project.create({
			id: createProjectId(),
			name: 'Kitchen refit',
			currency: currencyOf('EUR'),
			contingency: of('500.00', 'CHF'),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toContain('contingency');
	});

	it('accepts both in the project currency, so the guard is not refusing everything', () => {
		const result = Project.create({
			id: createProjectId(),
			name: 'Kitchen refit',
			currency: currencyOf('EUR'),
			budget: of('10000.00', 'EUR'),
			contingency: of('500.00', 'EUR'),
		});
		expect(expectOk(result).currency).toBe('EUR');
	});
});
```

Add `currencyOf`, `of` and `expectOk` to that file's imports if they are not already there.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/domain/project/project.test.ts`
Expected: FAIL — `currency` is not a `CreateProjectProps` member.

- [ ] **Step 3: Add the field and the guard**

In `src/domain/project/Project.ts`, add `readonly currency: Currency;` to `CreateProjectProps`, to the entity's own field list, and to the `with*` props shapes — all three places the existing fields appear (`:9-17`, `:96-104`, `:107-115`).

Add the guard beside `negativeAmount`:

```ts
/**
 * A project has ONE currency, and this is the boundary that says so. `budget` and
 * `contingency` are `Money`, so each carries a currency of its own — without this guard
 * `Project.currency` would be a THIRD answer to "what currency is this project in" on an
 * entity that already held two.
 *
 * The same reasoning as `negativeAmount` above, and the same shape: the constructor is
 * private, so this is the one place every `Project` passes; neither field is persisted
 * yet, so there is no schema to state it at; and one code with the field NAMED in the
 * message, because two codes would read as two rules.
 */
function mismatchedCurrency(
	field: string,
	value: Money | null | undefined,
	currency: Currency,
): ValidationError | null {
	if (!value || value.currency === currency) return null;
	return projectError(
		'currency-mismatch',
		`A project ${field} must be in the project's currency (${currency}); got ${value.currency}.`,
	);
}
```

Call it in `create`, in the same `??` chain the existing guards use:

```ts
		const mismatch =
			mismatchedCurrency('budget', props.budget, props.currency)
			?? mismatchedCurrency('contingency', props.contingency, props.currency);
		if (mismatch) return err(mismatch);
```

Add `withCurrency` beside the entity's existing `with*` methods, re-validating through `create` exactly as they do — which is what makes changing the currency out from under a budget in the old one a refusal rather than a silent inconsistency:

```ts
	/**
	 * Re-validates, so `mismatchedCurrency` runs on the NEW value: a project holding a
	 * £10,000 budget cannot become an EUR project without the budget moving too.
	 */
	withCurrency(currency: Currency): Result<Project, ValidationError> {
		return Project.create({ ...this.props, currency });
	}
```

Match the spread the sibling `with*` methods use — read one before writing this; if they spread a private `props` field under another name, use that name.

Give it its own case in `tests/domain/project/project.test.ts`:

```ts
	it('refuses a currency change that would orphan a budget in the old one', () => {
		const project = expectOk(
			Project.create({
				id: createProjectId(),
				name: 'Kitchen refit',
				currency: currencyOf('GBP'),
				budget: of('10000.00', 'GBP'),
			}),
		);
		expect(project.withCurrency(currencyOf('EUR')).ok).toBe(false);
	});
```

- [ ] **Step 3a: Default the currency in the entity factory**

In `tests/helpers/entities.ts`, `makeProject` builds through `Project.create`, so every one of the suite's projects needs the field. Add the default **before** the spread, so a caller can still override it:

```ts
export function makeProject(props?: Partial<CreateProjectProps> & { id?: ProjectId }): Project {
	const { id, ...rest } = props ?? {};
	return expectOk(
		Project.create({
			id: id ?? createProjectId(),
			name: 'Kitchen renovation',
			currency: currencyOf('EUR'),
			...rest,
		}),
	);
}
```

`makeAsset` already prices in `EUR` (`moneyOf('45.00', 'EUR')`), so the existing suite satisfies Task 4's invariant without a single fixture changing currency — which is the reason `EUR` is the default on both sides rather than a coincidence worth relying on silently.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/domain/project/project.test.ts`
Expected: PASS. Other cases in the file will now fail to compile until each `Project.create` call gains a `currency` — fix each by adding `currency: currencyOf('EUR')`.

- [ ] **Step 5: Write the mapper's failing tests**

Append to `tests/infrastructure/persistence/mappers/projectMapper.test.ts`:

```ts
const EUR = currencyOf('EUR');
const GBP = currencyOf('GBP');

describe("a project note's currency", () => {
	it('takes the default when the key is absent', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS };
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('GBP');
	});

	it('honours a stated key over the default', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS, currency: 'CHF' };
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('CHF');
	});

	it('falls back to the default for a malformed value, rather than refusing the note', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS, currency: 'eur' };
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('EUR');
	});

	it('round-trips, so the value stops floating once the note is saved', () => {
		const created = expectOk(
			Project.create({ id: createProjectId(), name: 'Kitchen refit', currency: GBP }),
		);
		const raw = projectToPersistence(created, 1);
		expect(raw['currency']).toBe('GBP');
		// The default is EUR here and loses to the written key: the point of the round trip.
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('GBP');
	});

	/**
	 * The cost of Decision 2, pinned as BEHAVIOUR rather than described. A project that
	 * never stated a currency follows the setting. A later reader who "fixes" this fails
	 * here instead of making the spec quietly wrong.
	 */
	it('FLOATS: an un-stated currency follows whatever default it is read with', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS };
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('EUR');
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('GBP');
	});

	it('the schema stays at version 1 — no migration is registered', () => {
		expect(projectToPersistence(
			expectOk(Project.create({ id: createProjectId(), name: 'K', currency: EUR })),
			1,
		)['schema-version']).toBe(1);
		expect(PROJECT_MIGRATIONS).toHaveLength(0);
	});
});
```

Import `PROJECT_MIGRATIONS` from `src/infrastructure/persistence/migration/project/project.migrations`, and `currencyOf` from `src/core/money/Money`.

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/infrastructure/persistence/mappers/projectMapper.test.ts`
Expected: FAIL — `projectFromPersistence` takes one argument.

- [ ] **Step 7: Add the schema key and the mapper's default**

In `src/infrastructure/persistence/dto/projectFrontmatter.ts`, add to `ProjectFrontmatterSchemaV1` after `'target-completion': DATE_ONLY,`:

```ts
	/**
	 * Optional, and the schema stays at version 1 — slice 19's Asset precedent. `.catch(null)`
	 * runs LAST, so a malformed value reads as ABSENT rather than refusing the whole note,
	 * and an absent currency is answered by the caller's `defaultCurrency`. A note that has
	 * never stated one therefore follows the setting until its next save writes it down.
	 */
	currency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.nullable()
		.catch(null),
```

In `src/infrastructure/persistence/mappers/projectMapper.ts`, add `currency: project.currency` to `projectToPersistence`'s returned object, and thread the default through:

```ts
function fromDto(dto: ProjectFrontmatterDTO, defaultCurrency: Currency): Result<Project, ValidationError> {
	return Project.create({
		id: dto.id as Project['id'],
		name: dto.name,
		status: dto.status,
		description: dto.description,
		start: fromDateOnly(dto.start),
		targetCompletion: fromDateOnly(dto['target-completion']),
		// The schema has already refused any spelling that is not `/^[A-Z]{3}$/`, so this is
		// a program-safe value and `currencyOf` is the right door. The only branch here is
		// the absence, and both of its arms have a test.
		currency: dto.currency === null ? defaultCurrency : currencyOf(dto.currency),
	});
}

/** Parse (already-migrated) raw frontmatter through the versioned schema, then construct. */
export function projectFromPersistence(
	raw: unknown,
	defaultCurrency: Currency,
): Result<Project, ValidationError> {
	const parsed = parsePersisted(ProjectFrontmatterSchemaV1, raw, 'project.frontmatter-invalid', 'Project note');
	if (!parsed.ok) return parsed;
	return fromDto(parsed.value, defaultCurrency);
}
```

- [ ] **Step 8: Fix every caller the compiler names**

Run: `npx vue-tsc --noEmit`

Fix each reported site:
- `src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts:234` → `projectFromPersistence(migrated.value, this.defaultCurrency)`, with a fourth constructor parameter `private readonly defaultCurrency: Currency` appended after `libraryFolder`.
- `src/plugin/composition-root.ts:265` → `new ObsidianProjectRepository(deps, newProjectRoot, libraryFolder, defaultCurrency)`; thread `defaultCurrency` into `composeRepositories`' parameter list beside the two folders it already takes, and pass `settings.defaultCurrency` at `:360`.
- `src/application/commands/project/CreateProject.ts:46` → `Project.create({ ...input, id: createProjectId(), currency: this.defaultCurrency })`, with `private readonly defaultCurrency: Currency` appended to the constructor, and the root's construction site updated.
- Each `tests/` caller (`negatives.test.ts:502`, `mappers.test.ts:41`, `projectMapper.test.ts`, and any `Project.create` in a fixture) → pass `currencyOf('EUR')`.

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: PASS. Expect fixture churn — every `Project.create` in the tree now needs a `currency`.

- [ ] **Step 10: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/domain/project/ src/infrastructure/persistence/ src/infrastructure/obsidian/repositories/ObsidianProjectRepository.ts src/application/commands/project/CreateProject.ts src/plugin/composition-root.ts tests/
git commit -m "feat(project): a project has one currency, defaulted by the mapper"
```

---

### Task 4: the invariant — `expectedCurrency`, required, refused before arithmetic

**Files:**
- Modify: `src/domain/cost/costPipeline.ts`
- Modify: `src/application/commands/requirement/deriveRequirementFigures.ts`
- Modify: `src/application/commands/requirement/AssignAsset.ts`
- Modify: `src/application/commands/requirement/RecalculateRequirement.ts`
- Modify: `src/plugin/composition-root.ts`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: `.fallowrc.json`
- Create: `tests/domain/cost/currencyInvariant.test.ts`
- Create: `tests/domain/cost/costPipelineInput.test-d.ts`
- Create: `tests/application/commands/requirement/currencyMismatch.test.ts`

**Interfaces:**
- Consumes: `Currency` (Task 1); `Project.currency` (Task 3).
- Produces:
  - `CostPipelineInput.expectedCurrency: Currency` — **required**.
  - `DerivedFiguresInput.expectedCurrency: Currency` — required, forwarded verbatim.
  - `new AssignAssetCommand(zones, assets, requirements, events, locks, projects)`.
  - `new RecalculateRequirementCommand(requirements, zones, assets, events, projects)`.
  - Error code `cost.currency-mismatch`, category `Calculation`.

**One refusal, not two.** The task document specifies a second, earlier refusal inside `AssignAssetCommand`. It is **withdrawn**: `AssignAssetCommand` already fails when the pipeline refuses — it derives through `deriveRequirementFigures`, which *is* that pipeline — so the second guard buys wording, not protection, and pays with two codes, two categories and two surfaces for one failure. CLAUDE.md's *"two expressions of one question, three lines apart, drift immediately"* decides it.

**Why only `unitPrice` is compared:** `add`'s own `currencyMismatch` already refuses a `shipping` or `surcharge` in another currency against the unit price's. So one comparison makes every component transitively `expectedCurrency`, and this guard is not a second answer to those.

- [ ] **Step 1: Write the pipeline's failing test**

Create `tests/domain/cost/currencyInvariant.test.ts`:

```ts
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { computeEstimatedCost } from '../../../src/domain/cost/costPipeline';
import { currencyOf, of } from '../../../src/core/money/Money';

const TEN_SQUARE_METRES = { value: new Decimal('10'), unit: 'm2' } as const;

describe('the pipeline is told the currency it must produce', () => {
	it('refuses a unit price in another currency', () => {
		const result = computeEstimatedCost({
			quantity: TEN_SQUARE_METRES,
			unitPrice: of('39.50', 'GBP'),
			expectedCurrency: currencyOf('EUR'),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.category).toBe('Calculation');
			expect(result.error.code).toBe('cost.currency-mismatch');
			// Developer English names both values; the USER sentence cannot, because
			// `toUserMessage` takes no params.
			expect(result.error.message).toContain('GBP');
			expect(result.error.message).toContain('EUR');
		}
	});

	it('computes when they agree, so the test is not green because it refuses everything', () => {
		const result = computeEstimatedCost({
			quantity: TEN_SQUARE_METRES,
			unitPrice: of('39.50', 'EUR'),
			expectedCurrency: currencyOf('EUR'),
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.calculated.amount).toBe('395.00');
	});

	/**
	 * BEFORE any arithmetic: a mismatch must not be able to produce a partially computed
	 * figure. Driven with a discount above 100% as well — a second refusable input — so the
	 * assertion is that the currency check runs in the guard block rather than mid-chain.
	 */
	it('refuses before arithmetic, alongside the other input guards', () => {
		const result = computeEstimatedCost({
			quantity: TEN_SQUARE_METRES,
			unitPrice: of('39.50', 'GBP'),
			expectedCurrency: currencyOf('EUR'),
			shipping: of('10.00', 'GBP'),
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('cost.currency-mismatch');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/domain/cost/currencyInvariant.test.ts`
Expected: FAIL — `expectedCurrency` is not a `CostPipelineInput` member.

- [ ] **Step 3: Add the field and the guard**

In `src/domain/cost/costPipeline.ts`, add the import of `type Currency` to the existing `core/money/Money` import, and add to `CostPipelineInput` immediately after `unitPrice`:

```ts
	/**
	 * The currency this estimate MUST be denominated in — the project's. Required, and the
	 * asymmetry with `pricedPer?` above is deliberate: `pricedPer` omitted means no basis
	 * check runs and the result is the same number either way, while this omitted would mean
	 * no currency check runs and the result is a well-formed number no later check can tell
	 * from a correct one. An invariant a caller can omit is one a caller can silently
	 * bypass.
	 */
	readonly expectedCurrency: Currency;
```

Add the guard beside `pricingBasisError`:

```ts
/**
 * [[A mismatched unit or currency is an error, not a coercion]], at the one place that can
 * state it: the pipeline knows both the price it was handed and the currency it was told to
 * produce, and this product has no exchange rate and no date to read one at.
 *
 * Only `unitPrice` is compared. `add`'s own `currencyMismatch` already refuses a `shipping`
 * or `surcharge` in another currency against the unit price's, so one comparison makes every
 * component transitively `expectedCurrency` — and a second check here would be a second
 * answer to a question `core/money` already owns.
 */
function currencyMismatchError(input: CostPipelineInput): CalculationError | null {
	if (input.unitPrice.currency === input.expectedCurrency) return null;
	return {
		category: 'Calculation',
		code: 'cost.currency-mismatch',
		message:
			`The unit price is in ${input.unitPrice.currency} but the estimate must be in `
			+ `${input.expectedCurrency}. This product converts no currency.`,
	};
}
```

Add it **first** in `inputError`'s chain, so a mismatch is reported ahead of a basis or amount complaint about a price that is in the wrong money anyway:

```ts
function inputError(input: CostPipelineInput): CalculationError | null {
	return (
		currencyMismatchError(input)
		?? pricingBasisError(input)
		?? negativeQuantity(input.quantity)
		// … the rest unchanged
	);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/domain/cost/currencyInvariant.test.ts tests/domain/cost/`
Expected: the new file PASSES; `costPipeline.test.ts` FAILS to compile, because every input there now lacks a required field. Fix each by adding `expectedCurrency: currencyOf('EUR')` (or whichever currency that case's `unitPrice` uses — a case built to test a *different* refusal must pass a MATCHING currency, or it will go green on this refusal instead, which is the "a test can pass on the wrong refusal" defect this repository has already paid for fifty times).

- [ ] **Step 5: Write the requiredness type test**

Create `tests/domain/cost/costPipelineInput.test-d.ts`:

```ts
/**
 * `expectedCurrency` is REQUIRED, which is a claim only the compiler can hold — a runtime
 * test cannot distinguish "omitted" from "omitted and defaulted". An unsatisfied
 * `@ts-expect-error` is itself a build error, so making the field optional fails
 * `npm run build` here.
 */
import { Decimal } from 'decimal.js';
import { computeEstimatedCost } from '../../../src/domain/cost/costPipeline';
import { currencyOf, of } from '../../../src/core/money/Money';

const quantity = { value: new Decimal('1'), unit: 'm2' } as const;

// @ts-expect-error — an input without expectedCurrency is not a CostPipelineInput.
void computeEstimatedCost({ quantity, unitPrice: of('1.00', 'EUR') });

// The complete input compiles.
void computeEstimatedCost({
	quantity,
	unitPrice: of('1.00', 'EUR'),
	expectedCurrency: currencyOf('EUR'),
});
```

Add its path to `.fallowrc.json`'s `manualEntryPoints`:

```json
		"tests/domain/cost/costPipelineInput.test-d.ts",
```

- [ ] **Step 6: Verify the directive discriminates**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

Then measure: temporarily change the field to `readonly expectedCurrency?: Currency;`, re-run, and confirm exactly **one** `TS2578` error. Restore.

- [ ] **Step 7: Write the commands' failing test**

Create `tests/application/commands/requirement/currencyMismatch.test.ts`. It reuses `assignAsset.test.ts`'s own fixtures — `wired`, `makeProject`, `makePlan`, `makeZone`, `makeAsset` — rather than building a second stack helper:

```ts
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { currencyOf, of as moneyOf } from '../../../../src/core/money/Money';
import { expectErr, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../../helpers/entities';

/** 4 m × 2.5 m — exactly 10 m², no rounding anywhere. `assignAsset.test.ts`'s rectangle. */
const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

async function seed(projectCurrency: string, assetCurrency: string) {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf(projectCurrency) }), 'absent'),
	);
	const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zone = expectOk(
		await zones.save(
			expectOk(
				makeZone({
					projectId: project.entity.id,
					planId: plan.entity.id,
					name: 'Bathroom',
				}).withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	const asset = expectOk(
		await assets.save(
			makeAsset({
				unitCost: moneyOf('45.00', assetCurrency),
				wasteFactorDefault: new Decimal('0.10'),
			}),
			'absent',
		),
	);

	return {
		assets,
		requirements,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		assign: new AssignAssetCommand(zones, assets, requirements, events, new ReferenceLocks(), projects),
		recalculate: new RecalculateRequirementCommand(requirements, zones, assets, events, projects),
	};
}

describe('a pairing whose price is not in the project currency', () => {
	it('refuses the assignment and creates no requirement', async () => {
		const w = await seed('EUR', 'GBP');

		const result = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });

		expect(expectErr(result).code).toBe('cost.currency-mismatch');
		// Nothing was written. The refusal is pre-write, which is what keeps the save
		// indicator neutral rather than badging data nobody touched.
		expect(expectOk(await w.requirements.listByZone(w.zoneId))).toHaveLength(0);
	});

	it('succeeds when they agree, so the test is not green because it refuses everything', async () => {
		const w = await seed('EUR', 'EUR');

		const result = await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });

		expect(expectOk(result).created).toBe(true);
		// 10 m² × 1.10 waste = 11 m²; × 45.00 EUR = 495.00 EUR.
		expect(expectOk(result).requirement.estimatedCost.calculated.amount).toBe('495.00');
		expect(expectOk(result).requirement.estimatedCost.calculated.currency).toBe('EUR');
	});

	it('RecalculateRequirement refuses it too, reading the project itself', async () => {
		// Assign in EUR, then re-denominate the ASSET and recalculate. The command must read
		// the project's currency rather than trusting the requirement's own recorded one.
		const w = await seed('EUR', 'EUR');
		const created = expectOk(await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId }));
		const loaded = expectOk(await w.assets.getById(w.assetId));
		if (loaded === null) throw new Error('the asset was seeded');
		expectOk(
			await w.assets.save(
				expectOk(loaded.entity.withChanges({ unitCost: moneyOf('45.00', 'GBP') })),
				loaded.version,
			),
		);

		const result = await w.recalculate.execute({ requirementId: created.requirement.id });

		expect(expectErr(result).code).toBe('cost.currency-mismatch');
	});
});
```

**Two things to check against the tree before running, rather than assuming:** `Asset`'s re-pricing method (spelled `withChanges` above) — open `src/domain/asset/Asset.ts` and use whatever `with*` it actually declares for `unitCost`; and `AssignAssetCommand`'s parameter order, which Step 10 appends `projects` to. `expectErr`/`expectOk`/`RecordingEventBus` come from `tests/helpers/domain`, not from a `helpers/result` module — `assignAsset.test.ts:15` is the reference.

- [ ] **Step 8: Run to verify it fails**

Run: `npx vitest run tests/application/commands/requirement/currencyMismatch.test.ts`
Expected: FAIL — the commands take no `projects`.

- [ ] **Step 9: Thread the currency down to the derivation**

In `src/application/commands/requirement/deriveRequirementFigures.ts`, add to `DerivedFiguresInput`:

```ts
	/**
	 * The project's currency, resolved by the CALLER and passed in. It is not looked up
	 * here: a derivation that reached for a repository would be a second answer to what a
	 * Requirement costs, and both callers deliberately route through this one function.
	 */
	readonly expectedCurrency: Currency;
```

and forward it in the `computeEstimatedCost` call:

```ts
	const cost = computeEstimatedCost({
		quantity: purchase.value.calculated,
		unitPrice: input.unitCost,
		pricedPer: input.assetUnit,
		expectedCurrency: input.expectedCurrency,
	});
```

`CalculatedFrom` is **unchanged** — see Task 5 for why.

- [ ] **Step 10: Give both commands a project read**

In `AssignAsset.ts`, append `private readonly projects: ProjectRepository,` to the constructor. In `createAndSave`, load the project before deriving — `zone.projectId` is the id:

```ts
		const project = await this.projects.getById(zone.projectId);
		if (isErr(project)) return project;
		if (project.value === null) {
			return err({
				category: 'Reference',
				code: 'requirement.project-not-found',
				message: `Zone ${zone.id} names project ${zone.projectId}, which is not there.`,
			});
		}
		const figures = deriveRequirementFigures({
			zoneAreaMm2: area.value,
			assetUnit: asset.unit,
			unitCost: asset.unitCost,
			wasteFactor: asset.wasteFactorDefault,
			expectedCurrency: project.value.entity.currency,
		});
```

Add `requirement.project-not-found` to `AssignAssetErrors`' union if the existing union does not already admit a `ReferenceError`, and give it copy in Step 11.

In `RecalculateRequirement.ts`, append `private readonly projects: ProjectRepository,` to the constructor and load from `requirement.projectId`, wrapping a failure the way its siblings do:

```ts
		const project = await this.projects.getById(requirement.projectId);
		if (isErr(project)) {
			return err(calculationError('requirement.project-gone', project.error.message, project.error));
		}
		if (project.value === null) {
			return err(
				calculationError(
					'requirement.project-gone',
					`Requirement ${requirement.id} names project ${requirement.projectId}, which is not there.`,
				),
			);
		}
```

and pass `expectedCurrency: project.value.entity.currency` to `deriveRequirementFigures`.

Update both construction sites in `src/plugin/composition-root.ts` — `RecalculateRequirementCommand` at `:366`, and `AssignAssetCommand` wherever `composeSlice10` builds it (follow `Slice10Wiring`, which already carries `projects`).

- [ ] **Step 11: Add the user-facing copy**

`src/presentation/i18n/locales/en.ts` — sentence case, and it names the **relationship** rather than the values, because `toUserMessage` takes no params:

```ts
	'error.cost.currency-mismatch':
		"This asset's price is not in this project's currency, so no estimate can be produced. Change the project's currency or price the asset in it.",
	'error.requirement.project-not-found': 'That zone belongs to a project that is no longer there.',
	'error.requirement.project-gone': 'That requirement belongs to a project that is no longer there.',
```

`de.ts` — **Objekt**, never *Material*:

```ts
	'error.cost.currency-mismatch':
		'Der Preis dieses Objekts ist nicht in der Währung dieses Projekts, daher kann keine Schätzung erstellt werden. Ändern Sie die Währung des Projekts oder erfassen Sie den Preis in dieser Währung.',
	'error.requirement.project-not-found': 'Diese Zone gehört zu einem Projekt, das nicht mehr vorhanden ist.',
	'error.requirement.project-gone': 'Dieser Bedarf gehört zu einem Projekt, das nicht mehr vorhanden ist.',
```

Follow the exact key prefix `toUserMessage` reads — open `src/presentation/i18n/toUserMessage.ts` and match its `error.<code>` spelling rather than assuming the one written above.

Then add a row for each new code to `tests/presentation/i18n/toUserMessage.test.ts`'s table, **copied from the raise site** rather than from `en.ts` — a table derived from the locale file would agree with a typo.

- [ ] **Step 12: Run the suites**

Run: `npx vitest run tests/domain/cost/ tests/application/commands/requirement/ tests/presentation/i18n/`
Expected: PASS.

- [ ] **Step 13: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/domain/cost/costPipeline.ts src/application/commands/requirement/ src/plugin/composition-root.ts src/presentation/i18n/locales/ .fallowrc.json tests/
git commit -m "feat(cost): the pipeline is told the currency it must produce, and refuses another"
```

---

### Task 5: the read-model backstop

**Files:**
- Modify: `src/application/queries/GetRequirementsForZone.ts`
- Modify: `src/plugin/composition-root.ts`
- Create: `tests/application/queries/requirementStaleness.test.ts`

**Interfaces:**
- Consumes: `Project.currency` (Task 3); the invariant (Task 4).
- Produces: `new GetRequirementsForZone(requirements, zones, assets, projects)` — one appended parameter.

**Why no new persisted field, and why `assetMatchesCalculatedFrom` is left alone.** The task document adds `projectCurrency` to `CalculatedFrom`, a `project-currency` frontmatter key, a `REQUIREMENT_MIGRATIONS` step, and a deliberate under-report — on the grounds that *"the project's currency at the time of the original calculation is not recoverable."* It **is**: the requirement note declares a single `currency` key which `requirementMapper` hands to `cost-calculated`, `cost-override` and `calculated-from-unit-cost` alike, and after Task 4 that value is by construction the project's currency at calculation time.

The two comparisons are two questions:

- **`assetMatchesCalculatedFrom`** (the cascade-skip test in `onAssetUpdated`) is **unchanged**. It already compares `asset.unitCost.currency`, so a re-denominated asset already invalidates. A project read here would cost one read per project across a shared asset's whole fan-out, to answer a question that is not about the asset.
- **`inputsStillMatch`** (this query) gains exactly one comparison.

- [ ] **Step 1: Write the failing test**

Create `tests/application/queries/requirementStaleness.test.ts`, reusing the in-memory repositories and entity factories the command tests use:

```ts
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import { GetRequirementsForZone } from '../../../src/application/queries/GetRequirementsForZone';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { currencyOf, of as moneyOf } from '../../../src/core/money/Money';
import { expectOk, RecordingEventBus } from '../../helpers/domain';
import { makeAsset, makePlan, makeProject, makeZone } from '../../helpers/entities';

const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

/** One EUR project, one zone, one EUR asset, one requirement derived from them. */
async function seeded() {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();

	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('EUR') }), 'absent'),
	);
	const plan = expectOk(await plans.save(makePlan({ projectId: project.entity.id }), 'absent'));
	const zone = expectOk(
		await zones.save(
			expectOk(
				makeZone({
					projectId: project.entity.id,
					planId: plan.entity.id,
					name: 'Bathroom',
				}).withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	const asset = expectOk(
		await assets.save(
			makeAsset({ unitCost: moneyOf('45.00', 'EUR'), wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	expectOk(
		await new AssignAssetCommand(zones, assets, requirements, events, new ReferenceLocks(), projects)
			.execute({ zoneId: zone.entity.id, assetId: asset.entity.id }),
	);

	return {
		projects,
		assets,
		projectId: project.entity.id,
		zoneId: zone.entity.id,
		assetId: asset.entity.id,
		query: new GetRequirementsForZone(requirements, zones, assets, projects),
	};
}

describe("a project's currency is part of what a figure was calculated from", () => {
	it('reads current while the currencies agree', async () => {
		const w = await seeded();
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('current');
	});

	it('reads stale once the project currency moves, from the PERSISTED figures', async () => {
		const w = await seeded();
		const loaded = expectOk(await w.projects.getById(w.projectId));
		if (loaded === null) throw new Error('the project was seeded');
		expectOk(
			await w.projects.save(
				expectOk(loaded.entity.withCurrency(currencyOf('GBP'))),
				loaded.version,
			),
		);

		// Re-read through the query rather than through anything held in memory: a
		// comparison against a persisted value is only a backstop if it survives the trip.
		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});

	/**
	 * The half deliberately NOT moved: `assetMatchesCalculatedFrom` already compares the
	 * asset's own currency, so a re-denominated asset invalidates with no project read at
	 * all. Asserted because "we did not touch it" is not evidence.
	 */
	it('a re-denominated ASSET still reads stale, through the comparison that already existed', async () => {
		const w = await seeded();
		const loaded = expectOk(await w.assets.getById(w.assetId));
		if (loaded === null) throw new Error('the asset was seeded');
		expectOk(
			await w.assets.save(
				expectOk(loaded.entity.withChanges({ unitCost: moneyOf('45.00', 'GBP') })),
				loaded.version,
			),
		);

		const rows = expectOk(await w.query.execute(w.zoneId));
		expect(rows[0]?.recalculationStatus).toBe('stale');
	});
});
```

**Two things to check against the tree rather than assume:** `Asset`'s re-pricing `with*` method (spelled `withChanges` above), and whether `GetRequirementsForZone.execute` takes a bare `ZoneId` or an input object — read its `implements Query<…>` clause. `withCurrency` is Task 3's, not this task's.

**A note on the second case's honesty:** these are in-memory repositories, so "persisted" means what the repository holds rather than what a vault does. That is the right instrument for the *comparison* and not for the *round trip* — the frontmatter round trip is Task 3's `projectMapper.test.ts` case, which is where a lost `currency:` key would actually be caught. Do not write this case's comment as though it proved the disk.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/application/queries/requirementStaleness.test.ts`
Expected: FAIL — the query takes no `projects`, and the currency-moved case reads `current`.

- [ ] **Step 3: Add the comparison**

In `src/application/queries/GetRequirementsForZone.ts`, append `private readonly projects: ProjectRepository,` to the constructor, load the project once per `execute` from the zone's `projectId`, and widen the two predicates:

```ts
function inputsStillMatch(
	recordedFrom: CalculatedFrom,
	currentAreaMm2: Result<number, unknown>,
	asset: { unit: MeasurementUnit; unitCost: Money },
	projectCurrency: Currency,
): boolean {
	if (!isOk(currentAreaMm2)) return false;
	const measured = toMeasuredQuantity(new Decimal(currentAreaMm2.value), recordedFrom.assetUnit);
	if (!measured.ok) return false;
	return (
		measured.value.value.equals(recordedFrom.zoneArea.value)
		&& asset.unit === recordedFrom.assetUnit
		&& asset.unitCost.amount === recordedFrom.unitCost.amount
		&& asset.unitCost.currency === recordedFrom.unitCost.currency
		// The project's currency at calculation time IS the recorded unit cost's — the
		// requirement note carries one `currency` key for both. So this needs no new field
		// and no migration: a project whose currency moved no longer matches what its own
		// figures were derived from.
		&& projectCurrency === recordedFrom.unitCost.currency
	);
}
```

Thread `projectCurrency` through `isStaleReading` the same way. A project that cannot be read or is gone reads **stale**, matching that function's existing rule that a missing endpoint is never reported `current`.

Update the construction site in `src/plugin/composition-root.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/application/queries/ tests/application/event-handlers/`
Expected: PASS, including the untouched `onAssetUpdated` cases.

- [ ] **Step 5: Verify the comparison discriminates**

Delete the `&& projectCurrency === recordedFrom.unitCost.currency` line, re-run `npx vitest run tests/application/queries/requirementStaleness.test.ts`, and confirm the currency-moved case goes **red** while the other two stay green. Restore.

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/application/queries/GetRequirementsForZone.ts src/plugin/composition-root.ts tests/
git commit -m "feat(requirement): a project whose currency moved reads stale"
```

---

### Task 6: the currency on screen

**Files:**
- Modify: `src/presentation/read-models/PlanDto.ts`
- Modify: `src/presentation/views/ProjectDetail.vue`
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Modify: the project-detail `styles/` partial
- Modify: `tests/presentation/views/` (the existing project-detail spec) and `tests/harness/accessibility.test.ts` if the scan asserts a node list

**Interfaces:**
- Consumes: `Project.currency` (Task 3).
- Produces: `ProjectSummaryDto.currency: string` — a plain string on the DTO, deliberately: presentation renders it and compares nothing, and a brand at a boundary that only prints is a claim with no consumer.

**Read-only, and why.** A `SetProjectCurrency` command would make the increment fully usable in a two-currency vault, and its consequence — every Requirement in the project reading stale — deserves its own increment. This takes the informational-row shape `libraryFolder` already established: the line exists so a user meeting the refusal can see which currency the project is in without opening the note.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/views/projectDetail.test.ts`, following the `mount` shape every case in that file already uses (its `PROJECT` const is at line 16 and will need the new field):

```ts
	it('says which currency the project is priced in, beside its status', () => {
		const wrapper = mount(ProjectDetail, {
			props: { project: { ...PROJECT, currency: 'GBP' }, plans: [], emptyState: null },
		});

		expect(wrapper.get('.rp-project-detail__currency').text()).toBe(
			t('en', 'view.project.currency', { currency: 'GBP' }),
		);
	});
```

The file's own `PROJECT` const gains `currency: 'EUR'` in the same edit — the compiler names it as soon as the DTO grows the field in Step 3.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/presentation/views/`
Expected: FAIL — `currency` is not a `ProjectSummaryDto` member and the element does not exist.

- [ ] **Step 3: Carry it on the DTO**

In `src/presentation/read-models/PlanDto.ts`, add to `ProjectSummaryDto`:

```ts
	/**
	 * The project's currency, for display only. A plain `string` rather than the branded
	 * `Currency`: this surface prints it and compares nothing, and a brand at a boundary
	 * with no consumer is a claim nothing rests on.
	 */
	readonly currency: string;
```

and to `toProjectSummaryDto`:

```ts
export function toProjectSummaryDto(project: Project, libraryOverlap: boolean): ProjectSummaryDto {
	return {
		id: project.id,
		name: project.name,
		status: project.status,
		currency: project.currency,
		libraryOverlap,
	};
}
```

Both call sites in `renovationProjectQueries.ts` already pass a `Project`, so neither signature moves. Every test fixture that hand-builds a `ProjectSummaryDto` now needs the field — the compiler names them.

- [ ] **Step 4: Draw it**

In `src/presentation/views/ProjectDetail.vue`, beside the existing status span at `:57`:

```html
			<span class="rp-project-detail__currency">
				{{ tr('view.project.currency', { currency: project.currency }) }}
			</span>
```

`tr` with params exists since slice 19. Add the key:

`en.ts`: `'view.project.currency': 'Priced in {currency}',`
`de.ts`: `'view.project.currency': 'Kalkuliert in {currency}',`

`strings.test.ts` asks a per-key question — that a key's German translation names the same holes as its English one — so a mis-holed translation fails there.

- [ ] **Step 5: Style it**

In the project-detail `styles/` partial, beside `.rp-project-detail__status`:

```css
.rp-project-detail__currency {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
```

**No hard-coded colour** — the build fails on one (SDD §84), and `lightningcss` resolves a bare word like `grey` to the same node a hex literal produces.

- [ ] **Step 6: Run the suites**

Run: `npx vitest run tests/presentation/ tests/harness/`
Expected: PASS. `accessibility.test.ts` scans the real detail surface; a `<span>` carrying text adds no ARIA and should not move it. If it does, read the violation rather than working around it.

- [ ] **Step 7: Look at it**

Run: `npm run harness-shot -- --width=460`
Then open `harness-shots/project-detail-narrow*.png` and `project-detail*.png` and **look**. The header is a grid; a third item in it is exactly the shape that has already moved this surface's other two (CLAUDE.md records the status label losing its column to the overlap marker). jsdom lays nothing out, so this is the only instrument.

If Chromium is not installed, `npx playwright install chromium`, or set `RP_CHROMIUM_EXECUTABLE`. **If neither is possible, say so in the commit message** rather than reporting the capture as done — this repository has already disclosed one un-run capture check.

- [ ] **Step 8: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/presentation/ styles/ tests/
git commit -m "feat(view): a project says which currency it is priced in"
```

---

### Task 7: the record

**Files:**
- Modify: `docs/tasks/20-the-currency-the-pipeline-is-told.md`
- Modify: `docs/issues/The cost pipeline is told the currency it must produce.md`
- Modify: `docs/requirements/Asset library.md`
- Modify: `CLAUDE.md`
- Modify: `vitest.config.ts`

**Interfaces:** consumes everything above. Produces no code.

A closed increment whose withdrawals live only in a spec is an increment whose next reader re-adds them.

- [ ] **Step 1: Measure the coverage, and ratchet only if it rose**

Run: `npm run test:coverage`

Record the four figures in `vitest.config.ts`'s policy comment beside the existing history, naming this increment. **Raise a floor only to what this finished increment measures, rounded down** — and if the rounded-down figures equal the floors already in force, ratchet **nothing**, which is what slices 5, 11, 13, 15, 16, 18 and 19 did.

Then read the per-file numbers rather than the summary line, because the summary cannot see one arm. For each file this increment changed, open `coverage/coverage-final.json` and check its uncovered branch and function counts:

```bash
node -e "const c=require('./coverage/coverage-final.json');for(const [f,d] of Object.entries(c)){if(!/Money|costPipeline|Project\.ts|projectMapper|deriveRequirement|AssignAsset|RecalculateRequirement|GetRequirementsForZone|settings/.test(f))continue;const b=Object.values(d.b).flat().filter(n=>n===0).length,fn=Object.values(d.f).filter(n=>n===0).length;if(b||fn)console.log(f,'uncovered branches:',b,'functions:',fn);}"
```

Expected: no output. A line here is an arm this plan added and did not test — and at one covered unit of headroom in each of two metrics, an arm in the slack metric hides completely while the summary figure does not visibly move. Slice 16's review pass left one uncovered at 98.12 against a floor of 98 and the gate said nothing.

- [ ] **Step 2: Write the amendments to `docs/tasks/20`**

Add a dated `## Amendment 1 (2026-08-31)` section carrying the seven items the spec's **Amendments owed** section enumerates. Three of them are **withdrawals, not ticks** — the migration-runner Definition-of-Done item, `AssignAssetCommand`'s pre-check, and the `projectCurrency`/Requirement-migration/under-report group — and each must say **withdrawn** and why, so a later reader does not re-add it as an oversight.

Also correct the document's `Interfaces & Contracts` block in place: it names `Currency` as though it existed, and `CalculatedFrom` as gaining a field it does not gain.

- [ ] **Step 3: Answer the Issue without closing it**

In `docs/issues/The cost pipeline is told the currency it must produce.md`, record the answer to its closing question — **an override *satisfies* the refusal rather than replacing it**, because the pipeline's check stands for every caller and the override is how a project passes it — and add a *Revisit when* naming the override increment. Leave `status: New`: the note is answered, and the code the second half describes is unwritten.

- [ ] **Step 4: Do NOT tick `Asset library`**

Its open item — *"A project can record its own price against a shared definition"* — is **not** met. Add one line saying it belongs to the override increment, so a reader of that epic does not conclude this increment forgot it.

- [ ] **Step 5: Update `CLAUDE.md`**

Three passages are now false, and this file's own rules are what make each worth an edit:

1. **The settings-pane count.** It says *"five rows and only three of them bind a control"* and explicitly notes it has been wrong twice before. It is **six rows and four controls** now. Count from `getSettingDefinitions` rather than from this sentence.
2. **The migration passage.** `PROJECT_MIGRATIONS` is still empty, and it now stays empty *by a decision* rather than for want of a schema change. Record the decision and its cost — the runner remains unproven on a real chain — beside the existing `MIGRATION_SET` bullet.
3. **A new section for this increment**, in the house style: what landed, and the rules that came out of it. At least these, each already measured above:
   - **A brand on the way out costs nothing; a brand on the way in costs 142 call sites.** Measured before choosing, and the constructors already validated, so branding their result stated a fact rather than adding a hope.
   - **A `Result`-returning door forces an unreachable error arm at every program literal**, which is why `currencyOf` throws — the split `createMoney`/`of` already had, applied to a second value type.
   - **"Not recoverable" was a claim about the DOMAIN made without reading the NOTE.** The requirement note's one `currency` key made a new provenance field, a schema bump, a migration and a deliberate under-report all unnecessary — and the version that read the note is *truer*, flagging exactly the wrong-currency Requirements rather than blanket-marking or blanket-forgiving them.
   - **Two callers of one predicate were asking two questions.** The cascade-skip test is about the ASSET and needed no project read; only the read model needed one.
   - **A settings control's vocabulary was decided by `MINOR_UNIT_PLACES`, not by taste.** `round` finalizes at two places, so the list is currencies with two minor units — and that bounds the default and not a hand-written note, which is a residue recorded rather than closed.

- [ ] **Step 6: Full gate, then commit**

Run: `npm run check`
Expected: PASS.

```bash
git add docs/ CLAUDE.md vitest.config.ts
git commit -m "docs: record what the currency increment took, and what it withdrew"
```

---

## Deferred to the override increment

Named here as well as in the spec, because a plan is what the next author opens:

- `AssetPriceOverride`, its id, schema, errors, events, in-memory and Obsidian repositories, and one shared contract test.
- `AssetPriceOverrideChanged` and its **project-narrowed** cascade.
- The duplicate-pair diagnostic (`warnOnDuplicate`'s shape), last-writer-wins, deliberately not a refusal.
- The `Asset Prices/` folder and a sixth `ENTITY_TYPES` entry.
- The Inspector's three figures — the asset's shared default, the project's price, the requirement's own — each labelled, with the one in force marked (§52, §89).
- **The effective-cost correction to `assetMatchesCalculatedFrom`.** A Requirement under a price override would otherwise report a permanent false `stale`. This is a defect only once an override exists, so it is that increment's Definition-of-Done item and not a gap in this one.
- Where a user creates an override — the affordance, which waits on the asset designer's catalogue UI.
