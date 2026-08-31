import {
	surfaceFor,
	type ErrorSurface,
	type ToastSurface,
} from '../../../src/presentation/errors/errorSurfacePolicy';
import type { AppError } from '../../../src/core/errors/AppError';

/**
 * Design slice 17's enforcement, proven rather than asserted.
 *
 * The slice document specifies `surfaceFor` as a policy a call site *consults*. Consulted-only
 * is the "guard on the door nobody dispatches through" shape `CLAUDE.md` records this project
 * paying for twice, and the Definition of Done makes a CATEGORY claim — "in every code path
 * that can trigger it" — which no list of call sites can hold.
 *
 * So `ErrorSurface` carries a `unique symbol` that `errorSurfacePolicy.ts` declares and never
 * exports. The literals below are structurally perfect and still cannot satisfy it, so the
 * only way to hold a surface is to have called `surfaceFor` — and `notifyError`, which takes a
 * `ToastSurface`, is therefore unreachable without asking the policy first.
 *
 * `vue-tsc --noEmit` in `npm run build` is the whole mechanism: this file is in
 * `tsconfig.json`'s `include` for that reason, and an unsatisfied `@ts-expect-error` is itself
 * an error — so dropping the brand fails the build at three directives that no longer have
 * anything to suppress, rather than reopening the door quietly.
 *
 * **What this file does NOT prove**, stated so the guarantee is not read wider than it is: that
 * a call site asked with the RIGHT origin. `surfaceFor(error, { kind: 'explicit-operation' })`
 * type-checks for an autosave-path failure exactly as it does for a real one-off command, and
 * gets a toast the table would have refused. No type can close that. The spec's origin table
 * is the instrument for that half, and review is what runs it.
 */

declare const anyError: AppError;
declare function acceptToast(surface: ToastSurface): void;
declare function acceptSurface(surface: ErrorSurface): void;

// @ts-expect-error a hand-built toast is structurally right and still unbranded
acceptToast({ kind: 'toast', level: 'error' });

// @ts-expect-error nor can the simplest member be built by hand
acceptSurface({ kind: 'none' });

// @ts-expect-error nor one carrying a payload, which is the spelling a form might reach for
acceptSurface({ kind: 'inline', field: 'quantity' });

/**
 * The other direction, and it is not a formality: a real answer from the policy IS a surface,
 * and narrowing one to its toast member is exactly how a call site reaches `notifyError`. If
 * this stopped compiling the brand would have made the door unusable rather than merely
 * closed.
 */
const real = surfaceFor(anyError, { kind: 'explicit-operation' });
acceptSurface(real);
if (real.kind === 'toast') acceptToast(real);
