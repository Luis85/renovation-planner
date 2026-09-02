import { nextTick, ref, type Ref } from 'vue';

/**
 * A REJECTED SUBMIT PUTS THE KEYBOARD ON THE FIELD IT IS ABOUT — WCAG 2.2 AA, which
 * `PRODUCT.md` binds by name.
 *
 * The argument is `FormBanner`'s own applied to a field. `FormBanner` carries `role="alert"`
 * because it appears in response to the user's own submit and is the only feedback that press
 * produced, so it is announced rather than merely present; that is verbatim true of a FIELD
 * error produced by the same press, and `FieldError`'s `<p>` is neither a live region nor
 * focused. A screen-reader user pressed Save on an empty Name, the dialog stayed open, and
 * nothing was spoken while `aria-describedby` changed on an input nobody was on.
 *
 * The move is chosen over a polite live region because it answers both halves at once: the
 * control's label, its `aria-invalid` and the message `aria-describedby` names are all
 * announced by the focus change, out of markup `FieldError` already renders, and the user is
 * then AT the field rather than merely told about it.
 *
 * **The control is found by QUERYING the rendered form, never from a list of field keys.**
 * `aria-invalid="true"` is exactly what `FieldError` puts on a control it has a message for,
 * so the first match in document order is the first errored control — and a cross-field error
 * routed to a PAIR lands on the earlier of the two without this function knowing pairs exist.
 * A list of keys here would be a second answer to "which fields are wrong".
 *
 * `nextTick` is load-bearing: `submit()` resolves before Vue has flushed the render that
 * applies `aria-invalid`, so the query would otherwise find nothing.
 *
 * **It belongs to the three CREATION forms and deliberately not to `FieldError`**, which the
 * Inspector shares. There the commit boundary is blur — the user's attention has already
 * moved on by construction — and pulling focus back to the field they just left would
 * interrupt them somewhere else. Same component, two contexts, and the difference belongs to
 * the context.
 *
 * Extracted on its THIRD caller, which is this repository's own trigger for the shape:
 * `useDialogFormBusy` states the identical history for `refuseWhileSubmitting`, and
 * `FormSubmitRow` for the actions row. Two byte-identical copies with two independently
 * maintained docblocks is how one of them silently stops matching what it describes.
 */
export function useInvalidFieldFocus(): {
	readonly formEl: Ref<HTMLFormElement | null>;
	focusFirstInvalidControl: () => Promise<void>;
} {
	const formEl = ref<HTMLFormElement | null>(null);

	async function focusFirstInvalidControl(): Promise<void> {
		await nextTick();
		formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	return { formEl, focusFirstInvalidControl };
}
