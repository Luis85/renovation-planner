import { describe, expect, it, vi } from 'vitest';
import { surfaceError, type SurfaceSinks } from '../../../src/presentation/errors/surfaceError';
import type { AppError, ErrorCategory } from '../../../src/core/errors/AppError';

const err = (category: ErrorCategory, code = 'x.y'): AppError =>
	({ category, code, message: 'developer text' }) as AppError;

type OptionalSink = NonNullable<SurfaceSinks['saveState']>;
type InlineSink = NonNullable<SurfaceSinks['inline']>;

function makeSinks(overrides: Partial<SurfaceSinks> = {}): {
	readonly sinks: SurfaceSinks;
	readonly toast: ReturnType<typeof vi.fn<SurfaceSinks['toast']>>;
	readonly unrenderable: ReturnType<typeof vi.fn<SurfaceSinks['unrenderable']>>;
} {
	const toast = vi.fn<SurfaceSinks['toast']>();
	const unrenderable = vi.fn<SurfaceSinks['unrenderable']>();
	return { sinks: { toast, unrenderable, ...overrides }, toast, unrenderable };
}


describe('surfaceError', () => {
	it('sends an explicit-operation failure to the toast door with the routed level', () => {
		const { sinks, toast, unrenderable } = makeSinks();

		const used = surfaceError(err('Persistence'), { kind: 'explicit-operation' }, sinks);

		expect(used.kind).toBe('toast');
		expect(toast).toHaveBeenCalledTimes(1);
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'Persistence' }),
			expect.objectContaining({ kind: 'toast', level: 'error' }),
		);
		expect(unrenderable).not.toHaveBeenCalled();
	});

	it('sends an autosave-write failure to the save-state door and raises NO toast', () => {
		// Design slice 17's Definition of Done item 3, at the dispatcher. The toast assertion is
		// the load-bearing half: "the indicator flipped" is equally true of the build that also
		// toasts, which is exactly the defect this slice exists to close.
		const saveState = vi.fn<OptionalSink>();
		const { sinks, toast } = makeSinks({ saveState });

		const used = surfaceError(err('Persistence'), { kind: 'autosave-write' }, sinks);

		expect(used.kind).toBe('save-state');
		expect(saveState).toHaveBeenCalledTimes(1);
		expect(toast).not.toHaveBeenCalled();
	});

	it('sends a field-attributable failure to the inline door with its field name', () => {
		const inline = vi.fn<InlineSink>().mockReturnValue(true);
		const { sinks, toast } = makeSinks({ inline });

		const used = surfaceError(
			err('Validation'),
			{ kind: 'form-field-commit', field: 'quantity' },
			sinks,
		);

		expect(used.kind).toBe('inline');
		expect(inline).toHaveBeenCalledWith(
			'quantity',
			expect.objectContaining({ category: 'Validation' }),
		);
		expect(toast).not.toHaveBeenCalled();
	});

	it('falls back to the toast when the inline door declines to render it', () => {
		// The Inspector has no banner region, so a code its `FieldErrorMap` does not name cannot
		// be shown inline. `inline` answering false IS that report — the explicit "this failure
		// is not about one field" `routeError`'s own docblock describes — and the fallback is
		// what stops the failure reaching nobody.
		const inline = vi.fn<InlineSink>().mockReturnValue(false);
		const { sinks, toast } = makeSinks({ inline });

		const used = surfaceError(
			err('Validation'),
			{ kind: 'form-field-commit', field: 'quantity' },
			sinks,
		);

		expect(used.kind).toBe('inline');
		expect(toast).toHaveBeenCalledTimes(1);
	});

	it('falls back to the toast when the site has no inline door at all', () => {
		const { sinks, toast } = makeSinks();

		surfaceError(err('Validation'), { kind: 'form-field-commit', field: 'quantity' }, sinks);

		expect(toast).toHaveBeenCalledTimes(1);
	});

	it('routes a surface the call site cannot draw to the REQUIRED unrenderable door', () => {
		// No `saveState` sink here: a plugin command has no editor indicator to flip. Without a
		// required second door this failure would reach nobody, which is strictly worse than
		// reaching the wrong widget.
		const { sinks, toast, unrenderable } = makeSinks();

		const used = surfaceError(err('Persistence'), { kind: 'autosave-write' }, sinks);

		expect(used.kind).toBe('save-state');
		expect(unrenderable).toHaveBeenCalledTimes(1);
		expect(unrenderable).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'Persistence' }),
			expect.objectContaining({ kind: 'save-state' }),
		);
		expect(toast).not.toHaveBeenCalled();
	});

	it('uses each optional door when the site has it', () => {
		// One case over the four optional doors rather than four cases, because they share one
		// arm — and a door that silently did nothing would show up here as an uncalled spy.
		const modal = vi.fn<OptionalSink>();
		const viewFailure = vi.fn<OptionalSink>();
		const sessionFailure = vi.fn<OptionalSink>();
		const { sinks, unrenderable } = makeSinks({ modal, viewFailure, sessionFailure });

		expect(surfaceError(err('Reference'), { kind: 'decision-required' }, sinks).kind).toBe('modal');
		expect(surfaceError(err('Persistence'), { kind: 'view-hydration' }, sinks).kind).toBe(
			'view-failure',
		);
		expect(surfaceError(err('Persistence'), { kind: 'bootstrap' }, sinks).kind).toBe(
			'session-failure',
		);

		expect(modal).toHaveBeenCalledTimes(1);
		expect(viewFailure).toHaveBeenCalledTimes(1);
		expect(sessionFailure).toHaveBeenCalledTimes(1);
		expect(unrenderable).not.toHaveBeenCalled();
	});

	it('calls NO door at all for a background cascade that routes to none', () => {
		const { sinks, toast, unrenderable } = makeSinks();

		const used = surfaceError(err('Calculation'), { kind: 'background-cascade' }, sinks);

		expect(used.kind).toBe('none');
		expect(toast).not.toHaveBeenCalled();
		expect(unrenderable).not.toHaveBeenCalled();
	});

	it('returns the surface it used, so a caller can assert the decision', () => {
		const { sinks } = makeSinks();

		expect(surfaceError(err('Geometry'), { kind: 'explicit-operation' }, sinks)).toMatchObject({
			kind: 'toast',
			level: 'warning',
		});
	});
});
