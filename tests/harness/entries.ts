/**
 * What the harness index can mount, discovered from the tree rather than from a list.
 *
 * A hand-kept manifest is a step somebody has to remember, and `CLAUDE.md` refuses that
 * shape elsewhere for the same reason it is refused here — "src/ is the list and it cannot
 * go stale". The `Coding agent` actor note gives the sharper version: a registration step is
 * one a stateless actor forgets across sessions.
 *
 * `discoverEntries` takes the glob RESULT rather than calling `import.meta.glob` itself, so the
 * id derivation stays a pure function a node test can drive. The two globs live below, in this
 * module rather than in `IndexPage.vue`, because `page.ts` needs the component list too — to
 * register those components globally — and a second glob in a second file is a second answer
 * that can disagree.
 *
 * `import.meta.glob` is a Vite feature, not a Vue one, so a `.ts` module can hold it.
 */
export interface HarnessEntry {
	/** Unique across every entry, and the value `?entry=` carries. See `idFor`. */
	readonly id: string;
	/** The basename, for a human reading the list. Not unique, and never used as a URL. */
	readonly label: string;
	readonly kind: 'prototype' | 'component';
	readonly component: () => Promise<unknown>;
}

/**
 * An id that is unique across the whole index, because it is a URL.
 *
 * A basename alone is NOT unique and the collision is the likely case rather than the exotic
 * one: a mock named after the component it stands in for is exactly what a designer builds,
 * and two components sharing a basename in different directories is ordinary. Either would
 * make the second entry unreachable by `?entry=` and uncapturable by `harness-shot`, with no
 * error — the index would simply always open the first.
 *
 * So: the kind, then the path between the tree root and the file, then the basename.
 */
function idFor(file: string, kind: HarnessEntry['kind']): string {
	const withoutExtension = file.replace(/\.vue$/, '');
	// Everything after the tree root: `…/src/prototypes/X` → `X`, and
	// `…/src/presentation/editor/shell/StatusBar` → `editor/shell/StatusBar`.
	const root = kind === 'prototype' ? '/src/prototypes/' : '/src/presentation/';
	const index = withoutExtension.indexOf(root);
	const relative = index === -1 ? withoutExtension : withoutExtension.slice(index + root.length);

	// The path separator is KEPT. Flattening it to `-` is not reversible — `-` is legal in a
	// directory name, so `a-b/C` and `a/b-C` become one id and one of them stops being
	// reachable, silently. Both `:` and `/` are legal in a query-string value and in a
	// quoted attribute selector, which is everywhere this id has to survive.
	return `${kind}:${relative}`;
}

/**
 * One entry per globbed module, sorted so the index does not reorder itself between runs — a
 * list whose order moves is one a designer cannot navigate by memory, and a screenshot of it
 * would differ run to run for no reason.
 */
export function discoverEntries(
	modules: Record<string, () => Promise<unknown>>,
	kind: HarnessEntry['kind'],
): HarnessEntry[] {
	// `toSorted`, not `sort`: `oxlint`'s `unicorn/no-array-sort` refuses the in-place form
	// outright, and no inline suppression is available here (`.oxlintrc.json` is the only
	// place a rule is turned off, and this one is doing its job). The array being sorted is
	// `map`'s own fresh one, so nothing is being protected from mutation — the copy costs one
	// allocation per index build and the gate stays whole.
	//
	// `localeCompare` orders the way a reader expects (case-insensitively by base letter), and
	// the limit is worth one clause: it is LOCALE-dependent, so "the same order every run"
	// holds per machine rather than across the four CI legs. Nothing observable turns on that
	// today — every id here is ASCII, where every locale agrees — and the day one is not, the
	// remedy is a code-unit comparator and a worse-reading list.
	const entries = Object.entries(modules)
		.map(([file, component]) => ({
			id: idFor(file, kind),
			label: file.split('/').pop()?.replace(/\.vue$/, '') ?? file,
			kind,
			component,
		}))
		.toSorted((left, right) => left.id.localeCompare(right.id));

	// Belt and braces over a reversible id: if two entries ever do collide, the failure mode
	// without this is SILENT — the index opens the first match and the second is simply
	// unreachable, with nothing to notice.
	//
	// What throwing actually buys, stated precisely because the obvious sentence is wrong: this
	// runs inside `IndexPage.vue`'s `<script setup>`, so it aborts the mount and the page stays
	// BLANK — nothing on it says anything. What it does produce is Vue's unhandled-error
	// `console.error`, which `scripts/harness-shot.mjs` records and exits non-zero on. So the
	// trade is a blank page for a loud one, taken because the alternative is a page that looks
	// complete and is not.
	const ids = new Set(entries.map((entry) => entry.id));

	if (ids.size !== entries.length) throw new Error(`duplicate harness entry ids in ${kind}`);

	return entries;
}

