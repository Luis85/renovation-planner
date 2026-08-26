import { transform, type Declaration, type Selector, type SelectorComponent, type SelectorList } from 'lightningcss';

/**
 * CSS read through the parser this project already ships with, rather than through regexes.
 *
 * **Why this file exists.** Two checks — `tests/build/buttonSpecificity.test.ts` and
 * `tests/harness/indexChrome.test.ts` — have to answer questions about selectors: what class does
 * a rule's subject wear, how specific is it, does it reach past a given element. Both grew
 * hand-rolled readers, and NINE consecutive rounds of review found holes in them. Every one was
 * the same defect wearing different clothes — the reader saw the spellings it was written
 * against and silently passed the rest:
 *
 * - a substring match reading `.rp-dialog-button` inside `.rp-dialog-button-danger`
 * - a comma split cutting `:is(.a, .b)` in half
 * - a combinator split losing `>` because whitespace sat on both sides of it
 * - `\(([^()]*)\)` matching only INNERMOST parentheses, which forced innermost-first resolution,
 *   which forced one shared accumulator, which double-counted a nested pseudo
 * - reading `:not()`'s contents as classes the subject WEARS, which inverted an exemption
 *
 * None of those is a hard problem. They are all the same problem: a selector is a grammar, and a
 * regex is not a parser. `lightningcss` is already a devDependency, already parses this
 * project's stylesheets in `tests/build/styles.test.ts` and `tests/harness/harness.test.ts`, and
 * hands back a typed tree in which each of those five defects is unrepresentable — a combinator
 * IS a node, a pseudo-class OWNS its argument list, and nesting is structure rather than text.
 *
 * **What this does not fix.** A parser cannot know what a check should ASK. The semantic
 * decisions still live with the callers and are still theirs to get right: that `:not()` and
 * `:has()` describe something other than the subject while `:is()` and `:where()` describe the
 * subject itself, that `:where()` contributes zero specificity, that a sibling of the picker is
 * not inside it. What changes is that those decisions are now expressed against a tree instead
 * of being tangled up with the business of finding a bracket.
 */

/** Where a rule sits in its source, used only to match a nested rule against its at-rule parent. */
const sourceKey = (loc: { line: number; column: number }): string => `${String(loc.line)}:${String(loc.column)}`;

/** A style rule as these checks need it: its selector list, its declarations, and its CONDITION. */
export interface StyleRule {
	readonly selectors: SelectorList;
	readonly declarations: readonly Declaration[];
	/**
	 * The `@media`/`@supports`/`@container` query this rule sits inside, or `''` for one that
	 * always applies. An identity rather than prose — callers compare it, nothing reads it — so it
	 * is the parsed query serialized, not a rendering of the source text.
	 */
	readonly condition: string;
}

/**
 * Every style rule in a stylesheet.
 *
 * `errorRecovery` for the reason `tests/harness/harness.test.ts` gives at length: the vendored
 * `obsidian.css` contains preserved prose that closes a comment early, and a parse that aborts
 * would report a file as empty rather than as broken. Nothing here parses that file today, and
 * the flag costs nothing on a file that is already valid.
 *
 * The visitor never RETURNS a rule, so nothing is rewritten — this is a read, and `transform`'s
 * output is discarded.
 */
export function stylesheetRules(css: string): StyleRule[] {
	const rules: StyleRule[] = [];
	// A conditional at-rule and the style rules inside it are visited SEPARATELY, parent first and
	// with nothing linking them — so a rule that only applies in dark mode arrived looking
	// unconditional. `styles/work-packages.css` has a real `@container` block, so this is not
	// hypothetical. The parent's visit records its descendants by source location; the child's own
	// visit then finds its condition waiting.
	const conditions = new Map<string, string>();

	const markNested = (nested: readonly { type: string; value: unknown }[], condition: string): void => {
		for (const rule of nested) {
			const value = rule.value as { loc?: { line: number; column: number }; rules?: { type: string; value: unknown }[] };

			if (rule.type === 'style' && value.loc !== undefined) conditions.set(sourceKey(value.loc), condition);
			if (value.rules !== undefined) markNested(value.rules, condition);
		}
	};

	transform({
		filename: 'read.css',
		code: Buffer.from(css),
		errorRecovery: true,
		visitor: {
			Rule(rule) {
				if (rule.type === 'media' || rule.type === 'supports' || rule.type === 'container') {
					const { rules: nested, ...query } = rule.value as { rules: { type: string; value: unknown }[] };

					markNested(nested, JSON.stringify(query));

					return undefined;
				}

				if (rule.type !== 'style') return undefined;

				rules.push({
					selectors: rule.value.selectors,
					declarations: [...rule.value.declarations.declarations, ...rule.value.declarations.importantDeclarations],
					condition: conditions.get(sourceKey(rule.value.loc)) ?? '',
				});

				return undefined;
			},
		},
	});

	return rules;
}

