import type { AppError, ErrorCategory } from '../../core/errors/AppError';

/**
 * Which container an `AppError` belongs in — SDD §66's last step, the one slice 11 named and
 * deliberately did not finish designing ("Presentation → User Message").
 *
 * The whole point is that a surface is NOT a function of the category alone: the same
 * `CalculationError` is an inline field error under the known-distance input, a toast for two
 * canvas point-picks, and nothing at all inside a background cascade. It is not a function of
 * the ORIGIN alone either — origin picks the container, and the error supplies what the
 * container still needs, which today is the toast's `level`.
 *
 * Pure, and it imports nothing from slices 13/15/16: it returns a DESCRIPTION of a surface,
 * and the call site is what invokes the sibling slice's API. `surfaceError.ts` is the
 * convenience that performs that dispatch; this module never does.
 */

/**
 * The brand, and the entire enforcement mechanism.
 *
 * Declared and deliberately NOT exported, so no module outside this one can construct a value
 * satisfying `ErrorSurface`. `notifyError` takes a `ToastSurface`, so a hand-built
 * `{ kind: 'toast', level: 'error' }` fails to compile and the only way to reach the toast is
 * to have asked `surfaceFor`. That is a `tsc` guarantee rather than a lint one, and it is the
 * same mechanism the editor's screen/world separation already rests on.
 *
 * **State the guarantee narrowly.** This holds that a call site ASKED. It does not hold that
 * it asked with the right ORIGIN — a site can pass `explicit-operation` where `autosave-write`
 * is true and get a toast this table would have refused. No type can close that, which is why
 * the ten origins are tabulated in this slice's spec, where review sees them.
 *
 * Phantom: nothing reads it at runtime, and the returned objects carry no extra property. A
 * test may therefore compare them as plain data.
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

/** The one place the brand is applied, inside the module that owns it. */
const routed = <T extends { readonly kind: string }>(surface: T): T & Routed =>
	surface as T & Routed;

/**
 * The code every door in a session with unrecovered settings refuses with — minted in
 * `composition-root.ts`'s refusal bundles and in `renovationProjectCommands.ts`, one code at
 * every door rather than a different one per service.
 */
const SETTINGS_UNRECOVERED = 'settings.unrecovered';

/**
 * Which origin a VIEW's failed hydrating query actually has.
 *
 * A view cannot tell these two apart by the shape of the failure — both arrive as a refused
 * `Result` from a query it called at mount — and they want opposite surfaces, so the
 * distinction has to be drawn somewhere. It is drawn here, once, rather than by an `if` in
 * each of the two views that need it.
 *
 * `settings.unrecovered` means the composition root deliberately wired NO repositories, no
 * index and no query services (slice 1), so nothing failed to read — nothing was ever built to
 * read. That is `bootstrap`, and the surface it earns has no retry, because there is nothing to
 * re-run and slice 1 already refused a repair UI: recovery is fixing `data.json` and reloading.
 * Anything else is a query that really did try and really did fail, which a retry can
 * legitimately re-attempt.
 */
export function viewHydrationOrigin(error: AppError): ErrorOrigin {
	return error.code === SETTINGS_UNRECOVERED ? { kind: 'bootstrap' } : { kind: 'view-hydration' };
}

/**
 * A toast's urgency, from the category and the origin.
 *
 * `Geometry` is the one category that speaks quieter than its origin suggests: an
 * operation-level geometry refusal means a shape the editor declined to accept, which the user
 * can see and redraw.
 *
 * A background `Persistence` failure is also a warning, for the opposite reason — it is the
 * only background failure this table surfaces at all, and what it reports is that a stale
 * marker could not be written, not that the user's own action failed.
 */
function toastLevel(category: ErrorCategory, origin: ErrorOrigin['kind']): 'warning' | 'error' {
	if (category === 'Geometry') return 'warning';
	if (origin === 'background-cascade') return 'warning';
	return 'error';
}

/**
 * The decision procedure, in the slice document's own order. The questions are asked in
 * sequence and the FIRST to answer wins, which is why `bootstrap` is a guard clause rather
 * than a row in the switch: it invalidates the questions below it rather than being answered
 * by them.
 *
 * The `switch` over `error.category` has **no `default` that returns**. A ninth category added
 * to slice 2 fails `vue-tsc` at the exhaustion arm rather than falling silently through to a
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
	// between them.
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

		default: {
			// Reached only if slice 2 grows a ninth category, and it is a COMPILE error when it
			// does. The assignment is what carries that: with every category handled above,
			// `error` is narrowed to `never` here and `never` assigns to `never`; add a member and
			// `error` becomes that member's type, which does not.
			//
			// **`error.category satisfies never` is the spelling that does NOT work**, and it was
			// tried first: once the switch is exhaustive the whole of `error` is `never`, so
			// reading `.category` off it is itself an error (`TS2339: Property 'category' does not
			// exist on type 'never'`). The check has to be on the narrowed VALUE, not on a
			// property of it.
			//
			// Written inline rather than as an `assertNever` helper because a helper is a
			// FUNCTION, and functions is the binding coverage metric on this tree with under one
			// uncovered unit of headroom.
			const unrouted: never = error;
			throw new Error(`Unrouted error category: ${String(unrouted)}`);
		}
	}
}
