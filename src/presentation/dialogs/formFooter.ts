import type { InjectionKey } from 'vue';

/**
 * What `FormDialog` hands the form it mounts so the form's own submit row can carry the dialog's
 * Cancel too — ONE action row per dialog, Cancel then the submit, which is Obsidian's order.
 *
 * The submit stays inside the `<form>` (a real `type="submit"`, so Enter in a field still submits)
 * and the Cancel moves to it, rather than the other way round: the form is what owns the submit's
 * state, and the dialog owns nothing a Cancel needs beyond the two members below.
 *
 * `claim` is how `FormDialog` learns a form drew the row, so it stops drawing its own Cancel. A form
 * that renders no `FormSubmitRow` claims nothing and keeps the dialog's separate Cancel row.
 */
export interface FormFooter {
	claim(): void;
	cancel(): void;
	busy(): boolean;
}

export const FORM_FOOTER: InjectionKey<FormFooter> = Symbol('form-footer');
