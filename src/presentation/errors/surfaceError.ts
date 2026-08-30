import type { AppError } from '../../core/errors/AppError';
import {
	surfaceFor,
	type ErrorOrigin,
	type ErrorSurface,
	type ToastSurface,
} from './errorSurfacePolicy';

/**
 * The doors a particular call site actually has.
 *
 * Not every site can draw every surface: the Inspector has no banner region, a plugin command
 * has no view to fail in place and no save indicator to flip. So the sinks are optional except
 * two.
 */
export interface SurfaceSinks {
	/**
	 * Always available, and therefore not optional: `notify.ts` is a module-level door with no
	 * per-site state, so there is no call site that cannot raise one.
	 */
	readonly toast: (error: AppError, surface: ToastSurface) => void;

	/**
	 * Where a surface this site CANNOT draw goes instead.
	 *
	 * **Required, and it is the one option that must not be optional.** A policy that routes to
	 * a container the caller has no room for must degrade to something, and the choice has to be
	 * the caller's and visible. Optional-with-a-`?? noop` default makes the forgetting call site
	 * silent with nothing anywhere erroring — the exact shape `useFieldCommit.notify`'s own
	 * docblock records this repository paying for, and the reason that option is required too.
	 */
	readonly unrenderable: (error: AppError, surface: ErrorSurface) => void;

	/**
	 * Renders the error under one named field, and REPORTS whether it could.
	 *
	 * `false` means this form's `FieldErrorMap` does not name the code — which is not an
	 * omission but the explicit statement "this failure is not about one field", as
	 * `route-error.ts` puts it. The fallback below takes it from there, so a form never has to
	 * decide where a banner-routed refusal goes.
	 */
	readonly inline?: (field: string, error: AppError) => boolean;
	readonly saveState?: (error: AppError) => void;
	readonly modal?: (error: AppError) => void;
	readonly viewFailure?: (error: AppError) => void;
	readonly sessionFailure?: (error: AppError) => void;
}

/**
 * The toast an unshowable inline error falls back to.
 *
 * Asked of the policy rather than hand-built, which is what keeps the level a decision of the
 * table's — a `Geometry` refusal falling back here still arrives as a warning. The cast is
 * safe by the table's own shape (every category answers a toast at an `explicit-operation`
 * origin) and is confined to this module, which is the only one that could construct a branded
 * surface anyway.
 */
function toastFallbackFor(error: AppError): ToastSurface {
	return surfaceFor(error, { kind: 'explicit-operation' }) as ToastSurface;
}

/**
 * One arm for the four optional doors: use it if the site has it, and report to the required
 * fallback if not.
 *
 * Written once rather than four times, because four copies of "or else tell somebody" is four
 * chances for one of them to be a `return` that tells nobody — and a silent one of those is
 * invisible to every test that is not looking directly at it.
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

/**
 * Ask the policy, then knock on the matching door — SDD §66's last step, performed.
 *
 * It returns the surface it used rather than `void`, so a test can assert on the DECISION
 * rather than on a spy count. That matters more here than it looks: "the indicator flipped" is
 * equally true of a build that also raised a toast, which is precisely the defect design slice
 * 17 exists to close.
 *
 * **This function is a convenience, not the guarantee.** The guarantee is the non-exported
 * brand on `ErrorSurface`: a call site cannot reach `notifyError` without having asked the
 * policy, whether or not it came through here. A site holding exactly one door may call
 * `surfaceFor` and that door directly, and three of them do.
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
			// content of this arm — a valid, common answer rather than a gap.
			return surface;

		case 'toast':
			sinks.toast(error, surface);
			return surface;

		case 'inline':
			// The one arm whose chosen door can decline. A form whose map does not name this code
			// says so, and the failure falls to the toast rather than to silence.
			if (sinks.inline?.(surface.field, error) === true) return surface;
			sinks.toast(error, toastFallbackFor(error));
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
