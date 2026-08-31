# Slice 17 — Presentation-layer error surfacing: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `AppError` reaching Presentation exactly one surface, decided by a pure
policy that a call site cannot bypass, and close the two live defects that decision exposes.

**Architecture:** One pure function `surfaceFor(error, origin)` answers which container an
error belongs in. Its return type carries a non-exported brand, so the toast door — and every
other door — can only be reached by a caller that actually asked. Ten existing call sites gain
an explicit origin; two of them stop double-reporting, and one gains an inline field error it
structurally could not render before. Two new in-place view states close the deferrals slice 14
made here.

**Tech Stack:** TypeScript (strict), Vue 3 SFCs with `<script setup>`, Pinia, Vitest (node +
jsdom), ESLint + oxlint, `vue-tsc`.

**Spec:** [`docs/superpowers/specs/2026-08-30-slice-17-presentation-layer-error-surfacing-design.md`](../specs/2026-08-30-slice-17-presentation-layer-error-surfacing-design.md)

**Slice document:** [`docs/tasks/17-presentation-layer-error-surfacing.md`](../../tasks/17-presentation-layer-error-surfacing.md)
— the authority on what the table says. Read its "Category → surface table" before Task 1.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **The gate is `npm run check`** — build (`vue-tsc` then Vite then the stylesheet assembler),
  lint (oxlint then ESLint, `--max-warnings 0` / `--deny-warnings`), `test:coverage`, and
  `analyze` (fallow). All four must pass before any commit.
- **Coverage floors: statements 99, functions 99, lines 99, branches 98.** Measured on the
  baseline `f94ce6e`: 99.23 / 99.04 / 99.47 / 98.08. **Functions is the binding metric with
  ~0.6 uncovered units of headroom — one uncovered function fails the gate.** Branches has
  ~2.3. Every function this plan adds needs a test that calls it, written with it.
- **Layering** (`eslint.config.mjs`, `no-restricted-imports`): `presentation → application →
  domain → core`. `presentation/` may not import `obsidian` except where it already does
  (`notices/notify.ts`). `presentation/dialogs/` may not import `application/`,
  `infrastructure/`, `plugin/` or the event bus.
- **No `<style>` block in any SFC outside `src/prototypes/`** (`vue/no-restricted-block`). CSS
  goes in a `styles/` partial, imported by `styles/index.css`, under 400 lines, with **no
  hard-coded colour** — use an Obsidian CSS variable (SDD §84).
- **No literal user-facing strings.** Copy comes from `tr(key)` / `t(language, key)` with the
  key declared in `src/presentation/i18n/locales/en.ts` and translated in `de.ts`.
  `tests/presentation/i18n/strings.test.ts` requires `de.ts` to translate every key `en.ts`
  declares. UI text is **sentence case** (`obsidianmd/ui/sentence-case-locale-module` fails the
  build otherwise).
- **`max-lines` is 400 for `src/**`.** `runtime.ts` has been at that cap before and was
  relieved by extraction, not reformatting. If a file crosses it, extract a coherent seam.
- **Address code by name, not by line number**, in comments and commit messages alike.
- **A docblock claiming "the only place X" gets a `grep` in the same edit**, and the sentence is
  written from what the grep printed.
- **Run the suite alone** when reading a coverage figure. A failing file suppresses the coverage
  report entirely, and `tests/build/` files time out under parallel load — re-run serially
  (`--no-file-parallelism`) before believing a `beforeAll` timeout there.

---

## File structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `src/presentation/errors/errorSurfacePolicy.ts` | `ErrorOrigin`, branded `ErrorSurface`, `surfaceFor`. Pure. The whole table. |
| `src/presentation/errors/surfaceError.ts` | `SurfaceSinks` and `surfaceError` — calls the policy and dispatches to the caller's doors. |
| `src/presentation/components/ViewFailure.vue` | The one container this slice adds: a failure or dangling-reference state in place of a view's content. |
| `styles/view-failure.css` | Its rules. Imported by `styles/index.css`. |
| `tests/presentation/errors/errorSurfacePolicy.test.ts` | Every `(category, origin)` pair the table names. |
| `tests/presentation/errors/errorSurfacePolicy.test-d.ts` | The brand proof. Joins `tsconfig.json`'s `include`. |
| `tests/presentation/errors/surfaceError.test.ts` | Dispatch, and the required fallback. |
| `tests/presentation/errors/saveStateAgreement.test.ts` | `affectsSaveState` ↔ the table. |
| `tests/presentation/components/viewFailure.test.ts` | The component, including its retry. |
| `tests/presentation/editor/noDoubleReporting.test.ts` | Finding 1's regression, both directions. |

**Modified:**

| Path | Change |
| --- | --- |
| `src/presentation/notices/notify.ts` | `notifyError` takes a `ToastSurface` second parameter. |
| `src/presentation/notices/queue.ts` | `promote` gains a severity term. |
| `src/presentation/editor/runtime.ts` | Six call sites gain origins; `notifyIfRefused` stops toasting an autosave-path failure. |
| `src/presentation/editor/shell/RequirementRow.vue` | Two `notify:` bindings gain origins. |
| `src/presentation/views/ViewRoot.vue` | Failure arm becomes `ViewFailure` with a retry. |
| `src/presentation/editor/PlanEditorRoot.vue` | `failed` and `missing` arms become `ViewFailure`. |
| `src/plugin/sampleProject.ts`, `src/plugin/planEditorCommands.ts` | One origin each. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | New keys. |
| `tsconfig.json` | The sixth `include` entry. |
| `CLAUDE.md` | The `include` count, and this slice's section. |
| `docs/tests/cases/*` | Manual steps for what no gate reaches. |

---

## Task order and why

Tasks 1–3 build the mechanism with nothing depending on it, so they are pure additions that
cannot break a gate. Task 4 closes the door, which is the one irreversible edit — everything
after it compiles against the new signature. Tasks 5–6 are independent of the door. Tasks 7–10
are the view work. **Task 11 (calibration) is deliberately last**: it restructures a gesture in
the tool CLAUDE.md records four interruption-defect classes in, and it should land on a tree
that is otherwise green.

---

### Task 1: `surfaceFor` — the policy and the table

**Files:**
- Create: `src/presentation/errors/errorSurfacePolicy.ts`
- Test: `tests/presentation/errors/errorSurfacePolicy.test.ts`

**Interfaces:**
- Consumes: `AppError`, `ErrorCategory` from `src/core/errors/AppError`.
- Produces: `ErrorOrigin`, `ErrorSurface`, `ToastSurface`, `surfaceFor(error, origin)`.
  Task 3 dispatches on the result; Task 4's `notifyError` takes a `ToastSurface`.

**Read first:** the slice document's "The decision procedure" and "Category → surface table".
This task implements that table verbatim; where this plan and that document disagree, that
document wins and this plan is the bug.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/errors/errorSurfacePolicy.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { surfaceFor, type ErrorOrigin } from '../../../src/presentation/errors/errorSurfacePolicy';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

const ALL_CATEGORIES: readonly ErrorCategory[] = [
	'Domain',
	'Validation',
	'Persistence',
	'Geometry',
	'Import',
	'Migration',
	'Reference',
	'Calculation',
];

const FIELD: ErrorOrigin = { kind: 'form-field-commit', field: 'quantity' };
const AUTOSAVE: ErrorOrigin = { kind: 'autosave-write' };
const OPERATION: ErrorOrigin = { kind: 'explicit-operation' };
const DECISION: ErrorOrigin = { kind: 'decision-required' };
const HYDRATION: ErrorOrigin = { kind: 'view-hydration' };
const BACKGROUND: ErrorOrigin = { kind: 'background-cascade' };
const BOOTSTRAP: ErrorOrigin = { kind: 'bootstrap' };

