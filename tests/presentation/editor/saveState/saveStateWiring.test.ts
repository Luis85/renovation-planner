import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The wiring, asserted as a fact about the composition rather than about behaviour. A
 * behavioural test here would need a whole Plan Editor rig; what can go wrong is narrower
 * and structural — the tracker built but never composed, or composed on the wrong side of
 * the refresh decorator.
 *
 * Nesting matters both ways. OUTSIDE the refresh decorator, so `saved` never appears
 * while the canvas still shows the pre-command state. INSIDE `wrapDispatcher`, which is the
 * one object every tool, the context bar's Undo/Redo and the Inspector dispatch through — a
 * tracker outside it would miss nothing today and miss everything the moment the wrapping
 * changes.
 *
 * The trust path's gate (design spec §2.2) added a THIRD link since this test was written, and
 * BP-02's L-16 a FOURTH: `wrapDispatcher` receives `gated`, not `tracked`, directly — `gated` is
 * `withIncidentGate(withStaleGate(tracked, …))`, so `tracked` is still what the stale gate
 * itself is built from, and the incident gate is outside it. The
 * property this file is FOR — a refusal must open no saving batch — is exactly why the gate
 * sits after the tracker rather than before it, so the two new assertions below hold both
 * halves of that ordering rather than only the old tracked/wrapDispatcher pair.
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

	it('binds the tracker to a name, so the two assertions above address one value', () => {
		expect(source).toMatch(/const tracked = withSaveStateTracking\(/u);
	});

	/**
	 * Design spec §2.2: the stale gate sits AFTER the tracker (so a refusal opens no saving
	 * batch) and BEFORE `wrapDispatcher` (so the undo/redo flags still refresh). Both halves
	 * are asserted, because either one alone is satisfied by a build that dropped the gate
	 * from the chain entirely and fed `wrapDispatcher` the bare `tracked` value again.
	 */
	it('the stale gate is built from the tracked dispatcher, not from the untracked one', () => {
		// Addresses the CALL rather than the assignment. The pin used to read
		// `const gated = withStaleGate( tracked ,` and broke the day a fourth link wrapped it,
		// while the thing it exists to protect — that the gate is built from the TRACKED
		// dispatcher — was still true. A pin on the spelling of a line is not a pin on its
		// meaning.
		expect(source).toMatch(/withStaleGate\( *tracked *,/u);
		expect(source).not.toMatch(/withStaleGate\( *dispatcher *,/u);
	});

	/**
	 * BP-02 L-16's link, and it is a FOURTH one rather than a replacement. `withIncidentGate`
	 * asks the write-incident registry LIVE at every dispatch, which is the only predicate in
	 * this chain that can be right about an incident opened after the leaf's store was seeded —
	 * `vaultPaused` is read from the registry once, at store creation, and set afterwards only by
	 * `withSaveStateTracking` on a refusal THIS leaf received.
	 *
	 * It wraps the stale gate rather than sitting inside it, so a paused vault answers
	 * `WRITES_PAUSED_CODE` — whose copy exists in both locales — rather than
	 * `STALE_WRITE_REFUSED`, which tells a user their last read-back failed. Both halves are
	 * asserted for the reason the case above gives: either alone is satisfied by a build that
	 * dropped a link and fed `wrapDispatcher` the value again.
	 */
	it('the incident gate wraps the stale gate, and wrapDispatcher receives the result', () => {
		expect(source).toMatch(/withIncidentGate\( *withStaleGate\(/u);
		expect(source).toMatch(/wrapDispatcher\( *history *, *gated *\)/u);
	});

	it('hands wrapDispatcher the GATED dispatcher, not the tracked-but-ungated one', () => {
		expect(source).toMatch(/wrapDispatcher\( *history *, *gated *\)/u);
		expect(source).not.toMatch(/wrapDispatcher\( *history *, *tracked *\)/u);
		expect(source).not.toMatch(/wrapDispatcher\( *history *, *dispatcher *\)/u);
	});
});
