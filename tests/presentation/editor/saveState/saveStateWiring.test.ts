import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The wiring, asserted as a fact about the composition rather than about behaviour. A
 * behavioural test here would need a whole Plan Editor rig; what can go wrong is narrower
 * and structural — the tracker built but never composed, or composed on the wrong side of
 * the refresh decorator.
 *
 * Nesting matters both ways. OUTSIDE `withEditorStateRefresh`, so `saved` never appears
 * while the canvas still shows the pre-command state. INSIDE `wrapDispatcher`, which is the
 * one object every tool, the context bar's Undo/Redo and the Inspector dispatch through — a
 * tracker outside it would miss nothing today and miss everything the moment the wrapping
 * changes.
 *
 * **The ARGUMENTS, never the textual order.** An earlier draft compared `indexOf` positions,
 * which is the "address code by position" defect this repository writes down: it passed for
 * `withSaveStateTracking(history, …)` written below the refresh declaration — a composition
 * that settles the indicator before the refresh finishes — and said nothing at all about what
 * `wrapDispatcher` receives. Both of the two mistakes its own docblock claimed to prevent
 * could stay green.
 *
 * Still a source-shape check and not a behavioural one, which is a real limit: it holds the
 * bindings, not the runtime values. What it cannot see is written down rather than implied —
 * a renamed local that is threaded correctly fails this test, and a decorator that ignores
 * its argument passes it.
 */
const runtime = readFileSync('src/presentation/editor/runtime.ts', 'utf8');

/** Collapse whitespace so a reformat or a line break does not decide the outcome. */
const source = runtime.replace(/\s+/gu, ' ');

describe('save-state wiring', () => {
	it('composes the tracker in the runtime', () => {
		expect(source).toContain('withSaveStateTracking');
		expect(source).toContain('useSaveStateStore(');
	});

	it('hands the tracker the REFRESH decorator, not the bare history', () => {
		expect(source).toMatch(/withSaveStateTracking\( *dispatcher *,/u);
		expect(source).not.toMatch(/withSaveStateTracking\( *history *,/u);
	});

	it('hands wrapDispatcher the TRACKED dispatcher, not the untracked one', () => {
		expect(source).toMatch(/wrapDispatcher\( *history *, *tracked *\)/u);
		expect(source).not.toMatch(/wrapDispatcher\( *history *, *dispatcher *\)/u);
	});

	it('binds the tracker to a name, so the two assertions above address one value', () => {
		expect(source).toMatch(/const tracked = withSaveStateTracking\(/u);
	});
});
