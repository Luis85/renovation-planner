<script lang="ts">
/**
 * Module-scoped on purpose, and the ONLY reason this file has a plain `<script>` beside
 * its `<script setup>`: `src/` builds to one bundle (`dist/main.js`), so this module has
 * exactly one instance in the document no matter how many times `createApp()` runs — two
 * Plan Editor leaves are two separate apps (ADR-004) but the SAME compiled module. That is
 * what makes a bare counter here unique across every `DialogHost` alive at once, which
 * Vue's own `useId()` cannot promise (it is unique only PER APP, and closing that gap needs
 * an `app.config.idPrefix` set where `createApp()` is called — outside this directory).
 */
let hostCount = 0;
</script>

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
 * **The `Escape` listener is on the DIALOG, not on `document`.** Every key pressed WHILE
 * FOCUS IS INSIDE THE PANEL arrives here — a document-level listener per host would mean
 * one `Escape` closing the dialogs of two Plan Editor leaves at once, which this avoids.
 * It does not follow that every key press anywhere reaches here: a press on the backdrop
 * or on the panel's own padding would blur the focused control to `<body>` in a real
 * browser, which `.rp-dialog` does not contain, stranding `Escape` until the user clicked
 * back inside — `onMousedown` below is the fix for that half. The other half is not this
 * component's to fix: a click into Obsidian's own chrome (the view header, the ribbon, the
 * file explorer, another leaf) moves focus out of this view entirely, and `Escape` there
 * belongs to Obsidian, not to a dialog trapped inside one pane. That boundary is accepted,
 * not a defect.
 *
 * **This is not an Obsidian `Modal`, so Obsidian's own keymap stays live behind it.** No
 * `Scope` is pushed anywhere in this framework, and `onKeydown` calls `preventDefault()`
 * without `stopPropagation()` — so a key pressed inside the panel also reaches Obsidian's
 * document-level handler. A user hotkey bound to `Escape` fires alongside this cancel, and
 * the command palette is still one keystroke away while a dialog is open. `inert` takes the
 * VIEW away from the user, never the application: that is the honest scope of what "modal"
 * means here. Nothing in jsdom models a host keymap, so no test in this repository can see
 * any of it — it is a vault-walkthrough question, and it is written down here so the next
 * reader does not have to rediscover the boundary from an empty search.
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
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

/**
 * The id `.rp-dialog`'s `aria-labelledby` points at. `++hostCount` reads the module-scoped
 * counter declared in the plain `<script>` block above — see its comment for why that,
 * rather than Web Crypto, is what makes this collision-free across two `createApp()`
 * instances. Every one of the four kind components renders exactly one `.rp-dialog-title`,
 * unconditionally, so this id always resolves to something; a hypothetical fifth kind that
 * omitted the title element would leave `aria-labelledby` pointing at nothing, which is
 * this decision's one unstated assumption.
 */
const titleId = `rp-dialog-title-${++hostCount}`;

/** The element focus came FROM, restored on every resolution path including Escape. */
let previouslyFocused: HTMLElement | null = null;
/**
 * The siblings this host made inert, so exactly those are released. `inertBackground` sets
 * the attribute unconditionally and `releaseBackground` removes it unconditionally — safe
 * only because nothing else in this app sets `inert` on a sibling of a dialog host today;
 * a sibling that needed to stay inert for some OTHER reason while this dialog closes would
 * need this to track that instead of blindly clearing every element it backgrounded.
 *
 * It used to be a SNAPSHOT taken once at open time, and this paragraph used to be a warning
 * addressed to whoever made that unsafe: "`ViewRoot` now has one too — `<EmptyState
 * v-if="empty !== null">` ... harmless only because nothing in this slice ever opens a dialog
 * from `ViewRoot`, not because the hazard stopped applying. A later slice that wires a dialog
 * into `ViewRoot` inherits this exactly: check whether `empty` can still be toggling while
 * that dialog is open, and if so, this snapshot is what needs to widen."
 *
 * Design slice 16 wired that dialog, and the round that gave `ViewRoot` a
 * `ProjectIndexRebuilt` subscription made the answer YES: a restored pane hydrates against
 * the empty pre-layout index, a user opens the create dialog from the empty state, the
 * rebuild lands while it is open, and `v-else` replaces the inerted `EmptyState` with a
 * `ProjectList` full of focusable rows that the snapshot had never seen. Reported in review;
 * neither the wiring nor the subscription had come back to read this paragraph.
 *
 * So it is LIVE rather than a snapshot: `syncBackground` runs at open AND from a
 * `MutationObserver` on the parent's child list for as long as the dialog stays open, and
 * `backgrounded` is a `Set` so a re-sync cannot double-count an element it already holds.
 * That is the widening this docblock asked for rather than a mechanism beside it — the
 * failure is now unrepresentable instead of merely absent from the toggles somebody
 * enumerated, which is the same trade `PlanCanvas` made over its re-issued pointer move.
 *
 * **The one gap left, stated rather than glossed:** a `MutationObserver` callback is a
 * microtask, so a newly inserted sibling is non-`inert` for the tick between its insertion
 * and the sync. Nothing a user can act on lands in that window — it is shorter than any
 * input event — but it is not the same claim as "never", and a synchronous answer would
 * take a stable wrapper element in every host rather than a rule this component can hold
 * for all of them.
 */
