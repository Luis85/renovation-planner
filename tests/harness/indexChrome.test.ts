// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Selector } from 'lightningcss';
import { alternativesOf, compoundHasClass, compoundsOf, propertyOf, show, stylesheetRules, typeOf } from '../helpers/selectors';
import { afterEach, describe, expect, it } from 'vitest';
import { entryShots } from '../../scripts/entryShots.mjs';
import { openIndex } from './indexApp';

/**
 * Which of the index's two routes draws the picker beside the stage.
 *
 * The picker is a fixed-width sidebar, and at the narrow viewport that matters most it took
 * roughly 210px of a 460px capture — so a mock laid itself out in 250px while the picture
 * claimed 460, and the author compensated by eye. `&bare` is what a capture asks for, and
 * `scripts/entryShots.mjs` puts it on every named-entry shot.
 *
 * Opt-in, and the second case is why. Hiding the picker for every `?entry=` was the obvious
 * version: it makes a directly-opened entry a dead end reachable only by editing the URL, and
 * it collides with criterion 8, which wants a failing entry to name itself IN the index rather
 * than blank the page. Seven cases in `indexPage.test.ts` navigate by clicking a row after
 * opening an entry, which is how that version was caught.
 */

afterEach(() => {
	document.body.innerHTML = '';
});

const navRows = async (query: string) => {
	const wrapper = await openIndex(query);
	try {
		return wrapper.findAll('nav li').length;
	} finally {
		wrapper.unmount();
	}
};

describe('the harness index, on which route drew it', () => {
	it('keeps the picker at ?index, which is the route for choosing', async () => {
		expect(await navRows('index')).toBeGreaterThan(0);
	});

	it('keeps it at ?entry=, since the list is how a person moves between entries', async () => {
		expect(await navRows('entry=prototype:ZonePanel')).toBeGreaterThan(0);
	});

	it('drops it at &bare, so a capture measures the screen and not the harness', async () => {
		expect(await navRows('entry=prototype:ZonePanel&bare')).toBe(0);
	});

	// The capture asks for it; nothing else does. A shot whose query lost this parameter would
	// go back to measuring the sidebar, silently and with every assertion still green.
	it('is what every named-entry capture asks for', () => {
		expect(entryShots('prototype:ZonePanel').map((shot) => shot.query.includes('&bare'))).toEqual([true, true]);
	});
});

/**
 * THE PICKER'S RULES MAY NOT REACH THE STAGE, which is `theme.css`'s second header rule and the
 * one its first cannot imply.
 *
 * `.rp-harness-index` holds BOTH the picker and `<main class="rp-harness-stage">`, so any
 * descendant selector rooted there styles whatever entry is mounted. `.rp-harness-index h2` —
 * a perfectly reasonable-looking rule naming no Obsidian class, so the first header rule passes
 * it — drew every entry's own `<h2>` in the picker's uppercase tracked type. It shipped for one
 * capture and was caught by eye, on `WorkPackages.vue`'s title.
 *
 * Nothing else here can see it. jsdom resolves no cascade, so no mounted-component assertion in
 * this suite changes; the accessibility scan grades semantics, which are untouched; and a
 * capture only shows it to somebody who happens to have an entry open at the time. So the check
 * is on the FORBIDDEN THING — the shape of the selector — per `CLAUDE.md`'s rule about category
 * invariants, and it therefore holds for rules nobody has written yet.
 *
 * **Read through `lightningcss`, the parser this project already ships with.** This file grew a
 * hand-rolled reader and review found four holes in it in four consecutive rounds — a pattern
 * anchored on the whitespace after a class, a raw comma split cutting `:is(.a, .b)` in half, a
 * combinator split that lost `>` because whitespace sat on both sides of it, and a relationship
 * nested inside a pseudo that the scanner kept whole and never looked into. Every one was the
 * same defect: a selector is a grammar and a regex is not a parser. `tests/helpers/selectors.ts`
 * carries the account and the shared reader.
 */
/**
 * What a rule on the STAGE ITSELF may declare — an allow-list, and it is one on purpose.
 *
 * `.rp-harness-stage { text-transform: uppercase }` never descends into anything, and restyles
 * every entry the index opens anyway: the property INHERITS. That is the shipped defect's exact
 * mechanism — `.rp-harness-index h2 { text-transform: uppercase }` — reached without a descendant
 * selector, and a check that only looked at selector shape called it safe.
 *
 * A deny-list of inherited properties was the obvious answer and is refused: that is a value
 * vocabulary, which is the shape that has been wrong four times in `indicators.ts` alone, and a
 * new inherited property would pass it silently. An allow-list fails the other way — a property
 * nobody has thought about stops the build and gets thought about. Everything on it is a
 * non-inherited box or layout property, which is all the stage needs to be a container.
 *
 * Nothing here can ask the parser whether a property inherits; lightningcss models values, not
 * that. So this list is the claim, and its being an ALLOW-list is what keeps the claim safe.
 */
