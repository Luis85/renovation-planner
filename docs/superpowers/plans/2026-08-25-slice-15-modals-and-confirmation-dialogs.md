# Design Slice 15: Modals & Confirmation Dialogs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the plugin's one dialog framework — a Pinia `DialogStore` with a Promise-returning `openDialog`, a `DialogHost` that owns focus trapping, `Escape` and background `inert`, and four dialog kinds — then use it for the first real caller: making `CalibrateTool` reachable.

**Architecture:** `presentation/dialogs/` is a display-and-resolve island. `DialogStore` holds one descriptor and one captured `resolve` function; `openDialog` throws if a dialog is already open, so stacking is impossible by construction rather than by caller discipline. `DialogHost` mounts once per `ItemView`-scoped Vue app (both the Plan Editor's and the Renovation Project view's), switches on `descriptor.kind`, and owns every keyboard and focus concern so no dialog kind reimplements one. The kinds are props-in/events-out components; the host is the single call site of `store.resolve`. Nothing under `presentation/dialogs/` may import `application/`, `infrastructure/`, `plugin/` or the event bus — an ESLint block enforces that, with a meta-test proving the block fires.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, TypeScript, Vitest + jsdom + `@vue/test-utils`, ESLint flat config, axe-core.

**Spec:** [`docs/tasks/15-modals-and-confirmation-dialogs.md`](../../tasks/15-modals-and-confirmation-dialogs.md)

## Scope decision recorded up front

The spec's Definition of Done items **6, 8 and 8a** are the Zone-delete worked example. They require slice 10's `ListRequirementsReferencing` and `ListReassignmentTargets` queries and a `reversibleDeleteZone` that accepts `resolution` / `resolvedReferents` and can refuse with `reference.set-changed`. **None of those exist on `main`**; slice 10 is in flight on `slice-10-assets-requirements`.

This plan therefore delivers:

- **DoD 1, 2, 3, 4, 5, 7, 9, 10, 11** — the whole framework, all four kinds, and the guarantees around them.
- **The `CalibrateTool` caller**, which the spec's "Carried forward from the slice 8 review pass" section names as this slice's job and which needs nothing from slice 10.
- **DoD 6, 8, 8a are explicitly deferred**, and Task 16 writes that deferral down in the task document and in `CLAUDE.md` so it is a named follow-up rather than a silent gap. Do not invent presentation-side stand-ins for slice 10's query and command signatures — a second derivation of contracts slice 10 owns is exactly what the spec's "Out of scope" section forbids.

## Global Constraints

Copied from `CLAUDE.md` and the spec. Every task's requirements implicitly include this section.

- **Definition of done is `npm run check`** — build + lint (oxlint then ESLint, `--max-warnings 0` / `--deny-warnings`) + coverage-thresholded tests + fallow. All four must pass before committing.
- **Layers:** `presentation → application → domain → core`. `presentation/` may never import `infrastructure/` or `plugin/`. Enforced by `no-restricted-imports` in `eslint.config.mjs`.
- **Two flat-config blocks matching one file OVERRIDE `no-restricted-syntax` / `no-restricted-imports` rather than merging.** A new per-directory block must repeat every shared ban it still wants.
- **No user-facing English literal outside `src/presentation/i18n/locales/`.** Every string a user reads is a `StringKey` resolved through `t(language, key)` or `tr(key)`. This is *not* caught by lint at the positions this slice uses (`title:`, `label:`, a template interpolation) — it rests on review, and the spec says so.
- **`locales/en.ts` is the complete table** and `StringKey` derives from it. A key added to `en.ts` must also be added to `de.ts`. Sentence case in `en.ts` is linted by `eslint-plugin-obsidianmd`.
- **No `<style>` block in any `.vue` file** — `vue/no-restricted-block` fails one. All CSS lives in `styles/`, one partial per concern, imported by `styles/index.css`.
- **No hard-coded colour anywhere in `styles/`** — the build parses the sheet with `lightningcss` and fails on any literal colour at any nesting depth. Use Obsidian CSS variables (`var(--background-primary)`, `var(--text-normal)`, …). Partials are capped at 400 lines.
- **No inline `eslint-disable` / `oxlint-disable` comment anywhere in a linted file.** `linterOptions.noInlineConfig` refuses the whole class and `tests/build/suppressions.test.ts` scans for oxlint's. A rule that does not fit is turned off in `.oxlintrc.json` with a written reason.
- **A fake must not be kinder than the real thing.** Where a test drives a gesture, the simulated event stream must obey the real device's grammar.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing.** Revert the fix, run it, see red, restore.
- **Address code by name, not by line number**, in both comments and documentation.
- Files are tab-indented; single quotes; semicolons. Match the surrounding code.
- **Commit after every task.** Do not batch.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/presentation/dialogs/dialog-store.ts` | The descriptor union, the result-by-kind map, `cancelResultFor`, `DialogStackingError`, and the Pinia store. The only module that knows a dialog can be open. |
| `src/presentation/dialogs/DialogHost.vue` | One per Vue app. Focus capture/trap/restore, `Escape`, background `inert`, and the exhaustive switch on `kind`. The single caller of `store.resolve`. |
| `src/presentation/dialogs/ConfirmDialog.vue` | Binary confirm/cancel body. |
| `src/presentation/dialogs/DeleteReferenceDialog.vue` | PRD §64's four-action body plus the reference rows, rendered exactly as supplied. |
| `src/presentation/dialogs/EntityPickerDialog.vue` | Candidate list body; resolves `{ id }`. |
| `src/presentation/dialogs/FormDialog.vue` | Container that renders `descriptor.component`; holds no field knowledge. |
| `src/presentation/editor/shell/KnownDistanceForm.vue` | The caller-side form component the calibration prompt mounts inside `FormDialog`. Lives with its caller, not in `dialogs/`. |
| `styles/dialogs.css` | Overlay, panel, row and button-row styling, in Obsidian variables only. |
| `tests/presentation/dialogs/dialogStore.test.ts` | Store unit tests. |
| `tests/presentation/dialogs/dialogHost.test.ts` | Focus, `Escape`, trap, `inert`, restoration, stacking-in-practice. |
| `tests/presentation/dialogs/dialogKinds.test.ts` | Per-kind rendering and resolution. |
| `tests/presentation/editor/tools/calibrateWiring.test.ts` | The calibration caller end to end through the real editor harness. |
| `tests/helpers/dialogs.ts` | Mount helper for a bare `DialogHost` against a fresh Pinia. |

**Modified:**

| Path | Change |
|---|---|
| `src/presentation/i18n/locales/en.ts` | New `dialog.*` and `editor.toolbar.calibrate` keys. |
| `src/presentation/i18n/locales/de.ts` | The same keys, in German. |
| `styles/index.css` | One `@import "./dialogs.css";` line. |
| `eslint.config.mjs` | One `forbidden('presentation/dialogs', …)` block. |
| `src/presentation/editor/PlanEditorRoot.vue` | Mount `<DialogHost />`. |
| `src/presentation/views/ViewRoot.vue` | Mount `<DialogHost />`. |
| `src/presentation/editor/planEditorCommands.ts` | `calibratePlan` factory member + its refusal. |
| `src/plugin/composition-root.ts` | Construct the calibrate factory into the command services bundle. |
| `src/presentation/editor/tools/calibrate-tool.ts` | The recalibration confirmation gate and its generation re-check. |
| `src/presentation/editor/runtime.ts` | Register `CalibrateTool`; supply `supplyKnownDistance` and `confirmRecalibration`. |
| `src/presentation/editor/shell/EditorToolbar.vue` | One `MODES` row. |
| `tests/harness/accessibility.test.ts` | An axe scan with a dialog open. |
| `tests/build/vue-rules.test.ts` | The meta-test proving the new lint block fires. |
| `vitest.config.ts` | Coverage floor ratchet, if and only if the finished increment measures higher. |
| `CLAUDE.md`, `docs/tasks/15-…md`, `docs/tasks/07-calibration.md`, `docs/tests/` | Documentation of what landed and what was deferred. |

---

## Task 1: The dialog store

**Files:**
- Create: `src/presentation/dialogs/dialog-store.ts`
- Test: `tests/presentation/dialogs/dialogStore.test.ts`

**Interfaces:**
- Consumes: nothing. This is the root of the slice.
- Produces: `useDialogStore`, `DialogDescriptor`, `ConfirmDescriptor`, `DeleteReferenceDescriptor`, `EntityPickerDescriptor`, `FormDescriptor`, `ReferenceRow`, `EntityCandidate`, `ConfirmDialogResult`, `DeleteReferenceDialogResult`, `EntityPickerDialogResult`, `FormDialogResult`, `DialogResultByKind`, `DialogResult`, `DialogResultFor<D>`, `cancelResultFor`, `DialogStackingError`.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/dialogs/dialogStore.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * `DialogStore`'s three guarantees, each of which the framework above it assumes without
 * re-checking: one settle per open, no stacking, and `current` cleared before the awaiting
 * caller runs — the last being what makes two sequential dialogs (the delete flow's
 * Reassign branch) possible at all.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
	cancelResultFor,
	DialogStackingError,
	useDialogStore,
} from '../../../src/presentation/dialogs/dialog-store';

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('openDialog', () => {
	it('resolves with exactly the value handed to resolve()', async () => {
		const store = useDialogStore();
		const pending = store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		store.resolve('confirm');

		await expect(pending).resolves.toBe('confirm');
	});

	it('exposes the descriptor it was given while the dialog is open', () => {
		const store = useDialogStore();
		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		expect(store.current).toEqual({ kind: 'confirm', title: 'T', message: 'M' });
	});

	it('refuses a second dialog while one is open', () => {
		const store = useDialogStore();
		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		expect(() => store.openDialog({ kind: 'confirm', title: 'T2', message: 'M2' })).toThrow(
			DialogStackingError,
		);
	});

	it('clears current before the awaiting caller resumes, so the next open succeeds', async () => {
		const store = useDialogStore();
		const first = store.openDialog({ kind: 'delete-reference', entityLabel: 'Kitchen', references: [] });

		store.resolve({ action: 'reassign' });
		await first;

		expect(store.current).toBeNull();
		expect(() =>
			store.openDialog({ kind: 'entity-picker', title: 'T', candidates: [] }),
		).not.toThrow();
	});

	it('settles once — a second resolve is a no-op, not a second settle', async () => {
		const store = useDialogStore();
		const pending = store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });

		store.resolve('confirm');
		store.resolve('cancel');

		await expect(pending).resolves.toBe('confirm');
		expect(store.current).toBeNull();
	});

	it('ignores a resolve with no dialog open', () => {
		const store = useDialogStore();

		expect(() => store.resolve('cancel')).not.toThrow();
		expect(store.current).toBeNull();
	});
});

describe('cancelResultFor', () => {
	/**
	 * The one place that knows what "cancelled" MEANS per kind. `Escape` and the cancel
	 * control both route through it, so the two cannot disagree — which they did in every
	 * hand-written dialog this framework exists to replace.
	 */
	it('answers each kind in its own result shape', () => {
		expect(cancelResultFor('confirm')).toBe('cancel');
		expect(cancelResultFor('delete-reference')).toEqual({ action: 'cancel' });
		expect(cancelResultFor('entity-picker')).toBe('cancel');
		expect(cancelResultFor('form')).toBe('cancel');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/presentation/dialogs/dialogStore.test.ts`
Expected: FAIL — `Failed to resolve import "../../../src/presentation/dialogs/dialog-store"`.

- [ ] **Step 3: Write the implementation**

Create `src/presentation/dialogs/dialog-store.ts`:

