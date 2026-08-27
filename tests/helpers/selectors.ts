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

/** The parsed name of a declaration's property, whatever shape the parser gave the value. */
export function propertyOf(declaration: Declaration): string {
	if (declaration.property === 'unparsed') return declaration.value.propertyId.property;
	if (declaration.property === 'custom') return declaration.value.name;

	return declaration.property;
}

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
	/**
	 * The properties this rule declares with `!important`, by name.
	 *
	 * `declarations` is the two lists concatenated, normal first, which makes last-wins correct
	 * WITHIN a block and says nothing ACROSS them. An important declaration beats every normal one
	 * in every other rule regardless of specificity, so a caller resolving a cascade across rules
	 * needs to know which properties arrived that way.
	 */
	readonly important: ReadonlySet<string>;
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

	// COMPOSED, not replaced. Conditional at-rules nest, and each one's visit walks its own
	// descendants — so an inner `@media` inside an outer `@supports` overwrote the outer's entry and
	// the rule ended up recorded as needing the media query alone. The outer visit runs first, so
	// the inner has something to add to; sorted, so the conjunction is the same whichever way the
	// nesting was written.
	const markNested = (nested: readonly { type: string; value: unknown }[], condition: string): void => {
		for (const rule of nested) {
			const value = rule.value as { loc?: { line: number; column: number }; rules?: { type: string; value: unknown }[] };

			if (rule.type === 'style' && value.loc !== undefined) {
				const key = sourceKey(value.loc);
				const standing = conditions.get(key);

				conditions.set(key, standing === undefined ? condition : [standing, condition].toSorted().join(' and '));
			}

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
					const value = rule.value as {
						rules: { type: string; value: unknown }[];
						query?: unknown;
						condition?: unknown;
						name?: unknown;
					};

					// The SEMANTIC fields only, named one at a time. Spreading everything but `rules` also
					// carried `loc`, so two identical `@media` blocks in the same sheet had different
					// identities and a ring in the second could not answer a suppression in the first —
					// a gate blocking a stylesheet organised in the ordinary way. The field names are
					// read off the parser (`query` for media; `condition` for supports; `name` and
					// `condition` for container) rather than written from memory.
					markNested(value.rules, JSON.stringify([rule.type, value.query, value.name, value.condition]));

					return undefined;
				}

				// AN AT-RULE THAT CHANGES HOW THE CASCADE RANKS ITS CONTENTS IS REFUSED, not flattened.
				// `@layer` does not condition a rule the way `@media` does — it RE-RANKS it, and a layered
				// rule loses to an unlayered one whatever the specificity, so every caller comparing
				// specificity here would be comparing the wrong thing. `@scope` likewise bounds which
				// elements match by proximity, which no `Conditions` shape models. lightningcss visits the
				// rules INSIDE both, so they arrive looking ordinary and unconditional: a ring in a layer
				// would answer a flattening site it actually loses to, silently.
				//
				// Nothing in this repository writes either today, which is exactly why this is a refusal
				// rather than an implementation — the same trade `show()` makes for an unmodelled payload.
				// The first sheet to use one stops the build and gets the modelling it needs.
				if (rule.type === 'layer-block' || rule.type === 'scope') {
					throw new Error(`stylesheetRules(): "@${rule.type === 'scope' ? 'scope' : 'layer'}" changes how the cascade ranks its contents, which nothing reading this models`);
				}

				if (rule.type !== 'style') return undefined;

				rules.push({
					selectors: rule.value.selectors,
					declarations: [...rule.value.declarations.declarations, ...rule.value.declarations.importantDeclarations],
					condition: conditions.get(sourceKey(rule.value.loc)) ?? '',
					important: new Set(rule.value.declarations.importantDeclarations.map((one) => propertyOf(one))),
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
export const argumentsOf = (component: SelectorComponent): SelectorList =>
	component.type === 'pseudo-class' && 'selectors' in component && Array.isArray(component.selectors)
		? component.selectors
		: [];

/**
 * The selector list of an `An+B of S` pseudo-class — `:nth-child`/`:nth-last-child` — or `[]`.
 *
 * A SECOND accessor rather than a widening of `argumentsOf`, because the two answer different
 * questions and only one of them changes here. `argumentsOf` feeds `alternativesOf` and
 * `subjectClasses`, which ask what a rule REACHES: `:nth-child(2 of .scope)` is a strict subset of
 * `.scope`, so folding it in there would have a rule claim elements the nth constraint excludes.
 * What `of` does change is the SCORE, and it is the one place in this grammar where a
 * functional pseudo-class contributes its argument IN ADDITION to itself.
 *
 * The parser puts it under `of`, not under `selectors`, which is why the generic arm could not see
 * it at all: `.button:nth-child(2 of .scope):focus-visible` scored (0,3,0) here and is (0,4,0) in
 * a browser. Under-scoring a rule is the false-pass direction — a reset that really wins the
 * cascade reads as losing it, and `tests/build/buttonFocusRing.test.ts` then certifies a focus
 * indicator no user can see.
 */
const nthOfArgumentsOf = (component: SelectorComponent): SelectorList =>
	component.type === 'pseudo-class' && 'of' in component && Array.isArray(component.of) ? component.of : [];

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

				// `:nth-child(An+B of S)` is the one shape that scores BOTH — a class for itself AND
				// the most specific selector in `S` — where `:is()`/`:not()`/`:has()` score their
				// argument INSTEAD of themselves. Handled before the generic arm because it is the
				// argument list that decides, and this one is spelled `of` rather than `selectors`.
				const nthOf = nthOfArgumentsOf(component);
				const args = nthOf.length > 0 ? nthOf : argumentsOf(component);

				if (nthOf.length > 0 || args.length === 0) classes += 1;

				if (args.length === 0) break;

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
	if (component.type !== 'pseudo-class') return false;
	// POSITIVE POSITION ONLY, the same rule `subjectClasses` states one function up and for the same
	// reason: `:is()` and `:where()` describe the element itself, while `:not()` and `:has()` describe
	// what it is NOT and what hangs below it. Reading all four alike is the defect this file's header
	// already records — an exemption written for a class, inherited by every selector that NEGATES it.
	//
	// Here it inverted a leakage gate: `:not(.rp-harness-stage)` reported as BEING the stage, took the
	// stage's allow-list, and so `:not(.rp-harness-stage) { background-color: red }` — which matches
	// virtually every element inside a mounted entry — passed as if it were the stage styling itself.
	// This predicate was written after `subjectClasses` was fixed, with its own copy of the recursion
	// and without its rule.
	if (!MATCHES_THE_SUBJECT.has(component.kind)) return false;

	return argumentsOf(component).some((argument) => argument.some((part) => hasClass(part, name)));
};

/**
 * Does any component of this compound carry the class IN POSITIVE POSITION — at any nesting depth
 * through `:is()`/`:where()`, and never through `:not()`/`:has()`?
 */
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
 * That promise used to hold for a component's TYPE and not for its PAYLOAD, which is the same
 * defect the paragraph above describes and the wider half of it. A pseudo node carries its
 * argument in a differently-named field per kind, and every field this rendering did not name was
 * dropped in silence — so `:dir(ltr)` and `:dir(rtl)` were both `:dir`, `::-webkit-scrollbar` and
 * `::-webkit-scrollbar-thumb` were both `::webkit-scrollbar` (the vendored `obsidian.css` carries
 * both pairs), `:nth-child(2 of .a)` and `:nth-child(2 of .b)` were both `:nth-child(0n+2)`, and
 * EVERY pseudo-class the parser does not know became `:custom`, since it puts the real name in a
 * `name` field. `RENDERED_KEYS` closes that: a node carrying a key this function does not consume
 * throws, so the failure mode for the next unmodelled payload is a red build rather than two
 * disjoint selectors sharing one identity.
 *
 * One function rather than four, because the recursion through a functional pseudo's arguments
 * would otherwise be a mutually recursive set — the shape `specificityOf` above was collapsed out
 * of for the same reason.
 */
/**
 * The keys `show` below CONSUMES on a pseudo-class or pseudo-element node.
 *
 * A key outside this set is payload the rendering would drop, and a dropped payload is not a
 * vaguer string — it is two disjoint selectors answering to one identity. Stated as the set of
 * what IS rendered rather than a list of kinds to refuse, so a kind nobody here has heard of is
 * refused by default: this is the check standing at the forbidden thing rather than at the
 * places someone thought of.
 */
const RENDERED_KEYS: ReadonlySet<string> = new Set([
	'type',
	'kind',
	'vendorPrefix',
	'selectors',
	'a',
	'b',
	'of',
	'direction',
	'value',
]);

/**
 * An identifier rendered so that no two distinct ones collide.
 *
 * The parser hands back the UNESCAPED name, so `.scope\\.a` — one class called `scope.a` — and
 * `.scope.a` — two classes — arrive as different trees and used to render the same string. `covers`
 * compares those strings, so a ring scoped to one could clear a flattening site under the other and
 * the gate would pass with no indicator on screen. The same shape as the payload collisions above,
 * one level down: at the CHARACTER rather than at the node.
 *
 * A single pass escaping everything outside the safe set, which makes it a bijection — `\\` is itself
 * outside the set and so escapes to `\\\\`, and a two-pass version would have re-escaped what the
 * first pass inserted. This is CSS identifier escaping in the cases that matter and is not claimed
 * to be more: a leading digit is left alone, because it changes no IDENTITY and this string is
 * compared, never parsed back.
 */
const identifier = (name: string): string => name.replace(/[^A-Za-z0-9_-]/gu, (character) => `\\${character}`);

/** An attribute VALUE rendered inside its quotes, with the quote and the escape itself escaped. */
const quoted = (value: string): string => value.replace(/["\\]/gu, (character) => `\\${character}`);

/** The vendor prefix a node carries, rendered, or `''` when it is unprefixed. */
const prefixOf = (component: SelectorComponent): string =>
	'vendorPrefix' in component && Array.isArray(component.vendorPrefix) && component.vendorPrefix.length > 0
		? `-${component.vendorPrefix.join('-')}-`
		: '';

/** Throw rather than render a node whose payload this serializer would silently drop. */
function refuseUnrenderedPayload(component: SelectorComponent): void {
	const dropped = Object.keys(component).filter((key) => !RENDERED_KEYS.has(key));

	if (dropped.length > 0) {
		const kind = 'kind' in component ? String(component.kind) : component.type;

		throw new Error(`show(): "${kind}" carries ${dropped.join(', ')}, which this rendering would drop`);
	}
}

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
					return identifier(component.name);
				}
				case 'id': {
					return `#${identifier(component.name)}`;
				}
				case 'class': {
					return `.${identifier(component.name)}`;
				}
				case 'combinator': {
					return component.value === 'descendant' ? ' ' : ` ${component.value} `;
				}
				case 'pseudo-element': {
					refuseUnrenderedPayload(component);

					// The scrollbar family is SEVEN pseudo-elements under ONE kind, told apart by `value`
					// alone — and the source spelling is not derivable from it (`resizer` is
					// `::-webkit-resizer`, not `::-webkit-scrollbar-resizer`). So this one renders as a
					// function: an identity that distinguishes them, which is what the caller needs,
					// rather than a reconstruction of the text, which would need a lookup table.
					if ('value' in component) return `::${component.kind}(${String(component.value)})`;

					return `::${prefixOf(component)}${component.kind}`;
				}
				case 'attribute': {
					const { name, operation } = component;

					if (operation === null || operation === undefined) return `[${identifier(name)}]`;

					const operator = ATTRIBUTE_OPERATORS[operation.operator];

					if (operator === undefined) {
						throw new Error(`show(): no rendering for the "${operation.operator}" attribute operator`);
					}

					return `[${identifier(name)}${operator}"${quoted(operation.value)}"${operation.caseSensitivity === 'case-sensitive' ? '' : ' i'}]`;
				}
				case 'pseudo-class': {
					refuseUnrenderedPayload(component);

					const name = `:${prefixOf(component)}${component.kind}`;
					const args = argumentsOf(component);

					if (args.length > 0) return `${name}(${args.map((argument) => show(argument)).join(', ')})`;

					if ('a' in component && 'b' in component) {
						const nth = `${String(component.a)}n+${String(component.b)}`;
						// The `of` list is part of WHICH elements this matches, so two selectors differing
						// only there are disjoint and may not share an identity.
						const of = nthOfArgumentsOf(component);

						return `${name}(${of.length > 0 ? `${nth} of ${of.map((argument) => show(argument)).join(', ')}` : nth})`;
					}

					if ('direction' in component) return `${name}(${String(component.direction)})`;

					return name;
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
