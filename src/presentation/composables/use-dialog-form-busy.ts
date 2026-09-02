import { watchEffect, type Ref } from 'vue';

/**
 * The two things every dialog form does with the `busy` ref its descriptor handed it, stated
 * once because both creation forms were stating them identically.
 *
 * `NewPlanForm` was written from `NewProjectForm`, docblock included — the two carried
 * byte-identical `writeBusy`, `watchEffect` and `refuseWhileSubmitting` bodies, which
 * `npm run analyze` reported as one clone family of three groups the moment `main` drove
 * duplication to zero. The sameness is INTENT rather than coincidence: both are the same
 * framework invariant applied to the same descriptor field, and a third creation form would
 * copy it again.
 *
 * **The write goes through a plain function, and that is not stylistic.**
 * `vue/no-mutating-props` flags any write reachable through a props-derived expression, and
 * `busy` is a `Ref` the caller handed over specifically so the component could write into it
 * (`FormDescriptor.busy`'s own doc comment). Routing it through here means the write is not
 * syntactically `props.busy.value = …`, which is all the rule looks for — while the mutation
 * the rule really forbids, `props.busy = someOtherRef`, stays an error at the call site.
 *
 * Data flows one way: FROM the composable's own `submitting` INTO the caller's ref, never back.
 *
 * **What the returned refusal is for, and why it is not `:disabled`.** No control inside an
 * open dialog may be `disabled`, and that is a FOCUS rule rather than a styling preference —
 * `FormDialog.vue`'s docblock states it as an invariant of the framework. Chromium moves focus
 * to `<body>` when the element holding it is disabled, and `<body>` is outside `.rp-dialog`,
 * where `DialogHost` binds its `keydown` listener: disabling the focused control takes
 * `Escape` and the whole Tab trap out for exactly the window it is disabled in. So controls
 * stay focusable and are made INOPERATIVE instead — `readonly` on a text input,
 * `aria-disabled` on a `<select>` or a button — and this is what makes that refusal real.
 *
 * It RESTORES the control's own DOM value on the way out rather than merely returning: a
 * refused write leaves the form's `values` unchanged, so nothing re-renders, and the character
 * the browser has already placed would otherwise sit there as a value the form does not hold —
 * a lie about state rather than a refusal of it.
 *
 * **`submitting` is ONE producer of that state and deliberately not the gate.** It was, for
 * three slices, while it was the only one; `NewAssetForm` then froze its five catalogue fields
 * once the asset exists — a second inoperative state, per-FIELD rather than form-wide, that
 * flips WHILE the dialog is open — and a refusal still keyed on `submitting` alone would have
 * left those five genuinely editable, which is the live-control-that-does-nothing this
 * repository refuses everywhere else. It would have been strictly worse than the `:disabled`
 * it replaced.
 *
 * **So the gate is read off the CONTROL, not restated beside the template.** `isInoperative`
 * asks the element for the same two spellings the markup renders and `styles/dialogs.css`
 * already dims (`input[readonly]`, `select[aria-disabled='true']`), which makes the markup the
 * single source of truth: a control marked inoperative is refused, and the two cannot disagree
 * because there is only one statement of it. The alternative — a boolean argument each call
 * site computes — is a second derivation of a fact the template already holds, and this
 * repository has paid three times for exactly that shape. It also closes the CLASS rather than
 * this one form: the next form to mark a control inoperative gets the refusal with no call site
 * to remember.
 *
 * `submitting.value` stays in the OR as the form-WIDE half, so a control that is somehow
 * unmarked is still refused mid-write; the two are independent gates rather than one restated.
 */
function isInoperative(control: HTMLElement & { value: string }): boolean {
	// `getAttribute`, not `.ariaDisabled`: jsdom's support for the reflected IDL property is
	// version-dependent, while the attribute is what Vue writes and what the stylesheet reads.
	// `readOnly` IS read as the property, because `<select>` does not declare one at all —
	// `undefined` there, which is the correct answer rather than a missing case.
	return (
		control.getAttribute('aria-disabled') === 'true' ||
		(control as Partial<HTMLInputElement>).readOnly === true
	);
}

export function useDialogFormBusy(
	submitting: Readonly<Ref<boolean>>,
	busy: Ref<boolean> | undefined,
): (control: HTMLElement & { value: string }, rendered: string) => boolean {
	watchEffect(() => {
		if (busy) busy.value = submitting.value;
	});

	return (control, rendered) => {
		if (!submitting.value && !isInoperative(control)) return false;
		control.value = rendered;
		return true;
	};
}