let backgrounded = new Set<HTMLElement>();

/**
 * Disconnected by `releaseBackground` and never left running past a close: an observer
 * outliving its dialog would go on inerting siblings of a view with nothing open in it.
 */
let backgroundWatcher: MutationObserver | null = null;

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

/** Every current sibling of the dialog that this host has not already backgrounded. */
function syncBackground(parent: HTMLElement): void {
	for (const child of parent.children) {
		if (!(child instanceof HTMLElement) || child.contains(dialogEl.value)) continue;
		// No "have I already done this one" guard, deliberately: `backgrounded` is a `Set` so
		// the add is idempotent, and setting an attribute to the value it already holds is a
		// no-op. A guard here would be a branch that only ever exists to skip work already
		// proven free — untestable except by contriving a re-sync, and this repository's
		// branch floor is not somewhere to spend on that.
		backgrounded.add(child);
		child.setAttribute('inert', '');
	}
}

function inertBackground(): void {
	const overlay = (dialogEl.value as HTMLElement).parentElement as HTMLElement; // .rp-dialog-overlay
	const parent = overlay.parentElement as HTMLElement; // the view root the host mounts inside
	syncBackground(parent);
	// `childList` alone, and no `subtree`: the rule is about the dialog's own SIBLINGS, and
	// `inert` already covers every descendant of one, so watching the whole tree would wake
	// this on every keystroke inside the view for nothing.
	backgroundWatcher = new MutationObserver(() => {
		syncBackground(parent);
	});
	backgroundWatcher.observe(parent, { childList: true });
}

function releaseBackground(): void {
	backgroundWatcher?.disconnect();
	backgroundWatcher = null;
	for (const element of backgrounded) element.removeAttribute('inert');
	backgrounded = new Set();
}

function resolve(result: DialogResult): void {
	store.resolve(result);
}

/**
 * A press that would land focus NOWHERE is refused, rather than allowed to blur the panel.
 * Chromium moves focus to `<body>` when the user presses a non-focusable element, and
 * `onKeydown` is bound to `.rp-dialog` — so a press on the backdrop, or on the panel's own
 * padding, would otherwise leave `Escape` dead until the user clicked back inside. This is
 * the ONE half of that gap this component owns; see the header for the half it does not.
 *
 * `preventDefault` on `mousedown` preserves the current focus and cancels nothing else. A
 * press that landed on a focusable control returns early, so a button still takes focus and
 * still fires its click — `closest` rather than a direct match, because the press may land
 * on a `<span>` inside the button.
 *
 * `instanceof Element`, not `instanceof HTMLElement`: `closest()` is declared on `Element`,
 * so a press landing on an SVG glyph inside a button — exactly what Obsidian's `setIcon()`
 * renders — is an `SVGElement`, which fails an `HTMLElement` guard and would fall through
 * to `preventDefault()`, leaving the focus ring off a button the user did click. No dialog
 * kind renders an icon today, so nothing shipped manifests it.
 */
function onMousedown(event: MouseEvent): void {
	const target = event.target;
	if (target instanceof Element && target.closest(FOCUSABLE) !== null) return;
	event.preventDefault();
}