const STAGE_MAY_DECLARE = new Set([
	'flex',
	'flex-basis',
	'flex-direction',
	'flex-grow',
	'flex-shrink',
	'display',
	'position',
	'overflow',
	'overflow-x',
	'overflow-y',
	'width',
	'height',
	'min-width',
	'min-height',
	'max-width',
	'max-height',
	'margin',
	'padding',
	'gap',
	'row-gap',
	'column-gap',
	'align-items',
	'justify-content',
	'box-sizing',
	'background-color',
	'border',
	'contain',
	'isolation',
]);

const PICKER_ROOT = 'rp-harness-index';
const STAGE = 'rp-harness-stage';
const LEAF = 'rp-harness-leaf';

/**
 * Every selector in a stylesheet that could reach the mounted entry — which is EVERY selector,
 * because the roots that lead there are not one class.
 *
 * The scan used to keep only selectors mentioning `.rp-harness-index`, which is the route the
 * shipped defect happened to take. `.rp-harness-stage h2` takes a shorter one: it names the stage
 * directly, mentions the index nowhere, restyles the mounted entry exactly the same way, and was
 * discarded before `reachesTheStage` ever saw it. A filter that names one root answers for one
 * root; the predicate is what decides, so nothing is filtered out ahead of it.
 */
const harnessRules = (css: string): { selector: Selector; properties: string[] }[] =>
	stylesheetRules(css).flatMap((rule) =>
		rule.selectors.map((selector) => ({ selector, properties: rule.declarations.map((one) => propertyOf(one)) })),
	);

/** Is this branch's subject the page itself — one `body` or `html`, with nothing below it? */
const isThePage = (branch: Selector): boolean => {
	const compounds = compoundsOf(branch);

	return (
		compounds.length === 1 && (typeOf(compounds[0]) === 'body' || typeOf(compounds[0]) === 'html')
	);
};

/** Does this rule declare anything that INHERITS past the element it was written for? */
const inherits = (properties: readonly string[]): boolean =>
	properties.some((property) => !STAGE_MAY_DECLARE.has(property));

/**
 * Does this branch name any part of the harness — a `rp-harness-*` class, or the missing-icon
 * attribute no Obsidian selector can be spelled as?
 *
 * Asked of the COMPONENTS, in positive position only. It was a substring test on the rendered
 * selector, which is the same defect this whole pair of files was rewritten to stop: a structural
 * question answered against text. `body:has(.rp-harness-group) h2` mentions the picker and is
 * rooted at `body` — it matches whenever the picker exists and restyles every heading in every
 * mounted entry — and the substring found the class and called it harness-scoped.
 *
 * `alternativesOf` expands `:is()` and `:where()` and leaves `:not()` and `:has()` whole, so
 * skipping pseudo-classes here is exactly "in positive position": an alternative the subject may
 * match counts, something it must NOT be or must merely CONTAIN does not.
 *
 * `body` alone is not enough, and is the exception `theme.css`'s header carves out: it is held to
 * `height`, which does not inherit, so the caller's own property test lets it through.
 *
 * The attribute is read from the parsed node rather than matched as text. `[data-icon-missing]` is
 * what `obsidian-mock.ts` stamps when `setIcon` is called and the mock draws no SVG; the spelling
 * has to be exact, and getting it wrong fails LOUDLY — that rule becomes an offender in the real
 * sheet, which is how the first version of this line was caught.
 */
const namesTheHarness = (branch: Selector): boolean =>
	alternativesOf(branch).some((alternative) =>
		alternative.some(
			(component) =>
				(component.type === 'class' && component.name.startsWith('rp-harness-')) ||
				(component.type === 'attribute' && component.name === 'data-icon-missing'),
		),
	);

