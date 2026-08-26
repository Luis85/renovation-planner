import { defineStore } from 'pinia';
import { shallowRef, type Component } from 'vue';

/**
 * The plugin's one dialog framework (design slice 15). Everything here is DISPLAY state:
 * which descriptor is open, and the resolver of the Promise the opener is awaiting.
 * `eslint.config.mjs` has a block for `presentation/dialogs/` that fails the build on an
 * import naming `application`, `infrastructure`, `plugin` or `core/events` — a repository,
 * an application-layer command or query, or the event bus reached from here would put a
 * domain decision inside a dialog. That is what the block actually delivers, and no wider:
 * the dispatcher lives in `presentation/editor/`, and
 * `presentation/read-models/planEditorQueries.ts` is a presentation-layer query surface, so
 * a dispatch or a query reached through either of those is importable from this directory
 * today and is a review question, not a compiler one.
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
 * THE EXTENSION POINT. A new dialog kind is FIVE additions, not two: a member here, its
 * result type in `DialogResultByKind`, a case in `cancelResultFor`, a branch in
 * `DialogHost`, and the kind component itself. `DialogHost` and `cancelResultFor` both
 * switch on `kind` exhaustively, so a member added without the other three fails to compile
 * rather than falling through to a blank dialog — four of the five are build failures if
 * forgotten; only the component file is not something the compiler makes you write.
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

/**
 * What `openDialog` resolves for ONE descriptor, which is what keeps its return type precise
 * per kind instead of the whole `DialogResult` union.
 *
 * Module-private, and the `fallow-ignore` suppression that used to sit here went with the
 * `export`. It was public against a predicted consumer — "a real external consumer arrives
 * with the dialog components later in this slice" — and the slice is finished: all four kind
 * components, `DialogHost` and the calibration caller are in, and not one of them names it.
 * A caller awaiting `openDialog` gets the precise type by inference without ever spelling
 * this. Export it again when something genuinely needs to be generic over a descriptor;
 * until then a suppressed dead export is a worse thing to carry than a re-add.
 */
type DialogResultFor<D extends DialogDescriptor> = DialogResultByKind[D['kind']];

/**
 * What "the user cancelled" means in each kind's own result shape.
 *
 * ONE function rather than a value chosen at each cancel site, because the single call
 * site — `DialogHost`'s `Escape` handler — is kind-agnostic and would otherwise have to
 * know every kind's own cancel shape itself. (Each kind component hardcodes its own cancel
 * payload on its own cancel button; there is no backdrop-dismiss anywhere in this slice,
 * and `DialogHost`'s `mousedown` handling makes a backdrop press inert rather than a
 * cancellation.) A resolution of the bare string `'cancel'` where a caller was switching on
 * `result.action` would read as `undefined` and fall through whatever the caller's default
 * branch is. A `switch` with no `default`: the compiler is what proves it total, so a fifth
 * kind fails to build here.
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

		return new Promise<DialogResultFor<D>>((_resolve) => {
			settle = _resolve as (result: DialogResult) => void;
			current.value = descriptor;
		});
	}

	/**
	 * Called by `DialogHost` alone, BY CONVENTION — see its header for why the host settles
	 * rather than each kind component. Nothing enforces the exclusivity: `resolve` is a
	 * public store member and `current` comes back from `storeToRefs` as a writable ref, so
	 * any other holder of the store could settle or strand a pending dialog. Not worth a
	 * mechanism for a one-caller store; worth saying plainly that it is not one.
	 *
	 * `current` is cleared before `pending(result)` runs. What makes the Reassign branch
	 * of the delete flow work — opening the next dialog the instant the awaited promise
	 * resumes — is `current` being `null` BY THEN, not this particular statement order: a
	 * Promise reaction always runs as a microtask, so clearing `current` after the call
	 * instead would leave it just as reliably `null` before that reaction runs. This order
	 * is kept anyway because it states the dependency where a reader can see it, rather
	 * than relying on them already knowing that microtask timing makes the two orders
	 * equivalent.
	 */
	function resolve(result: DialogResult): void {
		const pending = settle;
		if (pending === null) return; // no dialog open to resolve
		// NOT what stops a second settle — the Promise itself already refuses that no
		// matter how many times `pending` is called. What this buys: the guard above
		// becomes reachable on a later call (so a repeat resolve() short-circuits there
		// instead of re-invoking a stale resolver), and the resolver closure is released
		// rather than held onto for the life of the store.
		settle = null;
		current.value = null;
		pending(result);
	}

	return { current, openDialog, resolve };
});