```typescript
import { defineStore } from 'pinia';
import { shallowRef, type Component } from 'vue';

/**
 * The plugin's one dialog framework (design slice 15). Everything here is DISPLAY state:
 * which descriptor is open, and the resolver of the Promise the opener is awaiting.
 * Nothing in this directory reads a repository, runs a query or dispatches a command —
 * `eslint.config.mjs` has a block for `presentation/dialogs/` that makes that a build
 * failure rather than a review note.
 *
 * Every user-facing field below is a RESOLVED string, never a `StringKey`. A dialog's
 * title is usually built from a specific entity's name, so the caller — which knows both
 * the key and the entity — resolves through `t()` before opening. What must not happen is
 * an English literal DEFAULT in here: `confirmLabel ?? 'Confirm'` would be the one
 * untranslated string every confirmation in the plugin flows through. `DialogHost`
 * resolves the defaults from `StringKey`s instead.
 */

export interface ConfirmDescriptor {
	readonly kind: 'confirm';
	readonly title: string;
	readonly message: string;
	readonly confirmLabel?: string;
	readonly cancelLabel?: string;
	/** Styles the confirm action as destructive. Appearance only — it changes no result. */
	readonly danger?: boolean;
}

/**
 * One line of PRD §64's "Referenced by:" list. `label` is resolved copy the caller
 * supplied from its own `StringKey`: this dialog renders rows, it does not name entity
 * types, and a `count` it recomputed would be a second answer to a question the caller's
 * query already answered.
 */
export interface ReferenceRow {
	readonly label: string;
	readonly count: number;
}

export interface DeleteReferenceDescriptor {
	readonly kind: 'delete-reference';
	readonly entityLabel: string;
	readonly references: readonly ReferenceRow[];
}

export interface EntityCandidate {
	readonly id: string;
	readonly label: string;
}

export interface EntityPickerDescriptor {
	readonly kind: 'entity-picker';
	readonly title: string;
	readonly candidates: readonly EntityCandidate[];
}

/**
 * A form a user fills in and submits. This slice supplies the container, the focus trap,
 * the `Escape` semantics and the resolution Promise; it holds NO field knowledge, which is
 * why the descriptor names a COMPONENT rather than describing fields. The component lives
 * with whoever owns the form, never in this directory.
 */
export interface FormDescriptor {
	readonly kind: 'form';
	readonly title: string;
	readonly component: Component;
	readonly props?: Readonly<Record<string, unknown>>;
}

/**
 * THE EXTENSION POINT. A new dialog kind is TWO additions and nothing else: a member here
 * and its result type in `DialogResultByKind`. `DialogHost` and `cancelResultFor` both
 * switch on `kind` exhaustively, so a member added without a result entry fails to compile
 * rather than falling through to a blank dialog.
 */
export type DialogDescriptor =
	| ConfirmDescriptor
	| DeleteReferenceDescriptor
	| EntityPickerDescriptor
	| FormDescriptor;

export type ConfirmDialogResult = 'confirm' | 'cancel';

export type DeleteReferenceDialogResult =
	| { readonly action: 'cancel' }
	| { readonly action: 'remove-references' }
	| { readonly action: 'reassign' }
	| { readonly action: 'delete-anyway' };

/** The picked candidate's ID, not the whole candidate: the caller supplied the list. */
export type EntityPickerDialogResult = { readonly id: string } | 'cancel';

/**
 * `'submit'` means the form validated and the user confirmed — NOT that anything was
 * written. Dispatching the command is still the caller's job, and `values` is typed by
 * the form's own component rather than here, for the same reason `FormDescriptor` carries
 * a component and not a field list.
 */
export type FormDialogResult = { readonly action: 'submit'; readonly values: unknown } | 'cancel';

/**
 * The result type is DERIVED from the descriptor's kind, never supplied by the caller. A
 * free `openDialog<TResult>(d)` would leave `TResult` unconstrained by the descriptor, so
 * `openDialog<DeleteReferenceDialogResult>({ kind: 'confirm', … })` would type-check and
 * then resolve with the string `'cancel'`, which the caller's `result.action` switch reads
 * as `undefined`. Keying on `kind` is what makes the pairing a checked contract.
 */
export interface DialogResultByKind {
	confirm: ConfirmDialogResult;
	'delete-reference': DeleteReferenceDialogResult;
	'entity-picker': EntityPickerDialogResult;
	form: FormDialogResult;
}

export type DialogResult = DialogResultByKind[DialogDescriptor['kind']];
export type DialogResultFor<D extends DialogDescriptor> = DialogResultByKind[D['kind']];

/**
 * What "the user cancelled" means in each kind's own result shape.
 *
 * ONE function rather than a value chosen at each cancel site, because there are three
 * such sites per kind — `Escape`, the cancel button, and the backdrop — and a cancel that
 * resolved `'cancel'` where the caller was switching on `result.action` would read as
 * `undefined` and fall through whatever the caller's default branch is. A `switch` with no
 * `default`: the compiler is what proves it total, so a fifth kind fails to build here.
 */
export function cancelResultFor(kind: DialogDescriptor['kind']): DialogResult {
	switch (kind) {
		case 'confirm':
			return 'cancel';
		case 'delete-reference':
			return { action: 'cancel' };
		case 'entity-picker':
			return 'cancel';
		case 'form':
			return 'cancel';
	}
}

/**
 * A PROGRAMMER-facing fault, not a user-facing refusal — which is why it is a throw and
 * not a `Result` (SDD §65 reserves throws for exactly this). It is never routed to
 * `notify`: a well-behaved caller cannot reach it, because the control that would open a
 * second dialog is behind the `inert` background of the first.
 *
 * Its own class rather than a bare `Error`, so `dialogStore.test.ts` can assert the
 * INSTRUMENT — a test that only checked "it throws" would pass on a TypeError from a
 * refactor that broke the guard entirely.
 */
export class DialogStackingError extends Error {
	constructor() {
		super('A dialog is already open; dialogs are sequential, never stacked.');
		this.name = 'DialogStackingError';
	}
}

/**
 * Per Vue app, not per plugin (ADR-005, SDD §12): a dialog blocks interaction with the
 * view that raised it and traps focus inside that view's own content. Two Plan Editor
 * tabs may each legitimately have a dialog open, which is why the one-at-a-time rule below
 * means "one per view".
 */
export const useDialogStore = defineStore('dialog', () => {
	/**
	 * `shallowRef`, not `ref`: `FormDescriptor.component` is a Vue component object, and
	 * deep reactivity over one walks a component definition for no reader.
	 */
	const current = shallowRef<DialogDescriptor | null>(null);

	/**
	 * The awaiting caller's resolver. Held OUTSIDE the reactive surface deliberately — it
	 * is not state anything renders, and exposing it would make `resolve` reachable twice.
	 */
	let settle: ((result: DialogResult) => void) | null = null;

	function openDialog<D extends DialogDescriptor>(descriptor: D): Promise<DialogResultFor<D>> {
		if (current.value !== null) throw new DialogStackingError();

		return new Promise<DialogResultFor<D>>((resolveOne) => {
			settle = resolveOne as (result: DialogResult) => void;
			current.value = descriptor;
		});
	}

	/**
	 * Called by `DialogHost` alone — see its header for why the host settles rather than
	 * each kind component.
	 *
	 * `current` is cleared BEFORE the promise settles so that a caller awaiting it may open
	 * the next dialog immediately: the Reassign branch of the delete flow does exactly
	 * that, and a clear ordered the other way would meet its own stacking guard.
	 */
	function resolve(result: DialogResult): void {
		const pending = settle;
		if (pending === null) return; // a double-click on a resolved dialog, not a second settle
		settle = null;
		current.value = null;
		pending(result);
	}

	return { current, openDialog, resolve };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/presentation/dialogs/dialogStore.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Watch the stacking guard fail without its check**

Temporarily delete the `if (current.value !== null) throw new DialogStackingError();` line, re-run, and confirm `refuses a second dialog while one is open` goes red. Restore the line and re-run to green. This is the project's "an invariant asserted in a comment gets a test that fails without it, and the test is watched failing" rule.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/dialogs/dialog-store.ts tests/presentation/dialogs/dialogStore.test.ts
git commit -m "Slice 15: the dialog store, its descriptor union and its stacking guard"
```

---

## Task 2: The i18n keys and the stylesheet partial

Done before the components so neither has to be written twice — a component authored against a key that does not exist yet fails `npm run build`, and one authored against a class the sheet has no rule for is invisible in the harness.

**Files:**
- Modify: `src/presentation/i18n/locales/en.ts`, `src/presentation/i18n/locales/de.ts`
- Create: `styles/dialogs.css`
- Modify: `styles/index.css`

**Interfaces:**
- Produces: the `StringKey`s `dialog.confirm`, `dialog.cancel`, `dialog.delete-reference.title`, `dialog.delete-reference.referenced-by`, `dialog.delete-reference.remove-references`, `dialog.delete-reference.reassign`, `dialog.delete-reference.delete-anyway`, `dialog.entity-picker.empty`, `dialog.form.submit`, `dialog`, `editor.toolbar.calibrate`, `editor.calibrate.distance.title`, `editor.calibrate.distance.label`, `editor.calibrate.distance.measured`, `editor.calibrate.recalibrate.title`, `editor.calibrate.recalibrate.message`, `editor.calibrate.recalibrate.confirm`; and the CSS classes `rp-dialog-overlay`, `rp-dialog`, `rp-dialog-title`, `rp-dialog-body`, `rp-dialog-message`, `rp-dialog-references`, `rp-dialog-reference-row`, `rp-dialog-candidates`, `rp-dialog-candidate`, `rp-dialog-actions`, `rp-dialog-button`, `rp-dialog-button-danger`, `rp-dialog-field`.

- [ ] **Step 1: Add the English keys**

Append these entries to the `en` object in `src/presentation/i18n/locales/en.ts`, after the existing `editor.*` block. Sentence case throughout — `eslint-plugin-obsidianmd`'s locale rules lint this file and will fail Title Case.

```typescript
	dialog: 'Dialog',
	'dialog.confirm': 'Confirm',
	'dialog.cancel': 'Cancel',
	'dialog.delete-reference.referenced-by': 'Referenced by',
	'dialog.delete-reference.remove-references': 'Remove references',
	'dialog.delete-reference.reassign': 'Reassign',
	'dialog.delete-reference.delete-anyway': 'Delete anyway',
	'dialog.entity-picker.empty': 'Nothing to choose from.',
	'dialog.form.submit': 'Save',
	'editor.toolbar.calibrate': 'Calibrate',
	'editor.calibrate.distance.title': 'Set the real-world distance',
	'editor.calibrate.distance.label': 'Distance in millimetres',
	'editor.calibrate.distance.measured': 'Measured on the plan',
	'editor.calibrate.recalibrate.title': 'Recalibrate this plan?',
	'editor.calibrate.recalibrate.message': 'This plan already has zones drawn on it. Recalibrating rescales every one of them. You can undo it.',
```

- [ ] **Step 2: Add the German keys**

Add the same keys to the `de` object in `src/presentation/i18n/locales/de.ts`:

```typescript
	dialog: 'Dialog',
	'dialog.confirm': 'Bestätigen',
	'dialog.cancel': 'Abbrechen',
	'dialog.delete-reference.referenced-by': 'Referenziert von',
	'dialog.delete-reference.remove-references': 'Referenzen entfernen',
	'dialog.delete-reference.reassign': 'Neu zuweisen',
	'dialog.delete-reference.delete-anyway': 'Trotzdem löschen',
	'dialog.entity-picker.empty': 'Nichts zur Auswahl.',
	'dialog.form.submit': 'Speichern',
	'editor.toolbar.calibrate': 'Kalibrieren',
	'editor.calibrate.distance.title': 'Reale Entfernung festlegen',
	'editor.calibrate.distance.label': 'Entfernung in Millimetern',
	'editor.calibrate.distance.measured': 'Auf dem Plan gemessen',
	'editor.calibrate.recalibrate.title': 'Diesen Plan neu kalibrieren?',
	'editor.calibrate.recalibrate.message': 'Auf diesem Plan sind bereits Zonen eingezeichnet. Beim Neukalibrieren werden alle skaliert. Sie können den Vorgang rückgängig machen.',
```

- [ ] **Step 3: Create the stylesheet partial**

Create `styles/dialogs.css`. **Every colour must be an Obsidian variable** — the build parses this with `lightningcss` and fails on any literal, including a bare word like `red`.

