# Slice 16 — Form & inline validation feedback: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One reusable field-error vocabulary — a router, two components, two composables — consumed by the Inspector's two live override fields and by a New Project creation dialog, with a project list so the created project is visible.

**Architecture:** A pure `routeError` turns one `AppError` into either a per-field message or a form-level banner, keyed on `error.code` and never on `category`. Two dumb components render an already-resolved string. Two composables own draft/error/pending state — one per-field for blur-commit (Inspector), one per-form for submit-commit (dialog) — and both keep the user's rejected value rather than reverting it. No Pinia store is added. Three `Project` fields the form collects DO become newly persisted (Task 5a) — the spec's five-field form named three the mapper silently dropped, and a control that does nothing is the failure mode slice 14's Amendment 1 refuses.

**Tech Stack:** TypeScript, Vue 3 (`<script setup>`), Pinia (existing stores only), Vitest (node + jsdom profiles), `@vue/test-utils`, axe-core, ESLint + oxlint, Obsidian 1.13.0 API.

**Spec:** [`docs/superpowers/specs/2026-08-28-slice-16-form-and-inline-validation-feedback-design.md`](../specs/2026-08-28-slice-16-form-and-inline-validation-feedback-design.md) — read it first; this plan argues from it.

**Slice document:** [`docs/tasks/16-form-and-inline-validation-feedback.md`](../../tasks/16-form-and-inline-validation-feedback.md) — the specification. Where it and the spec disagree, the spec is the later measurement.

## Global Constraints

Every task's requirements implicitly include all of these. Values are copied verbatim from the repository's own gates.

- **Definition of done is `npm run check`** — build + lint + coverage-thresholded tests + fallow. All four pass before any commit.
- **Coverage floors: statements 99, functions 99, lines 99, branches 98.** Branches has roughly two covered branches of headroom; one branch costs 0.047. **Plan the test with the code, never after it** — an untested new arm does not lower coverage, it fails the gate.
- **Layering** (`eslint.config.mjs`, `no-restricted-imports`): `presentation → application → domain → core`. `presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/` or the event bus. `core/`, `domain/` and `application/` may not name `vue`, `pinia`, `konva` or `obsidian`.
- **No user-facing literal.** Every string reaches the user through `t(language, key)` / `tr(key)` from `src/presentation/i18n/`. `I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN` are lint rules. Add every new key to **both** `en.ts` and `de.ts` — `tests/presentation/i18n/strings.test.ts` requires German for every key `en.ts` declares.
- **German vocabulary:** an Asset is `Objekt`, never `Material`. *Vault* is Obsidian's own name and stays untranslated. Both are pinned in `strings.test.ts`.
- **No hard-coded colour in `styles/`** (SDD §84) — use an Obsidian CSS variable so a themed vault stays themed. Partials cap at 400 lines and must be imported by `styles/index.css`.
- **No new dependency.** `@vueform/vueform` was measured and refused (spec, "The spike"); nothing here installs anything.
- **`AppError.message` is developer English for a log line**, never user copy. `toUserMessage` / `trError` is the only place an `AppError` becomes a sentence.
- **Address code by name, not by line number**, in comments and commit messages alike.
- **Write the guarantee to the check.** If a check cannot reach the whole claim, narrow the sentence rather than leaving the wider one standing.
- Commit after every task. Conventional-commit subject lines (`feat:`, `fix:`, `docs:`, `test:`).
- **Stage every file the task touched, and check the `git add` line against the task's own Files block before running it.** Three tasks here shipped a `git add` that omitted a file the task creates — `openNote.ts`, the two dialog components, the id-prefix helper and both view files. `npm run check` cannot catch it: it reads the WORKING TREE, which has the file, so the gate passes and the commit is short. The result is a commit that does not build, and for a path no later task stages, a file left uncommitted altogether. `git status --porcelain` before every commit, and stage what it shows.

## File structure

| File | Responsibility |
|---|---|
| `src/presentation/errors/route-error.ts` | **Create.** `routeError`, `FieldErrorMap`, `RoutedError`. Pure; no Vue, no Obsidian, no command. |
| `src/presentation/components/FieldError.vue` | **Create.** Wraps one input via its default slot; renders text + glyph; sets `aria-invalid` / `aria-describedby`. |
| `src/presentation/components/FormBanner.vue` | **Create.** One form-level message. Not a toast, not a modal. |
| `src/presentation/composables/use-field-commit.ts` | **Create.** Per-field blur-commit for the Inspector. |
| `src/presentation/composables/use-form-commit.ts` | **Create.** Per-form submit-commit for a creation dialog. |
| `src/presentation/views/renovationProjectCommands.ts` | **Create.** `RenovationProjectCommandServices` + `unavailableRenovationProjectCommands()`. |
| `src/presentation/views/NewProjectForm.vue` | **Create.** The five-field form mounted in slice 15's `FormDialog`. |
| `src/presentation/views/ProjectList.vue` | **Create.** One row per `ProjectSummaryDto`. |
| `src/presentation/views/app-id-prefix.ts` | **Create.** `nextAppIdPrefix()` — a distinct `useId` namespace per mounted Vue app. |
| `src/infrastructure/persistence/dto/projectFrontmatter.ts` | **Modify.** Three nullable keys, so the form's fields survive a reload. No version bump. |
| `src/infrastructure/persistence/mappers/projectMapper.ts` | **Modify.** Carry them both directions; date-only, UTC. |
| `styles/forms.css` | **Create.** Field error, banner, form layout, project list. Obsidian variables only. |
| `src/presentation/views/RenovationProjectContext.ts` | **Modify.** `RenovationProjectDeps` gains `commands` and `openProject`. |
| `src/plugin/guardedServices.ts` | **Modify.** Guard `CreateProjectCommand`. |
| `src/plugin/composition-root.ts` | **Modify.** `renovationProjectDeps` composes the command bundle and `openProject`. |
| `src/presentation/views/ViewRoot.vue` | **Modify.** Render the list, wire the empty state's action, correct two slice-17 comments. |
| `src/presentation/emptyStates/content.ts` | **Modify.** `renovationProject.noProjects` gains `actionLabel`. |
| `src/presentation/dialogs/dialog-store.ts` | **Modify.** Correct `FormDialogResult`'s docblock. |
| `src/presentation/editor/shell/RequirementRow.vue` | **Modify.** Both override fields adopt `useFieldCommit`. |
| `src/presentation/views/PlanEditorView.ts`, `RenovationProjectView.ts` | **Modify.** Set `app.config.idPrefix` at BOTH `createApp` sites. Both surfaces render `FieldError`. |
| `src/presentation/editor/runtime.ts` | **Modify.** `commitEdit` narrows to the failures no field can show. |
| `src/presentation/i18n/locales/en.ts`, `de.ts` | **Modify.** New keys. |
| `src/plugin/sampleProject.ts`, `CLAUDE.md` | **Modify.** Correct the three false claims. |

---

### Task 1: `routeError` — the pure router

**Files:**
- Create: `src/presentation/errors/route-error.ts`
- Test: `tests/presentation/errors/routeError.test.ts`

**Interfaces:**
- Consumes: `AppError` from `src/core/errors/AppError.ts` (has `category`, `code`, `message`).
- Produces: `FieldErrorMap<TInput>`, `RoutedError<TInput>`, `routeError<TInput>(error, map, toUserMessage): RoutedError<TInput>`. Tasks 3 and 4 both call `routeError`.

`presentation/errors/` is a NEW top-level folder under `presentation/`, a sibling of `dialogs/` — SDD §77's tree does not draw it. `route-error.ts` is deliberately NOT under `composables/`: `docs/setup/vue-conventions.md` §4 scopes that directory to `use*` composables that bind reactivity or a lifecycle, and this binds neither. That is the whole reason — it has no bearing on the test environment, which the test file's own profile decides.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/errors/routeError.test.ts`. Node profile — no `@vitest-environment` docblock, because this is a pure function.

```typescript
/**
 * The routing rule, driven at the function rather than at a form.
 *
 * `toUserMessage` is passed in as a pre-bound `(error) => string`, so these cases assert
 * WHERE a message lands and never WHAT it says: the routing function is language-agnostic
 * by construction and there is no locale table in this file.
 */
import { describe, expect, it } from 'vitest';
import { routeError, type FieldErrorMap } from '../../../src/presentation/errors/route-error';
import type { AppError } from '../../../src/core/errors/AppError';

interface TestInput {
	readonly name: string;
	readonly start: string;
	readonly targetCompletion: string;
}

const MAP: FieldErrorMap<TestInput> = {
	'project.empty-name': 'name',
	'project.target-before-start': ['start', 'targetCompletion'],
};

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english, never shown' };
}

const say = (error: AppError): string => `copy for ${error.code}`;