function onKeydown(event: KeyboardEvent): void {
	const descriptor = current.value;
	if (descriptor === null) return;

	if (event.key === 'Escape') {
		event.preventDefault();
		// Still handled here whether or not it acts: letting the key fall through to
		// Obsidian's own keymap mid-write would be a second surprise on top of the first.
		// A form whose write is in flight cannot be cancelled out from under it — the
		// framework never started that write, so it has no way to stop it either.
		if (descriptor.kind === 'form' && descriptor.busy?.value === true) return;
		// The same meaning slice 6 gives `Escape` for an in-progress tool gesture, extended
		// to a dialog: abandon the transient interaction, commit nothing.
		resolve(cancelResultFor(descriptor.kind));
		return;
	}
	if (event.key !== 'Tab') return;

	// `first`/`last` stay `HTMLElement | undefined` — every one of the four kind components
	// renders at least one focusable control (a Cancel/Close button, unconditionally;
	// `dialogKinds.test.ts` proves that per kind), so `focusable` is never actually empty,
	// but the guard against it is the optional chaining on `first?.focus()`/`last?.focus()`
	// below rather than a cast: one branch, not a branch plus an early return, and it keeps
	// the compiler checking the site the next edit here would touch.
	const focusable = focusableWithin();
	const first = focusable[0];
	const last = focusable.at(-1);

	// No `|| active === null` fallback: this app never focuses an SVG node next to a dialog
	// (Konva draws to `<canvas>`, an `HTMLElement`), and `document.activeElement` in a
	// Chromium document is `<body>` rather than `null` when nothing else holds focus, so
	// that arm cannot be taken by any input this component will ever see.
	const active = document.activeElement;
	const leavingForwards = !event.shiftKey && active === last;
	const leavingBackwards = event.shiftKey && active === first;
	if (leavingForwards) {
		event.preventDefault();
		first?.focus();
	} else if (leavingBackwards) {
		event.preventDefault();
		last?.focus();
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
 *
 * No `immediate: true`: with `flush: 'post'` an immediate run fires before `dialogEl` is
 * bound, which would hit `inertBackground`'s cast on a `null` ref and throw. Nothing in
 * this slice opens a dialog before this host is mounted (the calibrate flow opens from a
 * tool gesture, slice 14's from a click), but that is a constraint on WHEN this component
 * is mounted, not a fact `watch` enforces — this comment is the only thing stating it.
 */
watch(
	current,
	(descriptor) => {
		if (descriptor === null) {
			// `releaseBackground()` before `previouslyFocused?.focus()`, and load-bearing in
			// that order: Chromium refuses `focus()` on an element inside a still-`inert`
			// subtree, so focusing first would silently fail. jsdom implements no `inert`
			// behaviour at all, so no test here can catch a reorder of these two lines.
			releaseBackground();
			// A no-op, not a fallback, if `previouslyFocused` was removed from the DOM while
			// the dialog was open (the delete flows open from a control their own resolution
			// removes): `focus()` on a detached element does nothing, and focus is left
			// wherever the removal left it — typically `<body>`. Restoring to the view root
			// instead would be a behaviour change this task has no mandate for.
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
 * An unmount has TWO things to undo, and this hook did one of them.
 *
 * The background first: a leaf closed with a dialog open would otherwise leave the view's
 * own regions inert forever — and Obsidian REUSES a view, so the next open would inherit a
 * pane nothing can be clicked in, with nothing erroring anywhere.
 *
 * And then the awaiting caller. This used to settle nothing, under a comment calling that
 * deliberate: "a leaf's own `openDialog(...)` caller is gone with the leaf, so its `await`
 * is left pending forever rather than settled with a value nobody reads". A leaf close is no
 * longer the only unmount. `RenovationProjectView.rebind` tears this whole tree down and
 * rebuilds it on every `saveSettings`, with the leaf still OPEN — so a settings change while
 * the New Project form was up took the form away and left `ViewRoot.onCreateProject()`
 * suspended on a promise nothing would ever settle, holding the retired root's context alive
 * behind it. Reported in review.
 *
 * CANCEL rather than preserving the form across the swap, and the reason is not that
 * cancelling was the easier of the two. The descriptor's `dispatch` prop closes over the
 * root being replaced, so a form carried through would write through the very root `rebind`
 * exists to retire — under the PREVIOUS default project folder, which is one of the four
 * defects that made `deps` non-readonly in the first place. There is nothing to preserve
 * that would still point anywhere valid.
 *
 * Settling is safe on the leaf-close path this hook was written against too, which is why
 * one hook covers both: every caller of `openDialog` returns on `cancel`, so nothing
 * dispatches and nothing opens a second dialog into a tree that is unmounting. The one thing
 * it cannot stop is a form whose write is already in flight — the framework never started
 * that write — exactly as `onKeydown`'s `busy` branch says of `Escape`; its result is
 * dropped rather than acted on.
 */
onBeforeUnmount(() => {
	releaseBackground();
	const descriptor = current.value;
	if (descriptor !== null) store.resolve(cancelResultFor(descriptor.kind));
});
</script>

<template>
	<div
		v-if="current !== null"
		class="rp-dialog-overlay"
		@mousedown="onMousedown"
	>
		<div
			ref="dialogEl"
			class="rp-dialog"
			role="dialog"
			aria-modal="true"
			:aria-labelledby="titleId"
			@keydown="onKeydown"
		>
			<!--
				A fifth `kind` fails `npm run build` because `FormDialog` declares
				`descriptor: FormDescriptor`, and `vue-tsc`'s template narrowing rejects binding
				the residual union `current` still carries after every `v-if`/`v-else-if` above —
				not because this chain has no explicit `v-else`. Measured by adding a fifth kind
				and reading what `vue-tsc` reports, which is also how the one hole in it was
				found: the rejection is STRUCTURAL, so a fifth descriptor that happened to carry
				a `title` and a `component` would satisfy `FormDescriptor` and render here
				silently instead. Every kind that is not a form variant is caught.
			-->
			<ConfirmDialog
				v-if="current.kind === 'confirm'"
				:descriptor="current"
				:title-id="titleId"
				@resolve="resolve"
			/>
			<DeleteReferenceDialog
				v-else-if="current.kind === 'delete-reference'"
				:descriptor="current"
				:title-id="titleId"
				@resolve="resolve"
			/>
			<EntityPickerDialog
				v-else-if="current.kind === 'entity-picker'"
				:descriptor="current"
				:title-id="titleId"
				@resolve="resolve"
			/>
			<FormDialog
				v-else
				:descriptor="current"
				:title-id="titleId"
				@resolve="resolve"
			/>
		</div>
	</div>
</template>
