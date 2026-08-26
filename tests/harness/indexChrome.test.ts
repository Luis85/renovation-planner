// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Selector } from 'lightningcss';
import { compoundHasClass, compoundsOf, stylesheetRules, typeOf } from '../helpers/selectors';
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
const harnessSelectors = (css: string): Selector[] => stylesheetRules(css).flatMap((rule) => rule.selectors);

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
const reachesTheStage = (selector: Selector): boolean => {
	const compounds = compoundsOf(selector);

	// The WHOLE relationship can live inside a functional pseudo — `:is(.rp-harness-index > main
	// h2)` — where the compound carrying the root is also the last one, and every question below
	// would read it as a root with nothing after it. Its arguments are asked the same question.
	const nested = compounds.some((compound) =>
		compound.components
			.flatMap((component) => (component.type === 'pseudo-class' && 'selectors' in component ? component.selectors : []))
			.some((argument) => reachesTheStage(argument)),
	);

	if (nested) return true;

	let insideLeaf = false;

	for (const [at, compound] of compounds.entries()) {
		const last = at === compounds.length - 1;

		if (compoundHasClass(compound, STAGE) || typeOf(compound) === 'main') return !last;

		if (compoundHasClass(compound, PICKER_ROOT)) {
			if (last) return false;
			if (compound.after !== 'child') return true;
			if (typeOf(compounds[at + 1]) !== 'nav') return true;

			return compounds[at + 1].after === 'next-sibling' || compounds[at + 1].after === 'later-sibling';
		}

		if (insideLeaf && compound.after === 'descendant') return true;
		if (compoundHasClass(compound, LEAF)) {
			if (compound.after === 'descendant') return true;

			insideLeaf = compound.after === 'child';
		}
	}

	return false;
};

/** A selector rendered back to text, so a failure names something a reader can grep for. */
const show = (selector: Selector): string =>
	selector
		.map((component) => {
			if (component.type === 'class') return `.${component.name}`;
			if (component.type === 'type') return component.name;
			if (component.type === 'combinator') return component.value === 'descendant' ? ' ' : ` ${component.value} `;
			if (component.type === 'pseudo-class') return `:${component.kind}`;

			return '';
		})
		.join('');

describe('the picker stylesheet, on what its selectors can reach', () => {
	it('leaves the mounted entry alone, from every root that leads to it', () => {
		const offenders = harnessSelectors(readFileSync('tests/harness/theme.css', 'utf8'))
			.filter((selector) => reachesTheStage(selector))
			.map((selector) => show(selector));

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
	])('reports %s', (_case, css) => {
		expect(harnessSelectors(css).filter((selector) => reachesTheStage(selector))).toHaveLength(1);
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
	])('says nothing about %s', (_case, css) => {
		expect(harnessSelectors(css).filter((selector) => reachesTheStage(selector))).toEqual([]);
	});
});
