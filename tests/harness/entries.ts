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
	// unreachable, with nothing to notice. Throwing turns that into a page that says so.
	const ids = new Set(entries.map((entry) => entry.id));

	if (ids.size !== entries.length) throw new Error(`duplicate harness entry ids in ${kind}`);

	return entries;
}

/** Every mock and prototype under `src/prototypes/`. */
export const prototypeEntries = (): HarnessEntry[] =>
	discoverEntries(
		import.meta.glob('../../src/prototypes/**/*.vue') as Record<string, () => Promise<unknown>>,
		'prototype',
	);

/** Every real component under `src/presentation/`. */
export const componentEntries = (): HarnessEntry[] =>
	discoverEntries(
		import.meta.glob('../../src/presentation/**/*.vue') as Record<string, () => Promise<unknown>>,
		'component',
	);

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