/**
 * One selector, parsed.
 *
 * Wrapped in a throwaway rule because `lightningcss` parses STYLESHEETS — there is no public
 * entry point for a bare selector. That is an implementation detail of this function and not of
 * its callers, which is the point of putting it here: the tests below both drive fixtures as
 * selector strings, and neither should know how a string becomes a tree.
 *
 * Throws on a selector the parser rejects. A test fixture that is not a selector is a defect in
 * the fixture, and `errorRecovery` would turn it into a silent empty result — the shape this
 * whole file exists to stop.
 */
export function parseSelector(selector: string): Selector {
	const rules = stylesheetRules(`${selector} { color: red }`);
	const parsed = rules[0]?.selectors[0];

	if (parsed === undefined) throw new Error(`not a selector: ${selector}`);

	return parsed;
}

/** The parsed name of a declaration's property, whatever shape the parser gave the value. */
export function propertyOf(declaration: Declaration): string {
	if (declaration.property === 'unparsed') return declaration.value.propertyId.property;
	if (declaration.property === 'custom') return declaration.value.name;

	return declaration.property;
}

/**
 * The functional pseudo-classes whose argument describes the SUBJECT — alternatives it may match
 * — as opposed to `:not()` (what it must not be) and `:has()` (what must be below it).
 *
 * The distinction is the caller's semantics rather than the parser's, and it is here because both
 * callers need the same answer. Reading all four alike inverted an exemption once:
 * `button:not(.rp-dialog-button)` matched the one class deliberately allowed to lose, inherited
 * its carve-out, and thereby exempted every OTHER button in the project.
 */
const MATCHES_THE_SUBJECT = new Set(['is', 'where', 'any']);

/** A pseudo-class node's argument list, or `[]` when it has none. */
const argumentsOf = (component: SelectorComponent): SelectorList =>
	component.type === 'pseudo-class' && 'selectors' in component && Array.isArray(component.selectors)
		? component.selectors
		: [];

/**
 * The class names a selector's SUBJECT wears — its last compound, the element the rule styles.
 *
 * An ancestor mention does not count: `.rp-dialog-button .icon` styles the icon. Nor does a
 * negated or `:has()`-ed one, per `MATCHES_THE_SUBJECT`.
 */
export function subjectClasses(selector: Selector): string[] {
	const lastCombinator = selector.map((part) => part.type).lastIndexOf('combinator');
	const subject = selector.slice(lastCombinator + 1);

	const classesIn = (component: SelectorComponent): string[] => {
		if (component.type === 'class') return [component.name];
		if (component.type !== 'pseudo-class') return [];
		if (!MATCHES_THE_SUBJECT.has(component.kind)) return [];

		return argumentsOf(component).flatMap((argument) => argument.flatMap((part) => classesIn(part)));
	};

	return subject.flatMap((component) => classesIn(component));
}

/**
 * Every selector this one is equivalent to, with `:is()` expanded into its alternatives.
 *
 * `:is(.a, .b) span` matches what `.a span, .b span` matches — it is sugar for a selector list,
 * and the union is the point. A caller that folds the alternatives together loses exactly that:
 * `:is(.rp-dialog-button, button)` reads as wearing `.rp-dialog-button`, and an exemption written
 * for that class then covers the `button` branch, which matches every button in the project.
 * Same defect as reading `:not()`'s contents as classes the subject wears, one function along.
 *
 * `:not()` and `:has()` are left whole, because their arguments are not alternatives for the
 * subject — expanding those would be the original defect rather than the fix for it.
 *
 * **SPECIFICITY does not distribute over this.** `:is(.a, button)` scores its most specific
 * argument for every element it matches, so a caller asking how a rule ranks must ask
 * `specificityOf` about the ORIGINAL selector. Expansion answers which elements a rule reaches,
 * and nothing else.
 */