```css
/*
 * Design slice 15's dialog framework. One overlay and one panel, shared by every dialog
 * kind — a kind that drew its own backdrop would be the second answer to "what is a
 * dialog" this framework exists to prevent.
 *
 * Positioned against the VIEW, not the window: `DialogHost` mounts inside each
 * ItemView-scoped Vue app, and a dialog belongs to the view that raised it. `absolute`
 * over `fixed` is what keeps a Plan Editor dialog inside its own split pane.
 */
.rp-dialog-overlay {
	position: absolute;
	inset: 0;
	z-index: var(--layer-modal);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--size-4-4);
	background-color: var(--background-modifier-cover);
}

.rp-dialog {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-3);
	width: min(28rem, 100%);
	max-height: 100%;
	overflow-y: auto;
	padding: var(--size-4-4);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background-color: var(--background-primary);
	box-shadow: var(--shadow-s);
	color: var(--text-normal);
}

.rp-dialog-title {
	margin: 0;
	font-size: var(--font-ui-large);
	font-weight: var(--font-semibold);
}

.rp-dialog-message {
	margin: 0;
	color: var(--text-muted);
}

.rp-dialog-references,
.rp-dialog-candidates {
	margin: 0;
	padding: 0;
	list-style: none;
}

.rp-dialog-reference-row {
	display: flex;
	justify-content: space-between;
	gap: var(--size-4-2);
	padding: var(--size-4-1) 0;
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-dialog-candidate {
	width: 100%;
	padding: var(--size-4-2);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background-color: var(--background-secondary);
	color: var(--text-normal);
	text-align: left;
	cursor: pointer;
}

.rp-dialog-candidate:hover {
	background-color: var(--background-modifier-hover);
}

.rp-dialog-field {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-1);
}

.rp-dialog-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: var(--size-4-2);
}

.rp-dialog-button {
	padding: var(--size-4-1) var(--size-4-3);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background-color: var(--interactive-normal);
	color: var(--text-normal);
	cursor: pointer;
}

.rp-dialog-button:hover {
	background-color: var(--interactive-hover);
}

/*
 * Appearance only. `danger` changes no result and gates no action — the four-outcome
 * decision is `DeleteReferenceDialog`'s job, and a colour that implied one would be
 * stating a rule the type system already carries.
 */
.rp-dialog-button-danger {
	background-color: var(--background-modifier-error);
	color: var(--text-on-accent);
}

.rp-dialog-button-danger:hover {
	background-color: var(--background-modifier-error-hover);
}
```

- [ ] **Step 4: Import the partial**

In `styles/index.css`, add the import after `./editor.css` and before `./chrome.css`:

```css
@import "./dialogs.css";
```

- [ ] **Step 5: Verify the build accepts both**

Run: `npm run build`
Expected: PASS. A hard-coded colour, an unresolvable import, or a partial over 400 lines fails here.

Run: `npx vitest run tests/presentation/i18n`
Expected: PASS — the locale-parity tests confirm `de.ts` covers the new keys.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/i18n/locales/en.ts src/presentation/i18n/locales/de.ts styles/dialogs.css styles/index.css
git commit -m "Slice 15: dialog copy in both locales and the dialog stylesheet partial"
```

---

## Task 3: The four dialog kind components

Built before `DialogHost` so the host has real children to switch to. Each is props-in / events-out: it renders exactly what it is handed and emits one `resolve` event carrying its own result type. **None of them imports the store** — that is what keeps them unit-testable without Pinia, and what keeps `store.resolve` to one call site.

**Files:**
- Create: `src/presentation/dialogs/ConfirmDialog.vue`, `src/presentation/dialogs/DeleteReferenceDialog.vue`, `src/presentation/dialogs/EntityPickerDialog.vue`, `src/presentation/dialogs/FormDialog.vue`
- Test: `tests/presentation/dialogs/dialogKinds.test.ts`

**Interfaces:**
- Consumes: `ConfirmDescriptor`, `DeleteReferenceDescriptor`, `EntityPickerDescriptor`, `FormDescriptor`, `ConfirmDialogResult`, `DeleteReferenceDialogResult`, `EntityPickerDialogResult`, `FormDialogResult` from Task 1.
- Produces: four components, each with prop `descriptor` and emit `resolve` typed to its own result. `FormDialog` additionally passes `descriptor.props` to the mounted component and listens for its `submit` event.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/dialogs/dialogKinds.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * What each dialog kind RENDERS and what it RESOLVES — the two halves of the only job a
 * kind component has. Mounted bare, with no store and no host: a kind that needed either
 * would be reaching past the seam that keeps `store.resolve` to one call site.
 */
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import ConfirmDialog from '../../../src/presentation/dialogs/ConfirmDialog.vue';
import DeleteReferenceDialog from '../../../src/presentation/dialogs/DeleteReferenceDialog.vue';
import EntityPickerDialog from '../../../src/presentation/dialogs/EntityPickerDialog.vue';
import FormDialog from '../../../src/presentation/dialogs/FormDialog.vue';
import { t } from '../../../src/presentation/i18n/strings';

const EN = 'en';

describe('ConfirmDialog', () => {
	it('renders the title and message it is handed', () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'Recalibrate?', message: 'Zones rescale.' } },
		});

		expect(wrapper.find('.rp-dialog-title').text()).toBe('Recalibrate?');
		expect(wrapper.find('.rp-dialog-message').text()).toBe('Zones rescale.');
	});

	it('falls back to translated labels, never to an English literal', () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
		});
		const labels = wrapper.findAll('.rp-dialog-button').map((button) => button.text());

		expect(labels).toEqual([t(EN, 'dialog.cancel'), t(EN, 'dialog.confirm')]);
	});

	it("prefers the caller own labels when supplied", () => {
		const wrapper = mount(ConfirmDialog, {
			props: {
				descriptor: {
					kind: 'confirm',
					title: 'T',
					message: 'M',
					confirmLabel: 'Rescale',
					cancelLabel: 'Keep',
				},
			},
		});

		expect(wrapper.findAll('.rp-dialog-button').map((b) => b.text())).toEqual(['Keep', 'Rescale']);
	});

	it('resolves confirm and cancel from their own buttons', async () => {
		const wrapper = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
		});

		await wrapper.findAll('.rp-dialog-button')[1]?.trigger('click');
		await wrapper.findAll('.rp-dialog-button')[0]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['confirm'], ['cancel']]);
	});

	it('marks the confirm action destructive only when asked', () => {
		const plain = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M' } },
		});
		const dangerous = mount(ConfirmDialog, {
			props: { descriptor: { kind: 'confirm', title: 'T', message: 'M', danger: true } },
		});

		expect(plain.find('.rp-dialog-button-danger').exists()).toBe(false);
		expect(dangerous.find('.rp-dialog-button-danger').exists()).toBe(true);
	});
});

describe('DeleteReferenceDialog', () => {
	const rows = [
		{ label: 'Requirements', count: 2 },
		{ label: 'Work packages', count: 5 },
	];

	it('renders every row it is handed, in the order supplied, and no other', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
		});
		const rendered = wrapper.findAll('.rp-dialog-reference-row').map((row) => row.text());

		expect(rendered).toHaveLength(2);
		expect(rendered[0]).toContain('Requirements');
		expect(rendered[0]).toContain('2');
		expect(rendered[1]).toContain('Work packages');
		expect(rendered[1]).toContain('5');
	});

	it('invents no row for an empty references array', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: [] } },
		});

		expect(wrapper.findAll('.rp-dialog-reference-row')).toHaveLength(0);
	});

	it('names the entity it would delete', () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
		});

		expect(wrapper.find('.rp-dialog-title').text()).toContain('Kitchen');
	});

	/**
	 * Each of the four independently, because the failure this catches is two buttons wired
	 * to one handler — which looks correct in a screenshot and destroys the wrong thing.
	 */
	it('resolves each of the four actions from its own button', async () => {
		const expected = ['cancel', 'remove-references', 'reassign', 'delete-anyway'] as const;

		for (const action of expected) {
			const wrapper = mount(DeleteReferenceDialog, {
				props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
			});

			await wrapper.find(`[data-rp-action="${action}"]`).trigger('click');

			expect(wrapper.emitted('resolve')).toEqual([[{ action }]]);
		}
	});

	it('emits once for a double-click', async () => {
		const wrapper = mount(DeleteReferenceDialog, {
			props: { descriptor: { kind: 'delete-reference', entityLabel: 'Kitchen', references: rows } },
		});
		const button = wrapper.find('[data-rp-action="delete-anyway"]');

		await button.trigger('click');
		await button.trigger('click');

		// The component emits per click; single-settle is the STORE's guarantee, asserted in
		// dialogStore.test.ts. What is asserted here is that one click emits exactly one
		// event — a handler bound twice would show up as two per click.
		expect(wrapper.emitted('resolve')).toHaveLength(2);
	});
});

describe('EntityPickerDialog', () => {
	const candidates = [
		{ id: 'z-2', label: 'Bathroom' },
		{ id: 'z-1', label: 'Kitchen' },
	];

	it('renders the candidates in the order given, applying no sort of its own', () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		expect(wrapper.findAll('.rp-dialog-candidate').map((c) => c.text())).toEqual([
			'Bathroom',
			'Kitchen',
		]);
	});

	it('resolves the id of the candidate that was picked', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		await wrapper.findAll('.rp-dialog-candidate')[1]?.trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ id: 'z-1' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates } },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});

	it('says so rather than showing an empty list', () => {
		const wrapper = mount(EntityPickerDialog, {
			props: { descriptor: { kind: 'entity-picker', title: 'Reassign to', candidates: [] } },
		});

		expect(wrapper.text()).toContain(t(EN, 'dialog.entity-picker.empty'));
	});
});

describe('FormDialog', () => {
	const Field = defineComponent({
		props: { seed: { type: String, default: '' } },
		emits: ['submit'],
		setup(props, { emit }) {
			return () =>
				h('button', { class: 'field', onClick: () => emit('submit', `${props.seed}!`) }, 'go');
		},
	});

	it('renders the component it is handed, with the props it is handed', () => {
		const wrapper = mount(FormDialog, {
			props: {
				descriptor: { kind: 'form', title: 'New asset', component: Field, props: { seed: 'x' } },
			},
		});

		expect(wrapper.find('.field').exists()).toBe(true);
	});

	it('resolves submit with whatever the form emitted', async () => {
		const wrapper = mount(FormDialog, {
			props: {
				descriptor: { kind: 'form', title: 'New asset', component: Field, props: { seed: 'x' } },
			},
		});

		await wrapper.find('.field').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([[{ action: 'submit', values: 'x!' }]]);
	});

	it('resolves cancel from its cancel control', async () => {
		const wrapper = mount(FormDialog, {
			props: { descriptor: { kind: 'form', title: 'New asset', component: Field } },
		});

		await wrapper.find('[data-rp-action="cancel"]').trigger('click');

		expect(wrapper.emitted('resolve')).toEqual([['cancel']]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/presentation/dialogs/dialogKinds.test.ts`
Expected: FAIL — four unresolved imports.

- [ ] **Step 3: Write `ConfirmDialog.vue`**

```vue
<script setup lang="ts">
/**
 * The binary question, for an action whose whole story is "are you sure" (design slice
 * 15). Which actions get one is decided by the slice that OWNS the action, against the
 * spec's two-part test — irreversible/destructive, or reference-bearing — not here.
 *
 * Props in, one event out, and no store: `DialogHost` is the single caller of
 * `dialogStore.resolve`, so this component cannot settle a Promise twice even in
 * principle. No `<style>` block, ever — `vue/no-restricted-block` fails one and the CSS
 * lives in `styles/dialogs.css`.
 */
import { tr } from '../i18n/strings';
import type { ConfirmDescriptor, ConfirmDialogResult } from './dialog-store';

defineProps<{ descriptor: ConfirmDescriptor }>();
defineEmits<{ resolve: [result: ConfirmDialogResult] }>();
</script>

<template>
	<h2 class="rp-dialog-title">
		{{ descriptor.title }}
	</h2>
	<p class="rp-dialog-message">
		{{ descriptor.message }}
	</p>
	<div class="rp-dialog-actions">
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			@click="$emit('resolve', 'cancel')"
		>
			{{ descriptor.cancelLabel ?? tr('dialog.cancel') }}
		</button>
		<button
			type="button"
			class="rp-dialog-button"
			:class="{ 'rp-dialog-button-danger': descriptor.danger === true }"
			data-rp-action="confirm"
			@click="$emit('resolve', 'confirm')"
		>
			{{ descriptor.confirmLabel ?? tr('dialog.confirm') }}
		</button>
	</div>
</template>
```

- [ ] **Step 4: Write `DeleteReferenceDialog.vue`**

