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
import { onBeforeUnmount, ref, watch } from 'vue';
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

/**
 * Both call sites only run once `.rp-dialog` exists: `onKeydown` is bound to that element
 * itself, so it cannot fire before the ref does, and the `current` watcher below runs
 * `flush: 'post'` — after the render its own change triggered has committed. A `dialogEl
 * === null` guard here would be a branch no legitimate call can ever take, which is a
 * comment asserting a stronger guarantee than a coverage floor could ever verify; the cast
 * states the same guarantee as a type rather than as an unreachable `if`.
 */
function focusableWithin(): HTMLElement[] {
	const dialog = dialogEl.value as HTMLElement;
	return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

function inertBackground(): void {
	const overlay = (dialogEl.value as HTMLElement).parentElement as HTMLElement; // .rp-dialog-overlay
	const parent = overlay.parentElement as HTMLElement; // the view root the host mounts inside
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

	// Cast, not a guarded branch: every one of the four kind components renders at least
	// one focusable control (a Cancel/Close button, unconditionally) — `dialogKinds.test.ts`
	// is what proves that per kind. Were `focusable` ever empty despite it, `first` and
	// `last` would both be `undefined`, `active === first`/`active === last` would both be
	// false (`document.activeElement` is never itself `undefined`), and neither `.focus()`
	// call below would run — the SAME outcome an early return would have produced, just
	// without a branch a real dialog can never take.
	const focusable = focusableWithin();
	const first = focusable[0] as HTMLElement;
	const last = focusable.at(-1) as HTMLElement;

	// No `|| active === null` fallback: this app never focuses an SVG node next to a dialog
	// (Konva draws to `<canvas>`, an `HTMLElement`), and `document.activeElement` in a
	// Chromium document is `<body>` rather than `null` when nothing else holds focus, so
	// that arm cannot be taken by any input this component will ever see.
	const active = document.activeElement;
	const leavingForwards = !event.shiftKey && active === last;
	const leavingBackwards = event.shiftKey && active === first;
	if (leavingForwards) {
		event.preventDefault();
		first.focus();
	} else if (leavingBackwards) {
		event.preventDefault();
		last.focus();
	}
}

/**
 * `flush: 'post'` rather than an internal `await nextTick()`: this callback needs
 * `dialogEl` bound to the just-mounted `.rp-dialog` element, which only exists once the
 * render triggered by `current` changing has committed. A default ('pre') watcher paired
 * with its own `await nextTick()` raced a caller's own single `await nextTick()` for the
 * same microtask — both settle off the SAME flush promise, and whichever attached its
 * continuation first (the caller, since it runs before this component's watcher body
 * reaches its `await`) runs first, so the caller's assertions saw the DOM update but not
 * yet this watcher's `inert`/focus side effects. `post` runs synchronously within the
 * flush that already committed the DOM, so a single `await nextTick()` at the call site
 * is enough.
 */
watch(
	current,
	(descriptor) => {
		if (descriptor === null) {
			releaseBackground();
			previouslyFocused?.focus();
			previouslyFocused = null;
			return;
		}
		// Cast, not a guarded branch: same reasoning as `onKeydown`'s comment above — every
		// element this app can focus is an `HTMLElement`.
		previouslyFocused = document.activeElement as HTMLElement | null;
		inertBackground();
		focusableWithin()[0]?.focus();
	},
	{ flush: 'post' },
);

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