export function alternativesOf(selector: Selector): Selector[] {
	let branches: SelectorComponent[][] = [[]];

	for (const component of selector) {
		const expandable =
			component.type === 'pseudo-class' && MATCHES_THE_SUBJECT.has(component.kind) && argumentsOf(component).length > 0;

		if (!expandable) {
			branches = branches.map((prefix) => [...prefix, component]);
			continue;
		}

		const alternatives = argumentsOf(component).flatMap((argument) => alternativesOf(argument));

		branches = branches.flatMap((prefix) => alternatives.map((alternative) => [...prefix, ...alternative]));
	}

	return branches;
}

/** Strictly more specific, comparing (id, class, type) in order. */
export const moreSpecific = (a: readonly [number, number, number], b: readonly [number, number, number]): boolean =>
	a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

/** The zero specificity, as its own value so the reduce below has a seed of the right type. */
const NO_SPECIFICITY: readonly [number, number, number] = [0, 0, 0];

/**
 * A selector's (id, class, type) specificity, per CSS Selectors 4.
 *
 * The pseudo-class arm is the whole reason this is not a counting loop. `:not()`, `:is()` and
 * `:has()` contribute their MOST SPECIFIC argument and nothing of their own — which is why
 * Obsidian's `button:not(.clickable-icon)` scores (0,1,1) rather than (0,0,1), and therefore why
 * every threshold in `buttonSpecificity` is what it is. `:where()` contributes ZERO, argument
 * included. Anything else is an ordinary pseudo-class and counts as a class.
 *
 * Each argument is scored by a fresh call and the maximum taken, so there is no shared accumulator
 * for a nested pseudo to leak into: `:is(.a, :not(.b))` is (0,1,0), not (0,2,0). Reading it as one
 * running total was a real defect, and it read as BEATING Obsidian's rule while actually losing.
 * That is also why the recursion is direct rather than going through a named helper — a mutually
 * recursive pair is what invites a caller to thread state between the two halves.
 */
export function specificityOf(selector: Selector): [number, number, number] {
	let ids = 0;
	let classes = 0;
	let types = 0;

	for (const component of selector) {
		switch (component.type) {
			case 'id': {
				ids += 1;
				break;
			}
			case 'class':
			case 'attribute': {
				classes += 1;
				break;
			}
			case 'type':
			case 'pseudo-element': {
				types += 1;
				break;
			}
			case 'pseudo-class': {
				if (component.kind === 'where') break;

				const args = argumentsOf(component);

				if (args.length === 0) {
					classes += 1;
					break;
				}

				const [i, c, t] = args
					.map((argument) => specificityOf(argument))
					.reduce((best, one) => (moreSpecific(one, best) ? one : best), NO_SPECIFICITY);

				ids += i;
				classes += c;
				types += t;
				break;
			}
			default: {
				break;
			}
		}
	}

	return [ids, classes, types];
}

/** A selector's compounds, each paired with the combinator that FOLLOWS it. */
export interface Compound {
	readonly components: SelectorComponent[];
	readonly after: string | null;
}

/**
 * Split a selector into compounds at its combinators.
 *
 * The combinator is attached to the compound BEFORE it, because the question both callers ask is
 * about one hop: what follows this element, and how. A parsed combinator is a node with a name
 * (`child`, `descendant`, `next-sibling`, `later-sibling`), so the whitespace that once made
 * `.a > .b` lose its `>` is not part of the representation at all.
 */
export function compoundsOf(selector: Selector): Compound[] {
	const compounds: Compound[] = [];
	let current: SelectorComponent[] = [];

	for (const component of selector) {
		if (component.type === 'combinator') {
			compounds.push({ components: current, after: component.value });
			current = [];
		} else current.push(component);
	}

	compounds.push({ components: current, after: null });

	return compounds;
}