/**
 * Does this selector reach a DESCENDANT of the stage — the element every entry mounts into?
 *
 * Stated about the STAGE rather than about the picker, because the picker is one of three ways in
 * and the other two name it nowhere. Three roots lead to the mounted entry and each bounds
 * differently:
 *
 * - **the stage itself.** Anything after it is inside it. Styling the stage is fine; descending
 *   past it is the whole defect. `<main>` is taken as the stage too — it is the only one on the
 *   page — so a rule that reaches it by TYPE rather than by class is caught as well.
 * - **the picker root**, which holds both the nav and the stage. The nav is the only safe child.
 *   Treating every `>` as safe let `.rp-harness-index > main h2` through: one child hop, then a
 *   descent into the stage. Reaching the nav is not the end of the walk either —
 *   `.rp-harness-index > nav + main h2` steps sideways onto the stage beside it. Only the hop
 *   DIRECTLY after the nav can escape, because anything deeper is already a descendant of the nav
 *   and a sibling of a descendant shares its parent.
 * - **the leaf**, the whole page. Once a selector is inside it, ANY descendant hop can land in the
 *   stage — not only one taken straight off the leaf, which is why this is a state carried down
 *   the walk rather than a question asked of one compound. `.rp-harness-leaf > div h2` takes a
 *   child hop first and then descends, and reads as bounded right up until the last hop. A chain
 *   of CHILD hops stays bounded, which is what keeps the growth chain
 *   (`.rp-harness-leaf > div > div:last-child`, a real rule that must reach through containers)
 *   out of this.
 *
 * The residual, since the rule is that a check's sentence is written to what it can see: a chain
 * of CHILD hops that walks down INTO the stage without naming it or `<main>` — by `:nth-child`,
 * say — is not modelled. Nothing here is written that way and the rules that come close stop
 * above the stage.
 */
const branchReachesTheStage = (branch: Selector, properties: readonly string[]): boolean => {
	const compounds = compoundsOf(branch);

	let insideLeaf = false;

	for (const [at, compound] of compounds.entries()) {
		const last = at === compounds.length - 1;

		// Descending past the stage always reaches the entry. Landing ON it reaches the entry too
		// whenever what the rule declares INHERITS, which is why this arm needs the declarations at
		// all — `.rp-harness-stage { text-transform: uppercase }` styles no descendant and restyles
		// every one of them.
		if (compoundHasClass(compound, STAGE) || typeOf(compound) === 'main') {
			return last ? properties.some((property) => !STAGE_MAY_DECLARE.has(property)) : true;
		}

		if (compoundHasClass(compound, PICKER_ROOT)) {
			// Landing on the PICKER reaches the entry for exactly the same reason landing on the stage
			// does: the stage is inside the picker, so an inherited declaration passes straight
			// through it. The stage arm was widened for this a round earlier and its two ANCESTORS
			// were left universally exempt — the same fix, not applied to the same shape twice.
			if (last) return inherits(properties);
			if (compound.after !== 'child') return true;
			if (typeOf(compounds[at + 1]) !== 'nav') return true;

			return compounds[at + 1].after === 'next-sibling' || compounds[at + 1].after === 'later-sibling';
		}

		if (insideLeaf && compound.after === 'descendant') return true;
		if (compoundHasClass(compound, LEAF)) {
			if (compound.after === 'descendant') return true;
			if (last) return inherits(properties);

			insideLeaf = compound.after === 'child';
		}
	}

	// NOTHING in this branch names a part of the harness, and that is not a reason to pass it.
	// `body h2` and `html .rp-entry-title` reach every mounted entry while naming neither the leaf,
	// the picker, the stage nor `main`, and this walk fell straight through to `false` for them —
	// so the sentence above, which says every selector in the sheet is checked, was answering for a
	// set it had quietly excluded.
	//
	// `theme.css`'s FIRST header rule already says every selector must name something the harness
	// draws, with `body` as its single exception; that rule was enforced nowhere. It is enforced
	// here, in the one place that is already reading every selector in the sheet.
	// A selector naming no harness vocabulary is refused unless its subject can only be the PAGE
	// ITSELF. `h2 { background-color: red }` needs no ancestor and no inherited property to restyle
	// every heading in a mounted entry — it simply matches them — and a fallback asking for a
	// combinator or an inherited property let it through. `body` is the sheet's one exception and it
	// is exempt because of WHAT IT MATCHES: exactly one element, outside the stage. `height: 100%`
	// being non-inheriting is why that exception is harmless, not why it exists.
	return !namesTheHarness(branch) && !isThePage(branch);
};