/**
 * `import.meta.glob` is Vite's, and it is declared HERE rather than by adding `vite/client`
 * to `tsconfig.json`'s `types`.
 *
 * The two are not equivalent, and the difference is the reason: a `types` entry is
 * program-wide, so `vite/client` would also declare `*.css`, `*.svg` and `?raw` as importable
 * modules for every file the compiler sees — `src/` included, where a stylesheet import would
 * typecheck cleanly and then silently bypass `styles/index.css` and the assembler that
 * enforces SDD §84. Declaring the one member this file uses widens nothing else.
 *
 * The declaration is TRUE of every module Vite transforms, `src/` among them, which is why it
 * is a global interface merge rather than a local shim. It is narrower than Vite's own
 * signature (no eager form, no `import` option) because narrower is what is used; a call
 * needing more will not compile, which is the correct way to find out.
 */
declare global {
	interface ImportMeta {
		readonly glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
}

import { defineAsyncComponent, type App, type Component } from 'vue';

/** Every mock and prototype under `src/prototypes/`. */
export const prototypeEntries = (): HarnessEntry[] =>
	discoverEntries(import.meta.glob('../../src/prototypes/**/*.vue'), 'prototype');

/** Every real component under `src/presentation/`. */
export const componentEntries = (): HarnessEntry[] =>
	discoverEntries(import.meta.glob('../../src/presentation/**/*.vue'), 'component');

/**
 * Everything a template-only prototype can name, keyed by the tag it would write —
 * `<StatusBar />`, so by LABEL rather than by id, since an id containing `:` and `/` is not a
 * valid tag.
 *
 * Called with BOTH kinds: a prototype composes the mocks beside it as well as the real
 * components, and a template-only file can import neither.
 *
 * Labels are not unique, and this is the third place that has mattered — but the two kinds of
 * collision are different questions and an earlier draft refused both alike, which broke the
 * headline workflow.
 *
 * A MOCK sharing a label with a component is not an ambiguity. Naming a mock after the
 * component it stands in for is the whole point of writing one, so `<StatusBar />` inside a
 * prototype must mean the mock. The prototype takes the tag, deterministically, and the
 * shadowing is reported rather than merely allowed.
 *
 * A collision WITHIN one kind — two mocks, or two components in different directories — has no
 * such answer, so the label is registered for NOBODY and returned in `ambiguous`. That leaves
 * an unresolved tag, which `IndexPage.vue` turns into a named entry FAILURE: Vue only warns
 * about one, and a warning is invisible to `harness-shot`, which would otherwise photograph a
 * prototype with a component silently missing and exit 0.
 *
 * **What the INDEX says about that, which for a while was nothing.** `label` is the basename
 * and only the `id` carries the path, so the day two components in different directories share
 * one — a case `discoverEntries` supports on purpose, and which no file in the tree produces
 * today (measured) — the list renders two rows reading the same name and the same kind,
 * distinguishable only by their `href`. Criterion 4 still holds (both are reachable at their
 * own URL); what failed was the reading of it, and a designer composing either name met an
 * unresolved tag with no explanation while the picker showed two ordinary entries.
 *
 * `IndexPage.vue` reads `ambiguous` now and marks both rows with the reason, in words. The fix
 * deliberately is not "show the path": separating the rows would leave that same designer with
 * the same unexplained failure, so what the list shows is the decision THIS function took.
 * `tests/harness/indexAmbiguity.test.ts` plants the pair the tree does not contain and drives
 * it, including the half that must stay silent — a mock shadowing a component of the same name
 * is deterministic, not ambiguous, and marking it would report the headline workflow as a
 * defect.
 */
export function registrableComponents(entries: HarnessEntry[]): {
	byTag: Map<string, HarnessEntry>;
	ambiguous: string[];
	shadowed: string[];
} {
	const seen = new Map<string, HarnessEntry[]>();

	for (const entry of entries) seen.set(entry.label, [...(seen.get(entry.label) ?? []), entry]);

	const byTag = new Map<string, HarnessEntry>();
	const ambiguous: string[] = [];
	const shadowed: string[] = [];

	for (const [label, found] of seen) {
		if (found.length === 1) {
			byTag.set(label, found[0]);
			continue;
		}

		const mocks = found.filter((entry) => entry.kind === 'prototype');

		// Exactly one mock: it wins, whatever number of components it stands in for. Two mocks
		// is a collision within a kind again, and falls through to `ambiguous` with the rest.
		if (mocks.length === 1) {
			byTag.set(label, mocks[0]);
			shadowed.push(label);
			continue;
		}

		ambiguous.push(label);
	}

	return { byTag, ambiguous, shadowed };
}

/**
 * Install every registrable entry on an app, and refuse the tags it would OVERWRITE.
 *
 * One function for both callers — `page.ts` in the browser and `indexApp.ts` under test — so
 * the refusal below is exercised by the same code the real page runs. They had two copies of
 * the loop, which is how the registry step came to be missing from one of them once already.
 *
 * **What it refuses, and why silence here is dangerous.** `app.use(VueKonva)` registers globals
 * (`VStage`, `VLayer`, …) before this runs, and `app.component(tag, …)` would happily replace
 * one. Vue only WARNS about that, the warning fires before `IndexPage` installs its handler —
 * there is no component instance yet — and `harness-shot` deliberately ignores `console.warn`.
 * So a mock named `VStage.vue` would take the tag out from under `PlanCanvas`, which would then
 * render the mock inside the real editor and photograph it as a success. A discovered entry
 * shadowing a discovered COMPONENT is the workflow; shadowing a plugin's global is not, and the
 * two are only distinguishable here, where the app is.
 *
 * `app.component(tag)` with one argument is Vue's own getter — `undefined` when nothing holds
 * the tag — so what counts as taken is asked of the app rather than kept in a list beside it.
 */
/**
 * The tags Vue's COMPILER resolves itself, before any registry is consulted.
 *
 * `app.component('Transition')` answers `undefined` — a built-in is not in the app registry —
 * so the collision check below cannot see these, and registering one appears to work. What
 * fails is composition: a template writing `<Transition />` gets Vue's, and a mock named
 * `Transition.vue` would be listed, registered, openable on its own, and silently substituted
 * everywhere it was composed.
 *
 * A literal list because it is VUE'S list, not this repository's: six components at the pinned
 * version, plus `component` and `slot`, which the compiler treats the same way. It is short and
 * it is stable; if Vue adds one, a mock named after it stops being refused and the composition
 * defect returns — which is the trade a list always makes, taken here because the alternative
 * (asking the compiler) is not a public API.
 *
 * Worth saying that this is not merely a harness rule: a component named `Transition.vue` would
 * hit the same wall in `src/presentation/`, so a mock refused here is being told something true
 * about the name rather than something local to the index.
 *
 * **A NATIVE tag is the same defect and is not a list**, which is why it is not in this one:
 * `button.vue` or `main.vue` compiles to an element, never a component lookup, so composing it
 * would render an empty `<button>` and the stage would mark itself ready over the wrong screen.
 * `app.config.isNativeTag` is Vue's own answer to that question — `runtime-dom` installs it —
 * so the check below asks it rather than keeping a copy of HTML. Case matters and correctly so:
 * `Button.vue` is a fine component name and only the lowercase spelling collides.
 */
const VUE_BUILT_INS = new Set([
	'Transition',
	'TransitionGroup',
	'KeepAlive',
	'Teleport',
	'Suspense',
	'BaseTransition',
	'component',
	'slot',
]);

export function registerEntries(app: App, byTag: Map<string, HarnessEntry>): string[] {
	const refused: string[] = [];

	for (const [tag, entry] of byTag) {
		if (VUE_BUILT_INS.has(tag) || app.config.isNativeTag?.(tag) === true || app.component(tag) !== undefined) {
			refused.push(tag);
			continue;
		}

		// `defineAsyncComponent`, never the resolved component: an async child is a dependency of
		// the `<Suspense>` boundary `IndexPage.vue` marks the stage from, so resolving here would
		// settle the subtree a tick earlier than the browser does and take the readiness question
		// this page is built around out of the test entirely.
		app.component(tag, defineAsyncComponent(entry.component as () => Promise<Component>));
	}

	return refused;
}