describe('routeError', () => {
	it('routes a mapped code to its one field, with toUserMessage’s exact text', () => {
		const routed = routeError(validation('project.empty-name'), MAP, say);

		expect(routed).toEqual({
			kind: 'field',
			fields: ['name'],
			message: 'copy for project.empty-name',
		});
	});

	it('routes a map entry naming two fields to both of them', () => {
		const routed = routeError(validation('project.target-before-start'), MAP, say);

		expect(routed.kind).toBe('field');
		// The array form: neither field alone describes the failure, so neither alone gets it.
		expect(routed.kind === 'field' && routed.fields).toEqual(['start', 'targetCompletion']);
	});

	it('routes a code absent from the map to the banner, with the SAME text', () => {
		// Absence is the explicit statement "this failure is not about one field" — the
		// PersistenceError a save refuses with is about the vault, not about an input.
		const error: AppError = {
			category: 'Persistence',
			code: 'project.save-failed',
			message: 'developer english, never shown',
		};

		expect(routeError(error, MAP, say)).toEqual({
			kind: 'banner',
			message: 'copy for project.save-failed',
		});
	});

	it('routes on code alone, never on category', () => {
		// A Calculation error whose code IS mapped still reaches the field. Which categories
		// may reach a field at all is slice 17's decision, not this function's.
		const error: AppError = {
			category: 'Calculation',
			code: 'project.empty-name',
			message: 'developer english, never shown',
		};

		expect(routeError(error, MAP, say).kind).toBe('field');
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/errors/routeError.test.ts`
Expected: FAIL — `Failed to resolve import ".../src/presentation/errors/route-error"`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/errors/route-error.ts`:

```typescript
import type { AppError } from '../../core/errors/AppError';

/**
 * Which field(s) a command's error code is ABOUT, declared per form beside the fields it
 * renders.
 *
 * There is no global registry of codes and there deliberately is not one: slice 2 leaves
 * each error-producing module to own its own catalogue. Values are typed `keyof TInput`, so
 * a typo'd field name — or a field the command was refactored to remove — fails to compile
 * rather than pointing an error at nothing.
 *
 * **A code with NO entry here is not an omission to fill in later.** It is the explicit
 * statement "this failure is not about one field", and it routes to the banner. The
 * calibration case is the clearest instance: `calibration.coincident-points` is a failure of
 * a PAIR the user expressed by clicking, and there is no input to render it under.
 */
export type FieldErrorMap<TInput> = Readonly<
	Record<string, keyof TInput | readonly (keyof TInput)[]>
>;

export type RoutedError<TInput> =
	| { readonly kind: 'field'; readonly fields: readonly (keyof TInput)[]; readonly message: string }
	| { readonly kind: 'banner'; readonly message: string };

/**
 * Where one `AppError` belongs on one form. It decides WHERE, never WHAT.
 *
 * `toUserMessage` arrives pre-bound as `(error) => string` rather than as a language plus a
 * table, which is what keeps this function pure and language-agnostic. The same call
 * produces the message whether it lands at a field or in the banner — one message, one place
 * it is produced, shown in one of two places. A form never authors a second wording for the
 * same error.
 *
 * Keyed on `error.code` and never on `error.category`: a `ValidationError` and a
 * `CalculationError` route identically here. Whether a category may reach a field at all is
 * slice 17's decision table, applied before anything gets here.
 */
export function routeError<TInput>(
	error: AppError,
	map: FieldErrorMap<TInput>,
	toUserMessage: (error: AppError) => string,
): RoutedError<TInput> {
	const fields = map[error.code];
	const message = toUserMessage(error);
	if (fields === undefined) {
		return { kind: 'banner', message };
	}
	return {
		kind: 'field',
		fields: Array.isArray(fields) ? fields : [fields as keyof TInput],
		message,
	};
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/errors/routeError.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the gate**

Run: `npm run check`
Expected: all four steps pass. If fallow reports `route-error.ts` as an unused FILE, that is expected until Task 3 imports it — note it and proceed; do NOT add a fake caller.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/errors/route-error.ts tests/presentation/errors/routeError.test.ts
git commit -m "feat: routeError, one AppError to one field or to the banner"
```

---

### Task 2: `<FieldError>` and `<FormBanner>`

**Files:**
- Create: `src/presentation/components/FieldError.vue`, `src/presentation/components/FormBanner.vue`
- Create: `src/presentation/views/app-id-prefix.ts`
- Create: `styles/forms.css`
- Modify: `styles/index.css` (import the partial)
- Modify: `src/presentation/views/PlanEditorView.ts`, `src/presentation/views/RenovationProjectView.ts` (one line each — see below; BOTH, or the creation form is the one left colliding)
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Test: `tests/presentation/components/fieldError.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 — these components never learn `AppError` exists.
- Produces: `FieldError` with prop `{ message: string | null }` and a SCOPED slot handing down `{ inputId, aria }`; `FormBanner` with props `{ message: string | null }`. Tasks 6 and 9 render both and bind both slot values.

Both take an ALREADY-RESOLVED string, the same division `EmptyState.vue` and slice 15's dialogs make: a user-facing string is resolved by the caller. That is what keeps them reusable by a settings-pane field whose copy comes from somewhere else.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/components/fieldError.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The accessibility wiring, asserted as DOM rather than as a class name.
 *
 * SDD §85 / PRD §44 require status that is not encoded only by colour, so the assertions
 * below read TEXT CONTENT and ARIA attributes. A test that asserted a class would pass on a
 * component that rendered a red border and no words.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FieldError from '../../../src/presentation/components/FieldError.vue';
import FormBanner from '../../../src/presentation/components/FormBanner.vue';

function mountField(message: string | null) {
	return mount(FieldError, {
		props: { message },
		// The caller binds what the slot hands down — which is the whole point: there is no
		// lookup to get wrong and no id for a second leaf to collide with.
		slots: { default: '<template #default="{ inputId, aria }"><input :id="inputId" v-bind="aria"></template>' },
	});
}

describe('FieldError', () => {
	it('renders nothing and marks nothing invalid when there is no message', () => {
		const wrapper = mountField(null);
		const input = wrapper.get('input');

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect(input.attributes('aria-invalid')).toBeUndefined();
		expect(input.attributes('aria-describedby')).toBeUndefined();
	});

	it('renders the message as TEXT and wires aria-invalid and aria-describedby', () => {
		const wrapper = mountField('A project needs a name.');
		const input = wrapper.get('input');
		const message = wrapper.get('.rp-field-error__message');

		expect(message.text()).toContain('A project needs a name.');
		expect(input.attributes('aria-invalid')).toBe('true');
		expect(input.attributes('aria-describedby')).toBe(message.attributes('id'));
	});

	it('carries a non-colour glyph beside the text', () => {
		// "status not encoded only by colour": the glyph is aria-hidden because the message
		// itself already says what is wrong — announcing "warning" twice helps nobody.
		const wrapper = mountField('A project needs a name.');
		const glyph = wrapper.get('.rp-field-error__glyph');

		expect(glyph.attributes('aria-hidden')).toBe('true');
		expect(glyph.text()).not.toBe('');
	});
});

describe('FormBanner', () => {
	it('renders nothing when there is no message', () => {
		const wrapper = mount(FormBanner, { props: { message: null } });

		expect(wrapper.find('.rp-form-banner').exists()).toBe(false);
	});

	it('renders the message in an assertive live region', () => {
		// A banner appears in response to the user's own submit, and it is the only feedback
		// that press produced — so it is announced rather than merely present.
		const wrapper = mount(FormBanner, { props: { message: 'The vault could not be written.' } });
		const banner = wrapper.get('.rp-form-banner');

		expect(banner.text()).toContain('The vault could not be written.');
		expect(banner.attributes('role')).toBe('alert');
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/components/fieldError.test.ts`
Expected: FAIL — cannot resolve `FieldError.vue`.

- [ ] **Step 3: Write `FieldError.vue`**

**It MINTS both ids and hands them down a scoped slot — it looks nothing up.** A first draft
resolvedresolved the slotted control with `ownerDocument.getElementById(inputId)`, which is
document-GLOBAL: two Plan Editor leaves showing the same requirement both render
`rp-requirement-{id}-quantity`, so one leaf's `FieldError` would set ARIA on the other leaf's
input and leave its own untouched. A scoped `querySelector` fixes the crossing but not the
duplicate ids themselves.

So `FieldError` MINTS the id and hands it down through a scoped slot. Nothing looks anything
up, nothing can collide, and the caller cannot forget the wiring because it has to bind what
it is given:

```vue
<script setup lang="ts">
import { computed, useId } from 'vue';

defineProps<{ message: string | null }>();

const inputId = useId();
const messageId = useId();
</script>

<template>
	<div class="rp-field-error">
		<!--
			The ARIA pair goes on the CONTROL, never on this wrapper: a screen reader reads
			`aria-invalid` and `aria-describedby` off the control they describe, and they mean
			nothing on a div. Handed down rather than applied by lookup, so there is no id to
			collide and no document to search.
		-->
		<slot
			:input-id="inputId"
			:aria="message === null ? {} : { 'aria-invalid': 'true', 'aria-describedby': messageId }"
		/>
		<p
			v-if="message !== null"
			:id="messageId"
			class="rp-field-error__message"
		>
			<span
				class="rp-field-error__glyph"
				aria-hidden="true"
			>⚠</span>
			{{ message }}
		</p>
	</div>
</template>
```

Callers bind both: `<FieldError :message="..." v-slot="{ inputId, aria }"><input :id="inputId" v-bind="aria"></FieldError>`. Drop the `inputId` PROP — it no longer exists, and every call site in Tasks 6 and 9 uses the slot instead.

**One residual, and it needs a line at BOTH `createApp` sites, not one.** `useId` is unique per Vue APP and restarts at `v-0` in each, and this plugin mounts one app per leaf — so two apps in one document mint the same ids and the second control's `aria-describedby` resolves to the first form's message, silently, with no error anywhere and both forms looking correct.

Two sites, because both surfaces render these controls: `PlanEditorView.ts` (Task 9's rows) and `RenovationProjectView.ts` (`ViewRoot` opens `NewProjectForm`, Tasks 6 and 7). Fixing only the Plan Editor was this plan's first draft and would have left the creation form — the surface this slice exists for — exposed. `RenovationProjectView` being a singleton is not a defence: `revealView` reuses the one leaf it finds, but a user can split a pane, and Obsidian restores whatever layout was saved. `getLeavesOfType` returning a LIST is that possibility in the type.

**Not "the leaf's own key" — `WorkspaceLeaf` has no public id.** An earlier draft said to use one; the pinned `obsidian@1.13.0` typings expose `parent`, `view` and `hoverPopover` and nothing identifying, so that line would have meant reaching for an undocumented field, which is a marketplace rejection and a rename away from breaking. Use a module-level counter instead — it needs no API at all, and uniqueness within the process is exactly the guarantee required:

```typescript
// src/presentation/views/app-id-prefix.ts
/**
 * A distinct `useId` namespace per mounted Vue app.
 *
 * `useId` restarts at `v-0` in every app, so two leaves in one document collide — and the
 * failure is silent: `aria-describedby` resolves to whichever element carries the id first,
 * so a screen reader reads the wrong form's error and both panes look right.
 *
 * A counter rather than the leaf's identity because `WorkspaceLeaf` exposes none publicly,
 * and because "unique" is the whole requirement — nothing reads the prefix back or matches
 * it to a leaf. Monotonic across unmount/remount on purpose: reusing a retired prefix while
 * the old app's DOM is still detaching is the collision again, narrower.
 */
let mounted = 0;

export function nextAppIdPrefix(): string {
	mounted += 1;
	return `rp-${String(mounted)}`;
}
```

Called at each site immediately after `createApp`, BEFORE `mount` — `useId` reads `app.config.idPrefix` when a component sets up, so setting it after mounting changes nothing already rendered:

```typescript
const app = createApp(ViewRoot);
app.config.idPrefix = nextAppIdPrefix();
```

Assert it in Task 2's tests: mount two apps, and require the ids they mint to differ. Two apps is the whole defect, so a case that mounts one proves nothing about it.

- [ ] **Step 4: Write `FormBanner.vue`**

```vue
<script setup lang="ts">
/**
 * The fallback surface: one message about the form as a whole, anchored to no input.
 *
 * It is NOT a toast — it does not auto-dismiss and it lives inside the form's own layout,
 * not a global notification region — and NOT a modal, since it blocks nothing. Slice 13 owns
 * the toast; this is what a failure with no field to sit under gets instead.
 *
 * `role="alert"` rather than `role="status"`: it appears in response to the user's own
 * submit and is the only feedback that press produced, so it is announced rather than
 * merely present. The empty state's notice in `ViewRoot.vue` is `status` for the opposite
 * reason — nobody pressed anything.
 */
defineProps<{ message: string | null }>();
</script>

<template>
	<p
		v-if="message !== null"
		class="rp-form-banner"
		role="alert"
	>
		<span
			class="rp-form-banner__glyph"
			aria-hidden="true"
		>⚠</span>
		{{ message }}
	</p>
</template>
```

- [ ] **Step 5: Write the stylesheet partial**

Create `styles/forms.css`. **Obsidian variables only — a hard-coded colour fails the build.**

```css
/*
 * Field errors, the form banner, and the project list.
 *
 * Every colour is an Obsidian variable so a themed vault stays themed (SDD §84). The
 * assembler parses this with lightningcss and refuses a literal colour at any nesting
 * depth, including a bare word like `red`.
 */
.rp-field-error {
	display: flex;
	flex-direction: column;
	gap: var(--size-2-1);
}

.rp-field-error__control [aria-invalid='true'] {
	border-color: var(--text-error);
}

.rp-field-error__message,
.rp-form-banner {
	display: flex;
	align-items: flex-start;
	gap: var(--size-2-2);
	margin: 0;
	color: var(--text-error);
	font-size: var(--font-ui-smaller);
}

.rp-form-banner {
	padding: var(--size-4-2);
	border: 1px solid var(--background-modifier-error);
	border-radius: var(--radius-s);
	background-color: var(--background-modifier-error-hover);
	font-size: var(--font-ui-small);
}
```

Then add `@import 'forms.css';` to `styles/index.css` beside the other partials — the build fails on a partial no entry file imports.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/components/fieldError.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the gate**

Run: `npm run check`

- [ ] **Step 8: Commit**

```bash
git add src/presentation/components/FieldError.vue src/presentation/components/FormBanner.vue \
        src/presentation/views/app-id-prefix.ts \
        src/presentation/views/PlanEditorView.ts src/presentation/views/RenovationProjectView.ts \
        styles/forms.css styles/index.css tests/presentation/components/fieldError.test.ts
git commit -m "feat: FieldError and FormBanner, the two rendering surfaces"
```

---

### Task 3: `useFormCommit` — the per-form submit boundary

**Files:**
- Create: `src/presentation/composables/use-form-commit.ts`
- Test: `tests/presentation/composables/useFormCommit.test.ts`

**Interfaces:**
- Consumes: `routeError`, `FieldErrorMap` (Task 1).
- Produces: `useFormCommit<TInput, TResult>({ initial, dispatch, errorMap, toUserMessage })` returning `UseFormCommit<TInput>` with readonly `values`, `fieldErrors`, `banner`, `submitting` and methods `setField`, `submit`. Task 6 consumes it.

**The one rule covering this task and Task 4:** the composable owns its state, the component reads it, and the named methods are the only write paths. Every returned member is read-only to the caller. `setField` clears that field's error — editing a field the command just rejected must retire its message, or the form is telling the user something untrue.

`values` is `DeepReadonly<Ref<TInput>>` and **not** `Readonly<Ref<TInput>>`. The shallow spelling reads as read-only while permitting exactly the two writes this shape exists to refuse: `Readonly<T>` marks `.value` immutable and stops there, so `values.value.name = 'x'` type-checks, and a ref unwraps in templates, so `v-model="values.name"` does too. `DeepReadonly` is what Vue's own `readonly()` returns, so both fail to compile AND the proxy refuses the write at runtime.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/composables/useFormCommit.test.ts`. Node profile — this composable binds no lifecycle.

```typescript
/**
 * The submit boundary, driven against a fake dispatch.
 *
 * `values` and `fieldErrors` are REFS, so every assertion dereferences `.value`. The
 * unwrapping that lets a template write `values.name` is a template feature and does not
 * apply here.
 */
import { describe, expect, it, vi } from 'vitest';
import { useFormCommit } from '../../../src/presentation/composables/use-form-commit';
import type { FieldErrorMap } from '../../../src/presentation/errors/route-error';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

interface NewProject {
	readonly name: string;
	readonly status: string;
}

const MAP: FieldErrorMap<NewProject> = { 'project.empty-name': 'name' };
const say = (error: AppError): string => `copy for ${error.code}`;

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

function harness(dispatch: (input: NewProject) => Promise<Result<{ id: string }, AppError>>) {
	return useFormCommit<NewProject, { id: string }>({
		initial: { name: '', status: 'IDEA' },
		dispatch,
		errorMap: MAP,
		toUserMessage: say,
	});
}

describe('useFormCommit', () => {
	it('keeps every typed value on a rejection, routes the error to its field, and writes nothing', async () => {
		const dispatch = vi.fn(async () => err(validation('project.empty-name')));
		const form = harness(dispatch);

		form.setField('name', '   ');
		const closed = await form.submit();

		expect(closed).toBe(false);
		expect(form.fieldErrors.value.get('name')).toBe('copy for project.empty-name');
		// Draft preservation is the point of this case: the rejected value survives.
		expect(form.values.value.name).toBe('   ');
		expect(form.banner.value).toBeNull();
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('retires a rejected field’s message when the user edits it, and dispatches nothing doing so', async () => {
		const dispatch = vi.fn(async () => err(validation('project.empty-name')));
		const form = harness(dispatch);
		await form.submit();

		form.setField('name', 'Kitchen');

		// BOTH halves. A setField that only cleared the error would satisfy the second alone.
		expect(form.values.value.name).toBe('Kitchen');
		expect(form.fieldErrors.value.has('name')).toBe(false);
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('retires a CROSS-FIELD error from both of its fields when either one is edited', async () => {
		// `project.target-before-start` is about the PAIR. Clearing only the edited half would
		// leave a message describing a pair that may now be valid — the untruth setField's
		// clearing exists to prevent, reintroduced by the array form this slice added to prove.
		const map: FieldErrorMap<NewProject> = { 'project.target-before-start': ['name', 'status'] };
		const form = useFormCommit<NewProject, { id: string }>({
			initial: { name: '', status: 'IDEA' },
			dispatch: async () => err(validation('project.target-before-start')),
			errorMap: map,
			toUserMessage: say,
		});
		await form.submit();
		expect(form.fieldErrors.value.size).toBe(2);

		form.setField('name', 'Kitchen');

		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('leaves an unrelated field’s error untouched when one field is edited', async () => {
		const dispatch = vi.fn(async () => err(validation('project.empty-name')));
		const form = harness(dispatch);
		await form.submit();

		form.setField('status', 'PLANNING');

		expect(form.fieldErrors.value.get('name')).toBe('copy for project.empty-name');
	});

	it('routes an unmapped code to the banner and to no field', async () => {
		const persistence: AppError = {
			category: 'Persistence',
			code: 'project.save-failed',
			message: 'developer english',
		};
		const form = harness(async () => err(persistence));

		await form.submit();

		expect(form.banner.value).toBe('copy for project.save-failed');
		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('resolves true on success with no errors left behind', async () => {
		const form = harness(async () => ok({ id: 'p1' }));
		form.setField('name', 'Kitchen');

		await expect(form.submit()).resolves.toBe(true);
		expect(form.fieldErrors.value.size).toBe(0);
		expect(form.banner.value).toBeNull();
	});

	it('clears a previous submission’s errors before dispatching the next one', async () => {
		// Otherwise a stale message from submit #1 outlives the submit that fixed it.
		let fail = true;
		const form = harness(async () => (fail ? err(validation('project.empty-name')) : ok({ id: 'p1' })));
		await form.submit();
		fail = false;

		await form.submit();

		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('refuses a second submit while the first is still in flight', async () => {
		// One form, one project. Without the guard, two Enter presses mint two ids and create
		// two projects, and the user sees one dialog.
		let release = (): void => undefined;
		const dispatch = vi.fn(
			async () => new Promise<Result<{ id: string }, AppError>>((resolve) => {
				release = () => resolve(ok({ id: 'p1' }));
			}),
		);
		const form = harness(dispatch);

		const first = form.submit();
		const second = await form.submit();

		expect(second).toBe(false);
		expect(dispatch).toHaveBeenCalledTimes(1);
		release();
		await expect(first).resolves.toBe(true);
	});

	it('marks submitting for the duration of the dispatch', async () => {
		let release = (): void => undefined;
		const form = harness(
			async () =>
				new Promise((resolve) => {
					release = () => resolve(ok({ id: 'p1' }));
				}),
		);

		const pending = form.submit();
		expect(form.submitting.value).toBe(true);
		release();
		await pending;
		expect(form.submitting.value).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/composables/useFormCommit.test.ts`
Expected: FAIL — cannot resolve `use-form-commit`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/composables/use-form-commit.ts`:

```typescript
import { readonly, ref, type DeepReadonly, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import { routeError, type FieldErrorMap } from '../errors/route-error';

/**
 * A creation dialog's commit boundary: every field at once, on one explicit submit.
 *
 * There is no entity yet, so there is nothing to blur-commit each field against — which is
 * the ONLY way this differs from `useFieldCommit`. Both call the same `routeError` and both
 * render through the same `<FieldError>` / `<FormBanner>` pair.
 *
 * Every returned member is read-only to the component and `setField` is the only write path.
 * `values` is DEEP-readonly for a measured reason: `Readonly<Ref<TInput>>` is a shallow
 * mapped type, so it freezes the binding and not the object — it would permit both
 * `values.value.name = x` from script and `v-model="values.name"` from markup, since a ref
 * unwraps in templates. Those are exactly the two writes that walk past `setField`.
 */
export interface UseFormCommit<TInput> {
	readonly values: DeepReadonly<Ref<TInput>>;
	/**
	 * A Ref, not a bare `ReadonlyMap`. A plain Map handed out of a composable is a SNAPSHOT,
	 * so a form whose submit was rejected would compute its errors and render none of them.
	 * Not deep, and does not need to be: `ReadonlyMap` already refuses `set`/`delete`, and
	 * its values are strings.
	 */
	readonly fieldErrors: Readonly<Ref<ReadonlyMap<keyof TInput, string>>>;
	readonly banner: Readonly<Ref<string | null>>;
	readonly submitting: Readonly<Ref<boolean>>;
	/**
	 * Writes the field AND clears the routed error it belongs to — every field of it, not
	 * just this key. A cross-field error (`project.target-before-start` sits under `start`
	 * AND `targetCompletion`) describes a PAIR, so correcting either one retires the whole
	 * claim: leaving the twin behind would display a stale message about a pair that may now
	 * be valid, which is the exact untruth this clearing exists to prevent.
	 */
	setField<K extends keyof TInput>(key: K, value: TInput[K]): void;
	/** `true` only on an ok `Result` — the caller closes the dialog on that and nothing else. */
	submit(): Promise<boolean>;
}

export function useFormCommit<TInput extends object, TResult>(options: {
	readonly initial: TInput;
	readonly dispatch: (input: TInput) => Promise<Result<TResult, AppError>>;
	readonly errorMap: FieldErrorMap<TInput>;
	readonly toUserMessage: (error: AppError) => string;
}): UseFormCommit<TInput> {
	const values = ref({ ...options.initial }) as Ref<TInput>;
	const fieldErrors = ref<ReadonlyMap<keyof TInput, string>>(new Map());
	const banner = ref<string | null>(null);
	const submitting = ref(false);

	/**
	 * Which fields shared one routed error, so a cross-field message can be retired as the
	 * unit it is. A per-key Map cannot express "these two are one claim" — it only knows that
	 * two keys happen to hold equal strings, which is not the same thing and would collapse
	 * two genuinely separate errors that read alike.
	 */
	let routedGroup: readonly (keyof TInput)[] = [];

	function setField<K extends keyof TInput>(key: K, value: TInput[K]): void {
		values.value = { ...values.value, [key]: value };
		if (!fieldErrors.value.has(key)) return;
		const next = new Map(fieldErrors.value);
		// The whole group, not just this key: correcting either half of a pair retires the
		// claim about the pair.
		for (const field of routedGroup.includes(key) ? routedGroup : [key]) next.delete(field);
		fieldErrors.value = next;
	}

	async function submit(): Promise<boolean> {
		// Two quick Enter presses produce two submit events. `CreateProjectCommand` mints a
		// fresh id per call, so without this guard one form creates two projects — and
		// `submitting` existed as an observation flag that nothing consulted, which is a flag
		// that describes the defect rather than preventing it.
		if (submitting.value) return false;
		// Cleared BEFORE the dispatch, so a stale message from the previous submit cannot
		// outlive the submit that fixed it.
		fieldErrors.value = new Map();
		routedGroup = [];
		banner.value = null;
		submitting.value = true;
		try {
			const result = await options.dispatch(values.value);
			if (!isErr(result)) return true;

			const routed = routeError(result.error, options.errorMap, options.toUserMessage);
			if (routed.kind === 'banner') {
				banner.value = routed.message;
				return false;
			}
			const next = new Map<keyof TInput, string>();
			for (const field of routed.fields) next.set(field, routed.message);
			routedGroup = routed.fields;
			fieldErrors.value = next;
			return false;
		} finally {
			submitting.value = false;
		}
	}

	return {
		values: readonly(values) as DeepReadonly<Ref<TInput>>,
		fieldErrors: readonly(fieldErrors) as Readonly<Ref<ReadonlyMap<keyof TInput, string>>>,
		banner: readonly(banner),
		submitting: readonly(submitting),
		setField,
		submit,
	};
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/composables/useFormCommit.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the compile-time proof**

Append to `tests/presentation/editor/type-safety.test-d.ts` (already in `tsconfig.json`'s `include`, so `vue-tsc` enforces it):

```typescript
// Slice 16, Definition of Done item 10: the composable's state is read-only BY TYPE, so
// `setField` is the only write path. Both spellings are checked because they fail for
// different reasons — one is a property write through the ref, the other is what a template
// would do via unwrapping — and the shallow `Readonly<Ref<TInput>>` this slice started with
// permits both while looking like it forbids them.
declare const form: UseFormCommit<{ name: string }>;
// @ts-expect-error — a property write through the ref walks past setField.
form.values.value.name = 'x';
// @ts-expect-error — what `v-model="values.name"` compiles to.
form.values.value = { name: 'x' };
// Must still compile: reading is the component's whole job.
const readName: string = form.values.value.name;
void readName;
```

- [ ] **Step 6: Run the gate**

Run: `npm run check`
Expected: pass. An unsatisfied `@ts-expect-error` is itself a build error, so if the types were widened back this step goes red at the directive.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/composables/use-form-commit.ts tests/presentation/composables/useFormCommit.test.ts tests/presentation/editor/type-safety.test-d.ts
git commit -m "feat: useFormCommit, one submit is one dispatch and a rejection keeps the draft"
```

---

### Task 4: `useFieldCommit` — the per-field blur boundary

**Files:**
- Create: `src/presentation/composables/use-field-commit.ts`
- Test: `tests/presentation/composables/useFieldCommit.test.ts`

**Interfaces:**
- Consumes: `routeError`, `FieldErrorMap` (Task 1); `CommandHistory` from `src/presentation/editor/` (only its `run` method, taken as `Pick<CommandHistory, 'run'>`).
- Produces: `useFieldCommit<T, TInput>({ canonicalValue, buildCommand, history, errorMap, field, toUserMessage })` returning `UseFieldCommit<T>` with readonly `draft`, `error`, `pending` and methods `onInput`, `onCommit`, `onCancel`. Task 9 consumes it.

**`onInput` clears `error` for exactly the reason `setField` does.** A first version of this slice gave the form path that behaviour and left this one without it, which would have had an Inspector field displaying "must be zero or more" under a value the user had already corrected. Same rule, both commit boundaries — asserted directly on each, never inferred from the other.

`canonicalValue` is `MaybeRefOrGetter<T>`, not `Ref<T>`: `docs/setup/vue-conventions.md` §4 asks composables to accept a value, a ref or a getter and normalize with `toValue()` inside the tracking context. The caller here reads one field off an `InspectorDto`, which is most naturally a computed getter.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/composables/useFieldCommit.test.ts`:

```typescript
/**
 * The blur boundary. Same vocabulary as `useFormCommit`, different commit trigger — and the
 * mirror assertions live here rather than being assumed from that file, because a rule
 * proven on one composable and assumed on the other is how this pair drifted in the first
 * place.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useFieldCommit } from '../../../src/presentation/composables/use-field-commit';
import type { FieldErrorMap } from '../../../src/presentation/errors/route-error';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

interface QuantityInput {
	readonly quantity: number;
}

const MAP: FieldErrorMap<QuantityInput> = { 'requirement.negative-quantity': 'quantity' };
const say = (error: AppError): string => `copy for ${error.code}`;

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

function harness(result: Result<void, AppError>, canonical = ref(10)) {
	const run = vi.fn(async () => result);
	const notify = vi.fn();
	const field = useFieldCommit<number, QuantityInput>({
		canonicalValue: () => canonical.value,
		buildCommand: (value) => ({
			execute: async () => result,
			undo: async () => ok(undefined),
			value,
		}),
		history: { run },
		errorMap: MAP,
		field: 'quantity',
		toUserMessage: say,
		notify,
	});
	return { field, run, canonical, notify };
}

describe('useFieldCommit', () => {
	it('starts clean at the canonical value', () => {
		const { field } = harness(ok(undefined));

		expect(field.draft.value).toBe(10);
		expect(field.error.value).toBeNull();
	});

	it('keeps the rejected value and shows its error, dispatching exactly once', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));

		field.onInput(-5);
		await field.onCommit();

		expect(field.draft.value).toBe(-5);
		expect(field.error.value).toBe('copy for requirement.negative-quantity');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('reports a failure it cannot attach to this field instead of swallowing it', async () => {
		// The Inspector has no banner region, so a refusal with no field to sit under has
		// exactly one door left. A first draft cleared the error and called nothing, which
		// made a resolved vault failure invisible on BOTH surfaces — worse than the
		// `notifyError` in `commitEdit` that this slice narrows.
		const fault: AppError = {
			category: 'Persistence',
			code: 'vault.unexpected-failure',
			message: 'developer english',
		};
		const { field, notify } = harness(err(fault));

		field.onInput(-5);
		await field.onCommit();

		expect(notify).toHaveBeenCalledWith(fault);
		// The ORIGINAL error, not a resolved string: the caller's door owns the copy.
		expect(field.error.value).toBeNull();
		// Still kept, for the same reason a refused draft is: the user's typing is not the
		// vault's fault and retyping it is not a fix.
		expect(field.draft.value).toBe(-5);
	});

	it('does not reach the notice door for a refusal this field CAN show', async () => {
		const { field, notify } = harness(err(validation('requirement.negative-quantity')));

		field.onInput(-5);
		await field.onCommit();

		// Both doors for one failure is the double-report `commitEdit`'s narrowing exists to
		// prevent: a message under the input AND a notice about the same press.
		expect(notify).not.toHaveBeenCalled();
		expect(field.error.value).toBe('copy for requirement.negative-quantity');
	});

	it('retires the message when the user corrects the value, dispatching nothing', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));
		field.onInput(-5);
		await field.onCommit();

		field.onInput(5);

		// BOTH halves: onInput's own job, and its side effect.
		expect(field.draft.value).toBe(5);
		expect(field.error.value).toBeNull();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('discards the draft and clears the error on cancel, dispatching nothing', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));
		field.onInput(-5);
		await field.onCommit();

		field.onCancel();

		expect(field.draft.value).toBe(10);
		expect(field.error.value).toBeNull();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('does not discard a keystroke that landed while the write was in flight', async () => {
		// A slow vault write with the user still typing. The success belongs to the OLD draft;
		// clearing unconditionally replaced the newer text with the canonical value mid-word,
		// with nothing erroring and no way for the user to tell it had happened.
		let settle = (): void => {};
		const run = vi.fn(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: () => ({ execute: async () => ok(undefined), undo: async () => ok(undefined) }),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn(),
		});

		field.onInput(-5);
		const inFlight = field.onCommit();
		expect(field.pending.value).toBe(true);
		field.onInput(-7);
		settle();
		await inFlight;

		expect(field.draft.value).toBe(-7);
		expect(field.pending.value).toBe(false);
	});

	it('coalesces repeated commit gestures into one follow-up dispatch', async () => {
		// The control stays enabled (Task 9), so three blurs during one slow write are
		// ordinary. `CommandHistory` serializes them but still executes and RECORDS each, so
		// without coalescing one edit leaves three undo entries.
		const settles: (() => void)[] = [];
		const run = vi.fn(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settles.push(() => { resolve(ok(undefined)); });
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: (value) => ({
				execute: async () => ok(undefined),
				undo: async () => ok(undefined),
				value,
			}),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn(),
		});

		field.onInput(-5);
		const first = field.onCommit();
		field.onInput(-6);
		void field.onCommit();
		field.onInput(-7);
		void field.onCommit();
		expect(run).toHaveBeenCalledTimes(1);

		settles[0]();
		await first;

		// Two dispatches for three gestures: the original, then ONE carrying the latest draft.
		expect(run).toHaveBeenCalledTimes(2);
		expect(field.pending.value).toBe(true);
	});

	it('does not re-dispatch when the draft never moved', async () => {
		// Two blurs with no edit between them are one edit. A second identical dispatch would
		// buy an undo entry that undoes nothing visible.
		let settle = (): void => {};
		const run = vi.fn(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: () => ({ execute: async () => ok(undefined), undo: async () => ok(undefined) }),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn(),
		});

		field.onInput(-5);
		const inFlight = field.onCommit();
		void field.onCommit();
		settle();
		await inFlight;

		expect(run).toHaveBeenCalledTimes(1);
		// And the flag is honest once nothing is outstanding — the defect was the FIRST
		// call's finally clearing it while a later one was still queued.
		expect(field.pending.value).toBe(false);
	});

	it('tracks a new canonical value after an accepted commit', async () => {
		const { field, canonical } = harness(ok(undefined));
		field.onInput(20);
		await field.onCommit();

		// The DTO refresh that follows a successful write.
		canonical.value = 20;

		expect(field.draft.value).toBe(20);
		expect(field.error.value).toBeNull();
	});

	it('routes an unmapped code to no field, leaving error null for the caller to notice', async () => {
		// The Inspector has no banner region, so a banner-routed error is `commitEdit`'s to
		// notify. This composable's contract is that it does not invent a field error for one.
		const { field } = harness(err(validation('vault.unexpected-failure')));
		field.onInput(1);
		await field.onCommit();

		expect(field.error.value).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/composables/useFieldCommit.test.ts`
Expected: FAIL — cannot resolve `use-field-commit`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/composables/use-field-commit.ts`:

```typescript
import { computed, readonly, ref, toValue, type DeepReadonly, type MaybeRefOrGetter, type Ref } from 'vue';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import { routeError, type FieldErrorMap } from '../errors/route-error';

/** What `CommandHistory.run` takes: anything with the two halves of a reversible write. */
interface RunnableCommand {
	execute(): Promise<Result<void, AppError>>;
	undo(): Promise<Result<void, AppError>>;
}

/**
 * One Inspector field's draft, error and pending state.
 *
 * The commit boundary is blur/enter rather than a form submit — the ONLY thing that differs
 * from `useFormCommit`. Same `routeError`, same rendering pair, same rule that the named
 * methods are the only write paths.
 *
 * `onInput` clears `error` for exactly the reason `useFormCommit.setField` does: a rejected
 * commit's message must not outlive the user correcting the value it is about.
 */
export interface UseFieldCommit<T> {
	readonly draft: DeepReadonly<Ref<T>>;
	readonly error: Readonly<Ref<string | null>>;
	readonly pending: Readonly<Ref<boolean>>;
	/** Draft only — per slice 6 a keystroke never dispatches. It also clears `error`. */
	onInput(value: T): void;
	/** blur/enter — exactly one command dispatch. */
	onCommit(): Promise<void>;
	/** Escape — discard the draft, clear the error, resync to canonical. Dispatches nothing. */
	onCancel(): void;
}

export function useFieldCommit<T, TInput>(options: {
	readonly canonicalValue: MaybeRefOrGetter<T>;
	readonly buildCommand: (value: T) => RunnableCommand;
	readonly history: { run(command: RunnableCommand): Promise<Result<void, AppError>> };
	readonly errorMap: FieldErrorMap<TInput>;
	readonly field: keyof TInput;
	readonly toUserMessage: (error: AppError) => string;
	/**
	 * Where a refusal this field cannot show goes instead — the ORIGINAL `AppError`, not a
	 * resolved string, so the caller's own door decides the copy.
	 *
	 * **Required, and it is the one option that must not be optional.** This composable
	 * converts every banner-routed failure to `error = null`, because the Inspector has no
	 * banner region to put one in. Without a second door that is not "show it elsewhere", it
	 * is "show it nowhere": a resolved vault failure during an override would produce no
	 * inline error AND no notice, which is strictly worse than the `notifyError` call in
	 * `commitEdit` that this slice narrows. Optional with a `?? noop` default, the forgetting
	 * call site is silent and nothing anywhere errors — the exact shape this repository keeps
	 * paying for. So it is required and every caller states its door.
	 */
	readonly notify: (error: AppError) => void;
	/**
	 * A draft this field cannot even turn into a command — text where a number belongs, a
	 * malformed monetary literal. Returns a resolved message, or `null` when the draft is
	 * convertible.
	 *
	 * It lives HERE rather than at each call site on purpose. A guard at a call site is a
	 * second copy of a rule, and two copies disagree: with the check outside, every caller
	 * has to remember it, a caller that forgets dispatches an unconvertible draft, and
	 * nothing anywhere errors. Inside, every caller calls `onCommit` unconditionally and
	 * cannot get it wrong.
	 */
	readonly validate?: (draft: T) => string | null;
}): UseFieldCommit<T> {
	/**
	 * `null` means "clean": the field shows the canonical value and holds no draft of its
	 * own. A sentinel rather than seeding the draft with the canonical value, because those
	 * two states differ — a clean field must TRACK a canonical value that changes underneath
	 * it (the DTO refresh after a successful write), and a seeded draft would pin it.
	 */
	const drafted = ref<{ readonly value: T } | null>(null);
	const error = ref<string | null>(null);
	const pending = ref(false);

	// The coalescing state. Deliberately plain `let`s and not refs: nothing renders them,
	// and `pending` is the one piece of this a template may read.
	let inFlight = false;
	let recommit = false;
	let lastCommitted: { readonly value: T } | null = null;

	const draft = computed(() => drafted.value?.value ?? toValue(options.canonicalValue));

	function onInput(value: T): void {
		drafted.value = { value };
		error.value = null;
	}

	function onCancel(): void {
		drafted.value = null;
		error.value = null;
	}

	async function onCommit(): Promise<void> {
		// A second commit gesture while the first is still in flight is COALESCED, not
		// dropped and not dispatched beside it. Task 9 leaves the control enabled on
		// purpose, so a user can blur, click back in, retype and blur again before a slow
		// vault write settles — and every one of those calls would otherwise start its own
		// `history.run`. `CommandHistory` serializes them, so they cannot interleave, but it
		// still EXECUTES and RECORDS each: N blurs become N undo entries for one edit, and
		// the first call's `finally` clears `pending` while a later one is still queued, so
		// the flag stops describing the field.
		//
		// Dropping the extra call instead — what `useFormCommit.submit` correctly does — is
		// wrong HERE, and the asymmetry is the same one as the disable question: a repeated
		// SUBMIT is one intent pressed twice, so the second is redundant, while a repeated
		// FIELD commit carries a value the user has since changed, so dropping it discards
		// the edit. Remember that it was asked for, and honour it once the write settles.
		if (inFlight) {
			recommit = true;
			return;
		}
		inFlight = true;
		pending.value = true;
		try {
			do {
				recommit = false;
				// Validated INSIDE the loop, once per dispatch, because a queued gesture
				// carries a draft nobody has checked. A version of this validated once at
				// the top and returned early on an invalid draft WITHOUT clearing `recommit`
				// — so a valid commit, then malformed text, then a blur, left the flag set
				// and the loop dispatched the malformed draft the moment the first write
				// settled, straight into the throwing `moneyOf` this seam exists to keep it
				// away from. One rule, one place, every iteration.
				const invalid = options.validate?.(draft.value) ?? null;
				if (invalid !== null) {
					// This field's own refusal: no command to produce it, and no `AppError`
					// for `routeError` to place.
					error.value = invalid;
					break;
				}
				await dispatchOnce();
				// Only if the draft actually MOVED, and `!== null` is half of that test
				// rather than a defensive extra: a SUCCESSFUL dispatch clears `drafted` to
				// null, and `null !== lastCommitted` is true — so without it, two blurs with
				// no edit between them re-dispatched the canonical value, bought a second
				// undo entry, and could overwrite the edit just accepted if the refresh had
				// not landed. Null here means the field is clean and showing canonical,
				// which is precisely nothing to re-send.
			} while (recommit && drafted.value !== null && drafted.value !== lastCommitted);
		} finally {
			inFlight = false;
			pending.value = false;
		}
	}

	/**
	 * One dispatch and its outcome. Split out of `onCommit` so the coalescing loop above
	 * reads as the one thing it is; every rule below is unchanged from the single-dispatch
	 * version.
	 */
	async function dispatchOnce(): Promise<void> {
		// The exact draft this dispatch is about. `onInput` mints a FRESH wrapper object per
		// keystroke, so reference identity answers "is the field still showing what I sent"
		// with no value comparison and no equality rule per `T` — which is the second reason
		// the clean sentinel is a wrapper rather than a bare value.
		const submitted = drafted.value;
		lastCommitted = submitted;
		const result = await options.history.run(options.buildCommand(draft.value));
		if (!isErr(result)) {
			// Accepted: drop the draft so the field tracks the refreshed canonical value —
			// but ONLY the draft that was actually submitted. A slow vault write with the
			// user still typing would otherwise clear a NEWER draft and silently replace
			// their text with the canonical value, mid-word, with nothing erroring.
			if (drafted.value === submitted) {
				drafted.value = null;
				error.value = null;
			}
			return;
		}
		const routed = routeError(result.error, options.errorMap, options.toUserMessage);
		// A banner-routed error is not this field's to DISPLAY — the Inspector has no
		// banner region, and inventing a field error for one would attach a message to an
		// input the failure is not about. It is still this field's to REPORT, which is the
		// half a first draft dropped: it cleared the error and called nothing, so a
		// resolved vault failure reached the user through neither door.
		const mine = routed.kind === 'field' && routed.fields.includes(options.field);
		// Same staleness rule on the failure arm, for the mirror reason: a message about a
		// value the user has already replaced is telling them their current text is wrong
		// when it has never been dispatched. The NOTICE still fires either way — the write
		// really did fail, and that is true of the vault regardless of what the input now
		// holds.
		if (drafted.value === submitted) error.value = mine ? routed.message : null;
		if (!mine) options.notify(result.error);
	}

	return {
		draft: draft as DeepReadonly<Ref<T>>,
		error: readonly(error),
		pending: readonly(pending),
		onInput,
		onCommit,
		onCancel,
	};
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/presentation/composables/useFieldCommit.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the gate**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/presentation/composables/use-field-commit.ts tests/presentation/composables/useFieldCommit.test.ts
git commit -m "feat: useFieldCommit, the Inspector's blur boundary keeps a rejected draft"
```

---

### Task 5: The seam — a command bundle for the project view

**Files:**
- Create: `src/presentation/views/renovationProjectCommands.ts`
- Create: `src/infrastructure/obsidian/workspace/openNote.ts`
- Modify: `src/presentation/views/RenovationProjectContext.ts`
- Modify: `src/plugin/guardedServices.ts`
- Modify: `src/plugin/composition-root.ts` (`renovationProjectDeps`)
- Test: `tests/plugin/renovationProjectCommandWiring.test.ts`

**Interfaces:**
- Consumes: `CreateProjectCommand` / `CreateProjectInput` from `src/application/commands/project/CreateProject.ts`; `guardCommand` from `src/application/errors/guardAgainstThrowing.ts`.
- Produces: `RenovationProjectCommandServices` with `createProject: Command<CreateProjectInput, Result<{ project: Loaded<Project> }, RepositoryError>>`; `unavailableRenovationProjectCommands(): RenovationProjectCommandServices`; `RenovationProjectDeps` gaining `commands: RenovationProjectCommandServices` and `openProject: (projectId: string) => Promise<void>`. Tasks 6 and 8 consume both.

Mirror `src/presentation/editor/planEditorCommands.ts` exactly — including its `persistenceFailure()` shape (`category: 'Persistence'`, `code: 'settings.unrecovered'`), so a refusal here reads identically to every other write in an unrecovered session.

**The refusal bundle is the honest stand-in here**, and that is worth checking rather than assuming: slice 18's Testing section records the opposite case, where a refusal bundle handed to the browser harness refused a READ the fixture could answer and two shell regions silently contradicted each other. Every member of this bundle is a write, and a session with unrecovered settings genuinely cannot create a project's folder — the composition root's own comment names that exact door.

`openProject` lives in the deps rather than being derived in the view because `presentation/` may not reach Obsidian's vault, and a `ProjectSummaryDto` carries `id`, `name` and `status` — no path. The composition root knows both Obsidian and the index, which is the same reason `revealView` takes a view type as a string.

**It does not exist yet and this task BUILDS it.** A repository-wide search finds no `openProjectNote`, and nothing anywhere opens a note by path — `infrastructure/obsidian/workspace/reveal.ts` opens a VIEW, which is a different thing — while `renovationProjectDeps(root)` receives no `Workspace` at all. An earlier draft of this task called a service it had invented, which would have failed to compile at the first task that used it. Create it beside `reveal.ts`, where the workspace already lives:

```typescript
// src/infrastructure/obsidian/workspace/openNote.ts
/**
 * Opens the note a project's id resolves to.
 *
 * The path comes from the Project Index — the same lookup `getById` and `delete` take — and
 * never from a convention: since ADR-0013 a project's folder is wherever its note currently
 * sits, and the file is not reliably named `Project.md`.
 *
 * Silent when the id resolves to nothing. That is not a swallowed error: the only way to hold
 * a stale id here is a note deleted since the list was read, and the list is re-read on the
 * next hydrate anyway. A notice would describe a race the user cannot act on.
 */
export async function openProjectNote(
	deps: { readonly workspace: Workspace; readonly vault: Vault; readonly index: ProjectIndex },
	projectId: string,
): Promise<void> {
	const path = deps.index.pathOf(projectId);
	if (path === null) return;
	const file = deps.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return;
	await deps.workspace.getLeaf('tab').openFile(file);
}
```

**Read `ProjectIndex` for its real "path of this entity" member before writing `pathOf`** — use what the port already exposes rather than widening it for this. Then thread `workspace`, `vault` and the index into `renovationProjectDeps`, which takes only `root` today: give it the shape `planEditorDeps` already has, since that one receives both.

Test all three arms in `tests/infrastructure/obsidian/workspace/`: a resolved id opens the file, an unresolvable id opens nothing, and a path resolving to a folder rather than a file opens nothing. `FakeVault.getAbstractFileByPath` answers a `TFolder` for a folder since slice 18, so the third arm is drivable.

- [ ] **Step 1: Write the failing test**

Create `tests/plugin/renovationProjectCommandWiring.test.ts`:

```typescript
/**
 * What tells a composition that wires the project view's write side from one that does not.
 *
 * Slice 10's `slice10CascadeWiring.test.ts` is the pattern: a collaborator that is built,
 * tested and passed by nothing is a collaborator that reaches nobody.
 */
import { describe, expect, it } from 'vitest';
import { unavailableRenovationProjectCommands } from '../../src/presentation/views/renovationProjectCommands';
import { isErr } from '../../src/core/result/Result';

describe('unavailableRenovationProjectCommands', () => {
	it('refuses createProject with the same settings.unrecovered shape every other write uses', async () => {
		const commands = unavailableRenovationProjectCommands();

		const result = await commands.createProject.execute({ name: 'Kitchen' });

		expect(isErr(result)).toBe(true);
		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		expect(isErr(result) && result.error.category).toBe('Persistence');
	});

	it('resolves a failed Result rather than throwing', async () => {
		const commands = unavailableRenovationProjectCommands();

		// A refusal, never a rejection: the whole point of the boundary.
		await expect(commands.createProject.execute({ name: '' })).resolves.toBeDefined();
	});
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/plugin/renovationProjectCommandWiring.test.ts`
Expected: FAIL — cannot resolve `renovationProjectCommands`.

- [ ] **Step 3: Write the bundle**

Create `src/presentation/views/renovationProjectCommands.ts`:

```typescript
import { err, type Result } from '../../core/result/Result';
import type { PersistenceError } from '../../core/errors/AppError';
import type { Command } from '../../application/commands/Command';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Loaded } from '../../application/ports/versioning';
import type { Project } from '../../domain/project/Project';

type CreateProjectResult = Result<{ project: Loaded<Project> }, RepositoryError>;

/**
 * The write side of the Renovation Project view — the mirror of
 * `RenovationProjectQueryServices`, and the same bargain `PlanEditorCommandServices` makes:
 * application-layer interfaces handed to presentation, composed and GUARDED at the root,
 * never a repository the view built.
 *
 * Typed structurally (`Command<I, Result<T, E>>`) rather than as the concrete class, because
 * what leaves the root is a `guardCommand` wrapper with the same `execute` — a field typed as
 * the class would be a lie the compiler would then have to be argued out of.
 */
export interface RenovationProjectCommandServices {
	readonly createProject: Command<CreateProjectInput, CreateProjectResult>;
}

function persistenceFailure(): PersistenceError {
	return {
		category: 'Persistence',
		code: 'settings.unrecovered',
		message: 'Settings could not be read, so nothing can be written.',
	};
}

/**
 * The write side for a session whose settings could not be recovered.
 *
 * A refusal bundle is the honest stand-in ONLY where the real thing would also have nothing
 * to give, and that holds here: every member is a write, and without the settings there is no
 * default projects root under which `freshProjectFolder` could place a new project's folder.
 * The composition root's own comment names this exact door as the reason it composes no stack
 * at all in that state.
 */
export function unavailableRenovationProjectCommands(): RenovationProjectCommandServices {
	return {
		createProject: {
			execute(): Promise<CreateProjectResult> {
				return Promise.resolve(err(persistenceFailure()) as CreateProjectResult);
			},
		},
	};
}
```

- [ ] **Step 4: Widen the context**

In `src/presentation/views/RenovationProjectContext.ts`, extend the interface. Keep the existing docblock and add to it:

```typescript
export interface RenovationProjectDeps {
	readonly queries: RenovationProjectQueryServices;
	/** Design slice 16's write side — guarded at the root, refusing when settings are unrecovered. */
	readonly commands: RenovationProjectCommandServices;
	/**
	 * Opens a project's own note. It lives here rather than being derived in the view because
	 * `presentation/` may not reach Obsidian's vault and a `ProjectSummaryDto` carries no
	 * path — only `id`, `name` and `status`. The composition root knows both the workspace and
	 * the index, which is the same reason `revealView` takes a view type as a string.
	 */
	readonly openProject: (projectId: string) => Promise<void>;
}
```

- [ ] **Step 5: Guard the command and compose the bundle**

In `src/plugin/guardedServices.ts`, follow the file's own two stated rules: type the guarded service structurally, and compute each `guardCommand` call as a LOCAL `const` first so `E` infers from the command rather than from the target field. Give it its own event name (e.g. `'create-project'`) so a log line names the boundary it crossed.

In `src/plugin/composition-root.ts`, extend `renovationProjectDeps`:

```typescript
export function renovationProjectDeps(root: CompositionRoot): RenovationProjectDeps {
	const persistence = root.persistence;
	return {
		queries: persistence
			? createRenovationProjectQueries(persistence.listProjects)
			: unavailableRenovationProjectQueries(),
		commands: persistence
			? { createProject: persistence.createProject }
			: unavailableRenovationProjectCommands(),
		openProject: persistence
			? (projectId) => openProjectNote({ workspace, vault, index: persistence.index }, projectId)
			: () => Promise.resolve(),
	};
}
```

When settings are unrecovered there is no index, so the no-op is correct rather than lazy: there is no note to open, and nothing to tell the user that the list — empty for the same reason — has not already told them.

- [ ] **Step 6: Run the tests and the gate**

Run: `npx vitest run tests/plugin/renovationProjectCommandWiring.test.ts`
Expected: PASS, 2 tests.

Run: `npm run check`
Expected: pass. Existing tests that construct `RenovationProjectDeps` will fail to compile until they supply the two new members — fix each by adding the refusal bundle and a no-op `openProject`, not by making the fields optional.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/views/renovationProjectCommands.ts src/presentation/views/RenovationProjectContext.ts \
        src/infrastructure/obsidian/workspace/openNote.ts \
        src/plugin/guardedServices.ts src/plugin/composition-root.ts src/plugin/RenovationPlannerPlugin.ts \
        tests/
git commit -m "feat: the project view gets a guarded write side and a way to open a note"
```

---

### Task 5a: The three form fields the vault actually keeps

**Files:**
- Modify: `src/infrastructure/persistence/dto/projectFrontmatter.ts`
- Modify: `src/infrastructure/persistence/mappers/projectMapper.ts`
- Test: `tests/infrastructure/persistence/mappers/projectMapper.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks — this is persistence, below every layer this slice otherwise touches.
- Produces: a `Project` round-trip that preserves `description`, `start` and `targetCompletion`. Task 6's form depends on it; without it three of its five controls are decoration.

**Why this task exists, and why it was nearly not written.** `projectToPersistence` writes `type`, `schema-version`, `id`, `revision`, `name` and `status`; `fromDto` reconstructs `id`, `name` and `status`. Everything else a `Project` holds is dropped at the vault boundary. So a form collecting `description`, `start` and `targetCompletion` would appear to succeed, and all three would be `null` the next time the note was read.

The spec REFUSED `Money` on exactly this ground — "a form that collected a currency the domain drops would be a control that does nothing, which is the failure mode slice 14's Amendment 1 exists to refuse" — and then admitted three fields the *persistence layer* drops. Same rule, one layer down, missed because the spec checked the domain and stopped there. **When asking "can this field survive", follow it to the bytes, not to the first layer that accepts it.**

**No version bump and no migration**, and this is a measurement rather than a preference: `AssetFrontmatterSchemaV1` already carries `supplier`, `sku` and `notes` as `z.string().nullable().catch(null)`, and `.catch(null)` is what makes an absent key parse cleanly — so an existing v1 project note, written before these keys existed, reads back exactly as it does today. Adding a nullable key to a v1 schema is the established additive change here; bumping to v2 would demand a migration step for a set of notes that need no rewriting.

**Dates are the one part that is not a copy of the Asset pattern.** `Requirement.requiredDate` is a `string` in the DOMAIN, so its mapper moves it across unchanged. `Project.start` and `Project.targetCompletion` are real `Date` objects, so this mapper converts in both directions — and that conversion has a defect class in it worth more than the code:

- **Store date-only (`YYYY-MM-DD`), not a full ISO timestamp.** The form's controls are `<input type="date">`, which has no time to give; a stored `T00:00:00.000Z` would be invented precision, and it is what a user hand-editing frontmatter has to read.
- **Serialize and parse in UTC, consistently, or the day shifts.** `new Date('2026-08-28')` is UTC midnight; `new Date('2026-08-28T00:00:00')` is LOCAL midnight, and `.toISOString().slice(0, 10)` on the latter yields `2026-08-27` anywhere west of Greenwich. Read with ``new Date(`${value}T00:00:00Z`)`` and write with `.toISOString().slice(0, 10)`, and Task 6's form builds its `Date` the same way. A test that runs only in UTC cannot see this: pin `TZ` or construct the Date explicitly rather than trusting the runner's zone.
- **A malformed stored date must fail the schema, and a SHAPE check is not that.** The obvious guard is `.regex(/^\d{4}-\d{2}-\d{2}$/)`, and it is the instrument this repository warns about: it sees the shape and answers as if it had seen the validity. Measured with node rather than reasoned about, because the two failure modes do not behave alike:

  | Stored value | Passes the regex | `new Date(v + 'T00:00:00Z')` |
  |---|---|---|
  | `2026-08-28` | yes | valid, round-trips |
  | `yesterday` | **no** | never reached |
  | `2026-99-99` | **yes** | `Invalid Date` |
  | `2026-13-01`, `2026-00-10` | **yes** | `Invalid Date` |
  | `2026-02-30` | **yes** | **silently becomes `2026-03-02`** |
  | `2026-04-31` | **yes** | **silently becomes `2026-05-01`** |

  Two distinct defects behind one regex. An `Invalid Date` has a `NaN` timestamp, and every comparison against `NaN` is false — so it flows into `Project.create`'s `targetCompletion < start` check and answers "fine" to any pair, and a later `.toISOString()` on it throws a `RangeError` rather than returning anything. A NORMALIZED date is worse for being quiet: nothing fails anywhere and the user's February 30th is stored, read and displayed as March 2nd.

  One predicate closes both, and it is the round trip rather than a longer regex — a regex that knew about leap years would be a second, hand-written definition of the calendar:

```typescript
/**
 * A real calendar date, not merely a date-SHAPED string.
 *
 * The finite check runs first and is load-bearing: `toISOString()` on an `Invalid Date`
 * throws a `RangeError`, so a predicate that round-tripped first would fault on exactly the
 * input it exists to reject. The round trip then catches the quiet half — `2026-02-30`
 * parses happily and comes back as `2026-03-02`, so a value that fails to equal itself is
 * one the calendar renamed.
 */
function isRealCalendarDate(value: string): boolean {
	const parsed = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
```

  Declared ONCE and used for both keys — two copies of a calendar rule is how one key later accepts what the other refuses.

- [ ] **Step 1: Write the failing test**

The round trip is the assertion, because a one-directional test is exactly what let this ship: `projectToPersistence` was covered, `fromDto` was covered, and neither was asked whether what went in came back.

```typescript
/**
 * What a Project note keeps. The three fields added here were droppable for five slices
 * because no test ever wrote one and read it back — each mapper direction was asserted
 * against a literal, so both agreed about a field neither carried.
 */
it('preserves description, start and targetCompletion across a round trip', () => {
	const created = Project.create({
		id: 'p1' as ProjectId,
		name: 'Kitchen',
		description: 'Full refit',
		start: new Date('2026-03-01T00:00:00Z'),
		targetCompletion: new Date('2026-09-30T00:00:00Z'),
	});
	assert(created.ok);

	const raw = projectToPersistence(created.value, 1);
	const back = projectFromPersistence(raw);

	assert(back.ok);
	expect(back.value.description).toBe('Full refit');
	expect(back.value.start?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
	expect(back.value.targetCompletion?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
});

it('writes a date-only string rather than a timestamp', () => {
	// What a user hand-editing frontmatter reads, and what `<input type="date">` round-trips.
	const created = Project.create({
		id: 'p1' as ProjectId,
		name: 'Kitchen',
		start: new Date('2026-03-01T00:00:00Z'),
	});
	assert(created.ok);

	expect(projectToPersistence(created.value, 1)['start']).toBe('2026-03-01');
});

it.each([
	// Wrong shape — the only one a regex alone would have caught.
	'yesterday',
	// Shape-valid, unparseable: `getTime()` is NaN, every comparison against NaN is false,
	// so `targetCompletion < start` answers "fine" for any pair — and `.toISOString()` on it
	// throws a RangeError rather than returning a string.
	'2026-99-99',
	'2026-13-01',
	'2026-00-10',
	// Shape-valid and QUIETLY WRONG, which is the worse half: these parse, nothing fails
	// anywhere, and the user's February 30th is stored and displayed as March 2nd.
	'2026-02-30',
	'2026-04-31',
])('reads %s as absent rather than as a date', (stored) => {
	const raw = { ...VALID_PROJECT_FRONTMATTER, start: stored };

	const back = projectFromPersistence(raw);

	assert(back.ok);
	expect(back.value.start).toBeNull();
});

it('keeps a real calendar date, including a leap day', () => {
	// The guard must not be so eager it refuses valid dates: 2028 is a leap year, and a
	// hand-written regex clever enough to reject 2026-02-30 usually rejects this too.
	const raw = { ...VALID_PROJECT_FRONTMATTER, start: '2028-02-29' };

	const back = projectFromPersistence(raw);

	assert(back.ok);
	expect(back.value.start?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
});

it('reads a note written before these keys existed', () => {
	// `.catch(null)` is what makes this additive rather than a migration. Without it, every
	// project note in every existing vault fails to parse.
	const back = projectFromPersistence(VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS);

	assert(back.ok);
	expect(back.value.description).toBeNull();
	expect(back.value.start).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/infrastructure/persistence/mappers/projectMapper.test.ts`
Expected: FAIL — the first two cases, plus every row of the malformed-date table except `yesterday` (a regex-only guard already refuses that one, which is exactly why `yesterday` alone was too weak a test to write). The leap-day case and the written-before-these-keys case both pass already and are REGRESSION guards rather than new requirements: the first fails if someone replaces the round trip with a cleverer regex, the second if someone drops `.catch(null)`.

- [ ] **Step 3: Add the three keys to the schema**

```typescript
	name: z.string(),
	status: kebabEnum(PROJECT_STATUSES),
	description: z.string().nullable().catch(null),
	start: DATE_ONLY,
	'target-completion': DATE_ONLY,
```

with `DATE_ONLY` declared once above them:

```typescript
/**
 * A stored date-only value, or absent. `.catch(null)` runs LAST and catches the refinement
 * as well as the regex, so every rejected spelling — wrong shape, impossible date, renamed
 * date — reads as absent rather than as a parse failure that would refuse the whole note.
 */
const DATE_ONLY = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine(isRealCalendarDate)
	.nullable()
	.catch(null);
```

Kebab-case for the two-word key, as `background-page`, `unit-cost` and `required-date` already are; `description` and `start` are single words and stay as they are.

- [ ] **Step 4: Carry them through both mapper directions**

Write one `toDateOnly` / `fromDateOnly` pair in the mapper rather than spelling `.toISOString().slice(0, 10)` at two call sites: the UTC rule above is one rule, and two hand-written copies of it are how one direction later drifts a day from the other.

- [ ] **Step 5: Run the gate**

Run: `npm run check`

Watch the branch floor especially: this task adds several arms (three nullable keys, two directions, the malformed-date path) and the plan's Global Constraints put branch headroom at roughly two covered branches. Every arm above has a case in Step 1 — that is why they are written together.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/persistence/dto/projectFrontmatter.ts src/infrastructure/persistence/mappers/projectMapper.ts tests/
git commit -m "feat: a project note keeps its description and its two dates"
```

---

### Task 6: `NewProjectForm.vue` — the creation dialog

**Files:**
- Create: `src/presentation/views/NewProjectForm.vue`
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/dialogs/dialog-store.ts` (`FormDescriptor.busy`, and `FormDialogResult`'s docblock)
- Modify: `src/presentation/dialogs/DialogHost.vue`, `src/presentation/dialogs/FormDialog.vue` (honour `busy`)
- Test: `tests/presentation/views/newProjectForm.test.ts`, `tests/presentation/dialogs/formBusy.test.ts`

**Interfaces:**
- Consumes: `useFormCommit` (Task 3), `FieldError` / `FormBanner` (Task 2), `RenovationProjectCommandServices` (Task 5), `FormDescriptor` from `src/presentation/dialogs/dialog-store.ts`. **And Task 5a, which is not an import but is load-bearing:** without it `description`, `start` and `targetCompletion` are dropped at the vault boundary, so three of this form's five controls collect values that read back `null`. Do not build this task before 5a has landed.
- Produces: a component taking props `{ dispatch: (input: CreateProjectInput) => Promise<Result<{ project: Loaded<Project> }, RepositoryError>> }` and emitting `submit: [values: CreateProjectInput]`. Task 7 opens it.

**Every control is disabled while `submitting` is true, and the asymmetry with Task 9 is deliberate.** `submit` reads `values.value` once at dispatch; `setField` replaces the ref with a new object — so an edit landing during a slow write is not in the dispatched input, and the success closes the dialog as if it were. The user's newer text leaves with the dialog and there is no surface left to show it on.

The Task 4 field commit closes the same race by KEEPING the newer draft instead, and the two answers differ because the two gestures do: a submit is an explicit press on a form the user is looking at, so a form that visibly goes busy is what they already expect; a blur commit fires exactly when their attention has moved on, so freezing that control takes keystrokes away mid-word somewhere else. Same defect, opposite remedy, and the reason is the gesture rather than taste.

Bind `:disabled="submitting"` on every input, the select, the textarea and the submit button — the same `busy` flag the descriptor already hands `DialogHost` for Cancel and Escape, so one state governs the whole dialog rather than two thirds of it. Assert it: with a dispatch left pending, the name input is disabled, and a `setField` attempted during the write does not change what `dispatch` received.

**A form is a COMPONENT, not a new dialog kind.** `FormDescriptor` already carries `component` and `props`, so none of slice 15's five-edit ceremony applies. The form lives in `views/` and not in `presentation/dialogs/`, because that directory holds no field knowledge and a lint block keeps it that way — the same reason `KnownDistanceForm.vue` lives with the editor.

**Fields:** `name` (text), `status` (select), `description` (textarea), `start` and `targetCompletion` (dates). Money and location are excluded — see the spec's decision 2, and the `project.negative-amount` gap it records.

**The error map, read from `Project.create` rather than invented:**

```typescript
const NEW_PROJECT_ERRORS: FieldErrorMap<CreateProjectInput> = {
	'project.empty-name': 'name',
	'project.unknown-status': 'status',
	'project.target-before-start': ['start', 'targetCompletion'],
	// 'project.negative-amount' has NO entry and needs none: this form has no Money field.
	// It is also unroutable as things stand — one code for both `budget` and `contingency`,
	// with the field named only in the developer-English `message`. Whichever slice first
	// puts a Money field on a form owns splitting it or routing it to the banner.
	// A PersistenceError from `save` has no entry either, deliberately: it is about the
	// vault, not about a field.
};
```

- [ ] **Step 1: Add the locale keys**

To `src/presentation/i18n/locales/en.ts`, before the closing `} as const;`:

```typescript
'form.new-project.title': 'New renovation project',
'form.new-project.name': 'Name',
'form.new-project.status': 'Status',
'form.new-project.description': 'Description',
'form.new-project.start': 'Start',
'form.new-project.target-completion': 'Target completion',
'empty.project.no-projects.action': 'Create a project',
'view.project.list-title': 'Renovation projects',
'view.project.create': 'New project',
'error.project.empty-name': 'A project needs a name.',
'error.project.unknown-status': 'Choose a status from the list.',
'error.project.target-before-start': 'Target completion must be on or after the start date.',
```

To `de.ts`, the same keys. **An Asset is `Objekt`, never `Material`**, and *Vault* stays untranslated — both are pinned by `strings.test.ts`. Proofread the German by reading it: nothing in any gate checks its spelling or grammar, and slice 14 shipped `Tresnornder` and a noun given two different genders at two keys precisely because nothing rendered `de.ts`.

Bind each `error.*` key to its raise site in `toUserMessage.test.ts` using a table copied from the RAISE SITES in `src/domain/project/Project.ts`, never from `en.ts` — a table derived from the locale file would agree with a typo.

- [ ] **Step 2: Write the failing test**

Create `tests/presentation/views/newProjectForm.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The end-to-end form behaviour, asserted on the COMMAND INPUT and on spies rather than on
 * "a dialog opened" — slice 10's rule, because a dialog opening is equally true of a caller
 * that dispatched something else entirely.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import { err, ok } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

function projectError(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

describe('NewProjectForm', () => {
	it('sends exactly the typed values to the command, once', async () => {
		const dispatch = vi.fn(async () => ok({ project: { entity: { id: 'p1' } } }));
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen' });
	});

	it('emits submit only after the write succeeded', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: async () => ok({ project: { entity: { id: 'p1' } } }) },
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	it('keeps the typed value, renders the error under its own field, and does NOT emit submit', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: async () => err(projectError('project.empty-name')) },
		});

		await wrapper.get('input[data-field="name"]').setValue('   ');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		// The dialog stays open: nothing emitted for the host to close on.
		expect(wrapper.emitted('submit')).toBeUndefined();
		// The rejected value survives — this is the point of the case.
		expect((wrapper.get('input[data-field="name"]').element as HTMLInputElement).value).toBe('   ');
		const invalid = wrapper.get('input[data-field="name"]');
		expect(invalid.attributes('aria-invalid')).toBe('true');
	});

	it('puts a two-field error under BOTH of its fields', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: async () => err(projectError('project.target-before-start')) },
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.get('input[data-field="start"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('input[data-field="targetCompletion"]').attributes('aria-invalid')).toBe('true');
	});

	it('puts a vault failure in the banner and under no field', async () => {
		const wrapper = mount(NewProjectForm, {
			props: {
				dispatch: async () =>
					err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'dev' } as AppError),
			},
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.find('.rp-form-banner').exists()).toBe(true);
		expect(wrapper.get('input[data-field="name"]').attributes('aria-invalid')).toBeUndefined();
	});
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/presentation/views/newProjectForm.test.ts`
Expected: FAIL — cannot resolve `NewProjectForm.vue`.

- [ ] **Step 4: Write the component**

Build it from `useFormCommit` plus `<FieldError>` and `<FormBanner>`. The binding is
`:value` + `@input`, calling `setField` — **never `v-model`**, which assigns straight past
`setField` and would make the sole-write-path rule unenforceable. Each control carries a
id and ARIA pair from its own `<FieldError>`'s scoped slot — `v-slot="{ inputId, aria }"`,
then `<input :id="inputId" v-bind="aria" data-field="name">` with a `<label :for="inputId">`
beside it. Nothing hand-spells an id, so two views rendering this form cannot collide; the
`data-field` attribute is what tests address, since a minted id is not predictable. Resolve every label
through `tr(...)`, never a literal.

Emit `submit` only when `await form.submit()` resolves `true`. Do not close, reset, or clear
anything on `false`.

- [ ] **Step 5: Close the cancel-during-write hole (`busy`)**

**The finding, verified:** while `CreateProjectCommand` awaits its write, `FormDialog`'s Cancel and `DialogHost`'s `Escape` both resolve the dialog and unmount the form, and **neither cancels the command**. The write lands afterwards: the user is told the project was abandoned and gets one anyway. Measured — there is no `busy`, `pending` or `submitting` concept anywhere in `presentation/dialogs/`, so the host cannot know, because nothing tells it.

This widens slice 16 into slice 15's framework by exactly one optional field. That is a real cost and the smaller one: the alternative is a dialog kind owning a dispatch the container is forbidden to know is running.

In `dialog-store.ts`:

```typescript
export interface FormDescriptor {
	readonly kind: 'form';
	readonly title: string;
	readonly component: Component;
	readonly props?: Readonly<Record<string, unknown>>;
	/**
	 * True while the form has a write in flight. The framework does not START one — a form
	 * kind may own its dispatch (see `FormDialogResult`) — so this is the only way the
	 * container can learn that cancelling now would abandon a write it cannot stop.
	 *
	 * The form passes its own `useFormCommit().submitting` straight through, so there is no
	 * second flag to keep in step and the two cannot drift.
	 */
	readonly busy?: Readonly<Ref<boolean>>;
}
```

In `DialogHost.vue`'s `onKeydown`, return early on `Escape` while the current descriptor is a form whose `busy` is true. **Still call `preventDefault()`** — the key is handled here whether or not it acts, and letting it fall through to Obsidian's own keymap mid-write is a second surprise.

**Cancel goes `aria-disabled`, NOT `:disabled`, and this is an invariant of the framework rather than a preference.** `DialogHost` states it in its own comment: *"every one of the four kind components renders at least one focusable control (a Cancel/Close button, unconditionally; `dialogKinds.test.ts` proves that per kind)"*, and `focusableWithin()` is what the Tab trap walks. A `:disabled` button matches no focusable selector — so with Task 6 also disabling every form control, a busy dialog would contain **zero** focusable elements: Tab would walk straight out of it, and the `Escape` listener bound to `.rp-dialog` would then stop receiving keys altogether, defeating the very handler this step adds. `dialogKinds.test.ts` would not have caught it, because it does not drive the busy state.

So: `:aria-disabled="busy"` plus an early return in the click handler, which keeps the button focusable and announced while refusing the action. Add a case asserting `focusableWithin()` is non-empty while busy — the invariant, tested where this slice could break it.

Write the test first, in `tests/presentation/dialogs/`:

```typescript
	it('refuses Escape and disables Cancel while the form has a write in flight', async () => {
		const busy = ref(true);
		const store = useDialogStore();
		const settled = vi.fn();
		void store.openDialog({ kind: 'form', title: 'New project', component: NewProjectForm, busy }).then(settled);
		await flushPromises();

		await wrapper.get('.rp-dialog').trigger('keydown', { key: 'Escape' });
		await flushPromises();

		// The write is still running: the dialog may not resolve out from under it.
		expect(settled).not.toHaveBeenCalled();
		// aria-disabled, never disabled: a `:disabled` Cancel leaves the trap with nothing
		// to hold, Tab walks out of the dialog, and the Escape handler above stops being
		// reachable at all.
		expect(wrapper.get('.rp-dialog-cancel').attributes('aria-disabled')).toBe('true');
		expect(wrapper.get('.rp-dialog-cancel').attributes('disabled')).toBeUndefined();
	});

	it('accepts Escape again once the write has settled', async () => {
		const busy = ref(true);
		const store = useDialogStore();
		const settled = vi.fn();
		void store.openDialog({ kind: 'form', title: 'New project', component: NewProjectForm, busy }).then(settled);
		await flushPromises();
		busy.value = false;

		await wrapper.get('.rp-dialog').trigger('keydown', { key: 'Escape' });
		await flushPromises();

		// Decision 3 is NARROWED, not reversed: Escape still cancels at every other moment.
		expect(settled).toHaveBeenCalledWith('cancel');
	});
```

**The descriptor is built BEFORE the form exists, so the form cannot hand its flag back.** A first draft wrote `busy: newProjectBusy` in `ViewRoot` and declared it nowhere, while the only real flag was created privately inside `NewProjectForm` after `openDialog` had already been called — the fix read as wired and was connected to nothing, leaving Cancel and Escape live throughout the write.

**`ViewRoot` owns the ref and passes it INTO the form**, so one ref is observed at both ends:

```typescript
// ViewRoot.vue, beside onCreateProject.
const newProjectBusy = ref(false);
```

```typescript
// NewProjectForm.vue
const props = defineProps<{
	dispatch: (input: CreateProjectInput) => Promise<Result<{ project: Loaded<Project> }, RepositoryError>>;
	busy?: Ref<boolean>;
}>();

const form = useFormCommit<CreateProjectInput, { project: Loaded<Project> }>({ /* … */ });

// Written FROM the composable's own state, so there is no second flag to keep in step.
watchEffect(() => {
	if (props.busy) props.busy.value = form.submitting.value;
});
```

Assert the connection, not the intent: open the dialog, start a submit against a dispatch that never settles, fire `Escape`, and expect the dialog NOT to resolve. A test that merely checked `busy` was passed would have passed on the broken draft.

- [ ] **Step 6: Correct the dialog docblock**

In `src/presentation/dialogs/dialog-store.ts`, `FormDialogResult`'s comment says dispatching
is "still the caller's job". That is no longer true for every form, and the correction states
why rather than deleting the sentence:

```typescript
/**
 * `'submit'` means the form is DONE — not that the framework wrote anything.
 *
 * A form kind may own its own dispatch, and `NewProjectForm` does: slice 16 requires the
 * dialog to stay OPEN on a rejection, with the error rendered under the field it is about,
 * and `openDialog` throws if a dialog is already open — so a caller that dispatched after
 * the dialog resolved could not reopen it to show one. Such a form emits `submit` only once
 * its write succeeded. `values` is still typed by the form's own component rather than here,
 * for the same reason `FormDescriptor` carries a component and not a field list.
 */
```

- [ ] **Step 7: Run the tests and the gate**

Run: `npx vitest run tests/presentation/views/newProjectForm.test.ts tests/presentation/dialogs/`
Expected: PASS.

Run: `npm run check`

- [ ] **Step 8: Commit**

```bash
git add src/presentation/views/NewProjectForm.vue src/presentation/i18n/locales/ \
        src/presentation/dialogs/dialog-store.ts \
        src/presentation/dialogs/DialogHost.vue src/presentation/dialogs/FormDialog.vue \
        tests/
git commit -m "feat: the New Project form, which owns its dispatch so a rejection stays open"
```

---

### Task 7: The empty state gets its button

**Files:**
- Modify: `src/presentation/emptyStates/content.ts`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `tests/presentation/emptyStates/content.test.ts`
- Test: `tests/presentation/views/viewRootCreateProject.test.ts`

**Interfaces:**
- Consumes: `NewProjectForm` (Task 6), `RenovationProjectDeps.commands` (Task 5), `useDialogStore` from `src/presentation/dialogs/dialog-store.ts`.
- Produces: nothing new; wires existing pieces.

`content.test.ts` asserts this button's ABSENCE on purpose — slice 14 designed it so that adding one is a deliberate, tested change rather than an oversight closing quietly. **Update that assertion, do not delete it**, and leave `planEditor.noBackground`'s absence case exactly as it is: its hand-off (`set-plan-background`, a plugin command the editor's Vue tree cannot reach) still does not exist.

- [ ] **Step 1: Update the registry**

In `src/presentation/emptyStates/content.ts`:

```typescript
	renovationProject: {
		/**
		 * The action arrived with design slice 16: `ViewRoot` opens `NewProjectForm` in
		 * slice 15's `FormDialog`. Until then this entry had no button on purpose, because
		 * the form it hands off to did not exist and slice 14's Amendment 1 refuses a live
		 * control that does nothing.
		 */
		noProjects: {
			headline: 'empty.project.no-projects.headline',
			body: 'empty.project.no-projects.body',
			actionLabel: 'empty.project.no-projects.action',
		},
	},
```

Then rewrite `EmptyStateContent.actionLabel`'s docblock: `noProjects` is no longer an example of an absent label, and `planEditor.noBackground` is now the only reason the field is optional.

- [ ] **Step 2: Update `content.test.ts`**

```typescript
	it('gives the no-projects state an action, because slice 16 built what it hands off to', () => {
		const content = EMPTY_STATE_CONTENT.renovationProject.noProjects;

		expect(content.actionLabel).toBeDefined();
		// Non-empty resolved copy, not just a declared key: `''` would render a nameless
		// button, which is both a control that says nothing and an axe `button-name` failure.
		expect(t('en', content.actionLabel!)).not.toBe('');
	});

	it('still gives the no-background state NO action, its hand-off not existing yet', () => {
		// Unchanged from slice 14. `set-plan-background` is a plugin command and is not a
		// member of `PlanEditorCommandServices`, so the editor's Vue tree cannot reach it.
		expect(EMPTY_STATE_CONTENT.planEditor.noBackground.actionLabel).toBeUndefined();
	});
```

- [ ] **Step 3: Write the failing test**

Create `tests/presentation/views/viewRootCreateProject.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The empty state's button, end to end: it opens the form, and a created project APPEARS.
 * The second half is the one that matters — a create whose result never reaches the pane is
 * the exact failure the project list exists to prevent.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { ok } from '../../../src/core/result/Result';

function deps(listProjects: () => Promise<unknown>) {
	return {
		queries: { listProjects },
		commands: { createProject: { execute: vi.fn(async () => ok({ project: { entity: { id: 'p1' } } })) } },
		openProject: vi.fn(async () => undefined),
	};
}

describe('ViewRoot, creating a project', () => {
	it('opens the New Project form from the empty state action', async () => {
		setActivePinia(createPinia());
		const context = deps(async () => ok({ projects: [], unreadable: 0 }));
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(wrapper.findComponent(NewProjectForm).exists()).toBe(true);
	});

	it('re-reads the list after a successful create, so the new project appears', async () => {
		setActivePinia(createPinia());
		let projects: readonly { id: string; name: string; status: string }[] = [];
		const listProjects = vi.fn(async () => ok({ projects, unreadable: 0 }));
		const context = deps(listProjects);
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();

		await wrapper.get('.rp-empty-state__action').trigger('click');
		await flushPromises();
		// The write lands, and the vault now holds one project.
		projects = [{ id: 'p1', name: 'Kitchen', status: 'IDEA' }];
		wrapper.findComponent(NewProjectForm).vm.$emit('submit', { name: 'Kitchen' });
		await flushPromises();

		expect(listProjects).toHaveBeenCalledTimes(2);
		expect(wrapper.text()).toContain('Kitchen');
	});
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx vitest run tests/presentation/views/viewRootCreateProject.test.ts`
Expected: FAIL — no `.rp-empty-state__action` exists until Step 1 lands, and no dialog opens until Step 5.

- [ ] **Step 5: Wire it in `ViewRoot.vue`**

```typescript
const dialogs = useDialogStore();

/**
 * The empty state's hand-off. `createProject.execute` is passed as the form's own
 * `dispatch`, because the form owns its dispatch — slice 16 requires the dialog to stay OPEN
 * on a rejection with the error under its field, and `openDialog` throws if one is already
 * open, so a caller that dispatched afterwards could not reopen it to show one.
 *
 * The re-hydrate is not optional politeness: without it a created project is written and
 * never appears, which is indistinguishable from a create that silently failed.
 */
async function onCreateProject(): Promise<void> {
	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-project.title'),
		component: NewProjectForm,
		// `busy` appears TWICE on purpose, and both are load-bearing: in `props` so the form
		// receives the ref and can write its `submitting` into it, and on the descriptor so
		// the host can read it. Passing it only to the descriptor — which two revisions of
		// this plan did — leaves the form without the prop, its `watchEffect` never runs, the
		// ref stays false forever, and Cancel and Escape stay live for the whole write while
		// every line of the mechanism looks present.
		props: {
			dispatch: (input: CreateProjectInput) => context.commands.createProject.execute(input),
			busy: newProjectBusy,
		},
		busy: newProjectBusy,
	});
	if (result === 'cancel') return;
	await store.hydrate(context.queries);
}
```

and in the template:

```html
			<EmptyState
				v-if="empty !== null"
				v-bind="empty"
				@action="onCreateProject"
			/>
```

- [ ] **Step 6: Run the tests and the gate**

Run: `npx vitest run tests/presentation/emptyStates/content.test.ts tests/presentation/views/viewRootCreateProject.test.ts`
Expected: PASS.

Run: `npm run check`

- [ ] **Step 7: Commit**

```bash
git add src/presentation/emptyStates/content.ts src/presentation/views/ViewRoot.vue tests/
git commit -m "feat: the no-projects empty state opens the New Project form"
```

---

### Task 8: `ProjectList.vue`

**Files:**
- Create: `src/presentation/views/ProjectList.vue`
- Modify: `src/presentation/views/ViewRoot.vue`
- Modify: `styles/forms.css`
- Test: `tests/presentation/views/projectList.test.ts`

**Interfaces:**
- Consumes: `ProjectSummaryDto` (`{ id: string; name: string; status: string }`) from `src/presentation/read-models/PlanDto.ts`; `RenovationProjectDeps.openProject` (Task 5); and **`onCreateProject`, declared in `ViewRoot.vue` by Task 7** — this task binds `@create` to that existing handler and must not declare a second one, since the empty state's button and the list header's are one action with one owner.
- Produces: `ProjectList` taking `{ projects: readonly ProjectSummaryDto[] }` and emitting `open: [projectId: string]`.

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @vitest-environment jsdom
 *
 * The list, and the one rule slice 14 spent a whole decision on: a list and the
 * unreadable notice are ADDITIVE. `unreadable > 0` means the vault holds projects this build
 * could not read — it never replaces the ones it could.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProjectList from '../../../src/presentation/views/ProjectList.vue';

const PROJECTS = [
	{ id: 'p1', name: 'Kitchen', status: 'IDEA' },
	{ id: 'p2', name: 'Bathroom', status: 'PLANNING' },
];

describe('ProjectList', () => {
	it('renders one row per project, naming each', () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		expect(wrapper.findAll('.rp-project-list__row')).toHaveLength(2);
		expect(wrapper.text()).toContain('Kitchen');
		expect(wrapper.text()).toContain('Bathroom');
	});

	it('emits open with that row’s id', async () => {
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.findAll('.rp-project-list__row')[1].trigger('click');

		expect(wrapper.emitted('open')).toEqual([['p2']]);
	});

	it('offers a create affordance even when the list is populated', async () => {
		// Finding 3: the empty state's button unmounts the moment a project exists, and there
		// is no other entry point — so without this a user creates one project and never a
		// second. It emits rather than opening anything: `ViewRoot` owns the one handler.
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		await wrapper.get('.rp-project-list__create').trigger('click');

		expect(wrapper.emitted('create')).toHaveLength(1);
	});

	it('gives every row a real button, not a clickable div', () => {
		// A div with a click handler is neither focusable nor announced. There is no href
		// here, so a link would be the wrong element in the other direction.
		const wrapper = mount(ProjectList, { props: { projects: PROJECTS } });

		for (const row of wrapper.findAll('.rp-project-list__row')) {
			expect(row.element.tagName).toBe('BUTTON');
			expect(row.attributes('type')).toBe('button');
		}
	});
});
```

Add a fourth case in `tests/presentation/views/viewRootCreateProject.test.ts` (or a sibling file), mounting `ViewRoot` with `{ projects: [one], unreadable: 2 }` and asserting **both** `.rp-project-list__row` and `.rp-view-notice` are present.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/views/projectList.test.ts`
Expected: FAIL — cannot resolve `ProjectList.vue`.

- [ ] **Step 3: Write the component**

The header's button is finding 3 from the first review, and it is not decoration: `emptyStateKey` goes `null` the moment a project exists, so the empty state and its button unmount, and a repository-wide search finds no other creation entry point (`create-sample-project` seeds a whole demo and is scaffolding). Without this, a user could create ONE project and never a second without deleting it first.

**One action, every input.** This button and the empty state's call the SAME `onCreateProject` — never two handlers that each decide for themselves how to open a form. A second entry point with its own activation looks correct alone and diverges the first time either changes.

```vue
<script setup lang="ts">
/**
 * Every project in the vault, one row each, and the way to add another (design slice 16).
 *
 * `ViewRoot` drew four things and no list for three slices, under a comment blaming slice 17
 * — whose document is the error-surfacing decision table and never mentions one. The list was
 * owned by no slice; it is owned here.
 *
 * It DISPATCHES nothing and opens nothing: it emits an id, and the view calls
 * `context.openProject`, which the composition root supplied because `presentation/` may not
 * reach Obsidian's vault and a `ProjectSummaryDto` carries no path.
 */
import type { ProjectSummaryDto } from '../read-models/PlanDto';

import { tr } from '../i18n/strings';

defineProps<{ projects: readonly ProjectSummaryDto[] }>();
defineEmits<{ open: [projectId: string]; create: [] }>();
</script>

<template>
	<div class="rp-project-list__header">
		<h2 class="rp-project-list__title">{{ tr('view.project.list-title') }}</h2>
		<button
			type="button"
			class="rp-project-list__create"
			@click="$emit('create')"
		>
			{{ tr('view.project.create') }}
		</button>
	</div>
	<ul class="rp-project-list">
		<li
			v-for="project in projects"
			:key="project.id"
		>
			<button
				type="button"
				class="rp-project-list__row"
				@click="$emit('open', project.id)"
			>
				<span class="rp-project-list__name">{{ project.name }}</span>
				<span class="rp-project-list__status">{{ project.status }}</span>
			</button>
		</li>
	</ul>
</template>
```

**On `project.status`:** it renders the raw domain value (`IDEA`, `PLANNING`). That is a deliberate, stated shortcut rather than an oversight — a per-status locale key set is real copy work this slice has no other need for. If you add the keys, resolve through `tr(...)`; if you do not, leave this comment saying so, because an untranslated literal that looks deliberate is worse than one that is.

- [ ] **Step 4: Render it in `ViewRoot.vue`, and correct the two false comments**

```html
			<ProjectList
				v-else
				:projects="projects"
				@open="(id) => void context.openProject(id)"
				@create="onCreateProject"
			/>
```

placed as the `v-else` of the `empty !== null` branch, inside `status === 'ready'` and **before** the `.rp-view-notice`, so both render together.

In the same edit, correct this file's two comments naming slice 17 as the list's owner — one in the component docblock, one on the `empty` computed. Both are false and have been since they were written.

- [ ] **Step 5: Add the list's styles**

Append to `styles/forms.css`:

```css
.rp-project-list {
	margin: 0;
	padding: 0;
	list-style: none;
}

.rp-project-list__row {
	display: flex;
	justify-content: space-between;
	gap: var(--size-4-2);
	width: 100%;
	/* WCAG 2.5.8 asks 24px minimum. The harness index shipped 19.5px rows once, found by
	   photographing the page rather than by any gate. */
	min-height: var(--size-4-6);
	padding: var(--size-2-2) var(--size-4-2);
	border: none;
	border-radius: var(--radius-s);
	background-color: transparent;
	color: var(--text-normal);
	text-align: left;
	cursor: pointer;
}

.rp-project-list__row:hover {
	background-color: var(--background-modifier-hover);
}

/* The vendored app.css reduction carries `a { outline: none }` and puts nothing back, so a
   focus ring is stated here rather than inherited. WCAG 2.4.7. */
.rp-project-list__row:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

.rp-project-list__status {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
```

Do **not** dim the status with `opacity` — the harness index's kind label did exactly that and composited to 4.29:1 on the light scheme, a contrast value no source file contained.

- [ ] **Step 6: Run the tests and the gate**

Run: `npx vitest run tests/presentation/views/` then `npm run check`

- [ ] **Step 7: Photograph it**

Run: `npm run harness-shot`, then `npm run harness-shot -- --width=460`.

**Open the PNGs and look at them.** Spacing, wrapping, overflow, contrast and hit size are outside every gate this repository has, and this is the only instrument that reaches them — it has caught ten defects `npm run check` passed, including a row height and a contrast ratio on a list very like this one. The `--` is load-bearing: npm claims a bare `--width` as its own config. 460px is an Obsidian sidebar leaf's real width.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/views/ProjectList.vue src/presentation/views/ViewRoot.vue styles/forms.css tests/
git commit -m "feat: the project list, and the two comments that blamed slice 17 for its absence"
```

---

### Task 9: The Inspector's two override fields adopt `useFieldCommit`

**Files:**
- Modify: `src/presentation/editor/shell/RequirementRow.vue`
- Modify: `src/presentation/editor/runtime.ts` (`commitEdit`)
- Modify: `src/presentation/i18n/locales/en.ts`, `de.ts`
- Test: `tests/presentation/editor/requirementRowFieldErrors.test.ts`

**Interfaces:**
- Consumes: `useFieldCommit` (Task 4), `FieldError` (Task 2).
- Produces: `RequirementRow` gains a required prop `commit: (edit: InspectorEdit) => Promise<Result<void, AppError>>`, supplied by `InspectorPanel` and bound to `runtime.commitEdit`'s underlying `inspector.commit`.

**Where `useFieldCommit` lives, and why the row's own docblock changes.** The composable owns a draft, an error and a dispatch, so it must be instantiated once per bound input — and there is one pair of inputs PER ROW, so the instances live in the row. `RequirementRow`'s docblock currently reads "It DISPATCHES nothing … the panel commits it through `runtime.commitEdit`". After this task it dispatches through a function the panel HANDED it, which is still that one commit path, so **rewrite the docblock to say that** rather than leaving a sentence that is no longer true. The invariant that matters is unchanged and worth restating in the new wording: there is still exactly ONE commit seam, and a row reaching for a dispatcher of its own would silently break the post-command refresh and the reactive undo/redo flags with nothing erroring anywhere.

A per-row `Map` in the panel is the alternative and is refused for the reason the row was extracted in the first place: a component instance per row already IS that keying, and a Map outlives the row it describes.

**The `commit` prop must be FAULT-GUARDED, and this is the one thing easy to lose here.** `commitEdit` wraps its dispatch in `reportFault`; binding the row straight to `inspector.commit` drops that. Every dispatch here ends at a click handler that discards its promise, and SDD §65 reserves throws for technical faults which the editor's dispatcher re-throws — so a fault would become an unhandled rejection reaching nobody, leaving the control silently dead. That is precisely what `reportFault` exists to prevent. The panel therefore supplies:

```typescript
async function commitField(edit: InspectorEdit): Promise<Result<void, AppError>> {
	const result = await reportFault(context.commands.logger, inspector.commit(edit));
	// `reportFault` answers null for a fault it has already logged. The row must still see a
	// failed Result, or a fault would read to the composable as an accepted commit.
	return result ?? err(vaultUnexpectedFailure());
}
```

Assert it: a `commit` that REJECTS leaves the field showing an error and does not clear the draft. A test that only drives refusals would never notice the guard was missing.

**`reportFault` is the THROWN half only, and the resolved half is a second door this seam does not carry.** `commitEdit` does two things with a failure — `reportFault` for a fault, `notifyError` for a resolved failed `Result` — and `commitField` above performs only the first. The second belongs to the composable's required `notify` (Task 4), which each row passes `notifyError`, so a banner-routed refusal is announced from the one place that knows the routing decision. Naming this explicitly because a first draft of this task dropped it: with `useFieldCommit` converting every unmapped failure to `error = null` and `commitField` notifying nothing, a resolved vault failure during an override reached the user through neither door — the guard read as complete because the FAULT half was visibly handled, and the resolved half is the one that actually happens.

**Do not solve it by notifying inside `commitField`.** That door does not know whether the row is about to show the same error under the input, so every field-attributable refusal would be reported twice — a message under the input and a notice about the same press. The routing decision has exactly one owner and `notify` is downstream of it.

**Two live defects this closes**, both named in the spec:

1. A rejected commit becomes an Obsidian notice — `commitEdit`'s `notifyError` call in `runtime.ts` — anchored to nothing.
2. An **unparseable** draft silently resets to "calculated": `applyQuantity` turns a non-finite parse into `null`, which IS the reset value, and tells the user nothing at all.

**The row dispatches only through the function the panel HANDED it**, which is still `commitEdit`'s underlying `inspector.commit` behind `commitField`'s fault guard — the Inspector's one commit path (SDD §59). An earlier draft of this paragraph said the row "DISPATCHES nothing", which contradicted the Interfaces block eleven lines above it: after this task it does dispatch, through an injected prop rather than a dispatcher of its own. The invariant that matters survives the rewording and is the reason for the prop: there is still exactly ONE commit seam, and a row reaching for its own would silently break the post-command refresh and the reactive undo/redo flags with nothing erroring anywhere.

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @vitest-environment jsdom
 *
 * What an Inspector override does when it is refused, and when it cannot be parsed at all.
 *
 * The second case is a shipped defect rather than a new feature: `applyQuantity` turned a
 * non-finite parse into `null`, which is the reset-to-calculated value — so typing `abc` and
 * tabbing away silently discarded the user's override and told them nothing.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RequirementRow from '../../../src/presentation/editor/shell/RequirementRow.vue';

const ROW = {
	requirementId: 'r1',
	assetId: 'a1',
	assetName: 'Oak flooring',
	missingTarget: null,
	unit: 'm²',
	recalculationStatus: 'fresh',
	quantity: { effective: 12, override: null },
	cost: { effective: { amount: '100.00', currency: 'EUR' }, override: null },
} as const;

/**
 * Asserted on the COMMAND INPUT rather than on a rendered badge — slice 10's rule. "The
 * panel re-rendered" is equally true of a row that committed something else entirely.
 */
function mountRow(commitResult: Result<void, AppError> = ok(undefined)) {
	const commit = vi.fn(async () => commitResult);
	const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
	return { wrapper, commit };
}

describe('RequirementRow', () => {
	it('reports an unparseable quantity instead of silently resetting to calculated', async () => {
		const { wrapper, commit } = mountRow();

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('abc');
		await input.trigger('blur');

		// The shipped defect: this used to commit `quantity: null`, which IS "reset to
		// calculated" — the user's override discarded, with nothing said.
		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).not.toBe('');
		expect(input.attributes('aria-invalid')).toBe('true');
	});

	it('commits the parsed figure exactly once for a value it can read', async () => {
		const { wrapper, commit } = mountRow();

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('14.5');
		await input.trigger('blur');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: 14.5,
		});
	});

	it('retires the parse message as soon as the user corrects the value, committing nothing', async () => {
		const { wrapper, commit } = mountRow();
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('abc');
		await input.trigger('blur');

		await input.setValue('14.5');

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		// A keystroke never dispatches (slice 6): nothing until the next blur.
		expect(commit).not.toHaveBeenCalled();
	});

	it('keeps a refused value in the field with its message under it', async () => {
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		const { wrapper, commit } = mountRow(err(refusal));

		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();

		expect(commit).toHaveBeenCalledTimes(1);
		// Kept, not reverted: the fix is one keystroke away from what is already on screen.
		expect((input.element as HTMLInputElement).value).toBe('-5');
		expect(input.attributes('aria-invalid')).toBe('true');
	});

	it('clears a refused draft and its message when reset succeeds', async () => {
		// Reset used to bypass the composable, which holds the rejected draft and the error —
		// so the old value went on winning the computed draft with its stale message under it,
		// on a row that had just been reset.
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		let result: Result<void, AppError> = err(refusal);
		const commit = vi.fn(async () => result);
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();
		result = ok(undefined);

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect((input.element as HTMLInputElement).value).not.toBe('-5');
	});

	it('reports an unparseable COST instead of throwing out of the handler', async () => {
		// `moneyOf` throws on a malformed literal, unlike `Number`, which yields NaN. Typing
		// text into the cost field must not take the click handler's promise down with it.
		const commit = vi.fn(async () => ok(undefined));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });

		const input = wrapper.get('input[data-field="cost"]');
		await input.setValue('abc');
		await expect(input.trigger('blur')).resolves.not.toThrow();
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.get('.rp-field-error__message').text()).not.toBe('');
	});

	it('runs the unconvertible-draft guard inside onCommit, not at the call site', async () => {
		// The rule lives in `useFieldCommit.validate`. If it moved back out to each control,
		// this passes only for whichever control the author remembered — which is how three
		// findings of one shape arrived on the sibling slice.
		const commit = vi.fn(async () => ok(undefined));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });

		for (const field of ['quantity', 'cost']) {
			const input = wrapper.get(`input[data-field="${field}"]`);
			await input.setValue('abc');
			await input.trigger('blur');
		}
		await flushPromises();

		expect(commit).not.toHaveBeenCalled();
		expect(wrapper.findAll('.rp-field-error__message')).toHaveLength(2);
	});

	it('discards a rejected draft on Escape without dispatching', async () => {
		// The spec keeps Escape-to-revert real in the Inspector, which is not inside a dialog.
		// The canvas's tool-cancel handler is a SIBLING and never sees a keydown that starts in
		// this input, so nothing else can provide this.
		const refusal: AppError = {
			category: 'Validation',
			code: 'requirement.negative-quantity',
			message: 'developer english',
		};
		const commit = vi.fn(async () => err(refusal));
		const wrapper = mount(RequirementRow, { props: { row: ROW, commit } });
		const input = wrapper.get('input[data-field="quantity"]');
		await input.setValue('-5');
		await input.trigger('blur');
		await flushPromises();
		expect(commit).toHaveBeenCalledTimes(1);

		await input.trigger('keydown', { key: 'Escape' });

		expect(wrapper.find('.rp-field-error__message').exists()).toBe(false);
		expect((input.element as HTMLInputElement).value).not.toBe('-5');
		// Discarded, never committed — which is what separates it from Reset below.
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('still offers an explicit reset to calculated', async () => {
		// `Escape` inside the editor is spoken for by tool-gesture cancellation, so the way
		// back to "calculated" stays a visible control rather than a key.
		const { wrapper, commit } = mountRow();

		await wrapper.get('.rp-requirement-reset-quantity').trigger('click');
		await flushPromises();

		expect(commit).toHaveBeenCalledWith({
			kind: 'quantity-override',
			requirementId: 'r1',
			quantity: null,
		});
	});
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/presentation/editor/requirementRowFieldErrors.test.ts`
Expected: FAIL — `RequirementRow` has no `commit` prop yet, and the first case's behaviour today is a `quantity: null` commit, which is the defect.

- [ ] **Step 3: Add the locale keys**

To `en.ts` and `de.ts`:

```typescript
'error.requirement.quantity.unparseable': 'Enter a number, or reset to the calculated figure.',
'error.requirement.cost.unparseable': 'Enter an amount, or reset to the calculated figure.',
```

- [ ] **Step 4: Rewrite the two controls**

Replace `quantityDraft` / `costDraft` and the four `apply*` / `reset*` functions with one `useFieldCommit` instance per control, each rendered inside `<FieldError>`. The parse guard is the row's own and fires BEFORE `onCommit`, so an unreadable draft never becomes a command at all:

```typescript
const props = defineProps<{
	row: RequirementInspectorDTO;
	commit: (edit: InspectorEdit) => Promise<Result<void, AppError>>;
}>();

/**
 * The parse failure is the ROW's, not the command's: `Number('abc')` never reaches a
 * dispatch, so there is no `AppError` for `routeError` to place. It is handed to the
 * composable as `validate` rather than guarded here, so it clears on the same keystroke as a
 * refusal does and the user cannot tell the two apart — which is right, since to them both
 * are "this field is wrong".
 */

/**
 * **Every code here is copied from the RAISE SITE, never guessed from the field's name.**
 * The first draft of this plan mapped `requirement.quantity.negative`, which exists nowhere
 * in `src/`: the command raises `requirement.negative-quantity`
 * (`SetRequirementQuantityOverride.ts`). A map keyed on a code nothing raises is invisible to
 * every gate — `FieldErrorMap` takes any string, `routeError` finds no entry and answers
 * `banner`, and the field route this slice exists to build is simply never taken. So grep the
 * command for its `code:` literal and paste what it prints.
 *
 * `requirement.not-found` and every persistence code are deliberately ABSENT: they are not
 * about the value in this input, so they take the notice door below.
 */
const QUANTITY_ERRORS: FieldErrorMap<{ quantity: number | null }> = {
	'requirement.negative-quantity': 'quantity',
};

/**
 * Empty TODAY, and that is a finding rather than an omission: `SetRequirementCostOverride`
 * raises no field-attributable refusal at all, so every cost failure is banner-routed and
 * reaches the user through `notify` below. Declared anyway, so the seam exists and the next
 * cost refusal is one entry rather than a new mechanism.
 */
const COST_ERRORS: FieldErrorMap<{ cost: Money | null }> = {};

const quantity = useFieldCommit<number | null, { quantity: number | null }>({
	canonicalValue: () => props.row.quantity.override,
	buildCommand: (value) => ({
		execute: () => props.commit({
			kind: 'quantity-override',
			requirementId: props.row.requirementId,
			quantity: value,
		}),
		undo: () => Promise.resolve(ok(undefined)),
	}),
	history: { run: (command) => command.execute() },
	errorMap: QUANTITY_ERRORS,
	field: 'quantity',
	toUserMessage: trError,
	// The half `commitEdit` keeps: a refusal with no field to sit under is still announced.
	notify: notifyError,
	validate: (value) =>
		value === null || Number.isFinite(value) ? null : tr('error.requirement.quantity.unparseable'),
});

function onQuantityInput(raw: string): void {
	// A keystroke never dispatches (slice 6). `onInput` clears the error too, for the same
	// reason `setField` does: a message about a value the user has since corrected is telling
	// them something untrue.
	quantity.onInput(raw.trim() === '' ? null : Number(raw));
}
```

There is no `commitQuantity` and no local parse state: blur calls `quantity.onCommit()`
directly, and the guard runs inside it.

**Bind `Escape` on both controls, and this is not an extra — it is the design's own promise.**
The spec's decision 3 narrows `Escape` inside a DIALOG to the dialog's cancel and says in the
same breath that "`Escape`-to-revert-one-field stays real in the **Inspector**, which is not
inside a dialog". An earlier draft of this task bound nothing: the only tool-gesture `Escape`
handler is on the sibling `PlanCanvas`, and an event originating in an Inspector input never
reaches it — so the spec claimed behaviour no code produced, which is this repository's own
"write the guarantee to the check" rule broken inside its own documents.

```html
<input
	:id="inputId"
	v-bind="aria"
	data-field="quantity"
	:value="quantity.draft.value ?? ''"
	@input="onQuantityInput(($event.target as HTMLInputElement).value)"
	@blur="quantity.onCommit()"
	@keydown.esc.stop="quantity.onCancel()"
>
```

`.stop` because the canvas's cancel is a sibling concern: a user abandoning a typed override
has not abandoned a tool gesture they may also have running. **Reset and `Escape` are
different actions and both are kept:** reset COMMITS `null`, the value meaning "go back to
calculated", which is undoable; `Escape` DISCARDS the draft and dispatches nothing. One test
each, because they are one keystroke apart and collapsing them would look correct. The old shape emitted `null` for an unparseable
draft, which IS "reset to calculated" — a silent discard of the user's override.

**`pending` drives a visual, and deliberately does NOT disable the input.** Disabling was the
other way to close the in-flight clobber (Task 4) and it is refused: an input that goes
read-only for the length of a vault write takes keystrokes away from a user mid-word, and a
blur commit fires exactly when their attention has already moved on — so the disable would land
after they had started typing somewhere else and the recovery is worse than the defect. The
staleness guard inside `onCommit` closes the same hole without touching the control, so
`pending` is free to be what it should be: an unobtrusive busy affordance, and nothing that
takes input away. Bind it to an attribute, never to `disabled`.

**That choice is what makes Task 4's coalescing load-bearing rather than defensive**, and the
two decisions have to be read together: leaving the control live means a user really can blur,
click back in, retype and blur again inside one slow write. `CommandHistory` serializes those
dispatches, so they cannot interleave — but it executes and RECORDS every one, so uncoalesced
they leave an undo entry per blur for a single edit. The composable answers each extra gesture
by remembering it and honouring it once, with the latest draft, which is why nothing here needs
a `disabled` binding to stay correct.

`history: { run: (command) => command.execute() }` is deliberate and needs its own comment in the code: the reversible wrapping and the history entry are `commitEdit`'s job, one seam up — this row supplies the shape `useFieldCommit` takes without adding a second history. Write that down, because a reader meeting a `run` that only calls `execute` will otherwise read it as a stub.

Ids come from each `<FieldError>`'s scoped slot (Task 2), never from a hand-spelled string: two leaves showing the same requirement would otherwise mint the same id twice.

**Reset goes THROUGH the composable, not around it.** A first draft had the reset button call `props.commit({ quantity: null })` directly. After a refused override the composable still holds a non-null `drafted` and its error, and neither is its own to clear — so a successful reset would leave the old rejected value still winning the computed draft, with its stale message underneath, on a row that had just been reset. Route it:

```typescript
async function resetQuantity(): Promise<void> {
	// `null` is a VALUE in this seam — "reset to calculated" — so it commits like any other,
	// which is also what clears the draft and the error on success.
	quantity.onInput(null);
	await quantity.onCommit();
}
```

**The cost field's draft is a raw STRING, and this is not symmetry with quantity — it is the opposite of it.** `Number('abc')` yields `NaN`, a value to inspect; `moneyOf('abc', …)` **throws** (`Money.ts`: a non-matching literal is refused at the door). So repeating the quantity shape would throw out of the input handler before any error could be set, taking the click handler's promise with it. Keep the text as the draft and construct only inside `buildCommand`, which `onCommit` reaches only once `validate` has passed:

```typescript
const cost = useFieldCommit<string, { cost: Money | null }>({
	// The canonical value RENDERED, not parsed: a draft is text until it is committed.
	canonicalValue: () => props.row.cost.override?.amount ?? '',
	buildCommand: (raw) => ({
		// Reached only once `validate` below has passed, so `moneyOf` cannot throw here.
		execute: () => props.commit({
			kind: 'cost-override',
			requirementId: props.row.requirementId,
			cost: raw.trim() === '' ? null : moneyOf(raw.trim(), props.row.cost.effective.currency),
		}),
		undo: () => Promise.resolve(ok(undefined)),
	}),
	history: { run: (command) => command.execute() },
	errorMap: COST_ERRORS,
	field: 'cost',
	toUserMessage: trError,
	notify: notifyError,
	validate: (raw) =>
		raw.trim() === '' || canBeMoney(raw.trim()) ? null : tr('error.requirement.cost.unparseable'),
});
```

Blur calls `cost.onCommit()` directly, exactly as quantity does — one rule, inside the
composable, and neither caller can forget it.

`canBeMoney` is a total predicate — a `try`/`catch` around `moneyOf`, or `Money`'s own literal pattern if it exports one. **Check which exists before writing it**; do not add a second, hand-written regex for what a monetary literal is, because that is a rule with two definitions the moment `Money` changes.

- [ ] **Step 5: Narrow `commitEdit`**

In `runtime.ts`, a field-attributable refusal is the field's to show and `notifyError` keeps the rest. Update the function's comment to say **which half** it now covers:

```typescript
	/**
	 * The Inspector's one commit path. A refusal the panel can attach to an input is rendered
	 * there by the row that owns it; everything else still reaches `notifyError`, because the
	 * Inspector has no banner region. The notice door NARROWS here — it does not close.
	 *
	 * Which errors may reach a field at all is slice 17's decision table, not this function's.
	 */
```

- [ ] **Step 6: Run the tests and the gate**

Run: `npx vitest run tests/presentation/editor/` then `npm run check`

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/ src/presentation/i18n/locales/ tests/
git commit -m "fix: an Inspector override says why it was refused instead of resetting"
```

---

### Task 10: Accessibility, the manual case, and the three corrected claims

**Files:**
- Modify: `tests/harness/accessibility.test.ts`
- Create: `docs/tests/cases/Create a Project.md`
- Modify: `src/plugin/sampleProject.ts`, `CLAUDE.md`
- Modify: `docs/tasks/16-form-and-inline-validation-feedback.md` (Definition of Done reconciliation)

- [ ] **Step 1: Extend the accessibility case**

`renovationProject.noProjects` now carries a button, making it the **first button-carrying empty state any scan has graded** — CLAUDE.md records that none was. Add the New Project dialog as a scanned surface too.

**Await `flushPromises()` before scanning and assert the scanned subtree is non-empty.** `mountHarness` is synchronous and `void`s `onOpen`, so a scan fired immediately after mounting runs one tick before the store's query resolves: measured, it found zero elements under any rule bucket and passed on an empty subtree, indistinguishable from a pass on a compliant one.

- [ ] **Step 2: Write the manual case**

`docs/tests/cases/Create a Project.md`, following `docs/tests/cases/Calibrate a Plan.md`'s shape. Cover what jsdom cannot: that `Escape` closes the dialog while Obsidian's own keymap stays live behind it (nothing pushes a `Scope`, and `onKeydown` calls `preventDefault()` without `stopPropagation()`), that the destructive/primary buttons render themed rather than plain white (Obsidian's `button:not(.clickable-icon)` outranks a single class at (0,1,1)), and that a created project appears in the list without a reload.

- [ ] **Step 3: Correct the three claims**

- `src/plugin/sampleProject.ts` — this slice does NOT retire `create-sample-project`: that seeds a project, a plan and five zones, and this creates only a project. Narrow the claim; name what would retire it.
- `CLAUDE.md` — the same correction; the project list is this slice's, not slice 17's; the button-carrying empty state sentence; and the stale bundle figure (**657.09 kB**, not 488 KB).
- `docs/tasks/16-*.md` — record that DoD item 1 is satisfied by `CreateProjectCommand` rather than `CreateAssetCommand`, and that item 2's creation-dialog clause is **withdrawn**, with the reason. Do not tick a withdrawn item.

- [ ] **Step 4: Run the full gate and re-measure coverage**

Run: `npm run check`
Then: `npm run test:coverage` — read the four figures. Per `vitest.config.ts`'s ratchet policy, floors rise only to what a FINISHED increment measures, rounded down. If the rounded figures equal the floors already in force, **nothing ratchets** — say so in the config comment rather than inventing a rise.

If `tests/build/` reports a `beforeAll` timeout, re-run with `--no-file-parallelism` before believing it: each such file boots its own type-aware ESLint project service, and under default parallelism on Windows those boots contend. A parallelism artifact, not a broken gate.

- [ ] **Step 5: Commit**

```bash
git add tests/harness/accessibility.test.ts docs/ src/plugin/sampleProject.ts CLAUDE.md vitest.config.ts
git commit -m "docs: the manual case for creating a project, and three claims this slice makes false"
```

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: the mechanism → 1–4; consumer A (Inspector) → 9; consumer B (New Project) → 6; the seam → 5; the project list → 8; the empty state's button → 7; the three corrections → 8 (comments) and 10 (docs); the Vueform refusal → Global Constraints ("No new dependency"); accessibility → 2 (component-level) and 10 (scan-level); testing strategy → distributed across every task's own steps.

**The five review findings.** 1 (cancel during an in-flight write) → Task 6, Step 5, adding `FormDescriptor.busy`. 2 (no path on the DTO) → already Task 5's `openProject`. 3 (no way to create a second project) → Task 8, the list header's button, sharing Task 7's one handler. 4 (half a cross-field error surviving) → Task 3, `routedGroup` and its own case. 5 (the Inspector seam) → already Task 9's `commit` prop over `inspector.commit`. Verifying 5 turned up a sixth in the plan's own fix — the prop drops `commitEdit`'s `reportFault` — recorded and closed in Task 9's Interfaces block.

**The second review's six findings**, all verified against the code and all real; four were defects in the first review's own fixes. `FieldError` minted no ids and searched the whole document → it mints both ids and hands them down a scoped slot, with `app.config.idPrefix` per app (Task 2 — at BOTH `createApp` sites, which the third review had to widen). `submitting` was set and never checked, so two Enter presses made two projects → `submit` returns early while one is in flight (Task 3). `openProjectNote` did not exist and `renovationProjectDeps` had no `Workspace` → Task 5 builds it, threading both. `newProjectBusy` was never declared, so the cancel-during-write fix was connected to nothing → `ViewRoot` owns the ref and passes it in (Tasks 6, 7). Reset bypassed the composable, leaving a rejected draft and stale error → it routes through it (Task 9). And `moneyOf` THROWS where `Number` yields `NaN`, so the cost field's draft is a raw string guarded before construction (Task 9).

**The third review's four findings**, all verified against `src/` before touching a line, all real, and three of them defects in the second review's own fixes — the same ratio that round had, which is the argument for reading a fix as new code rather than as a closed item.

1. **The mapped code did not exist** (P1). The map and its three test cases keyed `requirement.quantity.negative`; `SetRequirementQuantityOverride.ts` raises `requirement.negative-quantity`. Nothing catches this: `FieldErrorMap` takes any string, so a code nothing raises type-checks, `routeError` simply finds no entry, and the field route this whole slice exists to build is never taken — the tests stay green because they drive the same wrong code the map holds. Fixed at all seven sites, and the two maps Task 9 referenced but never declared are now written out with a docblock saying to paste the `code:` literal from the raise site. Verified the OTHER map while there: `project.empty-name` and `project.target-before-start` are real, built by `projectError()`'s template rather than spelled literally, which is why a plain grep for them prints nothing — a near-miss worth recording, since "grep found nothing" nearly became a second false correction.
2. **The banner half reached nobody** (P1). `commitField` calls `inspector.commit` through `reportFault` and never performs `commitEdit`'s `notifyError`, while `useFieldCommit` converts every banner-routed failure to `error = null` — so a resolved vault failure during an override produced no inline error AND no notice. `useFieldCommit` takes a REQUIRED `notify` now, called with the original `AppError` whenever the routed message is not this field's; both Task 9 call sites pass `notifyError`. Required rather than optional-with-a-default because the forgetting call site is exactly the failure. Notifying inside `commitField` was the other option and is refused in Task 9's text: that door cannot see the routing decision, so every field-attributable refusal would be reported twice.
3. **A pending write discarded the keystrokes that landed under it** (P2). `onCommit` cleared `drafted` unconditionally on success, so a slow vault write with the user still typing replaced their newer text with the canonical value mid-word. It snapshots the submitted wrapper and clears only if the field still holds it — reference identity, which works because `onInput` mints a fresh object per keystroke, and which is now the second reason the clean sentinel is a wrapper rather than a bare value. Disabling the control for the pending interval was the alternative and is refused with its reason written down: a blur commit fires exactly when the user's attention has moved on, so the disable lands after they have started typing elsewhere.
4. **`idPrefix` was set in one app of two** (P2). `NewProjectForm` renders these same `useId` controls inside `RenovationProjectView`'s separate app, where `useId` restarts at `v-0` — so the surface this slice exists for was the one left colliding. Both `createApp` sites set it now. Two things the finding did not name and the fix needed anyway: `RenovationProjectView` being a singleton is not a defence, since a user can split a pane and Obsidian restores saved layouts; and **"the leaf's own key" is not a thing** — `WorkspaceLeaf` in the pinned `obsidian@1.13.0` typings exposes `parent`, `view` and `hoverPopover` and nothing identifying, so the prescribed mechanism was unbuildable without an undocumented field. A module-level counter replaces it.

Two contradictions fell out of reading those regions and are fixed in the same pass: Task 9 still carried a paragraph reading "**The row still DISPATCHES nothing**" eleven lines under an Interfaces block giving it a `commit` prop, and the cost field's snippet closed its object literal with a stray `});` before `validate:`, so the code as written would not have parsed.

**The fourth review's two findings**, both verified against `src/` and both real.

1. **The form collected three fields the vault drops** (P1). `projectToPersistence` writes `name` and `status` and nothing else; `fromDto` reconstructs the same two. So `description`, `start` and `targetCompletion` would have appeared to save and been `null` on the next read. What makes this worth more than its fix: **the spec refused `Money` on precisely this ground and then admitted three fields with the same defect one layer down** — it checked the domain, found `Project` holds them, and stopped, where the question runs to the bytes. New Task 5a persists all three, following `AssetFrontmatterSchemaV1`'s existing `z.string().nullable().catch(null)` pattern, so no version bump and no migration are needed — `.catch(null)` is what lets a note written before these keys existed parse unchanged. Dates are the part that is not a copy: `Project.start` is a real `Date` where `Requirement.requiredDate` is already a string, so the mapper converts, date-only and in UTC, with the local-midnight day-shift and the `Invalid Date` comparison hole both named in the task and both given a case.
2. **The form stayed editable during its own submit** (P2). `submit` reads `values.value` once; `setField` replaces the ref; the success then closes the dialog without the newer text, which leaves with it. Task 6 disables every control while `submitting`. This is the mirror of the third review's Task 4 finding with the OPPOSITE remedy, and the asymmetry is the interesting part: a submit is an explicit press on a form under the user's eye, so a visibly busy form is expected; a blur commit fires when their attention has already moved on, so freezing that control would take keystrokes away somewhere else. Same race, different gesture, different answer.

**The fifth review's two findings**, both P2, both verified, and both defects in the FOURTH round's own fixes — which is now four rounds running where the majority of findings were introduced by the previous round's repairs. That ratio is the durable lesson of this document: a fix is new code and gets read as new code.

1. **A shape check written as if it were a validity check.** Task 5a guarded the stored dates with `.regex(/^\d{4}-\d{2}-\d{2}$/)` and a test using `yesterday` — the one malformed spelling a regex alone already refuses, so the test agreed with the guard about the only case both could see. Measured with node rather than argued: `2026-99-99`, `2026-13-01` and `2026-00-10` pass the regex and parse to `Invalid Date`, whose `NaN` timestamp makes every comparison false and whose `.toISOString()` throws; and `2026-02-30` and `2026-04-31` pass the regex, parse happily, and come back as **March 2** and **May 1** — no error anywhere, just a different day than the user wrote. One round-trip predicate (`isRealCalendarDate`) closes both classes, declared once for both keys, with the finite check ordered first because `toISOString()` on an `Invalid Date` throws on exactly the input the predicate exists to reject. The tests are a table of six now, plus a leap day to prove the guard is not so eager it refuses `2028-02-29` — which is what a hand-written regex clever enough to catch February 30th usually does. **This is this repository's own rule about instruments, turned on the fix that quoted it.**
2. **Overlapping commits from the control round four chose to leave enabled.** `onCommit` had no in-flight guard, so a second blur during a slow write started a second `history.run`. `CommandHistory` serializes them, so nothing interleaves — but it executes and records each, so N blurs on one edit leave N undo entries, and the first call's `finally` cleared `pending` while a later dispatch was still queued. The composable coalesces now: an extra gesture sets a flag, and the loop honours it exactly once with the latest draft, skipping the re-dispatch when the draft never moved. **Dropping the extra call instead — which is what `useFormCommit.submit` correctly does — would be wrong here**, and it is the same asymmetry as the disable question one finding earlier: a repeated submit is one intent pressed twice, while a repeated field commit carries a value the user has since changed.

**The sixth review's six findings**, all verified against the plan's own text and all real. Three are one new CLASS, which is why a global constraint carries the rule rather than three task edits: a `git add` that omits a file its own task creates. `npm run check` cannot see it — the gate reads the WORKING TREE, which has the file — so the check passes, the commit is short, and for a path no later task stages (`openNote.ts`) the file is never committed at all. Task 2 omitted the id-prefix helper and both view files, Task 5 `openNote.ts` and the plugin's factory call, Task 6 both dialog components.

The other three: the coalescing loop treated a CLEARED draft as a changed one (`dispatchOnce` nulls `drafted` on success, and `null !== lastCommitted` is true), so two blurs with no edit between them re-dispatched the canonical value and bought an undo entry — `!== null` is half the moved-test, not a defensive extra. The single top-of-function `validate` left `recommit` set when it refused, so a valid commit followed by malformed text and a blur dispatched the malformed draft the instant the first write settled, into the very `moneyOf` throw the seam exists to prevent — it validates once per loop iteration now, one rule in one place. And `Escape` on an Inspector field was promised by the spec and bound by nothing: the only tool-cancel handler is on the sibling `PlanCanvas` and never sees a keydown starting in an input, so the spec claimed behaviour no code produced.

**The seventh review's three findings**, all real, and all three defects in the sixth round's own repairs — the pattern now holds for five consecutive rounds.

1. **`busy` reached the descriptor and not the form** (P1). The third incomplete wiring of one fix: round two declared no ref, round six declared it and passed it only to `openDialog`'s descriptor, so `NewProjectForm` never received the prop, its `watchEffect` never ran, and the flag stayed false for the whole write while every line of the mechanism was present and read as correct. It is in `props` AND on the descriptor now, with a comment saying why both.
2. **The staging fix named a path the task does not create** (P2). Round six added `src/presentation/appIdPrefix.ts` to the `git add` and a second file-table row for it, while the task creates `src/presentation/views/app-id-prefix.ts` — so the repair for an unstaged file introduced a `git add` that fails outright. Self-inflicted, in the commit that fixed the staging class.
3. **A busy dialog would have contained NO focusable element** (P2). Task 6 disables every form control and round six's instruction disabled Cancel too — and `:disabled` matches no focusable selector, so `focusableWithin()` returns empty, Tab walks out of the dialog, and the `Escape` listener bound to `.rp-dialog` stops receiving keys, defeating the handler the same step adds. `DialogHost` states the invariant in its own comment and `dialogKinds.test.ts` proves it per kind — but not in the busy state, which is why nothing would have caught it. Cancel is `aria-disabled` now, focusable and announced while refusing, with a case asserting the trap is non-empty while busy.

**Two spec items deliberately NOT given a task**, both because the spec names them as gaps with owners rather than as work: `project.negative-amount`'s two-fields-one-code defect (owned by the first slice to put a Money field on a form; recorded in Task 6's error-map comment), and the calibration form's `coincident-points` banner case — `KnownDistanceForm` is not converted here, since slice 7's gesture already works and converting it would widen the slice for no behaviour. `routeError`'s banner path is proven by Task 1 and by Task 6's vault-failure case instead.

**Type consistency.** `routeError(error, map, toUserMessage)` has the same three parameters at every call site (Tasks 3, 4). `FieldErrorMap<TInput>` and `RoutedError<TInput>` are spelled identically in Tasks 1, 3, 4 and 6. `UseFormCommit` exposes `values` / `fieldErrors` / `banner` / `submitting` / `setField` / `submit` in Tasks 3 and 6; `UseFieldCommit` exposes `draft` / `error` / `pending` / `onInput` / `onCommit` / `onCancel` in Tasks 4 and 9, and its options take a REQUIRED `notify: (error: AppError) => void` in both, and Task 9 instantiates it ONCE PER ROW with `history.run` delegating to `execute` — the reversible wrapping stays `commitEdit`'s, one seam up. `FieldError` takes `{ message }` and hands `{ inputId, aria }` down a scoped slot in Tasks 2, 6 and 9 — no call site spells an id. `RenovationProjectCommandServices.createProject` is `Command<CreateProjectInput, Result<{ project: Loaded<Project> }, RepositoryError>>` in Tasks 5 and 6.