const reachesTheStage = (selector: Selector, properties: readonly string[] = []): boolean =>
	// `:is()` is EXPANDED first, so every question below is asked of a plain selector. The
	// alternative — recursing into each pseudo's arguments and asking them the same question — reads
	// as equivalent and is not: an argument answers about ITSELF, with no idea what follows the
	// pseudo it sits in. `:is(main) h2` is the counter-example. Asked alone, `main` is a lone
	// compound with nothing after it, so it answers "the stage, not descended past" — correct about
	// the fragment and wrong about the selector, which reaches every `h2` in the mounted entry.
	// Expansion rebuilds `main h2` and the ordinary walk answers it.
	alternativesOf(selector).some((branch) => branchReachesTheStage(branch, properties));



describe('the picker stylesheet, on what its selectors can reach', () => {
	it('leaves the mounted entry alone, from every root that leads to it', () => {
		const offenders = harnessRules(readFileSync('tests/harness/theme.css', 'utf8'))
			.filter((rule) => reachesTheStage(rule.selector, rule.properties))
			.map((rule) => show(rule.selector));

		expect(offenders).toEqual([]);
	});

	/**
	 * The instrument, proved to bite before its green result is trusted — the same bargain
	 * `accessibility.test.ts` makes with its unlabelled `<img>`. Both spellings of the defect are
	 * driven: the one that actually shipped, and a deeper one that a check looking only at the
	 * next token would miss.
	 */
	it.each([
		['the rule that shipped', '.rp-harness-index h2 { text-transform: uppercase; }'],
		['a deeper descendant', '.rp-harness-index section p em { color: red; }'],
		// The two a pattern anchored on "whitespace right after the class" lets through. Neither
		// exists today; the check is written to the shape so that adding one cannot open the hole.
		['a qualified root', '.rp-harness-index.theme-dark h2 { color: red; }'],
		['a root inside a functional pseudo', ':is(.rp-harness-index) h2 { color: red; }'],
		// The SELECTOR-LIST form, which the single-argument case above does not exercise: its
		// comma is what a raw prelude split cuts the selector in half on.
		['a root inside a selector list', ':is(.rp-harness-index, .other) h2 { color: red; }'],
		// One `>` and then a descent into the STAGE. The child combinator is not the guarantee —
		// which child it names is.
		['a descent through the stage element', '.rp-harness-index > main h2 { color: red; }'],
		['a descent through the stage class', '.rp-harness-index > .rp-harness-stage h2 { color: red; }'],
		// Reaches the picker, then steps sideways onto the stage beside it.
		['a sibling hop off the picker', '.rp-harness-index > nav + main h2 { color: red; }'],
		['a general sibling hop off the picker', '.rp-harness-index > nav ~ main h2 { color: red; }'],
		// The whole relationship nested inside the pseudo, where the compound scan sees one token.
		['a relationship nested in a pseudo', ':is(.rp-harness-index > main h2) { color: red; }'],
		['a descendant nested in a pseudo', ':is(.rp-harness-index h2) { color: red; }'],
		// The routes that name the picker NOWHERE. Each restyles the mounted entry exactly as the
		// rule that shipped did, and each was discarded by the old scan before the predicate ran:
		// it kept only selectors mentioning `.rp-harness-index`, so a shorter path in was invisible.
		['a rule rooted at the stage class', '.rp-harness-stage h2 { color: red; }'],
		['a rule rooted at the stage element', 'main h2 { color: red; }'],
		['a descendant of the whole page', '.rp-harness-leaf h2 { color: red; }'],
		['a child of the page, then a descent', '.rp-harness-leaf > div h2 { color: red; }'],
		// No descendant selector anywhere, and the entry is restyled all the same: the property
		// INHERITS into it. This is the shipped defect's exact mechanism reached by a shorter route,
		// and a check reading only selector shape called it safe.
		['an inherited property on the stage', '.rp-harness-stage { text-transform: uppercase; }'],
		['an inherited property on the stage element', 'main { color: red; }'],
		['an inherited property beside a safe one', '.rp-harness-stage { flex: 1; font-family: serif; }'],
		['a pseudo-wrapped stage carrying one', ':is(main) { letter-spacing: 0.1em; }'],
		// The stage's two ANCESTORS. An inherited declaration passes straight through the stage from
		// either, so the arm widened for the stage a round earlier had to be applied to both.
		['an inherited property on the picker root', '.rp-harness-index { text-transform: uppercase; }'],
		['an inherited property on the leaf', '.rp-harness-leaf { font-family: serif; }'],
		// Named nowhere in this sheet's vocabulary, and reaching every entry regardless. The walk
		// fell through to `false` for these, so the invariant's own sentence was answering for a set
		// it had quietly excluded.
		['a selector rooted above the harness', 'body h2 { color: red; }'],
		['a selector rooted at the document', 'html .rp-entry-title { text-transform: uppercase; }'],
		['a bare type selector', 'h2 { color: red; }'],
		// No ancestor, no combinator, no inherited property — and it restyles every heading in every
		// mounted entry, because it simply MATCHES them. The fallback asked for a combinator or an
		// inherited property and this has neither.
		['a bare type selector with a non-inherited property', 'h2 { background-color: red; }'],
		['a bare class selector from outside the harness', '.rp-entry-title { border: 1px solid; }'],
		// Harness chrome mentioned only inside `:has()`. The subject is `h2` under `body`, so this
		// matches whenever the picker exists and restyles every heading in every entry — and a
		// substring test on the rendered selector found the class and called it harness-scoped.
		['harness chrome named only inside :has()', 'body:has(.rp-harness-group) h2 { color: red; }'],
		['harness chrome named only inside :not()', 'body:not(.rp-harness-leaf) h2 { color: red; }'],
		// The stage reached through a pseudo. `typeOf` reads a compound's DIRECT components, so the
		// pseudo hid the type from the outer walk; asking the argument on its own hid what followed
		// the pseudo from the argument. Expansion is what sees both at once.
		['a pseudo-wrapped stage element', ':is(main) h2 { color: red; }'],
		['a pseudo-wrapped stage class', ':is(.rp-harness-stage) h2 { color: red; }'],
		['a pseudo-wrapped stage among alternatives', ':is(.other, main) h2 { color: red; }'],
		['a pseudo-wrapped leaf', ':is(.rp-harness-leaf) h2 { color: red; }'],
	])('reports %s', (_case, css) => {
		expect(harnessRules(css).filter((rule) => reachesTheStage(rule.selector, rule.properties))).toHaveLength(1);
	});

	/**
	 * And says nothing about the three legitimate shapes, so the pattern is not simply refusing
	 * every mention of the class: the root rule itself, a scoped child, and the `:not()` this
	 * file's growth chain actually uses.
	 */
	it.each([
		['the root rule', '.rp-harness-index { display: flex; }'],
		['a scoped child', '.rp-harness-index > nav li a { color: red; }'],
		// A sibling DEEPER than the nav stays inside it, so it is not a leak.
		['a sibling inside the picker', '.rp-harness-index > nav li + li { color: red; }'],
		// A safe relationship nested in a pseudo must stay silent too, or the recursion is just
		// a blanket refusal of every pseudo that mentions the root.
		['a safe relationship nested in a pseudo', ':is(.rp-harness-index > nav li) { color: red; }'],
		['an exclusion', '.rp-harness-leaf > div:not(.rp-harness-index) { flex: 1; }'],
		// Styling the stage is not descending into it, and the growth chain is real: a chain of
		// CHILD hops from the leaf stays above the mounted entry. Widening the scan to the stage
		// and the leaf is what makes both of these worth stating — before it, neither was in scope
		// at all and their silence proved nothing.
		['the stage itself', '.rp-harness-stage { flex: 1; }'],
		['the stage element itself', 'main { flex: 1; }'],
		['the growth chain', '.rp-harness-leaf > div > div:last-child { flex: 1; }'],
		['the leaf itself', '.rp-harness-leaf { display: flex; }'],
		// `body` is the sheet's one exception to naming something the harness draws, and it is held
		// to a non-inheriting property — which is what lets it through here rather than a carve-out.
		['the body height rule', 'body { height: 100%; }'],
		// The missing-icon attribute is harness vocabulary too, and the rule that uses it is real.
		['the missing-icon rule', '[data-icon-missing]::after { content: attr(data-icon-missing); }'],
		// A harness class inside `:is()` IS the subject's own, so it must stay silent — or positive
		// position has become "no pseudo counts at all".
		['harness chrome named inside :is()', ':is(.rp-harness-group, .rp-harness-empty) { display: block; }'],
		// The real stage rule, which must stay silent or the allow-list has refused the one thing
		// the stage exists to do.
		['the stage as a container', '.rp-harness-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; }'],
		// The same wrapping on a shape that does not descend must stay silent, or expansion has
		// simply become a blanket refusal of every pseudo.
		['a pseudo-wrapped stage, not descended past', ':is(main) { flex: 1; }'],
		['a pseudo-wrapped scoped child', ':is(.rp-harness-index) > nav li a { color: red; }'],
	])('says nothing about %s', (_case, css) => {
		expect(harnessRules(css).filter((rule) => reachesTheStage(rule.selector, rule.properties))).toEqual([]);
	});
});