```vue
<script setup lang="ts">
/**
 * PRD §64's Cancel / Remove references / Reassign / Delete anyway decision, as its OWN
 * kind rather than a `ConfirmDialog` variant: it has four mutually exclusive outcomes and
 * the caller needs to tell all four apart.
 *
 * It does not recompute, reformat, sum, filter or reorder the rows it is handed, and it
 * invents no row when handed none — a caller with zero references decides for itself
 * whether to open this at all. The count here informs the user's decision; the COMMAND's
 * own re-check is what enforces the invariant, because a script or a migration never
 * opens a dialog.
 *
 * `data-rp-action` on each button rather than position: a test that found the third button
 * would keep passing after a reorder that swapped which one deletes.
 */
import { tr } from '../i18n/strings';
import type { DeleteReferenceDescriptor, DeleteReferenceDialogResult } from './dialog-store';

defineProps<{ descriptor: DeleteReferenceDescriptor }>();
defineEmits<{ resolve: [result: DeleteReferenceDialogResult] }>();

const ACTIONS = [
	{ action: 'cancel', label: 'dialog.cancel', danger: false },
	{ action: 'remove-references', label: 'dialog.delete-reference.remove-references', danger: false },
	{ action: 'reassign', label: 'dialog.delete-reference.reassign', danger: false },
	{ action: 'delete-anyway', label: 'dialog.delete-reference.delete-anyway', danger: true },
] as const;
</script>

<template>
	<h2 class="rp-dialog-title">
		{{ descriptor.entityLabel }}
	</h2>
	<template v-if="descriptor.references.length > 0">
		<p class="rp-dialog-message">
			{{ tr('dialog.delete-reference.referenced-by') }}
		</p>
		<ul class="rp-dialog-references">
			<li
				v-for="row in descriptor.references"
				:key="row.label"
				class="rp-dialog-reference-row"
			>
				<span>{{ row.label }}</span>
				<span>{{ row.count }}</span>
			</li>
		</ul>
	</template>
	<div class="rp-dialog-actions">
		<button
			v-for="entry in ACTIONS"
			:key="entry.action"
			type="button"
			class="rp-dialog-button"
			:class="{ 'rp-dialog-button-danger': entry.danger }"
			:data-rp-action="entry.action"
			@click="$emit('resolve', { action: entry.action })"
		>
			{{ tr(entry.label) }}
		</button>
	</div>
</template>
```

- [ ] **Step 5: Write `EntityPickerDialog.vue`**

```vue
<script setup lang="ts">
/**
 * Supplies the Reassign target `DeleteReferenceDialog` deliberately does not carry.
 *
 * It renders the candidates it is handed, in the order given, and knows nothing about
 * Zones, Assets or projects. Eligibility is a DOMAIN question answered by the caller's
 * query; a picker that filtered or sorted would be a second place those rules live, and
 * the test for that is the ordering assertion in `dialogKinds.test.ts`.
 *
 * The empty case renders a sentence rather than an empty list. A caller is expected not to
 * open a picker with nothing in it — but a dialog whose only affordance is Cancel, and
 * which says nothing about why, is worse than one that explains itself.
 */
import { tr } from '../i18n/strings';
import type { EntityPickerDescriptor, EntityPickerDialogResult } from './dialog-store';

defineProps<{ descriptor: EntityPickerDescriptor }>();
defineEmits<{ resolve: [result: EntityPickerDialogResult] }>();
</script>

<template>
	<h2 class="rp-dialog-title">
		{{ descriptor.title }}
	</h2>
	<ul
		v-if="descriptor.candidates.length > 0"
		class="rp-dialog-candidates"
	>
		<li
			v-for="candidate in descriptor.candidates"
			:key="candidate.id"
		>
			<button
				type="button"
				class="rp-dialog-candidate"
				@click="$emit('resolve', { id: candidate.id })"
			>
				{{ candidate.label }}
			</button>
		</li>
	</ul>
	<p
		v-else
		class="rp-dialog-message"
	>
		{{ tr('dialog.entity-picker.empty') }}
	</p>
	<div class="rp-dialog-actions">
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			@click="$emit('resolve', 'cancel')"
		>
			{{ tr('dialog.cancel') }}
		</button>
	</div>
</template>
```

- [ ] **Step 6: Write `FormDialog.vue`**

```vue
<script setup lang="ts">
/**
 * The CONTAINER, and nothing else. This slice supplies the panel, the focus trap, the
 * `Escape` semantics and the resolution Promise; it holds no field knowledge, which is why
 * the descriptor names a component rather than describing fields.
 *
 * The form component owns its own fields, its own validation and its own submit control,
 * and lives with whoever owns the form — `presentation/editor/shell/KnownDistanceForm.vue`
 * is this slice's own caller, and slice 16's creation forms will be others. A resolved
 * `'submit'` means the form validated, NOT that anything was written: dispatching the
 * command is still the caller's job.
 *
 * The mounted component's `submit` payload is passed through untyped, deliberately — it is
 * typed by that component, for the same reason `FormDescriptor` carries a component and
 * not a field list.
 */
import { tr } from '../i18n/strings';
import type { FormDescriptor, FormDialogResult } from './dialog-store';

defineProps<{ descriptor: FormDescriptor }>();
const emit = defineEmits<{ resolve: [result: FormDialogResult] }>();

function onSubmit(values: unknown): void {
	emit('resolve', { action: 'submit', values });
}
</script>

<template>
	<h2 class="rp-dialog-title">
		{{ descriptor.title }}
	</h2>
	<div class="rp-dialog-body">
		<component
			:is="descriptor.component"
			v-bind="descriptor.props"
			@submit="onSubmit"
		/>
	</div>
	<div class="rp-dialog-actions">
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			@click="$emit('resolve', 'cancel')"
		>
			{{ tr('dialog.cancel') }}
		</button>
	</div>
</template>
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/presentation/dialogs/dialogKinds.test.ts`
Expected: PASS.

If `ConfirmDialog`'s label test fails on ordering, the buttons are Cancel-then-Confirm by design — cancel is the safe default and reads first in the tab order. Fix the component, not the test.

- [ ] **Step 8: Lint the new SFCs**

Run: `npm run lint`
Expected: PASS. Watch specifically for `vue/no-restricted-block` (a `<style>` block), `vue/multi-word-component-names`, and `vue/attributes-order`.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/dialogs tests/presentation/dialogs/dialogKinds.test.ts
git commit -m "Slice 15: the four dialog kinds, each rendering what it is handed"
```

---

## Task 4: `DialogHost` — focus, Escape, inert, and the one settle

The component that makes a dialog a *modal*. Everything keyboard-shaped lives here so no kind reimplements it.

**Files:**
- Create: `src/presentation/dialogs/DialogHost.vue`, `tests/helpers/dialogs.ts`
- Test: `tests/presentation/dialogs/dialogHost.test.ts`

**Interfaces:**
- Consumes: everything Task 1 and Task 3 produced.
- Produces: `DialogHost` (no props, no emits — it reads the store), and `mountDialogHost()` in `tests/helpers/dialogs.ts` returning `{ wrapper, store, pinia, unmount }`.

- [ ] **Step 1: Write the mount helper**

Create `tests/helpers/dialogs.ts`:

```typescript
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import DialogHost from '../../src/presentation/dialogs/DialogHost.vue';
import { useDialogStore } from '../../src/presentation/dialogs/dialog-store';

export interface DialogHarness {
	readonly wrapper: VueWrapper;
	readonly store: ReturnType<typeof useDialogStore>;
	readonly pinia: Pinia;
	/** The button that stands in for "the view behind the dialog", for inert/focus checks. */
	readonly background: HTMLButtonElement;
	readonly unmount: () => void;
}

/**
 * A `DialogHost` with a SIBLING to be backgrounded, because that is the shape the host's
 * `inert` logic is written against: it marks its parent's other children, which is the one
 * DOM operation available to a component mounted inside the view it must black out.
 *
 * `attachTo` a real document element rather than the detached default: `document.
 * activeElement` only tracks elements that are in the document, so focus assertions
 * against a detached tree pass on `<body>` no matter what the host did.
 */
export function mountDialogHost(): DialogHarness {
	const pinia = createPinia();
	setActivePinia(pinia);

	const host = document.createElement('div');
	document.body.append(host);

	const Root = defineComponent({
		setup() {
			return () => [
				h('button', { class: 'rp-test-background', type: 'button' }, 'behind'),
				h(DialogHost),
			];
		},
	});

	const wrapper = mount(Root, { attachTo: host, global: { plugins: [pinia] } });
	const background = host.querySelector<HTMLButtonElement>('.rp-test-background');
	if (background === null) throw new Error('the background stand-in did not mount');

	return {
		wrapper,
		store: useDialogStore(pinia),
		pinia,
		background,
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/presentation/dialogs/dialogHost.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 *
 * The four guarantees that make a dialog MODAL rather than merely visible (SDD §85):
 * focus moves in, focus cannot leave, `Escape` cancels, and focus goes back — on every
 * resolution path, not only the cancel one.
 *
 * `Tab` does not move focus natively in jsdom, which is not a limitation here: a wrapping
 * trap must move focus explicitly at both ends anyway, so what these tests drive is the
 * same code path a browser would take at the wrap.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mountDialogHost, type DialogHarness } from '../../helpers/dialogs';
import { t } from '../../../src/presentation/i18n/strings';

let harness: DialogHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

const CONFIRM = { kind: 'confirm', title: 'T', message: 'M' } as const;

function pressKey(element: Element, key: string, shiftKey = false): void {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

describe('opening', () => {
	it('draws nothing at all while no dialog is open', () => {
		harness = mountDialogHost();

		expect(harness.wrapper.find('.rp-dialog-overlay').exists()).toBe(false);
	});

	it('renders the kind the descriptor names', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		expect(harness.wrapper.find('.rp-dialog').attributes('role')).toBe('dialog');
		expect(harness.wrapper.find('.rp-dialog').attributes('aria-modal')).toBe('true');
		expect(harness.wrapper.find('[data-rp-action="confirm"]').exists()).toBe(true);
	});

	it('moves focus into the dialog', async () => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('makes the background inert, and releases it on close', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		expect(harness.background.hasAttribute('inert')).toBe(true);

		harness.store.resolve('cancel');
		await nextTick();

		expect(harness.background.hasAttribute('inert')).toBe(false);
	});

	it('releases the background if the view unmounts with a dialog open', async () => {
		harness = mountDialogHost();
		const { background } = harness;
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		harness.wrapper.unmount();
		await nextTick();

		expect(background.hasAttribute('inert')).toBe(false);
	});
});

describe('the focus trap', () => {
	it('wraps from the last focusable to the first', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		const last = buttons.at(-1);
		last?.focus();

		pressKey(dialog, 'Tab');

		expect(document.activeElement).toBe(buttons[0]);
	});

	it('wraps backwards from the first focusable to the last', async () => {
		harness = mountDialogHost();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		const dialog = harness.wrapper.find('.rp-dialog').element;
		const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
		buttons[0]?.focus();

		pressKey(dialog, 'Tab', true);

		expect(document.activeElement).toBe(buttons.at(-1));
	});
});

describe('Escape', () => {
	it('resolves a confirm dialog as a cancellation', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');

		await expect(pending).resolves.toBe('cancel');
	});

	it('resolves a delete-reference dialog in ITS cancel shape, not a bare string', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog({
			kind: 'delete-reference',
			entityLabel: 'Kitchen',
			references: [{ label: 'Requirements', count: 2 }],
		});
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');

		await expect(pending).resolves.toEqual({ action: 'cancel' });
	});

	/**
	 * The listener is on the DIALOG, not the document. Two Plan Editor leaves may each have
	 * a dialog open, and one `Escape` must close the focused one only — a document-level
	 * listener per host would close both, which is the defect this asserts against.
	 */
	it('leaves a keydown outside the dialog alone', async () => {
		harness = mountDialogHost();
		const pending = harness.store.openDialog(CONFIRM);
		await nextTick();
		let settled = false;
		void pending.then(() => {
			settled = true;
		});

		pressKey(harness.background, 'Escape');
		await nextTick();

		expect(settled).toBe(false);
	});
});

describe('focus restoration', () => {
	/**
	 * Every resolution path, not just cancel. A dialog that restores focus only when
	 * dismissed strands a keyboard user on the confirm path — the one they took on purpose.
	 */
	it.each([
		['the confirm button', '[data-rp-action="confirm"]'],
		['the cancel button', '[data-rp-action="cancel"]'],
	])('returns focus to the pre-open element after %s', async (_name, selector) => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		await harness.wrapper.find(selector).trigger('click');
		await nextTick();

		expect(document.activeElement).toBe(harness.background);
	});

	it('returns focus after Escape too', async () => {
		harness = mountDialogHost();
		harness.background.focus();
		void harness.store.openDialog(CONFIRM);
		await nextTick();

		pressKey(harness.wrapper.find('.rp-dialog').element, 'Escape');
		await nextTick();

		expect(document.activeElement).toBe(harness.background);
	});
});