const hasClass = (component: SelectorComponent, name: string): boolean => {
	if (component.type === 'class') return component.name === name;

	return argumentsOf(component).some((argument) => argument.some((part) => hasClass(part, name)));
};

/** Does any component of this compound — at any nesting depth — carry the class? */
export const compoundHasClass = (compound: Compound, name: string): boolean =>
	compound.components.some((component) => hasClass(component, name));


/** A compound's type selector — its element name — or `null` when it names none. */
export const typeOf = (compound: Compound): string | null => {
	const type = compound.components.find((component) => component.type === 'type');

	return type !== undefined && type.type === 'type' ? type.name : null;
};

const ATTRIBUTE_OPERATORS: Record<string, string> = {
	equal: '=',
	includes: '~=',
	'dash-match': '|=',
	prefix: '^=',
	substring: '*=',
	suffix: '$=',
};

/**
 * A selector rendered back to text, LOSSLESSLY.
 *
 * Two callers had a copy of this, both written for a failure message, where dropping a component
 * only makes the message vaguer. Then `buttonSpecificity` began comparing the rendered string to
 * decide whether one rule's scope covers another's, and lossy became unsound:
 * `.dialog[data-kind='a']` and `.dialog[data-kind='b']` both rendered `.dialog`, so a ring drawn
 * in one container cleared a flattening rule in a disjoint one.
 *
 * It THROWS on a component kind, or an attribute operator, it does not model. That is the point
 * rather than an oversight: returning `''` for the unknown is how it was lossy in the first place,
 * and a serializer used as an IDENTITY has to fail closed. An unmodelled kind stops the build and
 * gets modelled.
 *
 * One function rather than four, because the recursion through a functional pseudo's arguments
 * would otherwise be a mutually recursive set — the shape `specificityOf` above was collapsed out
 * of for the same reason.
 */
export function show(selector: Selector): string {
	return selector
		.map((component) => {
			switch (component.type) {
				case 'universal': {
					return '*';
				}
				case 'nesting': {
					return '&';
				}
				case 'type': {
					return component.name;
				}
				case 'id': {
					return `#${component.name}`;
				}
				case 'class': {
					return `.${component.name}`;
				}
				case 'combinator': {
					return component.value === 'descendant' ? ' ' : ` ${component.value} `;
				}
				case 'pseudo-element': {
					return `::${component.kind}`;
				}
				case 'attribute': {
					const { name, operation } = component;

					if (operation === null || operation === undefined) return `[${name}]`;

					const operator = ATTRIBUTE_OPERATORS[operation.operator];

					if (operator === undefined) {
						throw new Error(`show(): no rendering for the "${operation.operator}" attribute operator`);
					}

					return `[${name}${operator}"${operation.value}"${operation.caseSensitivity === 'case-sensitive' ? '' : ' i'}]`;
				}
				case 'pseudo-class': {
					const args = argumentsOf(component);

					if (args.length > 0) return `:${component.kind}(${args.map((argument) => show(argument)).join(', ')})`;
					if ('a' in component && 'b' in component) return `:${component.kind}(${String(component.a)}n+${String(component.b)})`;

					return `:${component.kind}`;
				}
				default: {
					throw new Error(`show(): no rendering for a "${component.type}" component`);
				}
			}
		})
		.join('');
}

/**
 * Every `@import` URL a stylesheet declares, IN ORDER — the cascade's own view of the sheet.
 *
 * Read through the parser rather than matched against text, for the reason
 * `tests/harness/harness.test.ts` gives at length about its own copy: `/@import/` is
 * case-sensitive and misses `@IMPORT`, and `/@import/i` would then match one inside a comment.
 *
 * `errorRecovery` because the vendored `obsidian.css` contains preserved upstream prose that
 * closes a comment early and cannot otherwise be parsed at all. Recovery skips the malformed rule
 * and keeps visiting; it changes nothing for a file that already parses.
 */
export function importsIn(file: string, css: Buffer | string): string[] {
	const found: string[] = [];

	transform({
		filename: file,
		code: typeof css === 'string' ? Buffer.from(css) : css,
		errorRecovery: true,
		visitor: {
			Rule: {
				import: (rule) => {
					found.push(rule.value.url);

					return [];
				},
			},
		},
	});

	return found;
}
