import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { descendants, functionNamed, parseScript } from '../../../helpers/parsedSource';

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
 * itself is built from, and the incident gate is outside it. The property this file is FOR — a
 * refusal must open no saving batch — is exactly why the gate sits after the tracker rather than
 * before it, so both halves of that ordering are held rather than only the old
 * tracked/`wrapDispatcher` pair.
 *
 * **The ARGUMENTS, never the textual order.** An earlier draft compared `indexOf` positions,
 * which is the "address code by position" defect this repository writes down: it passed for
 * `withSaveStateTracking(history, …)` written below the refresh declaration — a composition
 * that settles the indicator before the refresh finishes — and said nothing at all about what
 * `wrapDispatcher` receives. Both of the two mistakes its own docblock claimed to prevent
 * could stay green.
 *
 * **It asks the PARSER, and only about `buildDispatcherChain`'s own body.** Until 2026-09-19
 * this file read `dispatcherChain.ts` and `runtime.ts` as one string with all whitespace
 * collapsed, which made comment text and code text indistinguishable to every assertion — and
 * that was not a theoretical hazard: with the incident gate genuinely removed from the chain,
 * ONE comment line added to `runtime.ts` spelling the pattern turned the whole file green,
 * measured; and the tracker's call AND its import could be deleted outright while the case
 * about it stayed green on the strength of a single prose line in `runtime.ts`. It also ran the
 * other way — a legitimate `// Never write wrapDispatcher(history, tracked) here.` reddened a
 * gate over correct code. A comment is not a node, so neither channel exists now. The docblock
 * that justified the concatenation is gone with it: both of its premises measured false (it
 * counted four `not.toMatch` cases where there were three, and claimed a stale path would go
 * "vacuously green" where replaying the six cases against the wrong file turned 6 of 6 red).
 *
 * **What it sees**: exactly one call of each named decorator inside that one function, the
 * source text of each call's arguments, and what each `const` in that body is initialised from.
 * A second, duplicate call of any of these five is a failure rather than a match, which the
 * substring version could not say. If `buildDispatcherChain` is renamed, moved to another
 * module or turned into an arrow constant, this file throws at load naming the function and the
 * file it looked in — the loudest failure available here, and the one the concatenation was
 * specifically built to tolerate.
 *
 * **What it cannot see**, still a source-shape check and not a behavioural one: it holds the
 * bindings, not the runtime values. A renamed local that is threaded correctly fails this test,
 * and a decorator that ignores its argument passes it. It matches a callee spelled as a bare
 * identifier, so the same function reached through a namespace or an alias
 * (`gates.withStaleGate(…)`, `const g = withStaleGate`) reads as absent. And it asks one
 * function in one file: a chain rebuilt in a helper this body calls is outside it.
 */
const CHAIN_FILE = 'src/presentation/editor/dispatcherChain.ts';
const CHAIN_FN = 'buildDispatcherChain';

const script = parseScript(CHAIN_FILE);
const chain = functionNamed(script, CHAIN_FN);
if (chain === undefined) {
	throw new Error(`${CHAIN_FILE} declares no function \`${CHAIN_FN}\`. The dispatcher chain has moved and this gate is reading a file that no longer builds it.`);
}

/** The one member of `nodes`, or a failure naming what was looked for and how many there were. */
const only = <T>(nodes: readonly T[], what: string): T => {
	const [first, ...rest] = nodes;
	if (first === undefined || rest.length > 0) {
		throw new Error(`Expected exactly one ${what} in \`${CHAIN_FN}\` (${CHAIN_FILE}); found ${nodes.length}.`);
	}
	return first;
};

const text = (node: ts.Node): string => node.getText(script.file);

/** The single call of `callee` in the chain's body. A comment spelling it is not a call. */
const call = (callee: string): ts.CallExpression =>
	only(descendants(chain, ts.isCallExpression).filter((node) => text(node.expression) === callee), `\`${callee}(…)\` call`);

/** Each argument of `node`, as its own source text. */
const argsOf = (node: ts.CallExpression): string[] => node.arguments.map(text);

/** The callee of `node` when it is a call, else `null`, so a non-call binding fails on absence. */
const calleeOf = (node: ts.Expression): string | null => (ts.isCallExpression(node) ? text(node.expression) : null);

/** What the single `const <name> = …` in the chain's body is initialised from. */
const boundTo = (name: string): ts.Expression => {
	const declaration = only(
		descendants(chain, ts.isVariableDeclaration).filter((node) => ts.isIdentifier(node.name) && node.name.text === name),
		`\`const ${name} = …\` binding`,
	);
	if (declaration.initializer === undefined) throw new Error(`\`${name}\` is declared with no initializer in \`${CHAIN_FN}\`.`);
	return declaration.initializer;
};

describe('save-state wiring', () => {
	/**
	 * The old first case asserted the two names appeared SOMEWHERE, which the tracker's complete
	 * removal — call and import both — survived. Asserting the call's arguments instead says what
	 * that case meant: the tracker is composed, once, over the refresh decorator and over the
	 * store, and the bare `history` is what the refresh decorator itself is built from.
	 */
	it('composes the tracker once, over the refresh decorator and the save-state store', () => {
		expect(argsOf(call('withSaveStateTracking'))).toEqual(['dispatcher', 'save']);
		expect(calleeOf(boundTo('dispatcher'))).toBe('withStateRefresh');
		expect(argsOf(call('withStateRefresh'))[0]).toBe('history');
		expect(calleeOf(boundTo('save'))).toBe('useSaveStateStore');
	});

	it('binds the tracker to a name, so the two cases below address one value', () => {
		expect(calleeOf(boundTo('tracked'))).toBe('withSaveStateTracking');
	});

	/**
	 * Design spec §2.2: the stale gate sits AFTER the tracker (so a refusal opens no saving
	 * batch) and BEFORE `wrapDispatcher` (so the undo/redo flags still refresh). Equality over
	 * the one call is both halves of the old pair at once — a build that dropped the gate from
	 * the chain has no call to read, and one that fed it the untracked `dispatcher` fails on the
	 * argument.
	 *
	 * Addresses the CALL rather than the assignment. The pin used to read
	 * `const gated = withStaleGate( tracked ,` and broke the day a fourth link wrapped it, while
	 * the thing it exists to protect — that the gate is built from the TRACKED dispatcher — was
	 * still true. A pin on the spelling of a line is not a pin on its meaning.
	 */
	it('the stale gate is built from the tracked dispatcher, not from the untracked one', () => {
		expect(argsOf(call('withStaleGate'))[0]).toBe('tracked');
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
	 * `STALE_WRITE_REFUSED`, which tells a user their last read-back failed.
	 *
	 * The old sixth case asserted `wrapDispatcher(history, gated)` in the same words as the
	 * fifth and added two negatives that could only fire once that shared positive had already
	 * failed; no mutation ever reddened it alone. It is folded in here, where equality over the
	 * one `wrapDispatcher` call says what its three assertions said together.
	 */
	it('the incident gate wraps the stale gate, and wrapDispatcher receives the result', () => {
		expect(call('withIncidentGate').arguments.map(calleeOf)).toEqual(['withStaleGate']);
		expect(calleeOf(boundTo('gated'))).toBe('withIncidentGate');
		expect(argsOf(call('wrapDispatcher'))).toEqual(['history', 'gated']);
	});
});