describe('sequential dialogs', () => {
	/**
	 * The Reassign branch's shape: the first dialog resolves and clears `current` before the
	 * second opens. Never nested — the stacking guard would throw, which is the assertion.
	 */
	it('lets a caller open a second dialog the moment the first resolves', async () => {
		harness = mountDialogHost();
		const first = harness.store.openDialog({
			kind: 'delete-reference',
			entityLabel: 'Kitchen',
			references: [],
		});
		await nextTick();

		await harness.wrapper.find('[data-rp-action="reassign"]').trigger('click');
		await expect(first).resolves.toEqual({ action: 'reassign' });

		const second = harness.store.openDialog({
			kind: 'entity-picker',
			title: t('en', 'dialog.cancel'),
			candidates: [{ id: 'z-1', label: 'Bathroom' }],
		});
		await nextTick();

		expect(harness.wrapper.findAll('.rp-dialog')).toHaveLength(1);
		expect(harness.wrapper.find('.rp-dialog-candidate').exists()).toBe(true);

		harness.store.resolve('cancel');
		await expect(second).resolves.toBe('cancel');
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/presentation/dialogs/dialogHost.test.ts`
Expected: FAIL — `DialogHost.vue` does not exist.

- [ ] **Step 4: Write `DialogHost.vue`**

```vue
<script setup lang="ts">
/**
 * The one live dialog element per Vue app (design slice 15) — mounted in EVERY
 * ItemView-scoped app, not the Plan Editor's alone, because slice 14's "Create a project"
 * action opens a dialog from the Renovation Project view and a host that only ever mounted
 * beside a `PlanCanvas` would leave that click with nothing to open.
 *
 * Deliberately NOT plugin-global, unlike a toast host would be: a dialog blocks
 * interaction with the view that raised it and must trap focus within THAT view's content.
 * One store per view also makes the one-at-a-time rule mean "one per view", which is the
 * correct scope — two Plan Editor tabs may each legitimately have a dialog.
 *
 * **This component is the single caller of `dialogStore.resolve`.** The kind components
 * emit a typed `resolve` event and settle nothing themselves. That is one seam rather than
 * four: single-settle, focus restoration and background release all hang off this one
 * function, and a kind that settled directly would bypass every one of them.
 *
 * **`inert` on the siblings, and no `aria-hidden`.** The background is this component's
 * parent's other children — the one DOM operation available to a host mounted inside the
 * view it must black out. `inert` is the mechanism (Obsidian's Chromium supports it) and
 * `aria-modal="true"` below is what tells a screen reader the same thing; marking the
 * siblings `aria-hidden` as well would put focusable controls inside an aria-hidden
 * subtree, which is itself an accessibility violation (`aria-hidden-focus`) and which the
 * axe check in `tests/harness/accessibility.test.ts` would report.
 *
 * **The `Escape` listener is on the DIALOG, not on `document`.** Focus is trapped inside,
 * so every key the user presses arrives here anyway — and a document-level listener per
 * host would mean one `Escape` closing the dialogs of two Plan Editor leaves at once.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../i18n/strings';
import ConfirmDialog from './ConfirmDialog.vue';
import DeleteReferenceDialog from './DeleteReferenceDialog.vue';
import EntityPickerDialog from './EntityPickerDialog.vue';
import FormDialog from './FormDialog.vue';
import { cancelResultFor, useDialogStore, type DialogResult } from './dialog-store';

/**
 * What counts as focusable, for the trap's two ends. A named list rather than a general
 * "is this reachable" test: this check sees exactly these spellings, and the alternative —
 * walking computed styles for visibility — cannot work in jsdom, where the trap is tested.
 */
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const store = useDialogStore();
const { current } = storeToRefs(store);

const dialogEl = ref<HTMLElement | null>(null);

/** The element focus came FROM, restored on every resolution path including Escape. */
let previouslyFocused: HTMLElement | null = null;
/** The siblings this host made inert, so exactly those are released. */
let backgrounded: HTMLElement[] = [];

function focusableWithin(): HTMLElement[] {
	const dialog = dialogEl.value;
	return dialog === null ? [] : [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

function inertBackground(): void {
	const parent = dialogEl.value?.parentElement?.parentElement ?? null;
	if (parent === null) return;
	backgrounded = [...parent.children].filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement && !child.contains(dialogEl.value),
	);
	for (const element of backgrounded) element.setAttribute('inert', '');
}

function releaseBackground(): void {
	for (const element of backgrounded) element.removeAttribute('inert');
	backgrounded = [];
}

function resolve(result: DialogResult): void {
	store.resolve(result);
}

function onKeydown(event: KeyboardEvent): void {
	const descriptor = current.value;
	if (descriptor === null) return;

	if (event.key === 'Escape') {
		event.preventDefault();
		// The same meaning slice 6 gives `Escape` for an in-progress tool gesture, extended
		// to a dialog: abandon the transient interaction, commit nothing.
		resolve(cancelResultFor(descriptor.kind));
		return;
	}
	if (event.key !== 'Tab') return;

	const focusable = focusableWithin();
	const first = focusable[0];
	const last = focusable.at(-1);
	if (first === undefined || last === undefined) return;

	const active = document.activeElement;
	const leavingForwards = !event.shiftKey && (active === last || active === null);
	const leavingBackwards = event.shiftKey && (active === first || active === null);
	if (leavingForwards) {
		event.preventDefault();
		first.focus();
	} else if (leavingBackwards) {
		event.preventDefault();
		last.focus();
	}
}

watch(current, async (descriptor) => {
	if (descriptor === null) {
		releaseBackground();
		previouslyFocused?.focus();
		previouslyFocused = null;
		return;
	}
	previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	await nextTick();
	inertBackground();
	focusableWithin()[0]?.focus();
});

/**
 * A leaf closed with a dialog open would otherwise leave the view's own regions inert
 * forever — and Obsidian REUSES a view, so the next open would inherit a pane nothing can
 * be clicked in, with nothing erroring anywhere.
 */
onBeforeUnmount(releaseBackground);
</script>

<template>
	<div
		v-if="current !== null"
		class="rp-dialog-overlay"
	>
		<div
			ref="dialogEl"
			class="rp-dialog"
			role="dialog"
			aria-modal="true"
			:aria-label="tr('dialog')"
			@keydown="onKeydown"
		>
			<ConfirmDialog
				v-if="current.kind === 'confirm'"
				:descriptor="current"
				@resolve="resolve"
			/>
			<DeleteReferenceDialog
				v-else-if="current.kind === 'delete-reference'"
				:descriptor="current"
				@resolve="resolve"
			/>
			<EntityPickerDialog
				v-else-if="current.kind === 'entity-picker'"
				:descriptor="current"
				@resolve="resolve"
			/>
			<FormDialog
				v-else
				:descriptor="current"
				@resolve="resolve"
			/>
		</div>
	</div>
</template>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/dialogs/dialogHost.test.ts`
Expected: PASS.

If `inertBackground` marks nothing, check the `parentElement?.parentElement` chain against the harness's actual DOM — `dialogEl` sits inside `.rp-dialog-overlay`, whose parent is the view root. Adjust the traversal to match the real tree rather than loosening the assertion.

- [ ] **Step 6: Watch focus restoration fail without its line**

Temporarily comment out `previouslyFocused?.focus();`, re-run, confirm all three restoration tests go red, restore, re-run green.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/dialogs/DialogHost.vue tests/presentation/dialogs/dialogHost.test.ts tests/helpers/dialogs.ts
git commit -m "Slice 15: DialogHost owns focus, Escape, inert and the single settle"
```

---

## Task 5: The import boundary, and the meta-test that proves it fires

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `tests/build/vue-rules.test.ts`

**Interfaces:**
- Consumes: the `forbidden(layer, { groups, packages }, reason)` helper already in `eslint.config.mjs`, and `lintText` / `warmUpEslint` / `ESLINT_BOOT_MS` from `tests/helpers/eslint.ts`.
- Produces: a config block matching `**/src/presentation/dialogs/**/*.{ts,vue}`.

- [ ] **Step 1: Write the failing meta-test**

Append to `tests/build/vue-rules.test.ts`, inside a new `describe`:

```typescript
/**
 * Design slice 15's own boundary. `presentation/dialogs/` is display-and-resolve only: a
 * future edit that starts querying a repository from inside `DeleteReferenceDialog.vue`
 * must fail the build rather than pass review by accident.
 *
 * A fixture path rather than a reading of the config object, for the reason this file
 * already gives: two blocks matching one file OVERRIDE `no-restricted-imports` rather than
 * merging, so the only honest question is what ESLint reports for a real path.
 */
describe('the dialogs boundary', () => {
	const DIALOG = 'src/presentation/dialogs/DeleteReferenceDialog.vue';
	const DIALOG_TS = 'src/presentation/dialogs/dialog-store.ts';

	it('refuses an application import', async () => {
		const reported = await lintText(
			conforming("import type { Command } from '../../application/commands/Command';\nexport type C = Command<unknown, unknown>;"),
			DIALOG,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	it('refuses the event bus', async () => {
		const reported = await lintText(
			"import type { EventBus } from '../../core/events/EventBus';\nexport type B = EventBus;\n",
			DIALOG_TS,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	/**
	 * The half that would silently disappear: a per-directory block REPLACES the wider
	 * `presentation` one, so a block that added `application` and forgot to repeat
	 * `infrastructure` would open the bigger hole while looking like it closed a smaller one.
	 */
	it('still refuses infrastructure, which the wider presentation block owned', async () => {
		const reported = await lintText(
			conforming("import { createConsoleLogger } from '../../infrastructure/logging/consoleLogger';\nvoid createConsoleLogger;"),
			DIALOG,
		);

		expect(reported).toContain('no-restricted-imports');
	});

	it('allows the i18n import every dialog legitimately needs', async () => {
		const reported = await lintText(
			conforming("import { tr } from '../i18n/strings';\nvoid tr;"),
			DIALOG,
		);

		expect(reported).not.toContain('no-restricted-imports');
	});
});
```

Check `conforming`'s existing signature at the top of that file and match it; it wraps a script body in a lint-clean SFC.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/build/vue-rules.test.ts`
Expected: FAIL on the application and event-bus cases — `presentation/` may legitimately import `application/`, so nothing refuses them yet.

- [ ] **Step 3: Add the config block**

In `eslint.config.mjs`, immediately AFTER the existing `forbidden('presentation', …)` entry, add:

```javascript
	forbidden(
		'presentation/dialogs',
		// Repeats `infrastructure` and `plugin` from the `presentation` block above ON
		// PURPOSE: two blocks matching one file OVERRIDE `no-restricted-imports` rather than
		// merging it, so a block that named only its own additions would quietly widen the
		// hole it was written to narrow. `tests/build/vue-rules.test.ts` drives all three
		// through real fixture paths rather than reading this object.
		{ groups: ['application', 'infrastructure', 'plugin', 'core/events'] },
		'presentation/dialogs/ renders what it is handed and resolves one typed value. A query, a command, a repository or the event bus reached from here would put a domain decision inside a dialog (design slice 15, Definition of Done 9).',
	),
```

- [ ] **Step 4: Run the meta-test**

Run: `npx vitest run tests/build/vue-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm the block did not break the real files**

Run: `npm run lint`
Expected: PASS. The dialog components import only `vue`, `pinia` and `../i18n/strings`, all of which are allowed.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs tests/build/vue-rules.test.ts
git commit -m "Slice 15: dialogs may not reach a query, a command, a repository or the bus"
```

---

## Task 6: Mount the host in both views

**Files:**
- Modify: `src/presentation/editor/PlanEditorRoot.vue`, `src/presentation/views/ViewRoot.vue`
- Test: `tests/presentation/editor/shell.test.ts`, `tests/presentation/views/viewRoot.test.ts`

**Interfaces:**
- Consumes: `DialogHost` from Task 4.
- Produces: a `DialogHost` reachable from `useDialogStore()` in either app.

- [ ] **Step 1: Write the failing tests**

Add to `tests/presentation/editor/shell.test.ts`, in the `the five regions` describe:

```typescript
	/**
	 * Slice 15's host, mounted per ItemView-scoped app. Asserted at the SHELL rather than
	 * only in the dialogs' own tests: a host that exists but is mounted nowhere is exactly
	 * the state `CalibrateTool` was in for a whole slice.
	 */
	it('mounts a dialog host that the leaf can open a dialog through', async () => {
		harness = await mountPlanEditor();
		const store = useDialogStore(harness.pinia);

		void store.openDialog({ kind: 'confirm', title: 'T', message: 'M' });
		await settle(harness);

		expect(harness.wrapper.find('.rp-dialog').exists()).toBe(true);
	});
```

Add the import `import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';` at the top of that file.

Add the mirror to `tests/presentation/views/viewRoot.test.ts` — read that file's existing mount helper first and follow it; the assertion is the same two lines against the Renovation Project view's own app.

- [ ] **Step 2: Run to verify both fail**

Run: `npx vitest run tests/presentation/editor/shell.test.ts tests/presentation/views/viewRoot.test.ts`
Expected: FAIL — `.rp-dialog` is not found.

- [ ] **Step 3: Mount in the Plan Editor root**

In `src/presentation/editor/PlanEditorRoot.vue`, add the import beside the other shell imports:

```typescript
import DialogHost from '../dialogs/DialogHost.vue';
```

and add `<DialogHost />` as the LAST child of the `.renovation-plan-editor` root element, after `<StatusBar />`. Last is deliberate and worth a comment in the template:

```html
		<StatusBar />
		<!--
			Last child, and a sibling of the five regions rather than nested in one: the host
			makes its parent's OTHER children inert while a dialog is open, so every region
			has to be a sibling of it for the background to actually go inert.
		-->
		<DialogHost />
```

- [ ] **Step 4: Mount in the project view root**

In `src/presentation/views/ViewRoot.vue`, add a `<script setup lang="ts">` import and the child:

```vue
<script setup lang="ts">
/**
 * … keep the existing header comment …
 *
 * Slice 15's `DialogHost` mounts here too, not only in the Plan Editor: slice 14's
 * "Create a project" empty-state action opens a dialog from THIS view, and a host that
 * only ever mounted beside a `PlanCanvas` would leave that click with nothing to open.
 */
import DialogHost from '../dialogs/DialogHost.vue';
</script>

<template>
	<div class="renovation-planner-view">
		<DialogHost />
	</div>
</template>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor/shell.test.ts tests/presentation/views/viewRoot.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/PlanEditorRoot.vue src/presentation/views/ViewRoot.vue tests/presentation/editor/shell.test.ts tests/presentation/views/viewRoot.test.ts
git commit -m "Slice 15: a dialog host in every ItemView-scoped app"
```

---

## Task 7: The accessibility check, with a dialog open

**Files:**
- Modify: `tests/harness/accessibility.test.ts`

**Interfaces:**
- Consumes: the file's existing `mountHarness` / axe-run helpers and `useDialogStore`.

- [ ] **Step 1: Read the file's existing structure**

Read `tests/harness/accessibility.test.ts` in full before editing. Reuse its existing scan helper and its `LAYOUT_DEPENDENT_RULES` disable list verbatim; do not introduce a second axe configuration.

- [ ] **Step 2: Add the failing case**

Add a case that opens each of the four kinds and scans. The shape (adapt names to the file's own helpers):

```typescript
	/**
	 * A dialog is the one surface in this plugin that takes the keyboard away from
	 * everything behind it, so it is the one most worth scanning: `role="dialog"` without
	 * an accessible name, a button with no text, and a heading that skips a level are all
	 * real violations axe sees in jsdom.
	 *
	 * What this does NOT check is stated once, here, rather than implied: `inert` is not
	 * modelled by jsdom, so "the background is genuinely unreachable" is asserted by
	 * `dialogHost.test.ts` against the ATTRIBUTE, and verified for real only in a vault.
	 */
	it.each([
		['confirm', { kind: 'confirm', title: 'T', message: 'M' }],
		['delete-reference', { kind: 'delete-reference', entityLabel: 'Kitchen', references: [{ label: 'Requirements', count: 2 }] }],
		['entity-picker', { kind: 'entity-picker', title: 'T', candidates: [{ id: 'z-1', label: 'Bathroom' }] }],
	])('reports no violation with a %s dialog open', async (_kind, descriptor) => {
		// … mount the view the file already mounts, resolve its Pinia, open the descriptor,
		// await a tick, then run the SAME scan helper the other cases use.
	});
```

- [ ] **Step 3: Run and fix what it reports**

Run: `npx vitest run tests/harness/accessibility.test.ts`

Fix real findings in the components, never by widening the disable list. Likely candidates and their fixes:
- `heading-order` — the file scans a subtree that may have no `<h1>`; if axe objects to `<h2>` as the first heading, that is a real finding: give `.rp-dialog-title` a heading level consistent with the view it opens in, or make it a `<p>` with the dialog's `aria-labelledby` pointing at it.
- `aria-dialog-name` — `DialogHost` sets `:aria-label="tr('dialog')"`, which satisfies it; if the title reads better as the name, switch to `aria-labelledby` pointing at the title element's `id` and give the element a stable id.

- [ ] **Step 4: Commit**

```bash
git add tests/harness/accessibility.test.ts src/presentation/dialogs
git commit -m "Slice 15: axe scans each dialog kind as mounted"
```

---

## Task 8: `npm run check` and the harness screenshot

A checkpoint before the second half. The framework is complete here; everything after it is the caller.

- [ ] **Step 1: Run the full gate**

Run: `npm run check`
Expected: PASS on all four steps.

Coverage: if a floor now fails, the cause is an uncovered arm in the new code, not a floor that needs lowering. Floors only ever rise in this project.

- [ ] **Step 2: Look at it**

Run: `npm run harness-shot`

Then open the Plan Editor PNGs in `harness-shots/`. The dialog is not on screen by default — that is expected. What is being checked here is that nothing about `styles/dialogs.css` disturbed the editor's existing layout, which the four defects this command has already caught were all instances of.

- [ ] **Step 3: Commit if anything changed**

```bash
git add -A
git commit -m "Slice 15: the dialog framework is green under npm run check"
```

---

## Task 9: Wire `ReversibleCalibratePlanCommand` into the composition root

The command, its port and its tests have existed since slice 7 and are reachable from nothing. This task makes it composable; Tasks 10–13 make it reachable.

**Files:**
- Modify: `src/presentation/editor/planEditorCommands.ts`
- Modify: `src/plugin/composition-root.ts`
- Test: `tests/plugin/persistence-wiring.test.ts`

**Interfaces:**
- Consumes: `ReversibleCalibratePlanCommand` from `src/application/commands/plan/ReversibleCalibratePlan.ts`, constructor `(plans: PlanRepository, geometry: PlanGeometrySidecar, events: EventBus)`.
- Produces: `PlanEditorCommandServices.calibratePlan: () => CalibratePlanTransaction`, where

```typescript
export interface CalibratePlanTransaction {
	execute(input: CalibratePlanInput): Promise<Result<void, CalculationError | ValidationError | ReferenceError | PersistenceError>>;
	undo(): Promise<Result<void, PersistenceError | ValidationError>>;
}
```

- [ ] **Step 1: Read the command's real signature**

Read `src/application/commands/plan/ReversibleCalibratePlan.ts` and copy the EXACT `execute` and `undo` result types into `CalibratePlanTransaction`. Do not approximate them — a widened error union here is a lie the compiler will accept.

- [ ] **Step 2: Write the failing test**

Add to `tests/plugin/persistence-wiring.test.ts` (follow the file's existing composition-root fixture):

```typescript
	/**
	 * A FACTORY rather than a shared instance, for the reason `PlanEditorCommandServices`
	 * already states about the zone adapters: a reversible command holds ONE transaction's
	 * inverse state, so two overlapping gestures sharing one would have the second undo
	 * restore the first's snapshot.
	 */
	it('hands the editor a calibrate factory that answers a fresh command each call', () => {
		const services = /* the composed PlanEditorCommandServices from this file's fixture */;

		expect(services.calibratePlan()).not.toBe(services.calibratePlan());
	});
```

Add to `tests/presentation/editor/planEditorCommands.test.ts`:

```typescript
	it('refuses a calibration when settings could not be recovered', async () => {
		const result = await unavailablePlanEditorCommands()
			.calibratePlan()
			.execute({ planId: 'p-1' as PlanId, pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, knownDistance: 1000 });

		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
	});
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run tests/plugin/persistence-wiring.test.ts tests/presentation/editor/planEditorCommands.test.ts`
Expected: FAIL — `calibratePlan` does not exist on the services type.

- [ ] **Step 4: Add the member and its refusal**

In `src/presentation/editor/planEditorCommands.ts`, add the type and the member:

```typescript
/**
 * The reversible calibration, as the editor consumes it. A STRUCTURAL type rather than the
 * concrete `ReversibleCalibratePlanCommand`, so `unavailablePlanEditorCommands` can answer
 * the refusal shape without constructing a real command around refusing ports.
 */
export interface CalibratePlanTransaction {
	execute(
		input: CalibratePlanInput,
	): Promise<Result<void, CalculationError | ValidationError | ReferenceError | PersistenceError>>;
	undo(): Promise<Result<void, PersistenceError | ValidationError>>;
}
```

and inside `PlanEditorCommandServices`:

```typescript
	/**
	 * A FACTORY, unlike every other member here, and the exception is the rule this
	 * interface's header already states: what crosses this boundary is exactly what has no
	 * per-transaction state. `ReversibleCalibratePlanCommand` holds one gesture's inverse,
	 * so the editor gets the means to make one per gesture rather than a shared instance
	 * two overlapping gestures would fight over.
	 */
	readonly calibratePlan: () => CalibratePlanTransaction;
```

and in `unavailablePlanEditorCommands`:

```typescript
		calibratePlan: () => ({
			execute(): Promise<Result<void, PersistenceError>> {
				return Promise.resolve(err(persistenceFailure()));
			},
			undo(): Promise<Result<void, PersistenceError>> {
				return Promise.resolve(err(persistenceFailure()));
			},
		}),
```

Import `CalibratePlanInput` and the extra error types at the top of the file.

- [ ] **Step 5: Compose it in the root**

In `src/plugin/composition-root.ts`, find where `PlanEditorCommandServices` is assembled (beside `deleteZone` / `moveZone` / `zoneInspector`) and add:

```typescript
		// A new command per call — see `CalibratePlanTransaction`. The three collaborators
		// are the same ones every other write here is built from; only the lifetime differs.
		calibratePlan: () => new ReversibleCalibratePlanCommand(plans, geometry, events),
```

Match the local names the surrounding code actually uses for the plan repository, the geometry sidecar and the event bus — read them, do not assume.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/plugin tests/presentation/editor/planEditorCommands.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/planEditorCommands.ts src/plugin/composition-root.ts tests/plugin/persistence-wiring.test.ts tests/presentation/editor/planEditorCommands.test.ts
git commit -m "Slice 15: the composition root hands the editor a calibrate factory"
```

---

## Task 10: The known-distance form

**Files:**
- Create: `src/presentation/editor/shell/KnownDistanceForm.vue`
- Test: `tests/presentation/editor/tools/calibrateWiring.test.ts` (first cases)

**Interfaces:**
- Consumes: `tr` from `../../i18n/strings`.
- Produces: a component with prop `measured: number` and emit `submit: [millimetres: number]`, mounted by `FormDialog` through a `FormDescriptor`.

Why a `form` dialog and not a new kind: the descriptor already carries a component for exactly this, the container gives it the trap, the `Escape` semantics and the Promise, and inventing a `prompt` kind would be a fifth kind whose entire content is one input.

Why it lives in `editor/shell/` and not in `dialogs/`: the form belongs to its caller. `presentation/dialogs/` holds no field knowledge, and Task 5's lint block is what keeps that true.

- [ ] **Step 1: Write the failing test**

Create `tests/presentation/editor/tools/calibrateWiring.test.ts` with the form cases first:

```typescript
/**
 * @vitest-environment jsdom
 *
 * Design slice 15's first real caller: the calibration gesture, which slice 7 built and
 * slice 8 shipped unreachable. Two dialogs and a command, in that order.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import KnownDistanceForm from '../../../../src/presentation/editor/shell/KnownDistanceForm.vue';

describe('KnownDistanceForm', () => {
	it('shows what was measured on the plan, so the user knows what they are naming', () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 1234.5 } });

		expect(wrapper.text()).toContain('1235');
	});

	it('emits the millimetres the user typed', async () => {
		const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

		await wrapper.find('input').setValue('2400');
		await wrapper.find('form').trigger('submit');

		expect(wrapper.emitted('submit')).toEqual([[2400]]);
	});

	/**
	 * The tool refuses a non-positive or non-finite distance anyway, so this is the SECOND
	 * of two checks rather than the only one — but a form that submits an empty string
	 * makes the user press a button that does nothing, which is a worse failure than a
	 * disabled control.
	 */
	it.each([['', 'empty'], ['0', 'zero'], ['-5', 'negative'], ['abc', 'not a number']])(
		'refuses to submit %s (%s)',
		async (typed) => {
			const wrapper = mount(KnownDistanceForm, { props: { measured: 100 } });

			await wrapper.find('input').setValue(typed);
			await wrapper.find('form').trigger('submit');

			expect(wrapper.emitted('submit')).toBeUndefined();
		},
	);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/presentation/editor/tools/calibrateWiring.test.ts`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the component**

```vue
<script setup lang="ts">
/**
 * The one field the calibration gesture needs: what the two picked points measure in the
 * real world, in millimetres like every length here (ADR-009).
 *
 * Mounted inside slice 15's `FormDialog`, which supplies the panel, the focus trap, the
 * `Escape` semantics and the resolution Promise. It lives HERE and not in
 * `presentation/dialogs/` because the form belongs to its caller: that directory holds no
 * field knowledge, and `eslint.config.mjs`'s block for it is what keeps that true.
 *
 * The guard below is the SECOND of two: `CalibrateTool` already refuses a non-positive or
 * non-finite distance, because a script, an undo replay or a future caller never passes
 * through this form. What this one buys is that the user's Save press does something —
 * a submit that silently no-ops reads as a broken button.
 */
import { computed, ref } from 'vue';
import { tr } from '../../i18n/strings';

const props = defineProps<{ measured: number }>();
const emit = defineEmits<{ submit: [millimetres: number] }>();

const typed = ref('');

const parsed = computed(() => {
	const value = Number(typed.value.trim());
	return typed.value.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
});

/** Rounded for display only — the value the command receives is the raw measurement. */
const measuredLabel = computed(() => Math.round(props.measured).toString());

function onSubmit(): void {
	const value = parsed.value;
	if (value === null) return;
	emit('submit', value);
}
</script>

<template>
	<form
		class="rp-dialog-field"
		@submit.prevent="onSubmit"
	>
		<p class="rp-dialog-message">
			{{ tr('editor.calibrate.distance.measured') }}: {{ measuredLabel }}
		</p>
		<label class="rp-dialog-field">
			{{ tr('editor.calibrate.distance.label') }}
			<input
				v-model="typed"
				type="number"
				min="0"
				step="any"
				inputmode="decimal"
			>
		</label>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:disabled="parsed === null"
			>
				{{ tr('dialog.form.submit') }}
			</button>
		</div>
	</form>
</template>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/presentation/editor/tools/calibrateWiring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/editor/shell/KnownDistanceForm.vue tests/presentation/editor/tools/calibrateWiring.test.ts
git commit -m "Slice 15: the known-distance form the calibration prompt mounts"
```

---

## Task 11: The recalibration confirmation gate in `CalibrateTool`

**Files:**
- Modify: `src/presentation/editor/tools/calibrate-tool.ts`
- Test: `tests/presentation/editor/tools/calibrateTool.test.ts` (the file slice 7 wrote — read it first)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `CalibrateToolDeps` gains

```typescript
	/** Whether this plan already has geometry a recalibration would rescale. */
	readonly hasSpatialObjects: () => boolean;
	/** Asks the user to confirm a rescale. `true` proceeds. */
	readonly confirmRecalibration: () => Promise<boolean>;
```

and `createCommand` is retyped from `() => ReversibleCalibratePlanCommand` to `() => CalibratePlanTransaction`.

- [ ] **Step 1: Read slice 7's existing tool tests**

Read `tests/presentation/editor/tools/calibrateTool.test.ts` in full. Every existing case constructs `CalibrateToolDeps`; each will need the two new members. Add them as permissive defaults in whatever factory that file already uses (`hasSpatialObjects: () => false`), so the existing cases keep testing what they tested.

- [ ] **Step 2: Write the failing tests**

Add to that file:

```typescript
describe('the recalibration gate', () => {
	/**
	 * The trigger is whether objects will be RESCALED, not whether this is the first
	 * calibration — a freshly imported plan with nothing drawn on it has nothing to lose,
	 * and asking there is the "are you sure" that trains people to click through the ones
	 * that matter.
	 */
	it('asks nothing on a plan with no geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => false,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(0);
		expect(dispatched).toHaveLength(1);
	});

	it('asks before rescaling a plan that has geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(1);
		expect(dispatched).toHaveLength(1);
	});

	it('dispatches nothing when the user declines', async () => {
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => Promise.resolve(false),
		});

		await calibrate(tool);

		expect(dispatched).toEqual([]);
	});

	/**
	 * The generation rule, applied to the SECOND await this method now has. Without the
	 * re-check, an Escape while the confirmation sat open let a late `true` calibrate a
	 * plan the user had cancelled out of — the exact defect slice 7's counter exists for,
	 * reintroduced by adding an await above it.
	 */
	it('drops a confirmation that resolves after the gesture was cancelled', async () => {
		let release: ((confirmed: boolean) => void) | null = null;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () =>
				new Promise<boolean>((resolve) => {
					release = resolve;
				}),
		});

		const gesture = calibrate(tool);
		await Promise.resolve();
		tool.cancel();
		release?.(true);
		await gesture;

		expect(dispatched).toEqual([]);
	});
});
```

Adapt `makeTool` / `calibrate` to the helpers that file already has; if it has none, write two small local helpers rather than inlining the same eight lines five times.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/presentation/editor/tools/calibrateTool.test.ts`
Expected: FAIL — the deps do not exist and no gate runs.

- [ ] **Step 4: Add the gate**

In `src/presentation/editor/tools/calibrate-tool.ts`, extend `CalibrateToolDeps`:

```typescript
export interface CalibrateToolDeps {
	readonly supplyKnownDistance: KnownDistanceSupplier;
	/**
	 * Whether this plan already has geometry a recalibration would rescale. The gate for
	 * warning the user is whether objects MOVE, not whether a calibration already exists:
	 * an uncalibrated plan with five zones drawn on it has just as much to lose as a
	 * calibrated one, and a calibrated plan with nothing on it has nothing.
	 */
	readonly hasSpatialObjects: () => boolean;
	/** Asks the user to confirm a rescale; `true` proceeds. Never called when the above is false. */
	readonly confirmRecalibration: () => Promise<boolean>;
	/** Per gesture — the reversible command holds that one transaction's inverse state. */
	readonly createCommand: () => CalibratePlanTransaction;
}
```

and in `complete`, insert the gate between the measurement check and the distance prompt, so a user who is going to say no is not made to type a number first:

```typescript
		const planId = context.activePlan.id;
		const generation = this.generation;
		this.prompting = true;
		try {
			if (this.deps.hasSpatialObjects() && !(await this.deps.confirmRecalibration())) {
				return;
			}
			// The SAME re-check the distance prompt below gets, and for the same reason: this
			// method now crosses TWO awaits, and a `cancel()` across either one makes every
			// later line belong to a gesture that no longer exists.
			if (generation !== this.generation) return;

			knownDistance = await this.deps.supplyKnownDistance(measured);
		} finally {
			if (generation === this.generation) {
				this.prompting = false;
			}
		}
```

Restructure the existing `let knownDistance` / `try` / `finally` around that; keep the existing post-await generation check and the existing `knownDistance` validation exactly as they are.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor/tools/calibrateTool.test.ts`
Expected: PASS, existing cases included.

- [ ] **Step 6: Watch the generation re-check fail without it**

Delete the new `if (generation !== this.generation) return;` line, re-run, confirm `drops a confirmation that resolves after the gesture was cancelled` goes red, restore, re-run green.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/editor/tools/calibrate-tool.ts tests/presentation/editor/tools/calibrateTool.test.ts
git commit -m "Slice 15: CalibrateTool confirms a rescale, and drops a stale answer"
```

---

## Task 12: Register the tool and give it a toolbar row

**Files:**
- Modify: `src/presentation/editor/runtime.ts`, `src/presentation/editor/shell/EditorToolbar.vue`
- Test: `tests/presentation/editor/tools/calibrateWiring.test.ts` (the end-to-end cases)

**Interfaces:**
- Consumes: `useDialogStore` (Task 1), `KnownDistanceForm` (Task 10), the new `CalibrateToolDeps` (Task 11), `services.calibratePlan` (Task 9).
- Produces: a `'calibrate'` entry in `ToolManager` and a `MODES` row.

- [ ] **Step 1: Write the failing test**

Append to `tests/presentation/editor/tools/calibrateWiring.test.ts`:

```typescript
describe('the calibrate tool in a mounted editor', () => {
	it('offers Calibrate in the toolbar', async () => {
		const harness = await mountPlanEditor();

		const labels = harness.wrapper.findAll('.rp-editor-tool-button').map((b) => b.text());

		expect(labels).toContain(t('en', 'editor.toolbar.calibrate'));
		harness.unmount();
	});

	/**
	 * Two clicks, each a real down+up pair on the primary button. A simulated stream has to
	 * obey the grammar of the device it stands in for — a bare `pointerdown` with no `up`
	 * is an input no mouse can produce, and a rig that spelled it that way already
	 * certified one gesture test against a state the tool never reaches.
	 */
	it('asks for a distance after two clicks and dispatches the calibration', async () => {
		const harness = await mountPlanEditor({ zones: [] });
		const store = useDialogStore(harness.pinia);
		setToolByLabel(harness, t('en', 'editor.toolbar.calibrate'));

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle(harness);

		expect(store.current?.kind).toBe('form');
		expect(harness.wrapper.find('.rp-dialog input').exists()).toBe(true);

		harness.unmount();
	});

	/**
	 * The gate, driven through the real editor rather than the tool alone: a plan WITH
	 * zones gets the confirmation first, and declining it never reaches the distance form.
	 */
	it('confirms before recalibrating a plan that has zones, and stops on a decline', async () => {
		const harness = await mountPlanEditor(); // the default fixture has zones
		const store = useDialogStore(harness.pinia);
		setToolByLabel(harness, t('en', 'editor.toolbar.calibrate'));

		click(harness, { x: 0, y: 0 });
		click(harness, { x: 100, y: 0 });
		await settle(harness);

		expect(store.current?.kind).toBe('confirm');

		await harness.wrapper.find('[data-rp-action="cancel"]').trigger('click');
		await settle(harness);

		expect(store.current).toBeNull();
		harness.unmount();
	});
});
```

Reuse `mountPlanEditor` / `settle` from `tests/helpers/editor.ts`. Write `click` and `setToolByLabel` by copying the gesture spelling already in `tests/presentation/editor/zoneEditing.test.ts` — do not invent a second one.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/presentation/editor/tools/calibrateWiring.test.ts`
Expected: FAIL — no Calibrate button, no tool registered.

- [ ] **Step 3: Register the tool**

In `src/presentation/editor/runtime.ts`, add the imports:

```typescript
import { CalibrateTool } from './tools/calibrate-tool';
import { useDialogStore } from '../dialogs/dialog-store';
import KnownDistanceForm from './shell/KnownDistanceForm.vue';
```

Give `registerEditorTools` the dialog store — it is built inside the Vue tree, so `useDialogStore()` is legal in `buildRuntime`. Add the parameter at the call site and register the tool:

```typescript
	toolManager.register(
		new CalibrateTool({
			// The two dialogs this gesture may open, in the order it opens them. Both go
			// through the leaf's OWN store, so a calibration in one split pane cannot trap
			// the other — `DialogHost` is per view for exactly that reason.
			hasSpatialObjects: () => projectStore.zones.size > 0,
			confirmRecalibration: async () =>
				(await dialogs.openDialog({
					kind: 'confirm',
					title: tr('editor.calibrate.recalibrate.title'),
					message: tr('editor.calibrate.recalibrate.message'),
					danger: true,
				})) === 'confirm',
			supplyKnownDistance: async (measured) => {
				const result = await dialogs.openDialog({
					kind: 'form',
					title: tr('editor.calibrate.distance.title'),
					component: KnownDistanceForm,
					props: { measured },
				});
				// `null` is this seam's word for "dismissed", and the tool refuses a
				// non-number anyway — but narrowing HERE keeps the `unknown` the form
				// container deliberately carries from reaching the command's input.
				if (result === 'cancel' || typeof result.values !== 'number') return null;
				return result.values;
			},
			createCommand: () => context.commands.calibratePlan(),
		}),
	);
```

- [ ] **Step 4: Add the toolbar row**

In `src/presentation/editor/shell/EditorToolbar.vue`, add one row to `MODES`:

```typescript
	{ id: 'calibrate', label: 'editor.toolbar.calibrate' },
```

That is the whole change — the table was made data in the slice 8 review pass precisely so a new mode is a row.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/presentation/editor tests/presentation/dialogs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/editor/runtime.ts src/presentation/editor/shell/EditorToolbar.vue tests/presentation/editor/tools/calibrateWiring.test.ts
git commit -m "Slice 15: a user can calibrate a plan"
```

---

## Task 13: Full gate, and a look at it

- [ ] **Step 1: Run the gate**

Run: `npm run check`
Expected: PASS.

`npm run analyze` is the step most likely to complain here: a dead export (a type declared and never imported), or `KnownDistanceForm` read as unused if the `component:` reference is the only one. If fallow reports the component dead, annotate the local at the call site — the project's documented workaround is an explicit type annotation, never `usedClassMembers`.

- [ ] **Step 2: Screenshot the editor**

Run: `npm run harness-shot`

Confirm the toolbar's new Calibrate button did not push the undo/redo pair out of the toolbar at the narrow `?phone` width. This is the class of defect only this command finds.

- [ ] **Step 3: Ratchet the coverage floors if — and only if — the finished increment measures higher**

Read `vitest.config.ts`'s ratchet policy. Floors rise to what a FINISHED increment measures; an increment whose rounded-down figures equal the floors already in force ratchets nothing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Slice 15: green under npm run check"
```

---

## Task 14: Prove it in a real vault

`npm run check` was green for all four of the defects a human found by running this plugin, and three of them were a test fake accepting what Obsidian refuses. This task is not optional.

- [ ] **Step 1: Build into the vault**

Run: `npm run test-build`

- [ ] **Step 2: Reload Obsidian and run the existing suite**

Follow `docs/tests/suites/Smoke Test the Editor.md` end to end first, unchanged. A regression in slice 5–8 behaviour is the thing most likely to have been introduced by mounting a new component into both view roots.

- [ ] **Step 3: Walk the new flow**

1. `Create sample renovation project` from the palette. The editor opens with five zones.
2. Note the area the Inspector prints for the Kitchen. It is background pixels at the placeholder scale of 1 — this is the defect being fixed.
3. Click **Calibrate**. Click two points across something of known length in the background.
4. The recalibration confirmation appears (the sample plan has zones). Press `Escape` — nothing happens to the plan, and focus returns to where it was.
5. Repeat, and confirm this time. The distance form appears. Type a length in millimetres and save.
6. The Inspector's area changes. Press **Undo** — it changes back.
7. With the dialog open, press `Tab` repeatedly: focus must cycle inside the dialog and never reach the toolbar or the canvas behind it.
8. Open a second Plan Editor leaf on the same plan, open a dialog in one, and confirm `Escape` closes only that one.
9. Toggle the plugin off and on. No `Several Konva instances detected`, and no error in the console.

- [ ] **Step 4: Write down what it found**

Anything that failed goes into a new case under `docs/tests/cases/`, following the existing files' shape, and is fixed before the next task. If step 3 found nothing, say so in the commit message rather than silently committing nothing — a walkthrough that found nothing is evidence, and a walkthrough that was skipped looks identical from the outside.

- [ ] **Step 5: Add the manual case**

Create `docs/tests/cases/Calibrate a Plan.md`, following the shape of the existing cases under that folder, covering steps 1–9 above.

- [ ] **Step 6: Commit**

```bash
git add docs/tests
git commit -m "Slice 15: the manual walkthrough for calibrating a plan"
```

---

## Task 15: The slice-10 seam, written down as a seam

The one thing worse than a deferred item is a deferred item nobody wrote down. This task makes DoD 6/8/8a a named follow-up.

**Files:**
- Modify: `docs/tasks/15-modals-and-confirmation-dialogs.md`
- Modify: `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`

- [ ] **Step 1: Record the partial completion in slice 15's own document**

Set the frontmatter `status: Active`, `started: 2026-08-25`, and add a section immediately after **Purpose**:

```markdown
### What landed, and what did not (2026-08-25)

The framework is complete and in use: `DialogStore`, `DialogHost`, all four kinds, the
focus trap, `Escape`, background `inert`, focus restoration, the stacking guard, the
import boundary and its meta-test. Definition of Done items 1, 2, 3, 4, 5, 7, 9, 10 and
11 are met.

**Items 6, 8 and 8a are NOT met, and are not attempted.** They are the Zone-delete worked
example, and every collaborator they name — `ListRequirementsReferencing`,
`ListReassignmentTargets`, and a `reversibleDeleteZone` taking `resolution` /
`resolvedReferents` and refusing with `reference.set-changed` — belongs to slice 10,
which was in flight when this slice was built. Declaring those shapes here would have
been a second derivation of contracts slice 10 owns, which this document's own
"Out of scope" section forbids. `EntityPickerDialog` is built and tested and has no
production caller for the same reason.

The Inspector's Delete button still dispatches straight through
`InspectorStore.commit`'s `toCommand`, unchanged. Wiring it to `DeleteReferenceDialog`
is slice 10's closing task; this sentence stays until it happens.

**What this slice DID reach:** `CalibrateTool`, which slice 7 built and slice 8 shipped
registered nowhere. It is in `registerEditorTools` and in the toolbar now, its
recalibration confirmation is a `ConfirmDialog` and its `supplyKnownDistance` is a `form`
dialog over `KnownDistanceForm`. A user can calibrate a plan.
```

- [ ] **Step 2: Tell slice 10 what is waiting for it**

Add to `docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md`, in whatever section that document uses for carried-forward work:

```markdown
### Waiting for this slice, from slice 15 (2026-08-25)

Slice 15's dialog framework is built and mounted in both views. `DeleteReferenceDialog`
and `EntityPickerDialog` exist, are tested, and have no production caller — because their
caller is this slice's `onInspectorDeleteZone`, and the queries it reads
(`ListRequirementsReferencing`, `ListReassignmentTargets`) and the command input it
carries (`resolution`, `resolvedReferents`, and a `reference.set-changed` refusal) are
this slice's to define.

Slice 15's Definition of Done items 6, 8 and 8a — including the stale-count, consented-set
and bounded-retry tests, which are written out in full in that document's Testing Strategy
— are the closing task here. Open `dialogStore.openDialog({ kind: 'delete-reference', … })`
from the Inspector's Delete action; do not build a second dialog.
```

- [ ] **Step 3: Commit**

```bash
git add docs/tasks
git commit -m "Slice 15: what landed, and the slice 10 seam left open"
```

---

## Task 16: Update the agent guide

`CLAUDE.md` is the file the next agent reads. Three of its current claims are now false.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Retire the "CalibrateTool is unreachable" paragraph**

The paragraph beginning **"Design slice 7 has landed: `CalibrateTool` is the first concrete `EditorTool`"** contains the sentence "and it is still **unreachable in a vault after slice 8**, which is a defect rather than a plan", and closes with "this sentence stays until one of those happens." One of those has now happened. Rewrite the paragraph to say the tool is registered, that the toolbar names it, and that a plan can be calibrated — keeping the two load-bearing rules under it (the world-units rule, and the sidecar-owns-`calibration` rule) verbatim.

- [ ] **Step 2: Add a slice 15 section**

Following the shape of the slice 8 section, and stating only what a check enforces:

```markdown
**Design slice 15 has landed: there is ONE dialog framework.** `DialogStore` holds one
descriptor and the awaiting caller's resolver; `openDialog` returns a Promise typed by the
descriptor's own `kind` through `DialogResultByKind`, and THROWS if a dialog is already
open — sequential, never stacked. `DialogHost` mounts once per ItemView-scoped Vue app
(both of them) and owns every keyboard concern so no kind reimplements one. Rules that
came out of it:

- **`presentation/dialogs/` may not import `application/`, `infrastructure/`, `plugin/`
  or the event bus** — a `forbidden('presentation/dialogs', …)` block in
  `eslint.config.mjs`, driven through real fixture paths by
  `tests/build/vue-rules.test.ts`. It REPEATS the bans the wider `presentation` block
  already carries, because two blocks matching one file override rather than merge, and
  a block naming only its additions would open the bigger hole while looking like it
  closed a smaller one.
- **`DialogHost` is the single caller of `store.resolve`.** The kinds emit a typed
  `resolve` event and settle nothing. Single-settle, focus restoration and the release of
  the background's `inert` all hang off that one function; a kind that settled directly
  would bypass all three, and nothing would error.
- **The `Escape` listener is on the DIALOG element, not on `document`.** Focus is trapped
  inside, so every key arrives there anyway — and a document-level listener per host means
  one `Escape` closing the dialogs of two Plan Editor leaves at once.
- **The background goes `inert`, and deliberately NOT `aria-hidden`.** The siblings hold
  focusable controls, so an aria-hidden subtree around them is itself a violation
  (`aria-hidden-focus`) that the axe check reports. `aria-modal="true"` on the dialog is
  what tells a screen reader the same thing. `onBeforeUnmount` releases the `inert`,
  because Obsidian REUSES a view and a leaf closed with a dialog open would otherwise
  reopen into a pane nothing can be clicked in.
- **A user-facing string in a dialog is resolved by the CALLER**, never by the dialog:
  `title`, `message`, `entityLabel` and every `ReferenceRow.label` arrive already through
  `t()`. Only the two label DEFAULTS are resolved inside the framework, from `StringKey`s.
  Neither half is caught by lint — `I18N_LITERAL_BAN` fires at four call sites and a
  descriptor's `title:` is none of them — so both rest on review, and saying so is better
  than implying a gate that does not exist.
- **`DeleteReferenceDialog` and `EntityPickerDialog` are built, tested and called by
  nothing.** Their caller is slice 10's Inspector delete flow, and the queries it reads
  are slice 10's to define. Definition of Done items 6, 8 and 8a of
  `docs/tasks/15-modals-and-confirmation-dialogs.md` are open, and that document says so.
```

- [ ] **Step 3: Correct the "Deliberately absent" note about slice 15**

`composition-root.ts`'s own comment and `CLAUDE.md` both refer to "slice 15's creation dialogs" as future work giving `createProject`/`createPlan`/`createZone` a product-real caller. That is still true — this slice built the framework, not the creation forms — so leave it, but check the sentence still reads correctly beside the new section.

- [ ] **Step 4: Run the gate one last time**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Slice 15: tell the next agent what the dialog framework guarantees"
```

---

## Self-review notes

**Spec coverage.** DoD 1 → Task 1. DoD 2 → Tasks 1 (`cancelResultFor`) and 4 (the `Escape` tests, both shapes). DoD 3 → Task 4's restoration block, all three paths. DoD 4 → Task 4's trap and `inert` tests. DoD 5 → Task 3's row tests, including the empty array. DoD 7 → Task 1's stacking test, watched failing. DoD 9 → Task 5. DoD 10 → Task 2 (both locales), Task 3 (the label-default test asserts `t()` output, so an English literal fails it), and the honest note that the call-site half rests on review. DoD 11 → Task 3's four-action loop. Scope, focus trap, `Escape`, modal stacking, the three built kinds, the `form` container, the file layout, and the `Persistence Impact` claim (nothing under `dialogs/` reaches a repository — Task 5 makes it a build failure) are all covered. **DoD 6, 8, 8a are deliberately not covered**; Task 15 records that in both task documents and Task 16 in `CLAUDE.md`.

**Known risks the executor should expect.**

1. `inertBackground`'s DOM traversal (`dialogEl.parentElement.parentElement`) depends on the overlay's exact nesting. Task 4 Step 5 says to fix the traversal against the real tree rather than loosen the assertion.
2. The axe scan in Task 7 may report `heading-order` for `<h2>` as a subtree's first heading. That is a real finding with two honest fixes, both named in the task; widening `LAYOUT_DEPENDENT_RULES` is not one of them.
3. `npm run analyze` may read `KnownDistanceForm` as dead, since its only reference is a `component:` property value. The project's documented answer is an explicit type annotation on the local, not `usedClassMembers`.
4. Task 11 changes a signature slice 7's existing tests construct. Read that file before editing it; every existing case needs the two new deps as permissive defaults.