describe('surfaceFor', () => {
	it('answers a session failure for every category at a bootstrap origin', () => {
		// BOOTSTRAP is asked FIRST and invalidates the questions below it: there is no field to
		// annotate and no query that failed, because none was ever wired.
		for (const category of ALL_CATEGORIES) {
			expect(surfaceFor(err(category), BOOTSTRAP)).toEqual({ kind: 'session-failure' });
		}
	});

	it('answers a modal for a decision-required origin', () => {
		expect(surfaceFor(err('Reference', 'reference.referents-exist'), DECISION)).toEqual({
			kind: 'modal',
		});
	});

	it('carries the field name through to an inline surface', () => {
		expect(surfaceFor(err('Validation'), FIELD)).toEqual({ kind: 'inline', field: 'quantity' });
	});

	it('answers a view failure for a hydrating query that refused', () => {
		expect(surfaceFor(err('Persistence'), HYDRATION)).toEqual({ kind: 'view-failure' });
	});

	it('answers a save-state surface for an autosave write', () => {
		expect(surfaceFor(err('Persistence'), AUTOSAVE)).toEqual({ kind: 'save-state' });
	});

	it('answers an error toast for an explicit operation', () => {
		expect(surfaceFor(err('Persistence'), OPERATION)).toEqual({
			kind: 'toast',
			level: 'error',
		});
	});

	// The one pairing that resolves QUIETER than its origin suggests. Its own case rather than
	// a row in the loop below, because an implementation keyed on origin alone passes every
	// other explicit-operation assertion while getting this one wrong.
	it('answers a WARNING toast for a Geometry error at an explicit operation', () => {
		expect(surfaceFor(err('Geometry'), OPERATION)).toEqual({
			kind: 'toast',
			level: 'warning',
		});
	});

	describe('the background-cascade origin', () => {
		// The exception, and it gets its own case for the reason the slice document gives: an
		// implementation that folded background-cascade into a single early return would pass
		// every other case in this file.
		it('answers a toast for a Persistence error, because the marker write is what failed', () => {
			expect(surfaceFor(err('Persistence'), BACKGROUND)).toEqual({
				kind: 'toast',
				level: 'warning',
			});
		});

		it('answers none for every OTHER category', () => {
			for (const category of ALL_CATEGORIES.filter((c) => c !== 'Persistence')) {
				expect(surfaceFor(err(category), BACKGROUND)).toEqual({ kind: 'none' });
			}
		});
	});

	describe('the splits the table names explicitly', () => {
		it('routes a Calculation error three ways by origin alone', () => {
			expect(surfaceFor(err('Calculation', 'calibration.invalid-distance'), FIELD)).toEqual({
				kind: 'inline',
				field: 'quantity',
			});
			expect(
				surfaceFor(err('Calculation', 'calibration.coincident-points'), OPERATION),
			).toEqual({ kind: 'toast', level: 'error' });
			expect(surfaceFor(err('Calculation'), BACKGROUND)).toEqual({ kind: 'none' });
		});

		it('routes a Reference error by origin, modal for the delete decision', () => {
			expect(surfaceFor(err('Reference'), DECISION)).toEqual({ kind: 'modal' });
			expect(surfaceFor(err('Reference'), BACKGROUND)).toEqual({ kind: 'none' });
		});
	});

	it('is total over every category at every origin', () => {
		// Not an exhaustiveness PROOF — that is the compiler's, in the .test-d.ts. This asserts
		// the weaker runtime property that no pair falls through to undefined, which a switch
		// with a missing arm would do.
		const origins: readonly ErrorOrigin[] = [
			BOOTSTRAP,
			FIELD,
			AUTOSAVE,
			OPERATION,
			DECISION,
			HYDRATION,
			BACKGROUND,
		];
		for (const category of ALL_CATEGORIES) {
			for (const origin of origins) {
				expect(surfaceFor(err(category), origin).kind).toEqual(expect.any(String));
			}
		}
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/errors/errorSurfacePolicy.test.ts`
Expected: FAIL — cannot resolve `../../../src/presentation/errors/errorSurfacePolicy`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/errors/errorSurfacePolicy.ts`:

```typescript
import type { AppError, ErrorCategory } from '../../core/errors/AppError';

/**
 * Which container an `AppError` belongs in — SDD §66's last step, the one slice 11 named and
 * did not finish designing.
 *
 * The whole point is that a surface is NOT a function of the category alone: the same
 * `CalculationError` is an inline field error under the known-distance input, a toast for two
 * canvas point-picks, and nothing at all inside a background cascade. It is not a function of
 * the ORIGIN alone either — origin picks the container, and the error supplies what the
 * container still needs, which today is the toast's `level`.
 *
 * Pure, and it imports nothing from slices 13/15/16: it returns a DESCRIPTION of a surface,
 * and the call site is what invokes the sibling slice's API. `surfaceError.ts` is the
 * convenience that does that dispatch; this module never does.
 */

/**
 * The brand. Declared and deliberately NOT exported, which is the entire enforcement
 * mechanism: no module outside this one can construct a value satisfying `ErrorSurface`, so
 * the only way to hold one is to have called `surfaceFor`. `notifyError` takes a
 * `ToastSurface`, and a hand-built `{ kind: 'toast', level: 'error' }` therefore fails to
 * compile.
 *
 * **State the guarantee narrowly.** This holds that a call site ASKED. It does not hold that
 * it asked with the right ORIGIN — a site can pass `explicit-operation` where
 * `autosave-write` is true and get a toast this table would have refused. No type can close
 * that, which is why the ten origins are tabulated in the spec, where review sees them.
 */
declare const ROUTED: unique symbol;

type Routed = { readonly [ROUTED]: true };

/**
 * How the failure arose, supplied by the CALL SITE — never inferred from the error, because
 * the error cannot know whether the user clicked something.
 */
export type ErrorOrigin =
	| { readonly kind: 'bootstrap' }
	| { readonly kind: 'form-field-commit'; readonly field: string }
	| { readonly kind: 'autosave-write' }
	| { readonly kind: 'explicit-operation' }
	| { readonly kind: 'decision-required' }
	| { readonly kind: 'view-hydration' }
	| { readonly kind: 'background-cascade' };

export type ErrorSurface =
	| ({ readonly kind: 'inline'; readonly field: string } & Routed)
	| ({ readonly kind: 'toast'; readonly level: 'warning' | 'error' } & Routed)
	| ({ readonly kind: 'modal' } & Routed)
	| ({ readonly kind: 'save-state' } & Routed)
	| ({ readonly kind: 'view-failure' } & Routed)
	| ({ readonly kind: 'session-failure' } & Routed)
	| ({ readonly kind: 'none' } & Routed);

export type ToastSurface = Extract<ErrorSurface, { kind: 'toast' }>;

/** The brand is a phantom: nothing reads it, so the cast is where it is applied. */
const routed = <T extends { readonly kind: string }>(surface: T): T & Routed => surface as T & Routed;

/**
 * A toast's urgency, from the category. `Geometry` is the one category that speaks quieter
 * than its origin suggests: an operation-level geometry refusal means a shape the editor
 * declined to accept, which the user can see and redraw — a `warning`, not an `error`.
 *
 * A background `Persistence` failure is also a warning rather than an error, and for the
 * opposite reason: it is the only background failure this table surfaces AT ALL, and it is
 * reporting that a stale marker could not be written rather than that the user's own action
 * failed.
 */
function toastLevel(category: ErrorCategory, origin: ErrorOrigin['kind']): 'warning' | 'error' {
	if (category === 'Geometry') return 'warning';
	if (origin === 'background-cascade') return 'warning';
	return 'error';
}

/**
 * The decision procedure, in the slice document's own order. The questions are asked in
 * sequence and the FIRST one to answer wins, which is why `bootstrap` is a guard clause
 * rather than a row: it invalidates the questions below it rather than being answered by
 * them.
 *
 * The `switch` over `error.category` has **no `default`**. A ninth category added to slice 2
 * therefore fails `vue-tsc` at the `never` arm rather than falling silently through to a
 * generic surface — the same "narrowest applicable, never a silent fallback" discipline slice
 * 11 applies to `ExceptionMapper`.
 */
export function surfaceFor(error: AppError, origin: ErrorOrigin): ErrorSurface {
	if (origin.kind === 'bootstrap') return routed({ kind: 'session-failure' });
	if (origin.kind === 'decision-required') return routed({ kind: 'modal' });
	if (origin.kind === 'form-field-commit') return routed({ kind: 'inline', field: origin.field });
	if (origin.kind === 'view-hydration') return routed({ kind: 'view-failure' });
	if (origin.kind === 'autosave-write') return routed({ kind: 'save-state' });

	// Only `explicit-operation` and `background-cascade` remain, and the category decides
	// between them. Written as a switch so the exhaustiveness arm below is reachable.
	switch (error.category) {
		case 'Domain':
		case 'Validation':
		case 'Geometry':
		case 'Import':
		case 'Migration':
		case 'Reference':
		case 'Calculation':
			return origin.kind === 'background-cascade'
				? routed({ kind: 'none' })
				: routed({ kind: 'toast', level: toastLevel(error.category, origin.kind) });

		// The one background failure that speaks. What buys silence for every category above is
		// the persisted stale marker carrying the fact in the user's absence; here the marker
		// write is precisely what failed, so the rule that keeps those quiet is the rule that
		// makes this one speak.
		case 'Persistence':
			return routed({ kind: 'toast', level: toastLevel(error.category, origin.kind) });

		default:
			return assertNever(error.category);
	}
}

/** Reached only if slice 2 grows a ninth category, and it is a COMPILE error when it does. */
function assertNever(category: never): never {
	throw new Error(`Unrouted error category: ${String(category)}`);
}
```

> **Note on `assertNever` and the functions floor.** It is a function, and the coverage floor
> for functions has ~0.6 units of headroom. It is **covered** by the `.test-d.ts` in Task 2 only
> at the type level, which coverage does not see. If `npm run test:coverage` reports it
> uncovered and the gate fails, replace the helper with an inline
> `` throw new Error(`Unrouted error category: ${String(error.category satisfies never)}`) ``
> in the `default` arm — same compile-time guarantee, no second function. Measure before
> choosing; do not add a test that calls `assertNever` through a cast, which would prove
> nothing and cost a branch.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/errors/errorSurfacePolicy.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Watch the exhaustiveness arm actually bite**

Temporarily delete `case 'Persistence':` and its return from the switch. Run `npx vue-tsc
--noEmit`. Expected: an error at the `default` arm, because `error.category` is no longer
`never` there. Restore the case. This is the "watch the test fail" step for a compile-time
guarantee — an exhaustiveness arm nobody has seen bite is a comment.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS. If `analyze` reports `surfaceError`-less exports as unused, that is expected
until Task 3 — note it and continue; do not add a premature consumer.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/errors/errorSurfacePolicy.ts tests/presentation/errors/errorSurfacePolicy.test.ts
git commit -m "Answer which surface an AppError belongs on, from the pair rather than the category"
```

---

### Task 2: The brand proof

**Files:**
- Create: `tests/presentation/errors/errorSurfacePolicy.test-d.ts`
- Modify: `tsconfig.json` (the `include` array), `CLAUDE.md` (the count)

**Interfaces:**
- Consumes: `ErrorSurface`, `ToastSurface`, `surfaceFor` from Task 1.
- Produces: nothing at runtime. It is the instrument that makes Task 4's door real.

**Why this is its own task:** the brand is the whole enforcement argument. A reviewer could
approve Task 1's table and reject the claim that it cannot be bypassed; those are separate
judgements.

- [ ] **Step 1: Write the proof**

Create `tests/presentation/errors/errorSurfacePolicy.test-d.ts`:

```typescript
import {
	surfaceFor,
	type ErrorSurface,
	type ToastSurface,
} from '../../../src/presentation/errors/errorSurfacePolicy';
import type { AppError } from '../../../src/core/errors/AppError';

declare const anyError: AppError;

/**
 * The enforcement, proven rather than asserted.
 *
 * `ErrorSurface` carries a non-exported `unique symbol`, so these object literals — which are
 * structurally perfect otherwise — cannot satisfy it. An unsatisfied `@ts-expect-error` is
 * itself a build error, so removing the brand from `errorSurfacePolicy.ts` fails HERE rather
 * than quietly reopening the door.
 */

// @ts-expect-error a hand-built toast cannot satisfy the branded surface
const handBuiltToast: ToastSurface = { kind: 'toast', level: 'error' };

// @ts-expect-error nor can a hand-built surface of any other kind
const handBuiltNone: ErrorSurface = { kind: 'none' };

// @ts-expect-error nor does casting through the shape without the brand
const handBuiltInline: ErrorSurface = { kind: 'inline', field: 'quantity' };

/** What must still compile: a real answer from the policy IS a surface. */
const real: ErrorSurface = surfaceFor(anyError, { kind: 'explicit-operation' });

/** And narrowing one to the toast member is how `notifyError`'s caller reaches its door. */
const narrowed: ToastSurface | null = real.kind === 'toast' ? real : null;

/**
 * What this file does NOT prove, stated so it is not read wider than it is: that a call site
 * asked with the RIGHT origin. `surfaceFor(error, { kind: 'explicit-operation' })` compiles
 * for an autosave-path failure exactly as it does for a real one-off command, and the type
 * system has nothing to say about it. The spec's origin table is the instrument for that half.
 */
export type { };
void handBuiltToast;
void handBuiltNone;
void handBuiltInline;
void narrowed;
```

- [ ] **Step 2: Add it to `tsconfig.json`'s `include`**

Open `tsconfig.json` and add the path to the `include` array, beside the five entries already
there. Read the existing entries first — each is there for its own recorded reason, and this is
the sixth.

- [ ] **Step 3: Run the compiler and watch the proof hold**

Run: `npx vue-tsc --noEmit`
Expected: PASS. The three `@ts-expect-error` directives are each satisfied.

- [ ] **Step 4: Watch it fail without the brand**

Temporarily change `ErrorSurface`'s members in `errorSurfacePolicy.ts` to drop `& Routed`. Run
`npx vue-tsc --noEmit`. Expected: FAIL — three errors, one per directive, each reading
"Unused '@ts-expect-error' directive". Restore the brand.

This is the step that proves the instrument discriminates. Skipping it leaves three comments.

- [ ] **Step 5: Update CLAUDE.md's count**

In `CLAUDE.md`'s Testing section, the sentence beginning "nothing type-checks `tests/**` …
**except five entries in `tsconfig.json`'s `include`**" now says **six**. Update the count and
add one clause naming the new entry and what it proves. That same sentence narrates having sat
at the wrong number for a whole slice by remembering rather than counting — so **open
`tsconfig.json` and count the entries** rather than trusting this plan's arithmetic.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/presentation/errors/errorSurfacePolicy.test-d.ts tsconfig.json CLAUDE.md
git commit -m "Prove a surface cannot be built by hand, and count the include list rather than remember it"
```

---

### Task 3: `surfaceError` — the dispatcher and its required fallback

**Files:**
- Create: `src/presentation/errors/surfaceError.ts`
- Test: `tests/presentation/errors/surfaceError.test.ts`

**Interfaces:**
- Consumes: `surfaceFor`, `ErrorOrigin`, `ErrorSurface`, `ToastSurface` (Task 1).
- Produces: `SurfaceSinks`, `surfaceError(error, origin, sinks): ErrorSurface`. Task 4's call
  sites use it wherever they hold more than one door; a site holding only a toast may call
  `surfaceFor` and `notifyError` directly.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/errors/surfaceError.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { surfaceError, type SurfaceSinks } from '../../../src/presentation/errors/surfaceError';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

function sinks(overrides: Partial<SurfaceSinks> = {}): SurfaceSinks & {
	readonly toast: ReturnType<typeof vi.fn>;
	readonly unrenderable: ReturnType<typeof vi.fn>;
} {
	const toast = vi.fn();
	const unrenderable = vi.fn();
	return { toast, unrenderable, ...overrides } as never;
}

describe('surfaceError', () => {
	it('sends an explicit-operation failure to the toast door with the routed level', () => {
		const s = sinks();
		const used = surfaceError(err('Persistence'), { kind: 'explicit-operation' }, s);

		expect(used.kind).toBe('toast');
		expect(s.toast).toHaveBeenCalledTimes(1);
		expect(s.toast).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'Persistence' }),
			expect.objectContaining({ kind: 'toast', level: 'error' }),
		);
		expect(s.unrenderable).not.toHaveBeenCalled();
	});

	it('sends an autosave-write failure to the save-state door and raises NO toast', () => {
		// Finding 1's rule, at the dispatcher. The toast assertion is the load-bearing half:
		// "the indicator flipped" is equally true of the build that also toasts.
		const saveState = vi.fn();
		const s = sinks({ saveState });

		const used = surfaceError(err('Persistence'), { kind: 'autosave-write' }, s);

		expect(used.kind).toBe('save-state');
		expect(saveState).toHaveBeenCalledTimes(1);
		expect(s.toast).not.toHaveBeenCalled();
	});

	it('sends a field-attributable failure to the inline door with its field name', () => {
		const inline = vi.fn().mockReturnValue(true);
		const s = sinks({ inline });

		const used = surfaceError(
			err('Validation'),
			{ kind: 'form-field-commit', field: 'quantity' },
			s,
		);

		expect(used.kind).toBe('inline');
		expect(inline).toHaveBeenCalledWith('quantity', expect.objectContaining({ category: 'Validation' }));
		expect(s.toast).not.toHaveBeenCalled();
	});

	it('falls back when the inline door declines to render it', () => {
		// The Inspector has no banner region, so a code its FieldErrorMap does not name cannot
		// be shown inline. `inline` answering false is that report, and the fallback is what
		// stops the failure reaching nobody.
		const inline = vi.fn().mockReturnValue(false);
		const s = sinks({ inline });

		const used = surfaceError(
			err('Validation'),
			{ kind: 'form-field-commit', field: 'quantity' },
			s,
		);

		expect(used.kind).toBe('toast');
		expect(s.toast).toHaveBeenCalledTimes(1);
	});

	it('routes a surface the call site cannot draw to the REQUIRED unrenderable door', () => {
		// No `saveState` sink here: a plugin command has no editor indicator to flip. Without a
		// required second door this failure would reach nobody, which is strictly worse than
		// reaching the wrong widget.
		const s = sinks();

		const used = surfaceError(err('Persistence'), { kind: 'autosave-write' }, s);

		expect(used.kind).toBe('save-state');
		expect(s.unrenderable).toHaveBeenCalledTimes(1);
		expect(s.unrenderable).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'Persistence' }),
			expect.objectContaining({ kind: 'save-state' }),
		);
		expect(s.toast).not.toHaveBeenCalled();
	});

	it('calls NO door at all for a background cascade that routes to none', () => {
		const s = sinks();

		const used = surfaceError(err('Calculation'), { kind: 'background-cascade' }, s);

		expect(used.kind).toBe('none');
		expect(s.toast).not.toHaveBeenCalled();
		expect(s.unrenderable).not.toHaveBeenCalled();
	});

	it('returns the surface it used, so a caller can assert the decision', () => {
		const s = sinks();
		expect(surfaceError(err('Geometry'), { kind: 'explicit-operation' }, s)).toMatchObject({
			kind: 'toast',
			level: 'warning',
		});
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/errors/surfaceError.test.ts`
Expected: FAIL — cannot resolve `surfaceError`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/errors/surfaceError.ts`:

```typescript
import type { AppError } from '../../core/errors/AppError';
import { surfaceFor, type ErrorOrigin, type ErrorSurface, type ToastSurface } from './errorSurfacePolicy';

/**
 * The doors a particular call site actually has.
 *
 * Not every site can draw every surface: the Inspector has no banner region, a plugin command
 * has no view to fail in place and no save indicator to flip. So the sinks are optional
 * EXCEPT two.
 */
export interface SurfaceSinks {
	/**
	 * Always available — `notify.ts` is a module-level door with no per-site state, so there is
	 * no call site that cannot raise one.
	 */
	readonly toast: (error: AppError, surface: ToastSurface) => void;

	/**
	 * Where a surface this site CANNOT draw goes instead.
	 *
	 * **Required, and it is the one option that must not be optional.** A policy that routes to
	 * a container the caller has no room for must degrade to something, and the choice has to
	 * be the caller's and visible. Optional-with-a-`?? noop` default makes the forgetting call
	 * site silent with nothing anywhere erroring — the exact shape `useFieldCommit.notify`'s
	 * own docblock records this repository paying for repeatedly.
	 */
	readonly unrenderable: (error: AppError, surface: ErrorSurface) => void;

	/**
	 * Renders the error under one named field, and REPORTS whether it could. `false` means the
	 * form's `FieldErrorMap` does not name this code — the explicit statement "this failure is
	 * not about one field" that `routeError`'s own docblock describes — and the fallback below
	 * takes it from there.
	 */
	readonly inline?: (field: string, error: AppError) => boolean;
	readonly saveState?: (error: AppError) => void;
	readonly modal?: (error: AppError) => void;
	readonly viewFailure?: (error: AppError) => void;
	readonly sessionFailure?: (error: AppError) => void;
}

/**
 * Ask the policy, then knock on the matching door.
 *
 * It returns the surface it used rather than `void`, so a test asserts on the DECISION rather
 * than on a spy count — "the indicator flipped" is equally true of a build that also raised a
 * toast, which is precisely the defect this slice exists to close.
 *
 * **This function is a convenience, not the guarantee.** The guarantee is the non-exported
 * brand on `ErrorSurface`: a call site cannot reach `notifyError` without having asked the
 * policy, whether or not it came through here. A site holding exactly one door may call
 * `surfaceFor` and that door directly.
 */
export function surfaceError(
	error: AppError,
	origin: ErrorOrigin,
	sinks: SurfaceSinks,
): ErrorSurface {
	const surface = surfaceFor(error, origin);

	switch (surface.kind) {
		case 'none':
			// Logged already, at the Application Error Mapping step, and the persisted marker is
			// written by the command rather than here. "Do not ALSO show something" is the whole
			// content of this arm, and it is a valid common answer rather than a gap.
			return surface;

		case 'toast':
			sinks.toast(error, surface);
			return surface;

		case 'inline':
			// The one arm that can be declined by the door it chose. A form whose map does not
			// name this code says so, and the failure falls to the toast rather than to silence.
			if (sinks.inline?.(surface.field, error) === true) return surface;
			sinks.toast(error, surfaceFor(error, { kind: 'explicit-operation' }) as ToastSurface);
			return surface;

		case 'save-state':
			return dispatchOptional(error, surface, sinks, sinks.saveState);
		case 'modal':
			return dispatchOptional(error, surface, sinks, sinks.modal);
		case 'view-failure':
			return dispatchOptional(error, surface, sinks, sinks.viewFailure);
		case 'session-failure':
			return dispatchOptional(error, surface, sinks, sinks.sessionFailure);
	}
}

/**
 * One arm for the four optional doors: use it if the site has it, and report to the required
 * fallback if not. Written once rather than four times, because four copies of "or else tell
 * somebody" is four chances for one of them to be a `return` that tells nobody.
 */
function dispatchOptional(
	error: AppError,
	surface: ErrorSurface,
	sinks: SurfaceSinks,
	sink: ((error: AppError) => void) | undefined,
): ErrorSurface {
	if (sink === undefined) sinks.unrenderable(error, surface);
	else sink(error);
	return surface;
}
```

> **The `as ToastSurface` cast in the inline arm** is inside the module that owns the brand, so
> it is the one place such a cast is legitimate — `surfaceFor` with an `explicit-operation`
> origin always returns a toast for every category, but the compiler cannot know that from the
> signature. If it bothers a reviewer, the alternative is a non-exported
> `toastSurface(level)` builder in `errorSurfacePolicy.ts`; it costs a function against a
> floor with 0.6 units of headroom, so measure before taking it.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/errors/surfaceError.test.ts`
Expected: PASS, all seven cases.

- [ ] **Step 5: Watch the fallback case discriminate**

Temporarily change `dispatchOptional` so the `sink === undefined` branch just returns without
calling `sinks.unrenderable`. Run the test. Expected: FAIL on "routes a surface the call site
cannot draw to the REQUIRED unrenderable door". Restore.

A silent-fallback defect is invisible to every other case in the file, which is why it needs
this step rather than the suite's word.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/errors/surfaceError.ts tests/presentation/errors/surfaceError.test.ts
git commit -m "Knock on the door the policy named, and require a door for the ones a site lacks"
```

---

### Task 4: Close the toast door

**Files:**
- Modify: `src/presentation/notices/notify.ts` (`notifyError`)
- Modify: `src/plugin/sampleProject.ts`, `src/plugin/planEditorCommands.ts`
- Modify: `src/presentation/editor/runtime.ts` (`createDeleteZoneAction`'s refused-outcome arm)
- Test: existing `tests/presentation/notices/notify.test.ts` and the call sites' own tests

**Interfaces:**
- Consumes: `ToastSurface`, `surfaceFor` (Task 1).
- Produces: `notifyError(error: AppError, routed: ToastSurface): void` — every later task's
  call sites use this signature.

**This is the irreversible edit.** After it, nothing compiles until every call site declares an
origin. Do the three `explicit-operation` sites here; Tasks 4b and 4c take the rest, because
those two change BEHAVIOUR and this one does not.

- [ ] **Step 1: Change the signature**

In `src/presentation/notices/notify.ts`, change `notifyError` to:

```typescript
export function notifyError(error: AppError, routed: ToastSurface): void {
	queue?.push(routed.level, trError(error));
}
```

Import `type ToastSurface` from `../errors/errorSurfacePolicy`.

Update its docblock. It currently says it is "the OTHER way this plugin raises a notice, and
the only one an `AppError` may take" — that stays true and gains a second clause: the severity
is no longer fixed at `error`, it is the level the policy routed, so a `Geometry` refusal and a
background stale-marker failure arrive as warnings. **Grep before writing that sentence**
(`grep -rn "notifyError" src/`) so the "only one" claim is written from what the grep printed,
per the Global Constraints.

- [ ] **Step 2: Run the build and collect the failures**

Run: `npx vue-tsc --noEmit`
Expected: FAIL, one error per call site that still passes a single argument. **Write the list
down** — it is the checklist for Tasks 4, 4b and 4c, and it should match the spec's Finding 3
table. If it names a site that table does not, stop: the table was measured, and a mismatch
means one of the two is wrong.

- [ ] **Step 3: Fix the three `explicit-operation` sites**

In `src/plugin/planEditorCommands.ts`, `applyBackground`'s refusal arm:

```typescript
	if (isErr(result)) {
		// Slice 17: the origin is this site's to declare, and it is an explicit operation — the
		// user picked a file from a modal. The comment above predicted this change and it needs
		// only the origin; the surface decision is no longer spelled here.
		const surface = surfaceFor(result.error, { kind: 'explicit-operation' });
		if (surface.kind === 'toast') notifyError(result.error, surface);
	}
```

Apply the same shape in `src/plugin/sampleProject.ts`'s `createAndOpen` refusal arm, and in
`createDeleteZoneAction`'s refused-outcome arm in `src/presentation/editor/runtime.ts`.

> **Why the `if (surface.kind === 'toast')` guard rather than `surfaceError`.** These three
> sites hold exactly one door, so a `SurfaceSinks` object here would be three lines of
> ceremony wrapping one call. The guard is what narrows `ErrorSurface` to `ToastSurface`, and
> at an `explicit-operation` origin the policy always answers a toast — so the `else` is
> unreachable **and costs a branch against a floor with ~2.3 to spare**. Prefer
> `surfaceError(result.error, { kind: 'explicit-operation' }, { toast: notifyError,
> unrenderable: notifyError })` if the branch turns out to cost the gate; measure with
> `npm run test:coverage` rather than guessing.

- [ ] **Step 4: Update the call sites' existing tests**

Every test asserting `notifyError` was called now asserts two arguments. Search:
`grep -rn "notifyError" tests/`. Update each to `expect.objectContaining({ kind: 'toast' })`
for the second.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run tests/plugin tests/presentation/notices`
Expected: PASS.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS — Tasks 4b and 4c's sites are in `runtime.ts` and `RequirementRow.vue`, so if
`vue-tsc` still reports those, this task is not done. **Do not proceed with a red build**; the
remaining sites are the next two tasks and they must land before a commit that builds.

> **If the tree cannot be made green within this task**, that is the signal that Tasks 4, 4b
> and 4c are one commit rather than three. Fold them and say so in the commit message, rather
> than committing a tree that does not build.

- [ ] **Step 7: Commit** (with 4b and 4c if the build demands it)

```bash
git add -A
git commit -m "Make the toast door take a routed decision rather than a bare error"
```

---

### Task 4b: The autosave sites stop double-reporting

**Files:**
- Modify: `src/presentation/editor/runtime.ts` — `notifyIfRefused`, and `registerEditorTools`'
  `SelectTool` / `DrawPolygonTool` `reportRejected` bindings
- Test: `tests/presentation/editor/noDoubleReporting.test.ts` (create)

**Interfaces:**
- Consumes: `surfaceFor`, `notifyError` (Tasks 1, 4).
- Produces: no new exports. Changes `notifyIfRefused` from "toast every refusal" to "toast only
  what the policy routes to a toast".

**This is Finding 1.** Read the spec's Finding 1 before starting.

- [ ] **Step 1: Write the failing regression test**

Create `tests/presentation/editor/noDoubleReporting.test.ts`. It drives a real dispatch through
the leaf's wrapped dispatcher with a repository that refuses, and asserts the PAIR — the
indicator flipped AND no toast was raised.

```typescript
import { describe, expect, it, vi } from 'vitest';
// Use the existing rig rather than a hand-built one: tests/helpers/planEditorRig.ts already
// composes a real editor runtime, and CLAUDE.md records what a thinner fake costs here.
import { createPlanEditorRig } from '../../helpers/planEditorRig';

describe('one failure, one surface', () => {
	it('flips the save indicator and raises NO toast for an autosave-path persistence failure', async () => {
		const rig = await createPlanEditorRig();
		const toast = vi.spyOn(rig.notices, 'error');

		// Make the zone repository's save refuse with a PersistenceError, then move a zone —
		// the autosave path, dispatched through the tracked dispatcher.
		rig.failNextZoneSave({ category: 'Persistence', code: 'zone.save-failed', message: 'x' });
		await rig.moveZone(rig.firstZoneId, { dx: 100, dy: 0 });

		expect(rig.saveState.value).toBe('save-error');
		expect(toast).not.toHaveBeenCalled();
	});
});
```

The *other* direction of the no-double-reporting rule — a field `ValidationError` rendering
inline while the indicator stays put — belongs to Task 4c, which is where the field-commit sites
gain their origins. It is added to this same file there, so the two halves of the rule end up
side by side.

> **Read the rig's real API before writing this.** `tests/helpers/planEditorRig.ts` exists and
> this plan does not know its exact member names — open it and use what is there
> (`createPlanEditorRig`, `failNextZoneSave` and `moveZone` above are the *shape* the test
> needs, not necessarily the names it has). If the rig cannot make a save refuse, adding that
> capability is part of this step; a rig that cannot express the failure under test is the
> fake-too-thin defect CLAUDE.md records seven instances of.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/noDoubleReporting.test.ts`
Expected: FAIL on the first case — `toast` WAS called. That failure is Finding 1, reproduced.

- [ ] **Step 3: Narrow `notifyIfRefused`**

In `src/presentation/editor/runtime.ts`:

```typescript
/**
 * `reportFault`'s other half: an EXPECTED refusal that RESOLVES rather than throws (SDD §65).
 * `CommandHistory.undoNow`/`redoNow` deliberately leave a refused undo/redo ON its stack, so
 * without this the button stays enabled, does nothing, and says nothing about why.
 *
 * **Slice 17 narrowed it, and the narrowing is the point.** Every dispatch here passes through
 * `withSaveStateTracking`, so a failure that wrote — or might have written — has ALREADY
 * flipped the save indicator by the time this runs. Toasting it as well reported one failure
 * through two widgets that can drift apart, which is the reconciliation slice 11's own
 * illustrative code left open and this slice closes. The origin is `autosave-write`, so the
 * policy answers `save-state` and this door stays shut; a refusal the indicator does NOT
 * report still reaches the user, because `surfaceError` routes it to the toast.
 */
async function notifyIfRefused(operation: Promise<DispatchResult | null>): Promise<void> {
	const result = await operation;
	if (result === null || result.ok) return;
	surfaceError(result.error, { kind: 'autosave-write' }, {
		toast: notifyError,
		// The indicator is already driven by `withSaveStateTracking`, one layer down, off the
		// same `Result`. There is nothing for this door to do that has not been done.
		saveState: () => undefined,
		unrenderable: notifyError,
	});
}
```

> **Read that `saveState: () => undefined` carefully before copying it.** It is a no-op because
> the indicator is flipped by the DECORATOR, not by this call site — the policy's job here is
> to decide that no toast is owed, and the save-state door is already served. If a future edit
> moves indicator-flipping out of `withSaveStateTracking`, this is the line that has to grow a
> body, and a reviewer should be able to see why it is empty today.

Apply the same `autosave-write` origin to `SelectTool` and `DrawPolygonTool`'s
`reportRejected` bindings in `registerEditorTools`. `CalibrateTool`'s is **not** autosave — it
stays `explicit-operation` until Task 11.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/editor/noDoubleReporting.test.ts`
Expected: PASS on the first case.

- [ ] **Step 5: Check what else moved**

Run: `npx vitest run tests/presentation/editor`
Expected: some existing cases FAIL — any that asserted a toast for a refused editor dispatch
were asserting the defect. **Read each one before changing it.** A case that meant "the user is
told something" is still right and should assert the indicator instead; a case that meant "a
toast appears" was encoding Finding 1 and should be rewritten to the pair, like the new one.
Do not delete a case to get green.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Report an autosave failure on the indicator alone, not on the indicator and a toast"
```

---

### Task 4c: The field-commit sites declare their field

**Files:**
- Modify: `src/presentation/editor/shell/RequirementRow.vue` (two `useFieldCommit` bindings)
- Modify: `src/presentation/editor/runtime.ts` (`commitEdit`)
- Modify: `src/presentation/composables/use-field-commit.ts` (the `notify` option's type)
- Test: `tests/presentation/editor/noDoubleReporting.test.ts` (the second `it`)

- [ ] **Step 1: Widen `useFieldCommit`'s `notify` to carry the routed surface**

`useFieldCommit` already implements the FIELD→OPERATION step of the decision procedure by hand:
it calls `routeError`, and falls back to `options.notify` when the routed answer is a banner.
That fallback is exactly an `explicit-operation` toast. Change the option's type to
`(error: AppError, routed: ToastSurface) => void` and have the composable ask the policy for
the surface it passes.

Update the option's docblock: its "Required, and it is the one option that must not be
optional" argument is unchanged and should stay; it gains a clause saying the surface is now
routed rather than assumed, so a `Geometry` refusal reaching this door arrives as a warning.

- [ ] **Step 2: Update the two `RequirementRow.vue` bindings**

Both become a small local function rather than a bare `notifyError` reference, because the
signature now has two parameters and the second comes from the policy:

```typescript
const notifyRouted = (error: AppError, routed: ToastSurface): void => notifyError(error, routed);
```

If that is all it does, pass `notifyError` directly — check whether the types line up before
adding a wrapper, since an identity wrapper is a function against a floor with 0.6 units of
headroom.

- [ ] **Step 3: Update `commitEdit`**

In `runtime.ts`. Its docblock already says "Which errors may reach a field at all is slice 17's
decision table, not this function's" — that sentence stops being a forward reference and
becomes a statement about the origin this site now declares.

- [ ] **Step 4: Write the second half of the no-double-reporting test**

Replace the placeholder `it` from Task 4b with a real case: an Inspector override field
refusing with a `ValidationError` renders inline AND leaves the save indicator untouched.

```typescript
	it('raises an inline error and does NOT flip the indicator for a field validation refusal', async () => {
		const rig = await createPlanEditorRig();
		const toast = vi.spyOn(rig.notices, 'error');
		const before = rig.saveState.value;

		// `-5` into a quantity override: the reachable Domain/Validation raise site the
		// affectsSaveState docblock names, one keystroke away in a type="text" input.
		await rig.commitQuantityOverride(rig.firstRequirementId, '-5');

		expect(rig.inlineErrorFor('quantity')).not.toBeNull();
		expect(rig.saveState.value).toBe(before);
		expect(toast).not.toHaveBeenCalled();
	});
```

Same caveat as Task 4b: use the rig's real member names.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor tests/presentation/composables`
Expected: PASS.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS — and `vue-tsc` should now report **zero** remaining single-argument
`notifyError` calls. That is the checklist from Task 4 Step 2 fully discharged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Let a field commit name its field, and route its fallback rather than assume it"
```

---

### Task 5: The `affectsSaveState` agreement check

**Files:**
- Create: `tests/presentation/errors/saveStateAgreement.test.ts`
- Modify: `src/presentation/editor/save-state/affects-save-state.ts` (docblock only)

**Interfaces:**
- Consumes: `affectsSaveState`, `surfaceFor`, `leftWritesBehind`.
- Produces: nothing. It is the check `affectsSaveState`'s own docblock asks for in the future
  tense.

- [ ] **Step 1: Write the check**

```typescript
import { describe, expect, it } from 'vitest';
import { affectsSaveState } from '../../../src/presentation/editor/save-state/affects-save-state';
import { surfaceFor } from '../../../src/presentation/errors/errorSurfacePolicy';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';
import { WRITE_BOUNDARY_CODES } from '../../../src/application/ports/versioning';

const ALL_CATEGORIES: readonly ErrorCategory[] = [
	'Domain', 'Validation', 'Persistence', 'Geometry', 'Import', 'Migration', 'Reference', 'Calculation',
];

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

/**
 * The agreement `affectsSaveState`'s docblock asked slice 17 to establish.
 *
 * The two answer DIFFERENT questions and must not be collapsed: `affectsSaveState` asks "did
 * this failure possibly leave the vault written", and `surfaceFor` asks "which container does
 * it belong in". They meet at exactly one origin — `autosave-write` — where the second is
 * defined in terms of the first. Nothing before this file could notice them disagreeing.
 */
describe('affectsSaveState agrees with the surface table', () => {
	it('routes every category to save-state at an autosave-write origin', () => {
		// The table's own rule: the origin picks the container. What `affectsSaveState` then
		// decides is whether that container SHOWS an error or resolves neutral — a question this
		// table deliberately does not answer, because it is about the write and not the surface.
		for (const category of ALL_CATEGORIES) {
			expect(surfaceFor(err(category), { kind: 'autosave-write' })).toEqual({
				kind: 'save-state',
			});
		}
	});

	it('reports every write-boundary code as affecting, in every pre-write category', () => {
		// The carve-out `versioning.ts` owns: a revision conflict IS a reached-the-repository
		// refusal, whatever category it wears. Derived from that table rather than from a copy.
		for (const category of ALL_CATEGORIES) {
			for (const suffix of WRITE_BOUNDARY_CODES) {
				expect(affectsSaveState(err(category, `zone.${suffix}`))).toBe(true);
			}
		}
	});

	it('reports a plain Persistence refusal as affecting and a plain Validation one as not', () => {
		expect(affectsSaveState(err('Persistence', 'zone.save-failed'))).toBe(true);
		expect(affectsSaveState(err('Validation', 'zone.name-empty'))).toBe(false);
	});
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/presentation/errors/saveStateAgreement.test.ts`
Expected: PASS.

- [ ] **Step 3: Rewrite the docblock's closing paragraph**

`affectsSaveState`'s last paragraph is written in the future tense — "when slice 17 authors its
error-to-surface table … the agreement will need a check of its own, because nothing today can
notice the two disagreeing." Rewrite it in the present, naming this file, and **say what the
check does not reach**: it holds the `autosave-write` row and the write-boundary carve-out, and
it cannot see a post-write refusal in a pre-write category at a site the `markUncompensated`
stamp does not cover. That residue is already documented there; this edit must not make it read
as closed.

- [ ] **Step 4: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Bind the save predicate to the surface table, and date its own future-tense promise"
```

---

### Task 6: Toast preemption

**Files:**
- Modify: `src/presentation/notices/queue.ts` (`promote`), `src/presentation/notices/severity.ts` (docblock)
- Test: `tests/presentation/notices/queue.test.ts` (add cases)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. `promote` changes behaviour.

**Read first:** `severity.ts`'s `AUTO_DISMISS_MS` docblock, which states the exposure and
pre-selects this remedy — *"giving `error` priority over a held `warning` rather than raising
`MAX_VISIBLE_NOTICES`, which only moves the number at which this starts."*

- [ ] **Step 1: Write the failing test**

Add to `tests/presentation/notices/queue.test.ts`:

```typescript
	it('shows an error that arrives behind three standing warnings', () => {
		const host = createRecordingHost();
		const queue = createNoticeQueue(host);

		// Three distinct persistent warnings — none dedups into another, none expires. This is
		// one command and one background cascade away in a real vault:
		// background.unsupported, cascade.aborted, cascade.stale-marker-failed.
		queue.push('warning', 'first');
		queue.push('warning', 'second');
		queue.push('warning', 'third');
		expect(host.visibleMessages()).toEqual(['first', 'second', 'third']);

		queue.push('error', 'the one that matters');

		expect(host.visibleMessages()).toContain('the one that matters');
	});

	it('keeps the demoted warning rather than dropping it', () => {
		const host = createRecordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'first');
		queue.push('warning', 'second');
		queue.push('warning', 'third');
		queue.push('error', 'urgent');

		// The demoted one returns to the held set and is promoted into the next freed slot,
		// which is what the queue already guarantees for everything else.
		host.dismiss('urgent');

		expect(host.visibleMessages()).toHaveLength(3);
		expect(host.visibleMessages()).toContain('third');
	});

	it('does not preempt for a warning arriving behind three warnings', () => {
		// The narrowing, and it needs its own case: a rule that let ANY later notice preempt
		// would pass both cases above while making the cap meaningless.
		const host = createRecordingHost();
		const queue = createNoticeQueue(host);
		queue.push('warning', 'first');
		queue.push('warning', 'second');
		queue.push('warning', 'third');
		queue.push('warning', 'fourth');

		expect(host.visibleMessages()).toEqual(['first', 'second', 'third']);
	});

	it('does not preempt an error already on screen', () => {
		const host = createRecordingHost();
		const queue = createNoticeQueue(host);
		queue.push('error', 'first');
		queue.push('error', 'second');
		queue.push('error', 'third');
		queue.push('error', 'fourth');

		expect(host.visibleMessages()).toEqual(['first', 'second', 'third']);
	});
```

> Use the file's existing host helper rather than `createRecordingHost` if it is named
> something else — open `tests/presentation/notices/queue.test.ts` first and follow it.

- [ ] **Step 2: Run and watch the first two fail**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: FAIL on "shows an error that arrives behind three standing warnings" — the error is
queued invisibly. The last two should already pass, which is what makes them the narrowing
cases rather than the fix's own cases.

- [ ] **Step 3: Give `promote` a severity term**

```typescript
		/**
		 * Fill every free slot, oldest held notice first — and, since slice 17, let an ERROR take
		 * a slot held by a WARNING when there is no free one.
		 *
		 * **Why preemption rather than a bigger cap.** `severity.ts` chose this before the need
		 * arrived: raising `MAX_VISIBLE_NOTICES` only moves the number at which the same thing
		 * starts happening. `warning` and `error` never auto-dismiss, so three standing warnings
		 * held every later error invisibly AND unannounced — `announce` rides `render`, which
		 * runs only for a notice actually shown, so a screen-reader user heard nothing either.
		 * Slice 17's table routes a dozen categories to a toast, which is what made that queue
		 * policy load-bearing rather than a tolerable edge.
		 *
		 * The demoted warning is NOT dropped: it returns to the held set with its handle cleared
		 * and is promoted into the next freed slot, exactly like a notice that never got one.
		 * It is the NEWEST visible warning that yields, not the oldest — the oldest has been on
		 * screen longest and is likeliest to have been read.
		 */
		promote(): void {
			for (const entry of entries) {
				if (visible().length >= MAX_VISIBLE_NOTICES) break;
				if (entry.handle === null) ops.show(entry);
			}

			const pendingError = entries.find((e) => e.handle === null && e.severity === 'error');
			if (pendingError === undefined) return;

			const victim = [...visible()].reverse().find((e) => e.severity === 'warning');
			if (victim === undefined) return;

			victim.handle?.hide();
			if (victim.timer !== null) cancelTimeout(victim.timer);
			victim.timer = null;
			victim.handle = null;
			ops.show(pendingError);
		},
```

> Note the `return` → `break` change on the first loop: the original returned once the cap was
> reached, which would skip the preemption block entirely — the exact case it exists for.

- [ ] **Step 4: Run the tests and watch all four pass**

Run: `npx vitest run tests/presentation/notices/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Watch the narrowing bite**

Temporarily broaden the victim search to `.find((e) => e.severity !== 'error')` and the
pending search to `e.handle === null` with no severity test. Run the tests. Expected: FAIL on
"does not preempt for a warning arriving behind three warnings". Restore.

Per CLAUDE.md's method note: when a fix is a REFUSAL, write the WIDENED mutation and run it.

- [ ] **Step 6: Update `severity.ts`'s docblock**

Its closing sentence proposes this fix as future work. Rewrite it in the present tense, naming
`promote`, and keep the honest half: the cap is still what makes a persistent tier survivable,
and a user can now see a warning leave the screen without dismissing it.

- [ ] **Step 7: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Let an error take a slot from a held warning, which severity.ts had already chosen"
```

---

### Task 7: `ViewFailure.vue`

**Files:**
- Create: `src/presentation/components/ViewFailure.vue`, `styles/view-failure.css`
- Modify: `styles/index.css` (import the partial), `src/presentation/i18n/locales/en.ts`, `de.ts`
- Test: `tests/presentation/components/viewFailure.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks — it takes RESOLVED strings, like `EmptyState.vue`.
- Produces: props `{ headline: string; body: string; actionLabel?: string }`, emit `action`.
  Tasks 8, 9 and 10 mount it.

**Why a sibling of `EmptyState` rather than a mode of it:** the slice document's rule is that a
failure must *never* read as an empty state. Reusing the component would make that a copy
convention; a distinct component and a distinct `.rp-view-failure` class make it structural,
and keep the existing assertions and the axe case that key on `.rp-empty-state` meaning what
they mean.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ViewFailure from '../../../src/presentation/components/ViewFailure.vue';

describe('ViewFailure', () => {
	it('renders the headline and body it is given', () => {
		const w = mount(ViewFailure, {
			props: { headline: 'Could not be read', body: 'The vault refused.' },
		});
		expect(w.find('.rp-view-failure__headline').text()).toBe('Could not be read');
		expect(w.find('.rp-view-failure__body').text()).toBe('The vault refused.');
	});

	it('renders no action button when it has no label', () => {
		// Absent, never an empty string: `''` renders a nameless button, which is both a live
		// control that does nothing and an axe `button-name` violation. Same rule as
		// `resolveEmptyState`'s.
		const w = mount(ViewFailure, { props: { headline: 'h', body: 'b' } });
		expect(w.find('.rp-view-failure__action').exists()).toBe(false);
	});

	it('emits action when its button is pressed', () => {
		// The retry. Without this case the handler is an uncovered FUNCTION, and functions is
		// the binding coverage metric on this tree with ~0.6 units of headroom.
		const w = mount(ViewFailure, {
			props: { headline: 'h', body: 'b', actionLabel: 'Try again' },
		});
		w.find('.rp-view-failure__action').trigger('click');
		expect(w.emitted('action')).toHaveLength(1);
	});

	it('is not an empty state', () => {
		// Structural rather than a copy convention: the slice document's rule is that a failure
		// must never read as legitimately-absent data, and the classes are what keep the two
		// apart for the stylesheet, the tests and the axe case alike.
		const w = mount(ViewFailure, { props: { headline: 'h', body: 'b' } });
		expect(w.find('.rp-empty-state').exists()).toBe(false);
		expect(w.find('.rp-view-failure').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/presentation/components/viewFailure.test.ts`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Write the component**

```vue
<script setup lang="ts">
/**
 * A view's content replaced by the reason it has none — slice 17's one new container.
 *
 * It is deliberately NOT `EmptyState.vue`, and the difference is not styling. An empty state
 * claims the data is legitimately absent and offers onboarding; showing "create your first
 * project" because a vault read failed is actively misleading, which is the objection slice 14
 * raises when it defers this case here. Keeping them as two components makes that a fact about
 * the markup rather than a convention about the copy.
 *
 * Like `EmptyState`, it takes RESOLVED strings and knows nothing about i18n, so the composing
 * view owns the copy and a future view can reuse this without depending on this slice.
 *
 * `role="alert"` rather than a bare region: this replaces a view's whole content on a failure
 * the user did not ask for, which is the case an assertive announcement is for. It is NOT a
 * live region that persists — the element mounts with the failure and unmounts with it.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one. `styles/view-failure.css` is
 * this component's only entry point into the assembled sheet.
 */
defineProps<{
	readonly headline: string;
	readonly body: string;
	readonly actionLabel?: string;
}>();
defineEmits<{ action: [] }>();
</script>

<template>
	<div
		class="rp-view-failure"
		role="alert"
	>
		<div class="rp-view-failure__panel">
			<h2 class="rp-view-failure__headline">
				{{ headline }}
			</h2>
			<p class="rp-view-failure__body">
				{{ body }}
			</p>
			<button
				v-if="actionLabel !== undefined"
				type="button"
				class="rp-view-failure__action"
				@click="$emit('action')"
			>
				{{ actionLabel }}
			</button>
		</div>
	</div>
</template>
```

- [ ] **Step 4: Write the stylesheet partial**

Create `styles/view-failure.css`. Follow `styles/empty-state.css` for structure. **No
hard-coded colour** — every colour is an Obsidian CSS variable (`var(--text-error)`,
`var(--text-muted)`, `var(--background-modifier-border)`, …); the build fails on a literal, and
it reads the parsed tree so a bare word like `red` is caught too.

Add the import to `styles/index.css` beside the other partials. The build fails on a partial no
entry file imports.

- [ ] **Step 5: Add the i18n keys**

In `en.ts`, add the keys Tasks 8–10 need. Sentence case:

```typescript
	'view.failure.retry': 'Try again',
	'view.project.failed.headline': 'Projects could not be loaded',
	'editor.plan-failed.headline': 'This plan could not be loaded',
	'editor.plan-missing.headline': 'This plan no longer exists',
	'editor.plan-missing.body': 'The tab points at a plan that is not in the vault any more.',
	'editor.plan-missing.action': 'Close this tab',
	'view.session-failure.headline': 'Renovation planner could not start',
```

Translate every one in `de.ts` — `tests/presentation/i18n/strings.test.ts` requires it, and
that file also pins two German terms: an Asset is **Objekt**, never *Material*, and *vault*
stays **Vault**. Read the German copy aloud before committing; nothing in any gate reads its
grammar.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run tests/presentation/components/viewFailure.test.ts tests/presentation/i18n`
Expected: PASS.

- [ ] **Step 7: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the one container this slice owns, and keep it structurally not an empty state"
```

---

### Task 8: `ViewRoot` gains a retry

**Files:**
- Modify: `src/presentation/views/ViewRoot.vue`
- Test: `tests/presentation/views/viewRoot.test.ts` (existing — add cases), `tests/harness/accessibility.test.ts`

- [ ] **Step 1: Write the failing cases**

Add to the existing `ViewRoot` test file:

```typescript
	it('renders a view failure with the mapped copy, not the loading line', async () => {
		const w = await mountViewRootWithFailedQuery({ category: 'Persistence', code: 'vault.unexpected-failure' });
		expect(w.find('.rp-view-failure').exists()).toBe(true);
		expect(w.find('.rp-view-message').exists()).toBe(false);
		expect(w.find('.rp-empty-state').exists()).toBe(false);
	});

	it('re-runs the hydrating query when the retry is pressed', async () => {
		const { wrapper, listProjects } = await mountViewRootWithFailedQuery(anyError);
		expect(listProjects).toHaveBeenCalledTimes(1);

		await wrapper.find('.rp-view-failure__action').trigger('click');

		expect(listProjects).toHaveBeenCalledTimes(2);
	});

	it('still shows the loading line while a read is in flight', async () => {
		// The separation this task buys: failure and loading used to share one region, so a
		// change to either could silently swallow the other.
		const w = await mountViewRootMidHydration();
		expect(w.find('.rp-view-message').exists()).toBe(true);
		expect(w.find('.rp-view-failure').exists()).toBe(false);
	});
```

Use the file's existing mount helpers; the names above are the shape, not necessarily what is
there.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/presentation/views`
Expected: FAIL on the first two.

- [ ] **Step 3: Replace the failure arm**

In `ViewRoot.vue`'s template, the `v-else` block currently holds both the failure paragraph and
the loading paragraph in one `.rp-view-message`. Split them: `ViewFailure` for
`failureMessage !== null`, and `.rp-view-message` keeps the loading line alone.

The `headline`/`body` split: `headline` is `tr('view.project.failed.headline')` and `body` is
the existing `failureMessage` — which is `trError(error)`, so unrecovered settings and a vault
fault still say different things, which is the property slice 11 bought and this must not lose.
`actionLabel` is `tr('view.failure.retry')`, and `@action` calls `hydrate()`.

Update the component docblock: it currently says "Failure and loading share one region"; they
no longer do, and the sentence about the empty state never drawing beside a failure is still
true and still worth keeping.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run tests/presentation/views`
Expected: PASS.

- [ ] **Step 5: Extend the accessibility case**

`tests/harness/accessibility.test.ts` grades this view's empty state and asserts
`.rp-empty-state__action` is present. Add a case that mounts the FAILED state and scans it,
asserting `.rp-view-failure__action` is in the scanned DOM.

**Await `flushPromises()` before scanning.** `mountHarness` is synchronous and `void`s
`onOpen`, so a scan taken immediately runs one tick before the store's query resolves — and
axe on an empty subtree reports zero elements under every rule bucket, which is a PASS
indistinguishable from a pass on compliant markup. That defect is recorded in CLAUDE.md; do not
reintroduce it.

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Give a failed project read a retry, and stop it sharing a region with the loading line"
```

---

### Task 9: `PlanEditorRoot` gains the mapped copy, a retry, and the dangling state

**Files:**
- Modify: `src/presentation/editor/PlanEditorRoot.vue`
- Modify: `src/presentation/stores/ProjectStore.ts` (expose `error` for the failed arm, if it does not already)
- Test: existing plan-editor root tests

**Two defects close here**, not one. The `failed` arm renders a FIXED `tr('editor.plan-failed')`
string rather than `ToUserMessage` copy — so unrecovered settings and a vault fault say the same
sentence, which is the defect slice 11 fixed in `ViewRoot` and never carried here. And neither
arm has an action.

- [ ] **Step 1: Write the failing cases**

```typescript
	it('renders the MAPPED copy for a failed plan read, not one fixed sentence', async () => {
		// Two different errors must produce two different bodies. Asserting one string would
		// pass against the fixed-sentence defect this case exists to close.
		const settings = await mountPlanEditorWithFailure({ category: 'Persistence', code: 'settings.unrecovered' });
		const vault = await mountPlanEditorWithFailure({ category: 'Persistence', code: 'vault.unexpected-failure' });

		expect(settings.find('.rp-view-failure__body').text())
			.not.toBe(vault.find('.rp-view-failure__body').text());
	});

	it('re-runs the plan query when the retry is pressed', async () => {
		const { wrapper, getPlan } = await mountPlanEditorWithFailure(anyError);
		await wrapper.find('.rp-view-failure__action').trigger('click');
		expect(getPlan).toHaveBeenCalledTimes(2);
	});

	it('renders a dangling-reference state, with an action, for a plan that resolved ok(null)', async () => {
		const w = await mountPlanEditorWithMissingPlan();
		expect(w.find('.rp-view-failure').exists()).toBe(true);
		expect(w.find('.rp-view-failure__action').exists()).toBe(true);
	});

	it('never routes the missing plan through surfaceFor, because it is not an error', async () => {
		// An absence nothing asserts is indistinguishable from an omission. This is what makes a
		// later edit that starts routing ok(null) fail rather than pass quietly.
		const spy = vi.spyOn(policy, 'surfaceFor');
		await mountPlanEditorWithMissingPlan();
		expect(spy).not.toHaveBeenCalled();
	});
```

> The spy in the last case needs `surfaceFor` reachable as a module namespace import. If
> spying proves awkward, assert the equivalent observable instead: that no notice was raised
> and no save-state transition occurred for the missing plan. Do **not** drop the case — it is
> the one that pins the absence.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/presentation/editor`
Expected: FAIL on all four.

- [ ] **Step 3: Replace both arms**

`status === 'failed'` → `ViewFailure` with `trError(store.error)` as the body,
`tr('editor.plan-failed.headline')` as the headline, retry re-running `hydrate()`.

`status === 'missing'` → `ViewFailure` with `editor.plan-missing.*` copy and an action. The
action closes the leaf. `PlanEditorRoot` cannot reach the workspace directly — check whether
`PlanEditorContext` already carries a door for it; if not, **stop and ask** rather than reaching
for the global `app`, which the marketplace rules refuse. The fallback that needs no new seam is
to render the state with no action and record why, exactly as `planEditor.noBackground` does —
but take that only if the seam genuinely is not there.

The loading arm keeps `.rp-editor-canvas-message`.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run tests/presentation/editor`
Expected: PASS.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: PASS. Watch `max-lines` on `PlanEditorRoot.vue`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Say which failure a plan hit, and offer a plan that is gone something to do"
```

---

### Task 10: The bootstrap session-failure state

**Files:**
- Modify: `src/presentation/views/ViewRoot.vue`, `src/presentation/editor/PlanEditorRoot.vue`
- Modify: `src/plugin/composition-root.ts` (surface the unrecovered-settings fact to the views)
- Test: new cases in both views' test files

**Read first:** the slice document's "Bootstrap: the failure that precedes every row above".
Two properties distinguish this from Task 8/9's `view-failure`: it is every view for the whole
session, and it has **no retry**, because nothing was composed to re-run. Slice 1 already
refused a repair UI, and the actionable half lives in the settings tab.

- [ ] **Step 1: Check what the views can already see**

`composition-root.ts` already hands a refusal bundle when `settings === null`, and every query
in it refuses with `settings.unrecovered`. So a view in a bootstrap-failed session already
renders Task 8/9's failure state with that code's own sentence — which is **most of the
behaviour** already.

**Measure before building.** Mount each view against the unavailable bundle and look at what it
draws. If the only differences from the desired session-failure state are the retry button and
the headline, this task is small: suppress the retry when the error's code is
`settings.unrecovered`, keyed through `surfaceFor(error, { kind: 'bootstrap' })` so the decision
lives in the table rather than in a component's `if`.

Write down what you measured before choosing an approach; if it turns out the views already do
the right thing apart from the retry, say so and keep this task to that.

- [ ] **Step 2: Write the failing cases**

```typescript
	it('offers NO retry when the session failed to load its settings', async () => {
		// Distinct from a view-hydration failure precisely here: a query can be re-run, and
		// nothing was composed to re-run. Slice 1: recovery is a reload, not a repair UI.
		const w = await mountViewRootWithUnrecoveredSettings();
		expect(w.find('.rp-view-failure').exists()).toBe(true);
		expect(w.find('.rp-view-failure__action').exists()).toBe(false);
	});
```

Plus the same for the Plan Editor.

- [ ] **Step 3: Implement, per what Step 1 measured**

- [ ] **Step 4: Run the gate and commit**

```bash
npm run check
git add -A
git commit -m "Withhold a retry from a session that composed nothing to retry"
```

---

### Task 11: Calibration's inline field error

**Files:**
- Modify: `src/presentation/editor/runtime.ts` (`registerEditorTools`' `supplyKnownDistance`),
  `src/presentation/editor/shell/KnownDistanceForm.vue`, `src/presentation/editor/tools/CalibrateTool.ts`
- Test: existing calibration tests, plus new cases

**This is Finding 2, and it is the schedule risk.** Read the spec's Finding 2 and its Risks
entry before starting. It restructures a gesture, not a wiring.

- [ ] **Step 1: Run the existing calibration cases and record the baseline**

Run: `npx vitest run tests/presentation/editor --reporter=verbose 2>&1 | grep -i calib`
Write down which cases exist and that they pass. They are the regression net for a tool
CLAUDE.md records four interruption-defect classes in — `generation` counters,
`abandonGesture` vs `cancel`, the restored first point, the buffered completing click. Every one
is live across this change.

- [ ] **Step 2: Write the failing cases**

```typescript
	it('renders calibration.invalid-distance under the known-distance field', async () => {
		const rig = await calibrateWithRefusal({ code: 'calibration.invalid-distance' });
		expect(rig.dialogFieldError('knownDistance')).not.toBeNull();
		expect(rig.dialogIsOpen()).toBe(true);
		expect(rig.notices.error).not.toHaveBeenCalled();
	});

	it('raises a toast for calibration.coincident-points, which no field is about', async () => {
		// A failure of a PAIR the user expressed by clicking. There is no input to render it
		// under, which is the FieldErrorMap's own documented meaning for an absent entry.
		const rig = await calibrateWithRefusal({ code: 'calibration.coincident-points' });
		expect(rig.notices.error).toHaveBeenCalledTimes(1);
	});

	it('raises a toast for calibration.degenerate-scale', async () => {
		const rig = await calibrateWithRefusal({ code: 'calibration.degenerate-scale' });
		expect(rig.notices.error).toHaveBeenCalledTimes(1);
	});
```

- [ ] **Step 3: Restructure the gesture**

`supplyKnownDistance` currently awaits a number out of the dialog and returns it, so the dialog
is closed before the command refuses. Follow slice 16's settled shape: the form owns its
dispatch, keeping the dialog open so a rejection renders under the field it is about.
`NewProjectForm` is the worked example — read it and `useFormCommit` before writing.

`KnownDistanceForm` gains a `FieldErrorMap` naming `calibration.invalid-distance` → the
known-distance field, and naming neither of the other two, which is how `routeError` sends
those to the banner and thence to the toast.

- [ ] **Step 4: Run the calibration cases from Step 1 and the new ones**

Expected: PASS, all of them. **A single regression in the Step 1 baseline stops this task** —
re-read the interruption bullets in CLAUDE.md's slice 8 and 15 sections before changing
anything to make it green.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Keep the calibration dialog open long enough to say which number was wrong"
```

---

### Task 12: The written record

**Files:**
- Modify: `CLAUDE.md`, `docs/tasks/17-presentation-layer-error-surfacing.md`,
  `docs/tests/cases/Notices and save state.md`, `docs/tests/cases/Calibrate a Plan.md`,
  `docs/components/Toast.md`

- [ ] **Step 1: Add the slice 17 section to CLAUDE.md**

Follow the house shape: what landed, then the rules that came out of it, each written to what a
check actually reaches. Candidates from this plan's own work — write only the ones that turned
out to be true:

- A policy consulted is not a policy enforced; the brand is what makes "you cannot reach a
  surface without asking" a compile error, and it does **not** hold that the origin was right.
- Two individually-correct mechanisms double-reported one failure for four slices, because
  nothing owned which one should speak.
- A tool that awaits a value out of a dialog cannot render an inline error for the command that
  value feeds — the form has to own the dispatch.
- On this tree **functions**, not branches, is the binding coverage metric.

- [ ] **Step 2: Tick the Definition of Done honestly**

In the slice document, tick only what a check proves. **Withdraw rather than tick** anything
this slice did not close, exactly as slices 11 and 16 withdrew items. Known candidates: the
`SaveStateIndicator` announcement noise and the `InspectorDto` error variant are both out of
scope by decision and must be recorded as open, not ticked.

- [ ] **Step 3: Add the manual steps for what no gate reaches**

Toast preemption is verifiable in a real vault and nowhere else — `tests/harness/obsidian.css`
declares no `.notice` and no `.notice-container` rule at all. Add a step to
`docs/tests/cases/Notices and save state.md`: raise three persistent warnings, then an error,
and confirm the error appears and is announced.

Add a step to `docs/tests/cases/Calibrate a Plan.md` for the inline distance error.

- [ ] **Step 4: Run the gate**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Record what slice 17 closed, what it withdrew, and what only a vault can check"
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: the policy (1), the brand (2), the
dispatcher (3), the closed door and the ten origins (4/4b/4c), Finding 1 (4b), the agreement
check (5), preemption (6), the three view states (7–10), Finding 2 (11), the record (12). The
two explicitly out-of-scope items (`SaveStateIndicator` announcement, `InspectorDto`) are
recorded in Task 12 Step 2 rather than silently dropped.

**Known softness, stated rather than hidden.** Three tasks depend on APIs this plan has not
read in full and says so at the point of use rather than inventing names: the `planEditorRig`
members in Tasks 4b/4c, the view-test mount helpers in Tasks 8/9, and whether
`PlanEditorContext` carries a close-the-leaf door in Task 9. Each carries an explicit
instruction to open the file first, and Task 9's carries a **stop and ask** rather than a
guess. Task 10 Step 1 is a measurement step before an implementation step, for the same
reason — the views may already do most of it.

**Type consistency.** `surfaceFor`, `ErrorOrigin`, `ErrorSurface`, `ToastSurface`,
`SurfaceSinks`, `surfaceError` are spelled identically in every task that names them.
`notifyError(error, routed)` has one signature from Task 4 onward.
